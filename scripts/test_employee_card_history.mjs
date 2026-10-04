// בדיקת יחידה להיסטוריית כרטיס העובד (lib/employeeCardHistory.js + app/api/employees/[id]/history/route.js):
// נרמול שורות יומן, שליחת מייל קריאה, שינויי הרשאה אישיים, שמות מבצעים, ובדיקות מקור לראוט (קריאה בלבד,
// אופציונלי, אותה הרשאה). לא נוגעת ב-DB / ברשת.
// הרצה: node scripts/test_employee_card_history.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHistoryRows } from '../lib/employeeCardHistory.js';

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const log = (over) => ({
  id: 'l1', entityType: 'Employee', entityId: 'e1', action: 'UPDATE',
  changesJson: '{}', createdAt: '2026-10-01T08:00:00.000Z', employeeId: 'a1', employeeName: 'דנה כהן',
  ...over,
});
const one = (over, opts) => buildHistoryRows([log(over)], opts)[0];
const json = JSON.stringify;

console.log('נרמול שורות עובד / משמרת');
await t('UPDATE רגיל {from,to} לכל שדה עם תוויות עבריות וצ\'יפ כחול', () => {
  const r = one({ changesJson: json({ hourlyWage: { from: 40, to: 45 }, city: { from: 'חיפה', to: 'לוד' } }) });
  assert.equal(r.action, 'UPDATE');
  assert.equal(r.actionLabel, 'עדכון');
  assert.equal(r.chipTone, 'blue');
  assert.equal(r.icon, 'user');
  assert.equal(r.entityLabel, 'עובד');
  assert.equal(r.changes.length, 2);
  assert.deepEqual(r.changes[0], { key: 'hourlyWage', label: 'שכר שעתי', from: '40', to: '45', long: false, kind: 'change' });
  assert.equal(r.firstChangeLabel, 'שכר שעתי ועוד 1');
  assert.equal(r.createdAt, '2026-10-01T08:00:00.000Z');
});
await t('צורת תמונת מצב ישנה של משמרת: CREATE {to:{...}} - מסתיר שדות טכניים ו-false ב-CREATE', () => {
  const r = one({
    entityType: 'Shift', action: 'CREATE',
    changesJson: json({ to: { id: 's1', employeeId: 'e1', legacyId: 5, updatedAt: 'x', date: '2026-10-01', entryTime: '08:00', isDeleted: false } }),
  });
  assert.equal(r.icon, 'clock');
  assert.equal(r.entityLabel, 'משמרת');
  assert.equal(r.chipTone, 'green');
  assert.equal(r.actionLabel, 'יצירה');
  assert.deepEqual(r.changes.map((c) => c.key), ['date', 'entryTime']);
  assert.ok(r.changes.every((c) => c.kind === 'value'));
});
await t('תמונת מצב ישנה UPDATE {from,to}: רק שדות שהשתנו בפועל', () => {
  const r = one({
    entityType: 'Shift',
    changesJson: json({ from: { id: 's1', exitTime: '16:00', totalMinutes: 480 }, to: { id: 's1', exitTime: '17:00', totalMinutes: 480 } }),
  });
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].label, 'שעת יציאה');
  assert.equal(r.changes[0].from, '16:00');
  assert.equal(r.changes[0].to, '17:00');
});
await t('הסתרת שדות טכניים בצורה שטוחה והשמטת ריק-לריק ושווה-לשווה', () => {
  const r = one({
    changesJson: json({
      id: 'x', employeeId: 'y', legacyId: 1, updatedAt: 'z',
      phone2: { from: null, to: '' },
      city: { from: 'חיפה', to: 'חיפה' },
      notes: { from: '', to: 'הערה חדשה' },
    }),
  });
  assert.deepEqual(r.changes.map((c) => c.key), ['notes']);
  assert.equal(r.changes[0].from, '-');
});
await t('בוליאני כן/לא, ריק "-", ו-DELETE {deleted:true} בלי פירוט', () => {
  const r = one({ changesJson: json({ isActive: { from: true, to: false }, phone1: { from: '050', to: null } }) });
  assert.equal(r.changes[0].from, 'כן');
  assert.equal(r.changes[0].to, 'לא');
  assert.equal(r.changes[1].to, '-');
  const d = one({ action: 'DELETE', changesJson: json({ deleted: true }) });
  assert.equal(d.chipTone, 'red');
  assert.equal(d.actionLabel, 'מחיקה');
  assert.deepEqual(d.changes, []);
  assert.equal(d.firstChangeLabel, '');
});
await t('טקסט ארוך מסומן long', () => {
  const r = one({ changesJson: json({ notes: { from: '', to: 'א'.repeat(120) } }) });
  assert.equal(r.changes[0].long, true);
});
await t('סיסמה גולמית מוסווית', () => {
  const r = one({ changesJson: json({ password: { from: 'abc', to: 'def' }, pinHash: 'hashhash' }) });
  const text = json(r);
  assert.ok(!text.includes('abc') && !text.includes('def') && !text.includes('hashhash'));
});

