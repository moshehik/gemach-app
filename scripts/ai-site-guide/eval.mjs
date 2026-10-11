// scripts/ai-site-guide/eval.mjs - מריץ את סט השאלות מול נקודת הקצה האמיתית /api/ai של שרת פיתוח מקומי (מסד TEST בלבד!).
//
// שימוש (מתוך שורש הפרויקט, כששרת הפיתוח רץ על פורט 3122 עם .env שמצביע ל-TEST):
//   node scripts/ai-site-guide/eval.mjs --out scratch/ai-site-guide/before.json [--base http://localhost:3122] [--only q01,q02] [--limit 10]
//        [--secret <AGENT_LOGIN_SECRET>] [--employee-id <uuid של עובדת רגילה>] [--concurrency 2]
//
// התחברות: מנהל = /api/dev/agent-login?secret=... (עובד שירות roleId 2). עובדת רגילה = עוגיית auth_token עם מזהה עובדת (רק מול שרת מקומי).
// הסקריפט מסרב לרוץ מול כתובת שאינה localhost (בטיחות: אסור לגעת בפרודקשן).
// כל שאלה = שיחה חדשה (בלי היסטוריה), כמו השאלה הראשונה בווידג'ט, עם אותה מחרוזת context שהווידג'ט שולח.
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));

const BASE = args.base || 'http://localhost:3122';
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error('מסרב: --base חייב להיות localhost (מסד TEST בלבד). קיבלתי:', BASE);
  process.exit(2);
}
const SECRET = args.secret || process.env.AGENT_LOGIN_SECRET || 'local-ai-guide-test-secret-2026';
const OUT = args.out || 'scratch/ai-site-guide/run.json';
const QFILE = args.questions || 'scripts/ai-site-guide/questions.json';
const CONC = Number(args.concurrency || 2);
const questions = JSON.parse(fs.readFileSync(QFILE, 'utf8'));
let list = questions;
if (args.only) { const s = new Set(String(args.only).split(',')); list = list.filter((q) => s.has(q.id)); }
if (args.limit) list = list.slice(0, Number(args.limit));

// מחרוזת ה-context של AIFloatingWidget (זהה למה שהווידג'ט שולח; בלי תאריך כדי שהריצות יהיו דטרמיניסטיות יותר)
const widgetContext = (todayHe, extra = '') => `התאריך היום הוא: ${todayHe}. ${extra}אתה עוזר וירטואלי עבור עובדי הגמ"ח. מותר לך לספק נתונים על לקוחות, הזמנות, פריטים ומלאי כדי לעזור בשירות לקוחות. אסור לך לחשוף מידע על עובדים אחרים, משמרות או הרשאות. אסור לך להציג סטטיסטיקות כלליות, סיכומי רווחים, דוחות או פילוחים ניהוליים מתקדמים (אם העובד מבקש סטטיסטיקות כאלו, אמור לו שזה זמין רק בממשק מנהל).`;
const todayHe = new Date().toLocaleDateString('he-IL');

async function loginManager() {
  const r = await fetch(`${BASE}/api/dev/agent-login?secret=${encodeURIComponent(SECRET)}`, { redirect: 'manual' });
  const cookies = r.headers.getSetCookie().map((c) => c.split(';')[0]);
  if (!cookies.length) throw new Error('agent-login לא החזיר עוגיות (status ' + r.status + ')');
  return cookies.join('; ');
}
const cookieFor = {};
async function cookie(role) {
  if (cookieFor[role]) return cookieFor[role];
  if (role === 'employee') {
    if (!args['employee-id']) throw new Error('שאלה עם role=employee דורשת --employee-id');
    cookieFor[role] = `auth_token=${args['employee-id']}`;
  } else cookieFor[role] = await loginManager();
  return cookieFor[role];
}

async function ask(q) {
  const t0 = Date.now();
  const body = {
    prompt: q.q,
    history: [],
    firstQuestion: true,
    currentPath: q.currentPath || '/',
    context: widgetContext(todayHe, q.currentPath && q.currentPath.startsWith('/orders/') ? `הלקוח נמצא כעת במסך כרטיס הזמנה מס' ${q.currentPath.split('/')[2]}. ` : ''),
  };
  try {
    const res = await fetch(`${BASE}/api/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: await cookie(q.role || 'manager') }, body: JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { id: q.id, status: res.status, ms: Date.now() - t0, response: json?.response ?? null, guide: json?.guide ?? null, hasData: !!json?.data, sqlQuery: json?.sqlQuery ?? null, raw: json ? undefined : text.slice(0, 300) };
  } catch (e) {
    return { id: q.id, status: 0, ms: Date.now() - t0, error: String(e && e.message || e) };
  }
}

const results = [];
let next = 0;
async function worker() {
  while (next < list.length) {
    const q = list[next++];
    const r = await ask(q);
    results.push(r);
    console.log(`${q.id} [${r.status}] ${r.ms}ms ${String(r.response || r.error || r.raw || '').replace(/\s+/g, ' ').slice(0, 110)}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
results.sort((a, b) => a.id.localeCompare(b.id));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
console.log('נשמר:', OUT, `(${results.length} תשובות)`);
