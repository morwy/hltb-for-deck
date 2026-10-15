import localforage from 'localforage';
import { Appearance, normalizeAppearance } from '../appearance';
import { HLTBStyle } from './useStyle';
import {
    HLTBStats,
    normalizeHltbStats,
    preserveStatsVisibility,
} from './GameInfoData';
import { StatPreferences } from './useStatPreferences';

const database = 'hltb-for-deck';
const CACHE_CLEAR_BATCH_SIZE = 16;
export const styleKey = 'hltb-style';
export const hideDetailsKey = 'hltb-hide-details';
export const statPreferencesKey = 'hltb-stat-preferences';
export const appearanceKey = 'hltb-appearance';
export const apiBootstrapCacheKey = 'hltb-api-bootstrap';

export interface ApiBootstrapSearchAuth {
    searchUrl: string;
    token: string;
    hpKey?: string;
    hpVal?: string;
}

export interface ApiBootstrapCache {
    searchUrl?: string;
    searchAuth?: ApiBootstrapSearchAuth;
}

localforage.config({
    name: database,
});

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function isSearchUrl(value: unknown): value is string {
    return typeof value === 'string' && /^\/api\/[a-zA-Z0-9_/-]+$/.test(value);
}

function isApiBootstrapSearchAuth(
    value: unknown
): value is ApiBootstrapSearchAuth {
    if (!isRecord(value)) {
        return false;
    }

    return (
        isSearchUrl(value.searchUrl) &&
        typeof value.token === 'string' &&
        value.token.trim().length > 0
    );
}

function normalizeApiBootstrapCache(value: unknown): ApiBootstrapCache | null {
    if (!isRecord(value)) {
        return null;
    }

    const normalized: ApiBootstrapCache = {};

    if (isSearchUrl(value.searchUrl)) {
        normalized.searchUrl = value.searchUrl;
    }

    if (isApiBootstrapSearchAuth(value.searchAuth)) {
        normalized.searchAuth = {
            searchUrl: value.searchAuth.searchUrl,
            token: value.searchAuth.token.trim(),
        };

        const hpKey = value.searchAuth.hpKey?.trim();
        const hpVal = value.searchAuth.hpVal?.trim();
        if (hpKey && hpVal) {
            normalized.searchAuth.hpKey = hpKey;
            normalized.searchAuth.hpVal = hpVal;
        }
    }

    return normalized;
}

const cacheListeners = new Map<string, Set<() => void>>();
const cacheMutationQueues = new Map<string, Promise<void>>();
let cacheClearBarrier = Promise.resolve();
let apiBootstrapMutationQueue = Promise.resolve();

function queueCacheMutation<T>(
    key: string,
    operation: () => Promise<T>
): Promise<T> {
    const previous = cacheMutationQueues.get(key) ?? Promise.resolve();
    const clearBarrier = cacheClearBarrier;
    const result = Promise.all([previous, clearBarrier]).then(operation);
    const settled = result.then(
        () => undefined,
        () => undefined
    );
    cacheMutationQueues.set(key, settled);
    void settled.then(() => {
        if (cacheMutationQueues.get(key) === settled) {
            cacheMutationQueues.delete(key);
        }
    });
    return result;
}

function queueApiBootstrapMutation(operation: () => Promise<void>) {
    const result = apiBootstrapMutationQueue.then(operation, operation);
    apiBootstrapMutationQueue = result.catch(() => undefined);
    return result;
}

export function subscribeCache(key: string, listener: () => void): () => void {
    const forKey = cacheListeners.get(key) ?? new Set();
    forKey.add(listener);
    cacheListeners.set(key, forKey);
    return () => {
        forKey.delete(listener);
        if (forKey.size === 0) {
            cacheListeners.delete(key);
        }
    };
}

function notifyCacheListeners(key: string) {
    const forKey = cacheListeners.get(key);
    if (forKey) {
        for (const listener of [...forKey]) {
            try {
                listener();
            } catch (error) {
                console.warn(`HLTB - cache listener for ${key} failed:`, error);
            }
        }
    }
}

export async function updateCache<T>(key: string, value: T): Promise<T> {
    return queueCacheMutation(key, async () => {
        await localforage.setItem(key, value);
        notifyCacheListeners(key);
        return value;
    });
}

async function mutateCache<T>(
    key: string,
    updater: (currentValue: unknown) => T | null
): Promise<T | null> {
    return queueCacheMutation(key, async () => {
        const nextValue = updater(await localforage.getItem<unknown>(key));
        if (nextValue === null) {
            return null;
        }
        await localforage.setItem(key, nextValue);
        notifyCacheListeners(key);
        return nextValue;
    });
}

export async function getCache<T>(key: string): Promise<T | null> {
    return await localforage.getItem<T>(key);
}

