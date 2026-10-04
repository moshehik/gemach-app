// ocRailLogic.js — לוגיקה טהורה של הרייל וחלונות השמירה של כרטיס ההזמנה החדש (W5). בלי React ובלי DOM — נבדקת ב-node
// (scripts/order-card-tests/rail.*.test.mjs). הרכיבים (OcRail / OcMoneyToast / הדיאלוגים) רק מציגים את מה שכאן מחליט.
//
// ===== מפת פורט / מקורות =====
// railPrimary            ← renderRail בעיצוב (תצוגות-עיצוב/כרטיס-הזמנה.html, _renderRail: primary, A18 "תשלום"/"זיכוי"/"שמור"/"שלם ₪N"/"זכה ₪N")
// cartTotals             ← _renderRail: tot (חיוב/זיכוי ממתין, "לתשלום אחרי שמירה", "יתרת חוב/זכות")
// railShield (R5)        ← ModernOrderCard.js:79-82 (saveNeedsApproval = debt > 0 && !debtUnchangedSinceOpen) — נבדק מול המקור החי
// walletClickPlan (R4)   ← LegacyOrderPage.js handleWalletClick (:1465-1470): מעבר לתשלומים, ואם יש חוב - חלון תשלום
// successHead / successTargets (D6, R10/R9/R44/A16) ← notify/finish/successDlg בעיצוב + החלטות R10 ("אין לחצן לרשימה"), R44 (יעד לפי הגדרה)
// printUrl (R9)          ← LegacyOrderPage.js:975 (/print/order?orderId=N&type=order)
// createRailActions (A18) ← A18 + REQUESTS-W4 "ל-W5": שמירה → חוב חדש: W4 פותח חלון תשלום (לא פותחים עוד אחד ולא D6 באותו רגע);
//                           חוב שהיה קודם: requestPayment('pay'); אחרת D6
// draftIconName / draftTimeLabel (R11) ← מפת האייקונים הישנים (#i-*) של orderDrafts לשמות ה-sprite של הפלטה
//
// הקובץ לא מייבא React/DOM ולא את useOrderCardController (כך נבדק בלי JSX).

import { isDebtUnchangedSinceOpen, hebDateOf } from '../orderCardLogic';

export const EPS = 0.005;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nz = (n) => Math.abs(r2(n)) > EPS;

// ---------- אירועי DOM בין הרייל לחלקים אחרים ----------
// בקשת תשלום (W4: hooks/usePaymentActions.js requestPayment) - אותו שם אירוע ואותו detail; הרייל לא מייבא את קובץ W4 כדי שיעבוד גם
// לפני המיזוג (כשאין מאזין - אין חלון; הבקר עצמו מציג טוסט חוב בלי מאזין debtCreated).
export const OC_PAY_REQUEST_EVENT = 'oc:pay-request';
export const OC_PAYMENT_DONE_EVENT = 'oc:payment-done';
// הלחצן הראשי של הרייל (הטוסט "לשמירה" של A23 שולח אותו כדי שיש מסלול שמירה אחד)
export const OC_RAIL_PRIMARY_EVENT = 'oc:rail-primary';

/** kind: 'auto' | 'pay' | 'credit' (כמו requestPayment של W4) */
export function requestPaymentEvent(kind = 'auto') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OC_PAY_REQUEST_EVENT, { detail: { kind } }));
}

// ---------- הלחצן הראשי של הרייל (A18) ----------
/**
 * @param {{dirty:boolean, due:number, net:number, saved:number}} s
 *   due = יתרה כולל שינויים שלא נשמרו (totals.balance) · net = חיוב/זיכוי ממתין (totals.pendingNet) · saved = יתרה שמורה (totals.savedBalance)
 * @returns {{kind:'pay'|'credit'|'save'|'pay-now'|'credit-now'|'none', text:string, icon:string, amount?:number, intent?:'pay'|'credit'|'save'}}
 */
export function railPrimary({ dirty, due, net, saved }) {
  if (dirty && due > EPS) return { kind: 'pay', intent: 'pay', text: 'תשלום', icon: 'card' };
  if (dirty && net < -EPS) return { kind: 'credit', intent: 'credit', text: 'זיכוי', icon: 'undo' };
  if (dirty) return { kind: 'save', intent: 'save', text: 'שמור', icon: 'check' };
  if (saved < -EPS) return { kind: 'credit-now', text: 'זכה', icon: 'undo', amount: saved };
  if (saved > EPS) return { kind: 'pay-now', text: 'שלם', icon: 'card', amount: saved };
  return { kind: 'none', text: 'שמור', icon: 'check' };
}

