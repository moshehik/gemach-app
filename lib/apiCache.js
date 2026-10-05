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
//   4. Per-tab persistence (lib/apiCachePersist.js) for the four allow-listed boot endpoints, whichever caller asks first
//      (/api/settings, /api/settings/labels, /api/me, /api/me/design-prefs) keeps the last answer in sessionStorage, keyed to the
//      signed-in employee (<html data-gm-uid>). A FULL page load then starts from it: younger than the key's fresh window (labels / design-prefs 15 min,
//      settings 5 min, me 90s; apiCachePersist.js) -> no network at all; up to 15 min old -> shown instantly + refreshed in the background; flushed on login/logout/any invalidation of the same prefix.
//      Window-focus revalidation of those keys uses 3 min instead of 60s. Display cache only - the server enforces everything.
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

import {
  createPersistStore, isPersistable, readUserMarker, persistFreshMs, PERSIST_FOCUS_STALE_MS,
} from './apiCachePersist.js';

const FOCUS_STALE_MS = 60 * 1000;

// Persistence is decided by the allow-list alone (isPersistable: the four boot endpoints) - NOT by which caller asked first. A page-level
// caller usually reaches fetchSharedJson before the layout widgets (child effects run before parents'), so a per-caller flag would leave
// the stored copy unread. The `persist` option of fetchSharedJson is kept for API compatibility and ignored.

let persistStore; // lazily created; null when sessionStorage is unavailable
function getPersistStore() {
  if (persistStore !== undefined) return persistStore;
  persistStore = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      persistStore = createPersistStore({ storage: window.sessionStorage, getUid: () => readUserMarker(document) });
    }
  } catch { persistStore = null; } // private mode: accessing sessionStorage can throw
  return persistStore;
}

/** The last stored answer for an allow-listed URL if it is younger than maxAgeMs (same signed-in user), else undefined. */
export function readPersistedFresh(url, maxAgeMs = persistFreshMs(url)) {
  const hit = getPersistStore()?.read(url);
  return hit && Date.now() - hit.time <= maxAgeMs ? hit.data : undefined;
}

