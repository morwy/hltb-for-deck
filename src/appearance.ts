import type { CSSProperties } from 'react';

export interface Appearance {
    custom: boolean;
    barAlpha: number;
    linkColor: 'steam' | 'text';
    textShadow: boolean;
    textScale: number;
    border: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
    custom: false,
    barAlpha: 25,
    linkColor: 'steam',
    textShadow: false,
    textScale: 100,
    border: true,
};

export function toStyleVars(appearance: Appearance): CSSProperties {
    const variables: Record<string, string> = {};
    if (appearance.custom) {
        if (appearance.barAlpha !== DEFAULT_APPEARANCE.barAlpha)
            variables['--hltb-bar-alpha'] = String(appearance.barAlpha / 100);
        // Match the stats text color without changing the hover or focus color.
        if (appearance.linkColor === 'text')
            variables['--hltb-link-color'] = 'currentColor';
        if (appearance.textShadow)
            variables['--hltb-text-shadow'] = '0 1px 3px rgba(0, 0, 0, 0.9)';
        if (appearance.textScale !== DEFAULT_APPEARANCE.textScale)
            variables['--hltb-text-scale'] = String(appearance.textScale / 100);
        if (!appearance.border) variables['--hltb-border-width'] = '0';
    }
    // React 17 CSSProperties omits custom property keys.
    return variables as CSSProperties;
}

export function normalizeAppearance(value: unknown): Appearance {
    const stored =
        typeof value === 'object' && value !== null
            ? (value as Record<string, unknown>)
            : {};

    const custom =
        typeof stored.custom === 'boolean'
            ? stored.custom
            : DEFAULT_APPEARANCE.custom;
    const barAlpha =
        typeof stored.barAlpha === 'number' && Number.isFinite(stored.barAlpha)
            ? Math.round(Math.min(100, Math.max(0, stored.barAlpha)) / 5) * 5
            : DEFAULT_APPEARANCE.barAlpha;
    const linkColor =
        stored.linkColor === 'steam' || stored.linkColor === 'text'
            ? stored.linkColor
            : DEFAULT_APPEARANCE.linkColor;
    const textShadow =
        typeof stored.textShadow === 'boolean'
            ? stored.textShadow
            : DEFAULT_APPEARANCE.textShadow;
    const textScale =
        typeof stored.textScale === 'number' &&
        Number.isFinite(stored.textScale)
            ? Math.round(Math.min(150, Math.max(75, stored.textScale)) / 5) * 5
            : DEFAULT_APPEARANCE.textScale;
    const border =
        typeof stored.border === 'boolean'
            ? stored.border
            : DEFAULT_APPEARANCE.border;

    return {
        custom,
        barAlpha,
        linkColor,
        textShadow,
        textScale,
        border,
    };
}

let appearanceState = DEFAULT_APPEARANCE;
let hydrated = false,
    hydrating: Promise<void> | null = null;
let persistenceTimer: ReturnType<typeof setTimeout> | undefined;
let localChanges: Partial<Appearance> = {};
const listeners = new Set<() => void>();

function notifyAppearanceListeners(): void {
    [...listeners].forEach((listener) => listener());
}

export function getAppearanceState(): Appearance {
    return appearanceState;
}

export function subscribeAppearance(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function hydrateAppearance(): Promise<void> {
    if (hydrated) return Promise.resolve();
    if (hydrating) return hydrating;
    hydrating = (async () => {
        try {
            // Lazy imports avoid the Cache-to-appearance module cycle.
            const { getAppearance } = await import('./hooks/Cache');
            appearanceState = { ...(await getAppearance()), ...localChanges };
            hydrated = true;
            notifyAppearanceListeners();
        } finally {
            hydrating = null;
        }
    })();
    return hydrating;
}

export function setAppearance(patch: Partial<Appearance>): void {
    appearanceState = { ...appearanceState, ...patch };
    localChanges = { ...localChanges, ...patch };
    notifyAppearanceListeners();
    clearTimeout(persistenceTimer);
    persistenceTimer = setTimeout(async () => {
        const { appearanceKey, updateCache } = await import('./hooks/Cache');
        await updateCache(appearanceKey, getAppearanceState());
    }, 250);
}
