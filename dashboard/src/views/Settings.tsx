import type { Device, Settings as SettingsShape, Status } from '../api/types';
import { useConfirm } from '../components/common';
import { t } from '../i18n';
import {
  AutostartField,
  DeveloperField,
  LanguageField,
  LowBatteryFields,
  NetworkFields,
  PollField,
  TrayFields,
} from './settingsFields';

interface Props {
  settings: SettingsShape;
  devices: Device[];
  status: Status | null;
}

export function Settings({ settings, devices, status }: Props) {
  const [dialog, confirm] = useConfirm();
  return (
    <div class="page page-narrow">
      <div class="page-head">
        <h1>{t('settings.title')}</h1>
      </div>
      <section class="section card">
        <h2>{t('settings.general')}</h2>
        <LanguageField settings={settings} />
        <AutostartField settings={settings} />
        <PollField settings={settings} />
      </section>
      <section class="section card">
        <h2>{t('settings.tray')}</h2>
        <TrayFields settings={settings} devices={devices} />
      </section>
      <section class="section card">
        <h2>{t('settings.lowBattery')}</h2>
        <LowBatteryFields settings={settings} />
      </section>
      <section class="section card">
        <h2>{t('settings.network')}</h2>
        <NetworkFields settings={settings} />
      </section>
      <section class="section card">
        <h2>{t('settings.developer')}</h2>
        <DeveloperField settings={settings} confirm={confirm} />
      </section>
      {status && (
        <section class="section">
          <h2>{t('settings.about')}</h2>
          <p class="text-muted">
            {t('settings.version', { version: status.version, api: status.apiVersion, abi: status.driverAbi })}
          </p>
        </section>
      )}
      {dialog}
    </div>
  );
}