/** בעיצוב אין בלוק לחצנים בכלל כשאין שינויים ואין יתרה שמורה */
export const railShowActions = ({ dirty, saved }) => !!dirty || nz(saved);

/** מצב צ׳יפ התשלום (glance): debt | cred | ok - לפי היתרה השמורה (כמו העיצוב) */
export function payChip(saved) {
  if (saved > EPS) return { cls: 'debt', amount: saved, label: 'חוב' };
  if (saved < -EPS) return { cls: 'cred', amount: saved, label: 'זיכוי' };
  return { cls: 'ok', amount: 0, label: 'שולם' };
}

/**
 * שורות סיכום הכסף ברייל (cart-tot) - אותה לוגיקה כמו _renderRail.
 * @returns {{cls:string,label:string,value:number,signed?:boolean,due?:boolean}[]}
 */
export function cartTotals({ net, saved }) {
  const n = r2(net), bal = r2(saved);
  if (!nz(n) && !nz(bal)) return [];
  const due = r2(bal + n);
  const rows = [];
  if (nz(n)) rows.push({ cls: nz(bal) ? 'tr' : 'tr due', label: n > 0 ? 'חיוב ממתין' : 'זיכוי ממתין', value: n, signed: true });
  if (nz(bal) && nz(n)) rows.push({ cls: 'tr due', label: due > EPS ? 'לתשלום אחרי שמירה' : due < -EPS ? 'זיכוי אחרי שמירה' : 'יתרה אחרי שמירה', value: due, due: true });
  if (nz(bal) && !nz(n)) rows.push({ cls: 'tr due', label: bal > 0 ? 'יתרת חוב' : 'יתרת זכות', value: bal, due: true });
  return rows;
}

/** הסכום ליד "שינויים בהזמנה" (cart-sum): חיוב/זיכוי ממתין, אחרת יתרת חוב */
export function cartSum({ net, saved }) {
  const n = r2(net);
  if (nz(n)) return { signed: true, value: n };
  if (r2(saved) > EPS) return { signed: false, value: r2(saved) };
  return null;
}

// ---------- R5: מגן החוב ----------
/** שמירה שתיצור/תגדיל חוב תדרוש אישור מנהל (חלון התשלום, "השאר חוב"). זהה ל-saveNeedsApproval של הכרטיס הישן, ורק כשיש שינויים לשמירה. */
export function railShield({ dirty, due, openedDebt }) {
  if (!dirty) return null;
  const debt = r2(due);
  if (!(debt > 0)) return null;
  if (isDebtUnchangedSinceOpen(debt, openedDebt === undefined ? null : openedDebt)) return null;
  return { amount: debt };
}

// ---------- R4: צ׳יפ הארנק ----------
/**
 * מעבר לתשלומים; ואם יש חוב שמור ואין שינויים פתוחים - גם חלון תשלום (כמו handleWalletClick בישן).
 * עם שינויים פתוחים לא פותחים חלון גבייה לפני שהשינויים נשמרו (הלחצן הראשי "תשלום" שומר ואז גובה).
 */
export function walletClickPlan({ dirty, saved }) {
  return { goPayments: true, openPay: !dirty && saved > EPS };
}

// ---------- D6: חלון "ההזמנה נשמרה" ----------
const money = (n) => `₪${Math.abs(r2(n)).toLocaleString('he-IL')}`;
/**
 * כותרת D6 (R10): "ההזמנה נשמרה" / "נשמר ושולם ₪N · שיטה" / "נשמר · חוב ₪N" / "נשמר · זיכוי ₪N"
 * @param {{kind:'saved'|'paid'|'debt'|'credit', amount?:number, method?:string}} o
 */
export function successHead(o = {}) {
  const { kind = 'saved', amount = 0, method = '' } = o;
  if (kind === 'paid') return `נשמר ושולם ${money(amount)}${method ? ` · ${method}` : ''}`;
  if (kind === 'debt') return `נשמר · חוב ${money(amount)}`;
  if (kind === 'credit') return `נשמר · זיכוי ${money(amount)}`;
  return 'ההזמנה נשמרה';
}

/** kind של D6 לפי תוצאת שמירה שלא פתחה חלון גבייה */
export function successKindOfSave(r) {
  const bal = Number(r && r.balance) || 0;
  if (bal > EPS) return { kind: 'debt', amount: bal };
  if (r && r.creditNow > EPS) return { kind: 'credit', amount: r.creditNow };
  return { kind: 'saved', amount: 0 };
}

