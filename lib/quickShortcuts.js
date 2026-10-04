// lib/quickShortcuts.js - הקידומות '#' (פעולות מהירות) ו-'$' (חיפושים שמורים) בשורת החיפוש + מדריך הקיצורים.
// מודול טהור: בלי React, DOM או רשת (נבדק ב-scripts/test_quick_prefix_shortcuts.mjs). עיצוב מאושר: תצוגות-עיצוב/חיפוש-קיצורים.html,
// החלטות הבעלים PFX-01..11 (5.10.2026). הרישום של הקידומות עצמן: lib/quickPrefix.js (QUICK_PREFIXES), הציור: components/search/QuickPrefix.js.
//
// '#': שלוש פעולות, מסוננות לפי ההרשאות של העובדת (PFX-01). "הזמנה חדשה" = page:orders_new (נתיב /orders/new בתפריט), השאר = page:orders.
//   טיוטות = שינויים שלא נשמרו בכרטיסי הזמנה בעמדה הזו בלבד (PFX-03: localStorage, אותו מקור כמו "לא נשמר" ברשימת ההזמנות);
//   ממתינים לתשלום = כל ההזמנות עם יתרה (PFX-02). שתיהן נפתחות בתצוגת התוצאות של החיפוש המתקדם (תחום הזמנות + סימון "לא נשמר" / "חובות").
// '$': חיפושים שמורים אישיים (PFX-04) - שורת "שמור חיפוש" ואחריה החיפושים השמורים; מצב ריק עם הסבר (PFX-05).

export const SAVED_SEARCH_LIMIT = 50; // כמו app/api/saved-searches/route.js
export const SAVED_LABEL_MAX = 80;
export const SAVED_QUERY_MAX = 300;

/** מדריך הקיצורים (PFX-07): שורה לכל סימן. */
export const SHORTCUT_GUIDE = Object.freeze([
  Object.freeze({ ch: '@', title: 'נפתחו לאחרונה', sub: 'לקוחות, הזמנות ופריטים שפתחת לאחרונה בעמדה הזו' }),
  Object.freeze({ ch: '#', title: 'פעולות מהירות', sub: 'הזמנה חדשה, טיוטות, ממתינים לתשלום' }),
  Object.freeze({ ch: '$', title: 'חיפושים שמורים', sub: 'חיפוש ששמרת, בלחיצה אחת' }),
  Object.freeze({ ch: '&', title: 'השינויים שלי', sub: 'הזמנות שיצרת והשינויים שעשית בהן' }),
]);

export const GUIDE_TEXT = Object.freeze({
  title: 'קיצורי חיפוש',
  sub: 'כותבים את הסימן כתו ראשון בשורת החיפוש, ואז ממשיכים להקליד כדי לסנן.',
  tryLabel: 'נסה',
  close: 'סגירה',
  button: 'קיצורים',
  buttonTip: 'מדריך קיצורי החיפוש',
});

/** שורות המדריך: '&' נעלמת כשאין הרשאה לרשימה שלה (mineUsable=false), כמו שהקידומת עצמה הופכת לטקסט רגיל. */
export function guideRows({ mineUsable = true } = {}) {
  return SHORTCUT_GUIDE.filter((g) => g.ch !== '&' || mineUsable);
}

/* ---------- '#' פעולות מהירות ---------- */
export const ACTIONS_TEXT = Object.freeze({
  head: 'פעולות מהירות',
  note: 'מוצגות רק פעולות שההרשאות שלך מאפשרות.',
  loading: 'טוען את הפעולות…',
  noneAll: 'אין לך פעולות מהירות זמינות כרגע',
  noneAllSub: 'אם חסרה לך הרשאה, פני להנהלה.',
});

// path = נתיב התפריט שמופיע רק למי שמותר לה (כמו navConfig / buildMenuTree: showOrdersNew / showOrders)
export const QUICK_ACTIONS = Object.freeze([
  Object.freeze({ key: 'new-order', title: 'הזמנה חדשה', icon: 'plus', path: '/orders/new', sub: 'פותח הזמנה חדשה מההתחלה' }),
  Object.freeze({ key: 'drafts', title: 'טיוטות', icon: 'pencil', path: '/orders/new', sub: 'הזמנות שהתחלת ולא שמרת בעמדה הזו' }),
  Object.freeze({ key: 'unpaid', title: 'ממתינים לתשלום', icon: 'wallet', path: '/orders', sub: 'הזמנות שיש בהן יתרה לתשלום' }),
]);
const ACTION_BY_KEY = Object.freeze(Object.fromEntries(QUICK_ACTIONS.map((a) => [a.key, a])));

