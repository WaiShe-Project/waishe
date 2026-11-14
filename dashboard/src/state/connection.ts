// Bridge connection lifecycle: initial probe, event stream, baseline fetch,
// reconnection with backoff, and 401 / unreachable detection.

import { API_BASE, ApiError, UnreachableError, api, setUnauthorizedHandler } from '../api/client';
import { SUPPORTED_API_VERSION, type Capability, type Device, type Driver, type Settings } from '../api/types';
import {
  getState,
  removeDevice,
  removeDriver,
  setSettings,
  setState,
  upsertCapability,
  upsertDevice,
  upsertDriver,
} from './store';

/** Event stream payloads (local API section 6). */
type StreamEvent =
  | { name: 'device.added' | 'device.updated'; data: Device }
  | { name: 'device.removed'; data: { id: string } }
  | { name: 'capability.changed'; data: { deviceId: string; capability: Capability } }
  | { name: 'driver.changed'; data: Driver | { id: string; removed: true } }
  | { name: 'settings.changed'; data: Settings };

const EVENT_NAMES: ReadonlyArray<StreamEvent['name']> = [
  'device.added',
  'device.updated',
  'device.removed',
  'capability.changed',
  'driver.changed',
  'settings.changed',
];

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

let source: EventSource | null = null;
let backoff = MIN_BACKOFF_MS;
let retryTimer: number | undefined;
/** Monotonic id so stale async work from an earlier connection is ignored. */
let generation = 0;
/** Events received while the baseline is loading are replayed after it. */
let buffered: StreamEvent[] | null = null;

/** Time of the next automatic retry while Bridge is unreachable, for the countdown. */
export let nextRetryAt = 0;

function stop(): void {
  generation++;
  window.clearTimeout(retryTimer);
  source?.close();
  source = null;
  buffered = null;
}

function goUnauthorized(): void {
  stop();
  setState({ phase: 'unauthorized', live: false });
}

setUnauthorizedHandler(goUnauthorized);

function scheduleRetry(): void {
  window.clearTimeout(retryTimer);
  const delay = backoff;
  backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  nextRetryAt = Date.now() + delay;
  retryTimer = window.setTimeout(() => void connect(), delay);
}

function handleFailure(err: unknown): void {
  if (getState().phase === 'unauthorized') return;
  if (err instanceof ApiError && err.status === 401) return goUnauthorized();
  if (err instanceof UnreachableError) setState({ phase: 'unreachable', live: false });
  else setState({ live: false });
  scheduleRetry();
}

/** Starts (or restarts) the connection. Safe to call repeatedly, e.g. from a retry button. */
export async function connect(): Promise<void> {
  stop();
  const gen = generation;
  try {
    const [status, settings] = await Promise.all([api.status(), api.settings()]);
    if (gen !== generation) return;
    // API versions are `major.minor`; in 0.x every minor change may break.
    if (status.apiVersion.split('.').slice(0, 2).join('.') !== SUPPORTED_API_VERSION) {
      setState({ phase: 'incompatible', status, live: false });
      return;
    }
    setState({ status });
    setSettings(settings);
    if (getState().phase !== 'ready') setState({ phase: 'ready' });
    openStream(gen);
  } catch (err) {
    if (gen === generation) handleFailure(err);
  }
}

function openStream(gen: number): void {
  const es = new EventSource(`${API_BASE}/events`);
  source = es;
  es.onopen = () => {
    if (gen !== generation) return;
    backoff = MIN_BACKOFF_MS;
    void loadBaseline(gen);
  };
  es.onerror = () => {
    if (gen !== generation) return;
    // EventSource hides the HTTP status; restart through `connect`, whose probe
    // distinguishes 401, Bridge gone, and a transient stream drop.
    stop();
    setState({ live: false });
    scheduleRetry();
  };
  for (const name of EVENT_NAMES) {
    es.addEventListener(name, (ev: MessageEvent<string>) => {
      if (gen !== generation) return;
      let data: unknown;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      // Bridge is the trusted, version-matched producer of these payloads.
      const event = { name, data } as StreamEvent;
      if (buffered) buffered.push(event);
      else applyEvent(event);
    });
  }
}

async function loadBaseline(gen: number): Promise<void> {
  buffered = [];
  try {
    const [devices, drivers, settings] = await Promise.all([api.devices(), api.drivers(), api.settings()]);
    if (gen !== generation) return;
    const pending = buffered ?? [];
    buffered = null;
    setState({ devices, drivers, live: true });
    setSettings(settings);
    for (const event of pending) applyEvent(event);
  } catch (err) {
    if (gen !== generation) return;
    stop();
    handleFailure(err);
  }
}

function applyEvent(event: StreamEvent): void {
  switch (event.name) {
    case 'device.added':
    case 'device.updated':
      upsertDevice(event.data);
      break;
    case 'device.removed':
      removeDevice(event.data.id);
      break;
    case 'capability.changed':
      upsertCapability(event.data.deviceId, event.data.capability);
      break;
    case 'driver.changed':
      if ('removed' in event.data) removeDriver(event.data.id);
      else upsertDriver(event.data);
      break;
    case 'settings.changed':
      setSettings(event.data);
      break;
  }
}
