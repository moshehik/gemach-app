// lib/idleGuard.js - בדיקות טהורות עם שעון, מסמך וחלון מזויפים (בלי דפדפן ובלי רשת), ובדיקות סטטיות שהדגימות משתמשות בשומר.
// הרצה: node scripts/idle-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = await import(pathToFileURL(path.join(ROOT, 'lib/idleGuard.js')).href);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// ---- סביבה מזויפת ----------------------------------------------------------
function makeEnv({ pathname = '/orders', ...guardOpts } = {}) {
  let t = 1_000_000;
  const timers = new Map();
  let nextId = 1;
  const reg = () => {
    const m = new Map();
    return {
      m,
      addEventListener(ev, fn) { if (!m.has(ev)) m.set(ev, new Set()); m.get(ev).add(fn); },
      fire(ev) { for (const fn of [...(m.get(ev) || [])]) fn({ type: ev }); },
    };
  };
  const doc = Object.assign(reg(), { visibilityState: 'visible', hidden: false });
  const events = [];
  const win = Object.assign(reg(), {
    location: { pathname },
    dispatchEvent(e) { events.push(e); return true; },
    fetch: async (input) => ({ network: true, input }),
  });
  const env = {
    doc, win, events,
    now: () => t,
    setIntervalFn: (fn, ms) => { const id = nextId++; timers.set(id, { fn, ms, next: t + ms }); return id; },
    clearIntervalFn: (id) => { timers.delete(id); },
    timerCount: () => timers.size,
    // מקדם את השעון; מריץ interval-ים שהגיע זמנם
    advance(ms) {
      const end = t + ms;
      for (;;) {
        let nextT = Infinity;
        for (const x of timers.values()) nextT = Math.min(nextT, x.next);
        if (nextT > end) break;
        t = nextT;
        for (const x of [...timers.values()]) if (x.next <= t) { x.next += x.ms; x.fn(); }
      }
      t = end;
    },
    hide() { doc.visibilityState = 'hidden'; doc.hidden = true; doc.fire('visibilitychange'); },
    show() { doc.visibilityState = 'visible'; doc.hidden = false; doc.fire('visibilitychange'); },
    // פעילות משתמש בעכבר; עוברים את מגבלת ה-throttle של שנייה
    poke(ev = 'pointermove') { env.advance(1100); doc.fire(ev); },
  };
  env.guard = G.createIdleGuard({
    doc, win, now: env.now, setIntervalFn: env.setIntervalFn, clearIntervalFn: env.clearIntervalFn, ...guardOpts,
  });
  return env;
}

// ---- התנהגות -----------------------------------------------------------------
test('פעיל כל עוד יש פעילות בתוך 30 דקות; אחרי 30 דקות בלי פעילות הדגימות נעצרות לגמרי', () => {
  const e = makeEnv();
  let calls = 0;
  e.guard.onActiveInterval(() => { calls++; }, 2 * MIN);
  e.advance(10 * MIN);
  assert.equal(calls, 5, 'בקצב הרגיל כל 2 דקות');
  e.advance(21 * MIN); // סה"כ 31 דקות בלי פעילות
  const atIdle = calls;
  assert.ok(atIdle <= 5 + 10, 'נעצר סמוך ל-30 דקות');
  assert.equal(e.guard.isActive(), false);
  assert.equal(e.timerCount(), 0, 'ה-interval בוטל לגמרי (אפס התעוררויות)');
  e.advance(5 * HOUR);
  assert.equal(calls, atIdle, 'שעות של חוסר פעילות = אפס קריאות');
});

test('פעילות משתמש מאפסת את מונה ה-idle: טאב עם תזוזה כל 20 דקות לא נעצר', () => {
  const e = makeEnv();
  let calls = 0;
  e.guard.onActiveInterval(() => { calls++; }, 2 * MIN);
  for (let i = 0; i < 6; i++) { e.advance(20 * MIN); e.poke(); }
  assert.equal(e.guard.isActive(), true);
  assert.ok(calls >= 55, `רץ ברציפות (קיבלנו ${calls})`);
});

