// Settings controls shared by the Settings page and the compact panel.
// Each change sends only the changed fields; the form shows Bridge's answer, not the input.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Device, Settings, SettingsPatch, TrayStyle } from '../api/types';
import { ActionStatus, Switch, useAction, type ActionState } from '../components/common';
import { t } from '../i18n';
import { displayName, findCapability, viewOf } from '../lib/reading';
import { useTheme, type ThemePreference } from '../lib/theme';
import { setSettings } from '../state/store';

/** Same limits as Bridge's settings validation; a 422 `invalid_settings` is still shown if they ever drift. */
const LIMITS = {
  threshold: { min: 5, max: 95 },
  intervalMinutes: { min: 1, max: 1440 },
  pollIntervalSeconds: { min: 30, max: 3600 },
};

function usePatch(): [ActionState, (patch: SettingsPatch) => void] {
  const [state, run] = useAction();
  const patch = (p: SettingsPatch) =>
    void run(async () => {
      setSettings(await api.patchSettings(p));
      return t('common.saved');
    });
  return [state, patch];
}

/** Standard two-column aligned setting row: label + description on left, control on right. */
function SettingRow({
  label,
  htmlFor,
  description,
  status,
  disabled = false,
  children,
}: {
  label: string;
  htmlFor?: string | undefined;
  description?: string | undefined;
  status?: ActionState | undefined;
  disabled?: boolean | undefined;
  children: ComponentChildren;
}) {
  return (
    <div class={`setting-row${disabled ? ' is-disabled' : ''}`}>
      <div class="setting-info">
        {htmlFor ? (
          <label class="setting-label" for={htmlFor}>
            {label}
          </label>
        ) : (
          <span class="setting-label">{label}</span>
        )}
        {description && <p class="setting-desc">{description}</p>}
        {status && status.kind !== 'idle' && (
          <div class="setting-status">
            <ActionStatus state={status} />
          </div>
        )}
      </div>
      <div class="setting-control">{children}</div>
    </div>
  );
}

interface NumberInputProps {
  id: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}