console.log('שליחת מייל');
const emailLog = (data) => ({ action: 'EMAIL_SENT', changesJson: typeof data === 'string' ? data : json(data) });
await t('EMAIL_SENT קריא (סדר העיצוב): נושא/אל/עותק/תוכן/יעד/קבצים/קישורי דרייב - בלי JSON, כתובות או גדלים', () => {
  const r = one(emailLog({
    subject: 'תלוש שכר', to: 'a@b.co', cc: 'c@d.co', body: 'שלום\nמצורף התלוש',
    sendMode: 'both',
    files: [{ fileName: 'a.pdf', sizeBytes: 123456, dest: 'email' }, { fileName: 'b.pdf', sizeBytes: 999777, dest: 'drive' }],
    driveLinks: [{ url: 'https://drive.google.com/file/d/SECRET1', fileName: 'b.pdf' }, { url: 'https://drive.google.com/file/d/SECRET2', fileName: 'c.pdf' }],
  }));
  assert.equal(r.icon, 'mail');
  assert.equal(r.chipTone, 'gray');
  assert.equal(r.actionLabel, 'שליחת מייל');
  assert.deepEqual(r.changes.map((c) => c.label), ['נושא', 'אל', 'עותק', 'תוכן', 'יעד הקבצים', 'קבצים', 'קישורי דרייב']);
  const by = Object.fromEntries(r.changes.map((c) => [c.key, c]));
  assert.equal(by.body.long, true);
  assert.equal(by.sendMode.to, 'גם וגם');
  assert.equal(by.files.to, 'a.pdf, b.pdf');
  assert.equal(by.driveLinks.to, '2 קישורים');
  const text = json(r);
  assert.ok(!text.includes('http') && !text.includes('SECRET') && !text.includes('123456') && !text.includes('sizeBytes'));
  assert.ok(!r.changes.some((c) => String(c.to).trim().startsWith('{') || String(c.to).trim().startsWith('[')));
});
await t('מצבי שליחה: email / drive / לא מוכר', () => {
  const mode = (m) => one(emailLog({ to: 'a@b.co', sendMode: m })).changes.find((c) => c.key === 'sendMode')?.to;
  assert.equal(mode('email'), 'צרופה למייל');
  assert.equal(mode('drive'), 'העלאה לדרייב + שיתוף');
  assert.equal(mode('both'), 'גם וגם');
});
await t('קישור דרייב בודד, שדות חסרים מושמטים', () => {
  const r = one(emailLog({ to: 'a@b.co', driveLinks: [{ url: 'https://x' }] }));
  assert.deepEqual(r.changes.map((c) => c.key), ['to', 'driveLinks']);
  assert.equal(r.changes[1].to, '1 קישור');
});
await t('JSON פגום / לא אובייקט / null: לא זורק, שורה בלי פירוט', () => {
  for (const bad of ['{not json', '"str"', 'null', '[1,2]', '', null, undefined]) {
    const r = one({ action: 'EMAIL_SENT', changesJson: bad });
    assert.deepEqual(r.changes, []);
    const g = one({ changesJson: bad });
    assert.deepEqual(g.changes, []);
    const p = one({ entityType: 'EmployeePermissionOverride', changesJson: bad });
    assert.equal(p.icon, 'shield');
  }
  assert.deepEqual(buildHistoryRows(null), []);
  assert.deepEqual(buildHistoryRows([null, 5]), []);
});

