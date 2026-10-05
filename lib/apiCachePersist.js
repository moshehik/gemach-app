// ============================================================================
// apiCachePersist.js - per-TAB persistence (sessionStorage) for the few "boot" GET endpoints
// ============================================================================
//
// Why: every FULL page load (employees reload ~55 times a day each, see docs/cpu-reduction-2026-10-05.md) starts with an empty in-memory
// apiCache, so /api/settings (66KB), /api/settings/labels, /api/me and /api/me/design-prefs were fetched again on every load, although
// 80-87% of those calls repeat within 5 minutes. lib/apiCache.js uses this module to keep the last answer of THESE FOUR endpoints in
// sessionStorage: a reload within PERSIST_FRESH_MS does no network at all for them, an older entry (up to PERSIST_MAX_AGE_MS) is shown
// instantly and refreshed in the background (stale-while-revalidate), and nothing older is ever used.
//
// Safety rules (all enforced HERE, pure functions + an injectable storage so they are unit-tested without a browser):
//   * allow-list: only PERSIST_URLS can ever be stored - an accidental opt-in of a sensitive endpoint is a no-op.
//   * user marker: every entry carries the id of the signed-in employee (the server renders it into <html data-gm-uid>, from the
//     VERIFIED auth cookie). An entry whose marker differs from the current one is dropped on read, and with no marker (not signed in)
//     nothing is read or written. So a different user in the same tab never sees another's data.
//   * body check: /api/me and /api/me/design-prefs carry the employee id; it must equal the marker, on read AND on write.
//   * the endpoints' own responses only: nothing is added to what the server already returned to that very user.
//   * every storage access is wrapped in try/catch (private mode, blocked storage, quota) - failure just means "no persistence".
//   * size caps per entry and in total; an oversized value is skipped (and the old one removed), never truncated.
//   * flushed on login/logout and on any invalidation of the same URL prefix (apiCache calls remove/clear), and on 401/403.
// Server-side enforcement never depends on any of this - these are display caches.
// ============================================================================

export const PERSIST_URLS = ['/api/settings', '/api/settings/labels', '/api/me', '/api/me/design-prefs'];
// Per-key "fresh" windows: a stored answer younger than this is served with NO network at all; older (up to PERSIST_MAX_AGE_MS) is shown
// instantly and refreshed in the background. Chosen by how the data changes:
//   /api/settings/labels, /api/me/design-prefs: 15 min - changed only through this app's own writes, which flush them (same-prefix
//        invalidation, login/logout); nothing else moves them.
//   /api/settings: 5 min - changed by settings saves (flushed in the saving tab); other tabs/devices see it within 5 min (the server
//        cache adds up to 30s). The same as TTL.STATIC the in-memory cache always used.
//   /api/me: 90s - carries activeShift (clock in/out from another tab/device is not seen here) and the role; clock in/out in THIS tab flushes it.
export const PERSIST_FRESH_BY_URL = {
  '/api/settings/labels': 15 * 60 * 1000,
  '/api/me/design-prefs': 15 * 60 * 1000,
  '/api/settings': 5 * 60 * 1000,
  '/api/me': 90 * 1000,
};
export const PERSIST_FRESH_MS = 90 * 1000; // fallback (not used for the four allow-listed URLs)
export function persistFreshMs(url) {
  return PERSIST_FRESH_BY_URL[url] ?? PERSIST_FRESH_MS;
}
export const PERSIST_MAX_AGE_MS = 15 * 60 * 1000; // older than this: ignored (never shown)
export const PERSIST_MAX_ENTRY_CHARS = 200 * 1000; // /api/settings is ~66KB
export const PERSIST_MAX_TOTAL_CHARS = 400 * 1000;
export const PERSIST_FOCUS_STALE_MS = 3 * 60 * 1000; // window-focus revalidation threshold for these keys (others keep 60s)
export const PERSIST_KEY_PREFIX = 'gm:ac:v1:';
export const USER_MARKER_ATTR = 'data-gm-uid';

export function isPersistable(url) {
  return PERSIST_URLS.includes(url);
}

