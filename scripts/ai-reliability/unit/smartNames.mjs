// בדיקות יחידה לאיות החכם של עוזר ה-AI (lib/ai/smartNames.js + rankNameSpellings ב-lib/searchFuzzy.js). בלי רשת ובלי מסד: ה-lookup מדומה בזיכרון.
// הרצה: node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-reliability/unit/smartNames.mjs
import { pathToFileURL } from 'node:url';
const SN = await import(pathToFileURL(process.env.PROJ + '/lib/ai/smartNames.js').href);
const SF = await import(pathToFileURL(process.env.PROJ + '/lib/searchFuzzy.js').href);
const GUARD = await import(pathToFileURL(process.env.PROJ + '/lib/sqlGuard.js').href);

let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '\n   got : ' + JSON.stringify(got) + '\n   want: ' + JSON.stringify(want))); };
const yes = (name, cond, info) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(info))); };

const sp = (...raws) => raws.map((raw) => ({ raw, count: 1 }));
const nearRaws = (word, stored, loose) => SF.rankNameSpellings(word, sp(stored), { loose }).near.map((n) => n.raw);

// ---------- 1. טבלת גיוונים אמיתיים (loose = אין התאמה מדויקת, כמו החיפוש הראשי) ----------
const VARIANTS = [
  ['שיינועטר', 'שיינווטר', true], ['שיינועטר', 'שיינוטר', true], ['שיינועטר', 'שיינאטר', true], ['שיינועטר', 'שיינעטר', true],
  ['שיינווטר', 'שיינועטר', true], ['שיינוטר', 'שיינועטר', true],
  ['כהן', 'כהנא', true], ['ברקוביץ', 'ברקוביץ׳', false /* אותו שם: גרש בלבד = התאמה מדויקת, לא "קרוב" */],
  ['ברקוביץ', 'ברקוביץ׳ס', false], ['לוי', 'לווי', true], ['מלכה', 'מלכא', true], ['מועלם', 'מואלם', true],
  ['שפרינצלס', 'שפרינצל', true], ['רוזנבוים', 'רוזנבאום', true], ['גולדשטיין', 'גולדשטין', true],
  ['כהן', 'כהן', false], ['כהן', 'כהן-שפירא', false],
  // לא אמורים להתאים
  ['כהן', 'לוי', false], ['שיינועטר', 'שיינברגר', false], ['רוזנבוים', 'גולדברג', false], ['אברהם', 'יעקב', false],
];
for (const [typed, stored, want] of VARIANTS) {
  const got = nearRaws(typed, stored, true);
  yes(`variant ${typed} ~ ${stored} => ${want ? 'near' : 'not near'}`, (got.length > 0) === want, got);
}

// ---------- 2. כשיש התאמה מדויקת רק גרסאות חזקות; השאר ב-extra ----------
{
  const r = SF.rankNameSpellings('לוי', sp('לווי', 'לוין'), { loose: false });
  eq('tight: לוי/לווי (3 אותיות) לא חזק -> extra בלבד', r.near.map((n) => n.raw), []);
  yes('tight: extra מכיל את לווי', r.extra.some((n) => n.raw === 'לווי'), r.extra);
  const r2 = SF.rankNameSpellings('שיינועטר', sp('שיינווטר', 'שיינברגר', 'שיינפלד'), { loose: false });
  eq('tight: שיינועטר ~ שיינווטר חזק (אותו מפתח פונטי), שאר השמות לא', r2.near.map((n) => n.raw), ['שיינווטר']);
  eq('tight: ברקוביץ/מרקוביץ (אות עיקרית שונה) = שם אחר', SF.rankNameSpellings('ברקוביץ', sp('מרקוביץ', 'פרקוביץ'), { loose: false }).near, []);
  eq('tight: שפרינצלס/שפרינצל (תו אחד בסוף) חזק; ההפך כבר נתפס ב-ILIKE המקורי', [SF.rankNameSpellings('שפרינצלס', sp('שפרינצל'), { loose: false }).near.map((n) => n.raw), SF.rankNameSpellings('שפרינצל', sp('שפרינצלס'), { loose: false }).near.length], [['שפרינצל'], 0]);
  eq('tight: גולדשטיין/גולדשטין (יוד חסר) חזק', SF.rankNameSpellings('גולדשטיין', sp('גולדשטין'), { loose: false }).near.map((n) => n.raw), ['גולדשטין']);
  eq('tight: רוזנבוים/רוזנבאום - לא חזק (שני הבדלים), loose כן', [SF.rankNameSpellings('רוזנבוים', sp('רוזנבאום'), { loose: false }).near.length, SF.rankNameSpellings('רוזנבוים', sp('רוזנבאום'), { loose: true }).near.length], [0, 1]);
  const r3 = SF.rankNameSpellings('גרינברג', sp('גרינבלט'), { loose: false });
  eq('tight: גרינברג/גרינבלט (מרחק 2) לא נכנס אוטומטית', r3.near.length, 0);
  yes('loose: אבל נכנס כשאין התאמה מדויקת', SF.rankNameSpellings('גרינברג', sp('גרינבלט'), { loose: true }).near.length === 1);
}

