// scripts/ai-site-guide/analyze-sessions.mjs - ניתוח אגרגטי וקריאה-בלבד של שיחות עוזר ה-AI ששמורות ב-AIChatSession (messagesJson):
// כמה שאלות ניווט ("איפה/איך/האם יש"), כמה תשובות הפנו לממשק ישן ("תפריט צד"), אילו נתיבי OPEN_LINK ישנים הוצעו, שיעורי "אין/לא נמצא" ושגיאות.
//
//   DB_URL="<כתובת>" node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-site-guide/analyze-sessions.mjs [--allow-prod] [--limit 20000] [--label main] [--out out.json]
//
// בטיחות: שאילתה אחת בתוך טרנזקציית READ ONLY (SET TRANSACTION READ ONLY - כל כתיבה תיכשל במסד עצמו). בלי --allow-prod מסרב לכתובת שאינה TEST (ep-fancy-pine).
// פרטיות: הפלט אגרגטי בלבד. אין שמות עובדות/לקוחות, טלפונים, מיילים, ת"ז או טקסט שיחה מלא. "דוגמאות מוסוות": מהשאלה נשמרות רק מילים מאוצר-מילים סגור
// (מילות שאלה/ניווט + שמות מסכים ופעולות מהרישום), כל מילה אחרת הופכת ל-"…" וכל ספרה ל-#. הכתובת לעולם לא מודפסת.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const url = process.env.DB_URL || process.env.EXPERIMENT_DB_URL;
if (!url) { console.error('חסר DB_URL'); process.exit(2); }
if (!/ep-fancy-pine/.test(url) && !args['allow-prod']) { console.error('מסרב: זו אינה כתובת TEST. הרצה על פרודקשן דורשת --allow-prod ואישור מפורש.'); process.exit(2); }

