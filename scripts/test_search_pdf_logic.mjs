// בדיקת יחידה ללוגיקה הטהורה של דף ה-PDF / ההדפסה של תוצאות החיפוש (app/components/home/searchPdf.js). בלי DB, רשת או דפדפן.
// הרצה: node scripts/test_search_pdf_logic.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// (בדיקת דפדפן אמיתית — עמודים, מספרי עמוד, אין שורה חתוכה — ב-scripts/search-pdf-audit/run.mjs)
import assert from 'node:assert/strict';
import {
  SHEET_ROW_CAP, GEOMETRY_MM, ROW_H, headerStamp, israelNow, searchFileName, sectionsFromGeneral, sectionFromRecords,
  capSections, chooseOrientation, sectionLines, paginate, buildSearchSheet,
} from '../app/components/home/searchPdf.js';
import { normalizeSearch, applyScope } from '../app/components/home/homeLogic.js';

let passed = 0;
let failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const mk = (nc, no, nr) => normalizeSearch({
  customers: Array.from({ length: nc }, (_, i) => ({ id: 'c' + i, firstName: 'לקוחה', lastName: 'מס' + i, phone1: '050-123' + (4000 + i), city: 'ירושלים' })),
  orders: Array.from({ length: no }, (_, i) => ({ id: 'o' + i, orderId: 40000 + i, firstName: 'רחל', lastName: 'כהן' + i, eventDateHebrew: 'כ״א תשרי', status: i % 2 ? 'הוחזר' : '' })),
  rentals: Array.from({ length: nr }, (_, i) => ({ orderId: 40000 + i, catalogName: 'תחרה ' + i, barcode: '4512-' + (1000 + i), sizeText: '40' })),
});
const NOW = new Date('2026-10-02T11:32:00Z'); // 14:32 בישראל (UTC+3)

t('israelNow: שעון ישראל בלי קשר לאזור הזמן של המכונה', () => {
  assert.deepEqual(israelNow(NOW), { iso: '2026-10-02', time: '14:32' });
  // 21:30 UTC בחורף = 23:30 בישראל, ו-22:30 UTC = כבר למחרת
  assert.deepEqual(israelNow(new Date('2026-01-10T21:30:00Z')), { iso: '2026-01-10', time: '23:30' });
  assert.deepEqual(israelNow(new Date('2026-01-10T22:30:00Z')), { iso: '2026-01-11', time: '00:30' });
});

t('headerStamp: תאריך עברי בלבד (בלי תאריך לועזי) + יום בשבוע', () => {
  const s = headerStamp(NOW);
  assert.equal(s.time, '14:32');
  assert.match(s.date, /^יום שישי · /);
  assert.match(s.hebrew, /תשרי תשפ״ז$/);
  assert.ok(!/\d{4}/.test(s.date), 'אין שנה לועזית: ' + s.date);
  assert.ok(!/[\d]{1,2}\/[\d]{1,2}/.test(s.date));
});

