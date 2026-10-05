// lib/pollClient.js - הדוגם המשותף בצד הלקוח: שעון, מסמך וחלון מזויפים (lib/idleGuard.js האמיתי), fetch מזויף. בלי דפדפן ובלי רשת.
// הרצה: node scripts/poll-client.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(pathToFileURL(path.join(ROOT, 'lib/pollClient.js')).href);
const G = await import(pathToFileURL(path.join(ROOT, 'lib/idleGuard.js')).href);
const MIN = 60 * 1000;

// ---- סביבה מזויפת: שעון + טיימרים + מסמך + שומר idle אמיתי + fetch --------------------------
function makeEnv({ responses } = {}) {
  let t = 1_000_000;
  const timers = new Map();
  let nextId = 1;
  const reg = () => {
    const m = new Map();
    return { m, addEventListener(ev, fn) { if (!m.has(ev)) m.set(ev, new Set()); m.get(ev).add(fn); }, fire(ev) { for (const fn of [...(m.get(ev) || [])]) fn({ type: ev }); } };
  };
  const doc = Object.assign(reg(), { visibilityState: 'visible', hidden: false });
  const win = Object.assign(reg(), { location: { pathname: '/orders' }, dispatchEvent() { return true; } });
  const setIntervalFn = (fn, ms) => { const id = nextId++; timers.set(id, { fn, ms, next: t + ms }); return id; };
  const clearIntervalFn = (id) => { timers.delete(id); };
  const guard = G.createIdleGuard({ doc, win, now: () => t, setIntervalFn, clearIntervalFn });

  const requests = [];
  const queue = [...(responses || [])];
  const mk = (data, { status = 200, limited = false } = {}) => ({
    status, ok: status >= 200 && status < 300,
    headers: { get: (k) => (limited && k === 'X-Poll-Limited' ? '1' : null) },
    json: async () => data,
  });
  const body = (er = 1, nf = 2) => ({ success: true, errorReports: { unread: er, isProgrammer: false, isManager: true }, notifications: { unread: nf } });
  const fetchFn = async (url) => {
    requests.push(url);
    await Promise.resolve();
    const next = queue.length ? queue.shift() : mk(body());
    return typeof next === 'function' ? next(mk) : next;
  };

  // טיימרי setTimeout (לרענון אחרי פעולה) - נפרדים מ-intervals
  const timeouts = new Map();
  const setTimeoutFn = (fn, ms) => { const id = nextId++; timeouts.set(id, { fn, at: t + ms }); return id; };
  const clearTimeoutFn = (id) => { timeouts.delete(id); };

  const poller = P.createPoller({
    fetchFn, now: () => t, setTimeoutFn, clearTimeoutFn,
    onActiveInterval: (fn, ms, opts) => guard.onActiveInterval(fn, ms, opts),
  });
  const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };
  const env = {
    poller, doc, win, guard, requests, mk, body, queue, flush,
    intervals: () => timers.size,
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = [...timers.entries(), ...timeouts.entries()].map(([id, x]) => ({ id, x, when: x.next ?? x.at })).filter((d) => d.when <= end).sort((a, b) => a.when - b.when)[0];
        if (!due) break;
        t = due.when;
        if (due.x.next !== undefined) { due.x.next += due.x.ms; due.x.fn(); } else { timeouts.delete(due.id); due.x.fn(); }
        await flush();
      }
      t = end;
      await flush();
    },
    setHidden(h) { doc.visibilityState = h ? 'hidden' : 'visible'; doc.hidden = h; doc.fire('visibilitychange'); },
    activity() { win.fire('focus'); doc.fire('pointermove'); },
  };
  return env;
}

test('ברירות המחדל: 300 שנ\', כתובת עם light=1, fresh', () => {
  assert.equal(P.POLL_INTERVAL_MS, 300000);
  assert.equal(P.POLL_URL, '/api/poll?light=1');
  assert.equal(P.POLL_URL_FRESH, '/api/poll?light=1&fresh=1');
});