/** The signed-in employee id the server rendered into <html data-gm-uid> ('' when not signed in / unavailable). */
export function readUserMarker(doc) {
  try {
    const v = doc && doc.documentElement && doc.documentElement.getAttribute(USER_MARKER_ATTR);
    return typeof v === 'string' ? v.trim() : '';
  } catch {
    return '';
  }
}

/**
 * The employee id a response BODY claims to belong to (null = this endpoint carries none). Compared with the <html data-gm-uid> marker
 * on read and on write: a body of another employee (multi-tab login switch A/B/A, a response that raced a login) is never stored/served.
 */
export function bodyIdentity(url, data) {
  if (url === '/api/me') return (data && data.employee && data.employee.id) || '';
  if (url === '/api/me/design-prefs') return (data && data.employeeId) || '';
  return null;
}

export function persistKey(url) {
  return PERSIST_KEY_PREFIX + url;
}

/**
 * Store factory. `storage` is anything with getItem/setItem/removeItem/key/length (window.sessionStorage or a fake);
 * `getUid` returns the current user marker; `now` returns ms.
 */
export function createPersistStore({ storage, getUid, now = Date.now }) {
  const usable = () => !!storage && typeof getUid === 'function';

  function ownKeys() {
    const keys = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (typeof k === 'string' && k.startsWith(PERSIST_KEY_PREFIX)) keys.push(k);
      }
    } catch { /* storage blocked */ }
    return keys;
  }

  function removeKey(k) {
    try { storage.removeItem(k); } catch { /* ignore */ }
  }

  /** -> { data, time } for a valid, same-user, not-too-old entry; otherwise null (and a bad/foreign/expired entry is removed). */
  function read(url) {
    if (!usable() || !isPersistable(url)) return null;
    const uid = getUid();
    if (!uid) return null;
    const k = persistKey(url);
    let raw;
    try { raw = storage.getItem(k); } catch { return null; }
    if (raw == null) return null;
    try {
      const e = JSON.parse(raw);
      if (!e || e.v !== 1 || e.uid !== uid || typeof e.time !== 'number' || e.data === undefined) throw new Error('mismatch');
      const age = now() - e.time;
      if (age < -5000 || age > PERSIST_MAX_AGE_MS) throw new Error('age'); // clock went backwards by more than 5s, or too old
      const who = bodyIdentity(url, e.data);
      if (who !== null && who !== uid) throw new Error('body identity'); // the body belongs to someone else than the marker
      return { data: e.data, time: e.time };
    } catch {
      removeKey(k);
      return null;
    }
  }

  /** true when stored. An oversized value is NOT stored and any older copy is removed. */
  function write(url, data, time = now()) {
    if (!usable() || !isPersistable(url)) return false;
    const uid = getUid();
    if (!uid) return false;
    const k = persistKey(url);
    const who = bodyIdentity(url, data);
    if (who !== null && who !== uid) { removeKey(k); return false; } // never store another employee's body under this marker
    let raw;
    try { raw = JSON.stringify({ v: 1, uid, time, data }); } catch { removeKey(k); return false; }
    if (typeof raw !== 'string' || raw.length > PERSIST_MAX_ENTRY_CHARS) { removeKey(k); return false; }
    // total cap: drop the OTHER entries' bytes if needed (they are all re-creatable from the network)
    let total = raw.length;
    for (const other of ownKeys()) {
      if (other === k) continue;
      try { total += (storage.getItem(other) || '').length; } catch { /* ignore */ }
    }
    if (total > PERSIST_MAX_TOTAL_CHARS) for (const other of ownKeys()) if (other !== k) removeKey(other);
    try { storage.setItem(k, raw); return true; } catch { removeKey(k); return false; } // quota / private mode
  }

  function remove(url) {
    if (!storage) return;
    removeKey(persistKey(url));
  }

  /** Remove every stored entry whose URL starts with one of the prefixes (mirrors apiCache.invalidate). */
  function removePrefixes(prefixes) {
    if (!storage) return;
    const list = Array.isArray(prefixes) ? prefixes : [prefixes];
    for (const k of ownKeys()) {
      const url = k.slice(PERSIST_KEY_PREFIX.length);
      if (list.some((p) => url.startsWith(p))) removeKey(k);
    }
  }

  function clear() {
    if (!storage) return;
    for (const k of ownKeys()) removeKey(k);
  }

  return { read, write, remove, removePrefixes, clear };
}
