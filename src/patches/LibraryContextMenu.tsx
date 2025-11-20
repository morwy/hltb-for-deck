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

const addStatsSettingsMenuItem = (children: any[], appId: number) => {
    children.find((x: any) => x?.key === 'properties');
    // Find the index of the menu item for the game's properties
    const propertiesMenuItem = children.findIndex((item) =>
        findInReactTree(
            item,
            (x) =>
                x?.onSelected &&
                x.onSelected.toString().includes('AppProperties')
        )
    );
    // Add the HLTB Stats Setting Menu Item before the Properties Menu Item
    children.splice(
        propertiesMenuItem,
        0,
        <HLTBContextMenuItem appId={`${appId}`} />
    );
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

    patches.patchOne = afterPatch(
        LibraryContextMenu.prototype,
        'render',
        (_: Record<string, unknown>[], component: any) => {
            // Get the current app's ID
            let appid: number;
            if (component._owner) {
                appid = component._owner.pendingProps.overview.appid;
            } else {
                // Oct 2025 client, SteamOS stable 3.7.17
                appid = findInTree(
                    component.props.children,
                    (x) => x?.app?.appid,
                    { walkable: ['props', 'children'] }
                ).app.appid;
            }
            if (!patches.patchTwo) {
                patches.patchTwo = afterPatch(
                    component.type.prototype,
                    'shouldComponentUpdate',
                    ([nextProps]: any, shouldUpdate: boolean) => {
                        try {
                            const hltbIndex = nextProps.children.findIndex(
                                (x: any) =>
                                    x?.key === 'hltb-for-deck-stats-settings'
                            );
                            hltbIndex != -1 &&
                                nextProps.children.splice(hltbIndex, 1);
                        } catch (e) {
                            return component;
                        }

                        if (shouldUpdate === true) {
                            let updatedAppid = appid;
                            // find the first menu component where there is a different app id than the current one
                            const parentOverview = nextProps.children.find(
                                (x: any) => {
                                    let componentAppid;
                                    if (
                                        x?._owner?.pendingProps?.overview?.appid
                                    ) {
                                        componentAppid =
                                            x._owner.pendingProps.overview
                                                .appid;
                                    } else {
                                        // Oct 2025 client, SteamOS stable 3.7.17 - try to find appid in the tree
                                        const appData = findInTree(
                                            x,
                                            (y) => y?.app?.appid,
                                            { walkable: ['props', 'children'] }
                                        );
                                        componentAppid = appData?.app?.appid;
                                    }
                                    return (
                                        componentAppid &&
                                        componentAppid !== appid
                                    );
                                }
                            );
                            // if found then use that appid
                            if (parentOverview) {
                                if (
                                    parentOverview._owner?.pendingProps
                                        ?.overview?.appid
                                ) {
                                    updatedAppid =
                                        parentOverview._owner.pendingProps
                                            .overview.appid;
                                } else {
                                    // Oct 2025 client, SteamOS stable 3.7.17
                                    const appData = findInTree(
                                        parentOverview,
                                        (x) => x?.app?.appid,
                                        { walkable: ['props', 'children'] }
                                    );
                                    updatedAppid = appData?.app?.appid;
                                }
                            }
                            addStatsSettingsMenuItem(
                                nextProps.children,
                                updatedAppid
                            );
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
                return Object.values(m).find(
                    (sibling) =>
                        sibling?.toString().includes('createElement') &&
                        sibling?.toString().includes('navigator:')
                );
            }
        }
        return;
    })
).type;

export default contextMenuPatch;
