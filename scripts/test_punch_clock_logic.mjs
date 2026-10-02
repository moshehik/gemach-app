// בדיקות ללוגיקה הטהורה של שעון הנוכחות בעיצוב החדש (lib/punchClockFlow.js) + שומרי מקור שההתנהגות לא השתנתה.
// הרצה: node scripts/test_punch_clock_logic.mjs   (רץ בכמה אזורי זמן; יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import {
  PUNCH_ACTION, PUNCH_MESSAGES, validatePunchForm, punchErrorInfo, laundressCheckEnabled, overdueOrders,
  overdueConfirmText, formatIsraelClock, formatShiftDuration, punchOutMessage, punchDoneInfo,
} from '../lib/punchClockFlow.js';
import { LOGIN_MESSAGES } from '../lib/loginFlow.js';

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const TIMEZONES = ['UTC', 'America/Los_Angeles', 'Asia/Jerusalem'];

if (!process.env.PUNCH_LOGIC_CHILD) {
  let failed = false;
  for (const tz of TIMEZONES) {
    console.log(`\n=== TZ=${tz} ===`);
    const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: tz, PUNCH_LOGIC_CHILD: '1', NODE_NO_WARNINGS: '1' }, stdio: 'inherit',
    });
    if (res.status !== 0) failed = true;
  }
  console.log(failed ? '\nFAILED' : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
}

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

t('הפעולות הן בדיוק IN / OUT (מה ש-POST /api/attendance מקבל)', () => {
  assert.deepEqual({ ...PUNCH_ACTION }, { IN: 'IN', OUT: 'OUT' });
});

t('אימות: שדות ריקים / עובד לא ברשימה / בלי סיסמה - בניסוח של הכניסה, עם הודעת "נוכחות"', () => {
  assert.deepEqual(validatePunchForm({ userText: '', employeeId: null, credential: '' }), { field: 'user', message: PUNCH_MESSAGES.bothMissing });
  assert.equal(validatePunchForm({ userText: '', employeeId: null, credential: 'x' }).message, LOGIN_MESSAGES.userMissing);
  assert.equal(validatePunchForm({ userText: 'שרה', employeeId: null, credential: 'x' }).message, LOGIN_MESSAGES.userNotFound);
  assert.equal(validatePunchForm({ userText: 'שרה', employeeId: null, credential: 'x', listLoaded: false }).message, LOGIN_MESSAGES.loading);
  assert.deepEqual(validatePunchForm({ userText: 'שרה כהן', employeeId: 'e1', credential: '' }), { field: 'pass', message: LOGIN_MESSAGES.passMissing });
  assert.equal(validatePunchForm({ userText: 'שרה כהן', employeeId: 'e1', credential: '1234' }), null);
  // קוד מקוצר = אותו שדה, בלי מגבלת אורך בלקוח (השרת מחליט): סיסמה ארוכה וקוד של 4 תווים שניהם תקינים לאימות
  assert.equal(validatePunchForm({ userText: 'שרה כהן', employeeId: 'e1', credential: 'a-long-password-123' }), null);
});

t('שגיאת שרת: עברית מוצגת כמו שהיא, טכנית באנגלית מוחלפת; 401 מסמן את שדה הסיסמה', () => {
  assert.deepEqual(punchErrorInfo(401, { error: 'סיסמה שגויה' }), { field: 'pass', message: 'סיסמה שגויה' });
  assert.equal(punchErrorInfo(401, { error: 'קוד מקוצר אפשרי רק ממחשב מערכת מהימן - יש להזין את הסיסמה המלאה' }).field, 'pass');
  assert.deepEqual(punchErrorInfo(400, { error: 'כבר נרשמה כניסה - יש לרשום יציאה קודם' }), { field: null, message: 'כבר נרשמה כניסה - יש לרשום יציאה קודם' });
  assert.equal(punchErrorInfo(400, { error: 'לא נמצאה משמרת פתוחה לרישום יציאה' }).field, null);
  assert.deepEqual(punchErrorInfo(403, { error: 'חשבון העובד אינו פעיל' }), { field: null, message: 'חשבון העובד אינו פעיל' });
  assert.deepEqual(punchErrorInfo(500, { error: 'Internal Server Error' }), { field: null, message: PUNCH_MESSAGES.generic });
  assert.deepEqual(punchErrorInfo(500, null), { field: null, message: PUNCH_MESSAGES.generic });
  assert.deepEqual(punchErrorInfo(401, {}), { field: 'pass', message: PUNCH_MESSAGES.generic });
});

