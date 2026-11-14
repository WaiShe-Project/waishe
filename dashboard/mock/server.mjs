// Mock Bridge for Dashboard development. Implements local API 0.1
// (waishe-bridge docs/local-api.md) with in-memory fake data.
// Node built-ins only. Usage: node mock/server.mjs  (env PORT, default 27463)
//
// Auth: open http://127.0.0.1:<port>/auth?code=dev (or through the Vite dev
// server, http://localhost:5173/auth?code=dev) to get a session cookie.
// Requests without it get 401, as with the real Bridge.
//
// Test hooks:
//   headset.sleep_timer = "30min"  -> simulated timeout, outcome "failed"
//   mouse.lift_off_distance = 3    -> refused by the "device", outcome "rejected"
//   mouse.lift_off_distance (other) -> outcome "accepted" (no read-back)

import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 27463);
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const WRITE_DELAY_MS = 200;
const AUTH_CODE = 'dev';

// ---- helpers --------------------------------------------------------------

const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString().replace(/\.\d{3}Z$/, 'Z');
const MIN = 60_000;
const ok = (value, msAgo = 0, stale = false) => ({ state: 'ok', value, observedAt: iso(msAgo), stale });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cap(id, type, access, reading, extra = {}) {
  return {
    id,
    access,
    type,
    unit: null,
    variants: null,
    constraint: null,
    persistence: null,
    precision: null,
    verification: null,
    reading,
    ...extra,
  };
}

// ---- fake data ------------------------------------------------------------

const LINK_VARIANTS = ['connected', 'asleep', 'disconnected'];
const CHARGING_VARIANTS = ['discharging', 'charging', 'full'];

