import { useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Device, Driver } from '../api/types';
import { ActionStatus, Switch, useAction, useConfirm } from '../components/common';
import { AlertIcon, PlusIcon, TrashIcon } from '../components/icons';
import { t, tMaybe } from '../i18n';
import { displayName } from '../lib/reading';
import { href } from '../router';
import { removeDriver, upsertDriver } from '../state/store';

type Confirm = (message: string, action: string, danger?: boolean) => Promise<boolean>;

const LED_BY_STATUS: Record<Driver['status'], string> = {
  active: 'is-on',
  disabled: 'is-off',
  faulted: 'is-fault',
};

const PILL_BY_STATUS: Record<Driver['status'], string> = {
  active: 'is-ok',
  disabled: 'is-off',
  faulted: 'is-fault',
};

export function Drivers({
  drivers,
  devices,
  developerMode,
}: {
  drivers: Driver[];
  devices: Device[];
  developerMode: boolean;
}) {
  const [dialog, confirm] = useConfirm();
  const [removed, runRemoved] = useAction();
  const [installOpen, setInstallOpen] = useState(false);
  const showInstall = installOpen || drivers.length === 0;

  return (
    <div class="page page-centered">
      <header class="page-header">
        <div class="page-header-main">
          <h1 class="page-title">{t('drivers.title')}</h1>
          <p class="page-subtitle">{t('drivers.subtitle')}</p>
        </div>
        <div class="page-toolbar">
          <button
            type="button"
            class={`btn ${showInstall ? 'btn-subtle' : 'btn-primary'}`}
            aria-expanded={showInstall}
            onClick={() => setInstallOpen((v) => !v)}
          >
            {!showInstall && <PlusIcon size={15} />}
            <span>{showInstall ? t('common.close') : t('drivers.installBtn')}</span>
          </button>
        </div>
      </header>

      {removed.kind !== 'idle' && (
        <div class="driver-banner-status">
          <ActionStatus state={removed} />
        </div>
      )}

      {showInstall && (
        <InstallDriverCard
          developerMode={developerMode}
          onInstalled={() => setInstallOpen(false)}
        />
      )}

      {drivers.length === 0 ? (
        <section class="empty-state is-compact">
          <h2 class="empty-title">{t('drivers.empty')}</h2>
          <p class="empty-body">{t('drivers.catalogNote')}</p>
        </section>
      ) : (
        <ul class="driver-list">
          {drivers.map((d) => {
            const usedBy = devices.filter((dev) => dev.driver?.id === d.id);
            return (
              <li key={d.id}>
                <DriverCard driver={d} usedBy={usedBy} confirm={confirm} onRemoved={runRemoved} />
              </li>
            );
          })}
        </ul>
      )}
      {dialog}
    </div>
  );
}

interface RowProps {
  driver: Driver;
  usedBy: Device[];
  confirm: Confirm;
  onRemoved: (run: () => Promise<string | null>) => Promise<void>;
}

