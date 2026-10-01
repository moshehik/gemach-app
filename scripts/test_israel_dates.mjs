// בדיקה ל"היום"/"מחר"/תאריך-מהיר לפי שעון ישראל (lib/hebrewDate.js) - מדמה את הרגעים שבהם
// תאריך UTC עדיין "אתמול" (00:00-03:00 שעון ישראל, כולל סביב מעברי שעון הקיץ של 2026) ומוודאת
// שהתאריך הקלנדרי הישראלי נכון, בלי קשר לאזור הזמן של המכונה שמריצה (השרת ב-Vercel הוא UTC).
//
// אין כאן DB ואין שרת - רק lib/hebrewDate.js:
//   node scripts/test_israel_dates.mjs
// הסקריפט מריץ את עצמו מחדש תחת כמה אזורי זמן (TZ) ומסיים ב-exit code 1 בכישלון.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  getIsraelDateKey, getIsraelTodayKey, getIsraelTodayDate, getIsraelTodayRange, getIsraelDayRange,
  getIsraelDaysUntil, toIsraelCalendarDate, addDaysToDateKey, addMonthsToDateKey
} from '../lib/hebrewDate.js';

const TIMEZONES = ['UTC', 'America/Los_Angeles', 'Asia/Jerusalem', 'Pacific/Kiritimati'];

if (!process.env.ISRAEL_DATES_CHILD) {
  let failed = false;
  for (const tz of TIMEZONES) {
    const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: tz, ISRAEL_DATES_CHILD: '1', NODE_NO_WARNINGS: '1' },
      stdio: 'inherit'
    });
    if (res.status !== 0) failed = true;
  }
  console.log(failed ? '\nFAILED' : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
}

let count = 0;
function test(name, fn) {
  try {
    fn();
    count++;
  } catch (err) {
    console.error(`FAIL [TZ=${process.env.TZ}] ${name}\n${err.stack}`);
    process.exitCode = 1;
  }
}
const at = (iso) => new Date(iso);

// [רגע UTC, התאריך הישראלי הצפוי, תיאור]. ישראל: UTC+2 בחורף, UTC+3 בקיץ; בשנת 2026 שעון הקיץ
// מתחיל ביום שישי 27/3 בשעה 02:00 ונגמר ביום ראשון 25/10 בשעה 02:00 (השעון חוזר ל-01:00).
const CASES = [
  ['2026-07-14T21:30:00Z', '2026-07-15', '00:30 בקיץ (UTC+3)'],
  ['2026-01-14T22:30:00Z', '2026-01-15', '00:30 בחורף (UTC+2)'],
  ['2026-07-14T20:59:59Z', '2026-07-14', '23:59:59 בקיץ - עדיין אתמול'],
  ['2026-07-14T21:00:00Z', '2026-07-15', '00:00:00 בקיץ - חצות בדיוק'],
  ['2026-07-15T08:00:00Z', '2026-07-15', '11:00 בצהריים'],
  // מעבר לשעון קיץ: 27/3/2026 (00:00-01:59 עוד UTC+2, מ-03:00 UTC+3)
  ['2026-03-26T21:59:59Z', '2026-03-26', 'סביב כניסת שעון הקיץ: 23:59:59 ב-26/3'],
  ['2026-03-26T22:00:00Z', '2026-03-27', 'סביב כניסת שעון הקיץ: 00:00 ב-27/3'],
  ['2026-03-26T22:30:00Z', '2026-03-27', 'סביב כניסת שעון הקיץ: 00:30 ב-27/3'],
  ['2026-03-27T00:30:00Z', '2026-03-27', 'סביב כניסת שעון הקיץ: 02:30 -> קיים כ-03:30 (UTC+3)'],
  ['2026-03-27T20:59:59Z', '2026-03-27', 'סביב כניסת שעון הקיץ: 23:59:59 ב-27/3 (UTC+3)'],
  ['2026-03-27T21:00:00Z', '2026-03-28', 'סביב כניסת שעון הקיץ: 00:00 ב-28/3'],
  // מעבר לשעון חורף: 25/10/2026 (01:30 מופיע פעמיים - פעם ב-UTC+3 ופעם ב-UTC+2)
  ['2026-10-24T21:00:00Z', '2026-10-25', 'סביב יציאת שעון הקיץ: 00:00 ב-25/10'],
  ['2026-10-24T21:30:00Z', '2026-10-25', 'סביב יציאת שעון הקיץ: 00:30 ב-25/10'],
  ['2026-10-24T22:30:00Z', '2026-10-25', 'סביב יציאת שעון הקיץ: 01:30 הראשון (UTC+3)'],
  ['2026-10-24T23:30:00Z', '2026-10-25', 'סביב יציאת שעון הקיץ: 01:30 השני (UTC+2)'],
  ['2026-10-25T21:59:59Z', '2026-10-25', 'סביב יציאת שעון הקיץ: 23:59:59 ב-25/10 (UTC+2)'],
  ['2026-10-25T22:00:00Z', '2026-10-26', 'סביב יציאת שעון הקיץ: 00:00 ב-26/10'],
  // גבול שנה
  ['2026-12-31T22:30:00Z', '2027-01-01', '00:30 בחצות השנה האזרחית'],
];

