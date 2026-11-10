import { fetchNoCors } from '@decky/api';
import { normalize } from '../utils';
import {
    clearApiBootstrapCache,
    getApiBootstrapCache,
    updateApiBootstrapCache,
} from './Cache';
import { HLTBGameStats, SearchResults } from './GameInfoData';
import {
    extractSearchUrlFromScript,
    parseSearchResults,
    selectMostCompatibleGame,
    selectReliableGame,
} from './HltbSearch';

const FALLBACK_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HLTB_ORIGIN = 'https://howlongtobeat.com';
const DEFAULT_SEARCH_URL = '/api/search/site';
const TRANSIENT_RETRY_MS = 400;
const REQUEST_TIMEOUT_MS = 15_000;
const SCRIPT_REQUEST_TIMEOUT_MS = 5_000;
const SCRIPT_DISCOVERY_BUDGET_MS = 15_000;
const SCRIPT_DISCOVERY_CONCURRENCY = 4;
const STEAM_TITLE_TIMEOUT_MS = 5_000;

interface SearchAuth {
    searchUrl: string;
    token: string;
    hpKey?: string;
    hpVal?: string;
}

let searchUrl = '';
let searchAuth: SearchAuth | null = null;
let bootstrapCachePromise: Promise<void> | null = null;
let authRefreshPromise: Promise<SearchAuth | null> | null = null;
let authRefreshDiscoversPath = false;
let authInvalidationPromise: Promise<void> | null = null;
const gameStatsRequests = new Map<string, Promise<HLTBGameStats | null>>();

function getUserAgent() {
    try {
        const userAgent = globalThis.navigator?.userAgent;
        if (typeof userAgent === 'string' && /Mozilla\/\d/i.test(userAgent)) {
            return userAgent;
        }
    } catch {
        return FALLBACK_USER_AGENT;
    }
    return FALLBACK_USER_AGENT;
}

const USER_AGENT = getUserAgent();

async function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs = REQUEST_TIMEOUT_MS
) {
    const controller =
        typeof AbortController === 'undefined' ? null : new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        const request = fetchNoCors(
            url,
            controller
                ? {
                      ...init,
                      signal: controller.signal,
                  }
                : init
        );
        return await Promise.race([
            request,
            new Promise<Response>((_, reject) => {
                timeout = setTimeout(() => {
                    controller?.abort();
                    reject(new Error(`HLTB request timed out: ${url}`));
                }, timeoutMs);
            }),
        ]);
    } finally {
        if (timeout !== undefined) {
            clearTimeout(timeout);
        }
    }
}

async function withTimeout<T>(
    operation: Promise<T>,
    timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<T>((_, reject) => {
                timeout = setTimeout(
                    () => reject(new Error('HLTB response timed out')),
                    timeoutMs
                );
            }),
        ]);
    } finally {
        if (timeout !== undefined) {
            clearTimeout(timeout);
        }
    }
}

function readResponseJson(response: Response) {
    return withTimeout(response.json() as Promise<unknown>);
}

function readResponseText(response: Response, timeoutMs?: number) {
    return withTimeout(response.text(), timeoutMs);
}

async function discoverSearchUrlFromScripts(scriptUrls: string[]) {
    let nextIndex = 0;
    let discoveredSearchUrl: string | null = null;
    const deadline = Date.now() + SCRIPT_DISCOVERY_BUDGET_MS;

    const inspectNextScript = async () => {
        while (!discoveredSearchUrl) {
            const scriptUrl = scriptUrls[nextIndex];
            nextIndex += 1;
            if (!scriptUrl) {
                return;
            }

            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0) {
                return;
            }

            try {
                const scriptResponse = await fetchWithTimeout(
                    scriptUrl,
                    { headers: getBaseHeaders() },
                    Math.min(SCRIPT_REQUEST_TIMEOUT_MS, remainingMs)
                );
                if (scriptResponse.status !== 200) {
                    continue;
                }

                const bodyBudgetMs = deadline - Date.now();
                if (bodyBudgetMs <= 0) {
                    return;
                }
                const candidate = extractSearchUrlFromScript(
                    await readResponseText(
                        scriptResponse,
                        Math.min(SCRIPT_REQUEST_TIMEOUT_MS, bodyBudgetMs)
                    )
                );
                if (candidate && !discoveredSearchUrl) {
                    discoveredSearchUrl = candidate;
                }
            } catch (error) {
                console.debug(
                    'HLTB - failed to inspect script for search URL:',
                    error
                );
            }
        }
    };

    await Promise.all(
        Array.from(
            {
                length: Math.min(
                    SCRIPT_DISCOVERY_CONCURRENCY,
                    scriptUrls.length
                ),
            },
            inspectNextScript
        )
    );
    return discoveredSearchUrl;
}

