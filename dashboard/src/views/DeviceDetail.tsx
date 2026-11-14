import { useEffect, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Device, Status } from '../api/types';
import { CapabilityItem } from '../capabilities/CapabilityItem';
import { ActionStatus, Switch, useAction } from '../components/common';
import { kindLabel, linkLabel, t, transportLabel } from '../i18n';
import { displayName } from '../lib/reading';
import { href } from '../router';
import { upsertDevice } from '../state/store';
import { LinkState } from './DeviceList';

const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

export function DeviceDetail({ device, status }: { device: Device | undefined; status: Status | null }) {
  if (!device) {
    return (
      <div class="page">
        <p>
          <a href={href.devices}>{t('common.back')}</a>
        </p>
        <p class="empty">{t('detail.notFound')}</p>
      </div>
    );
  }
  const readOnly = device.capabilities.filter((c) => !c.access.includes('write'));
  const writable = device.capabilities.filter((c) => c.access.includes('write'));
  const vendor = status?.vendorSoftware ?? [];
  return (
    <div class="page">
      <p>
        <a href={href.devices}>{t('common.back')}</a>
      </p>
      <div class="page-head">
        <div>
          <h1>{displayName(device)}</h1>
          <p class="device-meta">
            {device.brand} · {kindLabel(device.kind)} · <LinkState device={device} />
          </p>
        </div>
        <RefreshButton id={device.id} />
      </div>

      {vendor.length > 0 && writable.length > 0 && (
        <p class="notice notice-warn">{t('detail.vendorSoftware', { names: vendor.join(', ') })}</p>
      )}

      {device.capabilities.length === 0 && <p class="empty">{t('detail.noCapabilities')}</p>}

      {readOnly.length > 0 && (
        <section class="section">
          <h2>{t('detail.status')}</h2>
          <div class="cap-grid">
            {readOnly.map((c) => (
              <CapabilityItem device={device} cap={c} key={c.id} />
            ))}
          </div>
        </section>
      )}

      {writable.length > 0 && (
        <section class="section">
          <h2>{t('detail.config')}</h2>
          <div class="cap-list">
            {writable.map((c) => (
              <CapabilityItem device={device} cap={c} key={c.id} />
            ))}
          </div>
        </section>
      )}

      <section class="section">
        <h2>{t('detail.info')}</h2>
        <DeviceSettings device={device} />
        <dl class="facts">
          <dt>{t('detail.brand')}</dt>
          <dd>{device.brand}</dd>
          <dt>{t('detail.model')}</dt>
          <dd>
            {device.name} <span class="text-muted mono">({device.model})</span>
          </dd>
          <dt>{t('detail.kind')}</dt>
          <dd>{kindLabel(device.kind)}</dd>
          <dt>{t('detail.driver')}</dt>
          <dd>
            {device.driver ? (
              <>
                <a href={href.drivers}>{device.driver.id}</a> {device.driver.version} ·{' '}
                {t(`trust.${device.driver.trust}`)}
              </>
            ) : (
              t('detail.noDriver')
            )}
          </dd>
          <dt>{t('detail.endpoints')}</dt>
          <dd>
            <ul class="plain-list">
              {device.endpoints.map((e, i) => (
                <li key={i}>
                  {transportLabel(e.transport)}{' '}
                  <span class="mono text-muted">
                    {hex(e.vendorId)}:{hex(e.productId)}
                  </span>{' '}
                  · {linkLabel(e.link)}
                  {e.active && <span class="tag">{t('detail.endpointActive')}</span>}
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      </section>
    </div>
  );
}

function RefreshButton({ id }: { id: string }) {
  const [state, run] = useAction();
  return (
    <div class="page-tools">
      <ActionStatus state={state} />
      <button
        type="button"
        class="btn"
        disabled={state.kind === 'pending'}
        onClick={() =>
          void run(async () => {
            await api.refreshDevice(id);
            return t('detail.refreshRequested');
          })
        }
      >
        {state.kind === 'pending' ? t('detail.refreshing') : t('detail.refresh')}
      </button>
    </div>
  );
}

/** Alias and hidden flag (`PATCH /devices/{id}`); the store updates from the response, not before. */
function DeviceSettings({ device }: { device: Device }) {
  const [alias, setAlias] = useState(device.alias ?? '');
  useEffect(() => setAlias(device.alias ?? ''), [device.alias]);
  const [aliasState, runAlias] = useAction();
  const [hideState, runHide] = useAction();
  const normalized = alias.trim() === '' ? null : alias.trim();
  return (
    <div class="device-settings">
      <form
        class="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          void runAlias(async () => {
            upsertDevice(await api.patchDevice(device.id, { alias: normalized }));
            return t('common.saved');
          });
        }}
      >
        <label for="alias">{t('detail.alias')}</label>
        <input
          id="alias"
          class="input"
          type="text"
          maxLength={64}
          placeholder={t('detail.aliasPlaceholder')}
          value={alias}
          disabled={aliasState.kind === 'pending'}
          onInput={(e) => setAlias(e.currentTarget.value)}
        />
        <button
          type="submit"
          class="btn btn-primary"
          disabled={aliasState.kind === 'pending' || normalized === device.alias}
        >
          {t('common.save')}
        </button>
        <ActionStatus state={aliasState} />
      </form>
      <div class="inline-form">
        <Switch
          checked={device.hidden}
          disabled={hideState.kind === 'pending'}
          busy={hideState.kind === 'pending'}
          onChange={(hidden) =>
            void runHide(async () => {
              upsertDevice(await api.patchDevice(device.id, { hidden }));
              return t('common.saved');
            })
          }
        >
          {t('detail.hide')}
        </Switch>
        <ActionStatus state={hideState} />
      </div>
    </div>
  );
}