// ---------- 3. שמות קצרים לא מתאימים לכל דבר (fuzzyBudget) ----------
{
  eq('מילה של 2 אותיות: אין איות קרוב', SF.rankNameSpellings('אב', sp('אבי', 'אבא', 'אב'), { loose: true }).near, []);
  eq('fuzzyBudget(2)=0', SF.fuzzyBudget(2), 0);
  eq('3 אותיות: תקציב 1, לא 2', SF.fuzzyBudget(3), 1);
  eq('דוד/דור: מרחק 1 אבל לא גרסה חזקה', SF.rankNameSpellings('דוד', sp('דור'), { loose: false }).near, []);
  yes('לא יותר מ-5 איותים', SF.rankNameSpellings('שיינועטר', sp('שיינווטר', 'שיינוטר', 'שיינאטר', 'שיינעטר', 'שינווטר', 'שיינווטר1x', 'שינועטר', 'שיינועתר'), { loose: true }).near.length <= SF.NEAR_SPELLINGS_MAX);
  const many = SF.rankNameSpellings('שיינועטר', sp('שיינווטר', 'שיינוטר', 'שיינאטר', 'שיינעטר', 'שינווטר', 'שינועטר', 'שיינועתר'), { loose: true });
  eq('more מדווח כמה נוספו מעבר לתקרה', many.near.length + many.more, 7);
}

// ---------- 4. איתור והרחבת תנאי שם ב-SQL ----------
const names = (sql) => SN.findNamePredicates(sql).map((p) => `${p.table}:${p.word}`);
eq('predicate: lastName ILIKE', names(`SELECT 1 FROM "Customer" C WHERE C."lastName" ILIKE '%שיינועטר%'`), ['Customer:שיינועטר']);
eq('predicate: first OR last, שתי מילים', names(`SELECT 1 FROM "Customer" C WHERE (C."firstName" ILIKE '%אמיתי%' OR C."lastName" ILIKE '%אמיתי%') AND (C."firstName" ILIKE '%נויאל%' OR C."lastName" ILIKE '%נויאל%')`), ['Customer:אמיתי', 'Customer:אמיתי', 'Customer:נויאל', 'Customer:נויאל']);
eq('predicate: alias דרך JOIN', names(`SELECT 1 FROM "Order" O JOIN "Customer" AS cu ON cu.id=O."customerId" WHERE cu."lastName" LIKE '%כהן%'`), ['Customer:כהן']);
eq('predicate: = ', names(`SELECT 1 FROM "Customer" WHERE "lastName" = 'שיינועטר'`), ['Customer:שיינועטר']);
eq('predicate: Employee', names(`SELECT 1 FROM "Employee" E WHERE E."firstName" ILIKE '%משה%'`), ['Employee:משה']);
eq('לא נוגעים: NOT ILIKE', names(`SELECT 1 FROM "Customer" WHERE "lastName" NOT ILIKE '%כהן%'`), []);
eq('לא נוגעים: רב-מילים', names(`SELECT 1 FROM "Customer" WHERE "lastName" ILIKE '%בן דוד%'`), []);
eq('לא נוגעים: מילה של 2 אותיות', names(`SELECT 1 FROM "Customer" WHERE "lastName" ILIKE '%כץ%'`), []);
eq('לא נוגעים: ספרות', names(`SELECT 1 FROM "Customer" WHERE "lastName" ILIKE '%כהן1%'`), []);
eq('לא נוגעים: עמודה לא מוכרת', names(`SELECT 1 FROM "Customer" WHERE "city" ILIKE '%ירושלים%'`), []);
eq('לא נוגעים: טבלה אחרת עם firstName', names(`SELECT 1 FROM "Shift" S WHERE S."firstName" ILIKE '%כהן%'`), []);
eq('לא נוגעים: שתי הטבלאות בשאילתה + עמודה לא מוקפת כינוי', names(`SELECT 1 FROM "Customer" C, "Employee" E WHERE "lastName" ILIKE '%כהן%'`), []);
eq('Employee לא מזוהה כ-Customer (כינוי נכון)', names(`SELECT 1 FROM "Customer" C, "Employee" E WHERE E."lastName" ILIKE '%כהן%' AND C."lastName" ILIKE '%לוי%'`), ['Employee:כהן', 'Customer:לוי']);

