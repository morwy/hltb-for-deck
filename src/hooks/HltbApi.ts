import { fetchNoCors } from '@decky/api';
import { get } from 'fast-levenshtein';
import { normalize } from '../utils';
import {
    clearApiBootstrapCache,
    getApiBootstrapCache,
    updateApiBootstrapCache,
} from './Cache';
import {
    GameData,
    GamePageData,
    HLTBGameStats,
    SearchResults,
} from './GameInfoData';

// Keep one browser-like user agent for the related HLTB auth/search requests.
// Related Python API fix: https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI/pull/53
// We could randomize it later if we still reuse the same value consistently.
const USER_AGENT =
    'Chrome: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36';
const DEFAULT_SEARCH_URL = '/api/bleed';

interface SearchAuth {
    token: string;
    hpKey: string;
    hpVal: string;
}

let searchUrl: string = '';
let searchAuth: SearchAuth | null = null;
let bootstrapCacheLoaded = false;

function getBaseHeaders() {
    return {
        'Content-Type': 'application/json',
        Origin: 'https://howlongtobeat.com',
        Referer: 'https://howlongtobeat.com/',
        'User-Agent': USER_AGENT,
    };
}

function getSearchHeaders(auth: SearchAuth) {
    return {
        ...getBaseHeaders(),
        Authority: 'howlongtobeat.com',
        'x-auth-token': auth.token,
        'x-hp-key': auth.hpKey,
        'x-hp-val': auth.hpVal,
    };
}

function parseSearchAuth(data: unknown): SearchAuth | null {
    if (!data || typeof data !== 'object') {
        console.error('HLTB - unexpected auth response:', data);
        return null;
    }

    const authData = data as Record<string, unknown>;
    const token =
        typeof authData.token === 'string' ? authData.token : undefined;
    let hpKey: string | undefined;
    let hpVal: string | undefined;

    for (const [fieldName, fieldValue] of Object.entries(authData)) {
        if (typeof fieldValue !== 'string') {
            continue;
        }

        const lowerFieldName = fieldName.toLowerCase();
        if (!hpKey && lowerFieldName.includes('key')) {
            hpKey = fieldValue;
        } else if (!hpVal && lowerFieldName.includes('val')) {
            hpVal = fieldValue;
        }
    }

    if (token && hpKey && hpVal) {
        console.log('HLTB auth acquired');
        return {
            token,
            hpKey,
            hpVal,
        };
    }

    console.error('HLTB - incomplete auth response:', data);
    return null;
}

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSearchUrlFromScript(scriptText: string): string | null {
    if (
        !scriptText.includes('searchTerms') ||
        !scriptText.includes('searchOptions')
    ) {
        return null;
    }

    const pattern =
        /fetch\s*\(\s*["'`]\/api\/([a-zA-Z0-9_\/]+)[^"'`]*["'`]\s*,\s*{[^}]*method:\s*["'`]POST["'`][^}]*}/gi;
    const candidates: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(scriptText)) !== null) {
        if (!match[1]) {
            continue;
        }

        const pathSuffix = match[1];
        const basePath = pathSuffix.includes('/')
            ? pathSuffix.split('/')[0]
            : pathSuffix;
        const discoveredSearchUrl = `/api/${basePath}`;
        const initPattern = new RegExp(
            `\\/api\\/${escapeRegex(basePath)}\\/init`,
            'i'
        );

        if (initPattern.test(scriptText)) {
            return discoveredSearchUrl;
        }

        candidates.push(discoveredSearchUrl);
    }

    return candidates[0] ?? null;
}

function extractScriptUrls(html: string, baseUrl: string) {
    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return Array.from(doc.querySelectorAll('script'))
            .map((script) => script.getAttribute('src'))
            .filter((src): src is string => Boolean(src))
            .map((src) => new URL(src, `${baseUrl}/`).toString());
    }

    const scripts: string[] = [];
    const pattern = /<script\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) !== null) {
        if (match[2]) {
            scripts.push(new URL(match[2], `${baseUrl}/`).toString());
        }
    }

    return scripts;
}

async function persistSearchBootstrap(
    currentSearchUrl: string,
    auth: SearchAuth
) {
    searchUrl = currentSearchUrl;
    searchAuth = auth;
    await updateApiBootstrapCache({
        searchUrl: currentSearchUrl,
        searchAuth: {
            searchUrl: currentSearchUrl,
            ...auth,
        },
    });
}

async function invalidateSearchAuth() {
    searchAuth = null;
    await clearApiBootstrapCache('searchAuth');
}

