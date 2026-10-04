// בדיקת יחידה ללוגיקה הטהורה של דף הכניסה החדש (lib/loginFlow.js, lib/orgIdentity.js, lib/designPrefsSchema.js).
// לא נוגעת ב-DB, ברשת וב-DOM. הרצה: node scripts/test_login_logic.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// הסקריפט מריץ את עצמו מחדש תחת כמה אזורי זמן (TZ) - הברכה, "משמרת מאתמול" ושעת היציאה חייבות להיות לפי
// שעון ישראל בלי קשר למכונה (Vercel = UTC).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  greetingForHour, israelHour, greetingNow, formatIsraelHHMM, GREETING_MORNING, GREETING_EVENING,
  sanitizeReturnPath,
  isSharedComputer, addEmployeeKeyToDevice, SHARED_COMPUTER_THRESHOLD, DEVICE_EMPLOYEE_KEYS_CAP,
  classifyOpenShift, decideAutoShift, SHIFT_ACTION, punchInMessage, previousShiftPrompt, resolvePreviousShiftExit, PREVIOUS_SHIFT_MESSAGES,
  autoClockInFromRaw, withAutoClockIn, autoClockInFromPrefs,
  brandBar, MAIN_GEMACH_TAG, DEFAULT_GEMACH_NAME,
  validateLoginForm, LOGIN_MESSAGES, filterEmployees, matchEmployeeByName, employeeDisplayName, doneTitle, unreadMessagesText,
} from '../lib/loginFlow.js';
import { detectOrgFromHost, currentOrg, isMainGemach, ORG_MAIN, ORG_NEVE_YAAKOV } from '../lib/orgIdentity.js';
import { parseStoredDesignPrefs, mergeDesignPrefs, sanitizeDesignPrefs } from '../lib/designPrefsSchema.js';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { createSessionToken, verifySessionToken, checkAuthCore, SESSION_FRESH_MS } = require('../lib/authTokens.js');
const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const TIMEZONES = ['UTC', 'America/Los_Angeles', 'Asia/Jerusalem', 'Pacific/Kiritimati'];

