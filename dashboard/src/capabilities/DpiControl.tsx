// DPI control: a fader with the common values marked as ticks under the track,
// exact X/Y inputs behind a disclosure. Nothing is optimistic: a value chosen
// but not yet confirmed is shown above the track, and the reading above only
// changes from Bridge.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { DpiValue } from '../api/types';
import { t } from '../i18n';
import { validate } from '../lib/constraint';
import { dpiScale, RESOLUTION, type DpiScale } from '../lib/dpiScale';
import { isDpi } from '../lib/reading';
import type { ControlProps } from './controls';
import { parseInteger, useDraft } from './draft';

/** Share of the track one PageUp/PageDown press moves. */
const PAGE = RESOLUTION / 20;

export function DpiControl(props: ControlProps) {
  const { cap, writer, current, disabled, labelId, feedbackId } = props;
  const c = cap.constraint?.kind === 'dpi' ? cap.constraint : null;
  const scale = useMemo(() => (c ? dpiScale(c.min, c.max, c.step) : null), [c?.min, c?.max, c?.step]);
  const cur = current !== undefined && isDpi(current) ? current : null;
  const independent = c?.independentXY ?? true;
  const [pending, setPending] = useState<number | null>(null);
  // Drop the pending value once a write finishes; the response decides what is shown.
  useEffect(() => {
    if (!writer.pending) setPending(null);
  }, [writer.pending]);

  const off = disabled || writer.pending;
  const send = (v: number) => {
    if (cur && cur.x === v && cur.y === v) {
      setPending(null);
      return;
    }
    setPending(v);
    void writer.write({ x: v, y: v });
  };

  return (
    <div class="dpi-control">
      {scale && (
        <Fader
          scale={scale}
          current={cur}
          pending={pending !== null && pending !== cur?.x ? pending : null}
          writing={writer.pending}
          disabled={off}
          labelId={labelId}
          feedbackId={feedbackId}
          onPending={setPending}
          onCommit={send}
        />
      )}
      {cur && cur.x !== cur.y && <p class="note">{t('dpi.xyDiffer', { x: cur.x, y: cur.y })}</p>}
      <details class="advanced">
        <summary>{independent ? t('dpi.advancedXY') : t('dpi.advancedValue')}</summary>
        <DpiInputs {...props} cur={cur} independent={independent} />
      </details>
    </div>
  );
}

interface FaderProps {
  scale: DpiScale;
  current: DpiValue | null;
  /** Value chosen but not yet confirmed by Bridge, or null. */
  pending: number | null;
  writing: boolean;
  disabled: boolean;
  labelId: string;
  feedbackId: string;
  onPending: (v: number | null) => void;
  onCommit: (v: number) => void;
}

