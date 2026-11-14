import type { Capability, CapabilityValue } from '../api/types';
import { t } from '../i18n';
import { isDpi } from './reading';

/** Returns a localized error, or null when `value` satisfies the capability's type and constraint. */
export function validate(cap: Capability, value: CapabilityValue): string | null {
  const c = cap.constraint;
  if (cap.type === 'dpi') {
    if (!isDpi(value)) return t('validate.integer');
    const err = checkNumber(value.x, c) ?? checkNumber(value.y, c);
    if (err) return err;
    if (c?.kind === 'dpi' && !c.independentXY && value.x !== value.y) return t('validate.xyEqual');
    return null;
  }
  if (cap.type === 'integer' || cap.type === 'percent') {
    if (typeof value !== 'number') return t('validate.integer');
    if (cap.type === 'percent' && (value < 0 || value > 100)) return t('validate.range', { min: 0, max: 100 });
    return checkNumber(value, c);
  }
  if (cap.type === 'enum') {
    if (typeof value !== 'string') return t('validate.choice');
    if (cap.variants && !cap.variants.includes(value)) return t('validate.choice');
    if (c?.kind === 'choices' && !c.values.includes(value)) return t('validate.choice');
    return null;
  }
  if (cap.type === 'bool') return typeof value === 'boolean' ? null : t('validate.choice');
  if (cap.type === 'text') return typeof value === 'string' ? null : t('validate.choice');
  return null;
}

function checkNumber(v: number, c: Capability['constraint']): string | null {
  if (!Number.isInteger(v)) return t('validate.integer');
  if (!c) return null;
  if (c.kind === 'choices') return c.values.includes(v) ? null : t('validate.choice');
  if (v < c.min || v > c.max) return t('validate.range', { min: c.min, max: c.max });
  if (c.step > 0 && (v - c.min) % c.step !== 0) return t('validate.step', { step: c.step, min: c.min });
  return null;
}
