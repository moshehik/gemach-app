// שדות המדידה האופציונליים של PageVisitLog (docs/cpu-measurement-2026-10-06.md):
//   serverCpuMs   (INT)  - x-cpu-ms של תשובת ה-API (lib/cpuTiming.js), מעוגל למילי-שניות
//   navigationType (TEXT) - 'navigate' | 'reload' | 'back_forward' | 'prerender' | 'spa', ובסיומת '+newtab' אם נפתח בלשונית חדשה
//   serverBootId  (TEXT) - x-boot-id (lib/bootInfo.js): bootId שונים ביום = cold starts
//
// הקוד נפרס לפני ה-DDL (prisma/migrations-pending/2026-10-06-pagevisitlog-measure.sql), ולכן הכתיבה סובלנית:
// אם ה-DB חסר את העמודות (P2022 / "does not exist") או שהלקוח שנוצר ישן ("Unknown argument") - מנסים שוב בלי השדות,
// ופוסלים את השדות לאינסטנס הזה לכמה דקות (אחר כך בודקים שוב - כך שאחרי ה-DDL הכתיבה מתחילה לבד, בלי פריסה מחדש).

export const MEASURE_FIELDS = ['serverCpuMs', 'navigationType', 'serverBootId'];
const SUPPRESS_MS = 5 * 60 * 1000;

const NAV_RE = /^(navigate|reload|back_forward|prerender|spa|unknown)(\+newtab)?$/;
const BOOT_RE = /^[A-Za-z0-9-]{4,40}$/;

/** מנקה את שדות המדידה מרשומה שהגיעה מהקליינט. מחזיר אובייקט עם המפתחות התקינים בלבד (אולי ריק). */
export function measureFields(e) {
  const out = {};
  if (!e || typeof e !== 'object') return out;
  const n = typeof e.serverCpuMs === 'number' ? e.serverCpuMs : (typeof e.serverCpuMs === 'string' && e.serverCpuMs.trim() !== '' ? Number(e.serverCpuMs) : NaN);
  if (Number.isFinite(n) && n >= 0 && n <= 10 * 60 * 1000) out.serverCpuMs = Math.round(n);
  if (typeof e.navigationType === 'string' && NAV_RE.test(e.navigationType)) out.navigationType = e.navigationType;
  if (typeof e.serverBootId === 'string' && BOOT_RE.test(e.serverBootId)) out.serverBootId = e.serverBootId;
  return out;
}

export function isMissingMeasureColumnError(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  if (err.code === 'P2022') return true; // The column `X` does not exist in the current database
  if (/column .*(serverCpuMs|navigationType|serverBootId).* does not exist/i.test(msg)) return true;
  if (/Unknown (argument|field).*(serverCpuMs|navigationType|serverBootId)/i.test(msg)) return true; // לקוח Prisma שנוצר לפני שהשדות נוספו לסכימה
  return false;
}

function state() {
  if (!globalThis.__visitMeasureState) globalThis.__visitMeasureState = { suppressedUntil: 0 };
  return globalThis.__visitMeasureState;
}

const strip = (rows) => rows.map((r) => {
  const c = { ...r };
  for (const f of MEASURE_FIELDS) delete c[f];
  return c;
});

const hasMeasure = (rows) => rows.some((r) => MEASURE_FIELDS.some((f) => r[f] !== undefined));

/**
 * prisma.pageVisitLog.createMany סובלני לעמודות חסרות. rows = שורות מוכנות (כולל שדות מדידה אופציונליים).
 * לעולם לא מאבד את השורה: בכשל "עמודה חסרה" כותב שוב בלי שדות המדידה.
 */
export async function createVisitLogs(prisma, rows, now = Date.now) {
  const s = state();
  if (!hasMeasure(rows)) return prisma.pageVisitLog.createMany({ data: rows });
  if (s.suppressedUntil > now()) return prisma.pageVisitLog.createMany({ data: strip(rows) });
  try {
    return await prisma.pageVisitLog.createMany({ data: rows });
  } catch (err) {
    if (!isMissingMeasureColumnError(err)) throw err;
    s.suppressedUntil = now() + SUPPRESS_MS;
    console.warn('PageVisitLog measure columns missing - writing without them for 5 min (run prisma/migrations-pending/2026-10-06-pagevisitlog-measure.sql)');
    return prisma.pageVisitLog.createMany({ data: strip(rows) });
  }
}

/** לבדיקות בלבד */
export function __resetVisitMeasureStateForTests() {
  globalThis.__visitMeasureState = { suppressedUntil: 0 };
}
