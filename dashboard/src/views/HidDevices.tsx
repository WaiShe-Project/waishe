import { useEffect, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { HidDevice } from '../api/types';
import { ActionStatus, errorText, useAction } from '../components/common';
import { t } from '../i18n';
import { href } from '../router';

const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;

export function HidDevices() {
  const [rows, setRows] = useState<HidDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copy, runCopy] = useAction();

  useEffect(() => {
    api.hidDevices().then(setRows, (err: unknown) => setError(errorText(err)));
  }, []);

  // [header, cell text, numeral face]
  const columns: Array<[string, (r: HidDevice) => string, boolean]> = [
    [t('hid.vid'), (r) => hex(r.vendorId), true],
    [t('hid.pid'), (r) => hex(r.productId), true],
    [t('hid.product'), (r) => r.product ?? '', false],
    [t('hid.manufacturer'), (r) => r.manufacturer ?? '', false],
    [t('hid.usagePage'), (r) => hex(r.usagePage), true],
    [t('hid.usage'), (r) => hex(r.usage), true],
    [t('hid.interface'), (r) => String(r.interfaceNumber), true],
    [t('hid.driver'), (r) => r.driver ?? t('common.none'), false],
  ];

  const asText = (list: HidDevice[]) =>
    [columns.map(([h]) => h), ...list.map((r) => columns.map(([, f]) => f(r)))].map((cells) => cells.join('\t')).join('\n');

  return (
    <div class="page">
      <div class="detail-top">
        <a class="back" href={href.devices}>
          <span aria-hidden="true">‹ </span>
          {t('detail.back')}
        </a>
        {rows && rows.length > 0 && (
          <div class="inline-actions">
            <ActionStatus state={copy} />
            <button
              type="button"
              class="btn"
              onClick={() =>
                void runCopy(async () => {
                  await navigator.clipboard.writeText(asText(rows));
                  return t('hid.copied');
                })
              }
            >
              {t('hid.copy')}
            </button>
          </div>
        )}
      </div>
      <h1 class="detail-title">{t('hid.title')}</h1>
      <p class="lede">{t('hid.intro')}</p>
      {error && <p class="text-fault">{t('common.error', { message: error })}</p>}
      {!rows && !error && <p class="note">{t('common.loading')}</p>}
      {rows && rows.length === 0 && <p class="empty">{t('hid.empty')}</p>}
      {rows && rows.length > 0 && (
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                {columns.map(([h]) => (
                  <th scope="col" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {columns.map(([h, f, num]) => (
                    <td key={h} class={num ? 'num' : undefined}>
                      {f(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
