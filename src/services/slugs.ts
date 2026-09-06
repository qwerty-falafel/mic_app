import { createHash } from 'node:crypto';

export function slugify(value: string) {
  const slug = value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
  return slug || 'untitled';
}

export function durableSlug(value: string, identity: string) {
  const suffix = createHash('sha256').update(identity).digest('hex').slice(0, 6);
  return `${slugify(value).slice(0, 57)}-${suffix}`;
}
