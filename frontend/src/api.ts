export type Row = Record<string, any>;

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const text = await response.text();
  let body: any = text;
  try { body = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) throw new ApiError(body.message ?? body.error ?? `Request failed (${response.status})`, response.status, body.error);
  return body as T;
}

export const post = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body: JSON.stringify(body), headers: { 'idempotency-key': crypto.randomUUID() } });
