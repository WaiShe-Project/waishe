import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { absoluteTime, relativeTime, t, type MessageKey } from '../i18n';
import { AlertIcon, CheckIcon } from './icons';

/** Current time, refreshed periodically so relative times stay correct. */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Relative time with the absolute time as tooltip; `label` wraps it in a `{time}` template. */
export function RelativeTime({ iso, label }: { iso: string; label?: MessageKey }) {
  const now = useNow();
  const rel = relativeTime(iso, now);
  return (
    <time dateTime={iso} title={absoluteTime(iso)}>
      {label ? t(label, { time: rel }) : rel}
    </time>
  );
}

interface SwitchProps {
  checked: boolean;
  disabled?: boolean | undefined;
  busy?: boolean | undefined;
  onChange: (next: boolean) => void;
  children?: ComponentChildren;
}

/** Native checkbox exposed as a switch: keyboard and screen-reader friendly. */
export function Switch({ checked, disabled, busy, onChange, children }: SwitchProps) {
  return (
    <label class={`switch${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-busy={busy}
        onChange={(e) => {
          const next = e.currentTarget.checked;
          // Not optimistic: keep showing the confirmed state until the response arrives.
          e.currentTarget.checked = checked;
          onChange(next);
        }}
      />
      <span class="switch-track" aria-hidden="true" />
      {children !== undefined && <span class="switch-label">{children}</span>}
    </label>
  );
}

export type ActionState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

/** One line of status text with icon next to the control that triggered it. */
export function ActionStatus({ state }: { state: ActionState }) {
  return (
    <span class="status-line" role="status" aria-live="polite">
      {state.kind === 'pending' && (
        <span class="status-pill-inline text-muted">
          <span class="spinner-dot" aria-hidden="true" />
          <span>{t('common.sending')}…</span>
        </span>
      )}
      {state.kind === 'done' && (
        <span class="status-pill-inline text-ok">
          <CheckIcon size={14} />
          <span>{state.message}</span>
        </span>
      )}
      {state.kind === 'error' && (
        <span class="status-pill-inline text-fault">
          <AlertIcon size={14} />
          <span>{state.message}</span>
        </span>
      )}
    </span>
  );
}

/** Wraps an async action with pending / done / error state; the done message clears after a moment. */
export function useAction(): [ActionState, (run: () => Promise<string | null>) => Promise<void>] {
  const [state, setState] = useState<ActionState>({ kind: 'idle' });
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const run = async (fn: () => Promise<string | null>) => {
    window.clearTimeout(timer.current);
    setState({ kind: 'pending' });
    try {
      const message = await fn();
      if (message === null) {
        setState({ kind: 'idle' });
        return;
      }
      setState({ kind: 'done', message });
      timer.current = window.setTimeout(() => setState({ kind: 'idle' }), 3000);
    } catch (err) {
      setState({ kind: 'error', message: t('common.error', { message: errorText(err) }) });
    }
  };
  return [state, run];
}

export function errorText(err: unknown): string {
  if (err instanceof Error) {
    return err.message === 'bridge_unreachable' ? t('gate.unreachable.title') : err.message;
  }
  return String(err);
}

interface ConfirmRequest {
  message: string;
  action: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

/**
 * Modal confirmation built on <dialog> (focus trapping and Esc handling come
 * from the browser). The confirm button names the action it performs.
 */
export function useConfirm(): [
  preact.JSX.Element | null,
  (message: string, action: string, danger?: boolean) => Promise<boolean>,
] {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (request && ref.current && !ref.current.open) ref.current.showModal();
  }, [request]);
  const ask = (message: string, action: string, danger = false) => {
    const { promise, resolve } = Promise.withResolvers<boolean>();
    setRequest({ message, action, danger, resolve });
    return promise;
  };
  const close = (ok: boolean) => {
    request?.resolve(ok);
    ref.current?.close();
    setRequest(null);
  };
  const element = request ? (
    <dialog ref={ref} class="dialog" onCancel={() => close(false)} aria-labelledby="confirm-message">
      <p id="confirm-message">{request.message}</p>
      <div class="dialog-actions">
        <button type="button" class="btn" onClick={() => close(false)}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          class={`btn ${request.danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => close(true)}
        >
          {request.action}
        </button>
      </div>
    </dialog>
  ) : null;
  return [element, ask];
}
