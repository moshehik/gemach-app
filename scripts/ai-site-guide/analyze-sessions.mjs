// scripts/ai-site-guide/analyze-sessions.mjs - ניתוח קריאה-בלבד של תשובות עוזר ה-AI ששמורות ב-AIChatSession (messagesJson):
// כמה תשובות "איך עושים / איפה" הזכירו ממשק ישן (תפריט צד), אילו נתיבי OPEN_LINK ישנים הוצעו, ואילו שאלות הניווט הנפוצות ביותר.
//
//   node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-site-guide/analyze-sessions.mjs --db-url "<קריאה בלבד>" [--limit 3000] [--out out.json] [--snippets 15]
//
// בטיחות: רק SELECT אחד (findMany על AIChatSession), בלי שום כתיבה. הסקריפט נועד ל-TEST. **להרצה על מסד פרודקשן נדרש אישור מפורש של הבעלים/הרכז**
// (הוא קורא טקסט שיחות של עובדות): בלי --allow-prod הוא מסרב לכתובת שאינה ep-fancy-pine (TEST). הפלט המצרפי אינו כולל שמות עובדות;
// קטעי טקסט (--snippets) נחתכים ל-160 תווים וטלפונים/מיילים/מספרי זהות מוסרים.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const url = args['db-url'] || process.env.EXPERIMENT_DB_URL;
if (!url) { console.error('חסר --db-url'); process.exit(2); }
if (!/ep-fancy-pine/.test(url) && !args['allow-prod']) { console.error('מסרב: זו אינה כתובת TEST. הרצה על פרודקשן דורשת --allow-prod ואישור מפורש.'); process.exit(2); }

const PROJ = process.env.PROJ || process.cwd();
const req = createRequire(path.join(PROJ, 'package.json'));
const { PrismaClient } = req('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: url });

const LEGACY_RE = /(תפריט|סרגל|סיידבר)\s*(ה)?צד(י)?(?![א-ת])|sidebar/i;
const HOWTO_Q = /^(איך|איפה|היכן|מאיפה|האם יש|האם אפשר|אפשר ל|יש אפשרות)/;
const scrub = (t) => String(t || '').replace(/\S+@\S+/g, '[מייל]').replace(/\b\d{7,10}\b/g, '[מספר]').replace(/\s+/g, ' ').slice(0, 160);

const sessions = await prisma.aIChatSession.findMany({ orderBy: { startedAt: 'desc' }, take: Number(args.limit || 3000), select: { messagesJson: true, startedAt: true } });
await prisma.$disconnect();

const stats = { sessions: sessions.length, pairs: 0, howtoPairs: 0, howtoLegacy: 0, openLinkAnswers: 0, openLinkRoutes: {}, sideMenuAnswers: 0, firstAt: null, lastAt: null };
const snippets = [];
for (const s of sessions) {
  let msgs;
  try { msgs = JSON.parse(s.messagesJson); } catch { continue; }
  if (!Array.isArray(msgs)) continue;
  stats.firstAt = !stats.firstAt || s.startedAt < stats.firstAt ? s.startedAt : stats.firstAt;
  stats.lastAt = !stats.lastAt || s.startedAt > stats.lastAt ? s.startedAt : stats.lastAt;
  for (let i = 0; i < msgs.length - 1; i++) {
    if (msgs[i].role !== 'user' || msgs[i + 1].role !== 'assistant') continue;
    const q = String(msgs[i].content || '');
    const a = String(msgs[i + 1].content || '');
    stats.pairs++;
    const how = HOWTO_Q.test(q.trim());
    if (how) stats.howtoPairs++;
    const legacy = LEGACY_RE.test(a);
    if (legacy) { stats.sideMenuAnswers++; if (how) stats.howtoLegacy++; }
    const links = [...a.matchAll(/\[OPEN_LINK:([^|\]]+)\|/g)].map((m) => m[1].trim());
    if (links.length) { stats.openLinkAnswers++; for (const l of links) stats.openLinkRoutes[l] = (stats.openLinkRoutes[l] || 0) + 1; }
    if ((legacy || links.length) && snippets.length < Number(args.snippets || 15)) snippets.push({ q: scrub(q), a: scrub(a) });
  }
}
const out = { ...stats, snippets };
console.log(JSON.stringify(out, null, 2));
if (args.out) fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