if (!process.env.LOGIN_LOGIC_CHILD) {
  let failed = false;
  for (const tz of TIMEZONES) {
    console.log(`\n=== TZ=${tz} ===`);
    const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: tz, LOGIN_LOGIC_CHILD: '1', NODE_NO_WARNINGS: '1' },
      stdio: 'inherit',
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
// בדיקה אסינכרונית אחת (checkAuthCore) - נקראת עם await ברמה העליונה כדי שהסיכום יודפס אחריה.
async function ta(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

// 2026-07-15 (קיץ, UTC+3) ו-2026-01-15 (חורף, UTC+2)
const summer = (h, m = 0) => new Date(Date.UTC(2026, 6, 15, h - 3, m)); // שעה h בשעון ישראל בקיץ
const winter = (h, m = 0) => new Date(Date.UTC(2026, 0, 15, h - 2, m));

console.log('ברכה (L10)');
t('5:00-15:59 בוקר טוב, אחרת ערב טוב', () => {
  assert.equal(greetingForHour(5), GREETING_MORNING);
  assert.equal(greetingForHour(15), GREETING_MORNING);
  assert.equal(greetingForHour(16), GREETING_EVENING);
  assert.equal(greetingForHour(4), GREETING_EVENING);
  assert.equal(greetingForHour(23), GREETING_EVENING);
  assert.equal(greetingForHour(0), GREETING_EVENING);
  assert.equal(greetingForHour('x'), GREETING_MORNING);
});
t('השעה לפי ישראל ולא לפי המכונה (קיץ וחורף, סביב חצות)', () => {
  assert.equal(israelHour(summer(7)), 7);
  assert.equal(israelHour(summer(23, 30)), 23);
  assert.equal(israelHour(new Date(Date.UTC(2026, 6, 15, 21, 30))), 0); // 00:30 ישראל = 21:30 UTC
  assert.equal(israelHour(winter(6)), 6);
  assert.equal(israelHour(new Date(Date.UTC(2026, 0, 15, 22, 10))), 0);
  assert.equal(greetingNow(summer(6)), GREETING_MORNING);
  assert.equal(greetingNow(summer(17)), GREETING_EVENING);
  assert.equal(greetingNow(new Date(Date.UTC(2026, 0, 15, 14, 30))), GREETING_EVENING); // 14:30Z = 16:30 ישראל (חורף) -> ערב
  assert.equal(greetingNow(new Date(Date.UTC(2026, 0, 15, 13, 30))), GREETING_MORNING); // 15:30 ישראל -> עדיין בוקר
});
t('greetingNow על גבול 16:00 בחורף', () => {
  assert.equal(greetingNow(winter(15, 59)), GREETING_MORNING);
  assert.equal(greetingNow(winter(16, 0)), GREETING_EVENING);
});
t('formatIsraelHHMM', () => {
  assert.equal(formatIsraelHHMM(summer(8, 30)), '08:30');
  assert.equal(formatIsraelHHMM(winter(0, 5)), '00:05');
  assert.equal(formatIsraelHHMM('bad'), '');
});

console.log('חזרה לאותו דף (L06) - בלי open redirect');
t('נתיבים פנימיים תקינים עוברים', () => {
  assert.equal(sanitizeReturnPath('/orders/123'), '/orders/123');
  assert.equal(sanitizeReturnPath('/customers?x=1&y=2#top'), '/customers?x=1&y=2#top');
  assert.equal(sanitizeReturnPath('/'), '/');
  assert.equal(sanitizeReturnPath('  /board  '), '/board');
});
t('כתובות חיצוניות ותחבולות נדחות', () => {
  for (const bad of ['https://evil.com', 'http://evil.com/x', '//evil.com', '/\\evil.com', '\\\\evil.com', 'javascript:alert(1)',
    '/%2F%2Fevil.com', '/%5Cevil.com', 'orders', '', null, undefined, 42, '/orders\r\nSet-Cookie: a=b', '/api/login', '/_next/x', '/API/x',
    'data:text/html,x', '/'.padEnd(2001, 'a')]) {
    assert.equal(sanitizeReturnPath(bad), null, `expected null for ${String(bad).slice(0, 40)}`);
  }
});

console.log('מחשב משותף (L09/L17)');
t('מעל 3 עובדים שונים = משותף', () => {
  assert.equal(SHARED_COMPUTER_THRESHOLD, 3);
  assert.equal(isSharedComputer(0), false);
  assert.equal(isSharedComputer(3), false);
  assert.equal(isSharedComputer(4), true);
  assert.equal(isSharedComputer('x'), false);
});
t('רשימת המפתחות ייחודית, שומרת סדר וחסומה', () => {
  let l = [];
  l = addEmployeeKeyToDevice(l, 'a'); l = addEmployeeKeyToDevice(l, 'b'); l = addEmployeeKeyToDevice(l, 'a');
  assert.deepEqual(l, ['a', 'b']);
  assert.equal(isSharedComputer(l.length), false);
  l = addEmployeeKeyToDevice(l, 'c'); l = addEmployeeKeyToDevice(l, 'd');
  assert.equal(l.length, 4);
  assert.equal(isSharedComputer(l.length), true);
  for (let i = 0; i < 30; i++) l = addEmployeeKeyToDevice(l, `k${i}`);
  assert.equal(l.length, DEVICE_EMPLOYEE_KEYS_CAP);
  assert.deepEqual(addEmployeeKeyToDevice(null, ''), []);
  assert.deepEqual(addEmployeeKeyToDevice(['x', 7, null], 'y'), ['x', 'y']);
});

console.log('רישום התחלת עבודה (L14, Q02-Q04, LQ-02)');
const todayNoon = new Date(Date.UTC(2026, 6, 15, 9, 0)); // 12:00 ישראל
const openToday = { id: 's1', entryTime: new Date(Date.UTC(2026, 6, 15, 5, 30)), exitTime: null }; // 08:30 היום
const openYesterday = { id: 's2', entryTime: new Date(Date.UTC(2026, 6, 14, 5, 30)), exitTime: null }; // 08:30 אתמול
const openLastNight = { id: 's3', entryTime: new Date(Date.UTC(2026, 6, 14, 20, 30)), exitTime: null }; // 23:30 אתמול ישראל
const openOld = { id: 's4', entryTime: new Date(Date.UTC(2026, 5, 1, 5, 30)), exitTime: null };
t('סיווג משמרת פתוחה לפי היום הישראלי', () => {
  assert.equal(classifyOpenShift(null, todayNoon), null);
  assert.equal(classifyOpenShift({ ...openToday, exitTime: new Date() }, todayNoon), null);
  assert.equal(classifyOpenShift(openToday, todayNoon), 'today');
  assert.equal(classifyOpenShift(openYesterday, todayNoon), 'previous-day');
  assert.equal(classifyOpenShift(openLastNight, todayNoon), 'previous-day'); // 23:30 אתמול ישראל = 20:30Z, עדיין "אתמול"
  assert.equal(classifyOpenShift(openOld, todayNoon), 'previous-day');
  // כניסה ב-00:30 ישראל (21:30Z אתמול) כשעכשיו 01:00 ישראל - אותו יום ישראלי
  const now0100 = new Date(Date.UTC(2026, 6, 14, 22, 0));
  assert.equal(classifyOpenShift({ entryTime: new Date(Date.UTC(2026, 6, 14, 21, 30)), exitTime: null }, now0100), 'today');
});
t('טבלת ההחלטות', () => {
  assert.equal(decideAutoShift({ autoClockIn: true, openShift: null, now: todayNoon }).action, SHIFT_ACTION.PUNCH_IN);
  assert.equal(decideAutoShift({ autoClockIn: false, openShift: null, now: todayNoon }).action, SHIFT_ACTION.NONE);
  // Q02: פתוחה היום - בשקט, גם כשהמתג דלוק וגם כשכבוי
  assert.equal(decideAutoShift({ autoClockIn: true, openShift: openToday, now: todayNoon }).action, SHIFT_ACTION.SKIP_SILENT);
  assert.equal(decideAutoShift({ autoClockIn: false, openShift: openToday, now: todayNoon }).action, SHIFT_ACTION.SKIP_SILENT);
  // Q03 + LQ-02: פתוחה מאתמול - שואלים את כולן, גם כשהמתג כבוי
  assert.equal(decideAutoShift({ autoClockIn: true, openShift: openYesterday, now: todayNoon }).action, SHIFT_ACTION.ASK_PREVIOUS);
  assert.equal(decideAutoShift({ autoClockIn: false, openShift: openYesterday, now: todayNoon }).action, SHIFT_ACTION.ASK_PREVIOUS);
  assert.equal(decideAutoShift({ autoClockIn: false, openShift: openOld, now: todayNoon }).action, SHIFT_ACTION.ASK_PREVIOUS);
});
t('הודעת הסיום (Q09) ונוסח החלונית (L15)', () => {
  assert.equal(punchInMessage(summer(9, 5)), 'נרשמה התחלת עבודה ב-09:05');
  assert.equal(previousShiftPrompt(openYesterday, todayNoon), 'המשמרת של אתמול התחילה ב-08:30 ועדיין פתוחה. באיזו שעה סיימת?');
  const old = previousShiftPrompt(openOld, todayNoon);
  assert.ok(old.startsWith('המשמרת מתאריך ') && old.includes('08:30'), old);
  assert.ok(!/\d{4}/.test(old), 'בלי תאריך לועזי: ' + old);
});
t('שעת היציאה שהוקלדה: אותו יום, חציית חצות, שגיאות', () => {
  const r1 = resolvePreviousShiftExit({ entryTime: openYesterday.entryTime, hhmm: '17:30', now: todayNoon });
  assert.equal(r1.ok, true);
  assert.equal(r1.exitAt.toISOString(), '2026-07-14T14:30:00.000Z'); // 17:30 ישראל (קיץ)
  const r2 = resolvePreviousShiftExit({ entryTime: openLastNight.entryTime, hhmm: '01:15', now: todayNoon });
  assert.equal(r2.ok, true);
  assert.equal(r2.exitAt.toISOString(), '2026-07-14T22:15:00.000Z'); // 01:15 של היום, אחרי חצות
  assert.equal(resolvePreviousShiftExit({ entryTime: openYesterday.entryTime, hhmm: '', now: todayNoon }).error, PREVIOUS_SHIFT_MESSAGES.missingTime);
  assert.equal(resolvePreviousShiftExit({ entryTime: openYesterday.entryTime, hhmm: '25:00', now: todayNoon }).error, PREVIOUS_SHIFT_MESSAGES.badTime);
  assert.equal(resolvePreviousShiftExit({ entryTime: openYesterday.entryTime, hhmm: 'abc', now: todayNoon }).error, PREVIOUS_SHIFT_MESSAGES.badTime);
  // 08:00 אתמול (לפני ההתחלה) -> נזרק ליום הבא 08:00 היום, לפני עכשיו (12:00) ובתוך יממה - תקין
  const r3 = resolvePreviousShiftExit({ entryTime: openYesterday.entryTime, hhmm: '08:00', now: todayNoon });
  assert.equal(r3.ok, true);
  assert.equal(r3.exitAt.toISOString(), '2026-07-15T05:00:00.000Z');
  // 13:00 אתמול בסדר; 13:00 היום היה עתידי - אבל 13:00 אתמול הוא אחרי 08:30 אז נבחר אתמול
  assert.equal(resolvePreviousShiftExit({ entryTime: openYesterday.entryTime, hhmm: '13:00', now: todayNoon }).ok, true);
  // משמרת ישנה: כל שעה חורגת מיממה
  assert.equal(resolvePreviousShiftExit({ entryTime: openOld.entryTime, hhmm: '17:00', now: todayNoon }).ok, true); // 17:00 באותו יום ישן
  // יציאה בעתיד: משמרת שהתחילה היום 11:00 (לא "אתמול", אבל הפונקציה טהורה) ושעה 13:00 כשעכשיו 12:00
  const r4 = resolvePreviousShiftExit({ entryTime: new Date(Date.UTC(2026, 6, 15, 8, 0)), hhmm: '13:00', now: todayNoon });
  assert.equal(r4.error, PREVIOUS_SHIFT_MESSAGES.inFuture);
  assert.equal(resolvePreviousShiftExit({ entryTime: 'bad', hhmm: '10:00', now: todayNoon }).error, PREVIOUS_SHIFT_MESSAGES.badTime);
});
t('שעת יציאה בחורף (UTC+2)', () => {
  const entry = new Date(Date.UTC(2026, 0, 14, 6, 30)); // 08:30 ישראל חורף
  const now = new Date(Date.UTC(2026, 0, 15, 10, 0));
  const r = resolvePreviousShiftExit({ entryTime: entry, hhmm: '16:00', now });
  assert.equal(r.ok, true);
  assert.equal(r.exitAt.toISOString(), '2026-01-14T14:00:00.000Z');
});

console.log('העדפת "רישום אוטומטי" בהעדפות העובד (Q01)');
t('קריאה: ערכי legacy ו-JSON בלי המפתח = כבוי', () => {
  assert.equal(autoClockInFromRaw(null), false);
  assert.equal(autoClockInFromRaw('standard'), false);
  assert.equal(autoClockInFromRaw('{"v":1,"palette":"wine"}'), false);
  assert.equal(autoClockInFromRaw('{"v":1,"autoClockIn":true}'), true);
  assert.equal(autoClockInFromRaw('{"v":1,"autoClockIn":"true"}'), false);
  assert.equal(autoClockInFromPrefs({ autoClockIn: true }), true);
});
t('כתיבה שומרת את שאר ההעדפות ואת uiVariants', () => {
  const raw = JSON.stringify({ v: 1, palette: 'wine', mode: 'dark', uiVariants: { shell: 'a5' }, savedPalettes: [] });
  const next = withAutoClockIn(raw, true);
  const parsed = JSON.parse(next);
  assert.equal(parsed.autoClockIn, true);
  assert.equal(parsed.palette, 'wine');
  assert.equal(parsed.mode, 'dark');
  assert.deepEqual(parsed.uiVariants, { shell: 'a5' });
  assert.equal(parseStoredDesignPrefs(next).autoClockIn, true);
  const off = JSON.parse(withAutoClockIn(next, false));
  assert.equal(off.autoClockIn, false);
  assert.equal(off.palette, 'wine');
  assert.equal(JSON.parse(withAutoClockIn('standard', true)).autoClockIn, true);
  assert.equal(JSON.parse(withAutoClockIn(null, true)).v, 1);
});
t('mergeDesignPrefs בלי המפתח לא מוחק אותו; sanitize זורק ערך לא בוליאני', () => {
  const merged = mergeDesignPrefs({ v: 1, autoClockIn: true, palette: 'wine' }, { palette: 'rose' });
  assert.equal(merged.autoClockIn, true);
  assert.equal(merged.palette, 'rose');
  assert.equal(sanitizeDesignPrefs({ autoClockIn: 'yes' }).autoClockIn, undefined);
  assert.equal(sanitizeDesignPrefs({ autoClockIn: false }).autoClockIn, false);
});

console.log('הפס העליון (L11, LQ-07) וזיהוי הארגון');
t('זיהוי לפי דומיין', () => {
  assert.equal(detectOrgFromHost('gmach-neve-yaakov.vercel.app'), ORG_NEVE_YAAKOV);
  assert.equal(detectOrgFromHost('gemach-app-uyh4.vercel.app'), ORG_MAIN);
  assert.equal(detectOrgFromHost(''), ORG_MAIN);
  assert.equal(detectOrgFromHost(undefined), ORG_MAIN);
  assert.equal(currentOrg({ VERCEL_PROJECT_PRODUCTION_URL: 'gmach-neve-yaakov.vercel.app' }), ORG_NEVE_YAAKOV);
  assert.equal(currentOrg({ VERCEL_URL: 'gemach-app-uyh4-abc.vercel.app' }), ORG_MAIN);
  assert.equal(currentOrg({ GEMACH_ORG: 'neve-yaakov', VERCEL_PROJECT_PRODUCTION_URL: 'gemach-app-uyh4.vercel.app' }), ORG_NEVE_YAAKOV);
  assert.equal(currentOrg({ GEMACH_ORG: 'bogus' }), ORG_MAIN);
  assert.equal(isMainGemach({}), true);
  assert.equal(isMainGemach({ VERCEL_PROJECT_PRODUCTION_URL: 'gmach-neve-yaakov.vercel.app' }), false);
});
t('גמ"ח ראשי: השם מההגדרה + "מכובד השכרת שמלות"; לא פעמיים', () => {
  assert.deepEqual(brandBar({ gmachName: 'גמ"ח שמלות', isMainGemach: true }), { name: 'גמ"ח שמלות', tag: MAIN_GEMACH_TAG });
  assert.deepEqual(brandBar({ gmachName: 'מכובד השכרת שמלות', isMainGemach: true }), { name: 'מכובד השכרת שמלות', tag: '' });
  // הערך האמיתי בגמ"ח הראשי (עם מקף) - השם הוא כבר הסיומת, בלי תגית כפולה
  assert.deepEqual(brandBar({ gmachName: 'מכובד- השכרת שמלות', isMainGemach: true }), { name: 'מכובד- השכרת שמלות', tag: '' });
  assert.deepEqual(brandBar({ gmachName: '  ', gmachSubtitle: 'x', isMainGemach: true }), { name: DEFAULT_GEMACH_NAME, tag: MAIN_GEMACH_TAG });
});
t('גמ"ח אחר: השם שלו + כותרת המשנה שלו בלבד (בלי הסיומת של הראשי)', () => {
  assert.deepEqual(brandBar({ gmachName: 'גמ״ח שמלות', gmachSubtitle: 'נווה יעקב', isMainGemach: false }), { name: 'גמ״ח שמלות', tag: 'נווה יעקב' });
  assert.deepEqual(brandBar({ gmachName: 'גמ״ח שמלות', isMainGemach: false }), { name: 'גמ״ח שמלות', tag: '' });
  assert.equal(brandBar({ gmachName: 'x', gmachSubtitle: '', isMainGemach: false }).tag, '');
});

console.log('הטופס (L01, L02, L08, LQ-05)');
const EMPS = [
  { id: 'e1', firstName: 'שרה', lastName: 'כהן' },
  { id: 'e2', firstName: 'רחל', lastName: 'לוי', fullName: 'רחל לוי' },
  { id: 'e3', firstName: 'מרים', lastName: 'גולדשטיין' },
];
t('סינון לפי הקלדה והתאמה מדויקת', () => {
  assert.equal(filterEmployees(EMPS, '').length, 3);
  assert.deepEqual(filterEmployees(EMPS, 'שר').map((e) => e.id), ['e1']);
  assert.deepEqual(filterEmployees(EMPS, 'לוי').map((e) => e.id), ['e2']);
  assert.deepEqual(filterEmployees(EMPS, 'zzz'), []);
  assert.equal(matchEmployeeByName(EMPS, 'שרה כהן').id, 'e1');
  assert.equal(matchEmployeeByName(EMPS, '  שרה   כהן ').id, 'e1');
  assert.equal(matchEmployeeByName(EMPS, 'שרה'), null);
  assert.equal(employeeDisplayName({ firstName: 'א', lastName: '' }), 'א');
  assert.equal(employeeDisplayName({ fullName: 'ב ג' }), 'ב ג');
});
t('הודעות האימות כמו בעיצוב', () => {
  assert.deepEqual(validateLoginForm({ userText: '', employeeId: null, credential: '' }), { field: 'user', message: LOGIN_MESSAGES.bothMissing });
  assert.deepEqual(validateLoginForm({ userText: '', employeeId: null, credential: 'x' }), { field: 'user', message: LOGIN_MESSAGES.userMissing });
  assert.deepEqual(validateLoginForm({ userText: 'שרה כהן', employeeId: 'e1', credential: '' }), { field: 'pass', message: LOGIN_MESSAGES.passMissing });
  assert.deepEqual(validateLoginForm({ userText: 'פלוני', employeeId: null, credential: 'x' }), { field: 'user', message: LOGIN_MESSAGES.userNotFound });
  assert.deepEqual(validateLoginForm({ userText: 'פלוני', employeeId: null, credential: '' }), { field: 'user', message: LOGIN_MESSAGES.userNotFoundNoPass });
  assert.deepEqual(validateLoginForm({ userText: 'פלוני', employeeId: null, credential: '', listLoaded: false }), { field: 'user', message: LOGIN_MESSAGES.loading });
  assert.deepEqual(validateLoginForm({ userText: 'שרה כהן', employeeId: 'e1', credential: '12', pinMode: true }), { field: 'pass', message: LOGIN_MESSAGES.pinMissing });
  assert.equal(validateLoginForm({ userText: 'שרה כהן', employeeId: 'e1', credential: '1234', pinMode: true }), null);
  assert.equal(validateLoginForm({ userText: 'שרה כהן', employeeId: 'e1', credential: 'secret' }), null);
});
t('כותרת הסיום והודעות שלא טופלו', () => {
  assert.equal(doneTitle({ firstName: 'שרה' }), 'התחברת בהצלחה, שרה');
  assert.equal(doneTitle(null), 'התחברת בהצלחה');
  assert.equal(unreadMessagesText(3), 'יש 3 הודעות חדשות שלא טופלו');
  assert.equal(unreadMessagesText(1), 'יש הודעה חדשה אחת שלא טופלה');
});


console.log('משמרת legacy בלי שעת כניסה (ביקורת #5)');
t('classifyOpenShift: בלי entryTime = כאילו אין משמרת; decideAutoShift לא שואל ולא נתקע', () => {
  const legacy = { id: 'old', entryTime: null, date: new Date(Date.UTC(2024, 0, 1)), exitTime: null };
  assert.equal(classifyOpenShift(legacy, todayNoon), null);
  assert.equal(classifyOpenShift({ id: 'x', entryTime: 'not a date', exitTime: null }, todayNoon), null);
  assert.equal(decideAutoShift({ autoClockIn: true, openShift: legacy, now: todayNoon }).action, SHIFT_ACTION.PUNCH_IN);
  assert.equal(decideAutoShift({ autoClockIn: false, openShift: legacy, now: todayNoon }).action, SHIFT_ACTION.NONE);
});
t('resolvePreviousShiftExit: בלי entryTime / 1970 - שגיאה, לעולם לא שעת יציאה מ-1970', () => {
  for (const bad of [null, undefined, '', 0, new Date(0), 'garbage']) {
    const r = resolvePreviousShiftExit({ entryTime: bad, hhmm: '17:30', now: todayNoon });
    assert.equal(r.ok, false, `entryTime=${String(bad)}`);
    assert.equal(r.error, PREVIOUS_SHIFT_MESSAGES.badTime);
  }
});

console.log('טוקן ההתחברות: "זכור אותי" שורד הנפקה-מחדש (ביקורת #3)');
t('createSessionToken עם remember מסמן rm:true, בלי - אין rm', () => {
  const secret = 'test-secret';
  const tok = createSessionToken({ id: 'e1', roleId: 1 }, secret, 1000, { remember: true });
  const payload = verifySessionToken(tok, secret, 2000);
  assert.equal(payload.rm, true);
  const plain = verifySessionToken(createSessionToken({ id: 'e1', roleId: 1 }, secret, 1000), secret, 2000);
  assert.equal(plain.rm, undefined);
});
await ta('checkAuthCore: טוקן ישן עם rm מעביר remember:true ל-reissueSession, בלי rm - false', async () => {
  const secret = 'test-secret';
  const run = async (remember) => {
    const now = 10_000_000;
    const stale = createSessionToken({ id: 'e1', roleId: 1 }, secret, now - SESSION_FRESH_MS - 1000, { remember });
    let got = null;
    const ok = await checkAuthCore({
      requiredRole: 'מנהל', authTokenValue: 'e1', sessionTokenValue: stale, secret, roleLevels: { 'מנהל': [1, 2] },
      getRequireLogin: async () => true, findEmployeeRoleById: async () => ({ roleId: 1, showAi: false }),
      reissueSession: (emp, opts) => { got = opts; }, now,
    });
    assert.equal(ok, true);
    return got;
  };
  assert.deepEqual(await run(true), { remember: true });
  assert.deepEqual(await run(false), { remember: false });
});

console.log('שומרי מקור (ביקורת #1, #2, #4): עוגיות, שומר ה-legacyId, סימון דף הכניסה, CSS של השדות');
t('app/api/login/route.js: עוגיית auth_token עם sameSite lax + secure בייצור, ושומר legacyId של ספרות בלבד', () => {
  const route = src('../app/api/login/route.js');
  const cookieBlock = route.slice(route.indexOf("name: 'auth_token'"), route.indexOf("name: 'auth_token'") + 400);
  assert.ok(/sameSite:\s*'lax'/.test(cookieBlock), 'sameSite lax');
  assert.ok(/secure:\s*process\.env\.NODE_ENV === 'production'/.test(cookieBlock), 'secure in production');
  assert.ok(route.includes("/^\\d+$/.test(String(employeeId)) ? parseInt(employeeId, 10) : NaN"), 'legacyId guard (7c750b9f)');
  assert.ok(!/const parsedLegacyId = parseInt\(employeeId, 10\);/.test(route), 'no unguarded parseInt');
});
t('UUID שמתחיל בספרות לא נחשב legacyId (אותו ביטוי כמו במסלול)', () => {
  const guard = (employeeId) => (/^\d+$/.test(String(employeeId)) ? parseInt(employeeId, 10) : NaN);
  assert.ok(Number.isNaN(guard('609d1d9d-d209-4a6d-9a93-b39352293bce')));
  assert.ok(Number.isNaN(guard('12abc')));
  assert.equal(guard('125'), 125);
  assert.equal(guard(125), 125);
});
t('רישום מכשיר / משמרת אוטומטית / זכור-אותי רק עם loginPage:true (המסך הישן והקיוסק לא שולחים אותו)', () => {
  const route = src('../app/api/login/route.js');
  assert.ok(route.includes("const isNewLoginPage = body.loginPage === true;"));
  assert.ok(route.includes("isNewLoginPage ? await recordLoginOnDevice(cookieStore, employee.id) : { shared: false }"));
  assert.ok(route.includes("const rememberMe = isNewLoginPage && body.rememberMe === true && !shared;"));
  assert.ok(route.includes("const shared = !!device.shared || !!trustedDevice;"), 'trusted computer = shared (rollout rule)');
  assert.ok(route.includes("if (!isNewLoginPage) throw Object.assign(new Error('skip'), { skip: true });"));
  assert.ok(src('../app/components/login/LoginNew.js').includes('loginPage: true,'));
  assert.ok(!src('../app/components/LoginScreen.js').includes('loginPage'), 'old screen untouched');
  assert.ok(!src('../app/customer-interface/page.js').includes('loginPage'), 'kiosk untouched');
});
t('login.css: שדות הקלט מנצחים את design-overrides.css input:not(x4) (0,4,1) - ברירת מחדל, פוקוס, שגיאה, חלון כהה', () => {
  const css = src('../app/components/login/login.css');
  const sel = 'input.inp:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"])';
  const need = [
    `.gm-ds.gm-login ${sel}{`, `.gm-ds.gm-login ${sel}:focus{`, `.gm-ds.gm-login ${sel}[aria-invalid="true"]{`,
    `.gm-ds.gm-login .dlg.dk ${sel}{`, `.gm-ds.gm-login .dlg.dk ${sel}:focus{`,
  ];
  for (const n of need) assert.ok(css.includes(n), `missing: ${n}`);
  const base = css.slice(css.indexOf(`.gm-ds.gm-login ${sel}{`), css.indexOf('\n', css.indexOf(`.gm-ds.gm-login ${sel}{`)));
  assert.ok(base.includes('background-color:rgba(255,255,255,.72)') && base.includes('border-radius:14px') && base.includes('font-size:16px') && base.includes('border:1.5px solid var(--gm-line)'), base);
  assert.ok(!/\.gm-ds\.gm-login \.inp\{/.test(css), 'no low-specificity .inp base rule left');
  assert.ok(!css.includes('.gm-autoclock-knob'), 'no leftover user-menu knob rule');
});


console.log('המתג "רישום אוטומטי" רק בכרטיס הפרופיל (הבעלים 2.10.2026)');
t('AutoClockSwitch מיובא רק מדף הפרופיל - לא מתפריט המשתמש הישן, לא מהסרגל החדש ולא ממגירת הנייד', () => {
  for (const f of ['../app/components/UserMenu.js', '../app/components/menu/MenuA5Shell.js', '../app/components/menu/MenuUserPanel.js', '../app/components/menu/MenuTabPanel.js']) {
    assert.ok(!src(f).includes('AutoClockSwitch'), `${f} must not render the switch`);
  }
  assert.ok(src('../app/components/profile/ProfilePage.js').includes('<AutoClockSwitch />'));
  // בלי prop של מיקום (variant / placement): רק כרטיס הפרופיל. 4.10.2026 ("ישן / חדש"): המראה הישן של אותו כרטיס מוצג רק בדף
  // הפרופיל הישן (LegacyProfilePage), ונבחר אך ורק לפי useUiVariant('profile') - לא לפי prop.
  const auto = src('../app/components/login/AutoClockSwitch.js');
  assert.match(auto, /export default function AutoClockSwitch\(\) \{/, 'no props - single profile-card switch');
  assert.ok(!/variant[=:]/.test(auto), 'no variant prop / placement option');
  assert.match(auto, /useUiVariant\('profile'\)/, 'old look only on the old profile page');
});

console.log(`\n[TZ=${process.env.TZ}] ${passed} בדיקות עברו${process.exitCode ? ', יש כישלונות' : ''}`);
