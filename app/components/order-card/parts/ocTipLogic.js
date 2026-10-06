// ocTipLogic — לוגיקה טהורה של הטולטיפים בכרטיס ההזמנה, לפי העיצוב המאושר (תצוגות-עיצוב/כרטיס-הזמנה.html). בדמו שני סוגי טולטיפ:
//   1. טולטיפ פשוט #tt (= .pl-tt בפלטה): טקסט קצר מ-data-tip; מתווסף אוטומטית לכל לחצן-אייקון בלי טקסט (tipify, שורות 4335-4347: aria-label / title / ICON_TIP).
//      מגע: touchstart על button[data-tip] מציג 1.4 ש׳; לחיצה על לחצן עזרה .tip מציגה 3.5 ש׳ (שורות 4220, 4348). מיקום: מעל המרכז, מתהפך מתחת (שורה 4210).
//   2. כרטיס עשיר #rt (= .pl-rt בפלטה): שורות .rr1 עם אייקון, מ-data-rich="סוג|ארגומנט" (richHTML, שורות 4125-4200): צמתי הציר, סמן "היום", לחצן המשמרת ביומן,
//      ובסרגל הסיכום (גרסת .gold): ארבעת האריחים (חתימה / משלוח / פריטים / תשלום) ושורות השינויים והתשלומים. מיקום: צמתי הציר מעל (מתהפך מתחת);
//      שאר הכרטיסים מימין/משמאל לרכיב במסך רחב (>=700), אחרת מעל/מתחת (placeRich, שורות 4175-4198).
// כאן: ICON_TIP, ההחלטה על טקסט הטולטיפ של לחצן-אייקון, שורות הכרטיסים העשירים של הסרגל (עובדות בלבד - בלי פרטים בדויים), והמיקום (כולל היפוך מתחת לתפריט העליון).
import { shortHebrew } from './ocHistoryModel';
import { getHebrewDateString } from '../../../../lib/hebrewDate';

// בדיוק כמו ICON_TIP בדמו (שורה 4335)
export const ICON_TIP = { pencil: 'עריכה', trash: 'מחיקה', chev: 'פרטים', print: 'הדפסה', lock: 'נעילה', back: 'חזרה', x: 'סגירה', swap: 'החלפה', ext: 'פתיחה', bk: 'ביטול השינוי', plus: 'הוספה', check: 'אישור', undo: 'ביטול', mail: 'מייל', card: 'תשלום', cart: 'שינויים' };

/** טקסט הטולטיפ של לחצן-אייקון (tipify): רק כשאין טקסט נראה ואין data-tip; aria-label, אחרת title, אחרת ICON_TIP[אייקון]. '' = אין טולטיפ. */
export function tipLabelFor({ text = '', hasTip = false, isTipBtn = false, ariaLabel = '', title = '', icon = '' } = {}) {
  if (hasTip || isTipBtn) return '';
  if (String(text).replace(/\s+/g, '').trim()) return '';
  return ariaLabel || title || ICON_TIP[icon] || '';
}

const plural = (n, one, many) => (n === 1 ? one : `${n} ${many}`);
const heDay = (d) => { const s = d ? getHebrewDateString(d) : ''; return s ? shortHebrew(s) : ''; };

/**
 * שורות הכרטיס העשיר בסרגל - [{icon, text}]. kind|arg מ-data-rich. ctx = { order, items, payments, changes, balance }.
 * עובדות בלבד: מה שקיים בנתוני ההזמנה (בדמו: סכומים/תאריכים מהדגמה).
 */
