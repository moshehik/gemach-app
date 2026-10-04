// בדיקת יחידה לכרטיס העובד (lib/employeeCardSave.js + lib/roles.js): כישלון שמירה לא מוצג כהצלחה,
// סיבת השרת מוצגת בעברית, והחלטת "מי רשאי לשנות סיסמה של מי". לא נוגעת ב-DB / ברשת.
// הרצה: node scripts/test_employee_card_save.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  reasonForStatus, serverReason, failureMessage, requestJson, describeFailure, decidePasswordChangeMode,
} from '../lib/employeeCardSave.js';
import { HEAD_MANAGEMENT_ROLES, canManageRoles } from '../lib/roles.js';

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const fakeRes = (status, body, { json = true } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => { if (!json) throw new SyntaxError('Unexpected token <'); return body; },
});
const fakeFetch = (res) => async () => res;

console.log('serverReason / failureMessage');
await t('הודעה בעברית מהשרת (error) מוצגת כמו שהיא', () => {
  assert.equal(serverReason({ error: 'אין הרשאה לערוך עובד או להגדיר תפקיד בכיר מהתפקיד שלך' }, 403),
    'אין הרשאה לערוך עובד או להגדיר תפקיד בכיר מהתפקיד שלך');
});
await t('הודעה בעברית מהשרת (message) מוצגת', () => {
  assert.equal(serverReason({ success: false, message: 'הסיסמה הישנה אינה נכונה' }, 401), 'הסיסמה הישנה אינה נכונה');
});
await t('הודעה באנגלית (Forbidden / Internal Server Error) מוחלפת בהסבר עברי לפי הסטטוס', () => {
  assert.equal(serverReason({ error: 'Forbidden' }, 403), 'אין הרשאה לבצע את הפעולה');
  assert.equal(serverReason({ error: 'Internal Server Error' }, 500), 'שגיאת שרת - ננסה שוב בעוד רגע');
  assert.equal(serverReason({ error: 'Unauthorized' }, 401), 'פג תוקף ההתחברות - יש להתחבר מחדש');
});
await t('גוף ריק / לא אובייקט: ברירת מחדל לפי סטטוס', () => {
  assert.equal(serverReason(null, 404), 'הרשומה לא נמצאה');
  assert.equal(serverReason(undefined, 418), 'הפעולה נכשלה');
  assert.equal(reasonForStatus(503), 'שגיאת שרת - ננסה שוב בעוד רגע');
});
await t('failureMessage: פעולה + סיבה', () => {
  assert.equal(failureMessage('שמירת הפרטים נכשלה', { error: 'Forbidden' }, 403), 'שמירת הפרטים נכשלה: אין הרשאה לבצע את הפעולה');
});

