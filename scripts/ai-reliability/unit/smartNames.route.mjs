// בדיקת אינטגרציה של האיות החכם דרך נתיב הצ'אט האמיתי (app/api/ai/route.js) מול מסד TEST בקריאה בלבד, עם Gemini מדומה (בלי מכסה):
// "המודל" מחזיר SQL מתוסרט, והבדיקה מוודאת מה השרת עושה איתו (הרחבת שם, הודעה, עמודת סוג התאמה, תיקון כששם הושמט).
// הנתונים: TEST_DATABASE_URL, שבו קיימים לקוחות "שיינועטר" (ללא שמלות שנלקחו) ו"שיינווטר" (עם שמלה שנלקחה והוחזרה).
// הרצה: FAKE_GEMINI=1 EXPERIMENT_DB_URL=<TEST_DATABASE_URL> node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-reliability/unit/smartNames.route.mjs
import { pathToFileURL } from 'node:url';
import path from 'node:path';

if (!process.env.FAKE_GEMINI || !process.env.EXPERIMENT_DB_URL) { console.error('needs FAKE_GEMINI=1 and EXPERIMENT_DB_URL'); process.exit(2); }
const PROJ = process.env.PROJ;
const prisma = (await import(pathToFileURL(path.join(process.env.SPDIR, 'shims/prisma.mjs')).href)).default;
const chat = await import(pathToFileURL(path.join(PROJ, 'app/api/ai/route.js')).href);
const mgr = (await prisma.employee.findFirst({ where: { roleId: 2 }, select: { id: true } }))?.id;
globalThis.__AUTH_TOKEN = mgr;

let pass = 0, fail = 0;
const yes = (name, cond, info) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(info))); };

const SEL = `SELECT C."firstName" AS "שם פרטי", C."lastName" AS "שם משפחה", O."orderId" AS "מספר הזמנה" FROM "Customer" C JOIN "Order" O ON O."customerId" = C."id" JOIN "OrderItem" OI ON OI."orderId" = O."orderId"`;
const BASE = `C."isDeleted" = false AND O."isDeleted" = false AND COALESCE(O."status", '') NOT IN ('טיוטה', 'שמור לחיוב')`;

async function ask(prompt, script) {
  globalThis.__FAKE_GEMINI_PROMPTS = [];
  globalThis.__SQLS = [];
  let n = 0;
  globalThis.__FAKE_GEMINI = async (p) => {
    const i = n++;
    if (/UNREALIZED/.test(p)) return '';
    return script(p, i);
  };
  const res = await chat.POST({ json: async () => ({ prompt, history: [], context: '' }) });
  const body = res.__json !== undefined ? res.__json : await res.json();
  return { body, prompts: globalThis.__FAKE_GEMINI_PROMPTS, sqls: globalThis.__SQLS };
}
const isSqlStep = (p) => p.includes('Current User Question:');
const answerStep = (p) => p.startsWith('The user asked:');

// A. התאמה מדויקת + איות קרוב: שניהם בתוצאה, ההודעה והעמודה מסמנות מי מדויק ומי קרוב
{
  const r = await ask('יש שיינועטר שלקחו שמלות?', (p) => (isSqlStep(p) ? `SQL: ${SEL} WHERE (C."firstName" ILIKE '%שיינועטר%' OR C."lastName" ILIKE '%שיינועטר%') AND OI."isTaken" = true AND ${BASE}` : 'נמצאו תוצאות.'));
  const rows = r.body.data || [];
  if (process.env.SHOW) console.log('A response:', JSON.stringify(r.body.response), 'rows:', JSON.stringify(rows));
  yes('A: תשובה 200', !r.body.error, r.body);
  yes('A: ההודעה מזכירה את האיות הקרוב', /שיינווטר/.test(r.body.response) && /^התוצאות כוללות גם איותים קרובים/.test(r.body.response), r.body.response);
  yes('A: ה-SQL שרץ הורחב', r.sqls.some((s) => s.includes("ILIKE ANY (ARRAY['%שיינועטר%', '%שיינווטר%'])")), r.sqls.map((s) => s.slice(0, 80)));
  yes('A: יש שורה של איות קרוב עם סימון', rows.some((x) => /איות קרוב/.test(x['סוג התאמה'] || '')), rows);
  yes('A: מחזיר גם את שורות הלקוח המדויק אם יש להן שמלה שנלקחה (או רק את הקרוב)', rows.every((x) => ['שיינועטר', 'שיינווטר'].includes(x['שם משפחה'])), rows.map((x) => x['שם משפחה']));
  yes('A: עובדות איות הוזנו לפרומפט התשובה', r.prompts.some((p) => answerStep(p) && p.includes('SPELLING FACTS')), 'no facts');
  yes('A: רמז שם הוזן לפרומפט הראשון', r.prompts.some((p) => isSqlStep(p) && p.includes("CUSTOMER NAMES FOUND IN THE USER'S MESSAGE")), 'no hint');
  yes('A: בדיוק 2 קריאות Gemini (SQL + תשובה) - בלי קריאות נוספות', r.prompts.length === 2, r.prompts.length);
}

