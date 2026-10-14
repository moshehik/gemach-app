// בדיקה ל"יום האירוע לפי התאריך העברי השמור" (getEventDayRange / getEventDayKey ב-lib/hebrewDate.js).
//
// הרקע (5.10.2026, הגמח הראשי): הזמנות שהגיעו מהייבוא שמורות עם eventDate = 18:00 UTC של היום הלועזי שלפני האירוע
// (21:00 בישראל בקיץ), והתאריך העברי השמור הוא של היום שאחריו; הזמנות שנוצרו באפליקציה שמורות 00:00 / 21:00 / 22:00 UTC
// ותואמות את התווית. הבדיקה: בלי הזזה - ההתנהגות הקודמת בדיוק; עם הזזה - כל צורות האחסון נופלות על יום התווית.
//   node scripts/test_event_day_window.mjs      (רץ תחת כמה אזורי זמן; יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getEventDayRange, getEventDayKey, getIsraelDayRange, getIsraelDateKey } from '../lib/hebrewDate.js';

const TIMEZONES = ['UTC', 'Asia/Jerusalem', 'America/Los_Angeles'];
if (!process.env.EVENT_DAY_CHILD) {
  let failed = false;
  for (const tz of TIMEZONES) {
    const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, TZ: tz, EVENT_DAY_CHILD: '1', NODE_NO_WARNINGS: '1' }, stdio: 'inherit' });
    if (res.status !== 0) failed = true;
  }
  console.log(failed ? '\nFAILED' : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
}

let pass = 0; let fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.log(`  FAIL [TZ=${process.env.TZ}] ${name}\n         ${e.message}`); } };
const inRange = (iso, r) => { const x = new Date(iso).getTime(); return x >= r.start.getTime() && x <= r.end.getTime(); };

// כל הצורות שנמצאו בנתונים החיים. label = היום הלועזי שהתאריך העברי השמור שלו (כו תשרי = 7.10.2026, כה = 6.10)
const FORMS = [
  { name: 'ייבוא קיץ 18:00Z (ערב היום הקודם)', iso: '2026-10-06T18:00:00.000Z', label: '2026-10-07', civil: '2026-10-06' },
  { name: 'ייבוא חורף 18:00Z', iso: '2026-12-02T18:00:00.000Z', label: '2026-12-03', civil: '2026-12-02' },
  { name: 'ייבוא חורף 20:00Z', iso: '2026-12-02T20:00:00.000Z', label: '2026-12-03', civil: '2026-12-02' },
  { name: 'אפליקציה 00:00Z', iso: '2026-10-07T00:00:00.000Z', label: '2026-10-07', civil: '2026-10-07' },
  { name: 'חצות ישראל קיץ 21:00Z', iso: '2026-10-06T21:00:00.000Z', label: '2026-10-07', civil: '2026-10-07' },
  { name: 'חצות ישראל חורף 22:00Z', iso: '2026-12-02T22:00:00.000Z', label: '2026-12-03', civil: '2026-12-03' },
  { name: '00:26 ישראל (21:26Z)', iso: '2026-10-06T21:26:00.000Z', label: '2026-10-07', civil: '2026-10-07' },
];

t('בלי הזזה = getIsraelDayRange / getIsraelDateKey בדיוק', () => {
  for (const key of ['2026-10-06', '2026-03-27', '2026-10-25']) {
    assert.deepEqual(getEventDayRange(key), getIsraelDayRange(key));
    assert.deepEqual(getEventDayRange(key, false), getIsraelDayRange(key));
  }
  for (const f of FORMS) assert.equal(getEventDayKey(f.iso), getIsraelDateKey(f.iso));
});

for (const f of FORMS) {
  t(`${f.name}: עם הזזה - נופל על יום התווית ${f.label}`, () => {
    assert.equal(getEventDayKey(f.iso, true), f.label);
    assert.ok(inRange(f.iso, getEventDayRange(f.label, true)), 'אמור להיות בתוך חלון יום התווית');
    const prev = new Date(Date.parse(f.label + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
    const next = new Date(Date.parse(f.label + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
    assert.ok(!inRange(f.iso, getEventDayRange(prev, true)), 'לא אמור להיות ביום שלפני');
    assert.ok(!inRange(f.iso, getEventDayRange(next, true)), 'לא אמור להיות ביום שאחרי');
  });
}

t('הבאג המדווח: טווח "כה-כה" לא מחזיר הזמנות של "כו" (עם הזזה), וטווח "כו-כו" מוצא אותן', () => {
  const kaf = getEventDayRange('2026-10-06', true); // כה
  const kafVav = getEventDayRange('2026-10-07', true); // כו
  const legacyKafVav = '2026-10-06T18:00:00.000Z'; // הזמנה מהייבוא, תווית "כו"
  const appKafVav = '2026-10-07T00:00:00.000Z'; // הזמנה מהאפליקציה, תווית "כו"
  const legacyKaf = '2026-10-05T18:00:00.000Z'; // הזמנה מהייבוא, תווית "כה"
  assert.ok(!inRange(legacyKafVav, kaf));
  assert.ok(inRange(legacyKafVav, kafVav));
  assert.ok(inRange(appKafVav, kafVav));
  assert.ok(inRange(legacyKaf, kaf));
  // בלי ההזזה (ההתנהגות הקודמת): "כה-כה" תפס בטעות את הזמנת הייבוא של "כו"
  assert.ok(inRange(legacyKafVav, getEventDayRange('2026-10-06', false)));
});

t('חלונות רצופים לא חופפים ולא משאירים פער (גם סביב מעבר שעון)', () => {
  for (const start of ['2026-03-26', '2026-10-24', '2026-10-05']) {
    let key = start;
    let prevEnd = null;
    for (let i = 0; i < 6; i++) {
      const r = getEventDayRange(key, true);
      if (prevEnd !== null) assert.ok(Math.abs(r.start.getTime() - prevEnd - 1) <= 3600000 + 1, `פער/חפיפה גדולים מדי ב-${key}`);
      prevEnd = r.end.getTime();
      key = new Date(Date.parse(key + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
    }
  }
});

t('קלט ריק/לא תקין', () => {
  assert.equal(getEventDayKey(null, true), null);
  assert.equal(getEventDayKey('not a date', true), null);
});

console.log(`[TZ=${process.env.TZ}] ${pass} ok${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
