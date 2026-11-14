import { useEffect, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Device, Settings } from '../api/types';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DeviceKindIcon,
  ExternalLinkIcon,
  RefreshIcon,
  SettingsGearIcon,
  TransportIcon,
} from '../components/icons';
import { BatteryFigure, BatteryNote, deviceSummaryChips, LinkLed } from '../components/Value';
import { t, transportLabel, variantLabel } from '../i18n';
import { displayName, findCapability, viewOf } from '../lib/reading';
import { href } from '../router';
import { AutostartField, LowBatteryFields, ThemeField, TrayFields } from './settingsFields';

function postIpc(message: string): boolean {
  const w = window as unknown as { ipc?: { postMessage: (msg: string) => void } };
  if (w.ipc && typeof w.ipc.postMessage === 'function') {
    w.ipc.postMessage(message);
    return true;
  }
  return false;
}

function openInDashboard(fragment: string) {
  if (postIpc(fragment ? `open:${fragment}` : 'open')) return;
  location.hash = fragment || href.devices;
}

function quitApp() {
  if (postIpc('quit')) return;
  location.hash = href.devices;
}

export function Panel({
  devices,
  settings,
  live,
  initialTab = 'devices',
}: {
  devices: Device[];
  settings: Settings;
  live: boolean;
  initialTab?: 'devices' | 'settings';
}) {
  const [tab, setTab] = useState<'devices' | 'settings'>(initialTab);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Bridge keeps the flyout window hidden until the panel has its devices.
  useEffect(() => {
    if (live) postIpc('ready');
  }, [live]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (tab === 'settings') {
        setTab('devices');
      } else {
        postIpc('hide');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tab]);

  const visible = devices.filter((d) => !d.hidden);
  const connected = visible.filter((d) => d.link === 'connected');

  const handleRefreshAll = async () => {
    if (refreshing || connected.length === 0) return;
    setRefreshing(true);
    try {
      await Promise.allSettled(connected.map((d) => api.refreshDevice(d.id)));
    } finally {
      window.setTimeout(() => setRefreshing(false), 350);
    }
  };

  return (
    <main class="panel tray-flyout">
      <header class="tray-header">
        <div class="tray-header-brand">
          <span class="tray-wordmark">{t('app.name')}</span>
          {!live ? (
            <span class="tray-status-pill is-reconnecting" role="status">
              <span class="led is-low" aria-hidden="true" />
              <span>{t('conn.reconnecting')}</span>
            </span>
          ) : connected.length > 0 ? (
            <span class="tray-status-pill is-live">
              <span class="led is-on" aria-hidden="true" />
              <span>{t('panel.onlineCount', { count: connected.length })}</span>
            </span>
          ) : (
            <span class="tray-status-pill is-off">
              <span class="led is-hollow" aria-hidden="true" />
              <span>{t('panel.noConnected')}</span>
            </span>
          )}
        </div>
        <div class="tray-header-actions">
          {tab === 'devices' && (
            <button
              type="button"
              class="btn btn-subtle btn-icon"
              title={t('panel.refreshAll')}
              aria-label={t('panel.refreshAll')}
              disabled={refreshing || connected.length === 0}
              onClick={() => void handleRefreshAll()}
            >
              <RefreshIcon size={14} {...(refreshing ? { class: 'is-spinning' } : {})} />
            </button>
          )}
          <button
            type="button"
            class="btn btn-subtle btn-sm tray-tab-toggle"
            aria-pressed={tab === 'settings'}
            onClick={() => setTab((cur) => (cur === 'devices' ? 'settings' : 'devices'))}
          >
            {tab === 'devices' ? (
              <>
                <SettingsGearIcon size={14} />
                <span>{t('panel.tabSettings')}</span>
              </>
            ) : (
              <>
                <ChevronLeftIcon size={14} />
                <span>{t('panel.backToDevices')}</span>
              </>
            )}
          </button>
        </div>
      </header>

      <div class="tray-body">
        {!live && (
          <p class="notice tray-notice" role="status">
            <span class="led is-low" aria-hidden="true" />
            <span>{t('conn.reconnectingHint')}</span>
          </p>
        )}

        {tab === 'devices' ? (
          <section class="tray-section" aria-label={t('panel.tabDevices')}>
            {visible.length === 0 ? (
              <div class="empty-state is-compact">
                <p class="empty-title">{t('list.emptyTitle')}</p>
                <p class="note">{t('list.empty')}</p>
                <div class="empty-actions">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    onClick={() => openInDashboard(href.drivers)}
                  >
                    {t('list.emptyActionDrivers')}
                  </button>
                </div>
              </div>
            ) : (
              <ul class="tray-device-list">
                {visible.map((d) => {
                  const battery = findCapability(d, 'battery.level');
                  const charging = findCapability(d, 'battery.charging');
                  const chargingView = charging ? viewOf(charging, d.link) : null;
                  const isCharging = chargingView?.kind === 'live' && chargingView.value === 'charging';
                  const active = d.endpoints.find((e) => e.active) ?? d.endpoints[0];
                  const offline = d.link !== 'connected';
                  const chips = deviceSummaryChips(d).slice(0, 2);

                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        class={`tray-device-card${offline ? ' is-offline' : ''}`}
                        title={t('panel.openDeviceHint')}
                        onClick={() => openInDashboard(href.device(d.id))}
                      >
                        <span class={`device-icon-box${offline ? ' is-offline' : ''}`} aria-hidden="true">
                          <DeviceKindIcon kind={d.kind} size={18} />
                        </span>
                        <div class="tray-device-main">
                          <div class="tray-device-top">
                            <span class="tray-device-name">{displayName(d)}</span>
                            {!offline && active && (
                              <span
                                class="tray-transport"
                                title={transportLabel(active.transport)}
                                aria-label={transportLabel(active.transport)}
                              >
                                <TransportIcon transport={active.transport} size={13} />
                              </span>
                            )}
                          </div>
                          <div class="tray-device-sub">
                            <LinkLed link={d.link} />
                            {chips.map((chip) => (
                              <span
                                key={chip.id}
                                class={`cap-chip${chip.tone === 'ok' ? ' is-ok' : chip.tone === 'low' ? ' is-low' : ''}`}
                              >
                                {chip.text}
                              </span>
                            ))}
                            {isCharging && <span class="cap-chip is-ok">{variantLabel('battery.charging', 'charging')}</span>}
                          </div>
                          {battery && d.link !== 'connected' && <BatteryNote cap={battery} link={d.link} />}
                        </div>
                        <div class="tray-device-right">
                          {battery && (
                            <BatteryFigure
                              cap={battery}
                              link={d.link}
                              threshold={settings.lowBattery.threshold}
                              size="fig-s"
                              chargingCap={charging}
                            />
                          )}
                          <span class="row-chevron" aria-hidden="true">
                            <ChevronRightIcon size={15} />
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
          <section class="tray-section" aria-label={t('panel.tabSettings')}>
            <h2 class="tray-section-title">{t('panel.tabSettings')}</h2>
            <div class="tray-settings-card">
              <ThemeField compact />
              <AutostartField settings={settings} compact />
              <LowBatteryFields settings={settings} compact />
              <TrayFields settings={settings} devices={devices} compact />
            </div>
          </section>
        )}
      </div>

      <footer class="tray-footer">
        <button type="button" class="btn btn-primary tray-open-btn" onClick={() => openInDashboard('')}>
          <ExternalLinkIcon size={14} />
          <span>{t('panel.openDashboard')}</span>
        </button>
        <button type="button" class="btn btn-subtle tray-quit-btn" onClick={() => quitApp()}>
          {t('panel.quit')}
        </button>
      </footer>
    </main>
  );
}
