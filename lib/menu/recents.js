// lib/menu/recents.js — "נצפו לאחרונה" (R07) — מודול טהור, בלי DOM ובלי DB.
//
// מה קיים היום: lib/historyManager.js שומר ב-localStorage (מפתח agy_history) עד 7 פריטים מ-4 סוגים
// (order / customer / dress / rental), שנכתבים מכרטיס ההזמנה, כרטיס הלקוח, דף הדגם וחלון ההשכרה.
// בעיצוב המאושר "נצפו לאחרונה" ומחסנית אחורה/קדימה הן רשימה אחת (lib/menu/navHistory.js).
// כאן: (1) זיהוי ישות מתוך נתיב (/orders/123 → הזמנה 123), (2) המרה של שלושת המקורות — מחסנית הניווט,
// agy_history הישן, ושורות PageVisitLog מהשרת (אין DDL: הטבלה קיימת, pageUrl נכתב כבר היום ע"י PageTracker) —
// לצורה אחידה, (3) מיזוג עם ביטול כפילויות ותקרה. הרכיב מציג את התוצאה; השרת (נקודת קריאה עתידית,
// ר' docs/menu-a5-build-plan.md) יכול להעשיר תוויות (שם לקוחה להזמנה).
//
// אין כאן רישום סריקות ברקוד (SPEC סעיף 5: סריקות לא נרשמות ב"נצפו לאחרונה").

import { normalizeNavPath, shouldRecordPath } from './navHistory.js';

export const RECENTS_CAP = 10;
export const LEGACY_HISTORY_KEY = 'agy_history';
export const LEGACY_HISTORY_CAP = 7;
export const RECENT_ENTITY_TYPES = Object.freeze(['order', 'customer', 'dress', 'rental']);

const ENTITY_ICON = Object.freeze({ order: 'file', customer: 'user', dress: 'dress', rental: 'bag', page: 'file' });
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * מזהה ישות מתוך נתיב עמוד. מחזיר { type, id } או null כשזה לא עמוד ישות.
 *   /orders/52103            → order 52103 (מספר ההזמנה הקריא, לא UUID)
 *   /customers/<uuid>        → customer
 *   /dashboard/dresses/<id>  → dress
 *   /rentals?orderId=52103   → rental 52103 (חלון ההשכרה שנפתח מקישור)
 */
