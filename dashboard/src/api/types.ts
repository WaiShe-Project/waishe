// Types for local API 0.1 (waishe-bridge docs/local-api.md).

export const SUPPORTED_API_VERSION = '0.1';

export type DpiValue = { x: number; y: number };
export type CapabilityValue = number | boolean | string | DpiValue;

export type UnavailableReason = 'asleep' | 'disconnected' | 'busy' | 'timeout' | 'io' | 'protocol';

export interface LastOk {
  value: CapabilityValue;
  observedAt: string;
}

export type Reading =
  | { state: 'ok'; value: CapabilityValue; observedAt: string; stale: boolean }
  | {
      state: 'unavailable';
      reason: UnavailableReason | string;
      observedAt?: string;
      lastOk?: LastOk | null;
    }
  | { state: 'unknown' };

export type Access = 'read' | 'write' | 'notify';
export type ValueType = 'percent' | 'bool' | 'integer' | 'enum' | 'text' | 'dpi';

export type Constraint =
  | { kind: 'range'; min: number; max: number; step: number }
  | { kind: 'choices'; values: Array<number | string> }
  | { kind: 'dpi'; min: number; max: number; step: number; independentXY: boolean };

export type Persistence = 'onboard' | 'volatile' | 'unknown';
export type Precision = { kind: 'exact' } | { kind: 'steps'; count: number };
export type Verification = 'verified' | 'simulated' | 'inferred' | 'broken';

export interface Capability {
  id: string;
  access: Access[];
  type: ValueType | string;
  unit: string | null;
  variants: string[] | null;
  constraint: Constraint | null;
  persistence: Persistence | null;
  precision: Precision | null;
  verification: Verification | null;
  reading: Reading;
}

export type Link = 'connected' | 'asleep' | 'disconnected' | 'unknown';
export type Trust = 'official' | 'community' | 'local';

export interface Endpoint {
  transport: 'wired' | 'receiver' | 'bluetooth' | string;
  vendorId: number;
  productId: number;
  link: Link;
  active: boolean;
}

export interface Device {
  id: string;
  name: string;
  alias: string | null;
  hidden: boolean;
  brand: string;
  model: string;
  kind: string;
  link: Link;
  driver: { id: string; version: string; trust: Trust } | null;
  endpoints: Endpoint[];
  capabilities: Capability[];
}

export interface DriverModel {
  model: string;
  name: string;
}

export interface Driver {
  id: string;
  name: string;
  version: string;
  api: string;
  license: string;
  repository: string | null;
  description: string | null;
  trust: Trust;
  enabled: boolean;
  status: 'active' | 'disabled' | 'faulted';
  /** The contract only shows `null`; a string or `{ code?, message? }` are both handled. */
  fault: string | { code?: string; message?: string } | null;
  models: DriverModel[];
}

export type Language = 'zh-CN' | 'en';

export interface Settings {
  language: Language;
  autostart: boolean;
  tray: { mode: 'lowest' | 'device'; deviceId: string | null };
  lowBattery: { enabled: boolean; threshold: number; intervalMinutes: number };
  pollIntervalSeconds: number;
  developerMode: boolean;
  network: { registry: boolean; updates: boolean };
}

export type SettingsPatch = {
  language?: Language;
  autostart?: boolean;
  tray?: Partial<Settings['tray']>;
  lowBattery?: Partial<Settings['lowBattery']>;
  pollIntervalSeconds?: number;
  developerMode?: boolean;
  network?: Partial<Settings['network']>;
};

export interface Status {
  version: string;
  apiVersion: string;
  driverAbi: string;
  platform: string;
  port: number;
  vendorSoftware: string[];
}

export interface HidDevice {
  vendorId: number;
  productId: number;
  product: string | null;
  manufacturer: string | null;
  usagePage: number;
  usage: number;
  interfaceNumber: number;
  driver: string | null;
}

export type WriteOutcome = 'applied' | 'accepted' | 'rejected' | 'failed';

export interface WriteResult {
  outcome: WriteOutcome;
  reading: Reading | null;
  message: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
