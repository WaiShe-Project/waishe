import type { Language } from '../api/types';
import { en } from './en';
import { zhCN, type MessageKey, type Messages } from './zh-CN';

export type { MessageKey };

const dictionaries: Record<Language, Messages> = { 'zh-CN': zhCN, en };

let lang: Language = 'zh-CN';

export function setLanguage(next: Language): void {
  lang = dictionaries[next] ? next : 'zh-CN';
  document.documentElement.lang = lang;
}

export function getLanguage(): Language {
  return lang;
}

type Params = Record<string, string | number>;

function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function t(key: MessageKey, params?: Params): string {
  return format(dictionaries[lang][key], params);
}

/** Same as `t` but for keys built at runtime; returns undefined when the key is unknown. */
export function tMaybe(key: string, params?: Params): string | undefined {
  const dict = dictionaries[lang] as Record<string, string>;
  return Object.prototype.hasOwnProperty.call(dict, key) ? format(dict[key] as string, params) : undefined;
}

/** Text in a specific language, used by gate notices that show both languages. */
export function tIn(language: Language, key: MessageKey, params?: Params): string {
  return format(dictionaries[language][key], params);
}

/**
 * Catalogue capabilities have translated names. Others (a driver's own
 * additions) have no display name in API 0.1, so the id is turned into a
 * sentence-case phrase: `mouse.lift_off_distance` -> "Lift off distance".
 */
export function capabilityLabel(id: string): string {
  const known = tMaybe(`cap.${id}`);
  if (known !== undefined) return known;
  const words = id.slice(id.lastIndexOf('.') + 1).replace(/[_-]+/g, ' ').trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : id;
}

export function variantLabel(capabilityId: string, variant: string): string {
  return tMaybe(`variant.${capabilityId}.${variant}`) ?? variant;
}

export function kindLabel(kind: string): string {
  return tMaybe(`kind.${kind}`) ?? kind;
}

export function linkLabel(link: string): string {
  return tMaybe(`link.${link}`) ?? link;
}

export function transportLabel(transport: string): string {
  return tMaybe(`transport.${transport}`) ?? transport;
}

export function reasonLabel(reason: string): string {
  return tMaybe(`reason.${reason}`) ?? reason;
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export function relativeTime(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return t('time.justNow');
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, 'second');
}

export function absoluteTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(lang);
}
