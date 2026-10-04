import { useEffect, useState } from 'react';
import {
    getStatPreferences,
    statPreferencesKey,
    subscribeCache,
} from './Cache';

export type StatPreferences = {
    showMain: boolean;
    showMainPlus: boolean;
    showComplete: boolean;
    showAllStyles: boolean;
};
export const useStatPreferences = () => {
    const [statPrefs, setStatPrefs] = useState<StatPreferences>({
        showMain: true,
        showMainPlus: true,
        showComplete: true,
        showAllStyles: true,
    });
    useEffect(() => {
        let mounted = true;
        const read = async () => {
            const prefs = await getStatPreferences();
            if (mounted && prefs !== null) setStatPrefs(prefs);
        };
        read();
        const unsubscribe = subscribeCache(statPreferencesKey, read);
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    return statPrefs;
};
