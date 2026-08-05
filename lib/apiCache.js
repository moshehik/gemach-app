// ============================================================================
// apiCache.js — shared in-memory client cache for GET /api/* JSON responses
// ============================================================================
//
// Why: every page/component used to fetch its own data independently, so each
// navigation refetched settings, employees, dress models etc. from scratch.
// This module gives the whole session ONE cache with stale-while-revalidate
// (SWR) semantics:
//
//   - Fresh entry (age <= ttl)  -> served from memory, no network request.
//   - Stale entry (age > ttl)   -> served instantly from memory AND
//                                  revalidated in the background; subscribers
//                                  are notified when fresh data lands.
//   - No entry                  -> normal network fetch (in-flight requests
//                                  for the same URL are deduplicated).
//
// Correctness (this is a live business app — no stale data after edits):
//   1. A fetch interceptor (installed once, below) watches every non-GET
//      request to /api/* from ANYWHERE in the app — including code that was
//      never migrated to this module — and invalidates the related cache
//      prefixes (see MUTATION_RELATIONS). Invalidated keys that still have
//      mounted subscribers are re-fetched immediately.
//   2. Login/logout flushes the entire cache.
//   3. On window focus, every subscribed key older than FOCUS_STALE_MS is
//      revalidated in the background (multiple terminals edit the same data).
//
// Offline mode is untouched: it is implemented server-side (app/lib/prisma.js
// swaps Prisma to SQLite); client fetches still hit the same /api/* routes.
// This module also chains politely with the API-logging fetch wrapper that
// app/layout.js installs inline — only real network requests get logged,
// which is exactly what the log is for.
//
// Usage:
//   import { fetchSharedJson, TTL, invalidate } from '@/lib/apiCache';
//   const settings = await fetchSharedJson('/api/settings', { ttl: TTL.STATIC });
//   // React components: prefer the hooks in lib/useCachedFetch.js
//
// MIGRATION NOTE — what still fetches on its own (fine, just not shared yet):
//   Migrated so far: /api/settings consumers (orders list/new, dresses list,
//   QuickPaymentModal, RentalReturnModal, Modern* order managers, labels),
//   /api/employees (PopupProvider, LoginScreen), /api/me (UserMenu,
//   PopupProvider), /api/inventory/models (OrderModelSelector), the orders
//   list and the dresses list.
//   Still un-migrated: order card (/orders/[id]) sub-fetches, refunds page,
//   messages page, employees pages, admin pages, customer-interface, print
//   views. To migrate: replace `fetch(url).then(r => r.json())` with
//   `fetchSharedJson(url, { ttl: TTL.<tier> })` for GETs — mutations need no
//   change, the interceptor already invalidates for them.
// ============================================================================

// TTL tiers (ms). Even after a TTL expires the cached value is still shown
// instantly — the TTL only controls when a background revalidation happens.
export const TTL = {
  STATIC: 5 * 60 * 1000, // settings, labels, employees, current user
  REFERENCE: 2 * 60 * 1000, // dress-model lookups, other reference data
  LIST: 15 * 1000, // volatile lists (orders, dresses catalog pages)
};

const FOCUS_STALE_MS = 60 * 1000;

const entries = new Map(); // url -> { data, time, promise }
const subscribers = new Map(); // url -> Set<fn>

function notify(url) {
  const subs = subscribers.get(url);
  if (!subs) return;
  for (const fn of [...subs]) {
    try { fn(); } catch (e) { console.warn('apiCache subscriber error:', e?.message || e); }
  }
}

/** Subscribe to updates for a URL. Returns an unsubscribe function. */
export function subscribe(url, fn) {
  let subs = subscribers.get(url);
  if (!subs) { subs = new Set(); subscribers.set(url, subs); }
  subs.add(fn);
  return () => {
    subs.delete(fn);
    if (subs.size === 0) subscribers.delete(url);
  };
}

/** Synchronously read the cached data for a URL (undefined if absent). */
export function readCache(url) {
  return entries.get(url)?.data;
}

/** Force a network refetch for a URL (deduped). Resolves with fresh data. */
export function revalidate(url) {
  const existing = entries.get(url);
  if (existing?.promise) return existing.promise;
  const promise = fetch(url, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res.json();
    })
    .then((data) => {
      // Only store if this is still the entry's current in-flight request —
      // an invalidation may have superseded us while the response was in flight.
      if (entries.get(url)?.promise === promise) {
        entries.set(url, { data, time: Date.now() });
        notify(url);
      }
      return data;
    })
    .catch((err) => {
      const entry = entries.get(url);
      if (entry?.promise === promise) delete entry.promise;
      throw err;
    });
  entries.set(url, { ...(entries.get(url) || {}), promise });
  return promise;
}

