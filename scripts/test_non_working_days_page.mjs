// בדיקות טהורות לדף "ימי אי-פעילות" (/non-working-days): lib/nonWorkingDaysPage.js + חוזה סטטי של הדף, ה-API, התפריט
// ומסך הניהול. בלי DB, בלי רשת, בלי דפדפן, בלי כתיבה. הרצה (מתוך gemach-app/):
//   node scripts/test_non_working_days_page.mjs        (יוצא עם קוד 1 אם משהו נכשל)
// הכלל עצמו ("מה יום סגור") נבדק ב-scripts/business-days-tests; כאן - מה שהדף בונה מעליו: תאריכים עבריים, לוח חודשי,
// טיוטה / הפרש / ביטול, ניתוח בחירה (ימים שעברו וסגורים מדולגים), שמירה (מסמך גרסה 2 שעובר את האימות), התאריכים הקבועים
// (כלל אדר ויום 30 של lib/businessDays.js), ספירת "פעילות רשומה", ושלושת השערים (דף / API / תפריט).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.resolve(here, '..');
// אותם hooks כמו scripts/business-days-tests (ייבוא בלי סיומת, '@/'); prisma/auth מוחלפים ב-shim ולא נגעים בהם כאן
process.env.PROJ = process.env.PROJ || PROJ;
process.env.SPDIR = process.env.SPDIR || path.join(here, 'business-days-tests');
register(pathToFileURL(path.join(here, 'business-days-tests', 'hooks.mjs')).href);
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const read = (rel) => readFileSync(path.join(PROJ, rel), 'utf8');

const P = await L('lib/nonWorkingDaysPage.js');
const B = await L('lib/businessDays.js');
const H = await L('lib/hebrewDate.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e && e.message); process.exitCode = 1; }
}

