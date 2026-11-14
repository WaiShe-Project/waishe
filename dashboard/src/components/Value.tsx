import type { ComponentChildren } from 'preact';
import type { Capability, CapabilityValue, Device } from '../api/types';
import { reasonLabel, t, tMaybe, variantLabel } from '../i18n';
import { isDpi, viewOf, type View } from '../lib/reading';
import { RelativeTime } from './common';

/** Human-readable value for any capability type. Battery precision is handled by BatteryMeter. */
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

type Render = (value: CapabilityValue, historical: boolean) => ComponentChildren;

interface ReadingProps {
  cap: Capability;
  link: Device['link'];
  /** Custom value rendering; defaults to formatted text. */
  render?: Render;
  /** Compact layout for cards: hides the reading time of live values. */
  compact?: boolean;
}

/**
 * Renders a reading according to its state. Live values appear plainly; stale
 * values or values of a device that is not connected are muted and carry their
 * read time; unavailable readings say so and may show the last good value.
 */
export function ReadingValue({ cap, link, render, compact }: ReadingProps) {
  const view = viewOf(cap, link);
  const show: Render = render ?? ((v) => formatValue(cap, v));
  return <ViewValue view={view} show={show} compact={compact ?? false} />;
}

function ViewValue({ view, show, compact }: { view: View; show: Render; compact: boolean }) {
  switch (view.kind) {
    case 'live':
      return (
        <span class="reading is-live">
          <span class="reading-value">{show(view.value, false)}</span>
          {!compact && (
            <span class="reading-time">
              <RelativeTime iso={view.observedAt} label="time.at" />
            </span>
          )}
        </span>
      );
    case 'historical':
      return <Historical value={show(view.value, true)} observedAt={view.observedAt} />;
    case 'unavailable':
      return (
        <span class="reading is-unavailable">
          <span class="reading-state">
            {t('reading.unavailable', { reason: reasonLabel(view.reason) })}
          </span>
          {view.last && <Historical value={show(view.last.value, true)} observedAt={view.last.observedAt} />}
        </span>
      );
    case 'unknown':
      return <span class="reading is-unknown">{t('reading.unknown')}</span>;
  }
}

function Historical({ value, observedAt }: { value: ComponentChildren; observedAt: string }) {
  return (
    <span class="reading is-historical">
      <span class="tag tag-muted">{t('reading.historical')}</span>{' '}
      <span class="reading-value">{value}</span>{' '}
      <span class="reading-time">
        <RelativeTime iso={observedAt} label="time.lastRead" />
      </span>
    </span>
  );
}

interface BatteryProps {
  cap: Capability;
  link: Device['link'];
  compact?: boolean;
}

/** Battery bar; with step precision it shows filled steps instead of a percentage. */
export function BatteryMeter({ cap, link, compact }: BatteryProps) {
  const precision = cap.precision;
  const render: Render = (value, historical) => {
    if (typeof value !== 'number') return String(value);
    const cls = `battery${historical ? ' is-historical' : ''}${value <= 20 ? ' is-low' : ''}`;
    if (precision?.kind === 'steps' && precision.count > 0) {
      const filled = Math.max(0, Math.min(precision.count, Math.round((value / 100) * precision.count)));
      const label = t('battery.steps', { filled, count: precision.count });
      return (
        <span class={cls} title={t('battery.stepsHint')}>
          <span class="battery-steps" role="img" aria-label={label}>
            {Array.from({ length: precision.count }, (_, i) => (
              <span class={i < filled ? 'step is-on' : 'step'} key={i} />
            ))}
          </span>
          <span class="battery-text">{label}</span>
        </span>
      );
    }
    return (
      <span class={cls}>
        <span class="battery-bar" role="img" aria-label={`${value}%`}>
          <span class="battery-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        </span>
        <span class="battery-text">{value}%</span>
      </span>
    );
  };
  return <ReadingValue cap={cap} link={link} render={render} compact={compact ?? false} />;
}
