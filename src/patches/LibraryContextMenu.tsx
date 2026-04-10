// Credit to https://github.com/SteamGridDB/decky-steamgriddb/ for most of this
import {
    afterPatch,
    fakeRenderComponent,
    findInReactTree,
    findModuleChild,
    Patch,
    findInTree,
} from '@decky/ui';

import { HLTBContextMenuItem } from '../components/HLTBContextMenuItem';

const getOverviewAppId = (component: any): number | null =>
    component?._owner?.pendingProps?.overview?.appid ?? null;

const getTreeAppId = (tree: any): number | null => {
    const appData = findInTree(tree, (x) => x?.app?.appid, {
        walkable: ['props', 'children'],
    });

    return appData?.app?.appid ?? null;
};

const resolveComponentAppId = (component: any): number | null =>
    getOverviewAppId(component) ?? getTreeAppId(component?.props?.children);

const resolveUpdatedAppId = (
    children: any[],
    currentAppId: number | null
): number | null => {
    if (!Array.isArray(children)) {
        return null;
    }

    const parentOverview = children.find((item) => {
        const componentAppId = getOverviewAppId(item) ?? getTreeAppId(item);
        return componentAppId !== null && componentAppId !== currentAppId;
    });

    if (parentOverview) {
        return getOverviewAppId(parentOverview) ?? getTreeAppId(parentOverview);
    }

    return getTreeAppId(children) ?? currentAppId;
};

const addStatsSettingsMenuItem = (children: any[], appId: number) => {
    if (!Array.isArray(children)) {
        return;
    }

    // Find the index of the menu item for the game's properties
    const propertiesMenuItem = children.findIndex((item) =>
        findInReactTree(
            item,
            (x) =>
                x?.onSelected &&
                x.onSelected.toString().includes('AppProperties')
        )
    );

    if (propertiesMenuItem === -1) {
        return;
    }

    // Add the HLTB Stats Setting Menu Item before the Properties Menu Item
    children.splice(
        propertiesMenuItem,
        0,
        <HLTBContextMenuItem appId={`${appId}`} />
    );
};

const removeStatsSettingsMenuItem = (children: any[]) => {
    if (!Array.isArray(children)) {
        return;
    }

    const hltbIndex = children.findIndex(
        (x: any) => x?.key === 'hltb-for-deck-stats-settings'
    );
    if (hltbIndex !== -1) {
        children.splice(hltbIndex, 1);
    }
};

const contextMenuPatch = (LibraryContextMenu: any) => {
    // Variable for all patches applied to LibraryContextMenu
    const patches: {
        patchOne?: Patch;
        patchTwo?: Patch;
        unpatch: () => void;
    } = {
        unpatch: () => null,
    };
    let currentAppId: number | null = null;

    patches.patchOne = afterPatch(
        LibraryContextMenu.prototype,
        'render',
        (_: Record<string, unknown>[], component: any) => {
            // Get the current app's ID
            const appid = resolveComponentAppId(component);
            currentAppId = appid;

            if (appid === null) {
                return component;
            }

            if (!patches.patchTwo) {
                patches.patchTwo = afterPatch(
                    component.type.prototype,
                    'shouldComponentUpdate',
                    ([nextProps]: any, shouldUpdate: boolean) => {
                        removeStatsSettingsMenuItem(nextProps.children);

                        if (shouldUpdate === true) {
                            const updatedAppid = resolveUpdatedAppId(
                                nextProps.children,
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

                        return shouldUpdate;
                    }
                );
            } else {
                // Add the Menu Item if we've already patched
                addStatsSettingsMenuItem(component.props.children, appid);
            }

            return component;
        }
    );
    patches.unpatch = () => {
        patches.patchOne?.unpatch();
        patches.patchTwo?.unpatch();
    };
    return patches;
};

export const LibraryContextMenu = fakeRenderComponent(
    findModuleChild((m) => {
        if (typeof m !== 'object') return;
        for (const prop in m) {
            if (
                m[prop]?.toString() &&
                m[prop].toString().includes('().LibraryContextMenu')
            ) {
                return Object.values(m).find((sibling) =>
                    sibling?.toString().includes('navigator:')
                );
            }
        }
        return;
    })
).type;

export default contextMenuPatch;
