import type { Capability, CapabilityValue, Device } from '../api/types';
import { linkLabel, reasonLabel, t, tMaybe, variantLabel } from '../i18n';
import { isDpi, viewOf, type View } from '../lib/reading';
import { RelativeTime } from './common';

/** Human-readable value for any capability type. Battery precision is handled by BatteryFigure. */
export function formatValue(cap: Capability, value: CapabilityValue): string {
  if (isDpi(value)) {
    const independent = cap.constraint?.kind === 'dpi' ? cap.constraint.independentXY : true;
    return !independent && value.x === value.y ? String(value.x) : `${value.x} × ${value.y}`;
  }
  if (typeof value === 'boolean') {
    return tMaybe(`bool.${cap.id}.${value}`) ?? t(value ? 'common.on' : 'common.off');
  }
  if (cap.type === 'enum' && typeof value === 'string') return variantLabel(cap.id, value);
  if (cap.type === 'percent' && typeof value === 'number') return `${value}%`;
  if (typeof value === 'number' && cap.unit) return `${value} ${cap.unit}`;
  return String(value);
}

/** Numbers and DPI pairs are set in the condensed numeral face. */
function isNumeric(v: CapabilityValue): boolean {
  return typeof v === 'number' || isDpi(v);
}

interface ReadingProps {
  cap: Capability;
  link: Device['link'];
  /** Extra class for the value, e.g. a size. */
  size?: string;
  /** Hides the read time of live values (lists, compact rows). */
  compact?: boolean;
}

/**
 * Renders a reading according to its state. Live values appear plainly; stale
 * values or values of a device that is not connected are drawn like an unlit
 * LED and carry their read time; unavailable readings say so and may show the
 * last good value; unknown says so. A missing value is never drawn as 0.
 */
export function ReadingValue({ cap, link, size, compact }: ReadingProps) {
  const view = viewOf(cap, link);
  const value = (v: CapabilityValue, historical: boolean) => (
    <span class={`rv-value${isNumeric(v) ? ' num' : ''}${historical ? ' is-off' : ''}${size ? ` ${size}` : ''}`}>
      {formatValue(cap, v)}
      {historical && <span class="sr-only"> ({t('reading.historical')})</span>}
    </span>
  );
  switch (view.kind) {
    case 'live':
      return (
        <span class="rv">
          {value(view.value, false)}
          {!compact && (
            <span class="rv-time">
              <RelativeTime iso={view.observedAt} label="time.at" />
            </span>
          )}
        </span>
      );
    case 'historical':
      return (
        <span class="rv">
          {value(view.value, true)}
          <span class="rv-time">
            <RelativeTime iso={view.observedAt} label="time.lastRead" />
          </span>
        </span>
      );
    case 'unavailable':
      return (
        <span class="rv">
          <span class="rv-state">{t('reading.unavailable', { reason: reasonLabel(view.reason) })}</span>
          {view.last && (
            <>
              {value(view.last.value, true)}
              <span class="rv-time">
                <RelativeTime iso={view.last.observedAt} label="time.lastRead" />
              </span>
            </>
          )}
        </span>
      );
    case 'unknown':
      return <span class="rv rv-state">{t('reading.unknown')}</span>;
  }
}

export type Tone = 'normal' | 'low' | 'fault' | 'off';

/** Battery colour: unlit when not live, red at 10 % or less, amber at or below the alert threshold. */
function toneOf(view: View, value: number, threshold: number): Tone {
  if (view.kind !== 'live') return 'off';
  if (value <= 10) return 'fault';
  if (value <= threshold) return 'low';
  return 'normal';
}

interface BatteryProps {
  cap: Capability;
  link: Device['link'];
  /** `settings.lowBattery.threshold`. */
  threshold: number;
  /** `fig-m` (list), `fig-l` (detail), `fig-s` (panel). */
  size: string;
}

/**
 * The battery numeral. Step-precision batteries show filled steps ("3/4") and a
 * segment bar, never a percentage. Read time and reasons go in BatteryNote.
 */
export function BatteryFigure({ cap, link, threshold, size }: BatteryProps) {
  const view = viewOf(cap, link);
  const raw = view.kind === 'live' || view.kind === 'historical' ? view.value : view.kind === 'unavailable' ? view.last?.value : undefined;
  if (typeof raw !== 'number') {
    return (
      <span class={`fig ${size} fig-empty`}>
        {view.kind === 'unknown' ? t('battery.unknown') : t('battery.unavailable')}
      </span>
    );
  }
  const tone = toneOf(view, raw, threshold);
  const historical = view.kind !== 'live' && <span class="sr-only"> ({t('reading.historical')})</span>;
  const precision = cap.precision;
  if (precision?.kind === 'steps' && precision.count > 0) {
    const filled = Math.max(0, Math.min(precision.count, Math.round((raw / 100) * precision.count)));
    return (
      <span class={`fig ${size} is-${tone}`} title={t('battery.stepsHint')}>
        <span class="sr-only">
          {t('battery.stepsLabel', { filled, count: precision.count })}
          {historical}
        </span>
        <span class="fig-number num" aria-hidden="true">
          {filled}/{precision.count}
          <span class="fig-unit">{t('battery.stepsUnit')}</span>
        </span>
        <span class="segments" aria-hidden="true">
          {Array.from({ length: precision.count }, (_, i) => (
            <span class={i < filled ? 'segment is-lit' : 'segment'} key={i} />
          ))}
        </span>
      </span>
    );
  }
  return (
    <span class={`fig ${size} is-${tone}`}>
      <span class="fig-number num">
        {raw}
        <span class="fig-unit">%</span>
      </span>
      {historical}
    </span>
  );
}

/**
 * One quiet line explaining a battery figure that is not live: reason and last
 * read time. "Device disconnected" is left out when the link LED beside it
 * already says so.
 */
export function BatteryNote({ cap, link }: { cap: Capability; link: Device['link'] }) {
  const view = viewOf(cap, link);
  if (view.kind === 'historical') {
    return (
      <span class="note">
        <RelativeTime iso={view.observedAt} label="time.lastRead" />
      </span>
    );
  }
  if (view.kind === 'unavailable') {
    const reasonShownByLed = view.reason === 'disconnected' && link === 'disconnected';
    return (
      <span class="note">
        {!reasonShownByLed && t('reading.unavailable', { reason: reasonLabel(view.reason) })}
        {!reasonShownByLed && view.last && ' '}
        {view.last ? (
          <RelativeTime iso={view.last.observedAt} label="time.lastRead" />
        ) : (
          reasonShownByLed && t('reading.unavailable', { reason: reasonLabel(view.reason) })
        )}
      </span>
    );
  }
  return null;
}

/** Status LED plus label for the device link. */
export function LinkLed({ link }: { link: Device['link'] }) {
  const led = link === 'connected' ? 'is-on' : link === 'disconnected' ? 'is-hollow' : 'is-off';
  return (
    <span class="led-label">
      <span class={`led ${led}`} aria-hidden="true" />
      {linkLabel(link)}
    </span>
  );
}

/** Short live-only status words for list rows: charging state and mic mute. */
export function liveStatus(device: Device): string[] {
  const out: string[] = [];
  for (const cap of device.capabilities) {
    const view = viewOf(cap, device.link);
    if (view.kind !== 'live') continue;
    if (cap.id === 'battery.charging' && typeof view.value === 'string') out.push(variantLabel(cap.id, view.value));
    if (cap.id === 'headset.mic_mute' && typeof view.value === 'boolean') {
      out.push(t(view.value ? 'status.micMuted' : 'status.micOn'));
    }
  }
  return out;
}
