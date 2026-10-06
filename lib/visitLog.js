// lib/visitLog.js - עוזרים טהורים ל-POST /api/log-visit (cpu-phase0, 6.10.2026). בלי תלות ב-Next/Prisma, כדי שאפשר לבדוק ב-node ישירות.

// קריאות "אתחול" שכל טעינת דף מבצעת - לא פעולת משתמש ואין להן ערך בהיסטוריה. מתאימים לפי pathname מדויק (בלי query).
// מקור אחד לרשימה: כל שורה כזו שנשלחת לשרת (גם מקליינט ישן/מקורות אחרים) נזרקת לפני הכתיבה ל-DB.
export const NOISY_VISIT_PATHS = [
  '/api/me',
  '/api/settings',
  '/api/settings/labels',
  '/api/me/design-prefs',
  '/api/log-visit',
  '/api/version',
];

export function isNoisyVisitUrl(pageUrl) {
  if (typeof pageUrl !== 'string' || !pageUrl) return false;
  let p = pageUrl;
  const q = p.search(/[?#]/);
  if (q !== -1) p = p.slice(0, q);
  const origin = p.match(/^https?:\/\/[^/]+/i); // כתובת מלאה: מורידים את ה-origin
  if (origin) p = p.slice(origin[0].length);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return NOISY_VISIT_PATHS.includes(p);
}

// מטמון שם עובד לפי מזהה (לכל אינסטנס חם): חוסך findUnique בכל אצווה. גם "לא נמצא" נשמר (קצר) כדי שעוגיה יתומה לא תייצר שאילתה בכל בקשה.
// load(id) -> { firstName, lastName } | null. שגיאת DB לא נשמרת ומועברת הלאה.
export function createEmployeeNameCache({ load, ttlMs = 30 * 60 * 1000, missTtlMs = 60 * 1000, now = () => Date.now(), maxEntries = 500 }) {
  const map = new Map(); // id -> { name: string|null, expiresAt }
  return {
    async get(id) {
      const hit = map.get(id);
      if (hit && hit.expiresAt > now()) return hit.name;
      const emp = await load(id);
      let name = null;
      if (emp) name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || `עובד ${id}`;
      if (map.size >= maxEntries) map.clear();
      map.set(id, { name, expiresAt: now() + (name === null ? missTtlMs : ttlMs) });
      return name;
    },
    clear() { map.clear(); },
  };
}