console.log('requestJson (res.ok הוא הקובע)');
await t('403 עם גוף שגיאה = לא ok, והסיבה נשמרת', async () => {
  const r = await requestJson('/x', {}, fakeFetch(fakeRes(403, { error: 'אין הרשאה לערוך עובד' })));
  assert.equal(r.ok, false); assert.equal(r.status, 403);
  assert.equal(describeFailure('שמירת הפרטים נכשלה', r), 'שמירת הפרטים נכשלה: אין הרשאה לערוך עובד');
});
await t('500 עם גוף JSON אנגלי: לא ok, הודעה עברית', async () => {
  const r = await requestJson('/x', {}, fakeFetch(fakeRes(500, { error: 'Internal Server Error' })));
  assert.equal(r.ok, false);
  assert.equal(describeFailure('שמירת הפרטים נכשלה', r), 'שמירת הפרטים נכשלה: שגיאת שרת - ננסה שוב בעוד רגע');
});
await t('500 עם דף HTML (JSON.parse נכשל): לא זורק, לא ok', async () => {
  const r = await requestJson('/x', {}, fakeFetch(fakeRes(500, null, { json: false })));
  assert.equal(r.ok, false); assert.deepEqual(r.data, {});
});
await t('200 תקין = ok', async () => {
  const r = await requestJson('/x', {}, fakeFetch(fakeRes(200, { id: 'e1' })));
  assert.equal(r.ok, true); assert.equal(r.data.id, 'e1');
});
await t('200 עם success:false (נתיבי סיסמה) עדיין כישלון', async () => {
  const r = await requestJson('/x', {}, fakeFetch(fakeRes(200, { success: false, message: 'סיבה' })));
  assert.equal(r.ok, false);
});
await t('200 עם success:true = ok', async () => {
  assert.equal((await requestJson('/x', {}, fakeFetch(fakeRes(200, { success: true })))).ok, true);
});
await t('שגיאת רשת (fetch זורק): לא ok, הודעת תקשורת', async () => {
  const r = await requestJson('/x', {}, async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(r.ok, false); assert.equal(r.networkError, true);
  assert.match(describeFailure('שמירת הפרטים נכשלה', r), /אין תקשורת עם השרת/);
});

console.log('decidePasswordChangeMode');
const HEAD = { id: 'h', roleId: 0 };
const DEV = { id: 'p', roleId: 2 };
const BRANCH = { id: 'b', roleId: 1 };
const EMP = { id: 'e', roleId: null };
await t('שינוי עצמי: mode=self (בלי קשר לתפקיד)', () => {
  assert.equal(decidePasswordChangeMode({ sessionEmployeeId: 'e', targetId: 'e', actor: null, target: EMP }).mode, 'self');
});
await t('הנהלה ראשית משנה סיסמה לעובד רגיל / מנהל סניף: manager', () => {
  assert.equal(decidePasswordChangeMode({ sessionEmployeeId: 'h', targetId: 'e', actor: HEAD, target: EMP }).mode, 'manager');
  assert.equal(decidePasswordChangeMode({ sessionEmployeeId: 'h', targetId: 'b', actor: HEAD, target: BRANCH }).mode, 'manager');
});
await t('מתכנת משנה סיסמה לכולם (גם להנהלה ראשית ולמתכנת אחר): manager', () => {
  assert.equal(decidePasswordChangeMode({ sessionEmployeeId: 'p', targetId: 'h', actor: DEV, target: HEAD }).mode, 'manager');
  assert.equal(decidePasswordChangeMode({ sessionEmployeeId: 'p', targetId: 'p2', actor: DEV, target: { roleId: 2 } }).mode, 'manager');
});
await t('הנהלה ראשית לא משנה סיסמה למתכנת (העלאת סמכויות): 403', () => {
  const d = decidePasswordChangeMode({ sessionEmployeeId: 'h', targetId: 'p', actor: HEAD, target: DEV });
  assert.equal(d.mode, 'deny'); assert.equal(d.status, 403);
});
await t('עובד רגיל לא משנה סיסמה של אחר: 403', () => {
  const d = decidePasswordChangeMode({ sessionEmployeeId: 'e', targetId: 'x', actor: EMP, target: { roleId: null } });
  assert.equal(d.mode, 'deny'); assert.equal(d.status, 403);
});
await t('מנהל סניף (roleId 1) לא משנה סיסמה של אחר בנתיב הזה: 403 (יש לו "קבע סיסמה ידנית" עם קוד מנהל)', () => {
  const d = decidePasswordChangeMode({ sessionEmployeeId: 'b', targetId: 'e', actor: BRANCH, target: EMP });
  assert.equal(d.mode, 'deny'); assert.equal(d.status, 403);
});
await t('בלי משתמש מחובר מזוהה: 401; בלי יעד: 404 (רק למנהל מורשה)', () => {
  assert.equal(decidePasswordChangeMode({ sessionEmployeeId: null, targetId: 'e', actor: null, target: EMP }).status, 401);
  assert.equal(decidePasswordChangeMode({ sessionEmployeeId: 'h', targetId: 'zzz', actor: HEAD, target: null }).status, 404);
  // עובד רגיל מול יעד לא קיים לא מקבל 404 (לא חושף אילו מזהים קיימים)
  assert.equal(decidePasswordChangeMode({ sessionEmployeeId: 'e', targetId: 'zzz', actor: EMP, target: null }).status, 403);
});
await t('עוגייה ריקה לא נחשבת "עצמי" גם כשה-id ריק', () => {
  assert.notEqual(decidePasswordChangeMode({ sessionEmployeeId: undefined, targetId: undefined, actor: null, target: null }).mode, 'self');
});
await t('סולם ההרשאות ב-roles.js: HEAD_MANAGEMENT_ROLES=[0,2], canManageRoles כמו קודם', () => {
  assert.deepEqual(HEAD_MANAGEMENT_ROLES, [0, 2]);
  assert.equal(canManageRoles(0, 1), true);
  assert.equal(canManageRoles(0, 2), false);
  assert.equal(canManageRoles(1, 0), false);
  assert.equal(canManageRoles(2, 0, 1, null), true);
});

console.log('הנתיב והעמוד (בדיקת מקור)');
const routeSrc = readFileSync(new URL('../app/api/employees/[id]/password/route.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../app/employees/[id]/page.js', import.meta.url), 'utf8');
await t('נתיב הסיסמה: סיסמה מגובבת (hashSecret), אימות סיסמת המנהל, ושום סיסמה לא נרשמת ללוג', () => {
  assert.match(routeSrc, /hashSecret\(newPassword\)/);
  assert.match(routeSrc, /verifySecret\(managerPassword/);
  assert.doesNotMatch(routeSrc, /console\.(log|error)\([^)]*(newPassword|oldPassword|managerPassword)/);
});
await t('נתיב הסיסמה: ערכי סיסמה שאינם מחרוזת נדחים (400) לפני בדיקת האורך', () => {
  const i = routeSrc.indexOf("typeof v !== 'string'");
  assert.ok(i > 0 && i < routeSrc.indexOf('newPassword.length < 4'));
});
await t('העמוד: אין window.alert / alert ישירים, ואין fetch חשוף לנתיבי העובד', () => {
  assert.doesNotMatch(pageSrc, /(^|[^.\w])alert\(/m);
  assert.doesNotMatch(pageSrc, /window\.alert\(/);
  assert.doesNotMatch(pageSrc, /await fetch\(`\/api\/employees/);
  assert.ok((pageSrc.match(/requestJson\(/g) || []).length >= 7);
});
await t('העמוד: הצלחת שמירה מוצגת רק אחרי בדיקת result.ok', () => {
  const i = pageSrc.indexOf("notifySuccess('הפרטים נשמרו בהצלחה!')");
  const j = pageSrc.indexOf('if (!result.ok)');
  assert.ok(i > 0 && j > 0 && j < i, 'הבדיקה חייבת לבוא לפני הודעת ההצלחה');
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