const devices = [
  {
    id: 'dev_3f9c2a71b0',
    name: 'Razer DeathAdder V3 Pro',
    alias: null,
    hidden: false,
    brand: 'Razer',
    model: 'deathadder-v3-pro',
    kind: 'mouse',
    link: 'connected',
    driver: { id: 'razer', version: '0.1.0', trust: 'local' },
    endpoints: [{ transport: 'receiver', vendorId: 0x1532, productId: 0x00b7, link: 'connected', active: true }],
    capabilities: [
      cap('battery.level', 'percent', ['read'], ok(89), { precision: { kind: 'exact' }, verification: 'inferred' }),
      cap('link.state', 'enum', ['read', 'notify'], ok('connected'), { variants: LINK_VARIANTS, verification: 'inferred' }),
      cap('device.firmware', 'text', ['read'], ok('2.2'), { verification: 'inferred' }),
      cap('mouse.dpi', 'dpi', ['read', 'write'], ok({ x: 800, y: 800 }), {
        constraint: { kind: 'dpi', min: 100, max: 30000, step: 50, independentXY: true },
        persistence: 'onboard',
        verification: 'inferred',
      }),
      cap('mouse.polling_rate', 'integer', ['read', 'write'], ok(1000), {
        unit: 'Hz',
        constraint: { kind: 'choices', values: [125, 500, 1000] },
        persistence: 'onboard',
        verification: 'inferred',
      }),
      // Not in the standard catalogue: exercises the generic integer range control.
      cap('mouse.lift_off_distance', 'integer', ['read', 'write'], ok(2), {
        unit: 'mm',
        constraint: { kind: 'range', min: 1, max: 3, step: 1 },
        persistence: 'volatile',
      }),
    ],
  },
  {
    id: 'dev_8b21d4e6c3',
    name: 'HyperX Cloud III Wireless',
    alias: null,
    hidden: false,
    brand: 'HyperX',
    model: 'cloud-iii-wireless',
    kind: 'headset',
    link: 'connected',
    driver: { id: 'hyperx', version: '0.1.0', trust: 'local' },
    endpoints: [{ transport: 'receiver', vendorId: 0x03f0, productId: 0x05b7, link: 'connected', active: true }],
    capabilities: [
      cap('battery.level', 'percent', ['read', 'notify'], ok(47), { precision: { kind: 'exact' }, verification: 'simulated' }),
      cap('battery.charging', 'enum', ['read', 'notify'], ok('discharging'), {
        variants: CHARGING_VARIANTS,
        verification: 'simulated',
      }),
      cap('link.state', 'enum', ['read', 'notify'], ok('connected'), { variants: LINK_VARIANTS, verification: 'simulated' }),
      cap('headset.mic_mute', 'bool', ['read', 'notify'], ok(false), { verification: 'simulated' }),
      // Not in the standard catalogue: exercise generic percent and enum controls.
      cap('headset.sidetone', 'percent', ['read', 'write'], { state: 'unknown' }, {
        constraint: { kind: 'range', min: 0, max: 100, step: 10 },
        persistence: 'volatile',
      }),
      cap('headset.sleep_timer', 'enum', ['read', 'write'], ok('20min'), {
        variants: ['off', '10min', '20min', '30min'],
        constraint: { kind: 'choices', values: ['off', '10min', '20min', '30min'] },
        persistence: 'unknown',
      }),
    ],
  },
  {
    id: 'dev_c47e019a5d',
    name: 'HyperX Pulsefire Haste 2 Wireless',
    alias: '办公室鼠标',
    hidden: false,
    brand: 'HyperX',
    model: 'pulsefire-haste-2-wireless',
    kind: 'mouse',
    link: 'disconnected',
    driver: { id: 'hyperx', version: '0.1.0', trust: 'local' },
    endpoints: [{ transport: 'receiver', vendorId: 0x03f0, productId: 0x0f98, link: 'disconnected', active: false }],
    capabilities: [
      cap(
        'battery.level',
        'percent',
        ['read'],
        { state: 'unavailable', reason: 'disconnected', observedAt: iso(), lastOk: { value: 75, observedAt: iso(185 * MIN) } },
        { precision: { kind: 'steps', count: 4 }, verification: 'inferred' },
      ),
      cap('link.state', 'enum', ['read', 'notify'], ok('disconnected'), { variants: LINK_VARIANTS, verification: 'inferred' }),
      cap('device.firmware', 'text', ['read'], ok('1.0.3', 185 * MIN, true), { verification: 'inferred' }),
      cap('mouse.dpi', 'dpi', ['read', 'write'], ok({ x: 1600, y: 1600 }, 185 * MIN, true), {
        constraint: { kind: 'dpi', min: 200, max: 26000, step: 100, independentXY: false },
        persistence: 'onboard',
        verification: 'inferred',
      }),
      cap(
        'mouse.polling_rate',
        'integer',
        ['read', 'write'],
        { state: 'unavailable', reason: 'disconnected', observedAt: iso(), lastOk: null },
        { unit: 'Hz', constraint: { kind: 'choices', values: [125, 250, 500, 1000] }, persistence: 'onboard', verification: 'broken' },
      ),
    ],
  },
];

const drivers = [
  {
    id: 'razer',
    name: 'Razer',
    version: '0.1.0',
    api: '0.1',
    license: 'AGPL-3.0-or-later',
    repository: 'https://github.com/WaiShe-Project/driver-razer',
    description: 'Razer 鼠标协议适配（mock）',
    trust: 'local',
    enabled: true,
    status: 'active',
    fault: null,
    models: [{ model: 'deathadder-v3-pro', name: 'Razer DeathAdder V3 Pro' }],
  },
  {
    id: 'hyperx',
    name: 'HyperX',
    version: '0.1.0',
    api: '0.1',
    license: 'MIT',
    repository: 'https://github.com/WaiShe-Project/driver-hyperx',
    description: 'HyperX 耳机与鼠标协议适配（mock）',
    trust: 'local',
    enabled: true,
    status: 'active',
    fault: null,
    models: [
      { model: 'cloud-iii-wireless', name: 'HyperX Cloud III Wireless' },
      { model: 'pulsefire-haste-2-wireless', name: 'HyperX Pulsefire Haste 2 Wireless' },
    ],
  },
];

let settings = {
  language: 'zh-CN',
  autostart: true,
  tray: { mode: 'lowest', deviceId: null },
  lowBattery: { enabled: true, threshold: 20, intervalMinutes: 60 },
  pollIntervalSeconds: 300,
  developerMode: false,
  network: { registry: true, updates: true },
};