for (const [iso, expected, label] of CASES) {
  test(`getIsraelTodayKey - ${label}`, () => {
    assert.equal(getIsraelTodayKey(at(iso)), expected);
    assert.equal(getIsraelDateKey(at(iso).getTime()), expected, 'timestamp מספרי');
    assert.equal(getIsraelDateKey(iso), expected, 'מחרוזת ISO');
  });
  test(`getIsraelTodayDate (רכיבים מקומיים) - ${label}`, () => {
    const d = getIsraelTodayDate(at(iso));
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    assert.equal(local, expected);
  });
  test(`getIsraelTodayRange מכיל את "עכשיו" - ${label}`, () => {
    const now = at(iso);
    const { start, end } = getIsraelTodayRange(now);
    assert.ok(start <= now && now <= end, `${start.toISOString()} <= ${now.toISOString()} <= ${end.toISOString()}`);
    assert.deepEqual(getIsraelTodayRange(now), getIsraelDayRange(expected));
  });
}

test('הבאג המקורי: תאריך UTC ב-00:30 שעון ישראל הוא "אתמול"', () => {
  for (const [iso, expected] of [CASES[0], CASES[1], CASES[7], CASES[13]]) {
    assert.notEqual(at(iso).toISOString().slice(0, 10), expected, `${iso} - ה-UTC אמור לפגר ביום`);
  }
});

test('שעות היום הרגילות (08:00-20:59 שעון ישראל) - אותו תאריך כמו הנוסחה הישנה של UTC, כל ימות 2026', () => {
  // 11:00 UTC = 13:00/14:00 בישראל: בצהריים ה-UTC והתאריך הישראלי תמיד זהים.
  for (let day = 0; day < 365; day++) {
    const now = new Date(Date.UTC(2026, 0, 1 + day, 11, 0, 0));
    assert.equal(getIsraelTodayKey(now), now.toISOString().slice(0, 10), now.toISOString());
  }
});