export function railRichRows(kind, arg, ctx = {}) {
  const order = ctx.order || {};
  const rows = [];
  if (kind === 'sig') {
    rows.push(order.hasSignedRegulations ? { icon: 'note', text: 'נחתם' } : { icon: 'x', text: 'לא נחתם' });
    rows.push({ icon: 'sig', text: 'לחצו לשינוי' });
  } else if (kind === 'del') {
    const dir = order.deliveryDirection || '';
    rows.push({ icon: 'truck', text: [dir, order.deliveryCity].filter(Boolean).join(' · ') || 'משלוח' });
    if (order.deliveryAddress) rows.push({ icon: 'pin', text: order.deliveryAddress });
  } else if (kind === 'items') {
    const out = !!order.isDelivery && order.deliveryDirection !== 'חזור';
    for (const i of (ctx.items || []).filter((x) => x && !x.isDeleted)) {
      const name = i.dressItem?.dress?.name || i.dressItem?.dressName || i.description || i.dressItem?.dress?.barcodePrefix || i.barcodePrefix || '';
      rows.push({ icon: i.isReturned ? 'check' : i.isTaken ? (out ? 'truck' : 'bag') : 'clock', text: `דגם ${name} · מידה ${i.sizeText || '—'}` });
    }
  } else if (kind === 'pay') {
    for (const p of (ctx.payments || []).filter((x) => x && !x.isDeleted)) {
      const amt = Number(p.amount) || 0;
      rows.push({ icon: amt < 0 || p.isRefund ? 'undo' : 'cash', text: [heDay(p.paymentDate), p.method, `₪${Math.abs(amt).toLocaleString('he-IL')}`].filter(Boolean).join(' · ') });
    }
    const bal = Number(ctx.balance) || 0;
    if (bal) rows.push({ icon: bal > 0 ? 'alert' : 'undo', text: `${bal > 0 ? 'חוב' : 'זיכוי'} ₪${Math.abs(bal).toLocaleString('he-IL')}` });
    rows.push({ icon: 'card', text: 'לחצו למעבר לתשלומים' });
  } else if (kind === 'chg') {
    const c = (ctx.changes || []).find((x) => x && x.key === arg);
    if (c && c.note) rows.push({ icon: c.icon || 'note', text: c.note });
  } else if (kind === 'payln') {
    const p = (ctx.payments || []).find((x) => x && String(x.id) === String(arg));
    if (p) rows.push({ icon: 'cash', text: [heDay(p.paymentDate), p.method].filter(Boolean).join(' · ') });
  }
  return rows;
}

/** data-rich="סוג|ארגומנט" -> { kind, arg } */
export function parseRichSpec(spec) {
  const s = String(spec || '');
  const k = s.indexOf('|');
  return k < 0 ? { kind: s, arg: '' } : { kind: s.slice(0, k), arg: s.slice(k + 1) };
}

/**
 * מיקום כרטיס עשיר (placeRich בדמו) / טולטיפ פשוט. r = getBoundingClientRect של העוגן; w,h = גודל הכרטיס; env = { vw, vh, navBottom }.
 * mode 'above': מעל מרכז העוגן, מתהפך מתחת כשאין מקום מתחת לקצה התחתון של התפריט העליון (navBottom + 8); 'side': מימין/משמאל במסך רחב (>=700), אחרת above.
 * @returns {{x:number,y:number,side:'t'|'b'|'r'|'l',arrowLeft?:number,arrowTop?:number}}
 */
export function placeTip(r, w, h, { vw, vh, navBottom = 0 }, mode = 'above', gap = 8) {
  const minTop = Math.max(8, navBottom ? Math.round(navBottom) + 8 : 0);
  const clampX = (x) => Math.max(8, Math.min(vw - w - 8, x));
  const above = () => {
    const cx = r.left + r.width / 2;
    const x = clampX(cx - w / 2);
    let y = r.top - gap - h;
    let side = 't';
    if (y < minTop) { y = r.bottom + gap; side = 'b'; }
    y = Math.max(8, Math.min(vh - h - 8, y));
    return { x, y, side, arrowLeft: Math.max(14, Math.min(w - 14, cx - x)) };
  };
  if (mode !== 'side' || vw < 700) return above();
  const g = 12;
  let x;
  let side;
  if (r.right + g + w <= vw - 8) { x = r.right + g; side = 'r'; }
  else if (r.left - g - w >= 8) { x = r.left - g - w; side = 'l'; }
  else return above();
  const y = Math.max(8, Math.min(vh - h - 8, r.top + r.height / 2 - h / 2));
  return { x, y, side, arrowTop: Math.max(14, Math.min(h - 14, r.top + r.height / 2 - y)) };
}

/** קצה תחתון של התפריט העליון הדביק (מסומן data-sticky-nav במעטפת A5); 0 כשאין */
export const navBottomOf = () => {
  const nav = typeof document !== 'undefined' ? document.querySelector('[data-sticky-nav]') : null;
  return nav ? nav.getBoundingClientRect().bottom : 0;
};
