import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { Capability, CapabilityValue, WriteOutcome } from '../api/types';
import { errorText } from '../components/common';
import { AlertIcon, CheckIcon, InfoIcon } from '../components/icons';
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
        timer.current = window.setTimeout(() => setState({ kind: 'idle' }), 3500);
      }
    } catch (err) {
      setState({ kind: 'error', message: errorText(err) });
    }
  };

  return { state, pending: state.kind === 'pending', settled, write };
}

/** Shown beside the reading while a write is in flight. */
export function WritePending({ state }: { state: WriteState }) {
  if (state.kind !== 'pending') return null;
  return (
    <span class="write-badge is-pending">
      <span class="spinner-dot" aria-hidden="true" />
      <span>{t('write.pending')}…</span>
    </span>
  );
}

/** Unified feedback status for capability writes, placed in the card footer / status slot. */
export function WriteResult({ state, id }: { state: WriteState; id: string }) {
  let content = null;
  switch (state.kind) {
    case 'pending':
      content = (
        <span class="write-feedback is-pending">
          <span class="spinner-dot" aria-hidden="true" />
          <span>{t('write.pending')}…</span>
        </span>
      );
      break;
    case 'invalid':
      content = (
        <span class="write-feedback is-fault">
          <AlertIcon size={14} />
          <span>{state.message}</span>
        </span>
      );
      break;
    case 'error':
      content = (
        <span class="write-feedback is-fault">
          <AlertIcon size={14} />
          <span>{t('write.error', { message: state.message })}</span>
        </span>
      );
      break;
    case 'result':
      content = outcomeFeedback(state.outcome, state.message);
      break;
  }
  return (
    <div class="write-result" role="status" aria-live="polite" id={id}>
      {content}
    </div>
  );
}

function outcomeFeedback(outcome: WriteOutcome, message: string | null) {
  switch (outcome) {
    case 'applied':
      return (
        <span class="write-feedback is-ok">
          <CheckIcon size={14} />
          <span>{t('write.applied')}</span>
        </span>
      );
    case 'accepted':
      return (
        <span class="write-feedback is-low">
          <InfoIcon size={14} />
          <span>{t('write.accepted')}</span>
        </span>
      );
    case 'rejected':
      return (
        <span class="write-feedback is-fault">
          <AlertIcon size={14} />
          <span>{t('write.rejected', { message: message ?? '' })}</span>
        </span>
      );
    case 'failed':
      return (
        <span class="write-feedback is-fault">
          <AlertIcon size={14} />
          <span>{t('write.failed', { message: message ?? t('write.failedNoMessage') })}</span>
        </span>
      );
  }
}