/**
 * הלחצנים של D6 (A16/R10/R44): הכפתור הראשי = יעד היציאה שבהגדרה order_edit_redirect_screen; "הדפסה"; "המשך לצפות בהזמנה".
 * בלי "לרשימה" (R10) - גמ"ח שיעד היציאה שלו הוא רשימת ההזמנות מקבל "הזמנה חדשה" (ברירת המחדל של העיצוב, AMB-04).
 * יעד "כרטיס ההזמנה" = להישאר: אין לחצן ניווט נפרד, "המשך לצפות" הוא הראשי.
 * @returns {{primary:{key:'nav'|'continue',label:string,icon:string,href:string|null}, showContinue:boolean}}
 */
export function successTargets(screen, { customerId } = {}) {
  switch (screen) {
    case 'customer':
      if (customerId) return { primary: { key: 'nav', label: 'כרטיס הלקוח', icon: 'user', href: `/customers/${customerId}` }, showContinue: true };
      break;
    case 'rentals': return { primary: { key: 'nav', label: 'השכרות', icon: 'bag', href: '/rentals' }, showContinue: true };
    case 'dashboard': return { primary: { key: 'nav', label: 'דף הבית', icon: 'home', href: '/' }, showContinue: true };
    case 'order': return { primary: { key: 'continue', label: 'המשך לצפות בהזמנה', icon: 'file', href: null }, showContinue: false };
    default: break;
  }
  return { primary: { key: 'nav', label: 'הזמנה חדשה', icon: 'plus', href: '/orders/new' }, showContinue: true };
}

/** R9: כתובת הדפסת ההזמנה (הדף /print/order רושם ORDER_PRINTED בעצמו - חוזה W0 §1.5) */
export const printUrl = (orderId) => `/print/order?orderId=${orderId}&type=order`;

// ---------- R11: באנר הטיוטה ----------
const DRAFT_ICONS = { calendar: 'cal', 'alert-tri': 'alert', 'check-circle': 'check', receipt: 'file', file: 'file', user: 'user', pin: 'pin', bag: 'bag', card: 'card' };
/** אייקון שורה בטיוטה ("#i-calendar" בטיוטות הישנות) → שם sprite של הפלטה */
export function draftIconName(icon) {
  const n = String(icon || '').replace(/^#i-/, '').replace(/^#gmi-/, '');
  return DRAFT_ICONS[n] || (/^[a-z0-9-]+$/.test(n) && n ? n : 'pencil');
}
/** "י״ג תשרי · 09:41" - תאריך עברי + שעה (שעון ישראל) */
export function draftTimeLabel(savedAt) {
  if (!savedAt) return '';
  const d = new Date(savedAt);
  let t = '';
  try { t = d.toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }); } catch { /* שעה לא זמינה */ }
  return [hebDateOf(savedAt), t].filter(Boolean).join(' · ');
}
/** טיוטה שנכתבה על גרסה ישנה יותר של ההזמנה בשרת → אזהרת דריסה */
export const draftIsStale = (draft, serverUpdatedAt) => !!(draft && draft.baseUpdatedAt && serverUpdatedAt && draft.baseUpdatedAt !== serverUpdatedAt);

// ---------- A23: טוסט "חיוב / זיכוי ממתין" ----------
/**
 * מה להציג אחרי שינוי: kind 'charge'|'credit' כשהסכום הממתין השתנה לערך שאינו אפס; 'hide' כשחזר לאפס; null - בלי שינוי (אותו סכום)
 * @param {{dirty:boolean, net:number, last:number}} s  last = הסכום האחרון שהוצג (0 בהתחלה)
 */
export function moneyToastPlan({ dirty, net, last }) {
  const n = r2(net);
  if (!dirty) return { kind: 'hide', net: 0 };
  if (n === r2(last)) return { kind: null, net: n };
  if (n > 0) return { kind: 'charge', net: n };
  if (n < 0) return { kind: 'credit', net: n };
  return { kind: 'hide', net: 0 };
}
export const moneyToastText = (kind, net) => `${kind === 'credit' ? 'זיכוי' : 'חיוב'} ממתין ${money(net)}`;

// ---------- הזרימות (A18) - כולן עם תלויות מוזרקות, כדי לבדוק ב-node בלי React ----------
/**
 * @param {object} env
 * @param {()=>object} env.getOc          הבקר העדכני
 * @param {(kind:string)=>void} env.requestPayment
 * @param {(info:{kind:string,amount:number,method?:string})=>void} env.showSuccess   פותח D6
 * @param {()=>number} [env.now]
 * @param {(fn:Function,ms:number)=>any} [env.setTimeout]
 * @param {number} [env.pendingTtlMs]  כמה זמן תשלום שאחרי שמירה עדיין מיוחס לה (ברירת מחדל 10 דקות)
 */