const hidDevices = [
  { vendorId: 0x1532, productId: 0x00b7, product: 'Razer DeathAdder V3 Pro', manufacturer: 'Razer', usagePage: 0x0001, usage: 0x0002, interfaceNumber: 0, driver: 'razer' },
  { vendorId: 0x1532, productId: 0x00b7, product: 'Razer DeathAdder V3 Pro', manufacturer: 'Razer', usagePage: 0x000c, usage: 0x0001, interfaceNumber: 1, driver: 'razer' },
  { vendorId: 0x03f0, productId: 0x05b7, product: 'HyperX Cloud III Wireless', manufacturer: 'HP, Inc', usagePage: 0x000c, usage: 0x0001, interfaceNumber: 3, driver: 'hyperx' },
  { vendorId: 0x03f0, productId: 0x05b7, product: 'HyperX Cloud III Wireless', manufacturer: 'HP, Inc', usagePage: 0xff90, usage: 0x0303, interfaceNumber: 3, driver: 'hyperx' },
  { vendorId: 0x046d, productId: 0xc54d, product: 'USB Receiver', manufacturer: 'Logitech', usagePage: 0xff00, usage: 0x0001, interfaceNumber: 2, driver: null },
  { vendorId: 0x046d, productId: 0xc54d, product: 'USB Receiver', manufacturer: 'Logitech', usagePage: 0x0001, usage: 0x0006, interfaceNumber: 0, driver: null },
  { vendorId: 0x3434, productId: 0x0361, product: 'Keychron V6', manufacturer: 'Keychron', usagePage: 0x0001, usage: 0x0006, interfaceNumber: 0, driver: null },
  { vendorId: 0x0b05, productId: 0x19af, product: null, manufacturer: null, usagePage: 0xff72, usage: 0x00a1, interfaceNumber: 2, driver: null },
];

let localDriverCount = 0;

// ---- event stream ---------------------------------------------------------

const clients = new Set();

function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(frame);
}

setInterval(() => {
  for (const res of clients) res.write(': keepalive\n\n');
}, 15_000);

function findCap(deviceId, capId) {
  return devices.find((d) => d.id === deviceId)?.capabilities.find((c) => c.id === capId);
}

function setReading(deviceId, capId, reading) {
  const c = findCap(deviceId, capId);
  if (!c) return;
  c.reading = reading;
  broadcast('capability.changed', { deviceId, capability: c });
}

// Simulated device activity while someone is watching.
let tick = 0;
setInterval(() => {
  if (clients.size === 0) return;
  tick++;
  const mic = findCap('dev_8b21d4e6c3', 'headset.mic_mute');
  if (tick % 2 === 0 && mic?.reading.state === 'ok') setReading('dev_8b21d4e6c3', mic.id, ok(!mic.reading.value));
  if (tick % 3 === 0) {
    const level = findCap('dev_8b21d4e6c3', 'battery.level');
    const charging = findCap('dev_8b21d4e6c3', 'battery.charging');
    if (level?.reading.state === 'ok' && charging?.reading.state === 'ok') {
      // discharging -> (at 15%) charging -> (at 100%) full -> unplugged, discharging
      let next = level.reading.value;
      if (charging.reading.value === 'discharging') {
        next -= 1;
        if (next <= 15) setReading('dev_8b21d4e6c3', charging.id, ok('charging'));
      } else if (charging.reading.value === 'charging') {
        next = Math.min(100, next + 2);
        if (next === 100) setReading('dev_8b21d4e6c3', charging.id, ok('full'));
      } else {
        setReading('dev_8b21d4e6c3', charging.id, ok('discharging'));
      }
      setReading('dev_8b21d4e6c3', level.id, ok(next));
    }
  }
  if (tick % 5 === 0) {
    const level = findCap('dev_3f9c2a71b0', 'battery.level');
    if (level?.reading.state === 'ok') setReading('dev_3f9c2a71b0', level.id, ok(Math.max(1, level.reading.value - 1)));
  }
}, 4_000);

// ---- validation -----------------------------------------------------------

