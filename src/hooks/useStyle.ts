import { useEffect, useState } from 'react';
import {
    backgroundStyleKey,
    getBackgroundStyle,
    getPreference,
    getStyle,
    hideDetailsKey,
    styleKey,
    subscribeCache,
} from './Cache';

export type HLTBStyle =
    | 'default'
    | 'clean'
    | 'clean-left'
    | 'clean-default'
    | null;

export type HLTBBackgroundStyle = 'default' | 'blur';

export function isCleanStyle(style: HLTBStyle): boolean {
    return (
        style === 'clean' || style === 'clean-left' || style === 'clean-default'
    );
}

export const useStyle = () => {
    const [style, setStyle] = useState<HLTBStyle>(null);
    useEffect(() => {
        let mounted = true;
        const read = async () => {
            const next = await getStyle();
            if (mounted) setStyle(next);
        };
        read();
        const unsubscribe = subscribeCache(styleKey, read);
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    return style;
};

export const useBackgroundStyle = (): HLTBBackgroundStyle => {
    const [backgroundStyle, setBackgroundStyle] =
        useState<HLTBBackgroundStyle>('default');
    useEffect(() => {
        let mounted = true;
        let readSequence = 0;
        const read = async () => {
            const sequence = ++readSequence;
            try {
                const next = await getBackgroundStyle();
                if (mounted && sequence === readSequence)
                    setBackgroundStyle(next);
            } catch {
                if (mounted && sequence === readSequence)
                    setBackgroundStyle('default');
            }
        };
        read();
        const unsubscribe = subscribeCache(backgroundStyleKey, read);
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    return backgroundStyle;
};

export const usePreference = () => {
    const [pref, setPref] = useState<boolean>(false);
    useEffect(() => {
        let mounted = true;
        const read = async () => {
            const next = await getPreference();
            if (mounted) setPref(next);
        };
        read();
        const unsubscribe = subscribeCache(hideDetailsKey, read);
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    return pref;
};