/**
 * Fetch a GET /api/* endpoint through the shared cache (SWR semantics).
 * Resolves immediately with cached data when available; revalidates in the
 * background when the entry is older than `ttl`.
 */
export function fetchSharedJson(url, { ttl = TTL.REFERENCE } = {}) {
  if (typeof window === 'undefined') {
    // SSR safety net — no shared cache on the server.
    return fetch(url).then((r) => r.json());
  }
  const entry = entries.get(url);
  if (entry && entry.data !== undefined) {
    if (Date.now() - entry.time > ttl) revalidate(url).catch(() => {});
    return Promise.resolve(entry.data);
  }
  return revalidate(url);
}

/**
 * Drop every cached entry whose URL starts with one of the given prefixes.
 * Keys that still have mounted subscribers are re-fetched right away so the
 * UI updates without a flash of missing data.
 */
export function invalidate(prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  for (const url of [...entries.keys()]) {
    if (list.some((p) => url.startsWith(p))) {
      entries.delete(url);
      if (subscribers.get(url)?.size) revalidate(url).catch(() => {});
    }
  }
}

/** Flush the whole cache (used on login/logout). */
export function invalidateAll() {
  const urls = [...entries.keys()];
  entries.clear();
  for (const url of urls) {
    if (subscribers.get(url)?.size) revalidate(url).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Automatic invalidation on mutations
// ---------------------------------------------------------------------------
// Maps a mutated resource prefix to the cache prefixes it can affect.
// Kept deliberately broad — over-invalidating costs one refetch,
// under-invalidating shows a business user wrong data.
const MUTATION_RELATIONS = [
  ['/api/rentals', ['/api/orders', '/api/dresses', '/api/inventory']],
  ['/api/returns', ['/api/orders', '/api/dresses', '/api/inventory']],
  ['/api/payments', ['/api/orders', '/api/payments', '/api/refunds']],
  ['/api/refunds', ['/api/orders', '/api/payments', '/api/refunds']],
  ['/api/customers', ['/api/customers', '/api/orders']],
  ['/api/dresses', ['/api/dresses', '/api/inventory']],
  ['/api/orders', ['/api/orders', '/api/dresses', '/api/inventory']],
  ['/api/attendance', ['/api/me', '/api/employees']],
  ['/api/employees', ['/api/employees', '/api/me']],
  ['/api/settings', ['/api/settings']],
  ['/api/pricelists', ['/api/pricelists', '/api/orders']],
];

// Non-GET endpoints that are reads/telemetry in disguise — never invalidate.
const MUTATION_SKIP = [
  '/api/log-visit',
  '/api/logs',
  '/api/auth/',
  '/api/ai',
  '/api/global-search',
  '/api/orders/validate-inventory',
  '/api/inventory/', // preload/models/availability checks POST query payloads
  '/api/send-email',
  '/api/queries-by-path',
  '/api/nedarim', // payment gateway polling; the actual Payment lands via /api/payments
  '/api/error-report',
  '/api/export-migration-report',
  '/api/db-check',
];

function invalidateForMutation(pathname) {
  if (MUTATION_SKIP.some((p) => pathname.startsWith(p))) return;
  if (pathname.startsWith('/api/login') || pathname.startsWith('/api/logout')) {
    invalidateAll();
    return;
  }
  const relation = MUTATION_RELATIONS.find(([prefix]) => pathname.startsWith(prefix));
  if (relation) {
    invalidate(relation[1]);
    return;
  }
  // Default: invalidate the endpoint's own top-level resource.
  const seg = pathname.split('/')[2];
  if (seg) invalidate(`/api/${seg}`);
}

function installMutationInvalidator() {
  if (typeof window === 'undefined' || window.__apiCacheInvalidatorInstalled) return;
  window.__apiCacheInvalidatorInstalled = true;

  // Chains over the API-logging wrapper from app/layout.js — both are
  // transparent pass-throughs, order does not matter.
  const baseFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await baseFetch.apply(this, args);
    try {
      const input = args[0];
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = (args[1]?.method || (typeof input === 'object' ? input?.method : '') || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && response.ok) {
        const pathname = new URL(url, window.location.origin).pathname;
        if (pathname.startsWith('/api/') && new URL(url, window.location.origin).origin === window.location.origin) {
          invalidateForMutation(pathname);
        }
      }
    } catch {
      // Never let cache bookkeeping break the actual request.
    }
    return response;
  };

  window.addEventListener('focus', () => {
    const now = Date.now();
    for (const [url, entry] of entries) {
      if (entry.data !== undefined && subscribers.get(url)?.size && now - entry.time > FOCUS_STALE_MS) {
        revalidate(url).catch(() => {});
      }
    }
  });
}

installMutationInvalidator();
