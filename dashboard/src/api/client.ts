import type {
  ApiErrorBody,
  CapabilityValue,
  Device,
  Driver,
  HidDevice,
  Settings,
  SettingsPatch,
  Reading,
  Status,
  WriteResult,
} from './types';

export const API_BASE = '/api/v1';

/** The request never reached Bridge (not running, port closed). */
export class UnreachableError extends Error {
  constructor() {
    super('bridge_unreachable');
  }
}

/** Bridge answered with an error status. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

async function send(method: string, path: string, body?: BodyInit, contentType?: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (contentType) headers['Content-Type'] = contentType;
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body === undefined ? {} : { body }),
    });
  } catch {
    throw new UnreachableError();
  }
  if (res.status === 401) {
    onUnauthorized();
  }
  return res;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isErrorBody(x: unknown): x is ApiErrorBody {
  return typeof x === 'object' && x !== null && 'error' in x && typeof (x as ApiErrorBody).error === 'object';
}

async function toError(res: Response, body?: unknown): Promise<ApiError | UnreachableError> {
  const data = body === undefined ? await readJson(res) : body;
  if (isErrorBody(data)) return new ApiError(res.status, data.error.code, data.error.message);
  // A non-JSON error page (e.g. a dev proxy whose upstream is down) means Bridge was not reached.
  if (res.status >= 500) return new UnreachableError();
  return new ApiError(res.status, `http_${res.status}`, res.statusText);
}

async function json<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const res = await send(
    method,
    path,
    payload === undefined ? undefined : JSON.stringify(payload),
    payload === undefined ? undefined : 'application/json',
  );
  if (!res.ok) throw await toError(res);
  return (await readJson(res)) as T;
}

const enc = encodeURIComponent;

export const api = {
  status: () => json<Status>('GET', '/status'),
  devices: () => json<Device[]>('GET', '/devices'),
  patchDevice: (id: string, patch: { alias?: string | null; hidden?: boolean }) =>
    json<Device>('PATCH', `/devices/${enc(id)}`, patch),
  refreshDevice: async (id: string): Promise<void> => {
    const res = await send('POST', `/devices/${enc(id)}/refresh`);
    if (!res.ok) throw await toError(res);
  },
  hidDevices: () => json<HidDevice[]>('GET', '/hid-devices'),
  drivers: () => json<Driver[]>('GET', '/drivers'),
  installDriver: async (file: Blob): Promise<Driver> => {
    const res = await send('POST', '/drivers', file, 'application/zip');
    if (!res.ok) throw await toError(res);
    return (await readJson(res)) as Driver;
  },
  patchDriver: (id: string, enabled: boolean) => json<Driver>('PATCH', `/drivers/${enc(id)}`, { enabled }),
  deleteDriver: async (id: string): Promise<void> => {
    const res = await send('DELETE', `/drivers/${enc(id)}`);
    if (!res.ok) throw await toError(res);
  },
  settings: () => json<Settings>('GET', '/settings'),
  patchSettings: (patch: SettingsPatch) => json<Settings>('PATCH', '/settings', patch),

  /**
   * Writes a capability. Every write result carries the reading after the write.
   * A 422 `invalid_value` error (Bridge refused the value before sending it) is
   * reported as `rejected` without a reading; other errors throw.
   */
  writeCapability: async (deviceId: string, capabilityId: string, value: CapabilityValue): Promise<WriteReply> => {
    const res = await send(
      'PUT',
      `/devices/${enc(deviceId)}/capabilities/${enc(capabilityId)}`,
      JSON.stringify({ value }),
      'application/json',
    );
    const data = await readJson(res);
    if (typeof data === 'object' && data !== null && 'outcome' in data) {
      // Bridge is the trusted, version-matched producer of write results.
      return data as WriteResult;
    }
    if (isErrorBody(data) && res.status === 422) {
      return { outcome: 'rejected', reading: null, message: data.error.message || data.error.code };
    }
    throw await toError(res, data);
  },
};

/** What a write produced; `reading` is null only when Bridge refused the value before writing. */
export type WriteReply = Omit<WriteResult, 'reading'> & { reading: Reading | null };
