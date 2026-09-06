export type UxEvidence = { at: string; event: string; detail: Record<string, unknown> };

const storageKey = 'mic.ux-evidence.v1';

export function readUxEvidence(): UxEvidence[] {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as UxEvidence[]; }
  catch { return []; }
}

export function recordUx(event: string, detail: Record<string, unknown> = {}) {
  try {
    const evidence = [...readUxEvidence(), { at: new Date().toISOString(), event, detail }].slice(-250);
    localStorage.setItem(storageKey, JSON.stringify(evidence));
  } catch { /* UX evidence must never interrupt the user's work. */ }
}

export function clearUxEvidence() { localStorage.removeItem(storageKey); }
