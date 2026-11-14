import type { Capability, Device } from '../api/types';
import { InfoIcon, MicIcon } from '../components/icons';
import { ReadingValue } from '../components/Value';
import { capabilityLabel, reasonLabel, t, tMaybe } from '../i18n';
import { viewOf } from '../lib/reading';
import { RelativeTime } from '../components/common';
import { CapabilityControl } from './controls';
import { useWriter, WritePending, WriteResult } from './write';

interface ItemProps {
  device: Device;
  cap: Capability;
  /** False when this capability's level is the one already stated on the device info section. */
  showVerification: boolean;
  /** Whether to show persistence note directly on this card (avoiding identical repeats). */
  showPersistence?: boolean | undefined;
}

function constraintSummary(cap: Capability): string | null {
  const c = cap.constraint;
  if (!c) return null;
  if (c.kind === 'range') {
    const unit = cap.type === 'percent' ? '%' : cap.unit ? ` ${cap.unit}` : '';
    return `${c.min}–${c.max}${unit}`;
  }
  return null;
}

/**
 * Unified capability card:
 * - Header: capability name + current confirmed device value + read time
 * - Body: interactive control (writable) or rich read-only status indicator
 * - Footer: persistence/verification notes + write outcome feedback
 */
export function CapabilityItem({ device, cap, showVerification, showPersistence = true }: ItemProps) {
  const labelId = `cap-${cap.id}-label`;
  const isWritable = cap.access.includes('write');
  const isDpi = cap.type === 'dpi';
  const isReadOnlyMic = !isWritable && cap.id === 'headset.mic_mute';

  if (isWritable) {
    return (
      <WritableCard
        device={device}
        cap={cap}
        labelId={labelId}
        isWide={isDpi}
        showVerification={showVerification}
        showPersistence={showPersistence}
      />
    );
  }

  return (
    <section class="cap-card is-readonly" aria-labelledby={labelId}>
      <div class="cap-card-header">
        <div class="cap-header-left">
          <h3 class="cap-title" id={labelId}>
            {capabilityLabel(cap.id)}
          </h3>
        </div>
      </div>
      <div class="cap-card-body">
        {isReadOnlyMic ? (
          <MicStatusDisplay cap={cap} link={device.link} />
        ) : (
          <div class="cap-readonly-value">
            <ReadingValue cap={cap} link={device.link} size="v-m" />
          </div>
        )}
      </div>
      {showVerification && cap.verification !== 'verified' && (
        <div class="cap-card-footer">
          <VerificationNote cap={cap} />
        </div>
      )}
    </section>
  );
}

