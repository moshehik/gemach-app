// טולטיפים בכרטיס ההזמנה לפי הדמו (הערת הבעלים 2026-10-06: "כל הטולטיפים נראים אותו דבר, בדמו היו הבדלים"): לוגיקה טהורה (parts/ocTipLogic.js, tipifyRoot)
// + בדיקות סטטיות לחיווט (useCardTooltips / OcRichTips / OcRichCard / הרייל). הדמו: טולטיפ פשוט #tt (data-tip, tipify, מגע, .tip) וכרטיס עשיר #rt (data-rich; .gold בסרגל).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const read = (p) => fs.readFileSync(path.join(PROJ, p), 'utf8').split('\r\n').join('\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const OC = 'app/components/order-card';
const T = await import(pathToFileURL(path.join(PROJ, OC, 'parts/ocTipLogic.js')).href);
const H = await import(pathToFileURL(path.join(PROJ, OC, 'hooks/useCardTooltips.js')).href);

test('ICON_TIP = בדיוק המפה של הדמו (שורה 4335)', () => {
  assert.deepEqual(T.ICON_TIP, { pencil: 'עריכה', trash: 'מחיקה', chev: 'פרטים', print: 'הדפסה', lock: 'נעילה', back: 'חזרה', x: 'סגירה', swap: 'החלפה', ext: 'פתיחה', bk: 'ביטול השינוי', plus: 'הוספה', check: 'אישור', undo: 'ביטול', mail: 'מייל', card: 'תשלום', cart: 'שינויים' });
});

test('tipLabelFor (tipify): רק לחצן-אייקון בלי טקסט ובלי data-tip; aria-label > title > ICON_TIP; לחצן עם טקסט / .tip / data-tip = אין', () => {
  assert.equal(T.tipLabelFor({ text: '', ariaLabel: 'עריכת פריט', icon: 'pencil' }), 'עריכת פריט');
  assert.equal(T.tipLabelFor({ text: ' ', title: 'כותרת', icon: 'pencil' }), 'כותרת');
  assert.equal(T.tipLabelFor({ text: '', icon: 'trash' }), 'מחיקה');
  assert.equal(T.tipLabelFor({ text: '', icon: 'unknown' }), '');
  assert.equal(T.tipLabelFor({ text: 'שמור', ariaLabel: 'x', icon: 'check' }), '');
  assert.equal(T.tipLabelFor({ text: '', hasTip: true, icon: 'trash' }), '');
  assert.equal(T.tipLabelFor({ text: '', isTipBtn: true, icon: 'info' }), '');
});

function fakeBtn({ text = '', aria = '', title = '', href = '', tip = '', cls = [], rich = false }) {
  const attrs = new Map();
  if (aria) attrs.set('aria-label', aria);
  if (title) attrs.set('title', title);
  if (rich) attrs.set('data-rich', 'x');
  return {
    dataset: tip ? { tip } : {}, textContent: text, classList: { contains: (c) => cls.includes(c) },
    querySelector: () => (href ? { getAttribute: () => href } : null), hasAttribute: (n) => attrs.has(n), getAttribute: (n) => (attrs.has(n) ? attrs.get(n) : null),
    removeAttribute: (n) => attrs.delete(n), setAttribute: (n, v) => attrs.set(n, v), attrs,
  };
}
test('tipifyRoot: לחצן-אייקון מקבל data-tip + data-ico + aria-label; title מוסר; לחצן עם טקסט מאבד title; data-rich ו-.tip לא נוגעים', () => {
  const a = fakeBtn({ href: '#gmi-trash' });
  const b = fakeBtn({ aria: 'עריכה', title: 'ישן', href: '#gmi-pencil' });
  const c = fakeBtn({ text: 'שמור', title: 'x', href: '#gmi-check' });
  const d = fakeBtn({ href: '#gmi-info', cls: ['tip'] });
  const e = fakeBtn({ href: '#gmi-card', rich: true });
  const root = { querySelectorAll: () => [a, b, c, d, e] };
  assert.equal(H.tipifyRoot(root), 2);
  assert.equal(a.dataset.tip, 'מחיקה');
  assert.equal(a.dataset.ico, 'trash');
  assert.equal(a.attrs.get('aria-label'), 'מחיקה');
  assert.equal(b.dataset.tip, 'עריכה');
  assert.ok(!b.attrs.has('title'));
  assert.ok(!c.dataset.tip && !c.attrs.has('title'), 'לחצן עם טקסט: בלי טולטיפ, title מוסר');
  assert.ok(!d.dataset.tip, 'לחצן עזרה .tip לא נוגעים');
  assert.ok(!e.dataset.tip, 'data-rich נשאר כרטיס עשיר');
});

