// scripts/ai-site-guide/eval-direct.mjs - כמו eval.mjs, אבל בלי שרת פיתוח: טוען את קובץ ה-route האמיתי ישירות (כמו scripts/ai-reliability/run.mjs)
// עם לקוח Prisma "לקריאה בלבד" (כל כתיבה נחסמת) מול מסד TEST. מתאים להרצת "לפני" על הקוד הישן (route_baseline.js) בלי לבנות .next.
//
//   EXPERIMENT_DB_URL="<TEST_DATABASE_URL>" PROJ=$PWD SPDIR=$PWD/scripts/ai-reliability \
//   node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-site-guide/eval-direct.mjs --route app/api/ai/route_baseline.js --out scratch/ai-site-guide/before.json
// --role-employee <uuid> לשאלות role=employee (עובדת רגילה עם הרשאת AI). בלי הדגל: עובדת רגילה נבחרת אוטומטית.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const PROJ = process.env.PROJ;
const SPDIR = process.env.SPDIR;
if (!process.env.EXPERIMENT_DB_URL) { console.error('EXPERIMENT_DB_URL נדרש (כתובת TEST)'); process.exit(2); }
if (!/ep-fancy-pine/.test(process.env.EXPERIMENT_DB_URL) && !args['allow-other-db']) { console.error('מסרב: EXPERIMENT_DB_URL אינו מסד ה-TEST המוכר (ep-fancy-pine). נדרש --allow-other-db במפורש.'); process.exit(2); }
if (!process.env.GEMINI_API_KEYS) {
  const envLocal = fs.readFileSync(path.join(PROJ, '.env.local'), 'utf8');
  const m = envLocal.match(/^GEMINI_API_KEYS=(.*)$/m);
  if (m) process.env.GEMINI_API_KEYS = m[1].trim().replace(/^["']|["']$/g, '');
}
const routeMod = await import(pathToFileURL(path.join(PROJ, args.route || 'app/api/ai/route.js')).href);
const prisma = (await import(pathToFileURL(path.join(SPDIR, 'shims/prisma.mjs')).href)).default;
const questions = JSON.parse(fs.readFileSync(args.questions || 'scripts/ai-site-guide/questions.json', 'utf8'));
let list = questions;
if (args.only) { const s = new Set(String(args.only).split(',')); list = list.filter((q) => s.has(q.id)); }
if (args.limit) list = list.slice(0, Number(args.limit));

const mgr = (await prisma.employee.findFirst({ where: { roleId: 2 }, select: { id: true } }))?.id;
const std = args['role-employee'] || (await prisma.employee.findFirst({ where: { roleId: { notIn: [0, 1, 2] }, isActive: true }, select: { id: true } }))?.id || mgr;
const todayHe = new Date().toLocaleDateString('he-IL');
const widgetContext = `התאריך היום הוא: ${todayHe}. אתה עוזר וירטואלי עבור עובדי הגמ"ח. מותר לך לספק נתונים על לקוחות, הזמנות, פריטים ומלאי כדי לעזור בשירות לקוחות. אסור לך לחשוף מידע על עובדים אחרים, משמרות או הרשאות. אסור לך להציג סטטיסטיקות כלליות, סיכומי רווחים, דוחות או פילוחים ניהוליים מתקדמים (אם העובד מבקש סטטיסטיקות כאלו, אמור לו שזה זמין רק בממשק מנהל).`;

const results = [];
for (const q of list) {
  globalThis.__AUTH_TOKEN = q.role === 'employee' ? std : mgr;
  const body = { prompt: q.q, history: [], firstQuestion: false, currentPath: q.currentPath || '/', context: widgetContext };
  const t0 = Date.now();
  let out;
  try {
    const r = await routeMod.POST({ json: async () => body, clone() { return { json: async () => body }; } });
    const j = r && r.__json !== undefined ? r.__json : await r.json();
    out = { id: q.id, status: r.status, ms: Date.now() - t0, response: j.response ?? null, guide: j.guide ?? null, hasData: !!j.data, sqlQuery: j.sqlQuery ?? null, error: j.error };
  } catch (e) { out = { id: q.id, status: 0, ms: Date.now() - t0, error: String(e.message).slice(0, 300) }; }
  results.push(out);
  console.log(`${q.id} [${out.status}] ${out.ms}ms ${String(out.response || out.error || '').replace(/\s+/g, ' ').slice(0, 110)}`);
}
const outFile = args.out || 'scratch/ai-site-guide/run-direct.json';
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ base: 'direct:' + (args.route || 'app/api/ai/route.js'), at: new Date().toISOString(), blockedWrites: globalThis.__BLOCKED_WRITES, results }, null, 2));
console.log('נשמר:', outFile, `(${results.length})`, 'כתיבות שנחסמו:', JSON.stringify(globalThis.__BLOCKED_WRITES));
