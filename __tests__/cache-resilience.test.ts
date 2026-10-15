import localforage from 'localforage';
import {
    clearCache,
    getApiBootstrapCache,
    getCache,
    setShowHide,
    updateApiBootstrapCache,
    updateCache,
    updateGameStatsCache,
} from '../src/hooks/Cache';

jest.mock('localforage');

const mockedLocalforage = jest.mocked(localforage);

describe('cache resilience', () => {
    const store = new Map<string, unknown>();

    beforeEach(() => {
        store.clear();
        mockedLocalforage.getItem.mockImplementation(async (key) =>
            store.has(key) ? store.get(key) : null
        );
        mockedLocalforage.setItem.mockImplementation(async (key, value) => {
            store.set(key, value);
            return value;
        });
        mockedLocalforage.removeItem.mockImplementation(async (key) => {
            store.delete(key);
        });
        mockedLocalforage.keys.mockImplementation(async () => [
            ...store.keys(),
        ]);
    });

    test('clear waits for a pending write and removes its result', async () => {
        let releaseWrite: (() => void) | undefined;
        const writeGate = new Promise<void>((resolve) => {
            releaseWrite = resolve;
        });
        mockedLocalforage.setItem.mockImplementationOnce(async (key, value) => {
            await writeGate;
            store.set(key, value);
            return value;
        });

        const pendingWrite = updateCache('620', { gameId: 7231 });
        const pendingClear = clearCache();
        releaseWrite?.();

        await Promise.all([pendingWrite, pendingClear]);
        expect(await getCache('620')).toBeNull();
    });

    test('visibility can be changed before stats have been cached', async () => {
        await setShowHide('620');
        expect(await getCache<{ showStats: boolean }>('620')).toMatchObject({
            showStats: false,
        });

        await setShowHide('620');
        expect(await getCache<{ showStats: boolean }>('620')).toMatchObject({
            showStats: true,
        });
    });

    test('a completed stats request does not undo the latest visibility choice', async () => {
        await updateCache('620', {
            mainStat: '8.0',
            mainPlusStat: '12.0',
            completeStat: '20.0',
            allStylesStat: '12.0',
            lastUpdatedAt: new Date(0),
            showStats: true,
            gameId: 7231,
            version: 3,
        });

        const visibilityChange = setShowHide('620');
        const completedRequest = updateGameStatsCache('620', {
            mainStat: '9.0',
            mainPlusStat: '13.0',
            completeStat: '21.0',
            allStylesStat: '13.0',
            lastUpdatedAt: new Date(),
            showStats: true,
            gameId: 7231,
            version: 3,
        });

        await Promise.all([visibilityChange, completedRequest]);

        expect(await getCache('620')).toMatchObject({
            mainStat: '9.0',
            showStats: false,
        });
    });

    test('clear removes results but preserves per-game visibility', async () => {
        await updateApiBootstrapCache({
            searchUrl: '/api/finder/v3',
            searchAuth: {
                searchUrl: '/api/finder/v3',
                token: ' token ',
            },
        });
        await updateCache('620', {
            mainStat: '8.0',
            mainPlusStat: '12.0',
            completeStat: '20.0',
            allStylesStat: '12.0',
            lastUpdatedAt: new Date(),
            showStats: false,
            gameId: 7231,
            version: 3,
        });

        await clearCache();

        expect(await getCache('620')).toMatchObject({
            mainStat: '--',
            mainPlusStat: '--',
            completeStat: '--',
            allStylesStat: '--',
            showStats: false,
        });
        expect(await getApiBootstrapCache()).toEqual({
            searchUrl: '/api/finder/v3',
            searchAuth: {
                searchUrl: '/api/finder/v3',
                token: 'token',
            },
        });
    });

    test('clearing a large cache does not flood storage with every operation at once', async () => {
        let activeRemovals = 0;
        let maxActiveRemovals = 0;
        for (let index = 0; index < 40; index += 1) {
            store.set(`invalid-${index}`, { stale: true });
        }
        mockedLocalforage.removeItem.mockImplementation(async (key) => {
            activeRemovals += 1;
            maxActiveRemovals = Math.max(maxActiveRemovals, activeRemovals);
            await new Promise((resolve) => setTimeout(resolve, 0));
            store.delete(key);
            activeRemovals -= 1;
        });

        await clearCache();

        expect(maxActiveRemovals).toBeGreaterThan(1);
        expect(maxActiveRemovals).toBeLessThan(40);
        expect(store.size).toBe(0);
    });
});
