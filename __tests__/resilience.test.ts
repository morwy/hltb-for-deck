import {
    getCachedStatsForGame,
    normalizeHltbStats,
    preserveStatsVisibility,
} from '../src/hooks/GameInfoData';
import { resolveLanguage } from '../src/hooks/useLocalization';

describe('resilience helpers', () => {
    test('normalizes serialized cache dates and expires invalid dates', () => {
        const cached = {
            mainStat: '1.0',
            mainPlusStat: '2.0',
            completeStat: '3.0',
            allStylesStat: '2.0',
            lastUpdatedAt: '2026-10-15T10:00:00.000Z',
            showStats: false,
            gameId: 123,
            sourceName: 'portal 2',
            version: 1,
        };

        expect(normalizeHltbStats(cached)?.lastUpdatedAt).toEqual(
            new Date('2026-10-15T10:00:00.000Z')
        );
        expect(
            normalizeHltbStats({ ...cached, lastUpdatedAt: 'invalid' })
                ?.lastUpdatedAt
        ).toEqual(new Date(0));
        expect(normalizeHltbStats(cached)?.sourceName).toBe('portal 2');
        expect(
            normalizeHltbStats({ ...cached, gameId: -123 })?.gameId
        ).toBeUndefined();
    });

    test('falls back safely and recognizes Steam locale variants', () => {
        expect(resolveLanguage(undefined)).toBe('en');
        expect(resolveLanguage('pt-BR')).toBe('ptBr');
        expect(resolveLanguage('zh_CN')).toBe('zhCn');
        expect(resolveLanguage('unknown')).toBe('en');
    });

    test('preserves the latest visibility when network stats arrive', () => {
        const replacement = {
            mainStat: '4.0',
            mainPlusStat: '6.0',
            completeStat: '9.0',
            allStylesStat: '6.0',
            lastUpdatedAt: new Date(),
            showStats: true,
            gameId: 321,
            version: 2,
        };

        expect(
            preserveStatsVisibility(
                { ...replacement, showStats: false },
                replacement
            ).showStats
        ).toBe(false);
    });

    test('does not show cached stats from an old non-Steam shortcut name', () => {
        const cached = {
            mainStat: '4.0',
            mainPlusStat: '6.0',
            completeStat: '9.0',
            allStylesStat: '6.0',
            lastUpdatedAt: new Date(),
            showStats: false,
            sourceName: 'old shortcut name',
            gameId: 321,
            version: 3,
        };

        expect(
            getCachedStatsForGame(cached, 'Renamed Shortcut', false)
        ).toBeNull();
        expect(
            getCachedStatsForGame(cached, 'Old Shortcut Name', false)
        ).toMatchObject({ gameId: 321, showStats: false });
    });
});
