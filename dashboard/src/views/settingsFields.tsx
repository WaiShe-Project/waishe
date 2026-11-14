// Settings controls shared by the Settings page and the compact panel.
// Each change sends only the changed fields; the form shows Bridge's answer, not the input.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Device, Settings, SettingsPatch } from '../api/types';
import { ActionStatus, Switch, useAction, type ActionState } from '../components/common';
import { t } from '../i18n';
import { displayName } from '../lib/reading';
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

/** One setting: its controls, an optional quiet note, and the save status beside them. */
function Setting({ children, note, status }: { children: ComponentChildren; note?: string; status: ActionState }) {
  return (
    <div class="setting">
      <div class="setting-main">
        {children}
        {note && <p class="note">{note}</p>}
      </div>
      <ActionStatus state={status} />
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}

/** Integer input that commits on change (blur or Enter) after validation. */
function NumberField({ id, label, unit, value, min, max, disabled, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const n = draft.trim() === '' ? Number.NaN : Number(draft);
  const error = !Number.isInteger(n)
    ? t('validate.integer')
    : n < min || n > max
      ? t('validate.range', { min, max })
      : null;
  return (
    <div class="number-field">
      <label for={id}>{label}</label>
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

export function AutostartField({ settings }: { settings: Settings }) {
  const [state, patch] = usePatch();
  return (
    <Setting status={state}>
      <Switch
        checked={settings.autostart}
        disabled={state.kind === 'pending'}
        onChange={(autostart) => patch({ autostart })}
      >
        {t('settings.autostart')}
      </Switch>
    </Setting>
  );
}

export function LowBatteryFields({ settings }: { settings: Settings }) {
  const [state, patch] = usePatch();
  const lb = settings.lowBattery;
  const pending = state.kind === 'pending';
  return (
    <Setting status={state}>
      <Switch checked={lb.enabled} disabled={pending} onChange={(enabled) => patch({ lowBattery: { enabled } })}>
        {t('settings.lowBattery.enabled')}
      </Switch>
      <NumberField
        id="lb-threshold"
        label={t('settings.lowBattery.threshold')}
        unit={t('unit.percent')}
        value={lb.threshold}
        {...LIMITS.threshold}
        disabled={pending}
        onCommit={(threshold) => patch({ lowBattery: { threshold } })}
      />
      <NumberField
        id="lb-interval"
        label={t('settings.lowBattery.interval')}
        unit={t('unit.minutes')}
        value={lb.intervalMinutes}
        {...LIMITS.intervalMinutes}
        disabled={pending}
        onCommit={(intervalMinutes) => patch({ lowBattery: { intervalMinutes } })}
      />
    </Setting>
  );
}

export function TrayFields({ settings, devices }: { settings: Settings; devices: Device[] }) {
  const [state, patch] = usePatch();
  const pending = state.kind === 'pending';
  const tray = settings.tray;
  const candidates = devices.filter((d) => !d.hidden || d.id === tray.deviceId);
  return (
    <Setting status={state}>
      <fieldset class="radio-group">
        <legend>{t('settings.tray.mode')}</legend>
        <label class="radio">
          <input
            type="radio"
            name="tray-mode"
            checked={tray.mode === 'lowest'}
            disabled={pending}
            onChange={() => patch({ tray: { mode: 'lowest' } })}
          />
          {t('settings.tray.lowest')}
        </label>
        <label class="radio">
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
          {t('settings.tray.device')}
        </label>
      </fieldset>
      {tray.mode === 'device' && (
        <div class="number-field">
          <label for="tray-device">{t('settings.tray.deviceId')}</label>
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
        </div>
      )}
    </Setting>
  );
}

export function LanguageField({ settings }: { settings: Settings }) {
  const [state, patch] = usePatch();
  return (
    <Setting status={state}>
      <div class="number-field">
        <label for="language">{t('settings.language')}</label>
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
      </div>
    </Setting>
  );
}

export function PollField({ settings }: { settings: Settings }) {
  const [state, patch] = usePatch();
  return (
    <Setting status={state} note={t('settings.pollHint')}>
      <NumberField
        id="poll"
        label={t('settings.poll')}
        unit={t('unit.seconds')}
        value={settings.pollIntervalSeconds}
        {...LIMITS.pollIntervalSeconds}
        disabled={state.kind === 'pending'}
        onCommit={(pollIntervalSeconds) => patch({ pollIntervalSeconds })}
      />
    </Setting>
  );
}

export function DeveloperField({
  settings,
  confirm,
}: {
  settings: Settings;
  confirm: (message: string, action: string) => Promise<boolean>;
}) {
  const [state, patch] = usePatch();
  return (
    <Setting status={state} note={t('settings.developerWarning')}>
      <Switch
        checked={settings.developerMode}
        disabled={state.kind === 'pending'}
        onChange={(developerMode) =>
          void (async () => {
            if (developerMode && !(await confirm(t('settings.developerConfirm'), t('settings.developerEnable')))) return;
            patch({ developerMode });
          })()
        }
      >
        {t('settings.developerMode')}
      </Switch>
    </Setting>
  );
}

export function NetworkFields({ settings }: { settings: Settings }) {
  const [state, patch] = usePatch();
  const pending = state.kind === 'pending';
  return (
    <Setting status={state} note={t('settings.network.hint')}>
      <Switch
        checked={settings.network.registry}
        disabled={pending}
        onChange={(registry) => patch({ network: { registry } })}
      >
        {t('settings.network.registry')}
      </Switch>
      <Switch
        checked={settings.network.updates}
        disabled={pending}
        onChange={(updates) => patch({ network: { updates } })}
      >
        {t('settings.network.updates')}
      </Switch>
    </Setting>
  );
}
