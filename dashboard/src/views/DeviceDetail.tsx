import { useEffect, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Capability, Device, Status } from '../api/types';
import { CapabilityItem } from '../capabilities/CapabilityItem';
import { ActionStatus, RelativeTime, Switch, useAction } from '../components/common';
import { DeviceKindIcon, RefreshIcon, SettingsGearIcon, TransportIcon } from '../components/icons';
import { BatteryFigure, BatteryNote, LinkLed, ReadingValue } from '../components/Value';
import { kindLabel, linkLabel, t, tMaybe, transportLabel } from '../i18n';
import { displayName, findCapability, viewOf } from '../lib/reading';
import { href } from '../router';
import { upsertDevice } from '../state/store';

/** Shown on the top overview card or technical section rather than as capability cards. */
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
  const [manageOpen, setManageOpen] = useState(false);

  if (!device) {
    return (
      <div class="page">
        <div class="detail-top">
          <BackLink />
        </div>
        <section class="empty-state">
          <h1 class="empty-title">{t('detail.notFound')}</h1>
          <div class="empty-actions">
            <a class="btn btn-primary" href={href.devices}>
              {t('detail.back')}
            </a>
          </div>
        </section>
      </div>
    );
  }

  const battery = findCapability(device, 'battery.level');
  const charging = findCapability(device, 'battery.charging');
  const firmware = findCapability(device, 'device.firmware');
  const controls = device.capabilities.filter((c) => !PLATE_CAPABILITIES[c.id]);
  const writableControls = controls.filter((c) => c.access.includes('write'));
  const readOnlyControls = controls.filter((c) => !c.access.includes('write'));
  const activeEndpoint = device.endpoints.find((e) => e.active) ?? device.endpoints[0];
  const vendor = (status?.vendorSoftware ?? []).filter((v) => v.brand === device.brand).map((v) => v.name);
  const plateVerification = dominantVerification(device, battery);

  // Deduplicate identical onboard persistence notes when multiple writable capabilities share it.
  const onboardCount = writableControls.filter((c) => c.persistence === 'onboard').length;
  const collapseOnboard = onboardCount > 1;

  const batteryView = battery ? viewOf(battery, device.link) : null;
  const firmwareView = firmware ? viewOf(firmware, device.link) : null;
  const firmwareText =
    firmwareView && (firmwareView.kind === 'live' || firmwareView.kind === 'historical')
      ? String(firmwareView.value)
      : null;

  const techSummaryParts = [
    device.brand,
    firmwareText ? `${t('cap.device.firmware')} ${firmwareText}` : null,
    device.driver ? `${device.driver.id} ${device.driver.version}` : t('detail.noDriver'),
  ].filter(Boolean);

  return (
    <div class="page">
      <div class="detail-top">
        <BackLink />
        <div class="detail-top-actions">
          <button
            type="button"
            class="btn btn-subtle"
            aria-expanded={manageOpen}
            aria-controls="device-manage-drawer"
            onClick={() => setManageOpen((v) => !v)}
          >
            <SettingsGearIcon size={15} />
            <span>{t('detail.manage')}</span>
          </button>
          <RefreshButton id={device.id} />
        </div>
      </div>

      {/* Top device overview hero */}
      <section class="detail-hero-card" aria-label={displayName(device)}>
        <div class="hero-identity">
          <span class={`hero-icon-box${device.link !== 'connected' ? ' is-offline' : ''}`} aria-hidden="true">
            <DeviceKindIcon kind={device.kind} size={28} />
          </span>
          <div class="hero-title-group">
            <div class="hero-title-row">
              <h1 class="detail-title">{displayName(device)}</h1>
              {device.hidden && <span class="badge badge-neutral">{t('list.hidden')}</span>}
            </div>
            <div class="hero-meta">
              <span class="badge badge-neutral">{kindLabel(device.kind)}</span>
              {device.alias && device.alias.trim() !== device.name && (
                <span class="hero-model-alias">{device.name}</span>
              )}
              <LinkLed link={device.link} pill />
              {activeEndpoint && (
                <span class="transport-badge">
                  <TransportIcon transport={activeEndpoint.transport} size={14} />
                  <span>{transportLabel(activeEndpoint.transport)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {battery && (
          <div class="hero-battery-panel">
            <BatteryFigure
              cap={battery}
              link={device.link}
              threshold={threshold}
              size="fig-l"
              chargingCap={charging}
            />
            <div class="hero-battery-meta">
              {charging && <ReadingValue cap={charging} link={device.link} compact />}
              {batteryView?.kind === 'live' ? (
                <span class="note">
                  <RelativeTime iso={batteryView.observedAt} label="time.at" />
                </span>
              ) : (
                <BatteryNote cap={battery} link={device.link} />
              )}
            </div>
          </div>
        )}
      </section>

      {/* Expandable device management drawer (rename / hide) */}
      {manageOpen && (
        <section id="device-manage-drawer" class="detail-manage-drawer" aria-label={t('detail.manageTitle')}>
          <div class="drawer-header">
            <h2 class="drawer-title">{t('detail.manageTitle')}</h2>
            <button type="button" class="btn btn-subtle btn-sm" onClick={() => setManageOpen(false)}>
              {t('common.close')}
            </button>
          </div>
          <DeviceSettings device={device} />
        </section>
      )}

      {/* Contextual alerts */}
      <div class="detail-alerts">
        {!device.driver && (
          <p class="notice">
            <span class="led is-low" aria-hidden="true" />
            <span>
              {t('detail.noDriverHint')} <a href={href.drivers}>{t('list.emptyActionDrivers')}</a>
            </span>
          </p>
        )}
        {vendor.length > 0 && writableControls.length > 0 && (
          <p class="notice">
            <span class="led is-low" aria-hidden="true" />
            <span>{t('detail.vendorSoftware', { names: vendor.join(', ') })}</span>
          </p>
        )}
        {device.link === 'disconnected' && writableControls.length > 0 && (
          <p class="notice">
            <span class="led is-hollow" aria-hidden="true" />
            <span>{t('write.offline')}</span>
          </p>
        )}
      </div>

      {/* Main configuration & status sections */}
      <div class="detail-sections">
        {writableControls.length > 0 && (
          <section class="detail-section" aria-labelledby="sec-config">
            <div class="detail-section-head">
              <h2 class="detail-section-title" id="sec-config">
                {t('detail.configSection')}
              </h2>
              {collapseOnboard && <p class="note">{t('persistence.onboard')}</p>}
            </div>
            <div class={`detail-capabilities-grid${writableControls.length === 1 ? ' is-single' : ''}`}>
              {writableControls.map((c) => (
                <CapabilityItem
                  device={device}
                  cap={c}
                  showVerification={c.verification !== plateVerification}
                  showPersistence={!collapseOnboard}
                  key={`${device.id}:${c.id}`}
                />
              ))}
            </div>
          </section>
        )}

        {readOnlyControls.length > 0 && (
          <section class="detail-section" aria-labelledby="sec-status">
            <div class="detail-section-head">
              <h2 class="detail-section-title" id="sec-status">
                {t('detail.statusSection')}
              </h2>
              {writableControls.length === 0 && <p class="note">{t('detail.readOnlyHint')}</p>}
            </div>
            <div class={`detail-capabilities-grid${readOnlyControls.length === 1 ? ' is-single' : ''}`}>
              {readOnlyControls.map((c) => (
                <CapabilityItem
                  device={device}
                  cap={c}
                  showVerification={c.verification !== plateVerification}
                  key={`${device.id}:${c.id}`}
                />
              ))}
            </div>
          </section>
        )}

        {controls.length === 0 && (
          <section class="empty-state is-compact">
            <p class="note">{t('detail.noControls')}</p>
          </section>
        )}
      </div>

      {/* Collapsible technical metadata */}
      <details class="tech-section" open={controls.length === 0}>
        <summary class="tech-summary">
          <span class="tech-summary-title">{t('detail.techSection')}</span>
          <span class="tech-summary-meta">{techSummaryParts.join(' · ')}</span>
        </summary>
        <div class="tech-body">
          <dl class="tech-grid">
            <div class="tech-item">
              <dt>{t('detail.brand')}</dt>
              <dd>{device.brand}</dd>
            </div>
            <div class="tech-item">
              <dt>{t('detail.model')}</dt>
              <dd>{device.name}</dd>
            </div>
            <div class="tech-item">
              <dt>{t('detail.internalId')}</dt>
              <dd class="num">{device.model}</dd>
            </div>
            <div class="tech-item">
              <dt>{t('detail.kind')}</dt>
              <dd>{kindLabel(device.kind)}</dd>
            </div>
            {firmware && (
              <div class="tech-item">
                <dt>{t('cap.device.firmware')}</dt>
                <dd>
                  <ReadingValue cap={firmware} link={device.link} compact />
                </dd>
              </div>
            )}
            <div class="tech-item">
              <dt>{t('detail.driver')}</dt>
              <dd>
                {device.driver ? (
                  <span class="tech-inline">
                    <a href={href.drivers} class="num">
                      {device.driver.id} {device.driver.version}
                    </a>
                    <span class="badge badge-neutral">
                      {tMaybe(`drivers.trustBadge.${device.driver.trust}`) ?? device.driver.trust}
                    </span>
                  </span>
                ) : (
                  t('detail.noDriver')
                )}
              </dd>
            </div>
            <div class="tech-item is-wide">
              <dt>{t('detail.vidPid')}</dt>
              <dd class="tech-endpoints">
                {device.endpoints.map((e, i) => (
                  <span class="spec-line" key={i}>
                    <span>{transportLabel(e.transport)}</span>
                    <span class="num">
                      {hex(e.vendorId)}:{hex(e.productId)}
                    </span>
                    <span class="text-muted">{e.active ? t('detail.endpointActive') : linkLabel(e.link)}</span>
                  </span>
                ))}
              </dd>
            </div>
            {plateVerification !== undefined && (
              <div class="tech-item is-wide">
                <dt>{t('detail.verification')}</dt>
                <dd class={plateVerification === 'broken' ? 'text-fault' : undefined}>
                  {tMaybe(`verification.${plateVerification ?? 'none'}`) ?? plateVerification}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </details>
    </div>
  );
}

function dominantVerification(device: Device, battery: Capability | undefined): Capability['verification'] | undefined {
  const counts = new Map<Capability['verification'], number>();
  for (const c of device.capabilities) counts.set(c.verification, (counts.get(c.verification) ?? 0) + 1);
  let best: Capability['verification'] | undefined = battery?.verification;
  let bestCount = best === undefined ? 0 : (counts.get(best) ?? 0);
  for (const [level, n] of counts) {
    if (n > bestCount) [best, bestCount] = [level, n];
  }
  return best;
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
        <RefreshIcon size={15} />
        <span>{t('detail.refresh')}</span>
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
    <div class="manage-grid">
      <form
        class="manage-alias-form"
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
        <div class="manage-alias-row">
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
            class="btn btn-primary"
            disabled={aliasState.kind === 'pending' || normalized === device.alias}
          >
            {t('detail.aliasSave')}
          </button>
          <ActionStatus state={aliasState} />
        </div>
      </form>
      <div class="manage-hide-row">
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
