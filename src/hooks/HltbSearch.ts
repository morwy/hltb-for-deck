import { get } from 'fast-levenshtein';
import { normalize } from '../utils';
import { GameData, SearchResults } from './GameInfoData';

const SEARCH_PAYLOAD_MARKERS = ['searchTerms', 'searchOptions'];

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function toNumber(value: unknown): number | null {
    if (isNumber(value)) {
        return value;
    }
    if (typeof value !== 'string' || value.trim() === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseGameData(value: unknown): GameData | null {
    if (!isRecord(value)) {
        return null;
    }

    const gameId = toNumber(value.game_id);
    if (
        gameId === null ||
        !Number.isSafeInteger(gameId) ||
        gameId <= 0 ||
        typeof value.game_name !== 'string' ||
        value.game_name.trim() === ''
    ) {
        return null;
    }

    const compMain = toNumber(value.comp_main);
    const compPlus = toNumber(value.comp_plus);
    const comp100 = toNumber(value.comp_100);
    const compAll = toNumber(value.comp_all);
    if (
        compMain === null &&
        compPlus === null &&
        comp100 === null &&
        compAll === null
    ) {
        return null;
    }

    const gameName = normalize(value.game_name);
    if (!gameName) {
        return null;
    }

    const profileSteam = toNumber(value.profile_steam);
    return {
        game_id: gameId,
        game_name: gameName,
        comp_main: compMain ?? 0,
        comp_plus: compPlus ?? 0,
        comp_100: comp100 ?? 0,
        comp_all: compAll ?? 0,
        comp_all_count: toNumber(value.comp_all_count) ?? 0,
        ...(profileSteam !== null &&
        Number.isSafeInteger(profileSteam) &&
        profileSteam > 0
            ? { profile_steam: profileSteam }
            : {}),
    };
}

export function parseSearchResults(value: unknown): SearchResults | null {
    if (!isRecord(value) || !Array.isArray(value.data)) {
        return null;
    }

    const data: GameData[] = [];
    for (const item of value.data) {
        const gameData = parseGameData(item);
        if (gameData) {
            data.push(gameData);
        }
    }

    return { data };
}

export function selectReliableGame(
    results: SearchResults,
    appName: string,
    appId?: number,
    hltbGameId?: number
): GameData | null {
    const normalizedAppName = normalize(appName);
    const cachedMatch =
        typeof hltbGameId === 'number'
            ? results.data.find((item) => item.game_id === hltbGameId) ?? null
            : null;

    if (typeof appId === 'number') {
        const steamMatch = results.data.find(
            (item) => item.profile_steam === appId
        );
        if (steamMatch) {
            return steamMatch;
        }
    }

    if (cachedMatch?.game_name === normalizedAppName) {
        return cachedMatch;
    }

    const exactMatch =
        results.data.find((item) => item.game_name === normalizedAppName) ??
        null;
    return exactMatch;
}

export function selectMostCompatibleGame(
    results: SearchResults,
    appName: string,
    appId?: number,
    hltbGameId?: number
): GameData | null {
    const reliableMatch = selectReliableGame(
        results,
        appName,
        appId,
        hltbGameId
    );
    if (reliableMatch) {
        return reliableMatch;
    }

    const normalizedAppName = normalize(appName);
    if (!normalizedAppName) {
        return null;
    }
    const closest = results.data
        .map((item) => ({
            distance: get(normalizedAppName, item.game_name, {
                useCollator: true,
            }),
            wasCached: item.game_id === hltbGameId,
            item,
        }))
        .sort((left, right) => {
            if (left.distance === right.distance) {
                if (left.wasCached !== right.wasCached) {
                    return left.wasCached ? -1 : 1;
                }
                return right.item.comp_all_count - left.item.comp_all_count;
            }
            return left.distance - right.distance;
        })[0];

    if (!closest) {
        return null;
    }

    const candidateName = closest.item.game_name;
    const longestNameLength = Math.max(
        normalizedAppName.length,
        candidateName.length
    );
    const relatedByName =
        normalizedAppName.includes(candidateName) ||
        candidateName.includes(normalizedAppName);
    const normalizedDistance =
        longestNameLength === 0 ? 1 : closest.distance / longestNameLength;

    return relatedByName || normalizedDistance <= 0.35 ? closest.item : null;
}

export function extractSearchUrlFromScript(sourceText: string): string | null {
    const scriptText = sourceText.replace(/\\\//g, '/');
    const hasSearchPayload = SEARCH_PAYLOAD_MARKERS.every((marker) =>
        scriptText.includes(marker)
    );

    const initCandidates: string[] = [];
    const postCandidates: string[] = [];
    const fetchCandidates: string[] = [];
    const addCandidate = (
        candidates: string[],
        candidate: string | undefined
    ) => {
        if (!candidate) {
            return;
        }

        const normalized = candidate
            .replace(/[?#].*$/, '')
            .replace(/\/+$/, '')
            .replace(/\/init$/i, '');
        if (
            /^\/api\/[a-zA-Z0-9_/-]+$/.test(normalized) &&
            !normalized.endsWith('/error') &&
            !candidates.includes(normalized)
        ) {
            candidates.push(normalized);
        }
    };

    const initPattern =
        /["'`](?:https?:\/\/(?:www\.)?howlongtobeat\.com)?(\/api\/[a-zA-Z0-9_/-]+)\/init(?:\?[^"'`]*)?["'`]/gi;
    let match: RegExpExecArray | null;
    while ((match = initPattern.exec(scriptText)) !== null) {
        addCandidate(initCandidates, match[1]);
    }

    const postPattern =
        /fetch\s*\(\s*["'`](?:https?:\/\/(?:www\.)?howlongtobeat\.com)?(\/api\/[a-zA-Z0-9_/-]+)(?:\?[^"'`]*)?["'`]\s*,\s*\{[\s\S]{0,2000}?method\s*:\s*["'`]POST["'`]/gi;
    while ((match = postPattern.exec(scriptText)) !== null) {
        addCandidate(postCandidates, match[1]);
    }

    const fetchPattern =
        /fetch\s*\(\s*["'`](?:https?:\/\/(?:www\.)?howlongtobeat\.com)?(\/api\/[a-zA-Z0-9_/-]+)(?:\?[^"'`]*)?["'`]/gi;
    while ((match = fetchPattern.exec(scriptText)) !== null) {
        addCandidate(fetchCandidates, match[1]);
    }

    return (
        postCandidates.find((candidate) =>
            initCandidates.includes(candidate)
        ) ??
        (hasSearchPayload ? postCandidates[0] : undefined) ??
        (hasSearchPayload ? initCandidates[0] : undefined) ??
        (hasSearchPayload
            ? fetchCandidates.find((candidate) =>
                  candidate.includes('/search/')
              ) ?? fetchCandidates[0]
            : undefined) ??
        null
    );
}