/** Integer input that commits on change (blur or Enter) after validation. */
function NumberInput({ id, unit, value, min, max, disabled, onCommit }: NumberInputProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const n = draft.trim() === '' ? Number.NaN : Number(draft);
  const error = !Number.isInteger(n)
    ? t('validate.integer')
    : n < min || n > max
      ? t('validate.range', { min, max })
      : null;
  return (
    <div class="number-control">
      <span class="input-with-unit">
        <input
          id={id}
          class="input input-number num"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={draft}
          disabled={disabled}
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-error` : undefined}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onChange={() => {
            if (error === null && n !== value) onCommit(n);
          }}
        />
        <span class="unit">{unit}</span>
      </span>
      {error && (
        <span class="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

export function LanguageField({ settings }: { settings: Settings }) {
  const [state, patch] = usePatch();
  return (
    <SettingRow
      label={t('settings.language')}
      htmlFor="language"
      description={t('settings.languageHint')}
      status={state}
    >
      <select
        id="language"
        class="input"
        value={settings.language}
        disabled={state.kind === 'pending'}
        onChange={(e) => {
          const language = e.currentTarget.value === 'en' ? 'en' : 'zh-CN';
          e.currentTarget.value = settings.language;
          patch({ language });
        }}
      >
        <option value="zh-CN" lang="zh-CN">
          简体中文
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
    </SettingRow>
  );
}

export function AutostartField({ settings, compact = false }: { settings: Settings; compact?: boolean }) {
  const [state, patch] = usePatch();
  return (
    <SettingRow
      label={t('settings.autostart')}
      description={compact ? undefined : t('settings.autostartHint')}
      status={state}
    >
      <Switch
        checked={settings.autostart}
        disabled={state.kind === 'pending'}
        onChange={(autostart) => patch({ autostart })}
      />
    </SettingRow>
  );
}

const THEMES: Array<[ThemePreference, 'settings.theme.system' | 'settings.theme.dark' | 'settings.theme.light']> = [
  ['system', 'settings.theme.system'],
  ['dark', 'settings.theme.dark'],
  ['light', 'settings.theme.light'],
];

export function ThemeField({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useTheme();
  return (
    <SettingRow label={t('settings.theme')} description={compact ? undefined : t('settings.themeHint')}>
      <div class="segmented" role="group" aria-label={t('settings.theme')}>
        {THEMES.map(([value, key]) => (
          <button
            type="button"
            key={value}
            class="key"
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
          >
            {t(key)}
          </button>
        ))}
      </div>
    </SettingRow>
  );
}

export function PollField({ settings }: { settings: Settings }) {
  const [state, patch] = usePatch();
  return (
    <SettingRow
      label={t('settings.poll')}
      htmlFor="poll"
      description={t('settings.pollRangeHint')}
      status={state}
    >
      <NumberInput
        id="poll"
        unit={t('unit.seconds')}
        value={settings.pollIntervalSeconds}
        {...LIMITS.pollIntervalSeconds}
        disabled={state.kind === 'pending'}
        onCommit={(pollIntervalSeconds) => patch({ pollIntervalSeconds })}
      />
    </SettingRow>
  );
}

export function LowBatteryFields({ settings, compact = false }: { settings: Settings; compact?: boolean }) {
  const [state, patch] = usePatch();
  const lb = settings.lowBattery;
  const pending = state.kind === 'pending';
  const subDisabled = pending || !lb.enabled;

  return (
    <div class="setting-group-rows">
      <SettingRow
        label={t('settings.lowBattery.enabled')}
        description={compact ? undefined : t('settings.lowBattery.enabledHint')}
        status={state}
      >
        <Switch checked={lb.enabled} disabled={pending} onChange={(enabled) => patch({ lowBattery: { enabled } })} />
      </SettingRow>
      <SettingRow
        label={t('settings.lowBattery.threshold')}
        htmlFor="lb-threshold"
        description={compact ? undefined : t('settings.lowBattery.thresholdHint')}
        disabled={!lb.enabled}
      >
        <NumberInput
          id="lb-threshold"
          unit={t('unit.percent')}
          value={lb.threshold}
          {...LIMITS.threshold}
          disabled={subDisabled}
          onCommit={(threshold) => patch({ lowBattery: { threshold } })}
        />
      </SettingRow>
      <SettingRow
        label={t('settings.lowBattery.interval')}
        htmlFor="lb-interval"
        description={compact ? undefined : t('settings.lowBattery.intervalHint')}
        disabled={!lb.enabled}
      >
        <NumberInput
          id="lb-interval"
          unit={t('unit.minutes')}
          value={lb.intervalMinutes}
          {...LIMITS.intervalMinutes}
          disabled={subDisabled}
          onCommit={(intervalMinutes) => patch({ lowBattery: { intervalMinutes } })}
        />
      </SettingRow>
    </div>
  );
}

type TrayVisualStateKind = 'normal' | 'low' | 'critical' | 'charging' | 'disconnected' | 'unknown';

function batteryTier(percent: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (percent <= 0) return 0;
  if (percent <= 20) return 1;
  if (percent <= 40) return 2;
  if (percent <= 60) return 3;
  if (percent <= 80) return 4;
  return 5;
}

function stateStrokeColor(state: TrayVisualStateKind): string {
  switch (state) {
    case 'charging':
      return '#34d399';
    case 'low':
      return '#f5b544';
    case 'critical':
      return '#f87171';
    case 'disconnected':
    case 'unknown':
      return '#858b95';
    default:
      return '#e5e7eb';
  }
}

function TrayGlyphPreview({
  style,
  state,
  tier = 5,
  size = 22,
}: {
  style: TrayStyle;
  state: TrayVisualStateKind;
  tier?: number;
  size?: number;
}) {
  const color = stateStrokeColor(state);
  const clampedTier = Math.max(0, Math.min(5, Math.round(tier)));
  const fillWidth = clampedTier === 0 ? 0 : Math.max(2, Math.round((clampedTier / 5) * 8));

  return (
    <span class="tray-preview-glyph" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        {style === 'brand' ? (
          <>
            <polyline
              points="2.3,3.7 5.4,12.3 8.0,7.0 10.6,12.3 13.7,3.7"
              stroke={color}
              stroke-width="2.1"
              stroke-linecap="round"
              stroke-linejoin="round"
              opacity={state === 'disconnected' ? 0.8 : 1}
            />
            {(state === 'charging' || state === 'low' || state === 'critical') && (
              <>
                <circle cx="13" cy="12.5" r="2.7" fill="#181b20" />
                <circle cx="13" cy="12.5" r="2" fill={color} />
              </>
            )}
            {state === 'disconnected' && (
              <>
                <circle cx="13" cy="12.5" r="2.8" fill="#181b20" />
                <path
                  d="M11.7 11.2 L14.3 13.8 M11.7 13.8 L14.3 11.2"
                  stroke={color}
                  stroke-width="1.35"
                  stroke-linecap="round"
                />
              </>
            )}
          </>
        ) : (
          <>
            <rect x="1.5" y="3.5" width="12" height="9" rx="1.4" stroke={color} stroke-width="1.25" />
            <rect x="14" y="6" width="1.4" height="4" rx="0.4" fill={color} />
            {(state === 'normal' || state === 'low') && fillWidth > 0 && (
              <rect x="3.2" y="5.2" width={fillWidth} height="5.6" rx="0.5" fill={color} />
            )}
            {state === 'critical' && (
              <>
                <rect x="3.2" y="5.2" width="2" height="5.6" rx="0.4" fill={color} />
                <rect x="8.8" y="5.2" width="1.4" height="3.2" fill={color} />
                <rect x="8.8" y="9.4" width="1.4" height="1.4" fill={color} />
              </>
            )}
            {state === 'charging' && (
              <>
                {fillWidth > 0 && (
                  <rect x="3.2" y="5.2" width={fillWidth} height="5.6" rx="0.4" fill={color} fill-opacity="0.28" />
                )}
                <polygon
                  points="8.2,4.5 5.1,8.3 7.5,8.3 6.8,11.5 9.9,7.7 7.5,7.7"
                  fill="#ecfdf5"
                />
              </>
            )}
            {state === 'disconnected' && (
              <path
                d="M5.5 6 L9.5 10 M5.5 10 L9.5 6"
                stroke={color}
                stroke-width="1.4"
                stroke-linecap="round"
              />
            )}
            {state === 'unknown' && (
              <>
                <rect x="4.6" y="7.3" width="2.2" height="1.4" rx="0.4" fill={color} />
                <rect x="8.2" y="7.3" width="2.2" height="1.4" rx="0.4" fill={color} />
              </>
            )}
          </>
        )}
      </svg>
    </span>
  );
}

interface LiveTrayPreview {
  state: TrayVisualStateKind;
  tier: number;
  tooltip: string;
}

function classifyLiveBattery(
  percent: number,
  charging: boolean,
  threshold: number,
): { state: TrayVisualStateKind; tier: number; label: string } {
  const tier = batteryTier(percent);
  if (charging) {
    return { state: 'charging', tier, label: t('settings.tray.tipCharging') };
  }
  if (percent <= 10) {
    return { state: 'critical', tier, label: t('settings.tray.tipCritical') };
  }
  if (percent <= threshold) {
    return { state: 'low', tier, label: t('settings.tray.tipLow') };
  }
  return { state: 'normal', tier, label: t('settings.tray.tipNormal') };
}

function evalDeviceBattery(d: Device):
  | { kind: 'disconnected' }
  | { kind: 'unknown' }
  | { kind: 'valid'; percent: number; charging: boolean } {
  if (d.link === 'disconnected') return { kind: 'disconnected' };
  if (d.link !== 'connected') return { kind: 'unknown' };
  const bat = findCapability(d, 'battery.level');
  if (!bat) return { kind: 'unknown' };
  const v = viewOf(bat, d.link);
  if (v.kind !== 'live' || typeof v.value !== 'number') return { kind: 'unknown' };
  const chCap = findCapability(d, 'battery.charging');
  const chView = chCap ? viewOf(chCap, d.link) : null;
  const charging =
    chView?.kind === 'live' && (chView.value === 'charging' || chView.value === 'full');
  return { kind: 'valid', percent: v.value, charging };
}

function computeLiveTrayPreview(settings: Settings, devices: Device[]): LiveTrayPreview {
  const threshold = settings.lowBattery.threshold;
  if (settings.tray.mode === 'device' && settings.tray.deviceId) {
    const dev = devices.find((d) => d.id === settings.tray.deviceId);
    if (!dev) {
      return {
        state: 'disconnected',
        tier: 0,
        tooltip: `${t('app.name')} · ${t('settings.tray.tipPinnedMissing')}`,
      };
    }
    const name = displayName(dev);
    const status = evalDeviceBattery(dev);
    if (status.kind === 'disconnected') {
      return {
        state: 'disconnected',
        tier: 0,
        tooltip: `${t('app.name')} · ${name} · ${t('settings.tray.tipOffline')}`,
      };
    }
    if (status.kind === 'unknown') {
      return {
        state: 'unknown',
        tier: 0,
        tooltip: `${t('app.name')} · ${name} · ${t('settings.tray.tipUnknown')}`,
      };
    }
    const c = classifyLiveBattery(status.percent, status.charging, threshold);
    return {
      state: c.state,
      tier: c.tier,
      tooltip: `${t('app.name')} · ${name} · ${status.percent}% · ${c.label}`,
    };
  }

  const visible = devices.filter((d) => !d.hidden);
  const scored = visible.map((d) => ({ dev: d, status: evalDeviceBattery(d) }));
  const nonCharging = scored
    .filter(
      (x): x is { dev: Device; status: { kind: 'valid'; percent: number; charging: boolean } } =>
        x.status.kind === 'valid' && !x.status.charging,
    )
    .sort((a, b) => a.status.percent - b.status.percent);
  const chargingList = scored
    .filter(
      (x): x is { dev: Device; status: { kind: 'valid'; percent: number; charging: boolean } } =>
        x.status.kind === 'valid' && x.status.charging,
    )
    .sort((a, b) => a.status.percent - b.status.percent);
  const chosen = nonCharging[0] ?? chargingList[0];

  if (chosen) {
    const name = displayName(chosen.dev);
    const c = classifyLiveBattery(chosen.status.percent, chosen.status.charging, threshold);
    const base = `${t('app.name')} · ${t('settings.tray.tipLowestPrefix')}${name} · ${chosen.status.percent}%`;
    return {
      state: c.state,
      tier: c.tier,
      tooltip: chosen.status.charging ? `${base} · ${t('settings.tray.tipCharging')}` : base,
    };
  }

  const firstUnknown = scored.find((x) => x.status.kind === 'unknown');
  if (firstUnknown) {
    return {
      state: 'unknown',
      tier: 0,
      tooltip: `${t('app.name')} · ${displayName(firstUnknown.dev)} · ${t('settings.tray.tipUnknown')}`,
    };
  }

  if (scored.some((x) => x.status.kind === 'disconnected')) {
    return {
      state: 'disconnected',
      tier: 0,
      tooltip: `${t('app.name')} · ${t('settings.tray.tipDevicesOffline')}`,
    };
  }

  return { state: 'unknown', tier: 0, tooltip: t('app.name') };
}

export function TrayFields({
  settings,
  devices,
  compact = false,
}: {
  settings: Settings;
  devices: Device[];
  compact?: boolean;
}) {
  const [state, patch] = usePatch();
  const pending = state.kind === 'pending';
  const tray = settings.tray;
  const activeStyle: TrayStyle = tray.style === 'brand' ? 'brand' : 'battery';
  const candidates = devices.filter((d) => !d.hidden || d.id === tray.deviceId);
  const live = computeLiveTrayPreview(settings, devices);

  if (compact) {
    return (
      <div class="setting-group-rows">
        <SettingRow label={t('settings.tray.style')} status={state}>
          <div class="segmented" role="radiogroup" aria-label={t('settings.tray.style')}>
            <button
              type="button"
              class="key"
              role="radio"
              aria-checked={activeStyle === 'battery'}
              disabled={pending}
              onClick={() => patch({ tray: { style: 'battery' } })}
            >
              {t('settings.tray.styleBatteryShort')}
            </button>
            <button
              type="button"
              class="key"
              role="radio"
              aria-checked={activeStyle === 'brand'}
              disabled={pending}
              onClick={() => patch({ tray: { style: 'brand' } })}
            >
              {t('settings.tray.styleBrandShort')}
            </button>
          </div>
        </SettingRow>

        <div class="setting-row is-stacked">
          <div class="setting-info">
            <span class="setting-label">{t('settings.tray.mode')}</span>
          </div>
          <fieldset class="radio-group">
            <legend class="sr-only">{t('settings.tray.mode')}</legend>
            <label class="radio">
              <input
                type="radio"
                name="tray-mode-panel"
                checked={tray.mode === 'lowest'}
                disabled={pending}
                onChange={() => patch({ tray: { mode: 'lowest' } })}
              />
              <span>{t('settings.tray.lowest')}</span>
            </label>
            <label class="radio">
              <input
                type="radio"
                name="tray-mode-panel"
                checked={tray.mode === 'device'}
                disabled={pending || candidates.length === 0}
                onChange={() => {
                  const first = candidates[0];
                  if (first) patch({ tray: { mode: 'device', deviceId: tray.deviceId ?? first.id } });
                }}
              />
              <span>{t('settings.tray.device')}</span>
            </label>
          </fieldset>
        </div>

        {tray.mode === 'device' && (
          <SettingRow label={t('settings.tray.deviceId')} htmlFor="tray-device-panel">
            <select
              id="tray-device-panel"
              class="input"
              value={tray.deviceId ?? ''}
              disabled={pending || candidates.length === 0}
              onChange={(e) => {
                const deviceId = e.currentTarget.value;
                e.currentTarget.value = tray.deviceId ?? '';
                if (deviceId) patch({ tray: { deviceId } });
              }}
            >
              {(tray.deviceId === null || !candidates.some((d) => d.id === tray.deviceId)) && (
                <option value={tray.deviceId ?? ''}>{tray.deviceId ?? t('settings.tray.noDevice')}</option>
              )}
              {candidates.map((d) => (
                <option value={d.id} key={d.id}>
                  {displayName(d)}
                </option>
              ))}
            </select>
          </SettingRow>
        )}
      </div>
    );
  }

  return (
    <div class="setting-group-rows">
      <div class="setting-row is-stacked">
        <div class="setting-info">
          <span class="setting-label">{t('settings.tray.style')}</span>
          {state.kind !== 'idle' && (
            <div class="setting-status">
              <ActionStatus state={state} />
            </div>
          )}
        </div>
        <div class="tray-mode-grid" role="radiogroup" aria-label={t('settings.tray.style')}>
          <label class={`tray-option-card${activeStyle === 'battery' ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="tray-style"
              checked={activeStyle === 'battery'}
              disabled={pending}
              onChange={() => patch({ tray: { style: 'battery' } })}
            />
            <span class="tray-preview-icon" aria-hidden="true">
              <TrayGlyphPreview style="battery" state="normal" tier={4} size={20} />
            </span>
            <span class="tray-option-text">
              <span class="tray-option-title">{t('settings.tray.styleBatteryTitle')}</span>
              <span class="tray-option-desc">{t('settings.tray.styleBatteryHint')}</span>
            </span>
          </label>

          <label class={`tray-option-card${activeStyle === 'brand' ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="tray-style"
              checked={activeStyle === 'brand'}
              disabled={pending}
              onChange={() => patch({ tray: { style: 'brand' } })}
            />
            <span class="tray-preview-icon" aria-hidden="true">
              <TrayGlyphPreview style="brand" state="normal" tier={5} size={20} />
            </span>
            <span class="tray-option-text">
              <span class="tray-option-title">{t('settings.tray.styleBrandTitle')}</span>
              <span class="tray-option-desc">{t('settings.tray.styleBrandHint')}</span>
            </span>
          </label>
        </div>
      </div>

      <div class="setting-row is-stacked">
        <div class="setting-info">
          <span class="setting-label">{t('settings.tray.mode')}</span>
        </div>
        <div class="tray-mode-grid" role="radiogroup" aria-label={t('settings.tray.mode')}>
          <label class={`tray-option-card${tray.mode === 'lowest' ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="tray-mode"
              checked={tray.mode === 'lowest'}
              disabled={pending}
              onChange={() => patch({ tray: { mode: 'lowest' } })}
            />
            <span class="tray-preview-icon" aria-hidden="true">
              <TrayGlyphPreview style={activeStyle} state="low" tier={1} size={20} />
            </span>
            <span class="tray-option-text">
              <span class="tray-option-title">{t('settings.tray.lowestTitle')}</span>
              <span class="tray-option-desc">{t('settings.tray.lowestHint')}</span>
            </span>
          </label>

          <label
            class={`tray-option-card${tray.mode === 'device' ? ' is-selected' : ''}${
              candidates.length === 0 ? ' is-disabled' : ''
            }`}
          >
            <input
              type="radio"
              name="tray-mode"
              checked={tray.mode === 'device'}
              disabled={pending || candidates.length === 0}
              onChange={() => {
                const first = candidates[0];
                if (first) patch({ tray: { mode: 'device', deviceId: tray.deviceId ?? first.id } });
              }}
            />
            <span class="tray-preview-icon" aria-hidden="true">
              <TrayGlyphPreview style={activeStyle} state="normal" tier={5} size={20} />
            </span>
            <span class="tray-option-text">
              <span class="tray-option-title">{t('settings.tray.deviceTitle')}</span>
              <span class="tray-option-desc">{t('settings.tray.deviceHint')}</span>
            </span>
          </label>
        </div>
      </div>

      {tray.mode === 'device' && (
        <SettingRow
          label={t('settings.tray.deviceId')}
          htmlFor="tray-device"
          description={t('settings.tray.deviceHintSelect')}
        >
          <select
            id="tray-device"
            class="input"
            value={tray.deviceId ?? ''}
            disabled={pending || candidates.length === 0}
            onChange={(e) => {
              const deviceId = e.currentTarget.value;
              e.currentTarget.value = tray.deviceId ?? '';
              if (deviceId) patch({ tray: { deviceId } });
            }}
          >
            {(tray.deviceId === null || !candidates.some((d) => d.id === tray.deviceId)) && (
              <option value={tray.deviceId ?? ''}>{tray.deviceId ?? t('settings.tray.noDevice')}</option>
            )}
            {candidates.map((d) => (
              <option value={d.id} key={d.id}>
                {displayName(d)}
              </option>
            ))}
          </select>
        </SettingRow>
      )}

      <div class="setting-row is-stacked">
        <div class="setting-info">
          <span class="setting-label">{t('settings.tray.preview')}</span>
        </div>
        <p class="setting-desc">{t('settings.tray.previewHint')}</p>
        <div class="tray-preview-strip">
          <div class="tray-preview-live">
            <span class="tray-preview-icon is-compact" aria-hidden="true">
              <TrayGlyphPreview style={activeStyle} state={live.state} tier={live.tier} size={16} />
            </span>
            <span class="tray-preview-live-tag">{t('settings.tray.previewCurrent')}</span>
            <span class="tray-preview-tooltip">{live.tooltip}</span>
          </div>
          <div class="tray-preview-states">
            <div class="tray-preview-tile">
              <span class="tray-preview-icon is-compact" aria-hidden="true">
                <TrayGlyphPreview style={activeStyle} state="normal" tier={5} size={16} />
              </span>
              <span class="tray-preview-tile-label">{t('settings.tray.previewNormal')}</span>
            </div>
            <div class="tray-preview-tile">
              <span class="tray-preview-icon is-compact" aria-hidden="true">
                <TrayGlyphPreview style={activeStyle} state="charging" tier={4} size={16} />
              </span>
              <span class="tray-preview-tile-label">{t('settings.tray.previewCharging')}</span>
            </div>
            <div class="tray-preview-tile">
              <span class="tray-preview-icon is-compact" aria-hidden="true">
                <TrayGlyphPreview style={activeStyle} state="low" tier={1} size={16} />
              </span>
              <span class="tray-preview-tile-label">{t('settings.tray.previewLow')}</span>
            </div>
            <div class="tray-preview-tile">
              <span class="tray-preview-icon is-compact" aria-hidden="true">
                <TrayGlyphPreview style={activeStyle} state="critical" tier={1} size={16} />
              </span>
              <span class="tray-preview-tile-label">{t('settings.tray.previewCritical')}</span>
            </div>
            <div class="tray-preview-tile">
              <span class="tray-preview-icon is-compact" aria-hidden="true">
                <TrayGlyphPreview style={activeStyle} state="disconnected" tier={0} size={16} />
              </span>
              <span class="tray-preview-tile-label">{t('settings.tray.previewOffline')}</span>
            </div>
            <div class="tray-preview-tile">
              <span class="tray-preview-icon is-compact" aria-hidden="true">
                <TrayGlyphPreview style={activeStyle} state="unknown" tier={0} size={16} />
              </span>
              <span class="tray-preview-tile-label">{t('settings.tray.previewUnknown')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeveloperField({
  settings,
  confirm,
}: {
  settings: Settings;
  confirm: (message: string, action: string, danger?: boolean) => Promise<boolean>;
}) {
  const [state, patch] = usePatch();
  return (
    <SettingRow label={t('settings.developerMode')} description={t('settings.developerWarning')} status={state}>
      <Switch
        checked={settings.developerMode}
        disabled={state.kind === 'pending'}
        onChange={(developerMode) =>
          void (async () => {
            if (developerMode && !(await confirm(t('settings.developerConfirm'), t('settings.developerEnable')))) return;
            patch({ developerMode });
          })()
        }
      />
    </SettingRow>
  );
}

export function NetworkFields({ settings }: { settings: Settings }) {
  const [state, patch] = usePatch();
  const pending = state.kind === 'pending';
  return (
    <div class="setting-group-rows">
      <SettingRow
        label={t('settings.network.registry')}
        description={t('settings.network.registryHint')}
        status={state}
      >
        <Switch
          checked={settings.network.registry}
          disabled={pending}
          onChange={(registry) => patch({ network: { registry } })}
        />
      </SettingRow>
      <SettingRow label={t('settings.network.updates')} description={t('settings.network.updatesHint')}>
        <Switch
          checked={settings.network.updates}
          disabled={pending}
          onChange={(updates) => patch({ network: { updates } })}
        />
      </SettingRow>
    </div>
  );
}