function checkNumber(v, c) {
  if (!Number.isInteger(v)) return 'value must be an integer';
  if (!c) return null;
  if (c.kind === 'choices') return c.values.includes(v) ? null : `value must be one of ${c.values.join(', ')}`;
  if (v < c.min || v > c.max) return `value must be between ${c.min} and ${c.max}`;
  if (c.step > 0 && (v - c.min) % c.step !== 0) return `value must be ${c.min} plus a multiple of ${c.step}`;
  return null;
}

function validateValue(c, value) {
  switch (c.type) {
    case 'dpi': {
      if (typeof value !== 'object' || value === null) return 'value must be { x, y }';
      const err = checkNumber(value.x, c.constraint) ?? checkNumber(value.y, c.constraint);
      if (err) return err;
      if (c.constraint && !c.constraint.independentXY && value.x !== value.y) return 'x and y must be equal';
      return null;
    }
    case 'integer':
    case 'percent':
      return checkNumber(value, c.constraint);
    case 'enum':
      if (typeof value !== 'string' || !(c.variants ?? []).includes(value)) return 'value is not a known variant';
      return null;
    case 'bool':
      return typeof value === 'boolean' ? null : 'value must be a boolean';
    case 'text':
      return typeof value === 'string' ? null : 'value must be a string';
    default:
      return 'unsupported type';
  }
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** Validates and merges a settings patch; returns an error string or the merged settings. */
function mergeSettings(patch) {
  if (typeof patch !== 'object' || patch === null) return 'body must be an object';
  const next = structuredClone(settings);
  for (const [key, value] of Object.entries(patch)) {
    switch (key) {
      case 'language':
        if (value !== 'zh-CN' && value !== 'en') return 'language must be zh-CN or en';
        next.language = value;
        break;
      case 'autostart':
      case 'developerMode':
        if (typeof value !== 'boolean') return `${key} must be a boolean`;
        next[key] = value;
        break;
      case 'pollIntervalSeconds':
        if (!isInt(value, 10, 86_400)) return 'pollIntervalSeconds must be an integer between 10 and 86400';
        next.pollIntervalSeconds = value;
        break;
      case 'tray':
        if (typeof value !== 'object' || value === null) return 'tray must be an object';
        if ('mode' in value) {
          if (value.mode !== 'lowest' && value.mode !== 'device') return 'tray.mode must be lowest or device';
          next.tray.mode = value.mode;
        }
        if ('deviceId' in value) {
          if (value.deviceId !== null && !devices.some((d) => d.id === value.deviceId)) return 'tray.deviceId is unknown';
          next.tray.deviceId = value.deviceId;
        }
        if (next.tray.mode === 'device' && next.tray.deviceId === null) return 'tray.deviceId is required in device mode';
        break;
      case 'lowBattery':
        if (typeof value !== 'object' || value === null) return 'lowBattery must be an object';
        if ('enabled' in value) {
          if (typeof value.enabled !== 'boolean') return 'lowBattery.enabled must be a boolean';
          next.lowBattery.enabled = value.enabled;
        }
        if ('threshold' in value) {
          if (!isInt(value.threshold, 1, 99)) return 'lowBattery.threshold must be an integer between 1 and 99';
          next.lowBattery.threshold = value.threshold;
        }
        if ('intervalMinutes' in value) {
          if (!isInt(value.intervalMinutes, 1, 1440)) return 'lowBattery.intervalMinutes must be between 1 and 1440';
          next.lowBattery.intervalMinutes = value.intervalMinutes;
        }
        break;
      case 'network':
        if (typeof value !== 'object' || value === null) return 'network must be an object';
        for (const k of ['registry', 'updates']) {
          if (k in value) {
            if (typeof value[k] !== 'boolean') return `network.${k} must be a boolean`;
            next.network[k] = value[k];
          }
        }
        break;
      default:
        return `unknown field ${key}`;
    }
  }
  return next;
}

// ---- HTTP -----------------------------------------------------------------

function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(data);
}

const error = (res, status, code, message = code) => send(res, status, { error: { code, message } });

async function readBody(req, limit = 16 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const buf = await readBody(req);
  try {
    return { ok: true, value: JSON.parse(buf.toString('utf8') || 'null') };
  } catch {
    return { ok: false };
  }
}

const sessions = new Set();

function hasSession(req) {
  const cookie = req.headers.cookie ?? '';
  for (const part of cookie.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === 'ws_session' && sessions.has(v)) return true;
  }
  return false;
}