const mkLookup = (rowsByTable) => async (table, word) => {
  const rows = rowsByTable[table] || [];
  const exactCount = rows.filter((r) => r.includes(word)).length;
  const counts = new Map();
  for (const r of rows) for (const tok of r.split(/[\s-]+/)) counts.set(tok, (counts.get(tok) || 0) + 1);
  return { exactCount, spellings: [...counts.entries()].map(([raw, count]) => ({ raw, count })) };
};
const SQL1 = `SELECT C."lastName" AS "שם" FROM "Customer" C WHERE C."isDeleted" = false AND C."lastName" ILIKE '%שיינועטר%'`;

{ // אין התאמה מדויקת, יש איות קרוב -> מורחב + הודעה
  const s = SN.createNameSession({ lookup: mkLookup({ Customer: ['שיינווטר', 'כהן', 'לוי'] }) });
  const [out] = await s.expand([SQL1]);
  yes('rewrite: ILIKE ANY עם המילה המקורית והאיות הקרוב', out.includes(`ILIKE ANY (ARRAY['%שיינועטר%', '%שיינווטר%'])`), out);
  yes('rewrite: עובר את assertReadOnlySelect', GUARD.checkReadOnlySelect(out).ok, out);
  eq('notice: לא נמצא בדיוק', s.notice({ rowsEmpty: false }), 'לא נמצא "שיינועטר" בדיוק; מוצגות תוצאות עבור האיות הקרוב "שיינווטר".');
  yes('facts: מציין את האיות ומה לא לחזור עליו', s.facts({}).includes('"שיינווטר"') && s.facts({}).includes('do NOT repeat'), s.facts({}));
}
{ // התאמה מדויקת + איות קרוב חזק: שניהם בתוצאה
  const s = SN.createNameSession({ lookup: mkLookup({ Customer: ['שיינועטר', 'שיינווטר', 'שיינברגר', 'לוי'] }) });
  const [out] = await s.expand([SQL1]);
  yes('exact+near: שניהם ברשימה, שיינברגר לא', out.includes(`'%שיינועטר%', '%שיינווטר%'`) && !out.includes('שיינברגר'), out);
  eq('notice exact+near', s.notice({ rowsEmpty: false }), 'התוצאות כוללות גם איותים קרובים ל"שיינועטר": "שיינווטר".');
}
{ // התאמה מדויקת בלבד: ה-SQL לא משתנה; ריק -> הודעה שהלקוח קיים
  const s = SN.createNameSession({ lookup: mkLookup({ Customer: ['שיינועטר', 'כהן'] }) });
  const [out] = await s.expand([SQL1]);
  eq('exact only: SQL ללא שינוי (exact wins)', out, SQL1);
  eq('notice exact only, יש שורות: ריק', s.notice({ rowsEmpty: false }), '');
  eq('notice exact only, אין שורות: הלקוח קיים', s.notice({ rowsEmpty: true }), 'נמצא לקוח/ה בשם "שיינועטר", אך אין רשומות שמתאימות לשאר תנאי החיפוש.');
  yes('facts: אומר שהשם קיים כשהתוצאה ריקה', s.facts({ rowsEmpty: true }).includes('never that the person does not exist'), s.facts({ rowsEmpty: true }));
}
{ // אין שום דבר קרוב
  const s = SN.createNameSession({ lookup: mkLookup({ Customer: ['כהן', 'לוי'] }) });
  const [out] = await s.expand([SQL1]);
  eq('none: SQL ללא שינוי', out, SQL1);
  eq('notice none', s.notice({ rowsEmpty: true }), 'לא נמצא לקוח/ה בשם "שיינועטר" במערכת, וגם לא איות קרוב לו.');
}
{ // מספר איותים קרובים: מציג את כולם (עד 5) ומדווח על השאר
  const s = SN.createNameSession({ lookup: mkLookup({ Customer: ['שיינווטר', 'שיינוטר', 'שיינאטר', 'שיינעטר', 'שינווטר', 'שינועטר', 'שיינועתר'] }) });
  await s.expand([SQL1]);
  const n = s.notice({ rowsEmpty: false });
  yes('notice: כמה איותים + "עוד N"', n.includes('כמה איותים קרובים') && /יש עוד 2 איותים/.test(n), n);
}
{ // ה-lookup נכשל / null: השאילתה המקורית, בלי הודעה
  const s = SN.createNameSession({ lookup: async () => null });
  const [out] = await s.expand([SQL1]);
  eq('lookup null: SQL ללא שינוי', out, SQL1);
  eq('lookup null: בלי הודעה', s.notice({}), '');
  const s2 = SN.createNameSession({ lookup: async () => { throw new Error('boom'); } });
  eq('lookup throws: SQL ללא שינוי', (await s2.expand([SQL1]))[0], SQL1);
}
{ // = ו-LIKE עם תבניות שונות
  const s = SN.createNameSession({ lookup: mkLookup({ Customer: ['שיינווטר'] }) });
  const [a, b, c] = await s.expand([
    `SELECT 1 FROM "Customer" WHERE "lastName" = 'שיינועטר'`,
    `SELECT 1 FROM "Customer" WHERE "lastName" LIKE 'שיינועטר%'`,
    `SELECT 1 FROM "Customer" WHERE "lastName"::text ILIKE '%שיינועטר'`,
  ]);
  yes('= -> IN', a.includes(`"lastName" IN ('שיינועטר', 'שיינווטר')`), a);
  yes('תחילית נשמרת', b.includes(`LIKE ANY (ARRAY['שיינועטר%', 'שיינווטר%'])`), b);
  yes('סיומת + ::text נשמרים', c.includes(`"lastName"::text ILIKE ANY (ARRAY['%שיינועטר', '%שיינווטר'])`), c);
}
{ // Employee ו-Customer לא מתערבבים
  const s = SN.createNameSession({ lookup: mkLookup({ Customer: ['כהנא'], Employee: ['כהן'] }) });
  const [out] = await s.expand([`SELECT 1 FROM "Customer" C, "Employee" E WHERE E."lastName" ILIKE '%כהון%' AND C."lastName" ILIKE '%כהון%'`]);
  yes('Employee מורחב לפי עובדים', out.includes(`E."lastName" ILIKE ANY (ARRAY['%כהון%', '%כהן%'])`), out);
  yes('Customer מורחב לפי לקוחות', out.includes(`C."lastName" ILIKE ANY (ARRAY['%כהון%', '%כהנא%'])`), out);
}