export function parseEntityPath(href) {
  const p = normalizeNavPath(href);
  if (!p) return null;
  const bare = p.split(/[?#]/)[0];
  const query = (p.match(/\?([^#]*)/) || [])[1] || '';
  let m = bare.match(/^\/orders\/(\d+)$/);
  if (m) return { type: 'order', id: m[1] };
  m = bare.match(/^\/customers\/([^/]+)$/);
  if (m && m[1] !== 'new' && ID_RE.test(m[1])) return { type: 'customer', id: m[1] };
  m = bare.match(/^\/dashboard\/dresses\/([^/]+)$/);
  if (m && m[1] !== 'new' && ID_RE.test(m[1])) return { type: 'dress', id: m[1] };
  if (bare === '/rentals' && query) {
    const q = query.split('&').find((kv) => kv.startsWith('orderId='));
    const id = q ? decodeURIComponent(q.slice('orderId='.length)) : '';
    if (/^\d+$/.test(id)) return { type: 'rental', id };
  }
  return null;
}

/** הנתיב שאליו מובילה ישות (אותו מיפוי כמו handleHistoryItemClick ב-TopbarSearch.js). */
export function entityHref(type, id) {
  const safe = String(id);
  switch (type) {
    case 'order': return `/orders/${safe}`;
    case 'customer': return `/customers/${safe}`;
    case 'dress': return `/dashboard/dresses/${safe}`;
    case 'rental': return `/rentals?orderId=${encodeURIComponent(safe)}`;
    default: return null;
  }
}

/** תווית ברירת מחדל כשאין שם (השרת / הדף יכולים להחליף אותה). */
export function defaultLabel(type, id) {
  switch (type) {
    case 'order': return `הזמנה #${id}`;
    case 'rental': return `השכרה #${id}`;
    case 'customer': return 'לקוח';
    case 'dress': return `דגם ${id}`;
    default: return String(id || '');
  }
}

export const recentKey = (type, id) => `${type}:${id}`;

function finish(entry) {
  return {
    key: entry.key,
    type: entry.type,
    id: entry.id === undefined ? null : entry.id,
    label: entry.label,
    subtext: entry.subtext || '',
    href: entry.href,
    icon: entry.icon || ENTITY_ICON[entry.type] || 'file',
    ts: typeof entry.ts === 'number' && Number.isFinite(entry.ts) ? entry.ts : 0,
    source: entry.source,
  };
}

/** פריט agy_history ישן ({ type, id, name, subtext, timestamp }) → פריט "נצפו לאחרונה". null אם לא תקין. */
export function legacyItemToRecent(item) {
  if (!item || typeof item !== 'object') return null;
  const type = String(item.type || '');
  if (!RECENT_ENTITY_TYPES.includes(type)) return null;
  const id = item.id === undefined || item.id === null ? '' : String(item.id);
  if (!id || !ID_RE.test(id)) return null;
  return finish({
    key: recentKey(type, id), type, id,
    label: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : defaultLabel(type, id),
    subtext: typeof item.subtext === 'string' ? item.subtext : '',
    href: entityHref(type, id),
    ts: typeof item.timestamp === 'number' ? item.timestamp : 0,
    source: 'legacy',
  });
}

/** רשומת מחסנית הניווט ({ key, path, label, icon, ts }) → פריט. עמוד שאינו ישות נשמר כ-type 'page'. */
export function navEntryToRecent(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.path !== 'string') return null;
  const ent = parseEntityPath(entry.path);
  if (ent) {
    return finish({
      key: recentKey(ent.type, ent.id), type: ent.type, id: ent.id,
      label: entry.label && entry.label !== entry.path ? entry.label : defaultLabel(ent.type, ent.id),
      href: entityHref(ent.type, ent.id), icon: entry.icon && entry.icon !== 'file' ? entry.icon : ENTITY_ICON[ent.type],
      ts: entry.ts, source: 'nav',
    });
  }
  if (!shouldRecordPath(entry.path)) return null;
  const path = normalizeNavPath(entry.path);
  return finish({ key: `page:${path}`, type: 'page', id: null, label: entry.label || path, href: path, icon: entry.icon || 'file', ts: entry.ts, source: 'nav' });
}

/**
 * שורת PageVisitLog ({ pageUrl, timestamp }) → פריט, רק לעמודי ישות (קריאות API ורשומות רקע נזרקות).
 * timestamp יכול להיות Date, מספר או מחרוזת ISO.
 */
export function visitRowToRecent(row) {
  if (!row || typeof row !== 'object' || typeof row.pageUrl !== 'string') return null;
  const url = row.pageUrl;
  if (url.startsWith('/api') || url.includes('light=1')) return null;
  const ent = parseEntityPath(url);
  if (!ent) return null;
  let ts = 0;
  const t = row.timestamp;
  if (t instanceof Date) ts = t.getTime();
  else if (typeof t === 'number') ts = t;
  else if (typeof t === 'string') { const d = Date.parse(t); ts = Number.isFinite(d) ? d : 0; }
  return finish({ key: recentKey(ent.type, ent.id), type: ent.type, id: ent.id, label: defaultLabel(ent.type, ent.id), href: entityHref(ent.type, ent.id), ts, source: 'server' });
}

/**
 * מיזוג המקורות לרשימה אחת: החדש למעלה, בלי כפילויות (לפי key), עד cap.
 * כשאותו מפתח מגיע מכמה מקורות — נשמר החדש ביותר, אבל תווית/טקסט משנה "עשירים" (לא ברירת מחדל) מנצחים.
 * @param {{ nav?: Array, legacy?: Array, visits?: Array, extra?: Array }} sources  extra = פריטים שכבר בצורה הסופית
 * @param {{ cap?: number, entitiesOnly?: boolean }} [opts]
 */
export function mergeRecents(sources = {}, opts = {}) {
  const cap = typeof opts.cap === 'number' && opts.cap >= 1 ? Math.floor(opts.cap) : RECENTS_CAP;
  const entitiesOnly = !!opts.entitiesOnly;
  const all = [];
  for (const e of sources.nav || []) { const r = navEntryToRecent(e); if (r) all.push(r); }
  for (const e of sources.legacy || []) { const r = legacyItemToRecent(e); if (r) all.push(r); }
  for (const e of sources.visits || []) { const r = visitRowToRecent(e); if (r) all.push(r); }
  for (const e of sources.extra || []) { if (e && typeof e === 'object' && e.key && e.href) all.push(finish({ ...e, source: e.source || 'extra' })); }

  const byKey = new Map();
  for (const r of all) {
    if (entitiesOnly && r.type === 'page') continue;
    const prev = byKey.get(r.key);
    if (!prev) { byKey.set(r.key, r); continue; }
    const newer = r.ts >= prev.ts ? r : prev;
    const older = newer === r ? prev : r;
    const rich = (x) => x.label && x.label !== defaultLabel(x.type, x.id);
    byKey.set(r.key, {
      ...newer,
      label: rich(newer) ? newer.label : (rich(older) ? older.label : newer.label),
      subtext: newer.subtext || older.subtext || '',
    });
  }
  return [...byKey.values()].sort((a, b) => b.ts - a.ts).slice(0, cap);
}

/** פריט "נצפו לאחרונה" → צורת agy_history (לתאימות עם TopbarSearch.js הישן בזמן המעבר). */
export function toLegacyItem(recent) {
  if (!recent || !RECENT_ENTITY_TYPES.includes(recent.type)) return null;
  return { type: recent.type, id: recent.id, name: recent.label, subtext: recent.subtext || '', timestamp: recent.ts || Date.now() };
}

/** תוכנית לשרת (לא נבנה כאן): הפרמטרים שנקודת הקריאה GET /api/me/recent-pages תקבל ותחזיר. */
export const SERVER_RECENTS_CONTRACT = Object.freeze({
  route: '/api/me/recent-pages',
  query: { limit: `1..${RECENTS_CAP}` },
  source: 'PageVisitLog where employeeId = me and pageUrl not like /api/% order by timestamp desc take 200, then visitRowToRecent + mergeRecents',
  enrich: 'order → customer name (Order.orderId → Customer.firstName/lastName); dress → DressModel.name; customer → name',
  response: '{ recents: [{ key, type, id, label, subtext, href, icon, ts }] }',
});
