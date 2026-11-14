import type { Capability, CapabilityValue, Device } from '../api/types';
import { linkLabel, reasonLabel, t, tMaybe, variantLabel } from '../i18n';
import { isDpi, viewOf, type View } from '../lib/reading';
import { RelativeTime } from './common';
import { BatteryIcon } from './icons';

/** Human-readable value for any capability type. Battery precision is handled by BatteryFigure. */
export function formatValue(cap: Capability, value: CapabilityValue): string {
  if (isDpi(value)) {
    return value.x === value.y ? `${value.x} ${t('dpi.unit')}` : `X ${value.x} / Y ${value.y} ${t('dpi.unit')}`;
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
  size?: string | undefined;
  /** Hides the read time of live values (lists, compact rows). */
  compact?: boolean | undefined;
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
          <span class="rv-time rv-historical">
            {t('reading.historical')} · <RelativeTime iso={view.observedAt} label="time.lastRead" />
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
              <span class="rv-time rv-historical">
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
export function batteryToneOf(view: View, value: number, threshold: number): Tone {
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
  /** Optional charging capability to show charging bolt on the battery icon. */
  chargingCap?: Capability | undefined;
}

/**
 * Battery indicator with icon, progress/step bar, and compact numeral.
 * Step-precision batteries show filled steps ("3/4") and a segment bar, never
 * a percentage. Read time and reasons go in BatteryNote.
 */
export function BatteryFigure({ cap, link, threshold, size, chargingCap }: BatteryProps) {
  const view = viewOf(cap, link);
  const raw =
    view.kind === 'live' || view.kind === 'historical'
      ? view.value
      : view.kind === 'unavailable'
        ? view.last?.value
        : undefined;
  const chargingView = chargingCap ? viewOf(chargingCap, link) : null;
  const isCharging = chargingView?.kind === 'live' && chargingView.value === 'charging';

  if (typeof raw !== 'number') {
    return (
      <span class={`fig ${size} fig-empty is-off`}>
        <span class="fig-head">
          <BatteryIcon unavailable size={size === 'fig-s' ? 16 : 18} />
          <span class="fig-empty-text">
            {view.kind === 'unknown' ? t('battery.unknown') : t('battery.unavailable')}
          </span>
        </span>
      </span>
    );
  }

  const tone = batteryToneOf(view, raw, threshold);
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
        <span class="fig-head" aria-hidden="true">
          <BatteryIcon level={raw} charging={isCharging} size={size === 'fig-s' ? 16 : 18} />
          <span class="fig-number num">
            {filled}/{precision.count}
            <span class="fig-unit">{t('battery.stepsUnit')}</span>
          </span>
        </span>
        <span class="segments" aria-hidden="true">
          {Array.from({ length: precision.count }, (_, i) => (
            <span class={i < filled ? 'segment is-lit' : 'segment'} key={i} />
          ))}
        </span>
      </span>
    );
  }

  const clamped = Math.max(0, Math.min(100, raw));
  return (
    <span class={`fig ${size} is-${tone}`}>
      <span class="fig-head">
        <BatteryIcon level={clamped} charging={isCharging} size={size === 'fig-s' ? 16 : 18} />
        <span class="fig-number num">
          {clamped}
          <span class="fig-unit">%</span>
        </span>
      </span>
      <span class="battery-bar" aria-hidden="true">
        <span class="battery-bar-fill" style={{ width: `${clamped}%` }} />
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
export function LinkLed({ link, pill }: { link: Device['link']; pill?: boolean | undefined }) {
  const led = link === 'connected' ? 'is-on' : link === 'disconnected' ? 'is-hollow' : 'is-off';
  const toneClass = link === 'connected' ? 'is-ok' : link === 'disconnected' ? 'is-off' : 'is-muted';
  return (
    <span class={pill ? `status-pill ${toneClass}` : 'led-label'}>
      <span class={`led ${led}`} aria-hidden="true" />
      <span>{linkLabel(link)}</span>
    </span>
  );
}

/** Short live-only status words for compact list rows: charging state and mic mute. */
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

/** Live key parameter badges for the device card identity zone (DPI, polling rate, mic state). */
export function deviceSummaryChips(device: Device): Array<{ id: string; text: string; tone?: 'ok' | 'low' | 'neutral' }> {
  const chips: Array<{ id: string; text: string; tone?: 'ok' | 'low' | 'neutral' }> = [];
  for (const cap of device.capabilities) {
    const view = viewOf(cap, device.link);
    if (view.kind !== 'live') continue;
    if (cap.id === 'mouse.dpi' && isDpi(view.value)) {
      chips.push({ id: cap.id, text: formatValue(cap, view.value), tone: 'neutral' });
    } else if (cap.id === 'mouse.polling_rate' && typeof view.value === 'number') {
      chips.push({ id: cap.id, text: formatValue(cap, view.value), tone: 'neutral' });
    } else if (cap.id === 'headset.mic_mute' && typeof view.value === 'boolean') {
      chips.push({
        id: cap.id,
        text: t(view.value ? 'status.micMuted' : 'status.micOn'),
        tone: view.value ? 'low' : 'ok',
      });
    }
  }
  return chips;
}