// ---------- 5. הרצה: ניסיון חוזר רחב רק אם התוצאה ריקה ----------
{
  const lookup = mkLookup({ Customer: ['לוי', 'לווי'] }); // יש התאמה מדויקת ללוי; לווי רק extra (3 אותיות)
  const SQL = `SELECT 1 FROM "Customer" WHERE "lastName" ILIKE '%לוי%'`;
  const run = async (dataBySql) => {
    const s = SN.createNameSession({ lookup });
    const executed = [];
    const out = await SN.runSqlWithSmartNames([SQL], { session: s, execute: async (q) => { executed.push(q); return dataBySql(q); } });
    return { s, executed, out };
  };
  let r = await run(() => [{ x: 1 }]);
  eq('יש נתונים: שאילתה אחת', r.executed.length, 1);
  r = await run((q) => (q.includes('ANY') ? [{ x: 1 }] : []));
  eq('ריק -> ניסיון חוזר רחב אחד', r.executed.length, 2);
  yes('הניסיון הרחב כולל את לווי', r.out.queries[0].includes('%לווי%'), r.out.queries[0]);
  yes('הודעה מדווחת על הרחבה', r.s.notice({ rowsEmpty: false }).includes('"לווי"'), r.s.notice({ rowsEmpty: false }));
  r = await run(() => []);
  eq('ריק גם ברחב: חוזרים לתוצאה הראשונה', r.out.queries[0], SQL);
  yes('ריק גם ברחב: ההודעה אומרת שהלקוח קיים', r.s.notice({ rowsEmpty: true }).includes('נמצא'), r.s.notice({ rowsEmpty: true }));
  // ספירה אחת עם 0 נחשבת ריקה
  r = await run((q) => (q.includes('ANY') ? [{ c: 3 }] : [{ c: 0 }]));
  eq('COUNT=0 נחשב ריק -> ניסיון רחב', r.executed.length, 2);
  // שאילתה מורחבת נכשלת: חוזרים למקורית
  const s2 = SN.createNameSession({ lookup: mkLookup({ Customer: ['שיינווטר'] }) });
  const orig = `SELECT 1 FROM "Customer" WHERE "lastName" ILIKE '%שיינועטר%'`;
  const out2 = await SN.runSqlWithSmartNames([orig], { session: s2, execute: async (q) => { if (q.includes('ANY')) throw new Error('syntax'); return [{ x: 1 }]; } });
  eq('הרחבה נכשלה -> רצה השאילתה המקורית', out2.queries, [orig]);
  eq('הרחבה נכשלה -> אין הודעת איות', s2.notice({}), '');
}