console.log('שינויי הרשאה');
const permLog = (over) => ({ entityType: 'EmployeePermissionOverride', entityId: 'o1', ...over });
const labels = (key) => ({ 'page:orders': 'הזמנות', 'feature:export_max_rows': 'מקסימום שורות בייצוא' }[key] || key);
await t('הגדרה ל-true (CREATE של שורת חריגה): מותר + תווית מהקטלוג', () => {
  const r = one(permLog({ action: 'CREATE', changesJson: json({ id: 'o1', employeeId: 'e1', key: 'page:orders', value: 'true', note: null }) }), { catalogLabel: labels });
  assert.equal(r.entityLabel, 'הרשאה');
  assert.equal(r.icon, 'shield');
  assert.equal(r.chipTone, 'blue');
  assert.equal(r.actionLabel, 'שינוי הרשאה');
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].label, 'הזמנות');
  assert.equal(r.changes[0].to, 'מותר');
  assert.equal(r.firstChangeLabel, 'הזמנות');
  assert.ok(!json(r).includes('employeeId'));
});
await t('הגדרה ל-false (UPDATE) - לא מותר, מפתח משלים משורת CREATE של אותה חריגה', () => {
  const rows = buildHistoryRows([
    permLog({ id: 'u', action: 'UPDATE', changesJson: json({ value: 'false' }) }),
    permLog({ id: 'c', action: 'CREATE', changesJson: json({ key: 'page:orders', value: 'true' }) }),
  ], { catalogLabel: labels });
  assert.equal(rows[0].changes[0].label, 'הזמנות');
  assert.equal(rows[0].changes[0].to, 'לא מותר');
});
await t('מספרי (feature:export_max_rows) מוצג כמספר; {set} ו-{from,to} נתמכים', () => {
  const a = one(permLog({ action: 'UPDATE', changesJson: json({ key: 'feature:export_max_rows', value: { set: '500' } }) }), { catalogLabel: labels });
  assert.equal(a.changes[0].label, 'מקסימום שורות בייצוא');
  assert.equal(a.changes[0].to, '500');
  const b = one(permLog({ action: 'UPDATE', changesJson: json({ key: 'page:orders', value: { from: 'false', to: 'true' } }) }), { catalogLabel: labels });
  assert.equal(b.changes[0].kind, 'change');
  assert.equal(b.changes[0].from, 'לא מותר');
  assert.equal(b.changes[0].to, 'מותר');
});
await t('הסרת חריגה (DELETE): טקסט חזרה לברירת המחדל; ללא מפתח - "הרשאה אישית"', () => {
  const r = one(permLog({ action: 'DELETE', changesJson: json({ deleted: true }) }));
  assert.equal(r.actionLabel, 'הסרת חריגת הרשאה');
  assert.equal(r.chipTone, 'blue');
  assert.equal(r.changes[0].label, 'הרשאה אישית');
  assert.equal(r.changes[0].to, 'חריגה אישית הוסרה (חזרה לברירת המחדל של המחלקה)');
  const withKey = buildHistoryRows([
    permLog({ id: 'd', action: 'DELETE', changesJson: json({ deleted: true }) }),
    permLog({ id: 'c', action: 'CREATE', changesJson: json({ key: 'page:orders', value: 'true' }) }),
  ], { catalogLabel: labels });
  assert.equal(withKey[0].changes[0].label, 'הזמנות');
});
await t('פורמט הכתיבה המתועדת מהכרטיס (EC-06): {employeeId,key,value:{from,to}} - שינוי, יצירה והסרה עם מפתח', () => {
  const cat = (k) => ({ 'feature:ai': 'שימוש בבינה מלאכותית' }[k]);
  const upd = one({ entityType: 'EmployeePermissionOverride', entityId: 'p1', changesJson: json({ employeeId: 'e1', key: 'feature:ai', value: { from: true, to: false } }) }, { catalogLabel: cat });
  assert.equal(upd.entityLabel, 'הרשאה');
  assert.deepEqual(upd.changes.map((c) => [c.label, c.from, c.to, c.kind]), [['שימוש בבינה מלאכותית', 'מותר', 'לא מותר', 'change']]);
  const cre = one({ action: 'CREATE', entityType: 'EmployeePermissionOverride', entityId: 'p1', changesJson: json({ employeeId: 'e1', key: 'feature:ai', value: { from: null, to: true } }) }, { catalogLabel: cat });
  assert.deepEqual(cre.changes.map((c) => [c.label, c.to]), [['שימוש בבינה מלאכותית', 'מותר']]);
  const del = one({ action: 'DELETE', entityType: 'EmployeePermissionOverride', entityId: 'p1', changesJson: json({ employeeId: 'e1', key: 'feature:ai', value: { from: false, to: null }, removed: true }) }, { catalogLabel: cat });
  assert.equal(del.changes[0].label, 'שימוש בבינה מלאכותית');
  assert.ok(/הוסרה/.test(del.changes[0].to));
});
await t('ברירת מחדל של catalogLabel היא המפתח; catalogLabel שזורק לא שובר', () => {
  const r = one(permLog({ action: 'CREATE', changesJson: json({ key: 'page:x', value: 'true' }) }));
  assert.equal(r.changes[0].label, 'page:x');
  const r2 = one(permLog({ action: 'CREATE', changesJson: json({ key: 'page:x', value: 'true' }) }), { catalogLabel: () => { throw new Error('boom'); } });
  assert.equal(r2.changes[0].label, 'page:x');
});