/** מה קורה בבחירת פעולה: ניווט לעמוד, או הרצת תצוגת תוצאות בדף הבית (run = ערך הפרמטר /?run=). */
export function actionTarget(key) {
  if (key === 'new-order') return { kind: 'nav', url: '/orders/new' };
  if (key === 'drafts') return { kind: 'run', run: 'unsaved', url: '/?run=unsaved' };
  if (key === 'unpaid') return { kind: 'run', run: 'debts', url: '/?run=debts' };
  return null;
}

/** תווית ספירת הטיוטות בשורה ("2 בעמדה" / "אין"). */
export const draftTail = (n) => (Number.isFinite(n) && n > 0 ? `${n} בעמדה` : 'אין');

/**
 * מודל רשימת '#': { state, head, count, items, none, sub, note }. items = השורות לניווט במקלדת.
 * allowed: Set של נתיבי תפריט מותרים (null = ההרשאות טרם נטענו -> "טוען", לא מציגים כלום: כשל-סגור);
 * או פונקציה path => boolean. draftCount = כמה טיוטות יש בעמדה. term = מה שהוקלד אחרי '#'.
 */
export function buildActionsModel({ allowed = null, draftCount = 0, term = '' } = {}) {
  const t = String(term || '').trim().toLowerCase();
  const can = typeof allowed === 'function' ? allowed : allowed && typeof allowed.has === 'function' ? (p) => allowed.has(p) : null;
  const base = { head: ACTIONS_TEXT.head, note: ACTIONS_TEXT.note, count: 0, items: [], none: '', sub: '' };
  if (!can) return { ...base, state: 'loading', none: ACTIONS_TEXT.loading };
  const permitted = QUICK_ACTIONS.filter((a) => can(a.path));
  const shown = t ? permitted.filter((a) => a.title.toLowerCase().includes(t)) : permitted;
  const items = shown.map((a) => ({
    key: 'action:' + a.key,
    type: 'action',
    action: a.key,
    icon: a.icon,
    title: a.title,
    sub: a.sub,
    tail: a.key === 'drafts' ? draftTail(draftCount) : '',
  }));
  let none = '';
  let sub = '';
  if (!items.length) {
    if (!permitted.length) { none = ACTIONS_TEXT.noneAll; sub = ACTIONS_TEXT.noneAllSub; } else none = `אין פעולה מהירה שמתאימה ל“${String(term).trim()}”`;
  }
  return { ...base, state: 'ok', count: items.length, items, none, sub };
}

/* ---------- '$' חיפושים שמורים ---------- */
export const SAVED_TEXT = Object.freeze({
  head: 'חיפושים שמורים',
  note: 'החיפושים השמורים אישיים: רק את רואה אותם.',
  loading: 'טוען את החיפושים השמורים…',
  empty: 'אין עדיין חיפושים שמורים',
  emptyHint: 'כדי לשמור: מחפשים משהו, כותבים $ ולוחצים על ״שמור חיפוש״.',
  error: 'לא הצלחנו לטעון את החיפושים השמורים',
  errorSub: 'זו לא בעיה אצלך. אפשר לנסות שוב.',
  unavailable: 'החיפושים השמורים אינם זמינים כרגע',
  unavailableSub: 'אפשר להמשיך לחפש כרגיל.',
  saveTitle: 'שמור חיפוש',
  saveNoLast: 'אין חיפוש אחרון לשמירה. חפשי משהו וחזרי לכאן.',
  saveFull: `הגעת למקסימום של ${SAVED_SEARCH_LIMIT} חיפושים שמורים. מחקי אחד כדי להוסיף.`,
  nameLabel: 'שם לחיפוש השמור',
  nameRequired: 'כתבי שם לחיפוש.',
  savedToast: 'החיפוש נשמר',
  saveFailed: 'לא הצלחנו לשמור את החיפוש',
  deleteFailed: 'לא הצלחנו למחוק את החיפוש',
  limitReached: `אי אפשר לשמור יותר מ-${SAVED_SEARCH_LIMIT} חיפושים`,
  deleteTitle: (name) => `למחוק את החיפוש השמור “${name}”?`,
  noAsk: 'אל תשאל שוב',
  noAskTip: 'יישמר עד לרענון',
  delete: 'מחק',
  cancel: 'ביטול',
  saveIconTip: 'שמירת החיפוש ברשימת $',
  savedIconTip: 'החיפוש הזה שמור ברשימת $',
});

