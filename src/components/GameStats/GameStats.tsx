import {
    appDetailsClasses,
    appDetailsHeaderClasses,
    basicAppDetailsSectionStylerClasses,
    findClassModule,
    Focusable,
    Navigation,
} from '@decky/ui';
import useHltb from '../../hooks/useHltb';
import {
    isCleanStyle,
    useBackgroundStyle,
    usePreference,
    useStyle,
} from '../../hooks/useStyle';
import style, { joinedBlurStyle } from './style';
import { useEffect, useRef, useState } from 'react';
import { useStatPreferences } from '../../hooks/useStatPreferences';
import useLocalization from '../../hooks/useLocalization';
import { hydrateAppearance, toStyleVars } from '../../appearance';
import { useAppearance } from '../../hooks/useAppearance';
import { hasAnyStat } from '../../utils';

interface GameStatsProps {
    game: string;
    appId: number;
    id: string;
    isSteamGame: boolean;
}

const detailsButtonClasses =
    findClassModule((classes) => classes.DeckVerifiedInfo && classes.Details) ??
    {};

interface JoinedBlur {
    height: string;
    paddingTop: string;
}

function findTopCapsuleParent(ref: HTMLDivElement | null): Element | null {
    const children = ref?.parentElement?.children;
    if (!children) {
        return null;
    }

    let headerContainer: Element | undefined;
    for (const child of children) {
        if (child.className.includes(appDetailsClasses.Header)) {
            headerContainer = child;
            break;
        }
    }

    if (!headerContainer) {
        return null;
    }

    let topCapsule: Element | null = null;
    for (const child of headerContainer.children) {
        if (child.className.includes(appDetailsHeaderClasses.TopCapsule)) {
            topCapsule = child;
            break;
        }
    }

    return topCapsule;
}