test('חזרה מהשהיה: רענון מיידי אחד בלבד, ואז חזרה לקצב הרגיל', () => {
  const e = makeEnv();
  let calls = 0;
  e.guard.onActiveInterval(() => { calls++; }, 2 * MIN);
  e.advance(40 * MIN);
  const before = calls;
  assert.equal(e.timerCount(), 0);
  e.poke();
  assert.equal(calls, before + 1, 'בדיוק רענון מיידי אחד');
  assert.equal(e.timerCount(), 1, 'ה-interval חזר');
  e.poke(); e.poke(); e.poke();
  assert.equal(calls, before + 1, 'תזוזות נוספות לא מייצרות רענונים נוספים');
  e.advance(2 * MIN);
  assert.equal(calls, before + 2, 'וחזרנו לקצב הרגיל');
});

test('טאב מוסתר: נעצר מיד; חזרה לגלוי = רענון מיידי אחד (resumeStaleMs:0) גם אחרי 5 שניות', () => {
  const e = makeEnv();
  let calls = 0;
  e.guard.onActiveInterval(() => { calls++; }, 2 * MIN, { resumeStaleMs: 0 });
  e.advance(2 * MIN);
  assert.equal(calls, 1);
  e.hide();
  assert.equal(e.timerCount(), 0, 'מוסתר = בלי interval');
  assert.equal(e.guard.isActive(), false);
  e.advance(10 * MIN);
  assert.equal(calls, 1);
  e.show();
  assert.equal(calls, 2, 'רענון מיידי אחד בחזרה');
  assert.equal(e.timerCount(), 1);
});

test('בלי resumeStaleMs: חזרה מהירה לטאב (פחות מהמחזור) לא מרעננת מיד', () => {
  const e = makeEnv();
  let calls = 0;
  e.guard.onActiveInterval(() => { calls++; }, 2 * MIN);
  e.hide(); e.advance(30 * 1000); e.show();
  assert.equal(calls, 0);
  e.hide(); e.advance(3 * MIN); e.show();
  assert.equal(calls, 1, 'ישן מהמחזור - מרעננים');
});

test('הסדר: מאזין visibilitychange של הגארד רץ ב-capture (לפני מאזיני הרכיבים) ורושם פעילות', () => {
  const e = makeEnv();
  e.advance(45 * MIN);
  assert.equal(e.guard.isActive(), false);
  e.doc.visibilityState = 'visible'; e.doc.hidden = false;
  // הרשמה עם capture=true נבדקת סטטית; כאן - האיתות עצמו מחזיר את הטאב לפעיל מיד
  e.doc.fire('visibilitychange');
  assert.equal(e.guard.isActive(), true);
});

test('חריגים לפי נתיב: עמדת לקוחות / שעון נוכחות לא מושהים בגלל חוסר פעילות (אבל מוסתר כן)', () => {
  for (const p of ['/customer-interface', '/customer-interface/step2', '/punch-clock']) {
    const e = makeEnv({ pathname: p });
    let calls = 0;
    e.guard.onActiveInterval(() => { calls++; }, 2 * MIN);
    e.advance(3 * HOUR);
    assert.equal(e.guard.isActive(), true, p);
    assert.equal(calls, 90, p);
    e.hide();
    assert.equal(e.guard.isActive(), false, p + ' מוסתר');
  }
  const o = makeEnv({ pathname: '/customer-interface-evil' });
  o.advance(45 * MIN);
  assert.equal(o.guard.isActive(), false, 'תחילית חייבת להיות לפי גבול מקטע');
  assert.equal(G.isExemptPath('/punch-clocks'), false);
  assert.equal(G.isExemptPath('/orders'), false);
});

test('8 שעות בלי פעילות: נשאר מושהה, בלי רענון אוטומטי; בחזרה אירוע idleguard:resume וגם רענון אחד', () => {
  const e = makeEnv();
  let calls = 0;
  e.guard.onActiveInterval(() => { calls++; }, 2 * MIN);
  e.advance(8 * HOUR + MIN);
  const frozen = calls;
  e.advance(16 * HOUR);
  assert.equal(calls, frozen, '24 שעות - אפס קריאות, אין לולאת טעינה');
  assert.equal(e.events.length, 0, 'שום אירוע ושום reload בזמן ההשהיה');
  e.poke();
  assert.equal(calls, frozen + 1);
  const ev = e.events.find((x) => x.type === 'idleguard:resume');
  if (typeof CustomEvent === 'function') {
    assert.ok(ev, 'אירוע חזרה אחרי השהיה ארוכה');
    assert.equal(ev.detail.long, true);
  }
});

