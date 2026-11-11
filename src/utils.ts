export const normalize = (str: string) => {
    return str
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, ' ') // replacing any special char with a space
        .replace(/\s\s+/g, ' ') // replacing multiple whitespaces by a single space for consistency
        .trim();
};

export const EMPTY_STAT = '--';

// True if HLTB returned at least one of the four times.
export const hasAnyStat = (stats: {
    mainStat: string;
    mainPlusStat: string;
    completeStat: string;
    allStylesStat: string;
}) =>
    [
        stats.mainStat,
        stats.mainPlusStat,
        stats.completeStat,
        stats.allStylesStat,
    ].some((stat) => stat !== EMPTY_STAT);

// Matches the app types the library page shows stats for.
export const isSteamGameType = (appType: number) => {
    switch (appType) {
        case 1: // Game
        case 8: // Demo
            return true;
    }
    return false;
};

// Only game pages on the Steam store, e.g.
// https://store.steampowered.com/app/673750/Super_Bunny_Man/
export const parseStoreAppId = (url: string): number | null => {
    const match =
        /^https:\/\/store\.steampowered\.com\/app\/(\d+)(?:[/?#]|$)/.exec(url);
    if (!match) {
        return null;
    }

    const appId = Number(match[1]);
    return Number.isSafeInteger(appId) && appId > 0 ? appId : null;
};
