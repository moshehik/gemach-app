// הגדרות החיפוש המתקדם בדף הבית החדש: התחומים, השדות והסינונים, בניית הבקשה לשרת, שורת הסיכום
// ועיצוב התשובה. מודול טהור (בלי DOM/React/רשת) — נבדק ב-scripts/test_home_logic.mjs.
// מקור: public/a5/index.html (ADV_FOCI, ADV_KEYS, advApply) ו-public/a5/adapters/adv-a.js / adv-b.js.
//
// V1: התחומים האיטיים (כספים, תפוסה, התראות) וה"הגדרות" (חיפוש AI בלבד) והבדיקת מלאי לא נבנו — V1-RELEASE-PLAN §3 UI-2.

import { hebText } from './homeDates.js';
import { safeInternalRoute } from './homeLogic.js';

export const ADV_DATE_KEYS = ['from', 'to', 'rdate', 'sfrom', 'sto', 'adate', 'cdate'];
export const ADV_KEYS = ['from', 'to', 'oid', 'item', 'model', 'name', 'phone', 'city', 'first', 'last', 'email', 'q', 'size', 'addr', 'days', 'emp', 'cinfo', 'rdate', 'sfrom', 'sto', 'adate', 'cdate', 'amount', 'cemp', 'ordst', 'branch'];

// מצב טופס ריק לתחום
export const emptyAdv = (focus = null) => ({
  focus,
  ...Object.fromEntries(ADV_KEYS.map((k) => [k, ''])),
  flags: [],
  ost: [],
  st: [],
});

/* ---------- סימונים (value, תווית, אייקון, טולטיפ?) ---------- */
export const ADV_FLAGS = [['debts', 'חובות', 'wallet'], ['credits', 'זיכויים', 'card'], ['badreturn', 'החזרה לא תקינה', 'undo'], ['nodetails', 'חסר פרטי לקוח', 'user']];
export const OST = [['soon', 'בקרוב', 'clock'], ['archive', 'ארכיון', 'box'], ['rented', 'מושכר', 'bag'], ['returned', 'מוחזר', 'home'], ['deleted', 'מחוק', 'trash'], ['alert', 'התראה', 'alert', 'פרטים חסרים, לא חזר, ציפוף, לא שולם, שינויים שלא נשמרו']];
export const ORD_CHECK = [['debts', 'חובות', 'wallet'], ['credits', 'זיכויים', 'card'], ['unsaved', 'לא נשמר', 'pencil'], ['nobranch', 'אין בסניף', 'pin']];
export const RST = [['rs_today', 'היום', 'cal'], ['rs_tomorrow', 'מחר', 'clock'], ['rs_partial', 'הושכר חלקי', 'bag'], ['rs_all', 'הושכר הכל', 'box'], ['rs_late', 'איחור', 'alert']];
export const RTN = [['rt_today', 'היום', 'cal'], ['rt_tomorrow', 'מחר', 'clock'], ['rt_partial', 'הוחזר חלקי', 'undo'], ['rt_all', 'הוחזר הכל', 'home'], ['rt_late', 'איחור', 'alert']];
export const RCHK = [['rc_branch', 'בסניף אחר', 'pin'], ['rc_other', 'החזרה מאירוע אחר', 'undo'], ['rc_stock', 'חסר במלאי', 'box'], ['rc_debt', 'חוב', 'wallet']];
export const DST = [['ds_today', 'היום', 'cal'], ['ds_tomorrow', 'מחר', 'clock'], ['ds_other', 'אחר', 'sliders'], ['ds_sent', 'נשלח', 'truck'], ['ds_picked', 'נאסף', 'bag']];
export const AST = [['as_today', 'היום', 'cal'], ['as_tomorrow', 'מחר', 'clock'], ['as_other', 'אחר', 'sliders']];
export const DFLAGS = [['dl_out', 'הלוך', 'truck'], ['dl_back', 'חזור', 'undo'], ['dl_note', 'יש הערה', 'pencil']];
export const AFLAGS = [['al_len', 'אורך', 'sliders'], ['al_fix', 'תיקון', 'scissors'], ['al_sleeve', 'שרוול', 'dress'], ['al_done', 'בוצע תיקון', 'flag']];
export const MFLAGS = [['md_inactive', 'לא פעיל', 'lock'], ['md_repair', 'בתיקון', 'scissors'], ['md_delmodel', 'דגם מחוק', 'trash'], ['md_delitem', 'פריט מחוק', 'trash']];
export const EFLAGS = [['em_active', 'פעיל', 'users'], ['em_inactive', 'לא פעיל', 'lock']];
const OEVENT_FLAGS = (packing) => [['holiday', 'אירוע חול', 'cal'], ...(packing ? [['packing', 'ציפוף ימים', 'list', 'כמות ימים']] : []), ['delivery', 'משלוח', 'truck'], ['repairs', 'תיקונים', 'scissors']];
const OITEM_FLAGS = [['itRepairs', 'תיקונים', 'scissors']];