t('searchFileName: כותרת, טקסט חיפוש ותאריך עברי; תווים אסורים בווינדוס מוסרים', () => {
  assert.equal(searchFileName({ query: 'כהן', now: NOW }), 'תוצאות-חיפוש-כהן-כא-תשרי-תשפז');
  assert.equal(searchFileName({ now: NOW }), 'תוצאות-חיפוש-כא-תשרי-תשפז');
  const bad = searchFileName({ query: 'a/b\\c:d*e?f"g<h>i|j', now: NOW });
  assert.ok(!/[\\/:*?"<>|]/.test(bad), bad);
  assert.ok(searchFileName({ query: 'x'.repeat(200), now: NOW }).length < 90);
  assert.ok(!/\.\.|^-|-$|\s/.test(searchFileName({ query: '  ..שם..  ', now: NOW })));
});

t('sectionsFromGeneral: לקוחות / הזמנות / פריטים, רק מה שיש; עמודות לפי הקטגוריה', () => {
  const s = sectionsFromGeneral(applyScope(mk(2, 3, 1), null));
  // 5.10.2026: הזמנות לפני לקוחות (גם בדף ההדפסה / ה-PDF)
  assert.deepEqual(s.map((x) => x.label), ['הזמנות', 'לקוחות', 'פריטים']);
  assert.deepEqual(s[1].cols.map((c) => c.h), ['שם', 'טלפון', 'עיר']);
  assert.deepEqual(s[0].cols.map((c) => c.h), ['שם', 'מס׳ הזמנה', 'תאריך אירוע', 'סטטוס']);
  assert.deepEqual(s[2].cols.map((c) => c.h), ['דגם', 'ברקוד', 'מידה', 'מס׳ הזמנה', 'לקוח', 'תאריך אירוע', 'סטטוס']);
  assert.deepEqual(s[2].cols.map((c) => !!c.ltr), [false, true, false, true, false, false, false]);
  assert.equal(s[0].rows[0][1], '#40000');
  assert.equal(s[0].rows[0][3], 'פעיל'); // סטטוס שמור ריק (תשובה ישנה בלי computedStatus) = "פעיל" (כמו במסך)
  assert.equal(sectionsFromGeneral(applyScope(mk(2, 3, 1), 'customers')).length, 1, 'סינון לקטגוריה = מקטע אחד');
  assert.deepEqual(sectionsFromGeneral(null), []);
  // אין סכומים ופרטי תשלום בדף (מידע שלא מוצג בשורת התוצאה)
  const all = JSON.stringify(s);
  assert.ok(!/totalAmount|סכום|₪/.test(all));
});

t('פריטים (ברקוד שחוזר בכמה השכרות): לכל השכרה הזמנה, לקוחה, תאריך עברי ומצב; חסר = תא ריק', () => {
  const res = normalizeSearch({ rentals: [
    { orderId: 52001, catalogName: '551', barcode: '5511205', sizeText: '12', isTaken: true, isReturned: false, firstName: 'רחל', lastName: 'כהן', eventDateHebrew: 'ט״ו תשרי תשפ״ז', eventDate: '2026-10-03T00:00:00.000Z' },
    { orderId: 47310, catalogName: '551', barcode: '5511205', sizeText: '12', isTaken: true, isReturned: true, firstName: 'לאה', lastName: null, eventDateHebrew: null, eventDate: '2025-06-11T21:00:00.000Z' },
    { orderId: 39002, catalogName: '551', barcode: '5511205', sizeText: '12', isTaken: false, isReturned: false },
  ] });
  const [sec] = sectionsFromGeneral(res);
  assert.equal(sec.label, 'פריטים');
  assert.equal(sec.rows.length, 3);
  assert.deepEqual(sec.rows[0], ['551', '5511205', '12', '#52001', 'רחל כהן', 'ט״ו תשרי תשפ״ז', 'מושכר עכשיו']);
  assert.equal(sec.rows[1][3], '#47310');
  assert.equal(sec.rows[1][6], 'הוחזר');
  assert.match(sec.rows[1][5], / סיוו?ן תשפ״ה$/, 'תאריך מחושב מ-eventDate — עברי');
  assert.deepEqual(sec.rows[2].slice(3), ['#39002', '', '', 'טרם נלקח']);
  // תאריך עברי בלבד בעמודת התאריך
  for (const r of sec.rows) assert.ok(!/\d/.test(r[5]), 'תאריך לועזי: ' + r[5]);
  // נכנס בעמוד לאורך, שורה אחת לכל השכרה, ומופיע ב-HTML
  const sheet = buildSearchSheet({ sections: [sec], query: '5511205', now: NOW });
  assert.equal(sheet.landscape, false);
  assert.ok(sheet.html.includes('#52001') && sheet.html.includes('רחל כהן') && sheet.html.includes('מושכר עכשיו'));
  assert.ok(!/eventDate|2025-06|2026-10-03/.test(sheet.html), 'אין תאריך לועזי גולמי בדף');
});

t('sectionFromRecords: מסיר עמודות _action ורגישות, קובע ltr לטלפונים, שתי שורות לטקסט ארוך', () => {
  const sec = sectionFromRecords([
    { שם: 'רחל', טלפון: '052-1234567', 'ת"ז': '123456789', _actionUrl: '/orders/1', הערה: 'x'.repeat(120) },
    { שם: 'לאה', טלפון: '050-7654321', 'ת"ז': '987654321', _actionUrl: '/orders/2', הערה: '' },
  ]);
  assert.deepEqual(sec.cols.map((c) => c.h), ['שם', 'טלפון', 'הערה']);
  assert.equal(sec.cols[1].ltr, true);
  assert.equal(sec.cols[0].ltr, false);
  assert.ok(!JSON.stringify(sec).includes('123456789'));
  assert.equal(sectionLines(sec, GEOMETRY_MM.portrait.w), 2);
  assert.equal(sectionFromRecords([]), null);
});

t('capSections: חותך לפי הסדר, מדווח total/shown/capped, לא משנה את הקלט', () => {
  const s = sectionsFromGeneral(applyScope(mk(300, 300, 100), null));
  const c = capSections(s);
  assert.equal(c.total, 700);
  assert.equal(c.shown, SHEET_ROW_CAP);
  assert.equal(c.capped, true);
  assert.deepEqual(c.sections.map((x) => x.rows.length), [300, 200]);
  assert.equal(s[1].rows.length, 300, 'הקלט לא שונה');
  assert.equal(c.sections[1].totalRows, 300, 'הכותרת מציגה את הספירה האמיתית');
  const small = capSections(s, 1000);
  assert.equal(small.capped, false);
});

t('chooseOrientation: לאורך כברירת מחדל, לרוחב רק בטבלה גנרית רחבה, וגם כפוי', () => {
  const narrow = sectionFromRecords([{ א: 1, ב: 2, ג: 3 }]);
  const wide = sectionFromRecords([{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }]);
  assert.equal(chooseOrientation([narrow]), 'portrait');
  assert.equal(chooseOrientation([wide]), 'landscape');
  assert.equal(chooseOrientation(sectionsFromGeneral(applyScope(mk(1, 1, 1), null))), 'portrait');
  assert.equal(chooseOrientation([narrow], 'landscape'), 'landscape');
  assert.equal(chooseOrientation([wide], 'portrait'), 'portrait');
});

// כלל ה"אין שורה חתוכה": סכום הגבהים בכל עמוד לא עולה על גובה הגוף, ושורה לעולם לא מפוצלת (היא פריט אחד)
const BODY = (o) => GEOMETRY_MM[o].h - 19 - 9 - 10 - 3;
function usedHeights(page) {
  return page.items.reduce((n, it) => n + ({ gap: 4, sec: 8.5, col: 7.5, note: 10, row: it.rowH }[it.t]), 0);
}

t('paginate: כל עמוד נכנס בגובה הגוף (לאורך ולרוחב), כל שורה מופיעה בדיוק פעם אחת, בסדר', () => {
  for (const o of ['portrait', 'landscape']) {
    const sections = sectionsFromGeneral(applyScope(mk(45, 50, 25), null));
    const pages = paginate(sections, o);
    pages.forEach((p, i) => assert.ok(usedHeights(p) <= BODY(o) + 1e-9, `${o} עמוד ${i + 1}: ${usedHeights(p)} > ${BODY(o)}`));
    const rows = pages.flatMap((p) => p.items.filter((x) => x.t === 'row'));
    assert.equal(rows.length, 120);
    assert.deepEqual(rows.map((r) => r.cells[0]), sections.flatMap((s) => s.rows.map((r) => r[0])));
  }
});

t('paginate: בכל עמוד שמתחיל בשורות נתונים יש לפניהן כותרת קטגוריה + כותרות עמודות (חוזרות עם "המשך")', () => {
  const pages = paginate(sectionsFromGeneral(applyScope(mk(45, 50, 25), null)), 'portrait');
  assert.ok(pages.length >= 5);
  pages.forEach((p, i) => {
    const first = p.items.findIndex((x) => x.t === 'row');
    assert.ok(first >= 2, `עמוד ${i + 1}`);
    assert.equal(p.items[first - 1].t, 'col');
    assert.equal(p.items[first - 2].t, 'sec');
    // עמוד שמתחיל באותה קטגוריה שבה הסתיים הקודם = "המשך"; קטגוריה חדשה בעמוד חדש = לא
    if (i > 0 && p.items[0].t === 'sec') {
      const prevRow = pages[i - 1].items.filter((x) => x.t === 'row').at(-1);
      assert.equal(p.items[0].cont, !!prevRow && prevRow.s === p.items[0].s, 'עמוד ' + (i + 1));
    }
  });
});

t('paginate: כותרת קטגוריה לא נשארת יתומה בתחתית עמוד (לפחות שתי שורות איתה)', () => {
  for (let n = 1; n < 40; n++) {
    const pages = paginate(sectionsFromGeneral(applyScope(mk(n, 6, 0), null)), 'portrait');
    pages.forEach((p) => {
      p.items.forEach((it, i) => {
        if (it.t === 'sec' && !it.cont) {
          const rowsAfter = p.items.slice(i + 2).filter((x) => x.t === 'row' && x.s === it.s).length;
          assert.ok(rowsAfter >= Math.min(2, it.s.rows.length), `n=${n}`);
        }
      });
    });
  }
});

t('paginate: שורות של שתי שורות טקסט (13.5 מ"מ) נספרות נכון, וההערה בסוף נכנסת', () => {
  const sec = sectionFromRecords(Array.from({ length: 40 }, (_, i) => ({ א: 'ערך ' + i, ב: 'y'.repeat(150) })));
  const pages = paginate([sec], 'portrait', { note: 'מוצגות 40 מתוך 99' });
  assert.ok(pages.every((p) => usedHeights(p) <= BODY('portrait') + 1e-9));
  assert.equal(pages.at(-1).items.at(-1).t, 'note');
  assert.ok(pages.flatMap((p) => p.items).filter((x) => x.t === 'row').every((r) => r.rowH === ROW_H.two));
});

t('buildSearchSheet: "עמוד X מתוך Y" בכל עמוד, כותרת בכל עמוד, תאריך עברי ושעה, שם גמ"ח, ללא JS וללא משאבים חיצוניים', () => {
  const sh = buildSearchSheet({ sections: sectionsFromGeneral(applyScope(mk(45, 50, 25), null)), query: 'כהן', gmach: 'גמ״ח בדיקה', scopeChip: '', now: NOW });
  assert.equal(sh.total, 120);
  assert.ok(sh.pages >= 5);
  for (let i = 1; i <= sh.pages; i++) assert.ok(sh.html.includes(`עמוד ${i} מתוך ${sh.pages}`), 'עמוד ' + i);
  assert.equal((sh.html.match(/<header class="hd">/g) || []).length, sh.pages);
  assert.equal((sh.html.match(/<footer class="ft">/g) || []).length, sh.pages);
  assert.ok(sh.html.includes('14:32') && sh.html.includes('גמ״ח בדיקה') && sh.html.includes('חיפוש: כהן'));
  assert.ok(!/<script|<link|src=|url\(/i.test(sh.html.replace(/@import url\([^)]*\);/, '')), 'אין סקריפט/קישור/משאב חיצוני');
  assert.ok(!/@import/.test(sh.html), 'בלי forServer אין @import');
  assert.match(sh.html, /@page\{size:A4 portrait;margin:10mm\}/);
  assert.equal(sh.fileName, 'תוצאות-חיפוש-כהן-כא-תשרי-תשפז');
  assert.equal(sh.landscape, false);
  assert.equal(sh.capped, false);
  assert.ok(!/var\(--/.test(sh.html), 'חלון הדפסה לא משתמש במשתני ערכת נושא');
});

t('buildSearchSheet: forServer מוסיף רק את Google Fonts (המותר ב-/api/pdf); לרוחב לטבלה רחבה', () => {
  const sec = sectionFromRecords([{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }]);
  const sh = buildSearchSheet({ sections: [sec], forServer: true, now: NOW });
  assert.ok(sh.html.includes("@import url('https://fonts.googleapis.com/"));
  assert.equal([...sh.html.matchAll(/https?:\/\/[^'")\s]+/g)].filter((m) => !/^https:\/\/fonts\.googleapis\.com\//.test(m[0])).length, 0);
  assert.equal(sh.landscape, true);
  assert.match(sh.html, /@page\{size:A4 landscape;margin:10mm\}/);
});

t('buildSearchSheet: הערת חיתוך כשיש יותר מ-500 שורות', () => {
  const sh = buildSearchSheet({ sections: sectionsFromGeneral(applyScope(mk(300, 300, 100), null)), now: NOW });
  assert.equal(sh.shown, 500);
  assert.equal(sh.total, 700);
  assert.equal(sh.capped, true);
  assert.ok(sh.html.includes('מוצגות 500 מתוך 700 תוצאות'));
});

t('buildSearchSheet: בריחה מ-HTML בכל שדה שמגיע מהמשתמש או מהנתונים (חיפוש, שם גמ"ח, תאים, כותרות עמודות)', () => {
  const evil = '<img src=x onerror=alert(1)>"&';
  const res = normalizeSearch({ customers: [{ id: 1, firstName: evil, lastName: 'א', phone1: '<b>1</b>', city: evil }], orders: [], rentals: [] });
  const sec = sectionFromRecords([{ [evil]: evil, ב: '</div><script>1</script>' }]);
  const sh = buildSearchSheet({ sections: [...sectionsFromGeneral(res), sec], query: evil, queryLabel: evil, scopeChip: evil, gmach: evil, title: evil, now: NOW });
  assert.ok(!sh.html.includes('<img'), 'תגית לא בורחת');
  assert.ok(!sh.html.includes('<script'), 'סקריפט לא בורח');
  assert.ok(!sh.html.includes('<b>1</b>'));
  assert.ok(sh.html.includes('&lt;img src=x onerror=alert(1)&gt;&quot;&amp;'));
  assert.ok(!/["<>]/.test(sh.fileName), 'שם הקובץ נקי');
});

t('buildSearchSheet: טקסט חיפוש ארוך נחתך, ולא נפלט CSS מהקלט (אין קלט משתמש בתוך <style>)', () => {
  const q = 'א'.repeat(300);
  const sh = buildSearchSheet({ sections: sectionsFromGeneral(applyScope(mk(1, 0, 0), null)), query: q, now: NOW });
  assert.ok(!sh.html.includes(q));
  assert.ok(sh.html.includes('א'.repeat(79) + '…'));
  const style = sh.html.slice(sh.html.indexOf('<style>'), sh.html.indexOf('</style>'));
  assert.ok(!style.includes('א'), 'ה-CSS קבוע ולא כולל טקסט מהמשתמש');
});

t('buildSearchSheet: מקטע בודד — סיכום "N לקוחות", סינון מוצג בתגית, ובלי תוצאות לא קורס', () => {
  const sh = buildSearchSheet({ sections: sectionsFromGeneral(applyScope(mk(5, 4, 3), 'customers')), scopeChip: 'רק בלקוחות', now: NOW });
  assert.ok(sh.html.includes('5 לקוחות') && sh.html.includes('רק בלקוחות'));
  assert.ok(!sh.html.includes('הזמנות'));
  const empty = buildSearchSheet({ sections: [], now: NOW });
  assert.equal(empty.pages, 1);
  assert.ok(empty.html.includes('אין תוצאות'));
});

console.log(`\n${passed} passed, ${failed} failed`);
