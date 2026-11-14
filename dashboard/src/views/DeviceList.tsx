import { useState } from 'preact/hooks';
import type { Device } from '../api/types';
import { Switch } from '../components/common';
import { BatteryMeter, ReadingValue } from '../components/Value';
import { kindLabel, linkLabel, t, transportLabel } from '../i18n';
import { displayName, findCapability, viewOf } from '../lib/reading';
import { href } from '../router';

export function DeviceList({ devices }: { devices: Device[] }) {
  const [showHidden, setShowHidden] = useState(false);
  const visible = showHidden ? devices : devices.filter((d) => !d.hidden);
  return (
    <div class="page">
      <div class="page-head">
        <h1>{t('list.title')}</h1>
        <div class="page-tools">
          <Switch checked={showHidden} onChange={setShowHidden}>
            {t('list.showHidden')}
          </Switch>
          <a class="btn" href={href.hid}>
            {t('list.allHid')}
          </a>
        </div>
      </div>
      {visible.length === 0 ? (
        <p class="empty">{devices.length === 0 ? t('list.empty') : t('list.emptyHidden')}</p>
      ) : (
        <ul class="device-grid">
          {visible.map((d) => (
            <li key={d.id}>
              <DeviceCard device={d} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LinkState({ device }: { device: Device }) {
  const active = device.endpoints.find((e) => e.active) ?? device.endpoints[0];
  return (
    <span class={`link-state is-${device.link}`}>
      <span class="dot" aria-hidden="true" />
      {linkLabel(device.link)}
      {active && device.link === 'connected' && (
        <span class="text-muted link-transport"> · {transportLabel(active.transport)}</span>
      )}
    </span>
  );
}

/** True when anything on the device is shown as a historical value. */
function hasHistorical(device: Device): boolean {
  return device.capabilities.some((c) => {
    const v = viewOf(c, device.link);
    return v.kind === 'historical' || (v.kind === 'unavailable' && v.last !== null);
  });
}

function DeviceCard({ device }: { device: Device }) {
  const battery = findCapability(device, 'battery.level');
  const charging = findCapability(device, 'battery.charging');
  return (
    <a class={`card device-card${device.link === 'connected' ? '' : ' is-offline'}`} href={href.device(device.id)}>
      <div class="device-card-head">
        <h2 class="device-name">{displayName(device)}</h2>
        <div class="badges">
          {device.hidden && <span class="tag">{t('list.hidden')}</span>}
          {hasHistorical(device) && <span class="tag tag-muted">{t('list.historical')}</span>}
        </div>
      </div>
      <p class="device-meta">
        {device.brand} · {kindLabel(device.kind)}
      </p>
      <LinkState device={device} />
      {battery && (
        <div class="device-battery">
          <BatteryMeter cap={battery} link={device.link} compact />
        </div>
      )}
      {charging && (
        <div class="device-charging">
          <ReadingValue cap={charging} link={device.link} compact />
        </div>
      )}
    </a>
  );
}
