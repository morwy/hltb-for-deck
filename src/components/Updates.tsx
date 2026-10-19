import {
    ButtonItem,
    DropdownItem,
    PanelSection,
    PanelSectionRow,
    ProgressBarWithInfo,
} from '@decky/ui';
import { callable } from '@decky/api';
import { FC, useEffect, useRef, useState } from 'react';
import useLocalization from '../hooks/useLocalization';

export type Release = {
    tag: string;
    version: string;
    assetUrl: string;
    notes: string;
    publishedAt: string;
};

export type Status = {
    success: boolean;
    currentVersion: string;
    releases: Release[];
    latest: Release | null;
    updateAvailable: boolean;
    stale: boolean;
    error?: string;
    checkedAt?: number;
};

const checkUpdatesApi = callable<[], Status>('plugin_update_status');
const prepareApi = callable<
    [version: string, url: string],
    { success: boolean; error?: string }
>('plugin_prepare_replacement');
const cancelApi = callable<[], boolean>('plugin_cancel_replacement');

const PLUGIN_NAME = 'HLTB for Deck';
const backend = (): any =>
    (window as any).DeckyBackend ?? (window.opener as any)?.DeckyBackend;

const compareSemver = (a: string, b: string) => {
    const x = a.split('.').map(Number);
    const y = b.split('.').map(Number);
    return (
        (x[0] || 0) - (y[0] || 0) ||
        (x[1] || 0) - (y[1] || 0) ||
        (x[2] || 0) - (y[2] || 0)
    );
};

let latestCheck: { at: number; promise: Promise<Status> } | null = null;

function checkFirmware(force = false): Promise<Status> {
    if (!force && latestCheck && Date.now() - latestCheck.at < 30 * 60 * 1000) {
        return latestCheck.promise;
    }
    const promise = checkUpdatesApi();
    latestCheck = { at: Date.now(), promise };
    promise.catch(() => {
        latestCheck = null;
    });
    return promise;
}

export const UpdatesSection: FC = () => {
    const lang = useLocalization();
    const [status, setStatus] = useState<Status | null>(null);
    const [tag, setTag] = useState('');
    const [checking, setChecking] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('');

    const downloading = useRef(false);
    const active = useRef(true);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const load = async (force = false) => {
        setChecking(true);
        try {
            const value = await checkFirmware(force);
            if (active.current) {
                setStatus(value);
                setTag((prev) =>
                    value.releases.some((r) => r.tag === prev)
                        ? prev
                        : value.releases[0]?.tag || ''
                );
            }
        } catch (error) {
            if (active.current)
                setMessage(`${lang('updateCheckFailed')}: ${error}`);
        } finally {
            if (active.current) setChecking(false);
        }
    };

    useEffect(() => {
        active.current = true;
        void load(false);

        const api = backend();
        const start = (name: string) => {
            if (name !== PLUGIN_NAME) return;
            downloading.current = true;
            setBusy(true);
            setProgress(0);
            setMessage(lang('downloadingPlugin'));
        };

        const info = (percent: number) => {
            if (downloading.current) {
                setProgress(Math.max(0, Math.min(100, Number(percent) || 0)));
            }
        };

        const finish = (name: string) => {
            if (name !== PLUGIN_NAME) return;
            downloading.current = false;
            setBusy(false);
            setProgress(100);
            setMessage(lang('installedReloading'));
            api?.call('loader/reload_plugin', PLUGIN_NAME).catch(() => {
                if (active.current) setMessage(lang('reloadPluginManual'));
            });
        };

        api?.addEventListener?.('loader/plugin_download_start', start);
        api?.addEventListener?.('loader/plugin_download_info', info);
        api?.addEventListener?.('loader/plugin_download_finish', finish);

        return () => {
            active.current = false;
            clearTimeout(timer.current);
            api?.removeEventListener?.('loader/plugin_download_start', start);
            api?.removeEventListener?.('loader/plugin_download_info', info);
            api?.removeEventListener?.('loader/plugin_download_finish', finish);
        };
    }, []);

    const selected = status?.releases.find((r) => r.tag === tag);

    const install = async (release: Release) => {
        if (busy || !status) return;
        const api = backend();
        if (!api?.call) {
            setMessage(lang('openInDeckyLoader'));
            return;
        }

        setBusy(true);
        setMessage(lang('preparingDeckyInstaller'));
        try {
            const result = await prepareApi(release.version, release.assetUrl);
            if (!result.success)
                throw new Error(result.error || 'Preparation failed');

            const order = compareSemver(release.version, status.currentVersion);
            await api.call(
                'utilities/install_plugin',
                release.assetUrl,
                PLUGIN_NAME,
                release.version,
                '',
                order > 0 ? 2 : order < 0 ? 3 : 1
            );

            if (!active.current) return;
            setMessage(lang('confirmInstallationInDecky'));
            timer.current = setTimeout(() => {
                if (!downloading.current) setBusy(false);
            }, 5000);
        } catch (error) {
            await cancelApi().catch(() => {});
            if (active.current) {
                setBusy(false);
                setMessage(`${lang('installationFailed')}: ${error}`);
            }
        }
    };

    const order =
        selected && status
            ? compareSemver(selected.version, status.currentVersion)
            : 0;

    return (
        <PanelSection title={lang('pluginUpdate')}>
            <PanelSectionRow>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <div>
                        {lang('installedVersion')}:{' '}
                        {status?.currentVersion || lang('checking')}
                    </div>
                    <div>
                        {status?.stale
                            ? `${status.error}. ${lang(
                                  'showingCachedReleases'
                              )}`
                            : status?.updateAvailable
                            ? `${lang('updateAvailable')}: ${
                                  status.latest?.version
                              }`
                            : status?.success
                            ? status.releases.length
                                ? lang('upToDate')
                                : lang('noReleasesFound')
                            : lang('checkingGitHub')}
                    </div>
                </div>
            </PanelSectionRow>

            {status?.updateAvailable && status.latest && (
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        disabled={busy || checking}
                        onClick={() => void install(status.latest!)}
                    >
                        {lang('updateTo')} {status.latest.version}
                    </ButtonItem>
                </PanelSectionRow>
            )}

            {!!status?.releases.length && (
                <>
                    <PanelSectionRow>
                        <DropdownItem
                            label={lang('installVersion')}
                            description={lang('installVersionDesc')}
                            rgOptions={status.releases.map((r) => ({
                                data: r.tag,
                                label: r.version,
                            }))}
                            selectedOption={tag}
                            onChange={(o) => setTag(String(o.data))}
                            disabled={busy || checking}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <ButtonItem
                            layout="below"
                            disabled={busy || checking || !selected}
                            onClick={() => selected && void install(selected)}
                        >
                            {order > 0
                                ? lang('updateTo')
                                : order < 0
                                ? lang('downgradeTo')
                                : lang('reinstall')}{' '}
                            {selected?.version}
                        </ButtonItem>
                    </PanelSectionRow>
                </>
            )}

            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    disabled={busy || checking}
                    onClick={() => void load(true)}
                >
                    {checking ? lang('checking') : lang('checkPluginUpdate')}
                </ButtonItem>
            </PanelSectionRow>

            {busy && downloading.current && (
                <PanelSectionRow>
                    <ProgressBarWithInfo
                        layout="inline"
                        nProgress={progress}
                        sOperationText={message}
                    />
                </PanelSectionRow>
            )}

            {message && !downloading.current && (
                <PanelSectionRow>
                    <div style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
                        {message}
                    </div>
                </PanelSectionRow>
            )}
        </PanelSection>
    );
};