async function persistNextJsKey(nextJsKey: string) {
    const nextJsCache = keyCache.get(NextJsKey);
    if (nextJsCache) {
        nextJsCache.key = nextJsKey;
    }

    await updateApiBootstrapCache({
        nextJsKey,
    });
}

async function invalidateNextJsKey() {
    const nextJsCache = keyCache.get(NextJsKey);
    if (nextJsCache) {
        nextJsCache.key = null;
    }

    await clearApiBootstrapCache('nextJsKey');
}

async function fetchSearchAuth(
    currentSearchUrl: string
): Promise<SearchAuth | null> {
    try {
        const timestamp = Date.now();
        const url = `https://howlongtobeat.com${currentSearchUrl}/init?t=${timestamp}`;
        const response = await fetchNoCors(url, {
            method: 'GET',
            headers: getBaseHeaders(),
        });

        if (response.status === 200) {
            const data = await response.json();
            const auth = parseSearchAuth(data);
            if (auth !== null) {
                await persistSearchBootstrap(currentSearchUrl, auth);
            }

            return auth;
        } else {
            console.error('HLTB - failed to get auth token:', response.status);
        }
    } catch (error) {
        console.error('HLTB - error fetching auth token:', error);
    }

    await invalidateSearchAuth();
    return null;
}

async function fetchSearchUrl(): Promise<string | null> {
    try {
        const url = 'https://howlongtobeat.com';
        const origin = new URL(url).origin;
        const response = await fetchNoCors(url, {
            headers: getBaseHeaders(),
        });

        if (response.status === 200) {
            const html = await response.text();
            const scripts = extractScriptUrls(html, url);

            for (const scriptSrc of scripts) {
                const scriptUrl = new URL(scriptSrc, `${url}/`);
                if (
                    scriptUrl.origin !== origin ||
                    !scriptUrl.pathname.endsWith('.js')
                ) {
                    continue;
                }

                const scriptResponse = await fetchNoCors(scriptUrl.toString(), {
                    headers: getBaseHeaders(),
                });

                if (scriptResponse.status !== 200) {
                    continue;
                }

                const discoveredSearchUrl = extractSearchUrlFromScript(
                    await scriptResponse.text()
                );

                if (discoveredSearchUrl) {
                    console.log('HLTB Search URL:', discoveredSearchUrl);
                    return discoveredSearchUrl;
                }
            }

            console.warn(
                `HLTB - failed to discover search URL, falling back to ${DEFAULT_SEARCH_URL}`
            );
            return DEFAULT_SEARCH_URL;
        } else {
            console.error('HLTB', response);
        }
    } catch (error) {
        console.error(error);
    }

    return null;
}

const NextJsKey = Symbol('NextJs Key');
async function fetchNextJsKey() {
    try {
        const url = 'https://howlongtobeat.com';
        const response = await fetchNoCors(url, {
            headers: getBaseHeaders(),
        });

        if (response.status === 200) {
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const scripts = doc.querySelectorAll('script');

            for (const script of scripts) {
                if (
                    script.src.includes('_ssgManifest.js') ||
                    script.src.includes('_buildManifest.js')
                ) {
                    const pattern =
                        /\/_next\/static\/(.+)\/(?:_ssgManifest|_buildManifest)\.js/;
                    const matches = script.src.match(pattern);

                    if (matches && matches[1]) {
                        return matches[1];
                    }
                }
            }

            console.error('HLTB - failed to get NextJs key!');
        } else {
            console.error('HLTB', response);
        }
    } catch (error) {
        console.error(error);
    }

    return null;
}

const keyCache = new Map<
    symbol,
    { key: string | null; keyFetch: () => Promise<string | null> }
>([[NextJsKey, { key: null, keyFetch: fetchNextJsKey }]]);

async function ensureBootstrapCacheLoaded() {
    if (bootstrapCacheLoaded) {
        return;
    }

    bootstrapCacheLoaded = true;

    const bootstrapCache = await getApiBootstrapCache();
    searchUrl = bootstrapCache?.searchUrl || DEFAULT_SEARCH_URL;

    if (
        bootstrapCache?.searchAuth &&
        bootstrapCache.searchAuth.searchUrl === searchUrl
    ) {
        searchAuth = {
            token: bootstrapCache.searchAuth.token,
            hpKey: bootstrapCache.searchAuth.hpKey,
            hpVal: bootstrapCache.searchAuth.hpVal,
        };
    } else {
        searchAuth = null;
    }

    const nextJsCache = keyCache.get(NextJsKey);
    if (nextJsCache) {
        nextJsCache.key = bootstrapCache?.nextJsKey ?? null;
    }
}

