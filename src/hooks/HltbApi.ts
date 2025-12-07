import { fetchNoCors } from '@decky/api';
import { get } from 'fast-levenshtein';
import { normalize } from '../utils';
import {
    GameData,
    GamePageData,
    HLTBGameStats,
    SearchResults,
} from './GameInfoData';

// NOTE: Close reproduction of https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI/pull/53
const AuthToken = Symbol('Auth Token');
let searchUrl: string = '';

async function fetchAuthToken(): Promise<string | null> {
    try {
        const timestamp = Date.now();
        const url = `https://howlongtobeat.com/api/search/init?t=${timestamp}`;
        const response = await fetchNoCors(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'https://howlongtobeat.com',
                Referer: 'https://howlongtobeat.com/',
                'User-Agent':
                    'Chrome: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
            },
        });

        if (response.status === 200) {
            const data = await response.json();
            const token = data?.token;
            if (token) {
                console.log('HLTB Auth Token acquired');
                return token;
            }
            console.error('HLTB - no token in response:', data);
        } else {
            console.error('HLTB - failed to get auth token:', response.status);
        }
    } catch (error) {
        console.error('HLTB - error fetching auth token:', error);
    }

    return null;
}

async function fetchSearchUrl(): Promise<string | null> {
    try {
        const url = 'https://howlongtobeat.com';
        const response = await fetchNoCors(url);

        if (response.status === 200) {
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const scripts = doc.querySelectorAll('script');

            for (const script of scripts) {
                if (script.src.includes('_app-')) {
                    const scriptUrl = url + new URL(script.src).pathname;
                    const scriptResponse = await fetchNoCors(scriptUrl);

                    if (scriptResponse.status === 200) {
                        const scriptText = await scriptResponse.text();
                        // Find the path suffix after /api/ (e.g., "search" or "find/v2")
                        const pattern =
                            /fetch\s*\(\s*["']\/api\/([a-zA-Z0-9_\/]+)[^"']*["']\s*,\s*{[^}]*method:\s*["']POST["'][^}]*}/gi;
                        const matches = pattern.exec(scriptText);

                        if (matches && matches[1]) {
                            const pathSuffix = matches[1];
                            // Determine the root path (e.g., "search" from "search/v2")
                            // This ensures we get the base endpoint name even if sub-paths are used.
                            const basePath = pathSuffix.includes('/')
                                ? pathSuffix.split('/')[0]
                                : pathSuffix;
                            if (basePath !== 'find') {
                                searchUrl = `/api/${basePath}`;
                                console.log('HLTB Search URL:', searchUrl);
                                return searchUrl;
                            }
                        }
                    }
                }
            }

            console.error('HLTB - failed to find search URL!');
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
        const response = await fetchNoCors(url);

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
>([
    [AuthToken, { key: null, keyFetch: fetchAuthToken }],
    [NextJsKey, { key: null, keyFetch: fetchNextJsKey }],
]);
async function fetchWithKey(
    keyName: symbol,
    callback: (key: string) => Promise<Response>
) {
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

    const results = await callback(cache.key);
    if (results.status === 200) {
        return results;
    }

    // Key might have expired, fetch a new one and try again
    cache.key = await cache.keyFetch();
    if (cache.key === null) {
        // error already logged
        return null;
    }

    // Whatever the response is, we propagate it to be logged
    return await callback(cache.key);
}

async function fetchSearchResultsWithAuthToken(
    gameName: string,
    authToken: string
) {
    if (searchUrl === '') {
        searchUrl = (await fetchSearchUrl()) || '/api/search';
    }
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
    };

    return fetchNoCors(`https://howlongtobeat.com${searchUrl}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Origin: 'https://howlongtobeat.com',
            Referer: 'https://howlongtobeat.com/',
            Authority: 'howlongtobeat.com',
            'x-auth-token': authToken,
            'User-Agent':
                'Chrome: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
        },
        body: JSON.stringify(data),
    });
}

async function fetchSearchResults(appName: string) {
    const response = await fetchWithKey(AuthToken, (token) =>
        fetchSearchResultsWithAuthToken(appName, token)
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
