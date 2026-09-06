import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'products' }
  | { name: 'product'; productSlug: string; section?: 'overview' | 'backlog' }
  | { name: 'delivery'; productSlug: string; deliverySlug: string; view: 'current' | 'stage' | 'run' | 'artifact' | 'advanced'; reference?: string; tab?: string }
  | { name: 'settings' }
  | { name: 'not-found' };

const decode = (value: string | undefined) => { try { return decodeURIComponent(value ?? '') } catch { return '' } };

export function parseRoute(location: Pick<Location, 'pathname' | 'search'> = window.location): Route {
  const parts = location.pathname.split('/').filter(Boolean);
  const query = new URLSearchParams(location.search);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'products' && parts.length === 1) return { name: 'products' };
  if (parts[0] === 'settings' && parts.length === 1) return { name: 'settings' };
  if (parts[0] !== 'products' || !parts[1]) return { name: 'not-found' };
  const productSlug = decode(parts[1]);
  if (parts.length === 2) return { name: 'product', productSlug, section: 'overview' };
  if (parts[2] === 'backlog') return { name: 'product', productSlug, section: 'backlog' };
  if (parts[2] !== 'delivery' || !parts[3]) return { name: 'not-found' };
  const deliverySlug = decode(parts[3]);
  if (parts.length === 4) return { name: 'delivery', productSlug, deliverySlug, view: 'current' };
  if (parts[4] === 'stage' && parts[5]) return { name: 'delivery', productSlug, deliverySlug, view: 'stage', reference: decode(parts[5]) };
  if (parts[4] === 'runs' && parts[5]) return { name: 'delivery', productSlug, deliverySlug, view: 'run', reference: decode(parts[5]), tab: query.get('tab') ?? 'conversation' };
  if (parts[4] === 'artifacts' && parts[5]) return { name: 'delivery', productSlug, deliverySlug, view: 'artifact', reference: decode(parts[5]) };
  if (parts[4] === 'advanced') return { name: 'delivery', productSlug, deliverySlug, view: 'advanced' };
  return { name: 'not-found' };
}

export function navigate(path: string, replace = false) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  useEffect(() => { const update = () => setRoute(parseRoute()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  return route;
}

export const productPath = (slug: string) => `/products/${encodeURIComponent(slug)}`;
export const deliveryPath = (productSlug: string, deliverySlug: string) => `${productPath(productSlug)}/delivery/${encodeURIComponent(deliverySlug)}`;