const LOCAL_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/;
const LOCAL_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

async function handleApi(req, res, path) {
  const method = req.method ?? 'GET';
  const seg = path.split('/').filter(Boolean).map(decodeURIComponent);

  if (method === 'GET' && path === '/status') {
    return send(res, 200, {
      version: '0.1.0-mock',
      apiVersion: '0.1',
      driverAbi: '0.1',
      platform: 'windows-x64',
      port: PORT,
      vendorSoftware: ['Razer Synapse'],
    });
  }

  if (path === '/events' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (seg[0] === 'devices') {
    if (seg.length === 1 && method === 'GET') return send(res, 200, devices);
    const device = devices.find((d) => d.id === seg[1]);
    if (!device) return error(res, 404, 'device_not_found', 'device not found');
    if (seg.length === 2 && method === 'GET') return send(res, 200, device);
    if (seg.length === 2 && method === 'PATCH') {
      const body = await readJson(req);
      if (!body.ok || typeof body.value !== 'object' || body.value === null) return error(res, 422, 'invalid_value', 'body must be an object');
      const { alias, hidden } = body.value;
      if (alias !== undefined && alias !== null && (typeof alias !== 'string' || alias.length > 64)) {
        return error(res, 422, 'invalid_value', 'alias must be a string of at most 64 characters or null');
      }
      if (hidden !== undefined && typeof hidden !== 'boolean') return error(res, 422, 'invalid_value', 'hidden must be a boolean');
      if (alias !== undefined) device.alias = alias === null || alias.trim() === '' ? null : alias.trim();
      if (hidden !== undefined) device.hidden = hidden;
      broadcast('device.updated', device);
      return send(res, 200, device);
    }
    if (seg.length === 3 && seg[2] === 'refresh' && method === 'POST') {
      setTimeout(() => {
        if (device.link !== 'connected') return;
        for (const c of device.capabilities) {
          if (c.reading.state === 'ok') setReading(device.id, c.id, ok(c.reading.value));
        }
      }, 300);
      return send(res, 202, undefined);
    }
    if (seg.length === 4 && seg[2] === 'capabilities' && method === 'PUT') {
      const c = device.capabilities.find((x) => x.id === seg[3]);
      if (!c) return error(res, 404, 'capability_not_found', 'capability not found');
      if (!c.access.includes('write')) return error(res, 405, 'capability_not_writable', 'capability is read-only');
      const body = await readJson(req);
      if (!body.ok || typeof body.value !== 'object' || body.value === null || !('value' in body.value)) {
        return error(res, 422, 'invalid_value', 'body must be { "value": … }');
      }
      const value = body.value.value;
      const invalid = validateValue(c, value);
      if (invalid) return send(res, 422, { outcome: 'rejected', reading: c.reading, message: invalid });
      await sleep(WRITE_DELAY_MS);
      if (device.link !== 'connected') {
        return send(res, 502, { outcome: 'failed', reading: c.reading, message: 'device is not connected' });
      }
      if (c.id === 'headset.sleep_timer' && value === '30min') {
        await sleep(800);
        setReading(device.id, c.id, ok(c.reading.state === 'ok' ? c.reading.value : 'off'));
        return send(res, 502, { outcome: 'failed', reading: c.reading, message: 'timeout waiting for the device' });
      }
      if (c.id === 'mouse.lift_off_distance' && value === 3) {
        return send(res, 422, { outcome: 'rejected', reading: c.reading, message: 'the device refused the value' });
      }
      setReading(device.id, c.id, ok(value));
      const outcome = c.id === 'mouse.lift_off_distance' ? 'accepted' : 'applied';
      return send(res, 200, { outcome, reading: c.reading, message: null });
    }
    return error(res, 404, 'not_found', 'no such endpoint');
  }

  if (method === 'GET' && path === '/hid-devices') return send(res, 200, hidDevices);

  if (seg[0] === 'drivers') {
    if (seg.length === 1 && method === 'GET') return send(res, 200, drivers);
    if (seg.length === 1 && method === 'POST') {
      if (!settings.developerMode) return error(res, 403, 'developer_mode_required', 'developer mode is off');
      const buf = await readBody(req);
      const type = req.headers['content-type'] ?? '';
      if (!type.startsWith('application/zip') || buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) {
        return error(res, 422, 'driver_invalid', 'not a .wsdrv (zip) package');
      }
      localDriverCount++;
      const driver = {
        id: `local-${localDriverCount}`,
        name: `Local driver ${localDriverCount}`,
        version: '0.0.1',
        api: '0.1',
        license: 'UNLICENSED',
        repository: null,
        description: `Installed from a ${buf.length}-byte local package (mock)`,
        trust: 'local',
        enabled: true,
        status: 'active',
        fault: null,
        models: [],
      };
      drivers.push(driver);
      broadcast('driver.changed', driver);
      return send(res, 201, driver);
    }
    const driver = drivers.find((d) => d.id === seg[1]);
    if (!driver) return error(res, 404, 'driver_not_found', 'driver not found');
    if (seg.length === 2 && method === 'PATCH') {
      const body = await readJson(req);
      if (!body.ok || typeof body.value?.enabled !== 'boolean') return error(res, 422, 'invalid_value', 'enabled must be a boolean');
      await sleep(WRITE_DELAY_MS);
      driver.enabled = body.value.enabled;
      driver.status = driver.enabled ? 'active' : 'disabled';
      driver.fault = null;
      broadcast('driver.changed', driver);
      return send(res, 200, driver);
    }
    if (seg.length === 2 && method === 'DELETE') {
      await sleep(WRITE_DELAY_MS);
      drivers.splice(drivers.indexOf(driver), 1);
      broadcast('driver.changed', { id: driver.id, removed: true });
      return send(res, 204, undefined);
    }
    return error(res, 404, 'not_found', 'no such endpoint');
  }

  if (path === '/settings') {
    if (method === 'GET') return send(res, 200, settings);
    if (method === 'PATCH') {
      const body = await readJson(req);
      if (!body.ok) return error(res, 422, 'invalid_settings', 'body is not JSON');
      const merged = mergeSettings(body.value);
      if (typeof merged === 'string') return error(res, 422, 'invalid_settings', merged);
      await sleep(WRITE_DELAY_MS);
      settings = merged;
      broadcast('settings.changed', settings);
      return send(res, 200, settings);
    }
  }

  return error(res, 404, 'not_found', 'no such endpoint');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(res, path) {
  const rel = path === '/' ? 'index.html' : normalize(decodeURIComponent(path)).replace(/^[\\/]+/, '');
  const file = resolve(DIST, rel);
  if (!file.startsWith(DIST + sep) || !existsSync(file) || !statSync(file).isFile()) {
    if (!existsSync(join(DIST, 'index.html'))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('dist/ not found: run `npm run build` first, or use `npm run dev`.');
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (!LOCAL_HOST.test(req.headers.host ?? '')) return error(res, 403, 'forbidden_host', 'forbidden host');
    const origin = req.headers.origin;
    if (origin !== undefined && !LOCAL_ORIGIN.test(origin)) return error(res, 403, 'forbidden_origin', 'forbidden origin');

    if (url.pathname === '/auth') {
      if (url.searchParams.get('code') !== AUTH_CODE) return error(res, 401, 'unauthorized', 'invalid code');
      const token = randomBytes(24).toString('hex');
      sessions.add(token);
      res.writeHead(303, {
        'Set-Cookie': `ws_session=${token}; HttpOnly; SameSite=Strict; Path=/`,
        Location: '/',
      });
      return res.end();
    }

    if (url.pathname.startsWith('/api/v1/') || url.pathname === '/api/v1') {
      if (!hasSession(req)) return error(res, 401, 'unauthorized', 'missing or invalid session');
      return await handleApi(req, res, url.pathname.slice('/api/v1'.length) || '/');
    }
    if (url.pathname.startsWith('/api/')) return error(res, 404, 'not_found', 'no such endpoint');

    return serveStatic(res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) error(res, 500, 'internal', String(err));
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`WaiShe mock Bridge on http://127.0.0.1:${PORT}`);
  console.log(`Sign in: http://127.0.0.1:${PORT}/auth?code=${AUTH_CODE}`);
});
