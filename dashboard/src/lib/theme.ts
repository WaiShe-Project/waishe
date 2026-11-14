import { useEffect, useState } from 'preact/hooks';

export type ThemePreference = 'system' | 'dark' | 'light';

const STORAGE_KEY = 'waishe-theme';
const listeners = new Set<(theme: ThemePreference) => void>();

function readStored(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  } catch {
    // Ignore storage errors in restricted environments.
  }
  return 'system';
}

let currentTheme: ThemePreference = typeof window === 'undefined' ? 'system' : readStored();

export function applyTheme(theme: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function initTheme(): void {
  currentTheme = readStored();
  applyTheme(currentTheme);
}

export function getTheme(): ThemePreference {
  return currentTheme;
}

export function setTheme(next: ThemePreference): void {
  currentTheme = next;
  applyTheme(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage errors.
  }
  for (const listener of listeners) listener(next);
}

export function useTheme(): [ThemePreference, (next: ThemePreference) => void] {
  const [theme, setLocal] = useState<ThemePreference>(currentTheme);
  useEffect(() => {
    const listener = (next: ThemePreference) => setLocal(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return [theme, setTheme];
}
