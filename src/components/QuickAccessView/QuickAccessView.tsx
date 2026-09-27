import {
    PanelSection,
    PanelSectionRow,
    ButtonItem,
    Navigation,
    DropdownItem,
    SliderField,
    ToggleField,
} from '@decky/ui';
import { useEffect, useState } from 'react';
import {
    clearCache,
    hideDetailsKey,
    statPreferencesKey,
    styleKey,
    updateCache,
} from '../../hooks/Cache';
import { HLTBStyle, usePreference, useStyle } from '../../hooks/useStyle';
import { useStatPreferences } from '../../hooks/useStatPreferences';
import useLocalization from '../../hooks/useLocalization';
import { DEFAULT_APPEARANCE, hydrateAppearance } from '../../appearance';
import { useAppearance } from '../../hooks/useAppearance';

export const QuickAccessView = () => {
    const { appearance, update } = useAppearance();
    useEffect(() => void hydrateAppearance(), []);

    const handleClearCache = async () => {
        await clearCache();
        Navigation.CloseSideMenus();
    };
    // Show selections immediately while settings are saved.
    const persistedStyle = useStyle();
    const [style, setStyle] = useState<HLTBStyle>(persistedStyle);
    useEffect(() => setStyle(persistedStyle), [persistedStyle]);

    const persistedHideDetails = usePreference();
    const [hideDetails, setHideDetails] = useState(persistedHideDetails);
    useEffect(
        () => setHideDetails(persistedHideDetails),
        [persistedHideDetails]
    );

    const preferences = useStatPreferences();

    const lang = useLocalization();

    const styleOptions = [
        { data: 0, label: lang('default'), value: 'default' },
        { data: 1, label: lang('clean'), value: 'clean' },
        { data: 2, label: lang('cleanLeft'), value: 'clean-left' },
        { data: 3, label: lang('cleanDefault'), value: 'clean-default' },
    ] as const;

    const toggleShowMain = () => {
        preferences.showMain = !preferences.showMain;
        updateCache(statPreferencesKey, preferences);
    };

    const toggleShowMainPlus = () => {
        preferences.showMainPlus = !preferences.showMainPlus;
        updateCache(statPreferencesKey, preferences);
    };

    const toggleShowComplete = () => {
        preferences.showComplete = !preferences.showComplete;
        updateCache(statPreferencesKey, preferences);
    };

    const toggleShowAllStyles = () => {
        preferences.showAllStyles = !preferences.showAllStyles;
        updateCache(statPreferencesKey, preferences);
    };
    return (
        <>
            <PanelSection>
                <PanelSectionRow>
                    <DropdownItem
                        label={lang('hltbStyle')}
                        description={lang('cleanDesc')}
                        menuLabel={lang('hltbStyle')}
                        rgOptions={styleOptions.map((o) => ({
                            data: o.data,
                            label: o.label,
                        }))}
                        selectedOption={
                            styleOptions.find((o) => o.value === style)?.data ||
                            0
                        }
                        onChange={(newVal: { data: number; label: string }) => {
                            const newStyle =
                                styleOptions.find((o) => o.data === newVal.data)
                                    ?.value || 'default';
                            setStyle(newStyle);
                            updateCache(styleKey, newStyle);
                        }}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={lang('hideViewDetails')}
                        description={lang('hideViewDetailsDesc')}
                        checked={hideDetails}
                        onChange={(checked) => {
                            setHideDetails(checked);
                            updateCache(hideDetailsKey, checked);
                        }}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={lang('toggleMainStat')}
                        description={lang('toggleMainStatDesc')}
                        checked={preferences.showMain}
                        onChange={() => toggleShowMain()}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={lang('toggleMainPlusStat')}
                        description={lang('toggleMainPlusStatDesc')}
                        checked={preferences.showMainPlus}
                        onChange={() => toggleShowMainPlus()}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={lang('toggleCompletionistStat')}
                        description={lang('toggleCompletionistStatDesc')}
                        checked={preferences.showComplete}
                        onChange={() => toggleShowComplete()}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={lang('toggleAllPlayStylesStat')}
                        description={lang('toggleAllPlayStylesStatDesc')}
                        checked={preferences.showAllStyles}
                        onChange={() => toggleShowAllStyles()}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ButtonItem layout="below" onClick={handleClearCache}>
                        {lang('clearCache')}
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>
            <PanelSection title={lang('appearance')}>
                <PanelSectionRow>
                    <ToggleField
                        label={lang('customizeAppearance')}
                        description={lang('customizeAppearanceDesc')}
                        checked={appearance.custom}
                        onChange={(v) => update({ custom: v })}
                    />
                </PanelSectionRow>
                {appearance.custom && (
                    <>
                        <PanelSectionRow>
                            <SliderField
                                label={lang('barOpacity')}
                                description={lang('barOpacityDesc')}
                                value={appearance.barAlpha}
                                min={0}
                                max={100}
                                step={5}
                                showValue
                                valueSuffix="%"
                                resetValue={DEFAULT_APPEARANCE.barAlpha}
                                onChange={(v) => update({ barAlpha: v })}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <DropdownItem
                                label={lang('viewDetailsColor')}
                                description={lang('viewDetailsColorDesc')}
                                menuLabel={lang('viewDetailsColor')}
                                rgOptions={[
                                    { data: 0, label: lang('linkColorSteam') },
                                    { data: 1, label: lang('linkColorText') },
                                ]}
                                selectedOption={
                                    appearance.linkColor === 'steam' ? 0 : 1
                                }
                                onChange={(newVal: {
                                    data: number;
                                    label: string;
                                }) =>
                                    update({
                                        linkColor:
                                            newVal.data === 0
                                                ? 'steam'
                                                : 'text',
                                    })
                                }
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                label={lang('textShadow')}
                                description={lang('textShadowDesc')}
                                checked={appearance.textShadow}
                                onChange={(v) => update({ textShadow: v })}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <SliderField
                                label={lang('textSize')}
                                description={lang('textSizeDesc')}
                                value={appearance.textScale}
                                min={75}
                                max={150}
                                step={5}
                                showValue
                                valueSuffix="%"
                                resetValue={DEFAULT_APPEARANCE.textScale}
                                onChange={(v) => update({ textScale: v })}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                label={lang('bottomBorder')}
                                description={lang('bottomBorderDesc')}
                                checked={appearance.border}
                                onChange={(v) => update({ border: v })}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ButtonItem
                                layout="below"
                                onClick={() =>
                                    update({
                                        ...DEFAULT_APPEARANCE,
                                        custom: true,
                                    })
                                }
                            >
                                {lang('resetAppearance')}
                            </ButtonItem>
                        </PanelSectionRow>
                    </>
                )}
            </PanelSection>
        </>
    );
};