const PROJ = process.env.PROJ || process.cwd();
const req = createRequire(path.join(PROJ, 'package.json'));
const { PrismaClient } = req('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: url });
const { LEGACY_PHRASE_RE } = await import(new URL('../../lib/aiGuide/resolve.js', import.meta.url).href);
const { TARGETS, PAGES, TASKS } = await import(new URL('../../lib/aiGuide/index.js', import.meta.url).href);
const { tokenize } = await import(new URL('../../lib/aiGuide/knowledge.js', import.meta.url).href);

// אוצר מילים סגור לדוגמאות מוסוות: מהרישום + מילות שאלה נפוצות
const VOCAB = new Set();
for (const t of [...TARGETS.map((x) => `${x.label} ${(x.aliases || []).join(' ')}`), ...PAGES.map((p) => `${p.title} ${(p.aliases || []).join(' ')}`), ...TASKS.map((t) => `${t.title} ${(t.aliases || []).join(' ')}`)]) for (const w of tokenize(t)) VOCAB.add(w);
for (const w of 'איך איפה היכן מאיפה האם יש אפשר ניתן אני רוצה צריכה לעשות מוסיפים מוחקים רואים מדפיסים שולחים מחפשים משנים מגדירים עוברים בודקים הזמנה לקוחה שמלה דגם מידה תשלום משלוח מייל הדפסה חיפוש הגדרות'.split(' ')) VOCAB.add(w);
const mask = (text) => String(text || '').replace(/\d/g, '#').split(/(\s+)/).map((w) => {
  if (/^\s+$/.test(w) || !w) return w;
  const core = w.replace(/[^א-תa-zA-Z#]/g, '');
  if (!core || /^#+$/.test(core)) return core ? '#' : w;
  const toks = [...tokenize(core)];
  return toks.some((t) => VOCAB.has(t)) ? w.replace(/[^א-ת#?\s]/g, '') : '…';
}).join('').replace(/\s+/g, ' ').trim().slice(0, 110);

const HOWTO_Q = /^(איך|איפה|היכן|מאיפה|האם יש|האם אפשר|אפשר ל|יש אפשרות|איפה)/;
const DENIAL = /(אין אפשרות|לא קיים|לא קיימת|לא מצאתי|אין במערכת|אינה קיימת|לא נמצא)/;
const ERROR_ANS = /(מצטער, חלה שגיאה|נתקלתי בשגיאה|Failed to generate)/;
const TOPICS = [['הזמנות', /הזמנ/], ['החזרות/השכרות', /(החזר|השכר|נלקח|ברקוד)/], ['לקוחות', /לקוח/], ['מלאי/דגמים', /(דגם|מלאי|מידה|שמל|פנוי|זמינות)/], ['לוז/לוח', /(לוז|לוח|יומן)/], ['הגדרות', /הגדר/], ['הדפסה', /(הדפס|מדפיס|הדפסה)/], ['מיילים', /(מייל|דיוור)/], ['משלוחים', /משלוח/], ['תשלומים/זיכויים', /(תשלום|זיכוי|חוב)/], ['הרשאות/ניהול', /(הרשא|ניהול|סטטיסטיק)/], ['חיפוש', /חיפוש|מחפש/]];

const rows = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  return tx.$queryRawUnsafe(`SELECT "messagesJson", "startedAt" FROM "AIChatSession" ORDER BY "startedAt" DESC LIMIT ${Number(args.limit || 20000)}`);
}, { timeout: 60000, maxWait: 30000 });
await prisma.$disconnect();

const stats = {
  label: args.label || 'db', sessions: rows.length, pairs: 0, navQuestions: 0, navLegacyAnswers: 0, navDenialAnswers: 0, navErrorAnswers: 0,
  legacyAnswersAllTime: 0, openLinkAnswers: 0, openLinkRoutes: {}, byMonth: {}, navByTopic: {}, firstAt: null, lastAt: null, examples: [],
};
for (const s of rows) {
  let msgs;
  try { msgs = JSON.parse(s.messagesJson); } catch { continue; }
  if (!Array.isArray(msgs)) continue;
  const at = new Date(s.startedAt);
  if (!stats.firstAt || at < stats.firstAt) stats.firstAt = at;
  if (!stats.lastAt || at > stats.lastAt) stats.lastAt = at;
  const month = at.toISOString().slice(0, 7);
  for (let i = 0; i < msgs.length - 1; i++) {
    if (msgs[i].role !== 'user' || msgs[i + 1].role !== 'assistant') continue;
    const q = String(msgs[i].content || '').trim();
    const a = String(msgs[i + 1].content || '');
    stats.pairs++;
    const legacy = LEGACY_PHRASE_RE.test(a);
    if (legacy) stats.legacyAnswersAllTime++;
    const links = [...a.matchAll(/\[OPEN_LINK:([^|\]]+)\|/g)].map((m) => m[1].trim());
    if (links.length) { stats.openLinkAnswers++; for (const l of links) stats.openLinkRoutes[l] = (stats.openLinkRoutes[l] || 0) + 1; }
    if (!HOWTO_Q.test(q)) continue;
    stats.navQuestions++;
    const m = (stats.byMonth[month] = stats.byMonth[month] || { nav: 0, legacy: 0 });
    m.nav++;
    if (legacy) { stats.navLegacyAnswers++; m.legacy++; }
    if (DENIAL.test(a)) stats.navDenialAnswers++;
    if (ERROR_ANS.test(a)) stats.navErrorAnswers++;
    const topic = (TOPICS.find(([, re]) => re.test(q)) || ['אחר'])[0];
    stats.navByTopic[topic] = (stats.navByTopic[topic] || 0) + 1;
    if ((legacy || links.length) && stats.examples.length < Number(args.snippets || 8)) stats.examples.push({ q: mask(q), legacyAnswer: legacy, linkRoutes: links.slice(0, 2) });
  }
}
const pct = (n, d) => (d ? Math.round((n * 1000) / d) / 10 : 0);
const out = {
  ...stats, firstAt: stats.firstAt && stats.firstAt.toISOString().slice(0, 10), lastAt: stats.lastAt && stats.lastAt.toISOString().slice(0, 10),
  rates: { navShareOfPairsPct: pct(stats.navQuestions, stats.pairs), navLegacyPct: pct(stats.navLegacyAnswers, stats.navQuestions), navDenialPct: pct(stats.navDenialAnswers, stats.navQuestions), navErrorPct: pct(stats.navErrorAnswers, stats.navQuestions) },
};
console.log(JSON.stringify(out, null, 2));
if (args.out) fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