// שדה: [מפתח, תווית, אייקון, טקסט בשדה]
export const F = {
  first: ['first', 'שם פרטי', 'user', 'שם פרטי...'],
  last: ['last', 'שם משפחה', 'user', 'שם משפחה...'],
  phone: ['phone', 'טלפון', 'phone', 'מספר טלפון...'],
  phoneC: ['phone', 'טלפון לקוח', 'phone', 'מספר טלפון...'],
  city: ['city', 'עיר מגורים', 'pin', 'עיר...'],
  email: ['email', 'דוא"ל', 'mail', 'כתובת דוא"ל...'],
};

// התראה: "ציפוף" מופיע רק אם מוגדר בגמ"ח
export const alertTip = (packing) => ['פרטים חסרים', 'לא חזר', ...(packing ? ['ציפוף'] : []), 'לא שולם', 'שינויים שלא נשמרו'].join(', ');

/* ---------- תחומים ----------
   בלוקים (t): fields / flagsBlock / ostat / chk / ... — מוצגים ב-HomeAdvanced.
   api: איזה נתיב שרת (adv = לקוחות/הזמנות/השכרות/החזרות, advb = השאר). */
const CUSTOMER_FIELDS = [F.first, F.last, F.phone, F.city, F.email];
export const ADV_FOCI = {
  customers: { label: 'לקוחות', icon: 'user', ai: true, api: 'adv', blocks: [{ t: 'fields', icon: 'user', title: 'פרטים כלליים', keys: CUSTOMER_FIELDS }, { t: 'flags', icon: 'alert', title: 'דרוש טיפול', list: ADV_FLAGS }] },
  orders: { label: 'הזמנות', icon: 'file', ai: true, api: 'adv', blocks: [{ t: 'ostat' }, { t: 'ocheck' }, { t: 'ordinfo' }, { t: 'oevent' }, { t: 'oitems' }] },
  rentals: { label: 'השכרות', icon: 'bag', ai: true, api: 'adv', blocks: [{ t: 'rstat', kind: 'rent' }, { t: 'rdet', kind: 'rent' }, { t: 'rchk' }, { t: 'rcust' }] },
  returns: { label: 'החזרות', icon: 'undo', ai: true, api: 'adv', blocks: [{ t: 'rstat', kind: 'ret' }, { t: 'rdet', kind: 'ret' }, { t: 'rchk' }, { t: 'rcust' }] },
  alterations: { label: 'תיקונים', icon: 'scissors', api: 'advb', needs: 'alterations', blocks: [{ t: 'apart' }, { t: 'sstat', list: 'alt' }, { t: 'rchk', noDebt: true }, { t: 'rcust' }] },
  deliveries: { label: 'משלוחים', icon: 'truck', api: 'advb', needs: 'deliveries', blocks: [{ t: 'dpart' }, { t: 'sstat', list: 'dlv' }, { t: 'rchk' }, { t: 'rcust' }] },
  models: { label: 'דגמים', icon: 'dress', api: 'advb', mgr: true, blocks: [{ t: 'mgen' }] },
  employees: { label: 'עובדים', icon: 'users', api: 'advb', mgr: true, blocks: [{ t: 'fields', icon: 'user', title: 'פרטים כלליים', keys: CUSTOMER_FIELDS }, { t: 'estat' }] },
};

