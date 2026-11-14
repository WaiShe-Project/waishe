import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { SUPPORTED_API_VERSION, type Language } from './api/types';
import { useNow } from './components/common';
import { getLanguage, t, tIn, type MessageKey } from './i18n';
import { href, useRoute, type Route } from './router';
import { connect, nextRetryAt } from './state/connection';
import { useAppState, type AppState } from './state/store';
import { DeviceDetail } from './views/DeviceDetail';
import { DeviceList } from './views/DeviceList';
import { Drivers } from './views/Drivers';
import { HidDevices } from './views/HidDevices';
import { Panel } from './views/Panel';
import { Settings } from './views/Settings';

export function App() {
  const state = useAppState();
  const route = useRoute();
  useEffect(() => {
    void connect();
  }, []);
  const compact = route.name === 'panel';
  useEffect(() => {
    document.body.classList.toggle('is-panel', compact);
  }, [compact]);

  switch (state.phase) {
    case 'unauthorized':
      return <Gate title="gate.unauthorized.title" body="gate.unauthorized.body" />;
    case 'unreachable':
      return (
        <Gate title="gate.unreachable.title" body="gate.unreachable.body">
          <RetryControls />
        </Gate>
      );
    case 'incompatible':
      return (
        <Gate
          title="gate.incompatible.title"
          body="gate.incompatible.body"
          params={{ actual: state.status?.apiVersion ?? '?', expected: SUPPORTED_API_VERSION }}
        />
      );
    case 'loading':
      return <Loading />;
    case 'ready':
      return compact ? <PanelRoute state={state} /> : <Shell state={state} route={route} />;
  }
}

function Loading() {
  return (
    <main class="gate" aria-busy="true">
      <p class="text-muted">{t('gate.loading')}</p>
    </main>
  );
}

/**
 * Full-screen notice. The language setting is unknown at this point (it comes
 * from Bridge), so the text is shown in both languages.
 */
function Gate({
  title,
  body,
  params,
  children,
}: {
  title: MessageKey;
  body: MessageKey;
  params?: Record<string, string>;
  children?: ComponentChildren;
}) {
  const other: Language = getLanguage() === 'en' ? 'zh-CN' : 'en';
  return (
    <main class="gate">
      <div class="gate-box" role="alert">
        <p class="gate-brand">{t('app.name')}</p>
        <h1>{t(title, params)}</h1>
        <p>{t(body, params)}</p>
        <div class="gate-alt" lang={other}>
          <p class="gate-alt-title">{tIn(other, title, params)}</p>
          <p>{tIn(other, body, params)}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

function RetryControls() {
  const now = useNow(1000);
  const seconds = Math.max(0, Math.ceil((nextRetryAt - now) / 1000));
  return (
    <div class="gate-actions">
      <button type="button" class="btn btn-primary" onClick={() => void connect()}>
        {t('gate.retry')}
      </button>
      {seconds > 0 && <span class="text-muted">{t('gate.unreachable.auto', { seconds })}</span>}
    </div>
  );
}

function PanelRoute({ state }: { state: AppState }) {
  if (!state.settings || !state.devices) return <Loading />;
  return <Panel devices={state.devices} settings={state.settings} live={state.live} />;
}

const NAV: Array<[Route['name'], string, MessageKey]> = [
  ['devices', href.devices, 'nav.devices'],
  ['drivers', href.drivers, 'nav.drivers'],
  ['settings', href.settings, 'nav.settings'],
];

function Shell({ state, route }: { state: AppState; route: Route }) {
  const section = route.name === 'device' || route.name === 'hid' ? 'devices' : route.name;
  return (
    <>
      {/* Hash routing owns location.hash, so the skip link moves focus instead of navigating. */}
      <button type="button" class="skip-link" onClick={() => document.getElementById('main')?.focus()}>
        {t('nav.skip')}
      </button>
      <header class="topbar">
        <a class="brand" href={href.devices}>
          {t('app.name')}
        </a>
        <nav aria-label={t('nav.main')}>
          <ul class="nav">
            {NAV.map(([name, link, label]) => (
              <li key={name}>
                <a href={link} aria-current={section === name ? 'page' : undefined}>
                  {t(label)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <span class={`conn${state.live ? ' is-live' : ''}`} role="status">
          <span class="dot" aria-hidden="true" />
          <span class="conn-text">{state.live ? t('conn.live') : t('conn.reconnecting')}</span>
        </span>
      </header>
      {!state.live && state.devices && (
        <p class="banner banner-warn" role="status">
          {t('conn.reconnectingHint')}
        </p>
      )}
      <main id="main" tabIndex={-1}>
        <Page state={state} route={route} />
      </main>
    </>
  );
}

function Page({ state, route }: { state: AppState; route: Route }) {
  if (route.name === 'hid') return <HidDevices />;
  if (!state.devices || !state.settings || !state.drivers) {
    return <p class="page text-muted">{t('common.loading')}</p>;
  }
  switch (route.name) {
    case 'device':
      return <DeviceDetail device={state.devices.find((d) => d.id === route.id)} status={state.status} />;
    case 'drivers':
      return <Drivers drivers={state.drivers} developerMode={state.settings.developerMode} />;
    case 'settings':
      return <Settings settings={state.settings} devices={state.devices} status={state.status} />;
    default:
      return <DeviceList devices={state.devices} />;
  }
}