function getBaseHeaders() {
    return {
        'Content-Type': 'application/json',
        Origin: HLTB_ORIGIN,
        Referer: `${HLTB_ORIGIN}/`,
        'User-Agent': USER_AGENT,
    };
}

function getSearchHeaders(auth: SearchAuth) {
    const headers: Record<string, string> = {
        ...getBaseHeaders(),
        Authority: 'howlongtobeat.com',
        'x-auth-token': auth.token,
    };

    if (auth.hpKey && auth.hpVal) {
        headers['x-hp-key'] = auth.hpKey;
        headers['x-hp-val'] = auth.hpVal;
    }

    return headers;
}

function parseSearchAuth(
    data: unknown,
    currentSearchUrl: string
): SearchAuth | null {
    if (!data || typeof data !== 'object') {
        console.error('HLTB - unexpected auth response:', data);
        return null;
    }

    const authData = data as Record<string, unknown>;
    const token =
        typeof authData.token === 'string' && authData.token.trim()
            ? authData.token.trim()
            : undefined;
    let hpKey =
        typeof authData.hpKey === 'string' && authData.hpKey
            ? authData.hpKey
            : undefined;
    let hpVal =
        typeof authData.hpVal === 'string' && authData.hpVal
            ? authData.hpVal
            : undefined;

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

    if (!token) {
        console.error('HLTB - incomplete auth response:', data);
        return null;
    }

    const auth: SearchAuth = { searchUrl: currentSearchUrl, token };
    if (hpKey && hpVal) {
        auth.hpKey = hpKey;
        auth.hpVal = hpVal;
    }

    console.log('HLTB auth acquired');
    return auth;
}

function extractScriptUrls(html: string, baseUrl: string) {
    const urls: string[] = [];
    const addUrl = (value: string | null) => {
        if (!value) {
            return;
        }
        try {
            const resolved = new URL(value, `${baseUrl}/`).toString();
            if (!urls.includes(resolved)) {
                urls.push(resolved);
            }
        } catch {
            return;
        }
    };

    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        for (const script of Array.from(doc.querySelectorAll('script'))) {
            addUrl(script.getAttribute('src'));
        }
        return urls;
    }

    const pattern = /<script\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
        addUrl(match[2] ?? null);
    }
    return urls;
}

async function persistSearchBootstrap(auth: SearchAuth) {
    searchUrl = auth.searchUrl;
    searchAuth = auth;
    try {
        await updateApiBootstrapCache({
            searchUrl: auth.searchUrl,
            searchAuth: {
                ...auth,
            },
        });
    } catch (error) {
        console.warn('HLTB - failed to persist API bootstrap:', error);
    }
}

async function invalidateSearchAuth(expectedAuth?: SearchAuth) {
    if (expectedAuth && searchAuth !== expectedAuth) {
        await authInvalidationPromise;
        return false;
    }

    searchAuth = null;
    if (!authInvalidationPromise) {
        const invalidationPromise = clearApiBootstrapCache('searchAuth').catch(
            (error) =>
                console.warn('HLTB - failed to clear cached auth:', error)
        );
        authInvalidationPromise = invalidationPromise;
        try {
            await invalidationPromise;
        } finally {
            if (authInvalidationPromise === invalidationPromise) {
                authInvalidationPromise = null;
            }
        }
    } else {
        await authInvalidationPromise;
    }
    return true;
}