async function fetchWithKey(
    keyName: symbol,
    callback: (key: string) => Promise<Response>
) {
    await ensureBootstrapCacheLoaded();

    let cache = keyCache.get(keyName);
    if (!cache) {
        console.error('HLTB - failed to get cache item for', keyName);
        return null;
    }

    cache.key = cache.key || (await cache.keyFetch());
    if (cache.key === null) {
        // error already logged
        return null;
    }

    if (keyName === NextJsKey) {
        await persistNextJsKey(cache.key);
    }

    const results = await callback(cache.key);
    if (results.status === 200) {
        return results;
    }

    // Key might have expired, fetch a new one and try again
    if (keyName === NextJsKey) {
        await invalidateNextJsKey();
    }

    cache.key = await cache.keyFetch();
    if (cache.key === null) {
        // error already logged
        return null;
    }

    if (keyName === NextJsKey) {
        await persistNextJsKey(cache.key);
    }

    // Whatever the response is, we propagate it to be logged
    return await callback(cache.key);
}

async function refreshSearchAuth(refreshSearchPath = false) {
    await ensureBootstrapCacheLoaded();

    if (refreshSearchPath || searchUrl === '') {
        searchUrl = (await fetchSearchUrl()) || DEFAULT_SEARCH_URL;
        await invalidateSearchAuth();
    }

    if (searchUrl === '') {
        searchUrl = DEFAULT_SEARCH_URL;
    }

    const auth = await fetchSearchAuth(searchUrl);
    if (auth !== null || refreshSearchPath) {
        return auth;
    }

    await invalidateSearchAuth();
    searchUrl = (await fetchSearchUrl()) || DEFAULT_SEARCH_URL;
    return await fetchSearchAuth(searchUrl);
}

async function fetchWithSearchAuth(
    callback: (auth: SearchAuth) => Promise<Response>
) {
    await ensureBootstrapCacheLoaded();

    let auth = searchAuth || (await refreshSearchAuth());
    if (auth === null) {
        return null;
    }

    let results = await callback(auth);
    if (results.status === 200) {
        return results;
    }

    await invalidateSearchAuth();
    auth = await refreshSearchAuth();
    if (auth !== null) {
        results = await callback(auth);
        if (results.status === 200) {
            return results;
        }
    }

    await invalidateSearchAuth();
    auth = await refreshSearchAuth(true);
    if (auth === null) {
        return null;
    }

    results = await callback(auth);
    return results;
}

async function fetchSearchResultsWithAuth(gameName: string, auth: SearchAuth) {
    const data = {
        searchType: 'games',
        searchTerms: gameName.split(' '),
        searchPage: 1,
        size: 20,
        searchOptions: {
            games: {
                userId: 0,
                platform: '',
                sortCategory: 'name',
                rangeCategory: 'main',
                rangeTime: { min: 0, max: 0 },
                gameplay: {
                    perspective: '',
                    flow: '',
                    genre: '',
                    difficulty: '',
                },
                modifier: 'hide_dlc',
            },
            users: {},
            filter: '',
            sort: 0,
            randomizer: 0,
        },
        [auth.hpKey]: auth.hpVal,
    };

    return fetchNoCors(`https://howlongtobeat.com${searchUrl}`, {
        method: 'POST',
        headers: getSearchHeaders(auth),
        body: JSON.stringify(data),
    });
}

async function fetchSearchResults(appName: string) {
    const response = await fetchWithSearchAuth((auth) =>
        fetchSearchResultsWithAuth(appName, auth)
    );
    if (!response) {
        // Error already logged
        return null;
    }

    if (response.status !== 200) {
        console.error('HLTB', response);
        return null;
    }

    const results: SearchResults = await response.json();
    const logInvalidDataAndReturn = () => {
        console.error(
            'HLTB - unexpected JSON data for search results',
            results
        );
        return null;
    };

    if (!Array.isArray(results?.data)) {
        return logInvalidDataAndReturn();
    }

    for (const item of results.data) {
        if (typeof item?.game_id !== 'number') {
            return logInvalidDataAndReturn();
        }

        if (typeof item?.game_name !== 'string') {
            return logInvalidDataAndReturn();
        }

        if (typeof item?.comp_all_count !== 'number') {
            return logInvalidDataAndReturn();
        }

        item.game_name = normalize(item.game_name);
    }

    return results;
}