console.log('תאריכים עבריים ולוח חודשי');
t('gematria / תוויות: ט״ו, ט״ז, כ״ו, ל׳, תשפ״ז; hLong / hDate / hShort / כותרת החודש', () => {
  assert.equal(P.gematria(15), 'ט״ו'); assert.equal(P.gematria(16), 'ט״ז'); assert.equal(P.gematria(26), 'כ״ו');
  assert.equal(P.gematria(30), 'ל׳'); assert.equal(P.gematria(1), 'א׳'); assert.equal(P.gematria(5787 % 1000), 'תשפ״ז');
  assert.equal(P.hLong('2026-10-04'), 'יום ראשון · כ״ג תשרי תשפ״ז');
  assert.equal(P.hDate('2027-02-03'), 'כ״ו שבט תשפ״ז');
  assert.equal(P.hShort('2026-09-26'), 'ט״ו תשרי');
  assert.equal(P.hMonthTitle(P.monthStartOf('2026-10-04')), 'תשרי תשפ״ז');
  assert.equal(P.hLong('garbage'), '');
  // שנה מעוברת תשפ״ז: אדר א׳ / אדר ב׳
  assert.match(P.hDate('2027-02-20'), /אדר א׳/);
  assert.match(P.hDate('2027-03-23'), /אדר ב׳/);
});
t('לוח חודשי עברי: מתחיל בא׳ בחודש, 29/30 ימים, שבועות מלאים (ראשון-שבת), מעבר חודש קדימה/אחורה', () => {
  const st = P.monthStartOf('2026-10-04');
  assert.equal(st, '2026-09-12'); // א׳ תשרי תשפ״ז = שבת 12.9.2026
  assert.equal(P.monthLength(st), 30);
  const g = P.monthGrid(st);
  assert.equal(g.length % 7, 0);
  assert.equal(P.weekdayOf(g[0].key), 0);
  assert.equal(P.weekdayOf(g[g.length - 1].key), 6);
  assert.equal(g.filter((c) => c.inMonth).length, 30);
  assert.equal(g.find((c) => c.inMonth).key, st);
  const nx = P.nextMonthStart(st);
  assert.equal(P.heb(nx).d, 1); assert.equal(P.heb(nx).month, 'Cheshvan');
  assert.equal(P.prevMonthStart(nx), st);
  // בכל חודש בשנתיים: מתחיל ב-א׳, הבא מתחיל אחרי 29/30 ימים
  let s = P.monthStartOf('2026-01-01');
  for (let i = 0; i < 26; i++) { const n = P.nextMonthStart(s); assert.equal(P.heb(n).d, 1, s); assert.ok([29, 30].includes(P.monthLength(s))); assert.equal(P.prevMonthStart(n), s); s = n; }
});
t('keysBetween: בכל סדר, כולל הקצוות, עם תקרה', () => {
  assert.deepEqual(P.keysBetween('2026-11-03', '2026-11-01'), ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.equal(P.keysBetween('2026-01-01', '2027-01-01').length, P.MAX_SELECTION_DAYS);
  assert.deepEqual(P.keysBetween('x', '2026-11-01'), []);
});

console.log('למה יום סגור (מהכלל של lib/businessDays.js)');
t('סגור אוטומטית: חג, ערב חג (כולל הושענא רבה וערב שביעי של פסח), חול המועד, שבת, שישי; יום רגיל - null', () => {
  const k = (key) => (P.autoReason(key) || {}).k || null;
  const txt = (key) => (P.autoReason(key) || {}).txt || null;
  assert.equal(txt('2026-09-12'), 'חג: ראש השנה');
  assert.equal(txt('2026-09-20'), 'ערב חג: יום כיפור');
  assert.equal(txt('2026-09-25'), 'ערב חג: סוכות');
  assert.equal(txt('2026-09-27'), 'חול המועד: סוכות');
  assert.equal(txt('2026-10-02'), 'ערב חג: שמיני עצרת (הושענא רבה)'); // NWD-Q03
  assert.equal(txt('2026-10-03'), 'חג: שמיני עצרת');
  assert.equal(txt('2027-04-27'), 'ערב חג: שביעי של פסח'); // כ׳ ניסן תשפ״ז (NWD-Q03)
  assert.equal(txt('2027-04-28'), 'חג: שביעי של פסח');
  assert.equal(k('2026-10-09'), 'fri'); assert.equal(k('2026-10-10'), 'sat');
  assert.equal(P.autoReason('2026-10-04'), null);
  assert.equal(P.autoReason('2026-10-08'), null);
  // כל יום שהכלל אומר "סגור" (בלי רשימת הבעלים) מקבל סיבה, וכל יום עובד - null (שנתיים)
  for (let d = '2026-01-01'; d <= '2027-12-31'; d = P.addDays(d, 1)) {
    assert.equal(P.autoReason(d) !== null, B.isNonWorkingDay(d, null), d);
  }
});
t('holidayName: שמות hebcal -> שמות התצוגה של העיצוב', () => {
  assert.equal(P.holidayName('סכות ב׳ (חוה״מ)'), 'סוכות');
  assert.equal(P.holidayName('ראש השנה 5787'), 'ראש השנה');
  assert.equal(P.holidayName('ראש השנה ב׳'), 'ראש השנה');
  assert.equal(P.holidayName('יום כפור'), 'יום כיפור');
  assert.equal(P.holidayName('פסח ז׳'), 'שביעי של פסח');
  assert.equal(P.holidayName('סכות ז׳ (הושענא רבה)'), 'הושענא רבה');
  assert.equal(P.holidayName('שבועות'), 'שבועות');
});

console.log('תאריכים עבריים קבועים');
t('fixedOn / nextOccurrence / fixedLabel: כ״ו בשבט; אדר = אדר ב׳ בשנה מעוברת; אדר א׳ בשנה פשוטה = אדר (הכלל של businessDays)', () => {
  const shvat = { month: 'Shvat', day: 26 };
  assert.equal(P.fixedLabel(shvat), 'כ״ו בשבט');
  assert.equal(P.nextOccurrence(shvat, '2026-10-04'), '2027-02-03');
  assert.deepEqual(P.fixedOn([shvat], '2027-02-03'), shvat);
  assert.equal(P.fixedOn([shvat], '2027-02-04'), null);
  // תשפ״ז מעוברת: "אדר" י״ד = פורים (אדר ב׳) 23.3.2027; "אדר א׳" י״ד = 21.2.2027
  assert.equal(P.nextOccurrence({ month: 'Adar', day: 14 }, '2026-10-04'), '2027-03-23');
  assert.equal(P.nextOccurrence({ month: 'Adar I', day: 14 }, '2026-10-04'), '2027-02-21');
  // תשפ״ח פשוטה: אדר א׳ י״ד = אדר י״ד = 13.3.2028
  assert.equal(P.nextOccurrence({ month: 'Adar I', day: 14 }, '2027-10-01'), '2028-03-12');
  assert.equal(P.nextOccurrence({ month: 'Adar', day: 14 }, '2027-10-01'), '2028-03-12');
  // אותה תשובה כמו הכלל עצמו (parseNonWorkingDaysSetting + isNonWorkingDay בלי ברירות המחדל)
  for (const f of [{ month: 'Cheshvan', day: 30 }, { month: 'Kislev', day: 30 }, { month: 'Adar I', day: 30 }, { month: 'Nisan', day: 1 }]) {
    const cfg = B.parseNonWorkingDaysSetting({ recurringHebrew: [f] });
    const nx = P.nextOccurrence(f, '2026-09-01');
    assert.ok(nx, JSON.stringify(f));
    assert.equal(B.isNonWorkingDay(nx, cfg, { skipWeekend: false, skipHolidays: false }), true);
    assert.equal(B.isNonWorkingDay(P.addDays(nx, -1), cfg, { skipWeekend: false, skipHolidays: false }), false);
  }
  // יום ל׳ בחשוון חסר -> כ״ט (DAY30_NOTE): חשוון תשפ״ז חסר (29 ימים) => המופע הוא כ״ט חשוון
  const ch30 = P.nextOccurrence({ month: 'Cheshvan', day: 30 }, '2026-10-12');
  assert.equal(P.heb(ch30).month, 'Cheshvan');
  assert.ok([29, 30].includes(P.heb(ch30).d));
  assert.match(P.DAY30_NOTE, /כ״ט/);
});
t('בורר החודש (פירוש 8): מתשרי, בלי "אדר ב׳" כפול; תוויות אדר לפי הכלל; maxDay', () => {
  const v = P.FIXED_MONTH_OPTIONS.map((o) => o.value);
  assert.equal(v[0], 'Tishrei'); assert.equal(v.length, 13); assert.ok(!v.includes('Adar II'));
  assert.ok(v.indexOf('Shvat') < v.indexOf('Adar') && v.indexOf('Adar') < v.indexOf('Nisan'));
  assert.match(P.FIXED_MONTH_OPTIONS.find((o) => o.value === 'Adar').label, /בשנה מעוברת: אדר ב׳/);
  assert.equal(P.fixedMaxDay('Tevet'), 29); assert.equal(P.fixedMaxDay('Kislev'), 30); assert.equal(P.fixedMaxDay('Adar'), 29);
  assert.ok(P.isValidFixed('Shvat', 26)); assert.ok(!P.isValidFixed('Tevet', 30)); assert.ok(!P.isValidFixed('Shevat', 1)); assert.ok(!P.isValidFixed('Shvat', 0));
});

console.log('הטיוטה, ההפרש והשמירה');
const SETTING = JSON.stringify({ version: 2, days: [{ date: '2026-11-03', note: 'הדברה' }, { date: '2026-01-05' }], ranges: [{ from: '2026-11-08', to: '2026-11-12', note: 'חופשה' }], recurringHebrew: [{ month: 'Shvat', day: 26, note: 'יום זיכרון' }] });
t('modelFromSetting: טווחים נפרשים ליום-יום עם ההערה; ימים שעברו נשמרים; תאריכים קבועים; v1 "open" לא נטען ונספר', () => {
  const m = P.modelFromSetting(SETTING);
  assert.deepEqual([...m.marks.keys()], ['2026-01-05', '2026-11-03', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
  assert.equal(m.marks.get('2026-11-10'), 'חופשה');
  assert.deepEqual(m.fixed.map((f) => [f.month, f.day, f.note]), [['Shvat', 26, 'יום זיכרון']]);
  const v1 = P.modelFromSetting('{"version":1,"days":[{"date":"2026-11-03"},{"date":"2026-11-06","status":"open"}]}');
  assert.deepEqual([...v1.marks.keys()], ['2026-11-03']); assert.equal(v1.ignoredOpen, 1); assert.equal(v1.invalid, 1);
  assert.equal(P.modelFromSetting('').marks.size, 0); assert.equal(P.modelFromSetting(null).marks.size, 0);
  assert.equal(P.modelFromSetting('{broken').invalid, 1);
});
t('modelToDocument: רצף צמוד עם אותה הערה = טווח; בודד = days; משמעות זהה בכלל; עובר את validateNonWorkingDaysSettingValue', () => {
  const m = P.modelFromSetting(SETTING);
  const doc = P.modelToDocument(m);
  assert.deepEqual(doc, { version: 2, days: [{ date: '2026-01-05' }, { date: '2026-11-03', note: 'הדברה' }], ranges: [{ from: '2026-11-08', to: '2026-11-12', note: 'חופשה' }], recurringHebrew: [{ month: 'Shvat', day: 26, note: 'יום זיכרון' }] });
  assert.equal(B.validateNonWorkingDaysSettingValue(P.serializeModel(m)), null);
  // אותם ימים סגורים בדיוק בכלל, לפני ואחרי
  const a = B.parseNonWorkingDaysSetting(SETTING); const b = B.parseNonWorkingDaysSetting(P.serializeModel(m));
  for (let d = '2025-12-01'; d <= '2027-12-31'; d = P.addDays(d, 1)) assert.equal(B.isNonWorkingDay(d, b), B.isNonWorkingDay(d, a), d);
  assert.ok(P.sameMeaning(P.modelFromSetting(P.serializeModel(m)), m));
  // הערה שונה באמצע רצף שוברת אותו לשני טווחים / בודד
  const w = P.setNote(m, '2026-11-10', 'אחר');
  const d2 = P.modelToDocument(w);
  assert.deepEqual(d2.ranges.map((r) => [r.from, r.to]), [['2026-11-08', '2026-11-09'], ['2026-11-11', '2026-11-12']]);
  assert.ok(d2.days.some((x) => x.date === '2026-11-10' && x.note === 'אחר'));
  // רצף ארוך מ-366 ימים מתפצל (תקרת טווח אחד בכלל)
  const long = P.markDays(P.modelFromSetting(''), P.keysBetween('2027-01-01', '2028-06-01', 600), '');
  const dl = P.modelToDocument(long);
  assert.ok(dl.ranges.every((r) => P.keysBetween(r.from, r.to, 1000).length <= B.MAX_RANGE_DAYS));
  assert.equal(B.validateNonWorkingDaysSettingValue(JSON.stringify(dl)), null);
});
t('diffModels / undoGroup: הוספה, הסרה, הערה, תאריך קבוע; כל ביטול מחזיר את השמור; ימים צמודים עם אותה הערה = קבוצה אחת', () => {
  const saved = P.modelFromSetting(SETTING);
  let w = P.markDays(saved, ['2026-12-01', '2026-12-02', '2026-12-03'], 'חופשת צוות');
  w = P.unmarkDays(w, ['2026-11-03']);
  w = P.setNote(w, '2026-11-08', 'חופשה ארוכה');
  w = P.addFixed(w, { month: 'Kislev', day: 25, note: 'יום הולדת הסניף' }).work;
  w = P.removeFixed(w, { month: 'Shvat', day: 26 });
  const ch = P.diffModels(saved, w);
  assert.deepEqual(ch.map((g) => g.t).sort(), ['add', 'fxadd', 'fxrm', 'note', 'rm']);
  assert.deepEqual(ch.find((g) => g.t === 'add').keys, ['2026-12-01', '2026-12-02', '2026-12-03']);
  let u = w;
  for (const g of ch) u = P.undoGroup(saved, u, g);
  assert.deepEqual(P.diffModels(saved, u), []);
  assert.ok(P.sameMeaning(saved, u));
  // הטיוטה לא משנה את השמור (עותקים)
  assert.equal(saved.marks.has('2026-12-01'), false); assert.equal(saved.marks.get('2026-11-03'), 'הדברה');
  // תאריך קבוע כפול / לא תקין
  assert.equal(P.addFixed(saved, { month: 'Shvat', day: 26 }).duplicate, true);
  assert.equal(P.addFixed(saved, { month: 'Tevet', day: 30 }).added, false);
  // הערה של תאריך קבוע שהשתנתה
  const fxNote = { ...P.cloneModel(saved), fixed: saved.fixed.map((f) => ({ ...f, note: 'חדש' })) };
  const g = P.diffModels(saved, fxNote);
  assert.deepEqual(g.map((x) => x.t), ['fxnote']);
  assert.deepEqual(P.diffModels(saved, P.undoGroup(saved, fxNote, g[0])), []);
});
t('analyseSelection (NWD-Q05/Q07, פירוש 5): ימים שעברו וימים סגורים (כולל חול המועד ותאריך קבוע) מדולגים ונספרים', () => {
  const today = '2026-09-29';
  const m = P.modelFromSetting(JSON.stringify({ version: 2, days: [{ date: '2026-10-05' }], recurringHebrew: [{ month: 'Tishrei', day: 25 }] }));
  // 28.9 (עבר, חול המועד) .. 8.10: חוה״מ 29.9-1.10, הו״ר 2.10, ש״ע 3.10 סגורים; 4.10 פנוי; 5.10 מסומן; 6.10 = כ״ה תשרי קבוע; 7.10, 8.10 פנויים
  const r = P.analyseSelection(P.keysBetween('2026-09-28', '2026-10-08'), m, today);
  assert.equal(r.past, 1);
  assert.deepEqual(r.marked, ['2026-10-05']);
  assert.deepEqual(r.cand, ['2026-10-04', '2026-10-07', '2026-10-08']);
  assert.equal(r.closed, 6); // 29.9, 30.9, 1.10 (חוה״מ), 2.10 (הו״ר), 3.10 (ש״ע), 6.10 (כ״ה תשרי)
  assert.deepEqual(P.closedReason('2026-10-06', m.fixed).k, 'fx');
  assert.equal(P.closedReason('2026-10-07', m.fixed), null);
});

console.log('פעילות רשומה (NWD-Q06: אזהרה בלבד)');
t('countActivity לפי היום הישראלי (שתי צורות השמירה), בטווח בלבד; sumActivity / activityText; parseActivityRange', () => {
  const orders = [
    { eventDate: new Date('2026-11-03T00:00:00.000Z'), isDelivery: false },
    { eventDate: new Date('2026-11-02T22:00:00.000Z'), isDelivery: true }, // חצות ישראל של 3.11 (חורף)
    { eventDate: new Date('2026-11-05T00:00:00.000Z'), isDelivery: true },
    { eventDate: new Date('2026-12-30T00:00:00.000Z'), isDelivery: true }, // מחוץ לטווח
    { eventDate: null },
  ];
  const by = P.countActivity(orders, '2026-11-01', '2026-11-30', H.getIsraelDateKey);
  assert.deepEqual(by, { '2026-11-03': { events: 2, deliveries: 1 }, '2026-11-05': { events: 1, deliveries: 1 } });
  const s = P.sumActivity(['2026-11-03', '2026-11-04', '2026-11-05'], by);
  assert.deepEqual(s, { ev: 3, dl: 2, days: ['2026-11-03', '2026-11-05'] });
  assert.equal(P.activityText(3, 2), '3 אירועים · 2 משלוחים');
  assert.equal(P.activityText(1, 1), 'אירוע אחד · משלוח אחד');
  assert.equal(P.activityText(0, 0), '');
  assert.deepEqual(P.parseActivityRange('2026-11-01', '2026-11-30'), { from: '2026-11-01', to: '2026-11-30' });
  assert.equal(P.parseActivityRange('2026-11-30', '2026-11-01'), null);
  assert.equal(P.parseActivityRange('2026-02-30', '2026-03-01'), null);
  assert.equal(P.parseActivityRange('2026-01-01', '2026-12-31'), null, 'יותר מ-120 ימים');
  assert.equal(P.parseActivityRange('2026-01-01', '2026-04-30').to, '2026-04-30', '120 ימים בדיוק');
  assert.equal(P.parseActivityRange(null, '2026-01-01'), null);
});

console.log('הרשאה ושערים');
t('canEditFrom: רק מחובר עם ההרשאה (hasPermission מחזיר true להנהלה / מתכנת)', () => {
  assert.equal(P.canEditFrom({ logged: true, hasManagePermission: true }), true);
  assert.equal(P.canEditFrom({ logged: true, hasManagePermission: false }), false);
  assert.equal(P.canEditFrom({ logged: false, hasManagePermission: true }), false);
});
t('הדף: שער "מחובר" ב-layout, לא תחת /admin; בלי מתג ישן/חדש; נטען ב-dynamic', () => {
  assert.ok(existsSync(path.join(PROJ, 'app/non-working-days/page.js')));
  assert.ok(!existsSync(path.join(PROJ, 'app/admin/non-working-days')));
  assert.match(read('app/non-working-days/layout.js'), /if \(!\(await checkAuth\(\)\)\) return <NoAccessMessage \/>/);
  assert.match(read('app/components/nonWorkingDays/NonWorkingDaysSwitch.js'), /dynamic\(\(\) => import\('\.\/NonWorkingDaysPage'\), \{ ssr: false \}\)/);
  assert.match(read('app/non-working-days/page.js'), /NonWorkingDaysSwitch/);
});
t('ה-API: GET מצב (מחובר, canEdit מההרשאה, קריאה ישירה מה-DB); activity רק עם ההרשאה, בלי טיוטות/מחוקות, NULL-safe; אין כתיבה', () => {
  const st = read('app/api/non-working-days/route.js');
  assert.match(st, /if \(!\(await checkAuth\(\)\)\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\)/);
  assert.match(st, /hasPermission\(employee, NON_WORKING_DAYS_PERMISSION_KEY\)/);
  assert.match(st, /prisma\.systemSetting\.findUnique\(/);
  const ac = read('app/api/non-working-days/activity/route.js');
  assert.match(ac, /hasPermission\(employee, NON_WORKING_DAYS_PERMISSION_KEY\)/);
  assert.match(ac, /status: 403/);
  assert.match(ac, /\{ OR: \[\{ status: null \}, \{ status: \{ not: DRAFT_ORDER_STATUS \} \}\] \}/);
  assert.match(ac, /isDeleted: false/);
  for (const src of [st, ac]) {
    assert.doesNotMatch(src, /\.(create|update|upsert|delete|deleteMany|updateMany|createMany|\$executeRaw)\(/, 'כתיבה ל-DB');
    assert.doesNotMatch(src, /export async function (POST|PUT|PATCH|DELETE)/);
    assert.doesNotMatch(src, /notIn:|<>/);
  }
});
t('הדף שומר רק דרך POST /api/settings עם המפתח היחיד (מסלול ההרשאה), מאמת לפני, ובודק התנגשות; בלי alert/confirm; רכיבי הפלטה', () => {
  const src = read('app/components/nonWorkingDays/NonWorkingDaysPage.js');
  assert.match(src, /fetch\('\/api\/settings', \{/);
  assert.match(src, /JSON\.stringify\(\[\{ key: server\.key, value, name: server\.name \}\]\)/);
  assert.match(src, /validateNonWorkingDaysSettingValue\(value\)/);
  assert.match(src, /sameMeaning\(modelFromSetting\(fresh\.value \|\| null\), saved\)/);
  const code = src.replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /window\.(alert|confirm|prompt)\(|[^.\w](alert|confirm|prompt)\(/);
  assert.match(src, /className="gm-ds gm-nw home-bg dlg-dark"/);
  assert.ok(!/gm-home/.test(code), 'gm-home בקוד הדף');
  assert.match(src, /createPortal\(/);
  assert.match(src, /id="dlg"/);
  assert.match(src, /usePageTooltip\(rootRef, ttRef, !!inA5Shell\)/);
  assert.match(src, /<HomeSprite \/>/);
  assert.ok(!/טוגל/.test(src), 'המילה "טוגל"');
  // תאריכים עבריים בלבד: אין תאריך לועזי מוצג (toLocaleDateString / getFullYear בתצוגה / YYYY-MM-DD בטקסט)
  assert.doesNotMatch(code, /toLocaleDateString|toLocaleString\(/);
  const css = read('app/components/nonWorkingDays/non-working-days.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of css.split('}').map((x) => x.trim()).filter(Boolean)) {
    const sel = rule.split('{')[0].replace(/@media[^{]*\{/, '').trim();
    if (!sel || sel.startsWith('@')) continue;
    const parts = []; let depth = 0; let cur = '';
    for (const ch of sel) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { parts.push(cur); cur = ''; } else cur += ch; }
    parts.push(cur);
    for (const part of parts) assert.ok(part.trim().startsWith('.gm-ds.gm-nw'), 'כלל CSS לא תחום: ' + part.trim());
  }
  assert.doesNotMatch(css, /gm-home/);
});
t('התפריט ומסך הניהול: פריט "ימי אי-פעילות" (lib/menu), תווית בעברית (pageLabels), אריח במסך הניהול', () => {
  const menu = read('lib/menu/buildMenuTree.js');
  assert.match(menu, /'ad-nwd': \{ label: 'ימי אי-פעילות', icon: 'lock', href: '\/non-working-days', featureKey: 'feature:non_working_days_manage'/);
  assert.match(menu, /'ad-settings', 'ad-nwd'/);
  assert.match(read('lib/menu/pageLabels.js'), /'\/non-working-days': 'ימי אי-פעילות'/);
  assert.match(read('lib/adminHubCatalog.js'), /href: '\/non-working-days', icon: 'lock', gate: 'head', title: 'ימי אי-פעילות'/);
  assert.match(read('lib/permissionsMetadata.js'), /key: 'feature:non_working_days_manage'/);
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
