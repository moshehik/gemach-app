// מטמון עמודים משותף בסגנון SWR (הצגה מיידית מהזיכרון + רענון שקט ברקע).
// עד עכשיו כל דף החזיק Map משלו ברמת המודול (ordersCache, customersCache...) —
// כאן כולם חולקים store אחד, מה שמאפשר: תקרת גודל גלובלית, פינוי לפי namespace
// אחרי מוטציה, ו-prefetch של דף אחד מתוך דף אחר (ראה prefetchRoutes.js).
//
// הסמנטיקה זהה במכוון ל-Map-ים הישנים: ערך שמור מוגש מיד ללא בדיקת גיל,
// כי כל דף ממילא מרענן מהשרת ברקע בכל mount. אין TTL על נתוני הדפים —
// רק תקרת כמות כדי שהזיכרון לא יגדל בלי גבול לאורך משמרת שלמה.

import { fetchSharedJson, invalidate, TTL } from '../../lib/apiCache';

const MAX_ENTRIES = 300;

// "namespace::key" -> value; סדר ההכנסה משמש כ-LRU מקורב (get מרענן את המיקום).
const store = new Map();

function touch(fullKey, value) {
  if (store.has(fullKey)) store.delete(fullKey);
  store.set(fullKey, value);
  if (store.size > MAX_ENTRIES) {
    store.delete(store.keys().next().value);
  }
}

// מחזיר אובייקט תואם-Map (has/get/set/delete/clear) כך שדף קיים מחליף
// `const xCache = new Map()` ב-`const xCache = cacheNamespace('x')` ותו לא.
export function cacheNamespace(name) {
  const prefix = name + '::';
  return {
    has: (key) => store.has(prefix + key),
    get: (key) => {
      const fullKey = prefix + key;
      if (!store.has(fullKey)) return undefined;
      const value = store.get(fullKey);
      touch(fullKey, value);
      return value;
    },
    set: (key, value) => touch(prefix + key, value),
    delete: (key) => store.delete(prefix + key),
    clear: () => invalidateNamespace(name),
  };
}

export function invalidateNamespace(name) {
  const prefix = name + '::';
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

// ===== דה-דופליקציה של בקשות GET מקבילות =====
// שתי קריאות לאותו URL בעודן באוויר (למשל hover-prefetch + mount של הדף)
// חולקות בקשת רשת אחת. בקשות שאינן GET לעולם לא מאוחדות.
const inflight = new Map();

export function fetchJson(url, init) {
  const method = ((init && init.method) || 'GET').toUpperCase();
  if (method !== 'GET') {
    return fetch(url, init).then((res) => res.json());
  }
  if (inflight.has(url)) return inflight.get(url);
  const promise = fetch(url, init)
    .then((res) => res.json())
    .finally(() => inflight.delete(url));
  inflight.set(url, promise);
  return promise;
}

// ===== /api/settings משותף =====
// ההגדרות נשלפות בנפרד ע"י ~10 דפים ומודאלים. מקור אחד לכולן: המטמון המשותף
// ב-lib/apiCache (SWR + ביטול אוטומטי על כל מוטציה דרך ה-interceptor שלו),
// כדי שלא יתקיימו שני עותקים של אותן הגדרות עם גילאים שונים.
// מסך ההגדרות עדיין קורא ל-invalidateSettings() אחרי שמירה לאיפוס מיידי.
export function getSettingsCached() {
  return fetchSharedJson('/api/settings', { ttl: TTL.STATIC });
}

export function invalidateSettings() {
  invalidate('/api/settings');
}
