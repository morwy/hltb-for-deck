import { useState, useEffect } from 'react';
import {
    getCachedStatsForGame,
    HLTBStats,
    normalizeHltbStats,
} from './GameInfoData';
import { getCache, subscribeCache, updateGameStatsCache } from './Cache';
import { fetchHltbGameStats } from './HltbApi';
import { normalize } from '../utils';

// Increment when cached stats become incompatible.
const statsVersion = 3;
const createEmptyStats = (): HLTBStats => ({
    mainStat: '--',
    mainPlusStat: '--',
    completeStat: '--',
    allStylesStat: '--',
    gameId: undefined,
    lastUpdatedAt: new Date(),
    showStats: true,
    version: statsVersion,
});

function hasVersionChanged(cache: HLTBStats) {
    return cache.version !== statsVersion;
}

function getCachedGameId(cache: HLTBStats | null) {
    return !cache || hasVersionChanged(cache) ? undefined : cache?.gameId;
}

function needCacheUpdate(
    cache: HLTBStats,
    appName: string,
    isSteamGame: boolean
) {
    const now = new Date();
    const durationMs = Math.abs(cache.lastUpdatedAt.getTime() - now.getTime());

    const hoursBetweenDates = durationMs / (60 * 60 * 1000);
    return (
        hoursBetweenDates > 12 ||
        hasVersionChanged(cache) ||
        (!isSteamGame && cache.sourceName !== normalize(appName))
    );
}

function useHltb(appId: number, appName: string, isSteamGame: boolean) {
    const [stats, setStats] = useState<HLTBStats>(createEmptyStats);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        let cacheReadRevision = 0;
        const cacheKey = `${appId}`;
        const normalizedAppName = normalize(appName);
        setLoading(true);

        const showCachedData = async () => {
            const revision = ++cacheReadRevision;
            try {
                const cachedStats = normalizeHltbStats(
                    await getCache<unknown>(cacheKey)
                );
                if (mounted && revision === cacheReadRevision) {
                    const visibleCachedStats = getCachedStatsForGame(
                        cachedStats,
                        appName,
                        isSteamGame
                    );
                    setStats(
                        visibleCachedStats
                            ? visibleCachedStats
                            : {
                                  ...createEmptyStats(),
                                  showStats: cachedStats?.showStats ?? true,
                              }
                    );
                }
                return cachedStats;
            } catch (error) {
                console.warn(
                    `HLTB - failed to read cache for ${appId}:`,
                    error
                );
                return null;
            }
        };

        const getData = async () => {
            const cache = await showCachedData();
            if (cache && !needCacheUpdate(cache, appName, isSteamGame)) {
                return;
            }

            console.log(`Getting HLTB data for ${appId} and "${appName}".`);
            const hltbGameStats = await fetchHltbGameStats(
                appName,
                isSteamGame ? appId : undefined,
                getCachedGameId(cache)
            );
            if (hltbGameStats) {
                const newStats = {
                    ...hltbGameStats,
                    showStats: cache?.showStats ?? true,
                    sourceName: normalizedAppName,
                    version: statsVersion,
                };
                let displayedStats: HLTBStats = newStats;
                try {
                    displayedStats = await updateGameStatsCache(
                        cacheKey,
                        newStats
                    );
                } catch (error) {
                    console.warn(
                        `HLTB - failed to persist stats for ${appId}:`,
                        error
                    );
                }
                if (mounted) {
                    setStats(displayedStats);
                }
                console.log(
                    `HLTB data updated for ${appId}. Using HLTB game id ${hltbGameStats.gameId}.`
                );
            }
        };

        const initialLoad = appId ? getData() : Promise.resolve();
        initialLoad.catch(console.error).finally(() => {
            if (mounted) {
                setLoading(false);
            }
        });

        const unsubscribe = subscribeCache(cacheKey, () => {
            getData().catch(console.error);
        });

        return () => {
            mounted = false;
            cacheReadRevision += 1;
            unsubscribe();
        };
    }, [appId, appName, isSteamGame]);

    return {
        ...stats,
        loading,
    };
}

export default useHltb;
