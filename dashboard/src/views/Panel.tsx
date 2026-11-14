// Compact view for Bridge's native settings window (APP-08, about 380x520):
// device status plus the settings subset; no navigation and no device configuration.

import type { Device, Settings } from '../api/types';
import { BatteryMeter, ReadingValue } from '../components/Value';
import { t } from '../i18n';
import { displayName, findCapability } from '../lib/reading';
import { LinkState } from './DeviceList';
import { AutostartField, LowBatteryFields, TrayFields } from './settingsFields';

export function Panel({ devices, settings, live }: { devices: Device[]; settings: Settings; live: boolean }) {
  const visible = devices.filter((d) => !d.hidden);
  return (
    <div class="panel">
      {!live && (
        <p class="banner banner-warn" role="status">
          {t('conn.reconnecting')}
        </p>
      )}
      <section aria-labelledby="panel-devices">
        <h2 class="panel-title" id="panel-devices">
          {t('panel.devices')}
        </h2>
        {visible.length === 0 ? (
          <p class="empty">{t('list.empty')}</p>
        ) : (
          <ul class="panel-devices">
            {visible.map((d) => (
              <PanelDevice device={d} key={d.id} />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="panel-settings" class="panel-settings">
        <h2 class="panel-title" id="panel-settings">
          {t('panel.settings')}
        </h2>
        <AutostartField settings={settings} />
        <LowBatteryFields settings={settings} />
        <TrayFields settings={settings} devices={devices} />
      </section>
    </div>
  );
}

function PanelDevice({ device }: { device: Device }) {
  const battery = findCapability(device, 'battery.level');
  const charging = findCapability(device, 'battery.charging');
  const mic = findCapability(device, 'headset.mic_mute');
  return (
    <li class={`panel-device${device.link === 'connected' ? '' : ' is-offline'}`}>
      <div class="panel-device-head">
        <span class="panel-device-name">{displayName(device)}</span>
        <LinkState device={device} />
      </div>
      {battery && <BatteryMeter cap={battery} link={device.link} compact />}
      {(charging || mic) && (
        <div class="panel-device-extra">
          {charging && <ReadingValue cap={charging} link={device.link} compact />}
          {mic && (
            <span>
              {t('panel.mic')} <ReadingValue cap={mic} link={device.link} compact />
            </span>
          )}
        </div>
      )}
    </li>
  );
}