function Fader({ scale, current, pending, writing, disabled, labelId, feedbackId, onPending, onCommit }: FaderProps) {
  const hintId = `${labelId}-hint`;
  // The thumb only exists when there is a value: a thumb at the minimum would read as one.
  const value = pending ?? current?.x ?? null;
  const crowded = useMemo(() => crowdedTicks(scale), [scale]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (value === null) return;
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = scale.snap(value + scale.step);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = scale.snap(value - scale.step);
        break;
      case 'PageUp':
        next = Math.max(scale.snap(value + scale.step), scale.toValue(scale.toPosition(value) + PAGE));
        break;
      case 'PageDown':
        next = Math.min(scale.snap(value - scale.step), scale.toValue(scale.toPosition(value) - PAGE));
        break;
      case 'Home':
        next = scale.min;
        break;
      case 'End':
        next = scale.max;
        break;
      case 'Enter':
        e.preventDefault();
        if (pending !== null) onCommit(pending);
        return;
      case 'Escape':
        if (pending !== null) {
          e.preventDefault();
          onPending(null);
        }
        return;
      default:
        return;
    }
    // Keys move by one step in DPI, not by one slider position.
    e.preventDefault();
    onPending(next);
  };

  return (
    <div class="fader">
      <div class="fader-pending" aria-live="polite">
        {pending !== null && (
          <>
            <span class="num fader-pending-value">{pending}</span>
            {!writing && (
              <>
                <span class="note">{t('dpi.pending')}</span>
                <button type="button" class="btn btn-primary" disabled={disabled} onClick={() => onCommit(pending)}>
                  {t('dpi.apply')}
                </button>
              </>
            )}
          </>
        )}
      </div>
      {value === null ? (
        <div class="fader-rail" aria-hidden="true" />
      ) : (
        <input
          type="range"
          class="fader-input"
          min={0}
          max={RESOLUTION}
          step={1}
          value={scale.toPosition(value)}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-valuetext={`${value} DPI`}
          aria-describedby={`${hintId} ${feedbackId}`}
          onInput={(e) => onPending(scale.toValue(Number(e.currentTarget.value)))}
          // `change` fires on pointer release; keyboard changes are committed with Enter.
          onChange={(e) => onCommit(scale.toValue(Number(e.currentTarget.value)))}
          onKeyDown={onKeyDown}
        />
      )}
      <span class="sr-only" id={hintId}>
        {t('dpi.keyboardHint')}
      </span>
      {scale.presets.length > 0 && (
        <div class="ticks" role="group" aria-label={t('dpi.presets')}>
          {scale.presets.map((p, i) => {
            const pressed = current !== null && current.x === p && current.y === p;
            const quiet = crowded[i] && !pressed;
            return (
              <button
                type="button"
                key={p}
                class={`tick num${quiet ? ' is-crowded' : ''}`}
                style={{ left: `${(scale.toPosition(p) / RESOLUTION) * 100}%` }}
                aria-pressed={pressed}
                aria-label={`${p} DPI`}
                disabled={disabled}
                onClick={() => onCommit(p)}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Ticks closer than this share of the track may collide on a narrow fader. */
const CROWDED = 0.09;

/**
 * Of two ticks that sit too close, the one in the denser neighbourhood is
 * marked so a narrow fader can drop its label (the tick itself stays).
 */
function crowdedTicks(scale: DpiScale): boolean[] {
  const pos = scale.presets.map((p) => scale.toPosition(p) / RESOLUTION);
  const flags = pos.map(() => false);
  for (let i = 1; i < pos.length; i++) {
    const a = pos[i - 1] as number;
    const b = pos[i] as number;
    if (b - a >= CROWDED || flags[i - 1]) continue;
    const gapBeforeA = i >= 2 ? a - (pos[i - 2] as number) : Infinity;
    const gapAfterB = i + 1 < pos.length ? (pos[i + 1] as number) - b : Infinity;
    flags[gapBeforeA < gapAfterB ? i - 1 : i] = true;
  }
  return flags;
}

function DpiInputs({
  cap,
  writer,
  disabled,
  feedbackId,
  cur,
  independent,
}: ControlProps & { cur: DpiValue | null; independent: boolean }) {
  const c = cap.constraint?.kind === 'dpi' ? cap.constraint : null;
  const [x, setX] = useDraft(cur ? String(cur.x) : '');
  const [y, setY] = useDraft(cur ? String(cur.y) : '');
  const xv = parseInteger(x);
  const value = { x: xv, y: independent ? parseInteger(y) : xv };
  const empty = x === '' || (independent && y === '');
  const error = empty ? null : validate(cap, value);
  const unchanged = cur !== null && cur.x === value.x && cur.y === value.y;
  const off = disabled || writer.pending;
  const field = (label: string, v: string, set: (v: string) => void) => (
    <label class="field-stack">
      <span class="field-label">{label}</span>
      <input
        type="number"
        class="input input-number num"
        inputMode="numeric"
        min={c?.min}
        max={c?.max}
        step={c?.step}
        value={v}
        disabled={off}
        aria-invalid={error !== null}
        aria-describedby={feedbackId}
        onInput={(e) => set(e.currentTarget.value)}
      />
    </label>
  );
  return (
    <form
      class="dpi-inputs"
      onSubmit={(e) => {
        e.preventDefault();
        void writer.write(value);
      }}
    >
      <div class="field-row-inline">
        {independent ? (
          <>
            {field(t('dpi.x'), x, setX)}
            {field(t('dpi.y'), y, setY)}
          </>
        ) : (
          field(t('dpi.value'), x, setX)
        )}
        <button type="submit" class="btn btn-primary" disabled={off || empty || error !== null || unchanged}>
          {t('dpi.apply')}
        </button>
      </div>
      {c && <p class="note num-inline">{t('dpi.range', { min: c.min, max: c.max, step: c.step })}</p>}
      {error && <p class="field-error">{error}</p>}
    </form>
  );
}