const isPrefixChar = (c) => c === '@' || c === '#' || c === '$' || c === '&';
/** טקסט חיפוש ששווה לשמור: לא ריק, ולא קידומת (#... $... @... &...). מחזיר את הטקסט המקוצץ והחתוך, או ''. */
export function saveCandidate(text) {
  const s = typeof text === 'string' ? text.trim() : '';
  if (!s || isPrefixChar(s[0])) return '';
  return s.slice(0, SAVED_QUERY_MAX);
}
/** שם ברירת מחדל לחיפוש שמור (השאילתה עצמה, חתוכה לאורך המותר). */
export const defaultSaveLabel = (query) => String(query || '').trim().slice(0, SAVED_LABEL_MAX);
/** האם החיפוש הזה כבר שמור (אותה שאילתה בדיוק, אחרי קיצוץ). */
export const isQuerySaved = (list, query) => {
  const q = saveCandidate(query);
  return !!q && Array.isArray(list) && list.some((s) => s && s.query === q);
};

const ADV_DOMAIN_LABEL = Object.freeze({ customers: 'לקוחות', orders: 'הזמנות', items: 'פריטים' });
const clipTxt = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/**
 * מודל רשימת '$': { state, head, count, items, none, sub, note, full }.
 * state: loading (idle/loading) | error | unavailable | ok. list = [{ id, label, query, domain }]; last = הטקסט של החיפוש האחרון ('' = אין).
 * items (לניווט במקלדת): שורת "שמור חיפוש" (type 'save', disabled כשאין חיפוש אחרון או כשמלא) ואחריה החיפושים השמורים (type 'saved').
 */
export function buildSavedModel({ state = 'idle', list = [], term = '', last = '' } = {}) {
  const base = { head: SAVED_TEXT.head, note: SAVED_TEXT.note, count: 0, items: [], none: '', sub: '', full: false };
  if (state === 'unavailable') return { ...base, state: 'unavailable', none: SAVED_TEXT.unavailable, sub: SAVED_TEXT.unavailableSub };
  if (state === 'error') return { ...base, state: 'error', none: SAVED_TEXT.error, sub: SAVED_TEXT.errorSub, items: [{ key: 'retry', type: 'retry', title: 'נסי שוב' }] };
  if (state !== 'ok') return { ...base, state: 'loading', none: SAVED_TEXT.loading };
  const saved = (Array.isArray(list) ? list : []).filter((s) => s && typeof s.id === 'string' && typeof s.query === 'string');
  const t = String(term || '').trim().toLowerCase();
  const full = saved.length >= SAVED_SEARCH_LIMIT;
  const lastQ = saveCandidate(last);
  const items = [{
    key: 'save',
    type: 'save',
    icon: 'plus',
    title: SAVED_TEXT.saveTitle,
    sub: full ? SAVED_TEXT.saveFull : lastQ ? `“${clipTxt(lastQ, 60)}”` : SAVED_TEXT.saveNoLast,
    disabled: full || !lastQ,
    query: lastQ,
  }];
  const shown = t ? saved.filter((s) => [s.label, s.query].some((x) => typeof x === 'string' && x.toLowerCase().includes(t))) : saved;
  for (const s of shown) {
    const dom = ADV_DOMAIN_LABEL[s.domain] || '';
    items.push({
      key: 'saved:' + s.id,
      type: 'saved',
      icon: 'search',
      id: s.id,
      title: s.label || s.query,
      query: s.query,
      domain: s.domain || null,
      sub: `“${clipTxt(s.query, 80)}”${dom ? ' · ' + dom : ''}`,
    });
  }
  let none = '';
  let sub = '';
  if (!saved.length) { none = SAVED_TEXT.empty; sub = SAVED_TEXT.emptyHint; } else if (!shown.length) none = `אין חיפוש שמור שמתאים ל“${String(term).trim()}”`;
  return { ...base, state: 'ok', count: saved.length, items, none, sub, full };
}

/** הערך שהשרת מקבל ב-POST /api/saved-searches (ומה שמוצג כשם). null = אין מה לשמור. */
export function savePayload(text, label) {
  const query = saveCandidate(text);
  if (!query) return null;
  const name = defaultSaveLabel(typeof label === 'string' && label.trim() ? label : query);
  return name ? { label: name, query, domain: null } : null;
}
