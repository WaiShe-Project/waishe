import { useEffect, useState } from 'preact/hooks';

/** Draft text that follows the reported value until the user edits it. */
export function useDraft(source: string): [string, (v: string) => void] {
  const [draft, setDraft] = useState(source);
  useEffect(() => setDraft(source), [source]);
  return [draft, setDraft];
}

/** Number from an input's text; NaN when empty (so validation reports it instead of treating it as 0). */
export function parseInteger(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
}
