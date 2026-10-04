import { useEffect, useState } from 'react';
import {
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
