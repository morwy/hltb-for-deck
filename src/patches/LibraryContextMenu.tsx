import {
    afterPatch,
    fakeRenderComponent,
    findInReactTree,
    findModuleExport,
    Patch,
    findInTree,
    removeHookStubs,
} from '@decky/ui';

import { HLTBContextMenuItem } from '../components/HLTBContextMenuItem';

const RETRY_DELAYS = [250, 500, 1000, 2000, 4000, 8000, 16000, 30000];
const STATS_SETTINGS_MENU_KEY = 'hltb-for-deck-stats-settings';

const hasReactKey = (item: any, expectedKey: string) => {
    const key = item?.key;
    return (
        key === expectedKey ||
        (typeof key === 'string' && key.endsWith(`$${expectedKey}`))
    );
};

const parseAppId = (value: unknown): number | null => {
    try {
        const appId = Number(value);
        return Number.isSafeInteger(appId) && appId > 0 ? appId : null;
    } catch {
        return null;
    }
};

const getOverviewAppId = (component: any): number | null =>
    parseAppId(component?._owner?.pendingProps?.overview?.appid);

const getTreeAppId = (tree: any): number | null => {
    const appData = findInTree(tree, (x) => x?.app?.appid, {
        walkable: ['props', 'children'],
    });

    return parseAppId(appData?.app?.appid);
};

const getComponentAppId = (component: any): number | null =>
    getTreeAppId(component) ?? getOverviewAppId(component);

const resolveComponentAppId = (component: any): number | null =>
    getTreeAppId(component?.props?.children) ?? getOverviewAppId(component);

const resolveUpdatedAppId = (
    children: any[],
    currentAppId: number | null
): number | null => {
    if (!Array.isArray(children)) {
        return null;
    }

    const parentOverview = children.find((item) => {
        const componentAppId = getComponentAppId(item);
        return componentAppId !== null && componentAppId !== currentAppId;
    });

    if (parentOverview) {
        return getComponentAppId(parentOverview);
    }

    return getTreeAppId(children) ?? currentAppId;
};

const addStatsSettingsMenuItem = (children: any[], appId: number) => {
    if (!Array.isArray(children)) {
        return;
    }

    if (
        children.some((item: any) => hasReactKey(item, STATS_SETTINGS_MENU_KEY))
    ) {
        return;
    }

    const propertiesMenuItem = children.findIndex(
        (item) =>
            hasReactKey(item, 'properties') ||
            findInReactTree(
                item,
                (x) =>
                    typeof x?.onSelected === 'function' &&
                    getFunctionSource(x.onSelected).includes('AppProperties')
            )
    );

    if (propertiesMenuItem === -1) {
        return;
    }

    children.splice(
        propertiesMenuItem,
        0,
        <HLTBContextMenuItem key={STATS_SETTINGS_MENU_KEY} appId={`${appId}`} />
    );
};

const removeStatsSettingsMenuItem = (children: any[]) => {
    if (!Array.isArray(children)) {
        return;
    }

    for (let index = children.length - 1; index >= 0; index -= 1) {
        if (hasReactKey(children[index], STATS_SETTINGS_MENU_KEY)) {
            children.splice(index, 1);
        }
    }
};

const getFunctionSource = (value: unknown): string => {
    if (typeof value !== 'function') {
        return '';
    }

    try {
        const source = value.toString();
        if (typeof source === 'string') {
            return source;
        }
    } catch {}

    try {
        return Function.prototype.toString.call(value);
    } catch {
        return '';
    }
};