async function fetchSearchAuth(
    currentSearchUrl: string
): Promise<SearchAuth | null> {
    try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const timestamp = Date.now();
            const response = await fetchWithTimeout(
                `${HLTB_ORIGIN}${currentSearchUrl}/init?t=${timestamp}`,
                {
                    method: 'GET',
                    headers: getBaseHeaders(),
                }
            );

            if (response.status === 200) {
                const auth = parseSearchAuth(
                    await readResponseJson(response),
                    currentSearchUrl
                );
                if (auth) {
                    await persistSearchBootstrap(auth);
                }
                return auth;
            }

            if (attempt === 0 && isTransientStatus(response.status)) {
                await delay(TRANSIENT_RETRY_MS);
                continue;
            }

            console.warn(
                `HLTB - auth endpoint ${currentSearchUrl} returned ${response.status}`
            );
            break;
        }
    } catch (error) {
        console.error('HLTB - error fetching auth token:', error);
    }

    await invalidateSearchAuth();
    return null;
}

async function fetchSearchUrl(): Promise<string | null> {
    try {
        const response = await fetchWithTimeout(HLTB_ORIGIN, {
            headers: getBaseHeaders(),
        });
        if (response.status !== 200) {
            console.warn('HLTB - homepage lookup failed:', response.status);
            return null;
        }

        const html = await readResponseText(response);
        const inlineMatch = extractSearchUrlFromScript(html);
        if (inlineMatch) {
            return inlineMatch;
        }

        const origin = new URL(HLTB_ORIGIN).origin;
        const scriptUrls = extractScriptUrls(html, HLTB_ORIGIN).filter(
            (scriptSrc) => {
                const scriptUrl = new URL(scriptSrc, `${HLTB_ORIGIN}/`);
                return (
                    scriptUrl.origin === origin &&
                    scriptUrl.pathname.endsWith('.js')
                );
            }
        );
        const discoveredSearchUrl = await discoverSearchUrlFromScripts(
            scriptUrls
        );
        if (discoveredSearchUrl) {
            console.log('HLTB search URL:', discoveredSearchUrl);
            return discoveredSearchUrl;
        }
    } catch (error) {
        console.error('HLTB - failed to discover search URL:', error);
    }

    return null;
}

function ensureBootstrapCacheLoaded() {
    if (!bootstrapCachePromise) {
        bootstrapCachePromise = (async () => {
            try {
                const bootstrapCache = await getApiBootstrapCache();
                searchUrl = bootstrapCache?.searchUrl || DEFAULT_SEARCH_URL;

                if (
                    bootstrapCache?.searchAuth &&
                    bootstrapCache.searchAuth.searchUrl === searchUrl
                ) {
                    searchAuth = {
                        searchUrl: bootstrapCache.searchAuth.searchUrl,
                        token: bootstrapCache.searchAuth.token,
                        hpKey: bootstrapCache.searchAuth.hpKey,
                        hpVal: bootstrapCache.searchAuth.hpVal,
                    };
                } else {
                    searchAuth = null;
                }
            } catch (error) {
                console.warn(
                    'HLTB - failed to load API bootstrap cache:',
                    error
                );
                searchUrl = DEFAULT_SEARCH_URL;
                searchAuth = null;
            }
        })();
    }
    return bootstrapCachePromise;
}

async function refreshSearchAuthUnlocked(discoverPath: boolean) {
    if (discoverPath || !searchUrl) {
        const discoveredSearchUrl = await fetchSearchUrl();
        if (discoveredSearchUrl) {
            searchUrl = discoveredSearchUrl;
        } else if (!searchUrl) {
            searchUrl = DEFAULT_SEARCH_URL;
        }
        await invalidateSearchAuth();
    }

    const auth = await fetchSearchAuth(searchUrl || DEFAULT_SEARCH_URL);
    if (auth || discoverPath) {
        return auth;
    }

    const previousSearchUrl = searchUrl;
    const discoveredSearchUrl = await fetchSearchUrl();
    searchUrl = discoveredSearchUrl || DEFAULT_SEARCH_URL;
    if (
        searchUrl !== previousSearchUrl ||
        previousSearchUrl !== DEFAULT_SEARCH_URL
    ) {
        return await fetchSearchAuth(searchUrl);
    }
    return null;
}

