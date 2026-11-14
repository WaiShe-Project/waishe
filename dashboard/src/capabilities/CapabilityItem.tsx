import type { Capability, Device } from '../api/types';
import { ReadingValue } from '../components/Value';
import { capabilityLabel, tMaybe } from '../i18n';
import { CapabilityControl } from './controls';
import { useWriter, WritePending, WriteResult } from './write';

interface ItemProps {
  device: Device;
  cap: Capability;
  /** False when the device page already states one verification level for everything. */
  showVerification: boolean;
}

/**
 * One capability rendered from its description: a heading, the reading, and a
 * control if writable. Grouped by spacing, not boxes.
 */
export function CapabilityItem({ device, cap, showVerification }: ItemProps) {
  const labelId = `cap-${cap.id}-label`;
  return (
    <section class="cap" aria-labelledby={labelId}>
      <h2 class="cap-title" id={labelId}>
        {capabilityLabel(cap.id)}
      </h2>
      {cap.access.includes('write') ? (
        <Writable device={device} cap={cap} labelId={labelId} />
      ) : (
        <div class="cap-reading">
          <ReadingValue cap={cap} link={device.link} size="v-m" />
        </div>
      )}
      {showVerification && <VerificationNote cap={cap} />}
    </section>
  );
}

function Writable({ device, cap, labelId }: { device: Device; cap: Capability; labelId: string }) {
  const writer = useWriter(device.id, cap);
  const feedbackId = `cap-${cap.id}-result`;
  const offline = device.link === 'disconnected';
  const current = cap.reading.state === 'ok' ? cap.reading.value : undefined;
  return (
    <>
      <div class="cap-reading">
        {/* Re-keyed after each landed write so the numeral settles once (150 ms). */}
        <span class={writer.settled > 0 ? 'settle' : undefined} key={writer.settled}>
          <ReadingValue cap={cap} link={device.link} size={cap.type === 'dpi' ? 'v-l' : 'v-m'} />
        </span>
        <WritePending state={writer.state} />
      </div>
      <WriteResult state={writer.state} id={feedbackId} />
      <div class="cap-control">
        <CapabilityControl
          cap={cap}
          writer={writer}
          current={current}
          disabled={offline}
          labelId={labelId}
          feedbackId={feedbackId}
        />
      </div>
      {cap.persistence && <p class="note">{tMaybe(`persistence.${cap.persistence}`) ?? cap.persistence}</p>}
    </>
  );
}

/** Only unverified support is worth mentioning; verified needs no badge. */
function VerificationNote({ cap }: { cap: Capability }) {
  if (cap.verification === 'verified') return null;
  const key = cap.verification ?? 'none';
  return (
    <p class={`note${key === 'broken' ? ' text-fault' : ''}`}>{tMaybe(`verification.${key}`) ?? cap.verification}</p>
  );
}