export function createRailActions(env) {
  const now = env.now || (() => Date.now());
  const later = env.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const ttl = env.pendingTtlMs || 10 * 60 * 1000;
  let pending = null; // {amount, at} - שמירה שפתחה חלון גבייה וממתינה לתוצאה (תשלום / השארת חוב)
  const live = () => (pending && now() - pending.at < ttl ? pending : null);

  /**
   * הלחצן הראשי / הטוסט "לשמירה". intent נגזר מהמצב העדכני כשלא נמסר.
   * @returns {Promise<{handled:string, r?:object}>}
   */
  async function primary(intent) {
    const oc = env.getOc();
    if (!oc || oc.saving) return { handled: 'busy' };
    const t = oc.totals || {};
    const pr = railPrimary({ dirty: !!oc.dirty, due: t.balance || 0, net: t.pendingNet || 0, saved: t.savedBalance || 0 });
    const kind = intent || pr.kind;
    if (kind === 'pay-now') return payNow('pay');
    if (kind === 'credit-now') return payNow('credit');
    if (kind === 'none') return { handled: 'none' };
    let bankPrompted = false;
    const off = typeof oc.on === 'function' ? oc.on('autoRefundNeedsBank', () => { bankPrompted = true; }) : null;
    let r;
    try { r = await oc.save({ intent: kind }); } finally { if (off) off(); }
    if (!r || !r.ok || r.noop) return { handled: 'none', r };
    pending = null;
    // חוב חדש: הבקר שולח debtCreated ו-W4 פותח את חלון התשלום בעצמו - לא פותחים עוד חלון ולא D6 עכשיו (REQUESTS-W4)
    if (r.debtCreated > EPS) { pending = { amount: r.debtCreated, at: now() }; return { handled: 'debt-window', r }; }
    // זיכוי אוטומטי שחסרים לו פרטי בנק: W4 פותח את חלון הבנק
    if (bankPrompted) return { handled: 'bank-window', r };
    // חוב שהיה קודם ("תשלום"): חלון התשלום של W4
    if (kind === 'pay' && r.balance > EPS) { pending = { amount: r.balance, at: now() }; env.requestPayment('pay'); return { handled: 'pay-window', r }; }
    // יתרת זכות אחרי "זיכוי": W4 (אישור ביצוע זיכוי / פרטי בנק / בקשת זיכוי)
    if (kind === 'credit' && r.creditNow > EPS) { env.requestPayment('credit'); return { handled: 'credit-window', r }; }
    env.showSuccess(successKindOfSave(r));
    return { handled: 'success', r };
  }

  /** "שלם ₪N" / "זכה ₪N" (בלי שינויים) */
  function payNow(kind) {
    const oc = env.getOc();
    if (oc.goPayments) oc.goPayments();
    if (kind === 'pay') pending = { amount: (oc.totals && oc.totals.savedBalance) || 0, at: now() };
    env.requestPayment(kind);
    return { handled: `${kind}-now` };
  }

  /** R4 צ׳יפ הארנק */
  function wallet() {
    const oc = env.getOc();
    const plan = walletClickPlan({ dirty: !!oc.dirty, saved: (oc.totals && oc.totals.savedBalance) || 0 });
    if (plan.goPayments && oc.goPayments) oc.goPayments();
    if (plan.openPay) later(() => env.requestPayment('pay'), 60);
    return plan;
  }

  /** נשלח ע"י W4 אחרי תשלום שהתקבל (oc:payment-done) */
  function paymentDone(detail = {}) {
    if (!live()) return false;
    pending = null;
    env.showSuccess({ kind: 'paid', amount: detail.amount, method: detail.method });
    return true;
  }

  /** "השאר חוב (באישור מנהל)" אושר בחלון התשלום (אירוע debtApproved של הבקר - REQUESTS-W5) */
  function debtLeft(detail = {}) {
    const p = live();
    if (!p) return false;
    pending = null;
    env.showSuccess({ kind: 'debt', amount: detail.amount != null ? detail.amount : p.amount });
    return true;
  }

  /** עריכה חדשה מבטלת את הייחוס (תשלום מאוחר יותר לא שייך לשמירה ההיא) */
  function clearPending() { pending = null; }

  return { primary, payNow, wallet, paymentDone, debtLeft, clearPending, hasPending: () => !!live() };
}
