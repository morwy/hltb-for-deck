import { MenuItem, Navigation } from '@decky/ui';
import { setShowHide } from '../hooks/Cache';
import useLocalization from '../hooks/useLocalization';

type HLTBContextMenuItemProps = {
    appId: string;
};

export const HLTBContextMenuItem = ({ appId }: HLTBContextMenuItemProps) => {
    const lang = useLocalization();
    return (
        <MenuItem
            key="hltb-for-deck-stats-settings"
            onSelected={() => {
                // little hacky but it works
                setShowHide(appId);
                Navigation.Navigate('/hltb-for-deck/loading');
                setTimeout(() => Navigation.NavigateBack(), 1000);
            }}
        >
            {lang('showHideStats')}
        </MenuItem>
    );
};
