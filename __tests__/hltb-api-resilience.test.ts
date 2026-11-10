jest.mock('@decky/api', () => ({ fetchNoCors: jest.fn() }));
jest.mock('localforage');

function jsonResponse(value: unknown, status = 200) {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

beforeEach(() => {
    jest.resetModules();
});

test('rediscovers the endpoint after a malformed successful response', async () => {
    const { fetchNoCors } = await import('@decky/api');
    const mockedFetchNoCors = jest.mocked(fetchNoCors);
    mockedFetchNoCors.mockImplementation(async (url, init = {}) => {
        const href = String(url);
        const method = init.method ?? 'GET';

        if (
            href.endsWith('/api/search/site/init') ||
            href.includes('/api/search/site/init?')
        ) {
            return jsonResponse({ token: 'old-token' });
        }
        if (href.endsWith('/api/search/site') && method === 'POST') {
            return jsonResponse({ error: 'route moved' });
        }
        if (href === 'https://howlongtobeat.com') {
            return new Response(
                '<script>searchTerms;searchOptions;fetch("/api/finder/v3/init");fetch("/api/finder/v3",{method:"POST"})</script>',
                { status: 200 }
            );
        }
        if (href.includes('/api/finder/v3/init?')) {
            return jsonResponse({ token: 'new-token' });
        }
        if (href.endsWith('/api/finder/v3') && method === 'POST') {
            return jsonResponse({
                data: [
                    {
                        game_id: 7231,
                        game_name: 'Portal 2',
                        profile_steam: 620,
                        comp_main: 30000,
                        comp_plus: 45000,
                        comp_100: 75000,
                        comp_all: 45000,
                        comp_all_count: 100,
                    },
                ],
            });
        }
        return new Response('', { status: 404 });
    });

    const { fetchHltbGameStats } = await import('../src/hooks/HltbApi');
    const stats = await fetchHltbGameStats('Portal 2', 620);

    expect(stats?.gameId).toBe(7231);
    expect(
        mockedFetchNoCors.mock.calls.some(([url]) =>
            String(url).endsWith('/api/finder/v3')
        )
    ).toBe(true);
});

test('uses the exact Steam title instead of a localized fuzzy match', async () => {
    const { fetchNoCors } = await import('@decky/api');
    const mockedFetchNoCors = jest.mocked(fetchNoCors);
    mockedFetchNoCors.mockImplementation(async (url, init = {}) => {
        const href = String(url);
        const method = init.method ?? 'GET';

        if (href.includes('/api/search/site/init')) {
            return jsonResponse({ token: 'search-token' });
        }
        if (href.endsWith('/api/search/site') && method === 'POST') {
            const request = JSON.parse(String(init.body)) as {
                searchTerms: string[];
            };
            if (request.searchTerms.join(' ') === 'portal dos') {
                return jsonResponse({
                    data: [
                        {
                            game_id: 999,
                            game_name: 'Portal Dos Remastered',
                            comp_main: 60000,
                            comp_plus: 70000,
                            comp_100: 80000,
                            comp_all: 70000,
                            comp_all_count: 1,
                        },
                    ],
                });
            }
            return jsonResponse({
                data: [
                    {
                        game_id: 7231,
                        game_name: 'Portal 2',
                        profile_steam: 620,
                        comp_main: 30000,
                        comp_plus: 45000,
                        comp_100: 75000,
                        comp_all: 45000,
                        comp_all_count: 100,
                    },
                ],
            });
        }
        if (href.includes('store.steampowered.com/api/appdetails')) {
            return jsonResponse({
                '620': { success: true, data: { name: 'Portal 2' } },
            });
        }

        return new Response('', { status: 404 });
    });

    const { fetchHltbGameStats } = await import('../src/hooks/HltbApi');
    const stats = await fetchHltbGameStats('portal dos', 620);

    expect(stats?.gameId).toBe(7231);
    expect(
        mockedFetchNoCors.mock.calls.some(([url]) =>
            String(url).includes('store.steampowered.com/api/appdetails')
        )
    ).toBe(true);
});
