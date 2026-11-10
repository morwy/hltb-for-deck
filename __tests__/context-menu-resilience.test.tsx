import {
    afterPatch,
    fakeRenderComponent,
    findInReactTree,
    findInTree,
    findModuleExport,
} from '@decky/ui';

import contextMenuPatch from '../src/patches/LibraryContextMenu';

jest.mock('@decky/ui', () => ({
    afterPatch: jest.fn(),
    fakeRenderComponent: jest.fn(),
    findInReactTree: jest.fn(),
    findInTree: jest.fn(),
    findModuleExport: jest.fn(),
    removeHookStubs: jest.fn(),
}));

jest.mock('../src/components/HLTBContextMenuItem', () => ({
    HLTBContextMenuItem: () => null,
}));

const mockedAfterPatch = afterPatch as jest.Mock;
const mockedFakeRenderComponent = fakeRenderComponent as jest.Mock;
const mockedFindInReactTree = findInReactTree as jest.Mock;
const mockedFindInTree = findInTree as jest.Mock;
const mockedFindModuleExport = findModuleExport as jest.Mock;

function findTreeNode(
    tree: unknown,
    predicate: (value: any) => boolean
): unknown {
    const visited = new Set<object>();

    const visit = (value: unknown): unknown => {
        if (predicate(value)) {
            return value;
        }
        if (!value || typeof value !== 'object' || visited.has(value)) {
            return undefined;
        }

        visited.add(value);
        for (const child of Array.isArray(value)
            ? value
            : Object.values(value)) {
            const found = visit(child);
            if (found !== undefined) {
                return found;
            }
        }

        return undefined;
    };

    return visit(tree);
}

function installAfterPatchMock() {
    mockedAfterPatch.mockImplementation(
        (
            target: Record<string, (...args: any[]) => any>,
            method: string,
            callback: (args: any[], result: any) => any
        ) => {
            const original = target[method];
            target[method] = function (this: unknown, ...args: any[]) {
                return callback(args, original.apply(this, args));
            };

            return {
                unpatch: () => {
                    target[method] = original;
                },
            };
        }
    );
}

function createContextMenu(appId = 620) {
    class ContextMenuContents {
        shouldComponentUpdate() {
            return true;
        }
    }

    const component = {
        type: ContextMenuContents,
        props: {
            children: [
                { app: { appid: appId } },
                { key: 'properties', props: {} },
            ],
        },
    };

    class LibraryContextMenu {
        render() {
            return component;
        }
    }

    return { component, LibraryContextMenu };
}

describe('context menu resilience', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        installAfterPatchMock();
        mockedFindInTree.mockImplementation(findTreeNode);
        mockedFindInReactTree.mockImplementation(findTreeNode);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('Steam module discovery does not stringify Symbol exports', () => {
        const { LibraryContextMenu } = createContextMenu();
        function SteamExport() {
            return ['navigator:', 'AppProperties'];
        }
        Object.defineProperty(SteamExport, 'toString', {
            value: () => Symbol('steam-export'),
        });

        mockedFindModuleExport.mockImplementation(
            (predicate: (value: unknown) => boolean) => {
                expect(() => predicate(Symbol('steam-module'))).not.toThrow();
                expect(predicate(SteamExport)).toBe(true);
                return SteamExport;
            }
        );
        mockedFakeRenderComponent.mockReturnValue({
            type: LibraryContextMenu,
        });

        const patch = contextMenuPatch();
        const menu = new LibraryContextMenu();

        expect(() => menu.render()).not.toThrow();
        patch.unpatch();
    });

    test('repeated renders keep exactly one item for the current game', () => {
        const { component, LibraryContextMenu } = createContextMenu();
        mockedFindModuleExport.mockReturnValue(() => null);
        mockedFakeRenderComponent.mockReturnValue({
            type: LibraryContextMenu,
        });

        const patch = contextMenuPatch();
        const menu = new LibraryContextMenu();
        menu.render();
        menu.render();
        menu.render();

        const hltbItems = component.props.children.filter(
            (item: any) =>
                item?.key === 'hltb-for-deck-stats-settings' ||
                (typeof item?.key === 'string' &&
                    item.key.endsWith('$hltb-for-deck-stats-settings'))
        );

        expect(hltbItems).toHaveLength(1);
        expect(hltbItems).toEqual([
            expect.objectContaining({
                props: expect.objectContaining({ appId: '620' }),
            }),
        ]);
        patch.unpatch();
    });

    test('a reused context menu points to the newly selected game', () => {
        const { component, LibraryContextMenu } = createContextMenu();
        mockedFindModuleExport.mockReturnValue(() => null);
        mockedFakeRenderComponent.mockReturnValue({
            type: LibraryContextMenu,
        });

        const patch = contextMenuPatch();
        const menu = new LibraryContextMenu();
        menu.render();

        const nextChildren: any[] = [
            { app: { appid: 400 } },
            { key: 'properties', props: {} },
        ];
        const contents = new component.type();
        (contents.shouldComponentUpdate as (...args: any[]) => boolean)({
            children: nextChildren,
        });

        const hltbItems = nextChildren.filter(
            (item) =>
                item?.key === 'hltb-for-deck-stats-settings' ||
                (typeof item?.key === 'string' &&
                    item.key.endsWith('$hltb-for-deck-stats-settings'))
        );

        expect(hltbItems).toEqual([
            expect.objectContaining({
                props: expect.objectContaining({ appId: '400' }),
            }),
        ]);
        patch.unpatch();
    });

    test('installs the item when Steam loads the context-menu module later', () => {
        jest.useFakeTimers();
        const { component, LibraryContextMenu } = createContextMenu();
        mockedFindModuleExport
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(null)
            .mockReturnValue(() => null);
        mockedFakeRenderComponent.mockReturnValue({
            type: LibraryContextMenu,
        });

        const patch = contextMenuPatch();
        expect(mockedAfterPatch).not.toHaveBeenCalled();

        jest.advanceTimersByTime(250);
        const menu = new LibraryContextMenu();
        menu.render();

        expect(component.props.children).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    props: expect.objectContaining({ appId: '620' }),
                }),
            ])
        );
        patch.unpatch();
    });

    test('does not patch Steam after the plugin has been unloaded', () => {
        jest.useFakeTimers();
        mockedFindModuleExport.mockReturnValue(null);

        const patch = contextMenuPatch();
        const lookupCountAtUnload = mockedFindModuleExport.mock.calls.length;
        patch.unpatch();
        jest.advanceTimersByTime(120_000);

        expect(mockedFindModuleExport).toHaveBeenCalledTimes(
            lookupCountAtUnload
        );
        expect(mockedAfterPatch).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });

    test('stops retrying when the Steam context-menu module stays unavailable', () => {
        jest.useFakeTimers();
        const warning = jest.spyOn(console, 'warn').mockImplementation();
        mockedFindModuleExport.mockReturnValue(null);

        const patch = contextMenuPatch();
        jest.runAllTimers();
        const completedLookupCount = mockedFindModuleExport.mock.calls.length;

        jest.advanceTimersByTime(120_000);

        expect(completedLookupCount).toBeGreaterThan(0);
        expect(completedLookupCount).toBeLessThan(25);
        expect(mockedFindModuleExport).toHaveBeenCalledTimes(
            completedLookupCount
        );
        expect(jest.getTimerCount()).toBe(0);

        patch.unpatch();
        warning.mockRestore();
    });
});
