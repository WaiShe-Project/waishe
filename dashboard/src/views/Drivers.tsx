import { useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Driver } from '../api/types';
import { ActionStatus, Switch, useAction, useConfirm } from '../components/common';
import { t, tMaybe } from '../i18n';
import { href } from '../router';
import { removeDriver, upsertDriver } from '../state/store';

export function Drivers({ drivers, developerMode }: { drivers: Driver[]; developerMode: boolean }) {
  const [dialog, confirm] = useConfirm();
  return (
    <div class="page">
      <div class="page-head">
        <h1>{t('drivers.title')}</h1>
      </div>
      {drivers.length === 0 ? (
        <p class="empty">{t('drivers.empty')}</p>
      ) : (
        <ul class="driver-list">
          {drivers.map((d) => (
            <li key={d.id}>
              <DriverCard driver={d} confirm={confirm} />
            </li>
          ))}
        </ul>
      )}
      {developerMode ? (
        <InstallDriver />
      ) : (
        <p class="hint">
          {t('drivers.install.devModeOff')} <a href={href.settings}>{t('nav.settings')}</a>
        </p>
      )}
      {dialog}
    </div>
  );
}

function faultText(fault: Driver['fault']): string | null {
  if (fault === null || fault === undefined) return null;
  if (typeof fault === 'string') return fault;
  return fault.message ?? fault.code ?? JSON.stringify(fault);
}

function DriverCard({ driver, confirm }: { driver: Driver; confirm: (message: string) => Promise<boolean> }) {
  const [toggle, runToggle] = useAction();
  const [remove, runRemove] = useAction();
  const busy = toggle.kind === 'pending' || remove.kind === 'pending';
  const fault = faultText(driver.fault);
  return (
    <article class={`card driver-card is-${driver.status}`} aria-labelledby={`drv-${driver.id}`}>
      <div class="device-card-head">
        <h2 class="device-name" id={`drv-${driver.id}`}>
          {driver.name} <span class="text-muted mono">{driver.id}</span>
        </h2>
        <div class="badges">
          <span class={`badge badge-trust is-${driver.trust}`}>{tMaybe(`trust.${driver.trust}`) ?? driver.trust}</span>
          <span class={`badge badge-status is-${driver.status}`}>
            {tMaybe(`drivers.status.${driver.status}`) ?? driver.status}
          </span>
        </div>
      </div>
      {driver.description && <p>{driver.description}</p>}
      {fault && <p class="notice notice-danger">{t('drivers.fault', { fault })}</p>}
      <dl class="facts">
        <dt>{t('drivers.version')}</dt>
        <dd class="mono">{driver.version}</dd>
        <dt>{t('drivers.api')}</dt>
        <dd class="mono">{driver.api}</dd>
        <dt>{t('drivers.license')}</dt>
        <dd class="mono">{driver.license}</dd>
        {driver.repository && (
          <>
            <dt>{t('drivers.repository')}</dt>
            <dd>
              <a href={driver.repository} target="_blank" rel="noopener noreferrer">
                {driver.repository}
              </a>
            </dd>
          </>
        )}
        <dt>{t('drivers.models')}</dt>
        <dd>
          {driver.models.length === 0 ? (
            t('common.none')
          ) : (
            <ul class="plain-list">
              {driver.models.map((m) => (
                <li key={m.model}>
                  {m.name} <span class="text-muted mono">({m.model})</span>
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
      <div class="card-actions">
        <Switch
          checked={driver.enabled}
          disabled={busy}
          busy={toggle.kind === 'pending'}
          onChange={(enabled) =>
            void runToggle(async () => {
              upsertDriver(await api.patchDriver(driver.id, enabled));
              return null;
            })
          }
        >
          {t('drivers.enabled')}
        </Switch>
        <ActionStatus state={toggle.kind === 'pending' || toggle.kind === 'error' ? toggle : remove} />
        <button
          type="button"
          class="btn btn-danger"
          disabled={busy}
          onClick={() =>
            void (async () => {
              if (!(await confirm(t('drivers.uninstallConfirm', { name: driver.name })))) return;
              await runRemove(async () => {
                await api.deleteDriver(driver.id);
                removeDriver(driver.id);
                return null;
              });
            })()
          }
        >
          {t('drivers.uninstall')}
        </button>
      </div>
    </article>
  );
}

function InstallDriver() {
  const [file, setFile] = useState<File | null>(null);
  const [state, run] = useAction();
  return (
    <section class="section card install-card" aria-labelledby="install-title">
      <h2 id="install-title">{t('drivers.install.title')}</h2>
      <p class="notice notice-warn">{t('drivers.install.warning')}</p>
      <form
        class="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!file) return;
          const form = e.currentTarget;
          void run(async () => {
            const driver = await api.installDriver(file);
            upsertDriver(driver);
            form.reset();
            setFile(null);
            return t('drivers.install.done', { name: driver.name });
          });
        }}
      >
        <label for="wsdrv">{t('drivers.install.file')}</label>
        <input
          id="wsdrv"
          type="file"
          accept=".wsdrv"
          disabled={state.kind === 'pending'}
          onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
        />
        <button type="submit" class="btn btn-primary" disabled={!file || state.kind === 'pending'}>
          {t('drivers.install.submit')}
        </button>
        <ActionStatus state={state} />
      </form>
    </section>
  );
}
