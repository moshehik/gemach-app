// scripts/ai-site-guide/grade.mjs - מדרג את תוצאות eval.mjs מול האמת שבקובץ השאלות ומפיק טבלה ושיעורי הצלחה.
//
//   node scripts/ai-site-guide/grade.mjs --run scratch/ai-site-guide/before.json [--manual scripts/ai-site-guide/manual-before.json] [--md out.md]
//
// קטגוריות: נכון | שגוי | הוזיה (המצאת מיקום/אפשרות שלא קיימים, או "כן" לשאלת מלכודת) | מפנה לישן (ביטויי תפריט צד / forbid).
// הדירוג האוטומטי הוא תחילת הדרך (התאמת מחרוזות מול expect/forbid); --manual מקבל קובץ {id: {cat, note}} של תיקוני קריאה ידנית
// (הקריאה הידנית גוברת). אחוז ההצלחה = נכון / סה"כ. לשאלות role=employee נדרש --employee-id בהרצה.
import fs from 'node:fs';
import { LEGACY_PHRASE_RE } from '../../lib/aiGuide/resolve.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const questions = JSON.parse(fs.readFileSync(args.questions || 'scripts/ai-site-guide/questions.json', 'utf8'));
const run = JSON.parse(fs.readFileSync(args.run, 'utf8'));
const manual = args.manual && fs.existsSync(args.manual) ? JSON.parse(fs.readFileSync(args.manual, 'utf8')) : {};
const byId = Object.fromEntries(run.results.map((r) => [r.id, r]));

const norm = (s) => String(s || '').replace(/[֑-ׇ]/g, '').replace(/["'׳״“”`]/g, '').replace(/\s+/g, ' ').toLowerCase();
const DENIAL = ['אין ', 'לא קיים', 'לא קיימת', 'אינה קיימת', 'אינו קיים', 'לא מצאתי', 'לא ניתן', 'לא נמצא', 'אין אפשרות', 'לא קיימות', 'לא זמין', 'אינך', 'לא בטוח', 'אינני'];

function autoGrade(q, r) {
  if (!r || r.status !== 200 || !r.response) return { cat: 'שגוי', why: `אין תשובה (status ${r && r.status})` };
  const text = norm(r.response);
  const forbidHit = (q.forbid || []).find((f) => text.includes(norm(f)));
  const legacy = LEGACY_PHRASE_RE.test(r.response);
  const groups = q.expect || [];
  const groupOk = (g) => g.some((w) => text.includes(norm(w)));
  const expectOk = groups.length === 0 || groups.every(groupOk);
  if (q.oldOnly) {
    // התשובה הנכונה: אומרת שזה קיים רק בישן (מילה "ישן") בלי להנחות לפיו
    const saysOld = /ישן|הוסר|לא קיים|אינו קיים|אינה קיימת/.test(r.response);
    if (saysOld && !/(לחצי|לחצו|גררי|בחרי).*(צד)/.test(r.response)) return { cat: 'נכון', why: 'מציין שקיים רק בישן' };
    return { cat: legacy || forbidHit ? 'מפנה לישן' : 'שגוי', why: 'לא ציין שקיים רק בישן' };
  }
  if (legacy || forbidHit) return { cat: 'מפנה לישן', why: legacy ? 'ביטוי של תפריט צד' : `forbid: ${forbidHit}` };
  if (q.exists === false) {
    const denies = DENIAL.some((d) => text.includes(norm(d)));
    return denies ? { cat: 'נכון', why: 'הכחיש/לא מצא' } : { cat: 'הוזיה', why: 'שאלת מלכודת בלי הכחשה' };
  }
  return expectOk ? { cat: 'נכון', why: 'כל קבוצות expect' } : { cat: 'שגוי', why: 'חסר: ' + groups.filter((g) => !groupOk(g)).map((g) => g[0]).join(' | ') };
}

const rows = [];
const tally = {};
for (const q of questions) {
  const r = byId[q.id];
  if (!r) continue;
  const a = autoGrade(q, r);
  const m = manual[q.id];
  const cat = m ? m.cat : a.cat;
  rows.push({ id: q.id, topic: q.topic, q: q.q, cat, auto: a.cat, why: m ? `ידני: ${m.note || ''}` : a.why, response: r.response, guide: (r.guide || []).map((g) => g.id).join(' ') });
  tally[cat] = (tally[cat] || 0) + 1;
}
const total = rows.length;
const pct = (n) => (total ? Math.round((n * 1000) / total) / 10 : 0);
const byTopic = {};
for (const r of rows) { byTopic[r.topic] = byTopic[r.topic] || { n: 0, ok: 0 }; byTopic[r.topic].n++; if (r.cat === 'נכון') byTopic[r.topic].ok++; }

const lines = [];
lines.push(`# תוצאות בדיקת מציאות - ${args.run}`);
lines.push('');
lines.push(`נשאלו ${total} שאלות. נכון: ${tally['נכון'] || 0} (${pct(tally['נכון'] || 0)}%), שגוי: ${tally['שגוי'] || 0}, הוזיה: ${tally['הוזיה'] || 0}, מפנה לישן: ${tally['מפנה לישן'] || 0}.`);
lines.push('');
lines.push('| נושא | שאלות | נכון |');
lines.push('|---|---|---|');
for (const [t, v] of Object.entries(byTopic)) lines.push(`| ${t} | ${v.n} | ${v.ok} (${Math.round((v.ok * 100) / v.n)}%) |`);
lines.push('');
lines.push('| # | נושא | שאלה | קטגוריה | הערה | הצבעה |');
lines.push('|---|---|---|---|---|---|');
for (const r of rows) lines.push(`| ${r.id} | ${r.topic} | ${r.q.replace(/\|/g, '/')} | ${r.cat} | ${String(r.why).replace(/\|/g, '/')} | ${r.guide} |`);
const md = lines.join('\n');
if (args.md) fs.writeFileSync(args.md, md);
console.log(md.split('\n').slice(0, 3 + Object.keys(byTopic).length + 6).join('\n'));
if (args.full) {
  for (const r of rows) console.log(`\n--- ${r.id} [${r.cat}] ${r.q}\n${r.response}\n(${r.why}) ${r.guide}`);
}