// B. איות שלא קיים (שיינוטר): מורחב לאיותים הקרובים, ההודעה אומרת שלא נמצא בדיוק
{
  const r = await ask('יש שיינוטר שלקחו שמלות?', (p) => (isSqlStep(p) ? `SQL: ${SEL} WHERE (C."firstName" ILIKE '%שיינוטר%' OR C."lastName" ILIKE '%שיינוטר%') AND OI."isTaken" = true AND ${BASE}` : 'נמצאו תוצאות.'));
  yes('B: ההודעה "לא נמצא בדיוק"', /^לא נמצא "שיינוטר" בדיוק/.test(r.body.response), r.body.response);
  yes('B: הרחבה לאיותים הקרובים שבמסד', r.sqls.some((s) => s.includes('%שיינועטר%') && s.includes('%שיינווטר%')), r.sqls.map((s) => s.slice(-200)));
  yes('B: הרחבה דטרמיניסטית: 2 קריאות Gemini', r.prompts.length === 2, r.prompts.length);
}

// C. המודל השמיט את שם הלקוח לגמרי: השרת מבקש תיקון פעם אחת
{
  let corrected = false;
  const r = await ask('יש שיינועטר שלקחו שמלות?', (p, i) => {
    if (p.includes('REJECTED BY THE SERVER')) { corrected = true; return `SQL: ${SEL} WHERE (C."firstName" ILIKE '%שיינועטר%' OR C."lastName" ILIKE '%שיינועטר%') AND OI."isTaken" = true AND ${BASE}`; }
    if (isSqlStep(p)) return `SQL: SELECT COUNT(*) AS "כמות" FROM "OrderItem" OI WHERE OI."isTaken" = true AND OI."isReturned" = false`;
    return 'נמצאו תוצאות.';
  });
  yes('C: נשלחה בקשת תיקון', corrected, r.prompts.map((p) => p.slice(0, 40)));
  yes('C: ה-SQL הסופי כולל תנאי שם מורחב', r.sqls.some((s) => s.includes('ILIKE ANY') && s.includes('שיינועטר')), r.sqls.map((s) => s.slice(0, 60)));
  yes('C: שלוש קריאות Gemini בדיוק (SQL, תיקון, תשובה)', r.prompts.length === 3, r.prompts.length);
}

// D. שאלה בלי שם (שלא קשורה) - אין שום שינוי: בלי רמז, בלי תיקון, בלי הודעה
{
  const r = await ask('כמה שמלות נלקחו וטרם הוחזרו?', (p) => (isSqlStep(p) ? `SQL: SELECT COUNT(*) AS "כמות" FROM "OrderItem" OI WHERE OI."isTaken" = true AND OI."isReturned" = false` : 'יש כמה.'));
  yes('D: בלי הודעת איות', !/איות|נמצא "/.test(r.body.response.split('\n')[0] || '') || r.body.response === 'יש כמה.', r.body.response);
  yes('D: 2 קריאות Gemini', r.prompts.length === 2, r.prompts.length);
  yes('D: בלי רמז שמות', !r.prompts.some((p) => p.includes('CUSTOMER NAMES FOUND')), 'hint present');
}

// E. תוצאה ריקה למרות שהשם קיים: ההודעה אומרת שהשם קיים, והאיותים הקרובים נבדקו
{
  const r = await ask('יש שיינועטר שלקחו שמלות ועדיין לא החזירו?', (p) => (isSqlStep(p) ? `SQL: ${SEL} WHERE (C."firstName" ILIKE '%שיינועטר%' OR C."lastName" ILIKE '%שיינועטר%') AND OI."isTaken" = true AND OI."isReturned" = false AND ${BASE}` : 'לא נמצאו רשומות.'));
  if (process.env.SHOW) console.log('E response:', JSON.stringify(r.body.response));
  yes('E: ההודעה מדווחת על בדיקת האיות הקרוב / קיום השם', /שיינווטר|נמצא/.test(r.body.response.split('\n')[0]), r.body.response);
  yes('E: אין שורות', (r.body.data || []).length === 0, r.body.data);
}

console.log('blocked writes:', JSON.stringify(globalThis.__BLOCKED_WRITES));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail || (globalThis.__BLOCKED_WRITES || []).length ? 1 : 0);