async function fetchGamePageDataWithKey(gameId: number, apiKey: string) {
    return fetchNoCors(
        `https://howlongtobeat.com/_next/data/${apiKey}/game/${gameId}.json`,
        {
            method: 'GET',
        }
    );
}

async function fetchGameData(gameId: number) {
    const response = await fetchWithKey(NextJsKey, (key) =>
        fetchGamePageDataWithKey(gameId, key)
    );
    if (!response) {
        // Error already logged
        return null;
    }

    if (response.status !== 200) {
        console.error('HLTB', response);
        return null;
    }

    const results: GamePageData = await response.json();
    const logInvalidDataAndReturn = () => {
        console.error('HLTB - unexpected JSON data for game page', results);
        return null;
    };

    if (!Array.isArray(results?.pageProps?.game?.data?.game)) {
        return logInvalidDataAndReturn();
    }

    const gameDataList = results.pageProps.game.data.game;
    if (gameDataList.length !== 1) {
        return logInvalidDataAndReturn();
    }

    const gameData = gameDataList[0];

    if (typeof gameData?.comp_main !== 'number') {
        return logInvalidDataAndReturn();
    }

    if (typeof gameData?.comp_plus !== 'number') {
        return logInvalidDataAndReturn();
    }

    if (typeof gameData?.comp_100 !== 'number') {
        return logInvalidDataAndReturn();
    }

    if (typeof gameData?.comp_all !== 'number') {
        return logInvalidDataAndReturn();
    }

    if (typeof gameData?.game_id !== 'number') {
        return logInvalidDataAndReturn();
    }

    if (typeof gameData?.profile_steam !== 'number') {
        return logInvalidDataAndReturn();
    }

    return gameData;
}

async function fetchMostCompatibleGameData(
    appName: string,
    appId?: number,
    hltbGameId?: number
) {
    if (typeof hltbGameId === 'number') {
        return await fetchGameData(hltbGameId);
    }

    const searchResults = await fetchSearchResults(appName);
    if (searchResults === null) {
        // Error already logged
        return null;
    }

    const gameDataCache = new Map<number, GameData>();
    const getGameData = async (gameId: number) => {
        return gameDataCache.get(gameId) ?? (await fetchGameData(gameId));
    };

    // Search by appId first
    if (typeof appId === 'number') {
        for (const item of searchResults.data) {
            const gameData = await fetchGameData(item.game_id);
            if (gameData === null) {
                // Error already logged (we should return here, not continue)
                return null;
            }

            if (gameData.profile_steam === appId) {
                return gameData;
            }

            gameDataCache.set(item.game_id, gameData);
        }
    }

    // Search by app name if not found by appId
    for (const item of searchResults.data) {
        if (item.game_name === appName) {
            return getGameData(item.game_id);
        }
    }

    // Couldn't find anything, find a closest match
    if (searchResults.data.length > 0) {
        const possibleChoices = searchResults.data
            .map((item) => {
                return {
                    minEditDistance: get(appName, item.game_name, {
                        useCollator: true,
                    }),
                    item,
                };
            })
            .sort((a, b) => {
                if (a.minEditDistance === b.minEditDistance) {
                    return b.item.comp_all_count - a.item.comp_all_count;
                } else {
                    return a.minEditDistance - b.minEditDistance;
                }
            });
        return getGameData(possibleChoices[0].item.game_id);
    }

    return null;
}

export async function fetchHltbGameStats(
    appName: string,
    appId?: number,
    hltbGameId?: number
): Promise<HLTBGameStats | null> {
    try {
        const gameData = await fetchMostCompatibleGameData(
            appName,
            appId,
            hltbGameId
        );
        if (gameData) {
            return {
                mainStat:
                    gameData.comp_main > 0
                        ? (gameData.comp_main / 60 / 60).toFixed(1)
                        : '--',
                mainPlusStat:
                    gameData.comp_plus > 0
                        ? (gameData.comp_plus / 60 / 60).toFixed(1)
                        : '--',
                completeStat:
                    gameData.comp_100 > 0
                        ? (gameData.comp_100 / 60 / 60).toFixed(1)
                        : '--',
                allStylesStat:
                    gameData.comp_all > 0
                        ? (gameData.comp_all / 60 / 60).toFixed(1)
                        : '--',
                gameId: gameData.game_id,
                lastUpdatedAt: new Date(),
            };
        }
    } catch (error) {
        console.error('HLTB', error);
    }

    return null;
}
