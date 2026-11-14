import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Capability, CapabilityValue, WriteOutcome } from '../api/types';
import { errorText } from '../components/common';
import { t } from '../i18n';
import { validate } from '../lib/constraint';
import { setReading } from '../state/store';

export type WriteState =
  | { kind: 'idle' }
  | { kind: 'invalid'; message: string }
  | { kind: 'pending' }
  | { kind: 'result'; outcome: WriteOutcome; message: string | null }
  | { kind: 'error'; message: string };

export interface Writer {
  state: WriteState;
  pending: boolean;
  /** Increments each time a write lands a new reading; drives the one settle transition. */
  settled: number;
  write: (value: CapabilityValue) => Promise<void>;
}

/**
 * Sends one capability write at a time. No optimistic update: the store only
 * changes from the reading in the response (or later events).
 */
export function useWriter(deviceId: string, cap: Capability): Writer {
  const [state, setState] = useState<WriteState>({ kind: 'idle' });
  const [settled, setSettled] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const write = async (value: CapabilityValue) => {
    window.clearTimeout(timer.current);
    const invalid = validate(cap, value);
    if (invalid) {
      setState({ kind: 'invalid', message: invalid });
      return;
    }
    setState({ kind: 'pending' });
    try {
      const result = await api.writeCapability(deviceId, cap.id, value);
      if (result.reading) setReading(deviceId, cap.id, result.reading);
      if (result.outcome === 'applied' || result.outcome === 'accepted') setSettled((n) => n + 1);
      setState({ kind: 'result', outcome: result.outcome, message: result.message });
      if (result.outcome === 'applied') {
        timer.current = window.setTimeout(() => setState({ kind: 'idle' }), 3000);
      }
    } catch (err) {
      setState({ kind: 'error', message: errorText(err) });
    }
  };

  return { state, pending: state.kind === 'pending', settled, write };
}

/** Shown beside the reading while a write is in flight. */
export function WritePending({ state }: { state: WriteState }) {
  return state.kind === 'pending' ? <span class="write-pending">{t('write.pending')}…</span> : null;
}

/** One line under the reading with the outcome of the last write. */
export function WriteResult({ state, id }: { state: WriteState; id: string }) {
  let body = null;
  switch (state.kind) {
    case 'invalid':
      body = <span class="text-fault">{state.message}</span>;
      break;
    case 'error':
      body = <span class="text-fault">{t('write.error', { message: state.message })}</span>;
      break;
    case 'result':
      body = outcomeText(state.outcome, state.message);
      break;
  }
  return (
    <p class="write-result" role="status" aria-live="polite" id={id}>
      {body}
    </p>
  );
}

function outcomeText(outcome: WriteOutcome, message: string | null) {
  switch (outcome) {
    case 'applied':
      return <span class="text-ok">{t('write.applied')}</span>;
    case 'accepted':
      return <span class="text-low">{t('write.accepted')}</span>;
    case 'rejected':
      return <span class="text-fault">{t('write.rejected', { message: message ?? '' })}</span>;
    case 'failed':
      return <span class="text-fault">{t('write.failed', { message: message ?? t('write.failedNoMessage') })}</span>;
  }
}