test('שני מנויים שעולים יחד = בקשה אחת בהתחלה, ובקשה אחת בכל מחזור', async () => {
  const e = makeEnv();
  const a = []; const b = [];
  e.poller.subscribe((s) => a.push(s));
  e.poller.subscribe((s) => b.push(s));
  await e.flush();
  assert.equal(e.requests.length, 1, 'כפתור + פעמון: בקשה אחת');
  assert.equal(a.at(-1).notifications.unread, 2);
  assert.equal(b.at(-1).errorReports.unread, 1);
  assert.equal(e.intervals(), 1, 'טיימר אחד לטאב');
  await e.advance(5 * MIN);
  assert.equal(e.requests.length, 2);
  await e.advance(5 * MIN);
  assert.equal(e.requests.length, 3);
  assert.deepEqual(e.requests, ['/api/poll?light=1', '/api/poll?light=1', '/api/poll?light=1']);
});

test('לא דוגם לפני 5 דקות (לא כל 120 שנ\')', async () => {
  const e = makeEnv();
  e.poller.subscribe(() => {});
  await e.flush();
  await e.advance(4 * MIN + 59 * 1000);
  assert.equal(e.requests.length, 1);
  await e.advance(2000);
  assert.equal(e.requests.length, 2);
});

test('מנוי מאוחר מקבל מיד את התוצאה האחרונה, בלי בקשה חדשה', async () => {
  const e = makeEnv();
  e.poller.subscribe(() => {});
  await e.flush();
  await e.advance(3000);
  const seen = [];
  e.poller.subscribe((s) => seen.push(s));
  await e.flush();
  assert.equal(seen.length >= 1, true);
  assert.equal(seen[0].notifications.unread, 2);
  assert.equal(e.requests.length, 1);
  assert.equal(e.poller.listenerCount(), 2);
});

test('טאב מוסתר: אין בקשות; חזרה לגלוי: בקשה מיידית אחת', async () => {
  const e = makeEnv();
  e.poller.subscribe(() => {});
  await e.flush();
  e.setHidden(true);
  assert.equal(e.intervals(), 0, 'הטיימר בוטל לגמרי');
  await e.advance(20 * MIN);
  assert.equal(e.requests.length, 1, 'אין בקשות בטאב מוסתר');
  e.setHidden(false);
  await e.flush();
  assert.equal(e.requests.length, 2, 'רענון מיידי אחד בחזרה');
  await e.advance(5 * MIN);
  assert.equal(e.requests.length, 3, 'וחוזרים לקצב הרגיל');
});

test('טאב גלוי שנשכח (30 דקות בלי פעילות): נעצר; תזוזה: רענון מיידי אחד', async () => {
  const e = makeEnv();
  e.poller.subscribe(() => {});
  await e.flush();
  // 31 דקות בלי פעילות: ~6 דגימות (כל 5 דק') ואז עצירה
  await e.advance(31 * MIN);
  const before = e.requests.length;
  assert.ok(before >= 5 && before <= 8, `דגימות עד העצירה: ${before}`);
  assert.equal(e.intervals(), 0, 'הטיימר בוטל');
  await e.advance(3 * 60 * MIN);
  assert.equal(e.requests.length, before, 'שעות של חוסר פעילות = אפס בקשות');
  e.activity();
  await e.flush();
  assert.equal(e.requests.length, before + 1, 'בקשה מיידית אחת בחזרה');
  await e.advance(5 * MIN);
  assert.equal(e.requests.length, before + 2);
});

test('אחרי פעולה של המשתמש: רענון מיידי (דחוי שנייה) עם fresh=1; רצף פעולות = בקשה אחת', async () => {
  const e = makeEnv();
  e.poller.subscribe(() => {});
  await e.flush();
  await e.advance(30 * 1000);
  e.poller.afterAction();
  e.poller.afterAction();
  e.poller.afterAction();
  await e.advance(500);
  assert.equal(e.requests.length, 1, 'עוד לא (דחייה של שנייה)');
  await e.advance(700);
  assert.equal(e.requests.length, 2);
  assert.equal(e.requests[1], '/api/poll?light=1&fresh=1');
});

