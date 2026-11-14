import type { Capability, CapabilityValue, Device, DpiValue } from '../api/types';

/**
 * What the UI may show for a reading. A value is only ever `live` when Bridge
 * says it is fresh and the device is connected; everything else is labelled.
 */
export type View =
  | { kind: 'live'; value: CapabilityValue; observedAt: string }
  | { kind: 'historical'; value: CapabilityValue; observedAt: string }
  | { kind: 'unavailable'; reason: string; last: { value: CapabilityValue; observedAt: string } | null }
  | { kind: 'unknown' };

/** `link.state` describes the link itself, so the device link does not make it historical. */
const LINK_CAPABILITY = 'link.state';

export function viewOf(cap: Capability, deviceLink: Device['link']): View {
  const r = cap.reading;
  switch (r.state) {
    case 'ok': {
      const historical = r.stale || (deviceLink !== 'connected' && cap.id !== LINK_CAPABILITY);
      return { kind: historical ? 'historical' : 'live', value: r.value, observedAt: r.observedAt };
    }
    case 'unavailable':
      return { kind: 'unavailable', reason: r.reason, last: r.lastOk ?? null };
    default:
      return { kind: 'unknown' };
  }
}

export function isDpi(v: CapabilityValue): v is DpiValue {
  return typeof v === 'object' && v !== null && typeof v.x === 'number' && typeof v.y === 'number';
}

export function findCapability(device: Device, id: string): Capability | undefined {
  return device.capabilities.find((c) => c.id === id);
}

export function displayName(device: Device): string {
  return device.alias?.trim() || device.name;
}
