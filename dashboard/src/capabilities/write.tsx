import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Capability, CapabilityValue, WriteOutcome } from '../api/types';
import { errorText, Spinner } from '../components/common';
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
  write: (value: CapabilityValue) => Promise<void>;
}

/**
 * Sends one capability write at a time. No optimistic update: the store only
 * changes from the reading in the response (or later events).
 */
export function useWriter(deviceId: string, cap: Capability): Writer {
  const [state, setState] = useState<WriteState>({ kind: 'idle' });
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
      setState({ kind: 'result', outcome: result.outcome, message: result.message });
      if (result.outcome === 'applied') {
        timer.current = window.setTimeout(() => setState({ kind: 'idle' }), 3000);
      }
    } catch (err) {
      setState({ kind: 'error', message: errorText(err) });
    }
  };

  return { state, pending: state.kind === 'pending', write };
}

export function WriteFeedback({ state, id }: { state: WriteState; id?: string }) {
  let body = null;
  switch (state.kind) {
    case 'pending':
      body = (
        <span class="text-muted">
          <Spinner /> {t('write.pending')}
        </span>
      );
      break;
    case 'invalid':
      body = <span class="text-danger">{state.message}</span>;
      break;
    case 'error':
      body = <span class="text-danger">{t('write.error', { message: state.message })}</span>;
      break;
    case 'result':
      body = outcomeText(state.outcome, state.message);
      break;
  }
  return (
    <div class="write-feedback" role="status" aria-live="polite" id={id}>
      {body}
    </div>
  );
}

function outcomeText(outcome: WriteOutcome, message: string | null) {
  switch (outcome) {
    case 'applied':
      return <span class="text-ok">{t('write.applied')}</span>;
    case 'accepted':
      return <span class="text-warn">{t('write.accepted')}</span>;
    case 'rejected':
      return <span class="text-danger">{t('write.rejected', { message: message ?? '' })}</span>;
    case 'failed':
      return (
        <span class="text-danger">{t('write.failed', { message: message ?? t('write.failedNoMessage') })}</span>
      );
  }
}