export const GameStats = ({ game, appId, id, isSteamGame }: GameStatsProps) => {
    // There will be no mutation when the page is loaded (either from exiting the game
    // or just newly opening the page), therefore it's not "launching" by default.
    const [gameLaunching, setGameLaunching] = useState<boolean>(false);
    const ref = useRef<HTMLDivElement | null>(null);
    const { appearance } = useAppearance();
    useEffect(() => {
        const topCapsule = findTopCapsuleParent(ref?.current);
        if (!topCapsule) {
            console.error('HLTB - TopCapsule container not found!');
            return;
        }

        const mutationObserver = new MutationObserver((entries) => {
            for (const entry of entries) {
                if (
                    entry.type !== 'attributes' ||
                    entry.attributeName !== 'class'
                ) {
                    continue;
                }

                const className = (entry.target as Element).className;
                const fullscreenMode =
                    className.includes(
                        appDetailsHeaderClasses.FullscreenEnterStart
                    ) ||
                    className.includes(
                        appDetailsHeaderClasses.FullscreenEnterActive
                    ) ||
                    className.includes(
                        appDetailsHeaderClasses.FullscreenEnterDone
                    ) ||
                    className.includes(
                        appDetailsHeaderClasses.FullscreenExitStart
                    ) ||
                    className.includes(
                        appDetailsHeaderClasses.FullscreenExitActive
                    );
                const fullscreenAborted = className.includes(
                    appDetailsHeaderClasses.FullscreenExitDone
                );

                setGameLaunching(fullscreenMode && !fullscreenAborted);
            }
        });
        mutationObserver.observe(topCapsule, {
            attributes: true,
            attributeFilter: ['class'],
        });
        return () => {
            mutationObserver.disconnect();
        };
    }, []);

    useEffect(() => void hydrateAppearance(), []);

    const lang = useLocalization();
    const {
        mainStat,
        mainPlusStat,
        completeStat,
        allStylesStat,
        gameId,
        showStats,
    } = useHltb(appId, game, isSteamGame);
    const { showMain, showMainPlus, showComplete, showAllStyles } =
        useStatPreferences();
    const hltbStyle = useStyle();
    const backgroundStyle = useBackgroundStyle();
    const blurEnabled =
        appearance.custom &&
        isCleanStyle(hltbStyle) &&
        backgroundStyle === 'blur';
    const hideDetails = usePreference();
    const baseClass = hltbStyle === null ? 'hltb-info-absolute' : 'hltb-info';
    // Hide if there are no stats, show stats is false, all stats are hidden, or the game is launching
    const hide =
        !hasAnyStat({ mainStat, mainPlusStat, completeStat, allStylesStat }) ||
        !showStats ||
        gameLaunching;
    const [joinedBlur, setJoinedBlur] = useState<JoinedBlur | null>(null);
    useEffect(() => {
        if (!blurEnabled || hltbStyle !== 'clean-default' || hide) {
            setJoinedBlur(null);
            return;
        }
        const root = ref.current;
        const bar = root?.querySelector<HTMLElement>('.hltb-info');
        const playClass = basicAppDetailsSectionStylerClasses.PlaySection;
        const play = playClass
            ? root?.parentElement?.querySelector<HTMLElement>(
                  `.${CSS.escape(playClass)}`
              )
            : null;
        if (!bar || !play) return;

        let current: JoinedBlur | null = null;
        const refresh = () => {
            const nativeStyle = getComputedStyle(play);
            const radius =
                nativeStyle.backdropFilter.match(/blur\(([\d.]+)px\)/);
            if (!radius || Number(radius[1]) <= 0) {
                current = null;
                setJoinedBlur(null);
                return;
            }
            const next = {
                height: getComputedStyle(bar).height,
                paddingTop: current?.paddingTop ?? nativeStyle.paddingTop,
            };
            if (
                current?.height === next.height &&
                current.paddingTop === next.paddingTop
            )
                return;
            current = next;
            setJoinedBlur(next);
        };
        refresh();
        const resize = new ResizeObserver(refresh);
        resize.observe(bar);
        const theme = new MutationObserver(refresh);
        theme.observe(document.head, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        return () => {
            resize.disconnect();
            theme.disconnect();
        };
    }, [blurEnabled, hltbStyle, hide]);
    const joinNativeBlur =
        blurEnabled &&
        hltbStyle === 'clean-default' &&
        !hide &&
        joinedBlur !== null;
    let hltbInfoStyle = '';
    switch (hltbStyle) {
        case 'clean':
        case 'clean-left':
            hltbInfoStyle = 'hltb-info-clean';
            break;
        case 'clean-default':
            hltbInfoStyle = 'hltb-info-clean-default';
            break;
    }
    const hltbInfoPosition =
        hltbStyle === 'clean-left' ? 'hltb-info-clean-left' : '';
    return (
        <div
            id={id}
            ref={ref}
            className={
                blurEnabled
                    ? `hltb-blur${joinNativeBlur ? ' hltb-joined-blur' : ''}`
                    : undefined
            }
            style={{ display: hide ? 'none' : 'block' }}
        >
            {style}
            {joinNativeBlur &&
                joinedBlurStyle(joinedBlur.height, joinedBlur.paddingTop)}
            <div
                className={`${baseClass} ${hltbInfoStyle} ${hltbInfoPosition}`}
                style={toStyleVars(appearance)}
            >
                <ul
                    style={{
                        display: 'flex',
                        justifyContent: 'space-evenly',
                    }}
                >
                    <li style={{ display: showMain ? 'block' : 'none' }}>
                        <p className="hltb-gametime">
                            {mainStat} {lang('hours')}
                        </p>
                        <p className="hltb-label">{lang('mainStory')}</p>
                    </li>
                    <li
                        style={{
                            display: showMainPlus ? 'block' : 'none',
                        }}
                    >
                        <p className="hltb-gametime">
                            {mainPlusStat} {lang('hours')}
                        </p>
                        <p className="hltb-label">{lang('mainPlusExtras')}</p>
                    </li>
                    <li
                        style={{
                            display: showComplete ? 'block' : 'none',
                        }}
                    >
                        <p className="hltb-gametime">
                            {completeStat} {lang('hours')}
                        </p>
                        <p className="hltb-label">{lang('completionist')}</p>
                    </li>
                    <li
                        style={{
                            display: showAllStyles ? 'block' : 'none',
                        }}
                    >
                        <p className="hltb-gametime">
                            {allStylesStat} {lang('hours')}
                        </p>
                        <p className="hltb-label">{lang('allStyles')}</p>
                    </li>
                    {gameId && !hideDetails && (
                        <li className="hltb-details-item">
                            <Focusable
                                className={`${
                                    detailsButtonClasses.DeckVerifiedInfo ?? ''
                                } hltb-details-container`}
                                focusClassName={detailsButtonClasses.Focused}
                            >
                                <Focusable
                                    className={`${
                                        detailsButtonClasses.Details ?? ''
                                    } hltb-details-btn`}
                                    onActivate={() =>
                                        Navigation.NavigateToExternalWeb(
                                            `https://howlongtobeat.com/game/${gameId}`
                                        )
                                    }
                                >
                                    {lang('viewDetails')}
                                </Focusable>
                            </Focusable>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};
