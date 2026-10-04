import { useEffect, useState } from 'react';
import {
    Appearance,
    getAppearanceState,
    setAppearance,
    subscribeAppearance,
} from '../appearance';

export const useAppearance = (): {
    appearance: Appearance;
    update: (patch: Partial<Appearance>) => void;
} => {
    const [appearance, setCurrentAppearance] = useState(getAppearanceState());
    useEffect(
        () =>
            subscribeAppearance(() =>
                setCurrentAppearance(getAppearanceState())
            ),
        []
    );
    return { appearance, update: setAppearance };
};
