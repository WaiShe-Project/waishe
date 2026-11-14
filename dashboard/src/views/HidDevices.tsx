import { useEffect, useState } from 'preact/hooks';
import { api } from '../api/client';
import type { HidDevice } from '../api/types';
import { errorText, useAction, ActionStatus } from '../components/common';
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

  // [header, cell text, monospace]
  const columns: Array<[string, (r: HidDevice) => string, boolean]> = [
    [t('hid.vid'), (r) => hex(r.vendorId), true],
    [t('hid.pid'), (r) => hex(r.productId), true],
    [t('hid.product'), (r) => r.product ?? '', false],
    [t('hid.manufacturer'), (r) => r.manufacturer ?? '', false],
    [t('hid.usagePage'), (r) => hex(r.usagePage), true],
    [t('hid.usage'), (r) => hex(r.usage), true],
    [t('hid.interface'), (r) => String(r.interfaceNumber), true],
    [t('hid.driver'), (r) => r.driver ?? '—', false],
  ];

  const asText = (list: HidDevice[]) =>
    [columns.map(([h]) => h), ...list.map((r) => columns.map(([, f]) => f(r)))].map((cells) => cells.join('\t')).join('\n');

  return (
    <div class="page">
      <p>
        <a href={href.devices}>{t('common.back')}</a>
      </p>
      <div class="page-head">
        <h1>{t('hid.title')}</h1>
        {rows && rows.length > 0 && (
          <div class="page-tools">
            <button
              type="button"
              class="btn"
              onClick={() =>
                void runCopy(async () => {
                  await navigator.clipboard.writeText(asText(rows));
                  return t('common.copied');
                })
              }
            >
              {t('common.copy')}
            </button>
            <ActionStatus state={copy} />
          </div>
        )}
      </div>
      <p class="hint">{t('hid.intro')}</p>
      {error && <p class="text-danger">{t('common.error', { message: error })}</p>}
      {!rows && !error && <p class="text-muted">{t('common.loading')}</p>}
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
                  {columns.map(([h, f, mono]) => (
                    <td key={h} class={mono ? 'mono' : undefined}>
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
