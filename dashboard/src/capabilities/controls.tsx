// Write controls chosen by value type and constraint, never by device model.

import { useEffect, useState } from 'preact/hooks';
import type { Capability, CapabilityValue } from '../api/types';
import { t } from '../i18n';
import { validate } from '../lib/constraint';
import { isDpi } from '../lib/reading';
import { formatValue } from '../components/Value';
import type { Writer } from './write';

interface ControlProps {
  cap: Capability;
  writer: Writer;
  /** Last value Bridge reported (any freshness), used to preselect; undefined when there is none. */
  current: CapabilityValue | undefined;
  disabled: boolean;
  labelId: string;
  feedbackId: string;
}

export function CapabilityControl(props: ControlProps) {
  const { cap } = props;
  const c = cap.constraint;
  if (cap.type === 'dpi') return <DpiControl {...props} />;
  if (cap.type === 'bool') return <Choices {...props} values={[true, false]} />;
  if (cap.type === 'enum') return <EnumSelect {...props} />;
  if (c?.kind === 'choices') return <Choices {...props} values={c.values} />;
  if (cap.type === 'integer' || cap.type === 'percent') return <RangeControl {...props} />;
  return <TextControl {...props} />;
}

/** Buttons for a small set of values; the pressed one is the value Bridge reported. */
function Choices({ cap, writer, current, disabled, labelId, feedbackId, values }: ControlProps & { values: CapabilityValue[] }) {
  return (
    <div class="choices" role="group" aria-labelledby={labelId} aria-describedby={feedbackId}>
      {values.map((v) => {
        const pressed = current === v;
        return (
          <button
            type="button"
            key={String(v)}
            class={`choice${pressed ? ' is-pressed' : ''}`}
            aria-pressed={pressed}
            disabled={disabled || writer.pending}
            onClick={() => {
              if (!pressed) void writer.write(v);
            }}
          >
            {formatValue(cap, v)}
          </button>
        );
      })}
    </div>
  );
}

function EnumSelect({ cap, writer, current, disabled, labelId, feedbackId }: ControlProps) {
  const options = cap.constraint?.kind === 'choices' ? cap.constraint.values.map(String) : (cap.variants ?? []);
  const value = typeof current === 'string' ? current : '';
  return (
    <select
      class="input"
      aria-labelledby={labelId}
      aria-describedby={feedbackId}
      value={value}
      disabled={disabled || writer.pending}
      onChange={(e) => {
        const next = e.currentTarget.value;
        // Show the confirmed value until the response arrives.
        e.currentTarget.value = value;
        if (next && next !== value) void writer.write(next);
      }}
    >
      {value === '' && <option value="">—</option>}
      {options.map((o) => (
        <option value={o} key={o}>
          {formatValue(cap, o)}
        </option>
      ))}
    </select>
  );
}

/** Draft text that follows the reported value until the user edits it. */
function useDraft(source: string): [string, (v: string) => void] {
  const [draft, setDraft] = useState(source);
  useEffect(() => setDraft(source), [source]);
  return [draft, setDraft];
}

function parseInteger(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
}

function RangeControl({ cap, writer, current, disabled, labelId, feedbackId }: ControlProps) {
  const c = cap.constraint;
  const min = c && c.kind !== 'choices' ? c.min : cap.type === 'percent' ? 0 : undefined;
  const max = c && c.kind !== 'choices' ? c.max : cap.type === 'percent' ? 100 : undefined;
  const step = c && c.kind !== 'choices' ? c.step : 1;
  const [draft, setDraft] = useDraft(typeof current === 'number' ? String(current) : '');
  const value = parseInteger(draft);
  const error = draft === '' ? null : validate(cap, value);
  const off = disabled || writer.pending;
  return (
    <form
      class="range-control"
      onSubmit={(e) => {
        e.preventDefault();
        void writer.write(value);
      }}
    >
      {/* No slider without a number: a thumb at the minimum would read as a real value. */}
      {min !== undefined && max !== undefined && !Number.isNaN(value) && (
        <input
          type="range"
          aria-labelledby={labelId}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={off}
          onInput={(e) => setDraft(e.currentTarget.value)}
        />
      )}
      <input
        type="number"
        class="input input-number"
        aria-labelledby={labelId}
        aria-describedby={feedbackId}
        aria-invalid={error !== null}
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={off}
        onInput={(e) => setDraft(e.currentTarget.value)}
      />
      {cap.unit && <span class="unit">{cap.unit}</span>}
      <button type="submit" class="btn btn-primary" disabled={off || error !== null || draft === '' || value === current}>
        {t('common.apply')}
      </button>
      {error && <span class="field-error">{error}</span>}
    </form>
  );
}

function DpiControl({ cap, writer, current, disabled, labelId, feedbackId }: ControlProps) {
  const c = cap.constraint?.kind === 'dpi' ? cap.constraint : null;
  const independent = c?.independentXY ?? true;
  const cur = current !== undefined && isDpi(current) ? current : null;
  const [x, setX] = useDraft(cur ? String(cur.x) : '');
  const [y, setY] = useDraft(cur ? String(cur.y) : '');
  const xv = parseInteger(x);
  const yv = independent ? parseInteger(y) : xv;
  const value = { x: xv, y: yv };
  const empty = x === '' || (independent && y === '');
  const error = empty ? null : validate(cap, value);
  const unchanged = cur !== null && cur.x === xv && cur.y === yv;
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
      class="dpi-control"
      aria-labelledby={labelId}
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

function TextControl({ writer, current, disabled, labelId, feedbackId }: ControlProps) {
  const [draft, setDraft] = useDraft(typeof current === 'string' ? current : '');
  const off = disabled || writer.pending;
  return (
    <form
      class="range-control"
      onSubmit={(e) => {
        e.preventDefault();
        void writer.write(draft);
      }}
    >
      <input
        type="text"
        class="input"
        aria-labelledby={labelId}
        aria-describedby={feedbackId}
        value={draft}
        disabled={off}
        onInput={(e) => setDraft(e.currentTarget.value)}
      />
      <button type="submit" class="btn btn-primary" disabled={off || draft === current}>
        {t('common.apply')}
      </button>
    </form>
  );
}
