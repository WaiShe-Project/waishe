import { useState } from 'preact/hooks';
import type { Device } from '../api/types';
import { Switch } from '../components/common';
import { ChevronRightIcon, CpuIcon, DeviceKindIcon, TransportIcon } from '../components/icons';
import { BatteryFigure, BatteryNote, deviceSummaryChips, LinkLed, liveStatus } from '../components/Value';
import { kindLabel, t, transportLabel, variantLabel } from '../i18n';
import { displayName, findCapability, viewOf } from '../lib/reading';
import { href } from '../router';

export function DeviceList({ devices, threshold }: { devices: Device[]; threshold: number }) {
  const [showHidden, setShowHidden] = useState(false);
  const hiddenCount = devices.filter((d) => d.hidden).length;
  const visible = showHidden ? devices : devices.filter((d) => !d.hidden);

  return (
    <div class="page">
      <header class="page-header">
        <div class="page-header-main">
          <div class="page-title-row">
            <h1 class="page-title">{t('list.title')}</h1>
            {visible.length > 0 && <span class="badge badge-neutral">{t('list.count', { count: visible.length })}</span>}
          </div>
          <p class="page-subtitle">{t('list.subtitle')}</p>
        </div>
        <div class="page-toolbar">
          {(hiddenCount > 0 || showHidden) && (
            <div class="toolbar-switch">
              <Switch checked={showHidden} onChange={setShowHidden}>
                {hiddenCount > 0 ? t('list.showHiddenCount', { count: hiddenCount }) : t('list.showHidden')}
              </Switch>
            </div>
          )}
          <a class="btn btn-subtle" href={href.hid}>
            <CpuIcon size={15} />
            <span>{t('list.allHid')}</span>
          </a>
        </div>
      </header>

      {visible.length === 0 ? (
        devices.length === 0 ? (
          <section class="empty-state" aria-label={t('list.emptyTitle')}>
            <div class="empty-icon-wrap" aria-hidden="true">
              <DeviceKindIcon kind="mouse" size={28} />
            </div>
            <h2 class="empty-title">{t('list.emptyTitle')}</h2>
            <p class="empty-body">{t('list.empty')}</p>
            <div class="empty-actions">
              <a class="btn btn-primary" href={href.drivers}>
                {t('list.emptyActionDrivers')}
              </a>
              <a class="btn" href={href.hid}>
                <CpuIcon size={15} />
                <span>{t('list.allHid')}</span>
              </a>
            </div>
          </section>
        ) : (
          <section class="empty-state" aria-label={t('list.emptyHiddenTitle')}>
            <div class="empty-icon-wrap" aria-hidden="true">
              <DeviceKindIcon kind="mouse" size={28} />
            </div>
            <h2 class="empty-title">{t('list.emptyHiddenTitle')}</h2>
            <p class="empty-body">{t('list.emptyHidden')}</p>
            <div class="empty-actions">
              <button type="button" class="btn btn-primary" onClick={() => setShowHidden(true)}>
                {hiddenCount > 0 ? t('list.showHiddenCount', { count: hiddenCount }) : t('list.showHidden')}
              </button>
            </div>
          </section>
        )
      ) : (
        <ul class="device-list">
          {visible.map((d) => (
            <li key={d.id}>
              <DeviceRow device={d} threshold={threshold} link={href.device(d.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface RowProps {
  device: Device;
  threshold: number;
  /** Detail link; rows without one (the native panel) are plain. */
  link?: string | undefined;
}

/**
 * One device card arranged into three cohesive zones:
 * 1) Identity (icon, name, type, live key capability chips)
 * 2) Connection & freshness status
 * 3) Battery level, charging state, and navigation chevron
 * Shared by the main device list and the compact panel.
 */
export function DeviceRow({ device, threshold, link }: RowProps) {
  const battery = findCapability(device, 'battery.level');
  const charging = findCapability(device, 'battery.charging');
  const chargingView = charging ? viewOf(charging, device.link) : null;
  const chargingText =
    chargingView?.kind === 'live' && typeof chargingView.value === 'string'
      ? variantLabel(charging!.id, chargingView.value)
      : null;

  const active = device.endpoints.find((e) => e.active) ?? device.endpoints[0];
  const isCompact = !link;
  const chips = isCompact ? [] : deviceSummaryChips(device);
  const compactStatusWords = isCompact ? liveStatus(device) : [];
  const offline = device.link !== 'connected';

  const body = (
    <>
      <div class="device-zone-identity">
        <span class={`device-icon-box${offline ? ' is-offline' : ''}`} aria-hidden="true">
          <DeviceKindIcon kind={device.kind} size={isCompact ? 18 : 22} />
        </span>
        <div class="device-identity-text">
          <div class="device-title-line">
            <span class="device-name">{displayName(device)}</span>
            {device.hidden && <span class="badge badge-neutral">{t('list.hidden')}</span>}
            {!device.driver && <span class="badge badge-warn">{t('list.noDriverBadge')}</span>}
          </div>
          <div class="device-meta-line">
            <span class="device-kind">{kindLabel(device.kind)}</span>
            {!isCompact && device.brand && <span class="device-brand">{device.brand}</span>}
            {chips.map((chip) => (
              <span
                key={chip.id}
                class={`cap-chip${chip.tone === 'ok' ? ' is-ok' : chip.tone === 'low' ? ' is-low' : ''}`}
              >
                {chip.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div class="device-zone-status">
        <div class="device-status-primary">
          <LinkLed link={device.link} pill={!isCompact} />
          {device.link === 'connected' && active && (
            <span class="transport-badge">
              <TransportIcon transport={active.transport} size={14} />
              <span>{transportLabel(active.transport)}</span>
            </span>
          )}
          {compactStatusWords.map((w) => (
            <span class="note" key={w}>
              {w}
            </span>
          ))}
        </div>
        {battery && <BatteryNote cap={battery} link={device.link} />}
      </div>

      <div class="device-zone-battery">
        {battery && (
          <div class="device-battery-block">
            <BatteryFigure
              cap={battery}
              link={device.link}
              threshold={threshold}
              size={isCompact ? 'fig-s' : 'fig-m'}
              chargingCap={charging}
            />
            {chargingText && !isCompact && <span class="battery-charging-note">{chargingText}</span>}
          </div>
        )}
        {link && (
          <span class="row-chevron" aria-hidden="true">
            <ChevronRightIcon size={18} />
          </span>
        )}
      </div>
    </>
  );

  return link ? (
    <a class={`device-card${offline ? ' is-offline' : ''}`} href={link}>
      {body}
    </a>
  ) : (
    <div class={`device-card is-plain${offline ? ' is-offline' : ''}`}>{body}</div>
  );
}
