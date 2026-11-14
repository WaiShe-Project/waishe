// Compact view for Bridge's native settings window (APP-08, about 400 x 640):
// the same device rows as the list, smaller, then the settings subset. No
// navigation and no device configuration.

import type { Device, Settings } from '../api/types';
import { t } from '../i18n';
import { DeviceRow } from './DeviceList';
import { AutostartField, LowBatteryFields, TrayFields } from './settingsFields';

export function Panel({ devices, settings, live }: { devices: Device[]; settings: Settings; live: boolean }) {
  const visible = devices.filter((d) => !d.hidden);
  return (
    <main class="panel">
      {!live && (
        <p class="notice" role="status">
          <span class="led is-low" aria-hidden="true" />
          {t('conn.reconnectingHint')}
        </p>
      )}
      <section aria-labelledby="panel-devices">
        <h1 class="panel-title" id="panel-devices">
          {t('panel.devices')}
        </h1>
        {visible.length === 0 ? (
          <p class="note">{t('list.empty')}</p>
        ) : (
          <ul class="device-list">
            {visible.map((d) => (
              <li key={d.id}>
                <DeviceRow device={d} threshold={settings.lowBattery.threshold} />
              </li>
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
    </main>
  );
}
