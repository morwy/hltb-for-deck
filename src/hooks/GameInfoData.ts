import { normalize } from '../utils';

export interface SearchResults {
    data: GameData[];
}

export interface GameData {
    game_name: string;
    comp_main: number;
    comp_plus: number;
    comp_100: number;
    comp_all: number;
    comp_all_count: number;
    game_id: number;
    profile_steam?: number;
}

export interface HLTBGameStats {
    mainStat: string;
    mainPlusStat: string;
    completeStat: string;
    allStylesStat: string;
    lastUpdatedAt: Date;
    gameId: number;
}

export interface HLTBStats extends Omit<HLTBGameStats, 'gameId'> {
    gameId?: number;
    showStats: boolean;
    sourceName?: string;
    version?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function parseDate(value: unknown): Date | null {
    const date =
        value instanceof Date
            ? new Date(value.getTime())
            : typeof value === 'string' || typeof value === 'number'
            ? new Date(value)
            : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
}

export function normalizeHltbStats(value: unknown): HLTBStats | null {
    if (
        !isRecord(value) ||
        typeof value.mainStat !== 'string' ||
        typeof value.mainPlusStat !== 'string' ||
        typeof value.completeStat !== 'string' ||
        typeof value.allStylesStat !== 'string'
    ) {
        return null;
    }

    const gameId =
        typeof value.gameId === 'number' &&
        Number.isSafeInteger(value.gameId) &&
        value.gameId > 0
            ? value.gameId
            : undefined;
    const version =
        typeof value.version === 'number' && Number.isFinite(value.version)
            ? value.version
            : undefined;
    const sourceName =
        typeof value.sourceName === 'string' && value.sourceName
            ? value.sourceName
            : undefined;

    return {
        mainStat: value.mainStat,
        mainPlusStat: value.mainPlusStat,
        completeStat: value.completeStat,
        allStylesStat: value.allStylesStat,
        lastUpdatedAt: parseDate(value.lastUpdatedAt) ?? new Date(0),
        showStats:
            typeof value.showStats === 'boolean' ? value.showStats : true,
        ...(gameId !== undefined ? { gameId } : {}),
        ...(sourceName !== undefined ? { sourceName } : {}),
        ...(version !== undefined ? { version } : {}),
    };
}

export function preserveStatsVisibility(
    currentValue: unknown,
    replacement: HLTBStats
): HLTBStats {
    const current = normalizeHltbStats(currentValue);
    return {
        ...replacement,
        showStats: current?.showStats ?? replacement.showStats,
    };
}

export function getCachedStatsForGame(
    value: unknown,
    appName: string,
    isSteamGame: boolean
): HLTBStats | null {
    const stats = normalizeHltbStats(value);
    if (!stats || (!isSteamGame && stats.sourceName !== normalize(appName))) {
        return null;
    }
    return stats;
}
