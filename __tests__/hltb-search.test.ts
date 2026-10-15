import { GameData, SearchResults } from '../src/hooks/GameInfoData';
import {
    extractSearchUrlFromScript,
    parseSearchResults,
    selectMostCompatibleGame,
    selectReliableGame,
} from '../src/hooks/HltbSearch';

function game(overrides: Partial<GameData>): GameData {
    return {
        game_id: 1,
        game_name: 'portal',
        comp_main: 3600,
        comp_plus: 7200,
        comp_100: 10800,
        comp_all: 7200,
        comp_all_count: 10,
        ...overrides,
    };
}

describe('HLTB search compatibility', () => {
    test('discovers a nested endpoint from the current init flow', () => {
        const script = [
            'const body={searchTerms:[],searchOptions:{}};',
            'const headers={"x-auth-token":token};',
            'fetch(`/api/search/site/init?t=${Date.now()}`);',
            'fetch("/api/search/site",{method:"POST",headers,body});',
        ].join('');

        expect(extractSearchUrlFromScript(script)).toBe('/api/search/site');
    });

    test('accepts endpoint rotations without depending on the old name', () => {
        const script =
            'searchTerms;searchOptions;x-auth-token;fetch("/api/find/v2/init");fetch("/api/find/v2",{method:"POST"})';

        expect(extractSearchUrlFromScript(script)).toBe('/api/find/v2');
    });

    test('discovers paired absolute endpoints when auth markers move', () => {
        const script =
            'fetch("https://howlongtobeat.com/api/finder/v3/init");fetch("https://howlongtobeat.com/api/finder/v3",{method:"POST"})';

        expect(extractSearchUrlFromScript(script)).toBe('/api/finder/v3');
        expect(
            extractSearchUrlFromScript(
                'fetch("/api/telemetry",{method:"POST"})'
            )
        ).toBeNull();
    });

    test('validates and normalizes the search data used by the plugin', () => {
        expect(
            parseSearchResults({
                data: [
                    game({
                        game_id: 7231,
                        game_name: 'Portal 2™',
                        profile_steam: 620,
                    }),
                ],
            })
        ).toEqual({
            data: [
                game({
                    game_id: 7231,
                    game_name: 'portal 2',
                    profile_steam: 620,
                }),
            ],
        });

        expect(
            parseSearchResults({
                data: [
                    { game_id: 1 },
                    game({ game_id: 0 }),
                    game({ game_id: -1 }),
                    game({
                        game_id: '7231' as unknown as number,
                        game_name: 'Portal 2™',
                        comp_main: '3600' as unknown as number,
                        profile_steam: -620,
                    }),
                ],
            })
        ).toEqual({
            data: [
                game({
                    game_id: 7231,
                    game_name: 'portal 2',
                    profile_steam: undefined,
                }),
            ],
        });
    });

    test('prefers Steam id and exact titles over a stale cached id', () => {
        const results: SearchResults = {
            data: [
                game({ game_id: 10, game_name: 'portal stories mel' }),
                game({
                    game_id: 20,
                    game_name: 'portal 2',
                    profile_steam: 620,
                }),
                game({ game_id: 30, game_name: 'portal 2' }),
            ],
        };

        expect(
            selectMostCompatibleGame(results, 'portal 2', 620, 30)?.game_id
        ).toBe(20);
        expect(
            selectMostCompatibleGame(results, 'portal 2', 620)?.game_id
        ).toBe(20);
        expect(selectMostCompatibleGame(results, 'portal 2')?.game_id).toBe(20);
        expect(
            selectMostCompatibleGame(results, 'portal 2', undefined, 30)
                ?.game_id
        ).toBe(30);
        expect(
            selectMostCompatibleGame(
                {
                    data: [
                        game({ game_id: 40, game_name: 'portal 2' }),
                        game({ game_id: 50, game_name: 'portal stories mel' }),
                    ],
                },
                'portal 2',
                undefined,
                50
            )?.game_id
        ).toBe(40);
        expect(
            selectMostCompatibleGame(results, 'portal stories: mel')?.game_id
        ).toBe(10);
        expect(selectReliableGame(results, 'completely different')).toBeNull();
        expect(
            selectMostCompatibleGame(results, 'completely different')
        ).toBeNull();
    });
});
