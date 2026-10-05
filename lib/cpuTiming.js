// מדידת CPU לנתיבי API כבדים (opt-in): withCpuTiming(handler) עוטף route handler ומוסיף לתשובה
//   Server-Timing: cpu;dur=<ms>, wall;dur=<ms>     x-cpu-ms: <ms>     x-cpu-conc: <max concurrent>     x-boot-id: <bootId>
// הקליינט (ה-interceptor ב-app/layout.js) קורא x-cpu-ms/x-boot-id ושולח אותם עם שורת הלוג ל-/api/log-visit
// (PageVisitLog.serverCpuMs / serverBootId). ר' docs/cpu-measurement-2026-10-06.md.
//
// איך מודדים: process.cpuUsage() הוא של התהליך כולו, ואינסטנס של Vercel משרת כמה בקשות במקביל. כדי לא לייחס CPU של בקשה אחת
// לשכנתה, כל אירוע (תחילת/סוף בקשה) סוגר "פרוסת זמן": דלתת ה-CPU מאז האירוע הקודם מחולקת שווה בשווה בין הבקשות הפעילות
// באותה פרוסה. כך הסכום על פני הבקשות = CPU של התהליך בזמן שהיה לפחות handler אחד פעיל, והבקשה הבודדת (conc=1) מדויקת.
// מגבלה: CPU של רינדור עמודים/תהליכים שאינם עטופים (למשל RSC של דף שרץ במקביל) נספר לבקשה הפעילה - לכן יש גם x-cpu-conc.
// עלות: שתי קריאות process.cpuUsage() (~מיקרו-שניות) + כותרות. לא נוגע ב-body ולא ב-DB.

import { getBootId, noteRequest } from '@/lib/bootInfo';

function cpuMsNow() {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1000;
}

function acct() {
  if (!globalThis.__gemachCpuAcct) globalThis.__gemachCpuAcct = { lastCpuMs: cpuMsNow(), active: new Map(), seq: 0 };
  return globalThis.__gemachCpuAcct;
}

// סוגר פרוסה: מחלק את ה-CPU מאז הפעם הקודמת בין הבקשות הפעילות
function settle(a) {
  const now = cpuMsNow();
  const delta = Math.max(0, now - a.lastCpuMs);
  a.lastCpuMs = now;
  if (a.active.size > 0 && delta > 0) {
    const share = delta / a.active.size;
    for (const rec of a.active.values()) rec.cpuMs += share;
  }
}

/** מתחיל מדידה. מחזיר טוקן ל-endCpuTiming. */
export function beginCpuTiming() {
  const a = acct();
  settle(a);
  const rec = { cpuMs: 0, startedAt: performance.now(), maxConc: 0 };
  a.active.set(++a.seq, rec);
  const conc = a.active.size;
  for (const r of a.active.values()) if (conc > r.maxConc) r.maxConc = conc;
  return { id: a.seq, rec };
}

/** מסיים מדידה; מחזיר { cpuMs, wallMs, conc } */
export function endCpuTiming(token) {
  const a = acct();
  settle(a);
  a.active.delete(token.id);
  return { cpuMs: token.rec.cpuMs, wallMs: performance.now() - token.rec.startedAt, conc: token.rec.maxConc };
}

const fmt = (n) => (Math.round(n * 10) / 10).toString();

/** מוסיף את כותרות המדידה ל-Response (אם הכותרות לא ניתנות לשינוי - בונה Response חדש עם אותו גוף). */
export function applyTimingHeaders(res, { cpuMs, wallMs, conc }) {
  if (!res || typeof res !== 'object' || !res.headers || typeof res.headers.set !== 'function') return res;
  const set = (r) => {
    r.headers.set('Server-Timing', `cpu;dur=${fmt(cpuMs)}, wall;dur=${fmt(wallMs)}`);
    r.headers.set('x-cpu-ms', fmt(cpuMs));
    r.headers.set('x-cpu-conc', String(conc));
    r.headers.set('x-boot-id', getBootId());
    return r;
  };
  try {
    return set(res);
  } catch {
    // Response שהגיע מ-fetch (כותרות immutable): מעתיקים
    try { return set(new Response(res.body, { status: res.status, statusText: res.statusText, headers: new Headers(res.headers) })); } catch { return res; }
  }
}

/**
 * עוטף route handler של Next (GET/POST/...). שימוש בשורה אחת בנתיב:
 *   async function GET(request) { ... }              // בלי export
 *   const GET_timed = withCpuTiming(GET); export { GET_timed as GET };
 * חריגות עוברות הלאה כמו שהן (המדידה לא בולעת שגיאות ולא משנה סטטוס). המדידה כבויה עם CPU_TIMING=off.
 */
export function withCpuTiming(handler) {
  if (typeof handler !== 'function') throw new TypeError('withCpuTiming: handler must be a function');
  return async function timedHandler(...args) {
    if (process.env.CPU_TIMING === 'off') return handler(...args);
    const token = beginCpuTiming();
    noteRequest();
    let res;
    try {
      res = await handler(...args);
    } catch (err) {
      endCpuTiming(token);
      throw err;
    }
    return applyTimingHeaders(res, endCpuTiming(token));
  };
}