/** Store an answer fetched by code that does not use fetchSharedJson (DesignPrefsSync needs the response headers). */
export function writePersisted(url, data) {
  return !!getPersistStore()?.write(url, data, Date.now());
}

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
        const time = Date.now();
        entries.set(url, { data, time });
        if (isPersistable(url)) getPersistStore()?.write(url, data, time);
        notify(url);
      }
      return data;
    })
    .catch((err) => {
      const entry = entries.get(url);
      if (entry?.promise === promise) delete entry.promise;
      // signed out / not allowed: the stored copy must not outlive the session
      if (/HTTP 40[13]/.test((err && err.message) || '')) getPersistStore()?.remove(url);
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
export function fetchSharedJson(url, { ttl = TTL.REFERENCE } = {}) { // (a `persist` option is accepted and ignored - see above)
  if (typeof window === 'undefined') {
    // SSR safety net — no shared cache on the server.
    return fetch(url).then((r) => r.json());
  }
  if (isPersistable(url)) {
    // first access in this page load (by ANY caller): start from the per-tab stored answer (same signed-in user only)
    const cur = entries.get(url);
    if (!cur || (cur.data === undefined && !cur.promise)) {
      const hit = getPersistStore()?.read(url);
      if (hit) entries.set(url, { data: hit.data, time: hit.time, hydrated: true });
    }
  }
  const entry = entries.get(url);
  if (entry && entry.data !== undefined) {
    // a stored (hydrated) answer is trusted without network only while younger than that key's own window (persistFreshMs), whatever the caller's ttl
    const effectiveTtl = entry.hydrated ? persistFreshMs(url) : ttl;
    if (Date.now() - entry.time > effectiveTtl) revalidate(url).catch(() => {});
    return Promise.resolve(entry.data);
  }
  return revalidate(url);
}

/**
 * Like fetchSharedJson, but NEVER serves an entry older than `maxAge` (no stale-while-revalidate): fresh -> from memory with no
 * request, older/absent -> a blocking refetch (deduped with any in-flight one). For data a screen shows as "the current list"
 * where a stale first paint is not acceptable (error-report panel: 60s).
 */
export function fetchFreshJson(url, { maxAge = TTL.LIST } = {}) {
  if (typeof window === 'undefined') return fetch(url).then((r) => r.json());
  const entry = entries.get(url);
  if (entry && entry.data !== undefined && Date.now() - entry.time <= maxAge) return Promise.resolve(entry.data);
  return revalidate(url);
}

/**
 * Drop every cached entry whose URL starts with one of the given prefixes.
 * Keys that still have mounted subscribers are re-fetched right away so the
 * UI updates without a flash of missing data.
 */
export function invalidate(prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  getPersistStore()?.removePrefixes(list);
  for (const url of [...entries.keys()]) {
    if (list.some((p) => url.startsWith(p))) {
      entries.delete(url);
      if (subscribers.get(url)?.size) revalidate(url).catch(() => {});
    }
  }
}

/** Flush the whole cache (used on login/logout). */
export function invalidateAll() {
  getPersistStore()?.clear();
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
// /api/stock-check (בדיקת מלאי, lib/stockCheck.js) נגזר מאותם נתונים כמו /api/inventory -
// כל שינוי בהזמנות/השכרות/החזרות/שמלות חייב לבטל גם אותו, אחרת הדף מציג פנוי מיושן.
const MUTATION_RELATIONS = [

  // /api/schedule (הלו״ז היומי) נגזר מהזמנות, פריטים, תיקונים, משלוחים, לקוחות (שם/טלפון/כתובת בשורה),
  // שמלות (מיקום/בתיקון בשלב ההכנה) ונוכחות ("מי במשמרת") - כל כתיבה באחד מהם מיישנת אותו (בלי הרישום
  // כאן, ברירת המחדל למטה הייתה מבטלת רק את המשאב העליון של הנתיב). סקירת WP1, ממצא 10.
  ['/api/rentals', ['/api/orders', '/api/dresses', '/api/inventory', '/api/schedule', '/api/stock-check']],
  ['/api/returns', ['/api/orders', '/api/dresses', '/api/inventory', '/api/schedule', '/api/stock-check']],
  ['/api/payments', ['/api/orders', '/api/payments', '/api/refunds']],
  ['/api/refunds', ['/api/orders', '/api/payments', '/api/refunds']],
  ['/api/customers', ['/api/customers', '/api/orders', '/api/schedule']],
  ['/api/dresses', ['/api/dresses', '/api/inventory', '/api/schedule', '/api/stock-check']],
  ['/api/orders', ['/api/orders', '/api/dresses', '/api/inventory', '/api/schedule', '/api/stock-check']],
  ['/api/alterations', ['/api/alterations', '/api/schedule']],
  ['/api/deliveries', ['/api/deliveries', '/api/schedule']],
  // סימון "בוצע" בלו״ז (POST /api/schedule/marks) כותב גם על פריטי הזמנה (תיקון בוצע, הוחזר) - מיישן גם את
  // ההזמנות, התיקונים, השמלות והמלאי, לא רק את הלו״ז עצמו.
  ['/api/schedule', ['/api/schedule', '/api/orders', '/api/alterations', '/api/dresses', '/api/inventory', '/api/stock-check']],
  ['/api/attendance', ['/api/me', '/api/employees', '/api/schedule']],
  ['/api/employees', ['/api/employees', '/api/me']],
  ['/api/settings', ['/api/settings', '/api/stock-check']],
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
  // רישום אירוע להזמנה (הדפסה/הורדה/ייצוא - lib/history/orderEvents.js): שורת היסטוריה בלבד, לא משנה הזמנה/מלאי
  '/api/orders/events',
  '/api/inventory/', // preload/models/availability checks POST query payloads
  '/api/send-email',
  '/api/queries-by-path',
  '/api/nedarim', // payment gateway polling; the actual Payment lands via /api/payments
  '/api/error-report',
  '/api/export-migration-report',
  '/api/db-check',
  // הורדת Excel מאשף ההדפסות של הלו״ז היא POST (כדי שסיסמת המאשר/ת לא תעבור בכתובת) אבל רק קוראת - בלי זה
  // היא נתפסה ע"י הכלל של '/api/schedule' ורוקנה את המטמון של ההזמנות, התיקונים, השמלות, המלאי ובדיקת המלאי
  '/api/schedule/print',
];

/** true = POST/PUT/... לנתיב הזה אינו שינוי נתונים (לא מרוקן מטמון) */
export function isMutationSkipped(pathname) {
  // רישום אירועי כרטיס הלקוח (הדפסה/ייצוא/אישור מנהל - שורת היסטוריה בלבד) לא משנה נתוני לקוח: בלי זה כל הדפסה רוקנה את
  // מטמון רשימת הלקוחות (הכלל ברירת המחדל '/api/customers')
  if (/^\/api\/customers\/[^/]+\/events$/.test(pathname)) return true;
  return MUTATION_SKIP.some((p) => pathname.startsWith(p));
}

function invalidateForMutation(pathname) {
  // The error-report panel caches its own list (fetchFreshJson). Any write to it (send, reply, archive, mark read, sketch decision)
  // drops that list only - it is in MUTATION_SKIP because it must NOT touch orders/dresses/etc.
  if (pathname.startsWith('/api/error-report')) { invalidate('/api/error-report'); return; }
  if (isMutationSkipped(pathname)) return;
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
      const focusStale = isPersistable(url) ? PERSIST_FOCUS_STALE_MS : FOCUS_STALE_MS;
      if (entry.data !== undefined && subscribers.get(url)?.size && now - entry.time > focusStale) {
        revalidate(url).catch(() => {});
      }
    }
  });
}

installMutationInvalidator();

// Not signed in (no <html data-gm-uid>, e.g. the login page after a logout): flush whatever a previous user left in this tab.
try {
  if (typeof window !== 'undefined' && !readUserMarker(document)) getPersistStore()?.clear();
} catch { /* ignore */ }
