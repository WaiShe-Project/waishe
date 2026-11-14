import { useEffect, useReducer } from 'preact/hooks';
import type { Capability, Device, Driver, Language, Reading, Settings, Status } from '../api/types';
import { setLanguage } from '../i18n';

export type Phase = 'loading' | 'ready' | 'unauthorized' | 'unreachable' | 'incompatible';

export interface AppState {
  phase: Phase;
  /** Event stream state while `phase === 'ready'`. */
  live: boolean;
  status: Status | null;
  settings: Settings | null;
  /** `null` until the first baseline arrives. */
  devices: Device[] | null;
  drivers: Driver[] | null;
  language: Language;
}

let state: AppState = {
  phase: 'loading',
  live: false,
  status: null,
  settings: null,
  devices: null,
  drivers: null,
  language: 'zh-CN',
};

const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  if (patch.language) setLanguage(patch.language);
  for (const l of listeners) l();
}

/** Re-renders the calling component on every store change. */
export function useAppState(): AppState {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const l = () => force(undefined);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

// ---- mutations -----------------------------------------------------------

export function setSettings(settings: Settings): void {
  setState({ settings, language: settings.language });
}

export function upsertDevice(device: Device): void {
  const list = state.devices ?? [];
  const i = list.findIndex((d) => d.id === device.id);
  const next = i < 0 ? [...list, device] : list.map((d, j) => (j === i ? device : d));
  setState({ devices: next });
}

export function removeDevice(id: string): void {
  if (!state.devices) return;
  setState({ devices: state.devices.filter((d) => d.id !== id) });
}

export function upsertCapability(deviceId: string, capability: Capability): void {
  const device = state.devices?.find((d) => d.id === deviceId);
  if (!device) return;
  const i = device.capabilities.findIndex((c) => c.id === capability.id);
  const capabilities =
    i < 0 ? [...device.capabilities, capability] : device.capabilities.map((c, j) => (j === i ? capability : c));
  upsertDevice({ ...device, capabilities });
}

/** Applies the authoritative reading returned by a write. */
export function setReading(deviceId: string, capabilityId: string, reading: Reading): void {
  const cap = state.devices?.find((d) => d.id === deviceId)?.capabilities.find((c) => c.id === capabilityId);
  if (cap) upsertCapability(deviceId, { ...cap, reading });
}

export function upsertDriver(driver: Driver): void {
  const list = state.drivers ?? [];
  const i = list.findIndex((d) => d.id === driver.id);
  setState({ drivers: i < 0 ? [...list, driver] : list.map((d, j) => (j === i ? driver : d)) });
}

export function removeDriver(id: string): void {
  if (!state.drivers) return;
  setState({ drivers: state.drivers.filter((d) => d.id !== id) });
}