const findLibraryContextMenu = () => {
    let component: unknown;

    try {
        component =
            findModuleExport((value) => {
                const source = getFunctionSource(value);
                return (
                    source.includes('navigator:') &&
                    source.includes('AppProperties')
                );
            }) ??
            findModuleExport((value) => {
                const source = getFunctionSource(value);
                return (
                    source.includes('LibraryContextMenu') &&
                    (source.includes('navigator:') ||
                        source.includes('AppProperties'))
                );
            });
    } catch {
        console.warn('HLTB - LibraryContextMenu lookup skipped');
        return null;
    }

    if (typeof component !== 'function') {
        return null;
    }

    try {
        const libraryContextMenu = fakeRenderComponent(component)?.type;
        if (typeof libraryContextMenu?.prototype?.render === 'function') {
            return libraryContextMenu;
        }
    } catch (error) {
        try {
            removeHookStubs();
        } catch (cleanupError) {
            console.warn(
                'HLTB - failed to restore React hooks after context menu lookup:',
                cleanupError
            );
        }
        console.error('HLTB - failed to resolve LibraryContextMenu:', error);
        return null;
    }

    return null;
};

const contextMenuPatch = () => {
    const patches: {
        patchOne?: Patch;
        patchTwo?: Patch;
        unpatch: () => void;
    } = {
        unpatch: () => null,
    };
    let currentAppId: number | null = null;
    let stopped = false;
    let retryIndex = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const installPatch = () => {
        if (stopped || patches.patchOne) {
            return true;
        }

        const LibraryContextMenu = findLibraryContextMenu();
        if (!LibraryContextMenu) {
            return false;
        }

        try {
            patches.patchOne = afterPatch(
                LibraryContextMenu.prototype,
                'render',
                (_: Record<string, unknown>[], component: any) => {
                    try {
                        const appid = resolveComponentAppId(component);
                        currentAppId = appid;

                        if (appid === null) {
                            return component;
                        }

                        if (
                            !patches.patchTwo &&
                            typeof component?.type?.prototype
                                ?.shouldComponentUpdate === 'function'
                        ) {
                            patches.patchTwo = afterPatch(
                                component.type.prototype,
                                'shouldComponentUpdate',
                                ([nextProps]: any, shouldUpdate: boolean) => {
                                    try {
                                        if (shouldUpdate === true) {
                                            removeStatsSettingsMenuItem(
                                                nextProps?.children
                                            );
                                            const updatedAppid =
                                                resolveUpdatedAppId(
                                                    nextProps?.children,
                                                    currentAppId
                                                );

                                            currentAppId = updatedAppid;
                                            if (updatedAppid !== null) {
                                                addStatsSettingsMenuItem(
                                                    nextProps.children,
                                                    updatedAppid
                                                );
                                            }
                                        }
                                    } catch (error) {
                                        console.warn(
                                            'HLTB - context menu update skipped:',
                                            error
                                        );
                                    }
                                    return shouldUpdate;
                                }
                            );
                        }
                        addStatsSettingsMenuItem(
                            component?.props?.children,
                            appid
                        );
                    } catch (error) {
                        console.warn(
                            'HLTB - context menu patch skipped:',
                            error
                        );
                    }
                    return component;
                }
            );
        } catch (error) {
            console.warn('HLTB - context menu installation failed:', error);
            return false;
        }

        console.log('HLTB - LibraryContextMenu patch installed');
        return true;
    };

    const retryInstall = () => {
        let installed = false;
        try {
            installed = installPatch();
        } catch (error) {
            console.warn('HLTB - context menu retry failed:', error);
        }

        if (installed) {
            retryTimer = null;
            return;
        }

        const retryDelay = RETRY_DELAYS[retryIndex];
        if (retryDelay === undefined) {
            retryTimer = null;
            console.warn(
                'HLTB - LibraryContextMenu unavailable; context menu integration disabled'
            );
            return;
        }

        retryIndex += 1;
        retryTimer = setTimeout(retryInstall, retryDelay);
    };

    retryInstall();
    patches.unpatch = () => {
        if (stopped) {
            return;
        }
        stopped = true;
        if (retryTimer !== null) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        for (const [name, patch] of [
            ['render', patches.patchOne],
            ['update', patches.patchTwo],
        ] as const) {
            try {
                patch?.unpatch();
            } catch (error) {
                console.warn(
                    `HLTB - context menu ${name} cleanup failed:`,
                    error
                );
            }
        }
    };
    return patches;
};

export default contextMenuPatch;
