// Shows the HLTB bar on Steam store game pages in Game Mode.
//
// The store is a separate browser tab, not part of Steam's React UI. This
// watches Steam's router for the store route, connects to the store tab through
// the CEF debugger that Decky itself runs on, and shows a store box pinned to
// the page's body. Nothing depends on the store's own HTML.
//
// Everything that keeps running (socket, timers) belongs to one StoreSession,
// which only exists while the store is open and is disposed on leaving it.

import { fetchNoCors } from '@decky/api';
import { findModuleExport, Navigation } from '@decky/ui';
import { HLTB_BAR_CSS, STORE_BAR_CSS } from '../components/GameStats/style';
import {
    getAppearanceState,
    hydrateAppearance,
    subscribeAppearance,
    toStyleVars,
} from '../appearance';
import {
    getPreference,
    getShowOnStore,
    getStatPreferences,
    hideDetailsKey,
    showOnStoreKey,
    statPreferencesKey,
    subscribeCache,
} from '../hooks/Cache';
import { fetchSteamAppDetails } from '../hooks/HltbApi';
import { getHltbStats } from '../hooks/useHltb';
import { translate } from '../hooks/useLocalization';
import {
    hasAnyStat,
    isSteamGameType,
    normalize,
    parseStoreAppId,
} from '../utils';
import {
    showStoreBox,
    removeStoreBox,
    StoreBoxPayload,
    StoreBoxRow,
} from './storeBox';

const STORE_ROUTE = '/steamweb';
const DEBUGGER_TABS_URL = 'http://localhost:8080/json';
const STORE_URL_PREFIX = 'https://store.steampowered.com/';
const STORE_BOX_ID = 'hltb-for-deck-store';
const DETAILS_BUTTON_BINDING = 'hltbForDeckOpenDetails';
// Steam can jump to the store front page right after opening the store,
// so give the tab a moment before reading its URL.
const CONNECT_DELAY_MS = 1000;
const RETRY_DELAY_MS = 1000;
// Settings sliders fire many changes in a row; update the store box once they settle.
const STORE_BOX_UPDATE_DELAY_MS = 150;
// Shared by every reconnect in a session, whatever triggered it.
const MAX_RETRIES = 3;
// The same app types the library shows stats for.
const STORE_GAME_TYPES = new Set(['game', 'demo']);

interface RouterLocation {
    pathname?: string;
}

interface RouterHistory {
    location?: RouterLocation;
    listen(listener: (location: RouterLocation) => void): () => void;
}

interface DebuggerTab {
    url: string;
    webSocketDebuggerUrl: string;
}

interface StoreGame {
    name: string;
}

// Name lookups for this plugin run. null means "not a game", so we don't ask
// Steam again. Failed lookups aren't stored and are retried on the next visit.
const storeGames = new Map<number, StoreGame | null>();

function findRouterHistory(): RouterHistory | null {
    try {
        const history = findModuleExport(
            (moduleExport: any) => moduleExport?.m_history !== undefined
        )?.m_history;
        return typeof history?.listen === 'function' ? history : null;
    } catch (error) {
        console.error('HLTB - failed to find router history:', error);
        return null;
    }
}

function isDebuggerTab(tab: any): tab is DebuggerTab {
    return (
        typeof tab?.url === 'string' &&
        typeof tab?.webSocketDebuggerUrl === 'string'
    );
}

async function resolveStoreGame(appId: number): Promise<StoreGame | null> {
    if (storeGames.has(appId)) {
        return storeGames.get(appId) ?? null;
    }

    // Free for games in the library.
    const overview = window.appStore?.GetAppOverviewByAppID(appId);
    if (overview?.display_name) {
        const game = isSteamGameType(overview.app_type)
            ? { name: normalize(overview.display_name) }
            : null;
        storeGames.set(appId, game);
        return game;
    }

    // Games you don't own have no overview, so ask the Steam store.
    const details = await fetchSteamAppDetails(appId);
    if (!details) {
        return null;
    }

    const game = STORE_GAME_TYPES.has(details.type)
        ? { name: details.name }
        : null;
    storeGames.set(appId, game);
    return game;
}