test('רענון כפוי בזמן שבקשה בדרך: אחת נוספת מיד אחריה (התשובה שבדרך אולי קדמה לפעולה)', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const e = makeEnv({ responses: [async () => 0] });
  e.queue.length = 0;
  e.queue.push((mk) => gate.then(() => mk(e.body(5, 5))), (mk) => mk(e.body(1, 1)));
  e.poller.subscribe(() => {});
  await e.flush();
  assert.equal(e.requests.length, 1);
  const forced = e.poller.refresh({ force: true });
  await e.flush();
  assert.equal(e.requests.length, 1, 'ממתינים לבקשה שבדרך');
  release();
  await forced;
  assert.equal(e.requests.length, 2);
  assert.equal(e.requests[1], '/api/poll?light=1&fresh=1');
  assert.equal(e.poller.getSnapshot().notifications.unread, 1, 'התוצאה האחרונה (אחרי הפעולה) מנצחת');
});

test('רענון לא-כפוי עם maxAgeMs: מדלג אם דגמנו לאחרונה (ניווט), ושולח אם עבר הזמן', async () => {
  const e = makeEnv();
  e.poller.subscribe(() => {});
  await e.flush();
  await e.advance(20 * 1000);
  await e.poller.refresh({ maxAgeMs: 60000 });
  assert.equal(e.requests.length, 1);
  await e.advance(50 * 1000);
  await e.poller.refresh({ maxAgeMs: 60000 });
  assert.equal(e.requests.length, 2);
  // שתי קריאות במקביל = אחת
  e.poller.refresh({ maxAgeMs: 0 }); e.poller.refresh({ maxAgeMs: 0 });
  await e.flush();
  assert.equal(e.requests.length, 3);
});

test('ביטול המנוי האחרון עוצר את הטיימר ואת הרענון הדחוי', async () => {
  const e = makeEnv();
  const off = e.poller.subscribe(() => {});
  await e.flush();
  e.poller.afterAction();
  off();
  assert.equal(e.intervals(), 0);
  await e.advance(10 * MIN);
  assert.equal(e.requests.length, 1);
});

test('401: מפסיקים לדגום ומסמנים authFailed; רענון מפורש (ניווט) מנסה שוב ומשחזר', async () => {
  const e = makeEnv({ responses: [(mk) => mk({ success: false }, { status: 401 })] });
  const seen = [];
  e.poller.subscribe((s) => seen.push(s));
  await e.flush();
  assert.equal(e.poller.getSnapshot().authFailed, true);
  assert.equal(e.intervals(), 0);
  await e.advance(30 * MIN);
  assert.equal(e.requests.length, 1, 'לא ממשיכים לדגום בלי משתמש');
  e.activity(); // ניווט = פעילות של המשתמש (אחרת השומר היה רואה טאב שנשכח)
  await e.poller.refresh({ maxAgeMs: 60000 });
  assert.equal(e.requests.length, 2, 'ניווט אחרי דקה מנסה שוב');
  assert.equal(e.poller.getSnapshot().authFailed, false);
  assert.equal(e.intervals(), 1, 'הטיימר חזר');
});

test('תשובת paused של שער ה-idle, שגיאת רשת ו-500: לא משנים את המונה', async () => {
  const e = makeEnv();
  e.poller.subscribe(() => {});
  await e.flush();
  const known = e.poller.getSnapshot();
  e.queue.push((mk) => mk({ success: false, paused: true }));
  await e.poller.refresh({ force: true });
  await e.advance(2000);
  e.queue.push(() => { throw new Error('offline'); });
  await e.poller.refresh({ force: true });
  await e.advance(2000);
  e.queue.push((mk) => mk({}, { status: 500 }));
  await e.poller.refresh({ force: true });
  assert.equal(e.poller.getSnapshot().notifications.unread, known.notifications.unread);
  assert.equal(e.poller.getSnapshot().authFailed, false);
});

test('X-Poll-Limited: השרת הגיש מטמון - לא דורס מונה שכבר ידוע (אבל כן מאתחל כשאין)', async () => {
  const e = makeEnv({ responses: [(mk) => mk(e0(7, 7), { limited: true })] });
  function e0(a, b) { return { success: true, errorReports: { unread: a, isProgrammer: false, isManager: false }, notifications: { unread: b } }; }
  e.poller.subscribe(() => {});
  await e.flush();
  assert.equal(e.poller.getSnapshot().notifications.unread, 7, 'אין מונה ידוע - מקבלים');
  e.queue.push((mk) => mk(e0(1, 1), { limited: true }));
  await e.poller.refresh({ force: true });
  assert.equal(e.poller.getSnapshot().notifications.unread, 7, 'ידוע - המונה לא נדרס');
  e.queue.push((mk) => mk(e0(2, 2)));
  await e.advance(2000);
  await e.poller.refresh({ force: true });
  assert.equal(e.poller.getSnapshot().notifications.unread, 2);
});

