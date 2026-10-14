// שעון הנוכחות (lib/shiftPunch.js punchIn) שומר גם את התאריך העברי של המשמרת (דיווח 048c48c2, 5.10.2026): עד עכשיו המשמרת נוצרה בלי
// hebrewDate, ועמודת "תאריך עברי" בכרטיס העובד נשארה ריקה (מקף) בכל משמרת שנרשמה בשעון. בלי DB (prisma = דמה בזיכרון), בכל אזורי הזמן של run.mjs.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { punchIn } = await L('lib/shiftPunch.js');

beforeEach(() => {
  globalThis.__MOCK_DB = { shift: [] };
  globalThis.__MOCK_CALLS = [];
  globalThis.__MOCK_WRITABLE = ['shift'];
});

const employee = { id: 'emp-1', hourlyWage: 50, travelExpenses: false };

test('punchIn stores the Hebrew date of the Israel calendar day (24 Tishrei 5787 = 5.10.2026), whatever the process time zone', async () => {
  // 10:00Z = 13:00 Israel on 5.10; 22:30Z on 4.10 = 01:30 Israel on 5.10 (the server date in UTC is still 4.10 - the wrong-day trap)
  for (const iso of ['2026-10-05T10:00:00Z', '2026-10-04T22:30:00Z']) {
    const shift = await punchIn(employee, new Date(iso));
    assert.equal(shift.date.toISOString(), '2026-10-05T00:00:00.000Z', iso);
    assert.match(shift.hebrewDate, /תשרי/, iso + ' -> ' + shift.hebrewDate);
    assert.match(shift.hebrewDate, /^כד /, iso + ' -> ' + shift.hebrewDate);
    assert.match(shift.hebrewDate, /תשפ"ז$/, iso + ' -> ' + shift.hebrewDate);
  }
});

// The legacy employee-card source check was dropped: LegacyEmployeeCardPage.js is a frozen copy; the new (A5) card already computes the Hebrew date.