// העמוד שמאחורי כל תחום — העובדת רואה את התחום רק אם העמוד הזה מותר לה (אותו סינון הרשאות כמו התפריט ב-/api/a5/boot).
// למנהלות-על (דגמים/עובדים) ההגבלה נאכפת בשרת; כאן הם נשארים לפי תפקיד.
const FOCUS_PAGE = { customers: '/customers', orders: '/orders', rentals: '/rentals', returns: '/rentals', alterations: '/alterations', deliveries: '/deliveries' };
const pathOf = (href) => String(href || '').split(/[?#]/)[0];
export function navPathSet(navGroups) {
  if (!Array.isArray(navGroups)) return null;
  return new Set(navGroups.flatMap((g) => (g.items || []).map((i) => pathOf(i.href))));
}

// התחומים המוצגים ב-V1 לפי הגדרות הגמ"ח, התפקיד וההרשאות: { main:[...], extra:[...] }.
// navPaths = קבוצת נתיבי התפריט המותרים (navPathSet); null (אין מידע) = אין תחומים. עובדים: הנהלה ראשית בלבד, דגמים: עמוד הקטלוג מותר.
export function visibleFoci({ settings, isManager, isHead, navPaths }) {
  const s = settings || {};
  const ok = (f, key) => {
    // בלי מידע הרשאות (navPaths ריק, למשל כש-boot נכשל) לא מציגים כלום — נעילה סגורה
    if (!navPaths) return false;
    if (FOCUS_PAGE[key] && !navPaths.has(FOCUS_PAGE[key])) return false;
    if (key === 'employees') return !!isHead;
    if (key === 'models') return navPaths.has('/dashboard/dresses');
    if (f.needs === 'alterations') return s.enable_alterations !== 'false';
    if (f.needs === 'deliveries') return s.enable_deliveries === 'true';
    return true;
  };
  const main = [];
  const extra = [];
  Object.keys(ADV_FOCI).forEach((k) => {
    const f = ADV_FOCI[k];
    if (!ok(f, k)) return;
    if (f.mgr) { if (isManager) extra.push(k); } else main.push(k);
  });
  return { main, extra };
}

/* ---------- בקשה לשרת ---------- */
const ADV_A_KEYS = ['from', 'to', 'oid', 'item', 'model', 'name', 'phone', 'city', 'first', 'last', 'email', 'size', 'addr', 'days', 'emp', 'cinfo', 'rdate'];
const DRAFT_PREFIX = 'gemachOrderDraft:'; // אותו מפתח כמו app/lib/orderDrafts.js
const DRAFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

// "לא נשמר": טיוטות שינויים בכרטיס הזמנה חיות ב-localStorage (אין מקור בשרת), כמו ברשימת ההזמנות
export function unsavedOrderIds(storage, now = Date.now()) {
  const ids = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k || !k.startsWith(DRAFT_PREFIX)) continue;
      try {
        const d = JSON.parse(storage.getItem(k));
        if (!d || !d.savedAt || now - d.savedAt > DRAFT_MAX_AGE || !d.state) continue;
        const id = parseInt(k.slice(DRAFT_PREFIX.length), 10);
        if (!Number.isNaN(id)) ids.push(id);
      } catch (e) { /* טיוטה פגומה */ }
    }
  } catch (e) { /* localStorage חסום */ }
  return ids.slice(0, 500);
}

// הנתיב + מחרוזת השאילתה לתחום. storage = localStorage (לטיוטות "לא נשמר" בתחומי adv)
export function buildAdvRequest(focus, adv, storage) {
  const f = ADV_FOCI[focus];
  if (!f) return null;
  const A = adv || {};
  if (f.api === 'adv') {
    const a = {};
    ADV_A_KEYS.forEach((k) => { const v = A[k]; if (typeof v === 'string' && v.trim()) a[k] = v.trim(); });
    if (Array.isArray(A.flags) && A.flags.length) a.flags = A.flags.slice();
    if (Array.isArray(A.ost) && A.ost.length) a.ost = A.ost.slice();
    const qs = new URLSearchParams({ focus, adv: JSON.stringify(a) });
    if (focus !== 'customers' && storage) {
      const u = unsavedOrderIds(storage);
      if (u.length) qs.set('unsaved', u.join(','));
    }
    return '/api/a5/adv?' + qs.toString();
  }
  const p = new URLSearchParams();
  p.set('focus', focus);
  ADV_KEYS.forEach((k) => { const v = A[k]; if (v != null && typeof v === 'string' && v.trim() !== '') p.set(k, v.trim()); });
  if (A.flags && A.flags.length) p.set('flags', A.flags.join(','));
  if (A.ost && A.ost.length) p.set('ost', A.ost.join(','));
  return '/api/a5/adv-b?' + p.toString();
}