// ---------- 6. עמודת "סוג התאמה" ----------
{
  const s = SN.createNameSession({ lookup: mkLookup({ Customer: ['שיינועטר', 'שיינווטר'] }) });
  await s.expand([SQL1]);
  const rows = [{ 'שם': 'שיינועטר', 'מספר': '5' }, { 'שם': 'שיינווטר', 'מספר': '6' }, { 'שם': 'שיינועטר', _actionUrl: '/x' }];
  const out = s.annotateRows(rows);
  eq('annotate: מדויק / קרוב', out.map((r) => r['סוג התאמה']), ['התאמה מדויקת', 'איות קרוב ("שיינווטר")', 'התאמה מדויקת']);
  const s2 = SN.createNameSession({ lookup: mkLookup({ Customer: ['שיינועטר'] }) });
  await s2.expand([SQL1]);
  eq('annotate: בלי איות קרוב - הטבלה לא משתנה', s2.annotateRows(rows), rows);
}

// ---------- 7. זיהוי שמות בשאלה ורמז לפרומפט ----------
{
  yes('מועמדים: לשיינועטר -> גם שיינועטר', SN.nameCandidateWords('יש לשיינועטר שמלות?').includes('שיינועטר'), SN.nameCandidateWords('יש לשיינועטר שמלות?'));
  yes('מועמדים: מילים קצרות (יש/לא/כל) לא נכללות', !SN.nameCandidateWords('יש לא כל').length, SN.nameCandidateWords('יש לא כל'));
  yes('מועמדים: אותיות סופיות נשמרות כפי שנכתבו (אברהם ולא אברהמ)', SN.nameCandidateWords('הזמנות של אברהם').includes('אברהם'), SN.nameCandidateWords('הזמנות של אברהם'));
  const lookup = mkLookup({ Customer: ['שיינועטר', 'שיינווטר', 'כהן'] });
  const s = SN.createNameSession({ lookup });
  const hint = await SN.buildNameHint('יש שיינועטר שלקחו שמלות?', { session: s, probe: async (ws) => ws.filter((w) => w === 'שיינועטר') });
  yes('hint: מזכיר את השם והאיות הקרוב', hint.includes('"שיינועטר"') && hint.includes('"שיינווטר"') && hint.includes('MUST filter'), hint);
  eq('flagged', s.flagged(), ['שיינועטר']);
  yes('droppedNameFilter: SQL בלי תנאי שם', s.droppedNameFilter([`SELECT COUNT(*) FROM "OrderItem" WHERE "isTaken" = true`]), 'x');
  yes('droppedNameFilter: SQL עם תנאי שם - לא', !s.droppedNameFilter([SQL1]), 'x');
  const s2 = SN.createNameSession({ lookup });
  eq('hint ריק כשה-probe לא מצא שם', await SN.buildNameHint('כמה שמלות יש?', { session: s2, probe: async () => [] }), '');
  eq('אין flagged -> אין תיקון', s2.droppedNameFilter([`SELECT 1`]), false);
  const s3 = SN.createNameSession({ lookup });
  eq('probe נכשל -> hint ריק', await SN.buildNameHint('יש שיינועטר', { session: s3, probe: async () => { throw new Error('x'); } }), '');
}
{
  const r = SF.rankNameSpellings('שיינוטר', sp('שיינועטר', 'שיינר'), { loose: true });
  eq('loose + גרסה חזקה: רק החזקה ב-near, הרחוקה ב-extra', [r.near.map((n) => n.raw), r.extra.map((n) => n.raw)], [['שיינועטר'], ['שיינר']]);
  const s = SN.createNameSession({ lookup: mkLookup({ Customer: ['שיינועטר', 'שיינווטר'] }) });
  await s.expand([SQL1]);
  eq('notice: השם קיים + תוצאה ריקה + איות קרוב נבדק', s.notice({ rowsEmpty: true }), 'נמצא לקוח/ה בשם "שיינועטר", אך אין רשומות שמתאימות לשאר תנאי החיפוש (נבדקו גם איותים קרובים: "שיינווטר").');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