test('כמה callbacks: כל אחד עם סף משלו (stopAfterIdleMs) וחוזרים כל אחד פעם אחת', () => {
  const e = makeEnv();
  const c = { a: 0, b: 0 };
  e.guard.onActiveInterval(() => { c.a++; }, 2 * MIN);                           // 30 דקות
  e.guard.onActiveInterval(() => { c.b++; }, 2 * MIN, { stopAfterIdleMs: 10 * MIN });
  e.advance(15 * MIN);
  const bAt = c.b;
  const aAt = c.a;
  e.advance(10 * MIN);
  assert.equal(c.b, bAt, 'b (סף 10 דקות) נעצר');
  assert.ok(c.a > aAt, 'a עדיין רץ');
  e.advance(30 * MIN);
  assert.equal(e.timerCount(), 0, 'שניהם נעצרו');
  const a1 = c.a, b1 = c.b;
  e.poke();
  assert.equal(c.a, a1 + 1);
  assert.equal(c.b, b1 + 1);
});

test('stop() מבטל לגמרי: גם חזרה לפעילות לא מעירה אותו', () => {
  const e = makeEnv();
  let calls = 0;
  const stop = e.guard.onActiveInterval(() => { calls++; }, 2 * MIN);
  e.advance(2 * MIN);
  stop();
  assert.equal(e.timerCount(), 0);
  e.advance(HOUR); e.poke();
  assert.equal(calls, 1);
});

test('callback שזורק לא מפיל את השומר', () => {
  const e = makeEnv();
  let ok = 0;
  e.guard.onActiveInterval(() => { throw new Error('x'); }, 2 * MIN);
  e.guard.onActiveInterval(() => { ok++; }, 2 * MIN);
  e.advance(4 * MIN);
  assert.equal(ok, 2);
});

test('מתג חירום enabled:false - כמו לפני השומר: אין עצירת idle, אבל טאב מוסתר עדיין נעצר', () => {
  const e = makeEnv({ enabled: false });
  e.advance(10 * HOUR);
  assert.equal(e.guard.isActive(), true);
  e.hide();
  assert.equal(e.guard.isActive(), false);
  e.show();
  assert.equal(e.guard.isActive(), true);
});

test('שער light=1: בטאב מושהה בקשת דגימה לא יוצאת לרשת ומקבלת {success:false,paused:true}; בקשות רגילות כן', async () => {
  const e = makeEnv();
  e.guard.installLightPollGate(e.win);
  let r = await e.win.fetch('/api/error-report?light=1');
  assert.equal(r.network, true, 'פעיל - יוצא לרשת');
  e.advance(31 * MIN);
  r = await e.win.fetch('/api/notifications?light=1');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: false, paused: true });
  r = await e.win.fetch('/api/orders?page=1');
  assert.equal(r.network, true, 'בקשה שאינה light=1 לא נחסמת (זיהוי התנתקות בפעולה הבאה)');
  e.poke();
  r = await e.win.fetch('/api/error-report?light=1');
  assert.equal(r.network, true, 'אחרי פעילות - חוזר לרשת');
  e.hide();
  r = await e.win.fetch({ url: '/api/notifications?light=1' });
  assert.equal(r.status, 200, 'Request-like ומוסתר - נחסם');
});

test('שער light=1: התקנה כפולה בטוחה ובלתי הפיכה בביטול', async () => {
  const e = makeEnv();
  const base = e.win.fetch;
  const off = e.guard.installLightPollGate(e.win);
  const second = e.guard.installLightPollGate(e.win);
  assert.notEqual(e.win.fetch, base);
  second();
  off();
  assert.equal(e.win.fetch, base);
});

test('בשרת (בלי window) isUserActive=true ו-onActiveInterval הוא no-op', () => {
  assert.equal(typeof window, 'undefined');
  assert.equal(G.isUserActive(), true);
  const stop = G.onActiveInterval(() => { throw new Error('לא אמור לרוץ'); }, 1000);
  assert.equal(typeof stop, 'function');
  stop();
});