// נרמול תשובת השרת לתצוגה: עמודות, שורות, קישורים, שורות עם התראה
export function normalizeAdvResponse(r) {
  const d = r || {};
  return {
    cols: d.cols || [],
    rows: d.rows || [],
    links: (d.links || []).map(safeInternalRoute), // קישור לא פנימי הופך לריק (השורה נשארת בלי קישור)
    al: d.al || [],
    namesRev: d.namesRev || [],
    truncated: !!d.truncated,
    gaps: d.gaps && d.gaps.length ? d.gaps : [],
  };
}

// תווית שדות הסיכום (מי ביקש מה)
const OLBL = { amount: 'סכום משוער', cemp: 'עובד (זיכוי)', ordst: 'סטטוס הזמנה', branch: 'סניף', city: 'עיר משלוח', oid: 'קוד הזמנה', name: 'שם לקוח', phone: 'טלפון', cinfo: 'פרטי לקוח', emp: 'עובד מבצע', model: 'דגם', size: 'מידה', item: 'ברקוד' };
const ALL_FLAGS = [...ADV_FLAGS, ...ORD_CHECK, ...RCHK, ...DFLAGS, ...AFLAGS, ...MFLAGS, ...EFLAGS, ['holiday', 'אירוע חול'], ['packing', 'ציפוף ימים'], ['delivery', 'משלוח'], ['repairs', 'תיקונים'], ['itRepairs', 'תיקונים']];
const ALL_OST = [...OST, ...RST, ...RTN, ...DST, ...AST];
const SUMMARY_FOCI = ['orders', 'rentals', 'returns', 'deliveries', 'alterations', 'models'];

// שורת הסיכום של הסינונים ("שם פרטי רחל, חובות"); ריקה = לא נבחר שום מסנן
export function advSummaryParts(adv, focus) {
  const A = adv;
  const f = ADV_FOCI[focus];
  const p = [];
  if (!f) return p;
  const labels = {};
  f.blocks.forEach((b) => (b.keys || []).forEach(([k, l]) => { labels[k] = l; }));
  // שדות שמופיעים בבלוקי "קבועים" (ordinfo/oitems...) מקבלים תווית מ-OLBL
  Object.keys(labels).forEach((k) => { if (A[k] && A[k].trim()) p.push(labels[k] + ' ' + A[k].trim()); });
  if (SUMMARY_FOCI.includes(focus)) {
    Object.keys(OLBL).forEach((k) => { if (A[k] && A[k].trim() && !(labels[k])) p.push(OLBL[k] + ' ' + A[k].trim()); });
  }
  if (A.sfrom || A.sto) p.push('תאריכי סטטוס ' + [A.sfrom, A.sto].filter(Boolean).map(hebText).join(' עד '));
  if (A.rdate) p.push((focus === 'returns' ? 'תאריך החזרה ' : 'תאריך השכרה ') + hebText(A.rdate));
  if (A.from || A.to) p.push('תאריכים ' + [A.from, A.to].filter(Boolean).map(hebText).join(' עד '));
  if (A.flags.length) p.push(A.flags.map((v) => (ALL_FLAGS.find((x) => x[0] === v) || [0, v])[1]).join(', '));
  if (A.ost.length) p.push((focus === 'orders' ? 'סטטוס הזמנה ' : 'סטטוס ') + A.ost.map((v) => (ALL_OST.find((x) => x[0] === v) || [0, v])[1]).join(' או '));
  return p;
}

// שאלה לחיפוש החכם שנבנית מהסינונים
export const advAiPrompt = (focus, parts) => 'חפש ' + ADV_FOCI[focus].label + ' לפי: ' + parts.join(', ');

export const advFlagsFor = (packing) => ({ oevent: OEVENT_FLAGS(packing), oitems: OITEM_FLAGS });

/* ---------- תצוגת תוצאות ---------- */
export const ADV_TAG = { customers: ['לקוח', 'user'], orders: ['הזמנה', 'file'], rentals: ['השכרה', 'bag'], returns: ['החזרה', 'undo'], deliveries: ['משלוח', 'truck'], alterations: ['תיקון', 'scissors'], employees: ['עובד', 'users'], models: ['דגם', 'dress'] };

// תא: מחרוזת או [טקסט, מחלקת-צ'יפ]
export const cellParts = (c) => (Array.isArray(c) ? [c[0], c[1]] : [c, '']);
export const looksLikePhoneOrMail = (t) => /^\d{2,3}-?\d{7}$|@/.test(String(t));
