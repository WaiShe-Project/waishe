import type { Capability, Device } from '../api/types';
import { BatteryMeter, ReadingValue } from '../components/Value';
import { capabilityLabel, t, tMaybe } from '../i18n';
import { CapabilityControl } from './controls';
import { useWriter, WriteFeedback } from './write';

/** One capability rendered from its description: label, badges, current reading, and a control if writable. */
export function CapabilityItem({ device, cap }: { device: Device; cap: Capability }) {
  const writable = cap.access.includes('write');
  const labelId = `cap-${cap.id}-label`;
  const feedbackId = `cap-${cap.id}-feedback`;
  return (
    <section class="cap" aria-labelledby={labelId}>
      <div class="cap-head">
        <h3 class="cap-title" id={labelId}>
          {capabilityLabel(cap.id)}
        </h3>
        <div class="badges">
          <span class={`badge badge-verification is-${cap.verification ?? 'none'}`} title={t('verification.label')}>
            {tMaybe(`verification.${cap.verification ?? 'none'}`) ?? cap.verification}
          </span>
          {writable ? (
            cap.persistence && (
              <span class={`badge badge-persistence is-${cap.persistence}`}>
                {tMaybe(`persistence.${cap.persistence}`) ?? cap.persistence}
              </span>
            )
          ) : (
            <span class="badge">{t('access.readonly')}</span>
          )}
        </div>
      </div>
      <div class="cap-reading">
        {cap.id === 'battery.level' ? (
          <BatteryMeter cap={cap} link={device.link} />
        ) : (
          <ReadingValue cap={cap} link={device.link} />
        )}
      </div>
      {writable && <Writable device={device} cap={cap} labelId={labelId} feedbackId={feedbackId} />}
    </section>
  );
}

function Writable({ device, cap, labelId, feedbackId }: { device: Device; cap: Capability; labelId: string; feedbackId: string }) {
  const writer = useWriter(device.id, cap);
  const offline = device.link === 'disconnected';
  const current = cap.reading.state === 'ok' ? cap.reading.value : undefined;
  return (
    <div class="cap-control">
      <CapabilityControl
        cap={cap}
        writer={writer}
        current={current}
        disabled={offline}
        labelId={labelId}
        feedbackId={feedbackId}
      />
      {offline && <p class="hint">{t('write.offline')}</p>}
      <WriteFeedback state={writer.state} id={feedbackId} />
    </div>
  );
}