test('ברירות המחדל: 30 דקות / 8 שעות / חריגים', () => {
  assert.equal(G.IDLE_AFTER_MS, 30 * MIN);
  assert.equal(G.LONG_IDLE_MS, 8 * HOUR);
  assert.deepEqual(G.IDLE_EXEMPT_PATHS, ['/customer-interface', '/punch-clock']);
  assert.equal(G.IDLE_GUARD_ENABLED, true);
});

// ---- סטטי: הדגימות משתמשות בשומר ---------------------------------------------------
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('סטטי: כל הדגימות שנמצאו בסקר משתמשות ב-onActiveInterval ולא ב-setInterval חשוף', () => {
  const polls = [
    'lib/pollClient.js', // הדוגם המשותף (פעמונים + דיווח תקלות) - docs/cpu-phase1a-poll-2026-10-06.md
    'app/components/OverdueRemindersWatcher.js',
    'app/admin/backups/page.js',
    'app/admin/database/page.js',
  ];
  for (const f of polls) {
    const c = code(read(f));
    assert.match(c, /from '(@\/lib|\.)\/idleGuard(\.js)?'/, f);
    assert.match(c, /onActiveInterval\(/, f);
    assert.ok(!/\bsetInterval\(/.test(c), `${f}: נשאר setInterval חשוף`);
  }
  const orders = code(read('app/orders/page.js'));
  assert.match(orders, /onActiveInterval\(\(\) => setNowTick/);
});

test('סטטי: הפעמונים ודיווח התקלות דוגמים דרך הדוגם המשותף (lib/pollClient.js) שמתעורר מיד בחזרה (resumeStaleMs: 0), כל 300 שנ\'', () => {
  const poll = code(read('lib/pollClient.js'));
  assert.match(poll, /onActiveInterval\(\(\) => \{ refresh\(\); \}, intervalMs, \{ resumeStaleMs: 0 \}\)/);
  assert.match(poll, /POLL_INTERVAL_MS = 300000/);
  for (const f of ['app/components/NotificationBell.js', 'app/components/menu/MenuBell.js', 'app/components/ErrorReportButton.js']) {
    assert.match(code(read(f)), /usePollSnapshot/, f);
  }
});

test('סטטי: הקבצים הישנים הקפואים לא נערכו (LegacyErrorReportButton נשאר עם הלולאה שלו; השער מכסה אותה)', () => {
  const legacy = read('app/components/LegacyErrorReportButton.js');
  assert.match(legacy, /fetchReports\(\{ light: true \}\), 120000\)/);
  assert.ok(!/idleGuard/.test(legacy), 'לא נוגעים בעותק הקפוא');
  // הוא נטען רק דרך ErrorReportButton, שמייבא את השומר (וכך מתקין את שער ה-light=1)
  assert.match(read('app/components/ErrorReportButton.js'), /LegacyErrorReportFrame/);
  assert.match(read('app/components/ErrorReportButton.js'), /@\/lib\/pollClient/); // מייבא את הדוגם, שמייבא את השומר (וכך מתקין את שער ה-light=1)
  assert.match(read('lib/pollClient.js'), /from '\.\/idleGuard\.js'/);
  assert.ok(!/idleGuard/.test(read('app/orders/[id]/LegacyOrderPage.js')));
  assert.ok(!/idleGuard/.test(read('app/orders/new/LegacyNewOrderPage.js')));
});

test('סטטי: מאזין ה-visibilitychange של השומר רשום ב-capture, ובקשת light=1 היא המוסכמה הקיימת של layout', () => {
  const g = read('lib/idleGuard.js');
  assert.match(g, /addEventListener\('visibilitychange', onVisibility, true\)/);
  assert.match(g, /passive: true, capture: true/);
  assert.match(read('app/layout.js'), /url\.indexOf\('light=1'\) === -1/);
});

test('סטטי: לא נגעו ב-apiCache ובלייאאוט (ענפים מקבילים) והקריאות המוגנות נשארות על ה-API הקיים', () => {
  const cache = read('lib/apiCache.js');
  assert.match(cache, /const FOCUS_STALE_MS = 60 \* 1000;/);
  assert.ok(!/idleGuard/.test(cache));
  assert.ok(!/idleGuard/.test(read('app/layout.js')));
});
