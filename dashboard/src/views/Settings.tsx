import type { Device, Settings as SettingsShape, Status } from '../api/types';
import { useConfirm } from '../components/common';
import { CpuIcon } from '../components/icons';
import { t } from '../i18n';
import { href } from '../router';
import {
  AutostartField,
  DeveloperField,
  LanguageField,
  LowBatteryFields,
  NetworkFields,
  PollField,
  ThemeField,
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
    <div class="page page-centered">
      <header class="page-header">
        <div class="page-header-main">
          <h1 class="page-title">{t('settings.title')}</h1>
          <p class="page-subtitle">{t('settings.subtitle')}</p>
        </div>
      </header>

      <div class="settings-stack">
        <section class="settings-card" aria-labelledby="set-general">
          <div class="settings-card-head">
            <h2 class="section-title" id="set-general">
              {t('settings.general')}
            </h2>
          </div>
          <div class="settings-card-body">
            <LanguageField settings={settings} />
            <AutostartField settings={settings} />
            <ThemeField />
          </div>
        </section>

        <section class="settings-card" aria-labelledby="set-monitoring">
          <div class="settings-card-head">
            <h2 class="section-title" id="set-monitoring">
              {t('settings.monitoring')}
            </h2>
          </div>
          <div class="settings-card-body">
            <PollField settings={settings} />
            <LowBatteryFields settings={settings} />
          </div>
        </section>

        <section class="settings-card" aria-labelledby="set-tray">
          <div class="settings-card-head">
            <h2 class="section-title" id="set-tray">
              {t('settings.tray')}
            </h2>
          </div>
          <div class="settings-card-body">
            <TrayFields settings={settings} devices={devices} />
          </div>
        </section>

        <section class="settings-card" aria-labelledby="set-network">
          <div class="settings-card-head">
            <h2 class="section-title" id="set-network">
              {t('settings.network')}
            </h2>
            <p class="note">{t('settings.network.hint')}</p>
          </div>
          <div class="settings-card-body">
            <NetworkFields settings={settings} />
          </div>
        </section>

        <section class="settings-card" aria-labelledby="set-dev">
          <div class="settings-card-head">
            <h2 class="section-title" id="set-dev">
              {t('settings.developer')}
            </h2>
          </div>
          <div class="settings-card-body">
            <DeveloperField settings={settings} confirm={confirm} />
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">{t('settings.diagnostics')}</span>
                <p class="setting-desc">{t('settings.diagnosticsHint')}</p>
              </div>
              <div class="setting-control">
                <a class="btn" href={href.hid}>
                  <CpuIcon size={15} />
                  <span>{t('list.allHid')}</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {status && (
          <section class="settings-card" aria-labelledby="set-about">
            <div class="settings-card-head">
              <h2 class="section-title" id="set-about">
                {t('settings.about')}
              </h2>
            </div>
            <div class="settings-card-body">
              <dl class="tech-grid about-grid">
                <div class="tech-item">
                  <dt>{t('settings.version')}</dt>
                  <dd class="num">{status.version}</dd>
                </div>
                <div class="tech-item">
                  <dt>{t('settings.api')}</dt>
                  <dd class="num">{status.apiVersion}</dd>
                </div>
                <div class="tech-item">
                  <dt>{t('settings.abi')}</dt>
                  <dd class="num">{status.driverAbi}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}
      </div>
      {dialog}
    </div>
  );
}