test('addDaysToDateKey - גבולות חודש/שנה/שנה מעוברת ומעברי שעון', () => {
  assert.equal(addDaysToDateKey('2026-03-26', 1), '2026-03-27');
  assert.equal(addDaysToDateKey('2026-03-27', 2), '2026-03-29');
  assert.equal(addDaysToDateKey('2026-10-24', 2), '2026-10-26');
  assert.equal(addDaysToDateKey('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysToDateKey('2026-03-01', -1), '2026-02-28');
  assert.equal(addDaysToDateKey('2024-03-01', -1), '2024-02-29');
  assert.equal(addDaysToDateKey('2026-10-25', 0), '2026-10-25');
});

test('quick date "מחר"/"אתמול" ב-00:30 ישראל (alterations setQuickDate)', () => {
  const now = at('2026-03-26T22:30:00Z'); // 27/3 00:30 שעון ישראל
  const today = getIsraelTodayKey(now);
  assert.equal(addDaysToDateKey(today, 0), '2026-03-27');
  assert.equal(addDaysToDateKey(today, 1), '2026-03-28');
  assert.equal(addDaysToDateKey(today, -1), '2026-03-26');
});

test('addMonthsToDateKey', () => {
  assert.equal(addMonthsToDateKey('2026-10-01', 6), '2027-04-01');
  assert.equal(addMonthsToDateKey('2026-08-31', 6), '2027-03-03'); // גלישת סוף חודש, כמו setMonth
  assert.equal(addMonthsToDateKey('2026-12-15', 1), '2027-01-15');
});

test('getIsraelDaysUntil - 00:30 ישראל (שרת UTC עדיין "אתמול")', () => {
  const now = at('2026-03-26T22:30:00Z'); // 27/3 00:30 שעון ישראל
  assert.equal(getIsraelDaysUntil('2026-03-27T00:00:00.000Z', now), 0, 'אירוע היום (חצות UTC)');
  assert.equal(getIsraelDaysUntil('2026-03-26T22:00:00.000Z', now), 0, 'אירוע היום (חצות ישראל כרגע UTC)');
  assert.equal(getIsraelDaysUntil('2026-03-26T00:00:00.000Z', now), -1, 'אירוע אתמול - כבר "עבר"');
  assert.equal(getIsraelDaysUntil('2026-03-28T00:00:00.000Z', now), 1);
  assert.equal(getIsraelDaysUntil('2026-03-29T00:00:00.000Z', now), 2, 'מעבר שעון קיץ באמצע');
});

test('getIsraelDaysUntil - מעבר שעון חורף באמצע הטווח', () => {
  assert.equal(getIsraelDaysUntil('2026-10-26T00:00:00.000Z', at('2026-10-24T10:00:00Z')), 2);
  assert.equal(getIsraelDaysUntil('2026-10-25T00:00:00.000Z', at('2026-10-24T21:30:00Z')), 0, '00:30 ב-25/10');
  assert.equal(getIsraelDaysUntil('2026-10-24T00:00:00.000Z', at('2026-10-25T22:30:00Z')), -2, '01:30 ב-26/10');
});

test('getIsraelDaysUntil - ערכים ריקים/לא תקינים', () => {
  assert.equal(getIsraelDaysUntil(null), null);
  assert.equal(getIsraelDaysUntil(undefined), null);
  assert.equal(getIsraelDaysUntil('not a date'), null);
  assert.equal(getIsraelDateKey('not a date'), null);
});

test('getIsraelDaysUntil - שעות היום הרגילות זהה לנוסחה הישנה (setHours מקומי) כש-TZ=ישראל', () => {
  if (process.env.TZ !== 'Asia/Jerusalem') return; // הנוסחה הישנה תלויה באזור הזמן - משווים רק כשהוא ישראל
  for (let day = 0; day < 365; day += 7) {
    const now = new Date(Date.UTC(2026, 0, 1 + day, 11, 0, 0));
    for (let offset = -10; offset <= 10; offset++) {
      const event = new Date(Date.UTC(2026, 0, 1 + day + offset)); // חצות UTC = צורת האחסון הרגילה
      const today = new Date(now); today.setHours(0, 0, 0, 0);
      const ev = new Date(event); ev.setHours(0, 0, 0, 0);
      const old = Math.round((ev - today) / 86400000);
      assert.equal(getIsraelDaysUntil(event, now), old, `${now.toISOString()} ${event.toISOString()}`);
    }
  }
});

test('toIsraelCalendarDate - עוגן חצות UTC של היום הישראלי', () => {
  assert.equal(toIsraelCalendarDate('2026-03-26T22:30:00Z').toISOString(), '2026-03-27T00:00:00.000Z');
  assert.equal(toIsraelCalendarDate('2026-03-26T21:59:59Z').toISOString(), '2026-03-26T00:00:00.000Z');
  assert.equal(toIsraelCalendarDate(null), null);
  assert.equal(toIsraelCalendarDate('garbage'), null);
});

test('getIsraelDayRange - גבולות מדויקים, כולל ימי מעבר שעון (23/25 שעות)', () => {
  const exact = (key, startIso, endIso) => {
    const { start, end } = getIsraelDayRange(key);
    assert.equal(start.toISOString(), startIso, `${key} start`);
    assert.equal(end.toISOString(), endIso, `${key} end`);
  };
  exact('2026-07-15', '2026-07-14T21:00:00.000Z', '2026-07-15T20:59:59.999Z'); // קיץ
  exact('2026-01-15', '2026-01-14T22:00:00.000Z', '2026-01-15T21:59:59.999Z'); // חורף
  exact('2026-03-27', '2026-03-26T22:00:00.000Z', '2026-03-27T20:59:59.999Z'); // כניסת שעון הקיץ: 23 שעות
  exact('2026-10-25', '2026-10-24T21:00:00.000Z', '2026-10-25T21:59:59.999Z'); // יציאת שעון הקיץ: 25 שעות
  const spring = getIsraelDayRange('2026-03-27');
  assert.equal(spring.end - spring.start + 1, 23 * 3600000);
  const fall = getIsraelDayRange('2026-10-25');
  assert.equal(fall.end - fall.start + 1, 25 * 3600000);
});

// lib/lateReturn.js (וה-lib/clientInventory.js שהוא מייבא) משתמשים בייבוא יחסי בלי סיומת (תקין ב-webpack,
// לא ב-node ESM) - hook קטן מוסיף '.js' רק בשביל הבדיקה הזו.
const { register } = await import('node:module');
register('data:text/javascript,' + encodeURIComponent([
  'export async function resolve(specifier, context, next) {',
  '  try { return await next(specifier, context); }',
  '  catch (err) {',
  "    if (specifier.startsWith('.') && !specifier.endsWith('.js')) return next(specifier + '.js', context);",
  '    throw err;',
  '  }',
  '}'
].join(String.fromCharCode(10))), import.meta.url);
const { getLateReturnInfo } = await import('../lib/lateReturn.js');

test('getLateReturnInfo - eventDate ריק/לא תקין => לא מאחרת (כמו ב-main), לא 1970', () => {
  const now = new Date('2026-10-01T09:00:00Z');
  for (const bad of ['garbage', '', null, undefined, new Date('x')]) {
    const info = getLateReturnInfo({ eventDate: bad }, 7, now);
    assert.equal(info.isLate, false, `eventDate=${String(bad)}`);
    assert.equal(info.daysLate, undefined, `eventDate=${String(bad)}`);
  }
  assert.equal(getLateReturnInfo(null, 7, now).isLate, false);
  assert.equal(getLateReturnInfo({}, 7, now).isLate, false);
});

test('getLateReturnInfo - eventDate תקין (ללא שינוי התנהגות)', () => {
  const now = new Date('2026-10-01T09:00:00Z'); // 12:00 שעון ישראל
  // אירוע ב-15/9 (שלישי) => מועד החזרה 16/9, 15 ימים אחורה
  const late = getLateReturnInfo({ eventDate: '2026-09-15T00:00:00.000Z' }, 7, now);
  assert.equal(late.isLate, true);
  assert.equal(late.daysLate, 15);
  // אירוע ב-27/9 => החזרה 28/9, 3 ימים - מתחת לסף
  const recent = getLateReturnInfo({ eventDate: '2026-09-27T00:00:00.000Z' }, 7, now);
  assert.equal(recent.isLate, false);
  assert.equal(recent.daysLate, 3);
  // toDate מפורש גובר
  assert.equal(getLateReturnInfo({ eventDate: 'garbage', toDate: '2026-09-20T00:00:00.000Z' }, 7, now).isLate, true);
});

console.log(`[TZ=${process.env.TZ}] ${count} assertions-blocks ran${process.exitCode ? ' - WITH FAILURES' : ' - ok'}`);
