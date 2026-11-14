import { useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Driver } from '../api/types';
import { ActionStatus, Switch, useAction, useConfirm } from '../components/common';
import { t, tMaybe } from '../i18n';
import { href } from '../router';
import { removeDriver, upsertDriver } from '../state/store';

type Confirm = (message: string, action: string) => Promise<boolean>;

const LED_BY_STATUS: Record<Driver['status'], string> = { active: 'is-on', disabled: 'is-off', faulted: 'is-fault' };

export function Drivers({ drivers, developerMode }: { drivers: Driver[]; developerMode: boolean }) {
  const [dialog, confirm] = useConfirm();
  const [removed, runRemoved] = useAction();
  return (
    <div class="page page-narrow">
      <h1 class="page-title">{t('drivers.title')}</h1>
      <ActionStatus state={removed} />
      {drivers.length === 0 ? (
        <p class="empty">{t('drivers.empty')}</p>
      ) : (
        <ul class="driver-list">
          {drivers.map((d) => (
            <li key={d.id}>
              <DriverRow driver={d} confirm={confirm} onRemoved={runRemoved} />
            </li>
          ))}
        </ul>
      )}
      {developerMode ? (
        <InstallDriver />
      ) : (
        <p class="note section-gap">
          {t('drivers.install.devModeOff')} <a href={href.settings}>{t('nav.settings')}</a>
        </p>
      )}
      {dialog}
    </div>
  );
}

interface RowProps {
  driver: Driver;
  confirm: Confirm;
  onRemoved: (run: () => Promise<string | null>) => Promise<void>;
}

function DriverRow({ driver, confirm, onRemoved }: RowProps) {
  const [toggle, runToggle] = useAction();
  const [removing, setRemoving] = useState(false);
  const busy = toggle.kind === 'pending' || removing;
  return (
    <article class="driver-row" aria-labelledby={`drv-${driver.id}`}>
      <div class="driver-head">
        <h2 class="driver-name" id={`drv-${driver.id}`}>
          {driver.name}
          <span class="num driver-version">{driver.version}</span>
        </h2>
        <span class="led-label">
          <span class={`led ${LED_BY_STATUS[driver.status]}`} aria-hidden="true" />
          {tMaybe(`drivers.status.${driver.status}`) ?? driver.status}
        </span>
      </div>
      {driver.description && <p class="driver-description">{driver.description}</p>}
      {driver.fault && <p class="text-fault">{t('drivers.fault', { fault: driver.fault })}</p>}
      <dl class="spec spec-wide">
        <dt>{t('drivers.models')}</dt>
        <dd>
          {driver.models.length === 0
            ? t('common.none')
            : driver.models.map((m) => (
                <span class="spec-line" key={m.model}>
                  {m.name}
                </span>
              ))}
        </dd>
        <dt>{t('drivers.license')}</dt>
        <dd>{driver.license}</dd>
        {driver.repository && (
          <>
            <dt>{t('drivers.repository')}</dt>
            <dd>
              <a href={driver.repository} target="_blank" rel="noopener noreferrer">
                {driver.repository.replace(/^https?:\/\//, '')}
              </a>
            </dd>
          </>
        )}
        <dt>{t('drivers.trust')}</dt>
        <dd>{tMaybe(`trust.${driver.trust}`) ?? driver.trust}</dd>
      </dl>
      <div class="driver-actions">
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
        <ActionStatus state={toggle} />
        <button
          type="button"
          class="btn"
          disabled={busy}
          onClick={() =>
            void (async () => {
              const label = t('drivers.uninstall');
              if (!(await confirm(t('drivers.uninstallConfirm', { name: driver.name }), label))) return;
              setRemoving(true);
              await onRemoved(async () => {
                try {
                  await api.deleteDriver(driver.id);
                } finally {
                  setRemoving(false);
                }
                removeDriver(driver.id);
                return t('drivers.uninstalled', { name: driver.name });
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
    <section class="section-gap" aria-labelledby="install-title">
      <h2 class="section-title" id="install-title">
        {t('drivers.install.title')}
      </h2>
      <p class="notice">
        <span class="led is-low" aria-hidden="true" />
        {t('drivers.install.warning')}
      </p>
      <form
        class="field-row-inline"
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
        <label class="field-stack">
          <span class="field-label">{t('drivers.install.file')}</span>
          <input
            id="wsdrv"
            type="file"
            class="file-input"
            accept=".wsdrv"
            disabled={state.kind === 'pending'}
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" class="btn btn-primary" disabled={!file || state.kind === 'pending'}>
          {t('drivers.install.submit')}
        </button>
        <ActionStatus state={state} />
      </form>
    </section>
  );
}