async function buildStoreBoxPayload(
    appId: number
): Promise<StoreBoxPayload | null> {
    const game = await resolveStoreGame(appId);
    if (!game) {
        return null;
    }

    const stats = await getHltbStats(appId, game.name, true);
    if (!stats || !stats.showStats || !hasAnyStat(stats)) {
        return null;
    }

    const [preferences, hideDetails] = await Promise.all([
        getStatPreferences(),
        getPreference(),
        hydrateAppearance(),
    ]);
    const hours = translate('hours');
    const rows: StoreBoxRow[] = [];
    if (preferences?.showMain ?? true) {
        rows.push({
            value: `${stats.mainStat} ${hours}`,
            label: translate('mainStory'),
        });
    }
    if (preferences?.showMainPlus ?? true) {
        rows.push({
            value: `${stats.mainPlusStat} ${hours}`,
            label: translate('mainPlusExtras'),
        });
    }
    if (preferences?.showComplete ?? true) {
        rows.push({
            value: `${stats.completeStat} ${hours}`,
            label: translate('completionist'),
        });
    }
    if (preferences?.showAllStyles ?? true) {
        rows.push({
            value: `${stats.allStylesStat} ${hours}`,
            label: translate('allStyles'),
        });
    }

    const viewDetails =
        stats.gameId && !hideDetails
            ? { label: translate('viewDetails'), gameId: stats.gameId }
            : null;
    if (rows.length === 0 && !viewDetails) {
        return null;
    }

    return {
        id: STORE_BOX_ID,
        detailsBinding: DETAILS_BUTTON_BINDING,
        css: HLTB_BAR_CSS + STORE_BAR_CSS,
        vars: toStyleVars(getAppearanceState()) as Record<string, string>,
        rows,
        viewDetails,
    };
}

function openHltbGamePage(payload: unknown) {
    if (typeof payload === 'string' && /^\d+$/.test(payload)) {
        Navigation.NavigateToExternalWeb(
            `https://howlongtobeat.com/game/${payload}`
        );
    }
}

class StoreSession {
    private socket: WebSocket | null = null;
    private readonly timers = new Set<ReturnType<typeof setTimeout>>();
    private retriesLeft = MAX_RETRIES;
    private disposed = false;
    private messageId = 0;
    private pageUrl = '';
    // Bumped on every navigation, store box update and dispose. A slow HLTB
    // lookup checks it, so it never updates the store box for a page you left.
    private latestStoreBoxUpdateId = 0;
    private storeBoxUpdatePending = false;
    private readonly unsubscribers: Array<() => void> = [];

    start() {
        // Keep the open store page in sync with settings, like the library
        // bar does. Only while this session exists.
        const scheduleUpdate = () => this.scheduleStoreBoxUpdate();
        this.unsubscribers.push(
            subscribeAppearance(scheduleUpdate),
            subscribeCache(statPreferencesKey, scheduleUpdate),
            subscribeCache(hideDetailsKey, scheduleUpdate)
        );
        this.schedule(() => this.connect(), CONNECT_DELAY_MS);
    }

    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.latestStoreBoxUpdateId++;

        for (const unsubscribe of this.unsubscribers) {
            unsubscribe();
        }
        this.unsubscribers.length = 0;

        for (const timer of this.timers) {
            clearTimeout(timer);
        }
        this.timers.clear();