async function refreshSearchAuth(discoverPath = false) {
    await ensureBootstrapCacheLoaded();

    if (authRefreshPromise) {
        const sharedRefreshDiscoversPath = authRefreshDiscoversPath;
        const sharedAuth = await authRefreshPromise;
        if (!discoverPath || sharedRefreshDiscoversPath) {
            return sharedAuth;
        }
    }

    const refreshPromise = refreshSearchAuthUnlocked(discoverPath);
    authRefreshPromise = refreshPromise;
    authRefreshDiscoversPath = discoverPath;
    try {
        return await refreshPromise;
    } finally {
        if (authRefreshPromise === refreshPromise) {
            authRefreshPromise = null;
            authRefreshDiscoversPath = false;
        }
    }
}

function isTransientStatus(status: number) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
}

function shouldRefreshSearchAuth(response: Response | null) {
    return (
        response !== null &&
        response.status >= 400 &&
        response.status < 500 &&
        !isTransientStatus(response.status)
    );
}

function delay(milliseconds: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function trySearchRequest(
    callback: (auth: SearchAuth) => Promise<Response>,
    auth: SearchAuth
): Promise<Response | null> {
    try {
        return await callback(auth);
    } catch (error) {
        console.warn('HLTB - search request failed:', error);
        return null;
    }
}

async function fetchWithSearchAuth(
    callback: (auth: SearchAuth) => Promise<Response>
) {
    await ensureBootstrapCacheLoaded();

    let auth = searchAuth || (await refreshSearchAuth());
    if (!auth) {
        return null;
    }

    let response = await trySearchRequest(callback, auth);
    if (response?.status === 200) {
        return response;
    }

    if (!response || isTransientStatus(response.status)) {
        await delay(TRANSIENT_RETRY_MS);
        response = await trySearchRequest(callback, auth);
        if (response?.status === 200) {
            return response;
        }
    }

    if (!shouldRefreshSearchAuth(response)) {
        return response;
    }

    await invalidateSearchAuth(auth);
    auth = searchAuth || (await refreshSearchAuth());
    if (auth) {
        response = await trySearchRequest(callback, auth);
        if (response?.status === 200) {
            return response;
        }
    }

    if (!shouldRefreshSearchAuth(response)) {
        return response;
    }

    if (auth) {
        await invalidateSearchAuth(auth);
    }
    auth = searchAuth || (await refreshSearchAuth(true));
    return auth ? await trySearchRequest(callback, auth) : null;
}

async function fetchSearchResultsWithAuth(gameName: string, auth: SearchAuth) {
    const data: Record<string, unknown> = {
        searchType: 'games',
        searchTerms: gameName.trim().split(/\s+/),
        searchPage: 1,
        size: 20,
        searchOptions: {
            games: {
                userId: 0,
                platform: '',
                sortCategory: 'name',
                rangeCategory: 'main',
                rangeTime: { min: 0, max: 0 },
                rangeYear: { min: '', max: '' },
                gameplay: {
                    perspective: '',
                    flow: '',
                    genre: '',
                    difficulty: '',
                },
                modifier: 'hide_dlc',
            },
            users: { sortCategory: 'postcount' },
            lists: { sortCategory: 'follows' },
            filter: '',
            sort: 0,
            randomizer: 0,
        },
        useCache: true,
    };

    if (auth.hpKey && auth.hpVal) {
        data[auth.hpKey] = auth.hpVal;
    }

    return fetchWithTimeout(`${HLTB_ORIGIN}${auth.searchUrl}`, {
        method: 'POST',
        headers: getSearchHeaders(auth),
        body: JSON.stringify(data),
    });
}

interface SearchResponseResult {
    results: SearchResults | null;
    shouldRediscover: boolean;
}

async function parseSearchResponse(
    response: Response | null
): Promise<SearchResponseResult> {
    if (!response) {
        return { results: null, shouldRediscover: false };
    }

    if (response.status !== 200) {
        console.error('HLTB - search failed:', response.status);
        return {
            results: null,
            shouldRediscover: response.status >= 200 && response.status < 300,
        };
    }

    let rawResults: unknown;
    try {
        rawResults = await readResponseJson(response);
    } catch (error) {
        console.error('HLTB - unreadable search response:', error);
        return { results: null, shouldRediscover: true };
    }

    const results = parseSearchResults(rawResults);
    if (!results) {
        console.error('HLTB - unexpected search response:', rawResults);
        return { results: null, shouldRediscover: true };
    }
    return { results, shouldRediscover: false };
}

async function fetchSearchResults(appName: string) {
    let parsed = await parseSearchResponse(
        await fetchWithSearchAuth((auth) =>
            fetchSearchResultsWithAuth(appName, auth)
        )
    );
    if (!parsed.shouldRediscover) {
        return parsed.results;
    }

    const refreshedAuth = await refreshSearchAuth(true);
    if (!refreshedAuth) {
        return null;
    }

    parsed = await parseSearchResponse(
        await trySearchRequest(
            (auth) => fetchSearchResultsWithAuth(appName, auth),
            refreshedAuth
        )
    );
    return parsed.results;
}

async function fetchEnglishSteamAppName(appId: number): Promise<string | null> {
    try {
        const response = await fetchWithTimeout(
            `https://store.steampowered.com/api/appdetails?appids=${appId}&l=en`,
            {
                method: 'GET',
                headers: { 'User-Agent': USER_AGENT },
            },
            STEAM_TITLE_TIMEOUT_MS
        );
        if (response.status !== 200) {
            console.warn(
                'HLTB - English Steam title lookup failed:',
                response.status
            );
            return null;
        }

        const data = await readResponseJson(response);
        if (!data || typeof data !== 'object') {
            return null;
        }

        const appData = (data as Record<string, unknown>)[String(appId)];
        if (!appData || typeof appData !== 'object') {
            return null;
        }

        const details = appData as Record<string, unknown>;
        const name = (details.data as Record<string, unknown> | undefined)
            ?.name;
        return details.success === true && typeof name === 'string'
            ? normalize(name)
            : null;
    } catch (error) {
        console.warn('HLTB - English Steam title lookup failed:', error);
        return null;
    }
}

async function fetchMostCompatibleGameData(
    appName: string,
    appId?: number,
    hltbGameId?: number
) {
    const results = await fetchSearchResults(appName);
    if (!results) {
        return null;
    }

    const reliableMatch = selectReliableGame(
        results,
        appName,
        appId,
        hltbGameId
    );
    if (reliableMatch) {
        return reliableMatch;
    }

    if (typeof appId === 'number') {
        const englishAppName = await fetchEnglishSteamAppName(appId);
        if (englishAppName && englishAppName !== normalize(appName)) {
            const englishResults = await fetchSearchResults(englishAppName);
            if (englishResults) {
                const englishMatch = selectMostCompatibleGame(
                    englishResults,
                    englishAppName,
                    appId,
                    hltbGameId
                );
                if (englishMatch) {
                    return englishMatch;
                }
            }
        }
    }

    return selectMostCompatibleGame(results, appName, appId, hltbGameId);
}

function formatHours(seconds: number) {
    return seconds > 0 ? (seconds / 60 / 60).toFixed(1) : '--';
}

async function loadHltbGameStats(
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
        if (!gameData) {
            return null;
        }

        return {
            mainStat: formatHours(gameData.comp_main),
            mainPlusStat: formatHours(gameData.comp_plus),
            completeStat: formatHours(gameData.comp_100),
            allStylesStat: formatHours(gameData.comp_all),
            gameId: gameData.game_id,
            lastUpdatedAt: new Date(),
        };
    } catch (error) {
        console.error('HLTB', error);
        return null;
    }
}

export function fetchHltbGameStats(
    appName: string,
    appId?: number,
    hltbGameId?: number
): Promise<HLTBGameStats | null> {
    const requestKey = JSON.stringify([
        normalize(appName),
        appId ?? null,
        hltbGameId ?? null,
    ]);
    const pendingRequest = gameStatsRequests.get(requestKey);
    if (pendingRequest) {
        return pendingRequest;
    }

    const request = loadHltbGameStats(appName, appId, hltbGameId).finally(
        () => {
            if (gameStatsRequests.get(requestKey) === request) {
                gameStatsRequests.delete(requestKey);
            }
        }
    );
    gameStatsRequests.set(requestKey, request);
    return request;
}