test('חלק אחד null (שגיאת שרת חלקית): החלק האחר מתעדכן והישן נשמר', async () => {
  const e = makeEnv();
  e.poller.subscribe(() => {});
  await e.flush();
  e.queue.push((mk) => mk({ success: true, errorReports: null, notifications: { unread: 9 } }));
  await e.poller.refresh({ force: true });
  const s = e.poller.getSnapshot();
  assert.equal(s.notifications.unread, 9);
  assert.equal(s.errorReports.unread, 1);
  assert.equal(s.errorReports.known, true);
});

test('כל תוצאה מקדמת rev (הרכיבים מסנכרנים מצב מקומי/אופטימי מחדש גם כשהמספר זהה)', async () => {
  const e = makeEnv();
  e.poller.subscribe(() => {});
  await e.flush();
  const r1 = e.poller.getSnapshot().notifications.rev;
  await e.advance(5 * MIN);
  assert.ok(e.poller.getSnapshot().notifications.rev > r1);
});

test('בשרת (בלי window): getPoller=null, pollRefresh/pollAfterAction no-op', async () => {
  assert.equal(typeof window, 'undefined');
  assert.equal(P.getPoller(), null);
  P.pollAfterAction();
  const s = await P.pollRefresh({ force: true });
  assert.equal(s, P.EMPTY_SNAPSHOT);
});

// ---- סטטי: הרכיבים משתמשים בדוגם המשותף ---------------------------------------------------------------
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('סטטי: שלושת הרכיבים משתמשים בדוגם המשותף ולא מדגמים בעצמם', () => {
  for (const f of ['app/components/ErrorReportButton.js', 'app/components/NotificationBell.js', 'app/components/menu/MenuBell.js']) {
    const c = code(read(f));
    assert.match(c, /usePollSnapshot/, `${f}: מנוי לדוגם`);
    assert.match(c, /lib\/usePoll/, `${f}: מייבא את ה-hook`);
    assert.ok(!/\bsetInterval\(/.test(c), `${f}: אין setInterval`);
    assert.ok(!/onActiveInterval/.test(c), `${f}: אין טיימר פרטי`);
    assert.ok(!/fetch\('\/api\/notifications\?light=1'\)/.test(c), `${f}: אין דגימת light ישנה`);
    assert.ok(!/fetch\('\/api\/error-report\?light=1'\)/.test(c), `${f}: אין דגימת light ישנה`);
  }
});

test('סטטי: הפעמונים והדיווחים מרעננים מיד אחרי פעולה של המשתמש', () => {
  assert.match(code(read('app/components/NotificationBell.js')), /pollAfterAction\(\)/);
  assert.match(code(read('app/components/menu/MenuBell.js')), /pollAfterAction\(\)/);
  assert.match(code(read('app/components/ErrorReportButton.js')), /pollAfterAction\(\)/);
  assert.match(code(read('app/messages/page.js')), /pollAfterAction\(\)/);
});

test('סטטי: הדוגם משתמש בשומר ה-idle, וכתובת הדגימה כוללת light=1 (לא נרשמת ב-PageVisitLog ועוברת בשער)', () => {
  const c = code(read('lib/pollClient.js'));
  assert.match(c, /from '\.\/idleGuard\.js'/);
  assert.match(c, /onActiveInterval\(/);
  assert.match(c, /resumeStaleMs: 0/);
  assert.ok(!/\bsetInterval\(/.test(c));
  assert.match(read('app/layout.js'), /url\.indexOf\('light=1'\) === -1/);
});

test('סטטי: הקובץ הקפוא LegacyErrorReportButton לא נערך (ממשיך לדגום בעצמו; שער ה-idle מכסה אותו)', () => {
  const legacy = read('app/components/LegacyErrorReportButton.js');
  assert.match(legacy, /fetchReports\(\{ light: true \}\), 120000\)/);
  assert.ok(!/pollClient|usePoll/.test(legacy));
});
