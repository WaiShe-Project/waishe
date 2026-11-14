// DPI control: slider + inline exact numeric input + preset chips, with
// optional independent X/Y controls behind an expandable advanced section.
// Draft edits are clearly distinguished from the confirmed device value.

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
  const cur = current !== undefined && isDpi(current) ? current : null;

  // Discrete-only DPI choices (e.g., sensors with fixed DPI steps).
  if (cap.constraint?.kind === 'choices') {
    const choices = cap.constraint.values.filter((v): v is number => typeof v === 'number');
    return (
      <div class="dpi-control">
        <div class="dpi-presets-row">
          <span class="dpi-presets-label">{t('dpi.presets')}</span>
          <div class="dpi-presets-list" role="group" aria-labelledby={labelId} aria-describedby={feedbackId}>
            {choices.map((p) => {
              const pressed = cur !== null && cur.x === p && cur.y === p;
              return (
                <button
                  type="button"
                  key={p}
                  class="preset-chip num"
                  aria-pressed={pressed}
                  aria-label={`${p} ${t('dpi.unit')}`}
                  disabled={disabled || writer.pending}
                  onClick={() => {
                    if (!pressed) void writer.write({ x: p, y: p });
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const c = cap.constraint?.kind === 'dpi' ? cap.constraint : null;
  const scale = useMemo(() => (c ? dpiScale(c.min, c.max, c.step) : null), [c?.min, c?.max, c?.step]);
  const independent = c?.independentXY ?? false;
  const xyDiffer = cur !== null && cur.x !== cur.y;

  const syncedSource = cur ? String(cur.x) : '';
  const [draft, setDraft] = useDraft(syncedSource);
  const [submittingValue, setSubmittingValue] = useState<number | null>(null);

  useEffect(() => {
    if (!writer.pending) setSubmittingValue(null);
  }, [writer.pending]);

  const parsed = parseInteger(draft);
  const singleError = draft === '' ? null : validate(cap, { x: parsed, y: parsed });
  const isEditing =
    draft !== '' &&
    !Number.isNaN(parsed) &&
    (cur === null || cur.x !== parsed || cur.y !== parsed) &&
    submittingValue === null;

  const off = disabled || writer.pending;

  const commitUniform = (v: number) => {
    if (cur && cur.x === v && cur.y === v) {
      setDraft(String(v));
      return;
    }
    setDraft(String(v));
    setSubmittingValue(v);
    void writer.write({ x: v, y: v });
  };

  return (
    <div class="dpi-control">
      {scale ? (
        <ContinuousDpiRow
          scale={scale}
          cur={cur}
          draft={draft}
          parsed={parsed}
          error={singleError}
          isEditing={isEditing}
          disabled={off}
          labelId={labelId}
          feedbackId={feedbackId}
          onDraftChange={setDraft}
          onCommit={commitUniform}
          onCancelEdit={() => setDraft(cur ? String(cur.x) : '')}
        />
      ) : (
        <DpiInputs {...props} cur={cur} independent={independent} />
      )}

      {scale && scale.presets.length > 0 && (
        <div class="dpi-presets-row">
          <span class="dpi-presets-label">{t('dpi.presets')}</span>
          <div class="dpi-presets-list" role="group" aria-label={t('dpi.presets')}>
            {scale.presets.map((p) => {
              const pressed = cur !== null && cur.x === p && cur.y === p;
              return (
                <button
                  type="button"
                  key={p}
                  class="preset-chip num"
                  aria-pressed={pressed}
                  aria-label={`${p} ${t('dpi.unit')}`}
                  disabled={off}
                  onClick={() => commitUniform(p)}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {c && <p class="note dpi-range-note">{t('dpi.range', { min: c.min, max: c.max, step: c.step })}</p>}

      {xyDiffer && <p class="note dpi-differ-note">{t('dpi.xyDiffer', { x: cur.x, y: cur.y })}</p>}

      {scale && (independent || xyDiffer) && (
        <details class="advanced" open={xyDiffer}>
          <summary>{t('dpi.advancedXY')}</summary>
          <DpiInputs {...props} cur={cur} independent={independent || xyDiffer} />
        </details>
      )}
    </div>
  );
}

interface ContinuousProps {
  scale: DpiScale;
  cur: DpiValue | null;
  draft: string;
  parsed: number;
  error: string | null;
  isEditing: boolean;
  disabled: boolean;
  labelId: string;
  feedbackId: string;
  onDraftChange: (text: string) => void;
  onCommit: (v: number) => void;
  onCancelEdit: () => void;
}

function ContinuousDpiRow({
  scale,
  cur,
  draft,
  parsed,
  error,
  isEditing,
  disabled,
  labelId,
  feedbackId,
  onDraftChange,
  onCommit,
  onCancelEdit,
}: ContinuousProps) {
  const hintId = `${labelId}-hint`;
  const sliderVal = !Number.isNaN(parsed) ? parsed : cur?.x ?? null;
  const canApply = !disabled && draft !== '' && error === null && (cur === null || cur.x !== parsed || cur.y !== parsed);

  const onKeyDown = (e: KeyboardEvent) => {
    const base = sliderVal ?? scale.min;
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = scale.snap(base + scale.step);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = scale.snap(base - scale.step);
        break;
      case 'PageUp':
        next = Math.max(scale.snap(base + scale.step), scale.toValue(scale.toPosition(base) + PAGE));
        break;
      case 'PageDown':
        next = Math.min(scale.snap(base - scale.step), scale.toValue(scale.toPosition(base) - PAGE));
        break;
      case 'Home':
        next = scale.min;
        break;
      case 'End':
        next = scale.max;
        break;
      case 'Enter':
        e.preventDefault();
        if (canApply) onCommit(parsed);
        return;
      case 'Escape':
        if (isEditing) {
          e.preventDefault();
          onCancelEdit();
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    onDraftChange(String(next));
  };

  return (
    <form
      class="dpi-main-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (canApply) onCommit(parsed);
      }}
    >
      <div class="dpi-slider-combo">
        <div class="dpi-track-wrap">
          {sliderVal === null ? (
            <div class="fader-rail" aria-hidden="true" />
          ) : (
            <input
              type="range"
              class="fader-input"
              min={0}
              max={RESOLUTION}
              step={1}
              value={scale.toPosition(sliderVal)}
              disabled={disabled}
              aria-labelledby={labelId}
              aria-valuetext={`${sliderVal} ${t('dpi.unit')}`}
              aria-describedby={`${hintId} ${feedbackId}`}
              onInput={(e) => onDraftChange(String(scale.toValue(Number(e.currentTarget.value))))}
              onChange={(e) => onCommit(scale.toValue(Number(e.currentTarget.value)))}
              onKeyDown={onKeyDown}
            />
          )}
          <span class="sr-only" id={hintId}>
            {t('dpi.keyboardHint')}
          </span>
        </div>

        <div class="dpi-input-group">
          <label class="sr-only" for={`${labelId}-exact`}>
            {t('dpi.inputLabel')}
          </label>
          <span class="input-with-unit">
            <input
              id={`${labelId}-exact`}
              type="number"
              class="input input-number num"
              inputMode="numeric"
              min={scale.min}
              max={scale.max}
              step={scale.step}
              value={draft}
              disabled={disabled}
              aria-invalid={error !== null}
              aria-describedby={feedbackId}
              onInput={(e) => onDraftChange(e.currentTarget.value)}
            />
            <span class="unit">{t('dpi.unit')}</span>
          </span>
          <button type="submit" class="btn btn-primary" disabled={!canApply}>
            {t('dpi.apply')}
          </button>
        </div>
      </div>

      {(isEditing || error) && (
        <div class="dpi-edit-meta" aria-live="polite">
          {isEditing && !error && (
            <span class="badge badge-warn">
              {t('dpi.editingLabel')}: <strong class="num">{parsed} {t('dpi.unit')}</strong>
            </span>
          )}
          {error && <span class="field-error">{error}</span>}
        </div>
      )}
    </form>
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
    <label class="field-stack">
      <span class="field-label">{label}</span>
      <span class="input-with-unit">
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
        <span class="unit">{t('dpi.unit')}</span>
      </span>
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
      {error && <p class="field-error">{error}</p>}
    </form>
  );
}
