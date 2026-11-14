import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'devices' }
  | { name: 'hid' }
  | { name: 'device'; id: string }
  | { name: 'drivers' }
  | { name: 'settings' }
  | { name: 'panel' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'device':
      return parts[1] ? { name: 'device', id: decodeURIComponent(parts[1]) } : { name: 'devices' };
    case 'hid':
      return { name: 'hid' };
    case 'drivers':
      return { name: 'drivers' };
    case 'settings':
      return { name: 'settings' };
    case 'panel':
      return { name: 'panel' };
    default:
      return { name: 'devices' };
  }
}

export const href = {
  devices: '#/',
  hid: '#/hid',
  device: (id: string) => `#/device/${encodeURIComponent(id)}`,
  drivers: '#/drivers',
  settings: '#/settings',
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
