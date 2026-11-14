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
      <h1 class="page-title">{t('settings.title')}</h1>
      <section class="settings-group" aria-labelledby="set-general">
        <h2 class="section-title" id="set-general">
          {t('settings.general')}
        </h2>
        <LanguageField settings={settings} />
        <AutostartField settings={settings} />
        <PollField settings={settings} />
      </section>
      <section class="settings-group" aria-labelledby="set-low">
        <h2 class="section-title" id="set-low">
          {t('settings.lowBattery')}
        </h2>
        <LowBatteryFields settings={settings} />
      </section>
      <section class="settings-group" aria-labelledby="set-tray">
        <h2 class="section-title" id="set-tray">
          {t('settings.tray')}
        </h2>
        <TrayFields settings={settings} devices={devices} />
      </section>
      <section class="settings-group" aria-labelledby="set-network">
        <h2 class="section-title" id="set-network">
          {t('settings.network')}
        </h2>
        <NetworkFields settings={settings} />
      </section>
      <section class="settings-group" aria-labelledby="set-dev">
        <h2 class="section-title" id="set-dev">
          {t('settings.developer')}
        </h2>
        <DeveloperField settings={settings} confirm={confirm} />
      </section>
      {status && (
        <section class="settings-group" aria-labelledby="set-about">
          <h2 class="section-title" id="set-about">
            {t('settings.about')}
          </h2>
          <dl class="spec">
            <dt>{t('settings.version')}</dt>
            <dd class="num">{status.version}</dd>
            <dt>{t('settings.api')}</dt>
            <dd class="num">{status.apiVersion}</dd>
            <dt>{t('settings.abi')}</dt>
            <dd class="num">{status.driverAbi}</dd>
          </dl>
        </section>
      )}
      {dialog}
    </div>
  );
}
