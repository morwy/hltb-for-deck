import { DOMParser } from 'linkedom';

// Replace Decky's transport with real HTTP; no HLTB responses are mocked.
jest.mock('@decky/api', () => {
    let requests = 0;
    const deadline = AbortSignal.timeout(45_000);

    return {
        fetchNoCors: async (url: string, init: RequestInit = {}) => {
            if (++requests > 8) {
                throw new Error('HLTB check exceeded its eight-request limit');
            }

            const headers = new Headers(init.headers);
            // Decky's proxy supplies its own user agent when none is specified.
            if (!headers.has('User-Agent')) {
                headers.set('User-Agent', 'Decky/CI (https://decky.xyz)');
            }

            const response = await fetch(url, {
                ...init,
                headers,
                signal: deadline,
            });
            console.log(
                `${init.method ?? 'GET'} ${new URL(url).pathname}: ${
                    response.status
                }`
            );
            return response;
        },
    };
});

// Start with empty storage, keeping the plugin's cache code in the lookup.
jest.mock('localforage', () => {
    const items = new Map<string, unknown>();
    return {
        config: () => {},
        getItem: async (key: string) => items.get(key) ?? null,
        setItem: async (key: string, value: unknown) => {
            items.set(key, value);
            return value;
        },
        removeItem: async (key: string) => {
            items.delete(key);
        },
    };
});

import { fetchHltbGameStats } from '../src/hooks/HltbApi';

test('loads Portal 2 stats from the live HLTB API', async () => {
    Object.defineProperty(globalThis, 'DOMParser', { value: DOMParser });

    const stats = await fetchHltbGameStats('Portal 2', 620);
    expect(stats?.gameId).toBe(7231);

    for (const value of [
        stats?.mainStat,
        stats?.mainPlusStat,
        stats?.completeStat,
        stats?.allStylesStat,
    ]) {
        expect(Number.isFinite(Number(value))).toBe(true);
        expect(Number(value)).toBeGreaterThan(0);
    }
}, 60_000);
