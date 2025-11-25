import { useState, useEffect } from 'react';
import { HLTBStats } from './GameInfoData';
import { getCache, updateCache } from './Cache';
import { fetchHltbGameStats } from './HltbApi';

// This number should be incremented whenever it is needed
// to forcefully invalidate cache, so that the user doesn't
// have to manually clear it.
const statsVersion = 1;
function hasVersionChanged(cache: HLTBStats) {
    return cache.version !== statsVersion;
}

function getCachedGameId(cache: HLTBStats | null) {
    return !cache || hasVersionChanged(cache) ? undefined : cache?.gameId;
}

// update cache after 12 hours or if the version number is different
function needCacheUpdate(cache: HLTBStats) {
    const now = new Date();
    const durationMs = Math.abs(cache.lastUpdatedAt.getTime() - now.getTime());

    const hoursBetweenDates = durationMs / (60 * 60 * 1000);
    return hoursBetweenDates > 12 || hasVersionChanged(cache);
}

// Hook to get data from HLTB
function useHltb(appId: number, appName: string, isSteamGame: boolean) {
    const [stats, setStats] = useState<HLTBStats>({
        mainStat: '--',
        mainPlusStat: '--',
        completeStat: '--',
        allStylesStat: '--',
        gameId: undefined,
        lastUpdatedAt: new Date(),
        showStats: true,
        version: statsVersion,
    });

    useEffect(() => {
        const getData = async () => {
            const cache = await getCache<HLTBStats>(`${appId}`);
            if (cache && !needCacheUpdate(cache)) {
                setStats(cache);
            } else {
                console.log(`Getting HLTB data for ${appId} and "${appName}".`);
                const hltbGameStats = await fetchHltbGameStats(
                    appName,
                    isSteamGame ? appId : undefined,
                    getCachedGameId(cache)
                );
                if (hltbGameStats) {
                    const newStats = {
                        ...hltbGameStats,
                        ...{
                            showStats: cache?.showStats ?? true,
                            version: statsVersion,
                        },
                    };
                    setStats(newStats);
                    updateCache(`${appId}`, newStats);
                    console.log(
                        `HLTB data updated for ${appId}. Using HLTB game id ${hltbGameStats.gameId}.`
                    );
                }
            }
        };
        if (appId) {
            getData().catch(console.error);
        }
    }, [appId]);

    return {
        ...stats,
    };
}

export default useHltb;
