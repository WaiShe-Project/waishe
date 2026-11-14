import { useState } from 'preact/hooks';
import type { Device } from '../api/types';
import { Switch } from '../components/common';
import { BatteryFigure, BatteryNote, LinkLed, liveStatus } from '../components/Value';
import { kindLabel, t, transportLabel } from '../i18n';
import { displayName, findCapability } from '../lib/reading';
import { href } from '../router';

export function DeviceList({ devices, threshold }: { devices: Device[]; threshold: number }) {
  const [showHidden, setShowHidden] = useState(false);
  const visible = showHidden ? devices : devices.filter((d) => !d.hidden);
  return (
    <div class="page">
      <h1 class="sr-only">{t('list.title')}</h1>
      {visible.length === 0 ? (
        <p class="empty">{devices.length === 0 ? t('list.empty') : t('list.emptyHidden')}</p>
      ) : (
        <ul class="device-list">
          {visible.map((d) => (
            <li key={d.id}>
              <DeviceRow device={d} threshold={threshold} link={href.device(d.id)} />
            </li>
          ))}
        </ul>
      )}
      <div class="list-footer">
        <Switch checked={showHidden} onChange={setShowHidden}>
          {t('list.showHidden')}
        </Switch>
        <a href={href.hid}>{t('list.allHid')}</a>
      </div>
    </div>
  );
}

interface RowProps {
  device: Device;
  threshold: number;
  /** Detail link; rows without one (the native panel) are plain. */
  link?: string;
}

/**
 * One device: battery numeral in a fixed column, name and kind, then the status
 * words. Shared by the device list and the compact panel.
 */
export function DeviceRow({ device, threshold, link }: RowProps) {
  const battery = findCapability(device, 'battery.level');
  const active = device.endpoints.find((e) => e.active) ?? device.endpoints[0];
  const words = liveStatus(device);
  const body = (
    <>
      <span class="row-figure">
        {battery && <BatteryFigure cap={battery} link={device.link} threshold={threshold} size={link ? 'fig-m' : 'fig-s'} />}
      </span>
      <span class="row-name">
        <span class="device-name">{displayName(device)}</span>
        <span class="row-kind">
          {kindLabel(device.kind)}
          {device.hidden && <span class="row-flag">{t('list.hidden')}</span>}
        </span>
      </span>
      <span class="row-status">
        <LinkLed link={device.link} />
        {device.link === 'connected' && active && <span>{transportLabel(active.transport)}</span>}
        {words.map((w) => (
          <span key={w}>{w}</span>
        ))}
        {battery && <BatteryNote cap={battery} link={device.link} />}
      </span>
    </>
  );
  return link ? (
    <a class={`device-row${device.link === 'connected' ? '' : ' is-offline'}`} href={link}>
      {body}
      <span class="row-chevron" aria-hidden="true">
        ›
      </span>
    </a>
  ) : (
    <div class={`device-row is-plain${device.link === 'connected' ? '' : ' is-offline'}`}>{body}</div>
  );
}