console.log('שמות מבצעים');
await t('בלי מבצע = מערכת; מזהה בלי שם = עובד שנמחק; עם שם = השם', () => {
  assert.equal(one({ employeeId: null, employeeName: null }).actorName, 'מערכת');
  assert.equal(one({ employeeId: 'zzz', employeeName: null }).actorName, 'עובד שנמחק');
  assert.equal(one({ employeeId: 'a1', employeeName: 'דנה כהן' }).actorName, 'דנה כהן');
});
await t('תאריך Date מומר ל-ISO ותאריך לא תקין לא זורק', () => {
  assert.equal(one({ createdAt: new Date('2026-10-02T10:00:00Z') }).createdAt, '2026-10-02T10:00:00.000Z');
  assert.doesNotThrow(() => one({ createdAt: 'garbage' }));
  assert.equal(one({ createdAt: null }).createdAt, null);
});

console.log('בדיקות מקור לראוט');
const routeSrc = readFileSync(new URL('../app/api/employees/[id]/history/route.js', import.meta.url), 'utf8');
const codeOnly = routeSrc.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
await t('נשמרת ההרשאה checkAuth(\'הנהלה ראשית\')', () => {
  assert.ok(routeSrc.includes("checkAuth('הנהלה ראשית')"));
});
await t('הראוט קורא בלבד: אין create/update/delete/upsert על prisma ואין כתיבת AuditLog', () => {
  assert.ok(!/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/.test(codeOnly));
  assert.ok(!codeOnly.includes('prisma.auditLog.create'));
  assert.ok(!routeSrc.includes('prisma.auditLog.create'));
  assert.ok(!routeSrc.includes('$executeRaw'));
});
await t('ההרחבה אופציונלית (?extended=1) ושמות עדיין עוברים דרך attachEmployeeNames', () => {
  assert.ok(/searchParams\.get\('extended'\)\s*===\s*'1'/.test(codeOnly));
  assert.ok(codeOnly.includes('attachEmployeeNames(history)'));
  assert.ok(codeOnly.includes('take: 100'));
  assert.ok(codeOnly.includes('EmployeePermissionOverride'));
});

console.log(`\n${passed} בדיקות עברו${process.exitCode ? ' - יש כישלונות' : ''}`);
