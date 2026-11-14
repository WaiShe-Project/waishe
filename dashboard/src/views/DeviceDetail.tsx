import { useEffect, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Device, Status } from '../api/types';
import { CapabilityItem } from '../capabilities/CapabilityItem';
import { ActionStatus, Switch, useAction } from '../components/common';
import { BatteryFigure, BatteryNote, LinkLed, ReadingValue } from '../components/Value';
import { kindLabel, linkLabel, t, tMaybe, transportLabel } from '../i18n';
import { displayName, findCapability } from '../lib/reading';
import { href } from '../router';
import { upsertDevice } from '../state/store';

/** Shown on the nameplate rather than as controls. */
const PLATE_CAPABILITIES: Record<string, true> = {
  'battery.level': true,
  'battery.charging': true,
  'link.state': true,
  'device.firmware': true,
};

const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

interface Props {
  device: Device | undefined;
  status: Status | null;
  threshold: number;
}

export function DeviceDetail({ device, status, threshold }: Props) {
  if (!device) {
    return (
      <div class="page">
        <BackLink />
        <p class="empty">{t('detail.notFound')}</p>
      </div>
    );
  }
  const battery = findCapability(device, 'battery.level');
  const charging = findCapability(device, 'battery.charging');
  const firmware = findCapability(device, 'device.firmware');
  const controls = device.capabilities.filter((c) => !PLATE_CAPABILITIES[c.id]);
  const vendor = (status?.vendorSoftware ?? []).filter((v) => v.brand === device.brand).map((v) => v.name);
  // When every capability shares one verification level, say it once on the plate.
  const levels = new Set(device.capabilities.map((c) => c.verification));
  const uniform = levels.size === 1 ? device.capabilities[0]?.verification : undefined;
  const plateVerification = uniform !== undefined ? uniform : battery?.verification;

  return (
    <div class="page">
      <div class="detail-top">
        <BackLink />
        <RefreshButton id={device.id} />
      </div>
      <h1 class="detail-title">{displayName(device)}</h1>
      {vendor.length > 0 && controls.some((c) => c.access.includes('write')) && (
        <p class="notice">
          <span class="led is-low" aria-hidden="true" />
          {t('detail.vendorSoftware', { names: vendor.join(', ') })}
        </p>
      )}

      <div class="detail-grid">
        <section class="plate" aria-label={device.name}>
          {battery && (
            <div class="plate-battery">
              <BatteryFigure cap={battery} link={device.link} threshold={threshold} size="fig-l" />
              <BatteryNote cap={battery} link={device.link} />
            </div>
          )}
          <p class="plate-status">
            <LinkLed link={device.link} />
            {charging && <ReadingValue cap={charging} link={device.link} compact />}
          </p>
          {plateVerification !== 'verified' && plateVerification !== undefined && (
            <p class={`note${plateVerification === 'broken' ? ' text-fault' : ''}`}>
              {tMaybe(`verification.${plateVerification ?? 'none'}`)}
            </p>
          )}
          <dl class="spec">
            <dt>{t('detail.brand')}</dt>
            <dd>{device.brand}</dd>
            <dt>{t('detail.model')}</dt>
            <dd>
              {device.name}
              <span class="spec-sub num">{device.model}</span>
            </dd>
            <dt>{t('detail.kind')}</dt>
            <dd>{kindLabel(device.kind)}</dd>
            <dt>{t('detail.connection')}</dt>
            <dd>
              {device.endpoints.map((e, i) => (
                <span class="spec-line" key={i}>
                  {transportLabel(e.transport)}
                  <span class="num">
                    {hex(e.vendorId)}:{hex(e.productId)}
                  </span>
                  <span class="text-muted">{e.active ? t('detail.endpointActive') : linkLabel(e.link)}</span>
                </span>
              ))}
            </dd>
            {firmware && (
              <>
                <dt>{t('cap.device.firmware')}</dt>
                <dd>
                  <ReadingValue cap={firmware} link={device.link} compact />
                </dd>
              </>
            )}
            <dt>{t('detail.driver')}</dt>
            <dd>
              {device.driver ? (
                <>
                  <a href={href.drivers} class="num">
                    {device.driver.id} {device.driver.version}
                  </a>
                  {device.driver.trust === 'local' && <span class="spec-sub">{t('detail.localDriver')}</span>}
                </>
              ) : (
                t('detail.noDriver')
              )}
            </dd>
          </dl>
          <DeviceSettings device={device} />
        </section>

        <div class="controls">
          {device.link === 'disconnected' && controls.some((c) => c.access.includes('write')) && (
            <p class="notice">
              <span class="led is-hollow" aria-hidden="true" />
              {t('write.offline')}
            </p>
          )}
          {controls.length === 0 ? (
            <p class="note">{t('detail.noControls')}</p>
          ) : (
            controls.map((c) => (
              <CapabilityItem device={device} cap={c} showVerification={uniform === undefined} key={c.id} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <a class="back" href={href.devices}>
      <span aria-hidden="true">‹ </span>
      {t('detail.back')}
    </a>
  );
}

function RefreshButton({ id }: { id: string }) {
  const [state, run] = useAction();
  return (
    <div class="inline-actions">
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
        {t('detail.refresh')}
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
    <div class="plate-settings">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runAlias(async () => {
            upsertDevice(await api.patchDevice(device.id, { alias: normalized }));
            return t('common.saved');
          });
        }}
      >
        <label class="field-label" for="alias">
          {t('detail.alias')}
        </label>
        <div class="field-row-inline">
          <input
            id="alias"
            class="input"
            type="text"
            maxLength={64}
            placeholder={device.name}
            value={alias}
            disabled={aliasState.kind === 'pending'}
            onInput={(e) => setAlias(e.currentTarget.value)}
          />
          <button
            type="submit"
            class="btn"
            disabled={aliasState.kind === 'pending' || normalized === device.alias}
          >
            {t('detail.aliasSave')}
          </button>
        </div>
        <ActionStatus state={aliasState} />
      </form>
      <div>
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