t('כובסת ביציאה: ההגדרה, סינון ההזמנות והנוסח - כמו במסך הישן', () => {
  assert.equal(laundressCheckEnabled([{ key: 'laundress_return_check_on_exit', value: 'true' }]), true);
  assert.equal(laundressCheckEnabled([{ key: 'laundress_return_check_on_exit', value: 'false' }]), false);
  assert.equal(laundressCheckEnabled([{ key: 'other', value: 'true' }]), false);
  assert.equal(laundressCheckEnabled({ error: 'x' }), false);
  assert.equal(laundressCheckEnabled(null), false);
  const resp = { data: [
    { customerName: 'לוי', items: [{ isTaken: true, isReturned: false, isDeleted: false }] },
    { customerName: 'כהן', items: [{ isTaken: true, isReturned: true }] },
    { customerName: 'מזרחי', items: [{ isTaken: true, isReturned: false, isDeleted: true }] },
    { customerName: 'פרץ', items: [{ isTaken: false }] },
    { customerName: 'ללא פריטים' },
  ] };
  assert.deepEqual(overdueOrders(resp).map((o) => o.customerName), ['לוי']);
  assert.deepEqual(overdueOrders({}), []);
  assert.deepEqual(overdueOrders(null), []);
  const many = Array.from({ length: 7 }, (_, i) => ({ customerName: i === 1 ? '' : `ל${i}` }));
  assert.equal(overdueConfirmText(many), 'יש 7 משפחות שלא החזירו (לדוגמה: ל0, ?, ל2, ל3, ל4). האם לוודא שהן אכן לא החזירו?');
});

t('שעון ישראל HH:MM:SS - בלי תלות באזור הזמן של המחשב (קיץ וחורף)', () => {
  assert.equal(formatIsraelClock(new Date('2026-07-01T09:05:07Z')), '12:05:07'); // קיץ UTC+3
  assert.equal(formatIsraelClock(new Date('2026-01-01T09:05:07Z')), '11:05:07'); // חורף UTC+2
  assert.equal(formatIsraelClock(new Date('2026-07-01T21:00:00Z')), '00:00:00'); // חצות בישראל
  assert.equal(formatIsraelClock('nope'), '');
});

t('משך משמרת בעברית פשוטה (יחיד / זוגי / רבים)', () => {
  assert.equal(formatShiftDuration(0), 'פחות מדקה');
  assert.equal(formatShiftDuration(1), 'דקה אחת');
  assert.equal(formatShiftDuration(2), 'שתי דקות');
  assert.equal(formatShiftDuration(45), '45 דקות');
  assert.equal(formatShiftDuration(60), 'שעה אחת');
  assert.equal(formatShiftDuration(120), 'שעתיים');
  assert.equal(formatShiftDuration(125), 'שעתיים ו-5 דקות');
  assert.equal(formatShiftDuration(61), 'שעה אחת ודקה אחת');
  assert.equal(formatShiftDuration(122), 'שעתיים ושתי דקות');
  assert.equal(formatShiftDuration(493), '8 שעות ו-13 דקות');
  assert.equal(formatShiftDuration(480), '8 שעות');
  for (const bad of [null, undefined, '', 'x', -5, NaN]) assert.equal(formatShiftDuration(bad), null, String(bad));
});