export async function getApiBootstrapCache(): Promise<ApiBootstrapCache | null> {
    const cache = await localforage.getItem<unknown>(apiBootstrapCacheKey);
    if (cache === null) {
        return null;
    }

    const normalized = normalizeApiBootstrapCache(cache);
    if (normalized !== null) {
        return normalized;
    }

    return null;
}

export async function updateApiBootstrapCache(
    patch: Partial<ApiBootstrapCache>
) {
    await queueApiBootstrapMutation(async () => {
        const currentCache = (await getApiBootstrapCache()) ?? {};
        const nextCache: ApiBootstrapCache = {
            ...currentCache,
            ...patch,
        };

        await localforage.setItem(apiBootstrapCacheKey, nextCache);
    });
}

export async function clearApiBootstrapCache(
    ...fields: Array<'searchUrl' | 'searchAuth'>
) {
    await queueApiBootstrapMutation(async () => {
        if (fields.length === 0) {
            await localforage.removeItem(apiBootstrapCacheKey);
            return;
        }

        const currentCache = await getApiBootstrapCache();
        if (currentCache === null) {
            return;
        }

        const nextCache: ApiBootstrapCache = { ...currentCache };

        for (const field of fields) {
            delete nextCache[field];
        }

        await localforage.setItem(apiBootstrapCacheKey, nextCache);
    });
}

export async function setShowHide(appId: string) {
    return mutateCache<HLTBStats>(appId, (currentValue) => {
        const stats = normalizeHltbStats(currentValue);
        return stats
            ? {
                  ...stats,
                  showStats: !stats.showStats,
              }
            : {
                  mainStat: '--',
                  mainPlusStat: '--',
                  completeStat: '--',
                  allStylesStat: '--',
                  lastUpdatedAt: new Date(0),
                  showStats: false,
              };
    });
}

export async function updateGameStatsCache(
    appId: string,
    replacement: HLTBStats
): Promise<HLTBStats> {
    const updated = await mutateCache<HLTBStats>(appId, (currentValue) =>
        preserveStatsVisibility(currentValue, replacement)
    );
    return updated ?? replacement;
}

export async function getStyle(): Promise<HLTBStyle> {
    const hltbStyle = await localforage.getItem<unknown>(styleKey);
    if (
        hltbStyle === 'default' ||
        hltbStyle === 'clean' ||
        hltbStyle === 'clean-left' ||
        hltbStyle === 'clean-default'
    ) {
        return hltbStyle;
    }

    return 'default';
}

export async function getAppearance(): Promise<Appearance> {
    const appearance = await localforage.getItem<unknown>(appearanceKey);
    return normalizeAppearance(appearance);
}

export async function getPreference(): Promise<boolean> {
    return (await localforage.getItem<unknown>(hideDetailsKey)) === true;
}

export async function getStatPreferences(): Promise<StatPreferences | null> {
    const preferences = await localforage.getItem<unknown>(statPreferencesKey);
    if (!isRecord(preferences)) {
        return null;
    }

    return {
        showMain:
            typeof preferences.showMain === 'boolean'
                ? preferences.showMain
                : true,
        showMainPlus:
            typeof preferences.showMainPlus === 'boolean'
                ? preferences.showMainPlus
                : true,
        showComplete:
            typeof preferences.showComplete === 'boolean'
                ? preferences.showComplete
                : true,
        showAllStyles:
            typeof preferences.showAllStyles === 'boolean'
                ? preferences.showAllStyles
                : true,
    };
}

const PREFERENCE_KEYS = [
    styleKey,
    hideDetailsKey,
    statPreferencesKey,
    appearanceKey,
];

export async function clearCache(): Promise<void> {
    const pendingMutations = [...cacheMutationQueues.values()];
    const previousClear = cacheClearBarrier;
    const clearOperation = previousClear.then(async () => {
        await Promise.all(pendingMutations);
        const keys = await localforage.keys();
        const removableKeys = keys.filter(
            (key) =>
                key !== apiBootstrapCacheKey && !PREFERENCE_KEYS.includes(key)
        );
        for (
            let index = 0;
            index < removableKeys.length;
            index += CACHE_CLEAR_BATCH_SIZE
        ) {
            await Promise.all(
                removableKeys
                    .slice(index, index + CACHE_CLEAR_BATCH_SIZE)
                    .map(async (key) => {
                        const cachedStats = normalizeHltbStats(
                            await localforage.getItem<unknown>(key)
                        );
                        if (cachedStats) {
                            await localforage.setItem<HLTBStats>(key, {
                                mainStat: '--',
                                mainPlusStat: '--',
                                completeStat: '--',
                                allStylesStat: '--',
                                lastUpdatedAt: new Date(0),
                                showStats: cachedStats.showStats,
                            });
                        } else {
                            await localforage.removeItem(key);
                        }
                        notifyCacheListeners(key);
                    })
            );
        }
    });
    cacheClearBarrier = clearOperation.catch(() => undefined);
    return clearOperation;
}