test('railRichRows: חתימה / משלוח / פריטים / תשלום / שינוי - עובדות בלבד', () => {
  const order = { hasSignedRegulations: true, isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', deliveryAddress: 'עמוס 14' };
  assert.deepEqual(T.railRichRows('sig', '', { order }).map((r) => r.text), ['נחתם', 'לחצו לשינוי']);
  assert.equal(T.railRichRows('sig', '', { order: {} })[0].text, 'לא נחתם');
  assert.deepEqual(T.railRichRows('del', '', { order }).map((r) => r.text), ['הלוך-חזור · ירושלים', 'עמוס 14']);
  const items = [{ dressItem: { dress: { name: '4512' } }, sizeText: '38', isTaken: true }, { description: '3136', sizeText: '40', isReturned: true }, { dressItem: { dress: { name: '2740' } }, sizeText: '42', isDeleted: true }];
  const it = T.railRichRows('items', '', { order, items });
  assert.deepEqual(it.map((r) => r.text), ['דגם 4512 · מידה 38', 'דגם 3136 · מידה 40']);
  assert.deepEqual(it.map((r) => r.icon), ['truck', 'check']);
  const pay = T.railRichRows('pay', '', { payments: [{ id: 'p1', amount: 300, method: 'מזומן', paymentDate: '2026-10-05T10:00:00Z' }, { id: 'p2', amount: -50, isRefund: true, method: 'אשראי' }, { id: 'p3', amount: 9, isDeleted: true }], balance: 120 });
  assert.match(pay[0].text, /מזומן · ₪300/);
  assert.equal(pay[1].icon, 'undo');
  assert.ok(pay.some((r) => r.text === 'חוב ₪120') && pay[pay.length - 1].text === 'לחצו למעבר לתשלומים');
  assert.deepEqual(T.railRichRows('chg', 'k1', { changes: [{ key: 'k1', icon: 'cal', note: 'ה׳ ← ו׳' }] }), [{ icon: 'cal', text: 'ה׳ ← ו׳' }]);
  assert.deepEqual(T.railRichRows('chg', 'zz', { changes: [] }), []);
  assert.deepEqual(T.parseRichSpec('chg|item:add:1'), { kind: 'chg', arg: 'item:add:1' });
  assert.deepEqual(T.parseRichSpec('sig'), { kind: 'sig', arg: '' });
});

test('placeTip: מעל מרכז הרכיב; מתהפך מתחת מתחת לתפריט העליון; side מימין/משמאל במסך רחב ו-above בצר; גבולות מסך', () => {
  const env = { vw: 1280, vh: 800, navBottom: 64 };
  const a = T.placeTip({ left: 600, right: 640, top: 300, bottom: 330, width: 40, height: 30 }, 200, 60, env);
  assert.equal(a.side, 't');
  assert.equal(a.y, 300 - 8 - 60);
  const f = T.placeTip({ left: 600, right: 640, top: 90, bottom: 120, width: 40, height: 30 }, 200, 60, env);
  assert.equal(f.side, 'b', 'מתהפך מתחת (top-gap-h=22 < 72)');
  assert.equal(f.y, 128);
  const noNav = T.placeTip({ left: 600, right: 640, top: 40, bottom: 70, width: 40, height: 30 }, 200, 20, { vw: 1280, vh: 800, navBottom: 0 });
  assert.equal(noNav.side, 't', 'בלי תפריט: מעל כרגיל');
  const r = T.placeTip({ left: 100, right: 400, top: 300, bottom: 340, width: 300, height: 40 }, 220, 100, env, 'side');
  assert.equal(r.side, 'r');
  assert.equal(r.x, 412);
  const l = T.placeTip({ left: 900, right: 1260, top: 300, bottom: 340, width: 360, height: 40 }, 220, 100, env, 'side');
  assert.equal(l.side, 'l');
  assert.equal(l.x, 900 - 12 - 220);
  assert.equal(T.placeTip({ left: 100, right: 400, top: 300, bottom: 340, width: 300, height: 40 }, 220, 100, { vw: 375, vh: 700, navBottom: 58 }, 'side').side, 't', 'במסך צר: above');
  assert.ok(T.placeTip({ left: 0, right: 20, top: 300, bottom: 320, width: 20, height: 20 }, 200, 40, env).x >= 8);
});

test('חיווט: useCardTooltips (hover/focus/touch 1.4s/.tip 3.5s/Escape/scroll/tipify/aria-describedby), OcRichTips (delegated, touch two-tap, gold ב-.rail), OcRichCard (role=tooltip, flip)', () => {
  const h = strip(read(`${OC}/hooks/useCardTooltips.js`));
  for (const s of ["'mouseover'", "'focusin'", "'touchstart'", "'click'", "e.key === 'Escape'", "'scroll'", 'show(b, 1400)', 'show(tp, 3500)', "setAttribute('aria-describedby'", 'new MutationObserver']) assert.ok(h.includes(s), s);
  assert.match(h, /placeTip\(.*'above', 10\)/);
  const r = strip(read(`${OC}/OcRichTips.js`));
  assert.match(r, /isTouchDevice(/);
  assert.match(r, /closest\('\.rail'\)/);
  assert.match(r, /mode="side"/);
  assert.match(r, /!t\.closest\('\.tlx'\)/, 'צמתי הציר מטופלים ב-OcStepper');
  const c = strip(read(`${OC}/OcRichCard.js`));
  assert.match(c, /role="tooltip"/);
  assert.match(c, /navBottomOf/);
  assert.match(strip(read(`${OC}/parts/ocTipLogic.js`)), /\[data-sticky-nav\]/);
  assert.match(c, /\$\{gold \? ' gold' : ''\}/);
  const a5 = strip(read(`${OC}/OrderCardA5.js`));
  assert.match(a5, /useCardTooltips\(rootRef, ttRef\);/);
  assert.ok(!/usePageTooltip/.test(a5));
  assert.match(a5, /<OcRichTips rootRef=\{rootRef\}/);
  assert.match(a5, /<div className="pl-tt" id="oc-pl-tt" role="tooltip" ref=\{ttRef\} \/>/);
  assert.match(strip(read(`${OC}/OcStepper.js`)), /<OcRichCard /);
});

test('הרייל: ארבעת האריחים ושורות השינויים הם כרטיסים עשירים (data-rich), לא data-tip; לחצני undo / redo נשארים טולטיפ פשוט', () => {
  const rail = strip(read(`${OC}/parts/OcRail.js`));
  for (const k of ['sig', 'del', 'items', 'pay']) assert.ok(rail.includes(`data-rich="${k}"`), k);
  assert.match(rail, /data-rich=\{`chg\|\$\{c\.key\}`\}/);
  assert.ok(!/gl sig[^>]*data-tip=/.test(rail) && !/gl pay[^>]*data-tip=/.test(rail));
  assert.match(rail, /data-act="undo" data-k=\{c\.key\} data-ico="bk" data-tip="ביטול השינוי"/);
  assert.match(rail, /data-act="redo" data-ico="redo" data-tip="החזר ביטול"/);
  const css = read('design-system/components.css');
  assert.ok(css.includes('.gm-ds .pl-rt.gold{') && css.includes('.gm-ds .pl-tt{'));
});

test('מגע: isTouchDevice (matchMedia(hover:none)) ו-richClickDecision - שתי הקשות: ראשונה מציגה (בלי פעולה), שנייה סוגרת / מפעילה לחצן; בעכבר אין התערבות', () => {
  const mm = (matches) => (q) => ({ matches: q === '(hover:none)' ? matches : false });
  assert.equal(T.isTouchDevice(mm(true)), true);
  assert.equal(T.isTouchDevice(mm(false)), false);
  assert.equal(T.isTouchDevice(null), false);
  assert.equal(T.isTouchDevice(undefined), false);
  const d = (o) => T.richClickDecision({ touch: true, onAnchor: true, inButton: false, buttonIsAnchor: false, isCurrent: false, ...o });
  assert.equal(d({}), 'show', 'הקשה ראשונה על אריח שאינו לחצן: מציגה');
  assert.equal(d({ isCurrent: true }), 'hide', 'הקשה שנייה על אריח שאינו לחצן: סוגרת');
  assert.equal(d({ inButton: true, buttonIsAnchor: true }), 'show', 'הקשה ראשונה על אריח-לחצן (חתימה / תשלום): מציגה ולא מפעילה');
  assert.equal(d({ inButton: true, buttonIsAnchor: true, isCurrent: true }), 'none', 'הקשה שנייה על אריח-לחצן: הפעולה רצה');
  assert.equal(d({ inButton: true, buttonIsAnchor: false }), 'none', 'לחצן פנימי אחר (בטל שינוי) מתנהג כרגיל');
  assert.equal(d({ onAnchor: false }), 'hide', 'הקשה מחוץ לעוגן סוגרת');
  assert.equal(d({ touch: false }), 'none', 'בעכבר: אין התערבות');
  assert.equal(d({ touch: false, onAnchor: false }), 'hide');
  const r = strip(read(`${OC}/OcRichTips.js`));
  for (const h of ['const over = (e) => { if (touch()) return;', 'const out = (e) => { if (touch()) return;', 'const fin = (e) => { if (touch()) return;', 'const fout = (e) => { if (touch()) return;']) assert.ok(r.includes(h), h);
  assert.match(r, /richClickDecision\(\{ touch: touch\(\)/);
});
