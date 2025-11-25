import {
    appDetailsClasses,
    appDetailsHeaderClasses,
    DialogButtonPrimary,
    Navigation,
} from '@decky/ui';
import useHltb from '../../hooks/useHltb';
import { usePreference, useStyle } from '../../hooks/useStyle';
import style from './style';
import { useEffect, useRef, useState } from 'react';
import { useStatPreferences } from '../../hooks/useStatPreferences';
import useLocalization from '../../hooks/useLocalization';

interface GameStatsProps {
    game: string;
    appId: number;
    id: string;
    isSteamGame: boolean;
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
    const hideDetails = usePreference();
    const baseClass = hltbStyle === null ? 'hltb-info-absolute' : 'hltb-info';
    // Hide if there are no stats, show stats is false, all stats are hidden, or the game is launching
    const hide =
        (mainStat === mainPlusStat &&
            mainPlusStat === completeStat &&
            completeStat === allStylesStat &&
            allStylesStat === '--') ||
        !showStats ||
        gameLaunching;
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
    const btnStyle =
        hltbStyle === 'default' || hltbStyle === 'clean-default'
            ? ''
            : 'hltb-details-btn-clean';

    return (
        <div id={id} ref={ref} style={{ display: hide ? 'none' : 'block' }}>
            {style}
            <div
                className={`${baseClass} ${hltbInfoStyle} ${hltbInfoPosition}`}
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
                        <li>
                            <DialogButtonPrimary
                                className={`hltb-details-btn ${btnStyle}`}
                                onClick={() =>
                                    Navigation.NavigateToExternalWeb(
                                        `https://howlongtobeat.com/game/${gameId}`
                                    )
                                }
                            >
                                {lang('viewDetails')}
                            </DialogButtonPrimary>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};
