// lib/settingsCache.js — מטמון שרת ל-SystemSetting (TTL 30s), מונע 70k+ Seq Scans/יום
// דומה ל-require_login cache ב-lib/auth.js:112 (createRequireLoginCache)
// אבל מרחיב לכל ההגדרות. חוסך findMany/findUnique חוזרים באותו lambda חם.
//
// שימוש:
//   import { getCachedSetting, getAllCachedSettings, invalidateSettingsCache } from '@/lib/settingsCache';
//   const row = await getCachedSetting('inventory_buffer_days'); // row או null
//   const all = await getAllCachedSettings(); // SystemSetting[] מלא
//
// מימוש: Map לפי key + allCache אחד. שגיאות DB לא נמטמנות (fail-open כמו במקור).
// client מותאם לטרנזקציה: כשמועבר tx client שונה מה-default, עוקפים מטמון כדי לא להחזיר stale בתוך טרנזקציה.

import prisma from '@/app/lib/prisma';

const TTL_MS = 30 * 1000;

let allCache = { data: null, expiresAt: 0, promise: null };
const keyCache = new Map(); // key -> { row, expiresAt, promise }

function isDefaultClient(client) {
  // בפרודקשן globalForPrisma.prismaProd הוא אותו אובייקט כמו prismaProxy;
  // בטרנזקציה מועבר tx אחר - אז לא להשתמש במטמון
  try { return !client || client === prisma; } catch { return true; }
}

export async function getAllCachedSettings(client) {
  const useCache = isDefaultClient(client);
  const c = useCache ? prisma : client;
  if (!c) return [];

  if (useCache && allCache.data && allCache.expiresAt > Date.now()) {
    return allCache.data;
  }
  if (useCache && allCache.promise) {
    return allCache.promise;
  }

  const load = c.systemSetting.findMany().then(rows => {
    if (useCache) {
      allCache = { data: rows, expiresAt: Date.now() + TTL_MS, promise: null };
      // רענון keyCache מה-all כדי ש-getCachedSetting ירוויח גם
      const now = Date.now() + TTL_MS;
      for (const r of rows) {
        keyCache.set(r.key, { row: r, expiresAt: now, promise: null });
      }
    }
    return rows;
  }).catch(err => {
    if (useCache) allCache.promise = null;
    throw err;
  });

  if (useCache) allCache.promise = load;
  return load;
}

// ---------------------------------------------------------------------------
// GET /api/settings - הרשימה המלאה (עם אותו where/orderBy בדיוק כמו ב-route, כדי שהסדר יישאר זהה לסדר ה-DB:
// category asc, id asc - הקולציה של Postgres, לא של JS). 30 שנ' לכל אינסטנס חם, מתבטלת ב-invalidateSettingsCache()
// (POST /api/settings ושאר הכותבים), ובכל החלפת מסד (.active-db / web_backup_mode). שגיאות לא נמטמנות.
// fresh=true עוקף את המטמון וגם מרענן אותו (מסכי עריכת הגדרות: "שמרתי ורענתי" חייב להראות את מה שנשמר גם
// כשהשמירה נעשתה באינסטנס אחר).
// ---------------------------------------------------------------------------
export const SETTINGS_LIST_EXCLUDED_KEYS = ['BRAND_LOGO', 'backup_requested_at']; // backup_requested_at: דגל פנימי (app/api/admin/backups/trigger)
export const SETTINGS_LIST_ARGS = {
  where: { key: { notIn: SETTINGS_LIST_EXCLUDED_KEYS } },
  orderBy: [{ category: 'asc' }, { id: 'asc' }],
};

let listCache = { data: null, expiresAt: 0, promise: null, tag: '', gen: 0 };

// איזה מסד "פעיל" כרגע בתהליך הזה: ב-dev - .active-db, בפרודקשן - web_backup_mode. שינוי = מטמון לא תקף.
function dbModeTag() {
  try { return `${globalThis.activeDbMode || ''}|${globalThis.webDbModeState?.mode || ''}`; } catch { return ''; }
}

export async function getCachedSettingsList({ fresh = false } = {}) {
  const tag = dbModeTag();
  if (!fresh && listCache.data && listCache.expiresAt > Date.now() && listCache.tag === tag) return listCache.data;
  if (!fresh && listCache.promise && listCache.tag === tag) return listCache.promise;

  const gen = listCache.gen;
  const load = prisma.systemSetting.findMany(SETTINGS_LIST_ARGS).then((rows) => {
    // אם בזמן הטעינה היה invalidate (כתיבה) - התוצאה עלולה להיות ישנה: מחזירים אותה לקורא הזה אבל לא שומרים
    if (listCache.gen === gen) listCache = { data: rows, expiresAt: Date.now() + TTL_MS, promise: null, tag, gen };
    return rows;
  }).catch((err) => {
    if (listCache.gen === gen && listCache.promise === load) listCache = { ...listCache, promise: null };
    throw err;
  });
  if (!fresh) listCache = { ...listCache, promise: load, tag };
  return load;
}

export async function getCachedSetting(key, client) {
  if (!key) return null;
  const useCache = isDefaultClient(client);
  const c = useCache ? prisma : client;
  if (!c) return null;

  if (useCache) {
    const e = keyCache.get(key);
    if (e && e.row !== undefined && e.expiresAt > Date.now()) return e.row;
    if (e && e.promise) return e.promise;
  }

  // אם יש allCache טרי, אפשר לענות ממנו בלי DB בכלל
  if (useCache && allCache.data && allCache.expiresAt > Date.now()) {
    const found = allCache.data.find(r => r.key === key) || null;
    // שימור ב-keyCache לטובת קריאות הבאות
    keyCache.set(key, { row: found, expiresAt: Date.now() + TTL_MS, promise: null });
    return found;
  }

  const load = c.systemSetting.findUnique({ where: { key } }).then(row => {
    if (useCache) {
      keyCache.set(key, { row, expiresAt: Date.now() + TTL_MS, promise: null });
    }
    return row;
  }).catch(err => {
    if (useCache) {
      const ent = keyCache.get(key);
      if (ent && ent.promise) keyCache.delete(key);
    }
    throw err;
  });

  if (useCache) keyCache.set(key, { row: undefined, expiresAt: 0, promise: load });
  // המתנה אמיתית - אבל אם יש promise קיים כבר החזרנו למעלה
  const result = await load;
  // אם זה היה ה-promise הזמני, הוא כבר הוחלף ב-row למעלה
  return result;
}

// עוזר נוח שמחזיר רק את ה-value (string) או fallback
export async function getCachedSettingValue(key, fallback = null, client) {
  const row = await getCachedSetting(key, client);
  return row ? row.value : fallback;
}

export function invalidateSettingsCache(key) {
  listCache = { data: null, expiresAt: 0, promise: null, tag: '', gen: listCache.gen + 1 };
  if (key) {
    keyCache.delete(key);
    // גם allCache מכיל את ה-key הזה - נפיל אותו כדי שלא יחזיר stale
    allCache = { data: null, expiresAt: 0, promise: null };
  } else {
    keyCache.clear();
    allCache = { data: null, expiresAt: 0, promise: null };
  }
}

// לשימוש ב-POST /api/settings אחרי upsert - מנקה מיד את כל ה-lambda החם
export function invalidateAllSettingsCache() {
  invalidateSettingsCache();
}