        const socket = this.socket;
        this.socket = null;
        if (socket) {
            socket.onopen = null;
            socket.onmessage = null;
            socket.onclose = null;
            if (socket.readyState === WebSocket.OPEN) {
                this.evaluateOn(
                    socket,
                    `(${removeStoreBox})(${JSON.stringify(STORE_BOX_ID)})`
                );
            }
            socket.close();
        }
    }

    private scheduleStoreBoxUpdate() {
        if (this.disposed || this.storeBoxUpdatePending || !this.socket) {
            return;
        }
        this.storeBoxUpdatePending = true;
        this.schedule(() => {
            this.storeBoxUpdatePending = false;
            void this.updateStoreBox();
        }, STORE_BOX_UPDATE_DELAY_MS);
    }

    private schedule(callback: () => void, delayMs: number) {
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            if (!this.disposed) {
                callback();
            }
        }, delayMs);
        this.timers.add(timer);
    }

    private retry(reason: string) {
        if (this.disposed) {
            return;
        }
        if (this.retriesLeft <= 0) {
            console.debug(
                `HLTB - store page stats off until next visit: ${reason}`
            );
            return;
        }
        this.retriesLeft--;
        this.schedule(() => this.connect(), RETRY_DELAY_MS);
    }

    private async connect() {
        let tabs: unknown;
        try {
            const response = await fetchNoCors(DEBUGGER_TABS_URL);
            tabs = await response.json();
        } catch (error) {
            this.retry(`debugger not reachable (${error})`);
            return;
        }
        if (this.disposed) {
            return;
        }

        const storeTab = Array.isArray(tabs)
            ? tabs.find(
                  (tab): tab is DebuggerTab =>
                      isDebuggerTab(tab) && tab.url.startsWith(STORE_URL_PREFIX)
              )
            : undefined;
        if (!storeTab) {
            this.retry('no store tab');
            return;
        }

        this.pageUrl = storeTab.url;
        const socket = new WebSocket(storeTab.webSocketDebuggerUrl);
        this.socket = socket;
        socket.onopen = () => {
            this.send('Page.enable');
            void this.updateStoreBox();
        };
        socket.onmessage = (event) => this.handleMessage(event.data);
        // Also fires when the connection fails, after onerror.
        socket.onclose = () => {
            if (this.socket === socket) {
                this.socket = null;
                this.retry('store tab connection closed');
            }
        };
    }

    private handleMessage(data: unknown) {
        if (this.disposed || typeof data !== 'string') {
            return;
        }

        let message: any;
        try {
            message = JSON.parse(data);
        } catch {
            return;
        }

        switch (message?.method) {
            case 'Page.frameNavigated': {
                const frame = message.params?.frame;
                // Main frame only; iframes have a parent.
                if (!frame?.parentId && typeof frame?.url === 'string') {
                    this.pageUrl = frame.url;
                    this.latestStoreBoxUpdateId++;
                }
                break;
            }
            case 'Page.loadEventFired':
                void this.updateStoreBox();
                break;
            // Chrome debugger event: the store page called our Details button
            // function, so open the game on HLTB.
            case 'Runtime.bindingCalled':
                if (message.params?.name === DETAILS_BUTTON_BINDING) {
                    openHltbGamePage(message.params.payload);
                }
                break;
        }

        if (message?.result?.exceptionDetails) {
            console.debug(
                'HLTB - store page script failed:',
                message.result.exceptionDetails
            );
        }
    }

    private async updateStoreBox() {
        const storeBoxUpdateId = ++this.latestStoreBoxUpdateId;
        const appId = parseStoreAppId(this.pageUrl);
        let payload: StoreBoxPayload | null = null;
        if (appId !== null) {
            try {
                payload = await buildStoreBoxPayload(appId);
            } catch (error) {
                console.error('HLTB - failed to get store page stats:', error);
            }
        }
        const isStale =
            this.disposed || storeBoxUpdateId !== this.latestStoreBoxUpdateId;
        if (isStale) {
            return;
        }

        if (payload?.viewDetails) {
            // A binding is only installed into the pages that exist when it's
            // added, and adding it again is ignored while it's registered.
            // Removing and re-adding puts it into the page that just loaded.
            this.send('Runtime.removeBinding', {
                name: DETAILS_BUTTON_BINDING,
            });
            this.send('Runtime.addBinding', { name: DETAILS_BUTTON_BINDING });
        }

        this.evaluate(
            payload
                ? `(${showStoreBox})(${JSON.stringify(payload)})`
                : `(${removeStoreBox})(${JSON.stringify(STORE_BOX_ID)})`
        );
    }

    private evaluate(expression: string) {
        if (this.socket) {
            this.evaluateOn(this.socket, expression);
        }
    }

    private evaluateOn(socket: WebSocket, expression: string) {
        this.sendOn(socket, 'Runtime.evaluate', { expression });
    }

    private send(method: string, params?: Record<string, unknown>) {
        if (this.socket) {
            this.sendOn(this.socket, method, params);
        }
    }

    private sendOn(
        socket: WebSocket,
        method: string,
        params?: Record<string, unknown>
    ) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(
                JSON.stringify({ id: ++this.messageId, method, params })
            );
        }
    }
}

// Starts watching for the store. Returns the teardown for onDismount.
export function patchStore(): () => void {
    const history = findRouterHistory();
    if (!history) {
        console.warn(
            'HLTB - router history not found, store page stats are off'
        );
        return () => {};
    }

    let session: StoreSession | null = null;
    let onStore = false;
    let enabled = false;
    let stopped = false;

    const update = () => {
        const shouldRun = !stopped && onStore && enabled;
        if (shouldRun && !session) {
            session = new StoreSession();
            session.start();
        } else if (!shouldRun && session) {
            session.dispose();
            session = null;
        }
    };

    const handleLocation = (location?: RouterLocation) => {
        onStore = location?.pathname === STORE_ROUTE;
        update();
    };

    const readSetting = async () => {
        const showOnStore = await getShowOnStore();
        if (!stopped) {
            enabled = showOnStore;
            update();
        }
    };

    const unlisten = history.listen(handleLocation);
    const unsubscribe = subscribeCache(
        showOnStoreKey,
        () => void readSetting()
    );
    handleLocation(history.location);
    void readSetting();

    return () => {
        stopped = true;
        unlisten();
        unsubscribe();
        update();
    };
}