function WritableCard({
  device,
  cap,
  labelId,
  isWide,
  showVerification,
  showPersistence,
}: {
  device: Device;
  cap: Capability;
  labelId: string;
  isWide: boolean;
  showVerification: boolean;
  showPersistence: boolean;
}) {
  const writer = useWriter(device.id, cap);
  const feedbackId = `cap-${cap.id}-result`;
  const offline = device.link === 'disconnected';
  const current = cap.reading.state === 'ok' ? cap.reading.value : undefined;
  const rangeHint = constraintSummary(cap);
  const shouldShowPersistence =
    cap.persistence !== null && (cap.persistence !== 'onboard' || showPersistence);
  const hasNotes = shouldShowPersistence || (showVerification && cap.verification !== 'verified');
  const hasFeedback = writer.state.kind !== 'idle';

  return (
    <section class={`cap-card${isWide ? ' is-wide' : ''}`} aria-labelledby={labelId}>
      <div class="cap-card-header">
        <div class="cap-header-left">
          <div class="cap-title-row">
            <h3 class="cap-title" id={labelId}>
              {capabilityLabel(cap.id)}
            </h3>
            {rangeHint && <span class="badge badge-neutral num">{rangeHint}</span>}
          </div>
        </div>
        <div class="cap-current-box">
          <span class="cap-current-label">{t('reading.currentLabel')}</span>
          <div class="cap-current-value">
            {/* Re-keyed after each landed write so the numeral settles once (150 ms). */}
            <span class={writer.settled > 0 ? 'settle' : undefined} key={writer.settled}>
              <ReadingValue cap={cap} link={device.link} size="v-m" />
            </span>
            <WritePending state={writer.state} />
          </div>
        </div>
      </div>

      <div class="cap-card-body">
        <CapabilityControl
          cap={cap}
          writer={writer}
          current={current}
          disabled={offline}
          labelId={labelId}
          feedbackId={feedbackId}
        />
      </div>

      {(hasNotes || hasFeedback) && (
        <div class="cap-card-footer">
          {hasFeedback && <WriteResult state={writer.state} id={feedbackId} />}
          {hasNotes && (
            <div class="cap-notes">
              {shouldShowPersistence && cap.persistence && (
                <p class="note cap-note-line">
                  <InfoIcon size={13} />
                  <span>{tMaybe(`persistence.${cap.persistence}`) ?? cap.persistence}</span>
                </p>
              )}
              {showVerification && <VerificationNote cap={cap} />}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Dedicated read-only visual indicator for headset microphone mute state. */
function MicStatusDisplay({ cap, link }: { cap: Capability; link: Device['link'] }) {
  const view = viewOf(cap, link);

  if (view.kind === 'live' || view.kind === 'historical') {
    const muted = view.value === true;
    const isHistorical = view.kind === 'historical';
    const iconState = isHistorical ? 'unavailable' : muted ? 'muted' : 'on';
    const toneClass = isHistorical ? 'is-off' : muted ? 'is-low' : 'is-ok';
    return (
      <div class={`mic-status-box ${toneClass}`}>
        <div class={`mic-icon-wrap ${toneClass}`} aria-hidden="true">
          <MicIcon state={iconState} size={22} />
        </div>
        <div class="mic-status-content">
          <div class="mic-status-title-row">
            <span class="mic-status-label">
              {t(muted ? 'bool.headset.mic_mute.true' : 'bool.headset.mic_mute.false')}
            </span>
            <span class={`badge ${isHistorical ? 'badge-neutral' : muted ? 'badge-warn' : 'badge-ok'}`}>
              {isHistorical ? t('reading.historical') : t(muted ? 'status.micMuted' : 'status.micOn')}
            </span>
          </div>
          <p class="note">{t('detail.micReadOnlyHint')}</p>
          <p class="note mic-time">
            <RelativeTime iso={view.observedAt} label={isHistorical ? 'time.lastRead' : 'time.at'} />
          </p>
        </div>
      </div>
    );
  }

  if (view.kind === 'unavailable') {
    const lastMuted = view.last?.value === true;
    return (
      <div class="mic-status-box is-off">
        <div class="mic-icon-wrap is-off" aria-hidden="true">
          <MicIcon state="unavailable" size={22} />
        </div>
        <div class="mic-status-content">
          <div class="mic-status-title-row">
            <span class="mic-status-label">{t('reading.unavailable', { reason: reasonLabel(view.reason) })}</span>
          </div>
          {view.last ? (
            <p class="note">
              {t(lastMuted ? 'bool.headset.mic_mute.true' : 'bool.headset.mic_mute.false')} ·{' '}
              <RelativeTime iso={view.last.observedAt} label="time.lastRead" />
            </p>
          ) : (
            <p class="note">{t('detail.micReadOnlyHint')}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div class="mic-status-box is-off">
      <div class="mic-icon-wrap is-off" aria-hidden="true">
        <MicIcon state="unavailable" size={22} />
      </div>
      <div class="mic-status-content">
        <div class="mic-status-title-row">
          <span class="mic-status-label">{t('reading.unknown')}</span>
        </div>
        <p class="note">{t('detail.micReadOnlyHint')}</p>
      </div>
    </div>
  );
}

/** Only unverified support is worth mentioning; verified needs no badge. */
function VerificationNote({ cap }: { cap: Capability }) {
  if (cap.verification === 'verified') return null;
  const key = cap.verification ?? 'none';
  return (
    <p class={`note cap-note-line${key === 'broken' ? ' text-fault' : ''}`}>
      <span>{tMaybe(`verification.${key}`) ?? cap.verification}</span>
    </p>
  );
}
