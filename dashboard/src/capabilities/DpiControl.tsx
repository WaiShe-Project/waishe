// DPI control: presets and a non-linear slider for everyday use, exact X/Y
// inputs behind a disclosure. Nothing is optimistic: the pending value is shown
// next to the slider, and the current value only changes from Bridge.

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
      {scale && scale.presets.length > 0 && (
        <div class="choices dpi-presets" role="group" aria-label={t('dpi.presets')} aria-describedby={feedbackId}>
          {scale.presets.map((p) => {
            const pressed = cur !== null && cur.x === p && cur.y === p;
            return (
              <button
                type="button"
                key={p}
                class={`choice${pressed ? ' is-pressed' : ''}`}
                aria-pressed={pressed}
                disabled={off}
                onClick={() => send(p)}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
      {scale && cur && (
        <DpiSlider
          scale={scale}
          value={pending ?? cur.x}
          pending={pending !== null && pending !== cur.x ? pending : null}
          writing={writer.pending}
          disabled={off}
          labelId={labelId}
          feedbackId={feedbackId}
          onPending={setPending}
          onCommit={send}
        />
      )}
      {cur && cur.x !== cur.y && <p class="hint">{t('dpi.xyDiffer', { x: cur.x, y: cur.y })}</p>}
      <details class="dpi-advanced">
        <summary>{independent ? t('dpi.advancedXY') : t('dpi.advancedValue')}</summary>
        <DpiInputs {...props} cur={cur} independent={independent} />
      </details>
    </div>
  );
}

interface SliderProps {
  scale: DpiScale;
  /** Value under the thumb: the pending value, else the reported one. */
  value: number;
  /** Value chosen but not yet confirmed by Bridge, or null. */
  pending: number | null;
  writing: boolean;
  disabled: boolean;
  labelId: string;
  feedbackId: string;
  onPending: (v: number | null) => void;
  onCommit: (v: number) => void;
}

function DpiSlider({ scale, value, pending, writing, disabled, labelId, feedbackId, onPending, onCommit }: SliderProps) {
  const hintId = `${labelId}-slider-hint`;
  const onKeyDown = (e: KeyboardEvent) => {
    let next: number | null = null;
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
    <div class="dpi-slider">
      <input
        type="range"
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
      <output class={`dpi-value${pending !== null ? ' is-pending' : ''}`} aria-hidden="true">
        {value}
      </output>
      {pending !== null && !writing && (
        <>
          <span class="tag tag-muted">{t('dpi.pending')}</span>
          <button type="button" class="btn btn-primary" disabled={disabled} onClick={() => onCommit(pending)}>
            {t('common.apply')}
          </button>
        </>
      )}
      <p class="hint dpi-slider-hint" id={hintId}>
        {t('dpi.keyboardHint')}
      </p>
    </div>
  );
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
    <label class="dpi-field">
      <span>{label}</span>
      <input
        type="number"
        class="input input-number"
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
      <div class="dpi-fields">
        {independent ? (
          <>
            {field(t('dpi.x'), x, setX)}
            {field(t('dpi.y'), y, setY)}
          </>
        ) : (
          field(t('dpi.value'), x, setX)
        )}
        <button type="submit" class="btn btn-primary" disabled={off || empty || error !== null || unchanged}>
          {t('common.apply')}
        </button>
      </div>
      {c && <p class="hint">{t('dpi.range', { min: c.min, max: c.max, step: c.step })}</p>}
      {error && <p class="field-error">{error}</p>}
    </form>
  );
}
