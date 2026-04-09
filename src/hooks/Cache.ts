import localforage from 'localforage';
import { HLTBStyle } from './useStyle';
import { HLTBStats } from './GameInfoData';
import { StatPreferences } from './useStatPreferences';

const database = 'hltb-for-deck';
export const styleKey = 'hltb-style';
export const hideDetailsKey = 'hltb-hide-details';
export const statPreferencesKey = 'hltb-stat-preferences';
export const apiBootstrapCacheKey = 'hltb-api-bootstrap';

export interface ApiBootstrapSearchAuth {
    searchUrl: string;
    token: string;
    hpKey: string;
    hpVal: string;
}

export interface ApiBootstrapCache {
    searchUrl?: string;
    searchAuth?: ApiBootstrapSearchAuth;
    nextJsKey?: string;
}

localforage.config({
    name: database,
});

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function isApiBootstrapSearchAuth(
    value: unknown
): value is ApiBootstrapSearchAuth {
    if (!isRecord(value)) {
        return false;
    }

    return (
        typeof value.searchUrl === 'string' &&
        typeof value.token === 'string' &&
        typeof value.hpKey === 'string' &&
        typeof value.hpVal === 'string'
    );
}

function normalizeApiBootstrapCache(value: unknown): ApiBootstrapCache | null {
    if (!isRecord(value)) {
        return null;
    }

    const normalized: ApiBootstrapCache = {};

    if (typeof value.searchUrl === 'string') {
        normalized.searchUrl = value.searchUrl;
    }

    if (typeof value.nextJsKey === 'string') {
        normalized.nextJsKey = value.nextJsKey;
    }

    if (isApiBootstrapSearchAuth(value.searchAuth)) {
        normalized.searchAuth = value.searchAuth;
    }

    return normalized;
}

export async function updateCache<T>(key: string, value: T) {
    await localforage.setItem(key, value);
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

    await localforage.removeItem(apiBootstrapCacheKey);
    return null;
}

export async function updateApiBootstrapCache(
    patch: Partial<ApiBootstrapCache>
) {
    const currentCache = (await getApiBootstrapCache()) ?? {};
    const nextCache: ApiBootstrapCache = {
        ...currentCache,
        ...patch,
    };

    await localforage.setItem(apiBootstrapCacheKey, nextCache);
}

export async function clearApiBootstrapCache(
    ...fields: Array<'searchUrl' | 'searchAuth' | 'nextJsKey'>
) {
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
}

export async function setShowHide(appId: string) {
    const stats = await localforage.getItem<HLTBStats>(appId);
    if (stats) {
        stats.showStats = !stats.showStats;
        await localforage.setItem(appId, stats);
    }
}

export async function getStyle(): Promise<HLTBStyle> {
    const hltbStyle = await localforage.getItem<HLTBStyle>(styleKey);
    return hltbStyle === null ? 'default' : hltbStyle;
}

export async function getPreference(): Promise<boolean> {
    const hideViewDetails = await localforage.getItem<boolean>(hideDetailsKey);
    return hideViewDetails === null ? false : hideViewDetails;
}

export async function getStatPreferences(): Promise<StatPreferences | null> {
    const preferences = await localforage.getItem<StatPreferences>(
        statPreferencesKey
    );
    return preferences;
}

export const clearCache = () => {
    const style = getStyle();
    localforage.clear();
    updateCache(styleKey, style);
};
