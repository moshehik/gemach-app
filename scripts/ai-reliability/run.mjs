// מריץ סוויטת שאלות מול נתיבי ה-AI האמיתיים של האתר, בקריאה בלבד.
//   node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-reliability/run.mjs <core|replay> [סינון]
// משתני סביבה:
//   EXPERIMENT_DB_URL  (חובה) כתובת מסד Postgres לקריאה. לגמח נווה יעקב: PROD_DATABASE_URL מתוך scratch/new_gemach_db.env
//   GEMINI_API_KEYS    (אופציונלי) אחרת נקרא מ-.env.local
//   OUT                (אופציונלי) שם קובץ התוצאות (ברירת מחדל results_<suite>.json בתיקיית scratch/ai-reliability-out)
// בטיחות: shims/prisma.mjs מחליף את לקוח ה-Prisma: קריאות SELECT עוברות, כל כתיבה נחסמת ונרשמת
// (ראו "blocked writes" בסוף הריצה). שרת הפיתוח לא מופעל ו-ai-log.txt לא נוגע.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const SPDIR = process.env.SPDIR;
const suiteName = process.argv[2] || 'core';
const only = process.argv[3] || '';

if (!process.env.EXPERIMENT_DB_URL) { console.error('EXPERIMENT_DB_URL is required'); process.exit(2); }
if (!process.env.GEMINI_API_KEYS) {
  const envLocal = fs.readFileSync(path.join(PROJ, '.env.local'), 'utf8');
  const m = envLocal.match(/^GEMINI_API_KEYS=(.*)$/m);
  if (m) process.env.GEMINI_API_KEYS = m[1].trim().replace(/^["']|["']$/g, '');
}

const load = async (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const routes = {
  chat: await load('app/api/ai/route.js'),
  smart: await load('app/api/ai/smart-search/route.js'),
  stats: await load('app/api/ai/statistics/route.js'),
  report: await load('app/api/ai/report/route.js'),
  audit: await load('app/api/audit/chat/route.js'),
  sqlgen: await load('app/api/admin/ai-sql-generate/route.js'),
};
const prisma = (await import(pathToFileURL(path.join(SPDIR, 'shims/prisma.mjs')).href)).default;
const { REPORT_DATA, REPORT_COLS } = await import(pathToFileURL(path.join(SPDIR, 'suites/core.mjs')).href);
const { T } = await import(pathToFileURL(path.join(SPDIR, `suites/${suiteName}.mjs`)).href);

// מנהל (תפקיד 1/2) ועובד רגיל - נבחרים אוטומטית מהמסד
const mgr = (await prisma.employee.findFirst({ where: { roleId: { in: [1, 2] } }, select: { id: true } }))?.id;
const std = (await prisma.employee.findFirst({ where: { roleId: { notIn: [0, 1, 2] } }, select: { id: true } }))?.id || mgr;

async function call(t) {
  globalThis.__AUTH_TOKEN = t.role === 'עובד רגיל' ? std : mgr;
  globalThis.__AILOG = [];
  globalThis.__SQLS = [];
  const body = {
    chat: { prompt: t.q, history: t.history || [], context: '' },
    smart: { prompt: t.q, pageContext: t.ctx },
    stats: { prompt: t.q, history: t.history || [], pageContext: 'customers' },
    report: { prompt: t.q, data: REPORT_DATA, columns: REPORT_COLS, format: t.fmt },
    audit: { prompt: t.q },
    sqlgen: { prompt: t.q },
  }[t.agent];
  const t0 = Date.now();
  let out;
  try {
    const r = await routes[t.agent].POST({ json: async () => body });
    out = r && r.__json !== undefined ? { status: r.status, body: r.__json } : { status: r.status, body: await r.json() };
  } catch (e) { out = { status: 'EXC', body: { error: String(e.message).slice(0, 300) } }; }
  return { ...t, secs: +((Date.now() - t0) / 1000).toFixed(1), ...out, sqls: (globalThis.__SQLS || []).map((x) => x.replace(/\s+/g, ' ').slice(0, 900)) };
}

const outDir = path.join(PROJ, 'scratch', 'ai-reliability-out');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, (process.env.OUT || `results_${suiteName}`) + '.json');
const results = [];
const list = T.filter((t) => !only || t.agent === only || t.q.includes(only));
for (const t of list) {
  const r = await call(t);
  if (t.truthSql) {
    try { r.truth = JSON.parse(JSON.stringify(await prisma.$queryRawUnsafe(t.truthSql), (k, v) => typeof v === 'bigint' ? Number(v) : v)); }
    catch (e) { r.truth = 'ERR ' + e.message.slice(0, 100); }
  }
  results.push(r);
  console.log(`[${results.length}/${list.length}] ${r.agent} (${r.secs}s) status=${r.status} :: ${t.q.slice(0, 50)}`);
  fs.writeFileSync(outFile, JSON.stringify({ writes: globalThis.__BLOCKED_WRITES, results }, null, 1));
}
console.log('blocked writes:', JSON.stringify(globalThis.__BLOCKED_WRITES));
console.log('results:', outFile);
process.exit(0);