t('מסך האישור: כניסה = "נרשמה התחלת עבודה ב-HH:MM" (כמו הכניסה), יציאה = סיום + משך', () => {
  const inInfo = punchDoneInfo({ action: 'IN', firstName: ' שרה ', shift: { entryTime: '2026-07-01T05:30:00.000Z' }, now: new Date('2026-07-01T05:31:00Z') });
  assert.deepEqual(inInfo, { title: 'הכניסה נרשמה, שרה', clk: 'נרשמה התחלת עבודה ב-08:30', note: '' });
  const outInfo = punchDoneInfo({ action: 'OUT', firstName: 'שרה', shift: { entryTime: '2026-07-01T05:30:00.000Z', exitTime: '2026-07-01T14:03:00.000Z', totalMinutes: 513 }, now: new Date() });
  assert.deepEqual(outInfo, { title: 'היציאה נרשמה, שרה', clk: 'נרשמה סיום עבודה ב-17:03', note: 'משך המשמרת: 8 שעות ו-33 דקות' });
  // בלי shift בתשובה / בלי שם: נופל לשעה הנוכחית ולכותרת בלי שם
  const bare = punchDoneInfo({ action: 'IN', shift: undefined, now: new Date('2026-01-01T09:00:00Z') });
  assert.deepEqual(bare, { title: 'הכניסה נרשמה', clk: 'נרשמה התחלת עבודה ב-11:00', note: '' });
  assert.equal(punchDoneInfo({ action: 'OUT', firstName: 'דנה', shift: { exitTime: '2026-01-01T09:00:00Z' } }).note, '');
  assert.equal(punchOutMessage('garbage'), 'נרשמה סיום עבודה');
});

console.log('שומרי מקור: אותן קריאות, אותו מתג, אותו כלל מעטפת');
t('PunchClockNew שולח { employeeId, password, action } ל-POST /api/attendance ומשאיר את כל ההכרעות לשרת', () => {
  const page = src('../app/components/login/PunchClockNew.js');
  assert.ok(page.includes("fetch('/api/attendance'"), 'POST /api/attendance');
  assert.ok(/body: JSON\.stringify\(\{ employeeId: String\(emp\.id\), password, action \}\)/.test(page), 'גוף הבקשה');
  assert.ok(page.includes("fetch('/api/auth/device-status'") && page.includes("fetchSharedJson('/api/employees'"));
  assert.ok(page.includes("fetch('/api/settings'") && page.includes("fetch('/api/orders?filterStatus=archive&limit=50'"), 'בדיקת כובסת');
  assert.ok(!/loginPage|\/api\/login|pinMode|maxLength=\{4\}/.test(page), 'אין כאן מצב קוד נפרד ואין קריאה ל-/api/login: השרת מכבד קוד מקוצר רק במחשב מהימן');
});
t('הדף נבחר לפי login_page_new (אותו מתג כמו הכניסה); כבוי = הדף הישן; ה-layout מציג דף מלא רק כשהמתג דלוק', () => {
  const page = src('../app/punch-clock/page.js');
  assert.ok(page.includes('useLoginVariant') && /useNew === false\) return <PunchClockLegacy/.test(page));
  const layout = src('../app/layout.js');
  assert.ok(layout.includes('const punchBare = isPunchClock && loginVariant.useNew;'));
  assert.ok(layout.includes("settingValue('login_page_new') !== 'false'"), 'המתג של הכניסה לא השתנה');
  assert.ok(layout.includes('const showLogin = requireLogin && !isAuthenticated && !isPublicKiosk && !isPunchClock;'), '/punch-clock נשאר נגיש בלי כניסה');
  assert.ok(/punchBare \? \(\s*<LabelsProvider>\s*<PopupProvider>\s*\{children\}/.test(layout));
});
t('הדף הישן נשמר כמו שהיה (אותן קריאות ואותן הודעות)', () => {
  const old = src('../app/punch-clock/PunchClockLegacy.js');
  assert.ok(old.includes("'אנא בחר עובד והזן סיסמא'") && old.includes("fetch('/api/attendance'") && old.includes('window.customConfirm'));
});
t('שעון הנוכחות עדיין מוחרג מהמעטפת החדשה (lib/uiVariant.js) ולא הוסר מהקישורים של דף הכניסה', () => {
  assert.ok(src('../lib/uiVariant.js').includes("'/punch-clock'"));
  assert.ok(src('../app/components/login/LoginNew.js').includes('href="/punch-clock"'));
  assert.ok(src('../app/components/LoginScreen.js').includes('href="/punch-clock"'));
});

console.log(`\n[TZ=${process.env.TZ}] ${passed} בדיקות עברו${process.exitCode ? ', יש כישלונות' : ''}`);