function DriverCard({ driver, usedBy, confirm, onRemoved }: RowProps) {
  const [toggle, runToggle] = useAction();
  const [removing, setRemoving] = useState(false);
  const busy = toggle.kind === 'pending' || removing;
  const isUnverified = driver.trust === 'local';

  return (
    <article class="driver-card" aria-labelledby={`drv-${driver.id}`}>
      <div class="driver-card-main">
        <div class="driver-info">
          <div class="driver-head">
            <h2 class="driver-name" id={`drv-${driver.id}`}>
              {driver.name}
            </h2>
            <span class="badge badge-neutral num">v{driver.version}</span>
            <span class={`status-pill ${PILL_BY_STATUS[driver.status]}`}>
              <span class={`led ${LED_BY_STATUS[driver.status]}`} aria-hidden="true" />
              <span>{tMaybe(`drivers.status.${driver.status}`) ?? driver.status}</span>
            </span>
            <span class="badge badge-neutral">
              {tMaybe(`drivers.trustBadge.${driver.trust}`) ?? driver.trust}
            </span>
            <span class={`badge ${isUnverified ? 'badge-warn' : 'badge-ok'}`}>
              {t(isUnverified ? 'drivers.verifyBadge.unverified' : 'drivers.verifyBadge.verified')}
            </span>
          </div>

          <div class="driver-summary">
            <span class="driver-models-count">
              {t('drivers.supportedCount', { count: driver.models.length })}
            </span>
            {driver.models.length > 0 && (
              <span class="driver-models-inline">
                {driver.models.map((m) => (
                  <span class="model-chip" key={m.model}>
                    {m.name}
                  </span>
                ))}
              </span>
            )}
          </div>

          <p class={`driver-usage ${usedBy.length > 0 ? '' : 'note'}`}>
            {usedBy.length > 0
              ? t('drivers.inUseBy', { names: usedBy.map(displayName).join(', ') })
              : t('drivers.notInUse')}
          </p>

          {driver.fault && (
            <p class="notice is-fault driver-fault">
              <AlertIcon size={15} />
              <span>{t('drivers.fault', { fault: driver.fault })}</span>
            </p>
          )}
        </div>

        <div class="driver-primary-action">
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
        </div>
      </div>

      <details class="driver-details">
        <summary class="driver-details-summary">{t('drivers.detailsToggle')}</summary>
        <div class="driver-details-body">
          {driver.description && <p class="driver-description">{driver.description}</p>}
          <dl class="tech-grid">
            <div class="tech-item">
              <dt>{t('drivers.trust')}</dt>
              <dd>{tMaybe(`trust.${driver.trust}`) ?? driver.trust}</dd>
            </div>
            <div class="tech-item">
              <dt>{t('drivers.license')}</dt>
              <dd>{driver.license}</dd>
            </div>
            <div class="tech-item">
              <dt>{t('drivers.apiVersion')}</dt>
              <dd class="num">{driver.api}</dd>
            </div>
            {driver.repository && (
              <div class="tech-item is-wide">
                <dt>{t('drivers.repository')}</dt>
                <dd>
                  <a href={driver.repository} target="_blank" rel="noopener noreferrer">
                    {driver.repository.replace(/^https?:\/\//, '')}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <div class="driver-danger-row">
            <span class="note">{t('drivers.disableHint')}</span>
            <button
              type="button"
              class="btn btn-danger"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  const label = t('drivers.uninstall');
                  const msg =
                    usedBy.length > 0
                      ? t('drivers.uninstallConfirmUsed', {
                          name: driver.name,
                          devices: usedBy.map(displayName).join(', '),
                        })
                      : t('drivers.uninstallConfirm', { name: driver.name });
                  if (!(await confirm(msg, label, true))) return;
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
              <TrashIcon size={14} />
              <span>{t('drivers.uninstall')}</span>
            </button>
          </div>
        </div>
      </details>
    </article>
  );
}

function InstallDriverCard({
  developerMode,
  onInstalled,
}: {
  developerMode: boolean;
  onInstalled: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [state, run] = useAction();

  return (
    <section class="surface-card install-card" aria-labelledby="install-title">
      <div class="install-card-head">
        <h2 class="section-title" id="install-title">
          {t('drivers.install.title')}
        </h2>
        <p class="note">{t('drivers.catalogNote')}</p>
      </div>

      {!developerMode ? (
        <p class="notice">
          <span class="led is-low" aria-hidden="true" />
          <span>
            {t('drivers.install.devModeOff')} <a href={href.settings}>{t('nav.settings')}</a>
          </span>
        </p>
      ) : (
        <>
          <p class="notice">
            <span class="led is-low" aria-hidden="true" />
            <span>{t('drivers.install.warning')}</span>
          </p>
          <form
            class="install-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!file) return;
              const form = e.currentTarget;
              void run(async () => {
                const driver = await api.installDriver(file);
                upsertDriver(driver);
                form.reset();
                setFile(null);
                onInstalled();
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
            <div class="install-submit-row">
              <button type="submit" class="btn btn-primary" disabled={!file || state.kind === 'pending'}>
                {t('drivers.install.submit')}
              </button>
              <ActionStatus state={state} />
            </div>
          </form>
        </>
      )}
    </section>
  );
}
