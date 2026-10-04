// lib/quickPrefix.js — קידומות חיפוש מהיר בשורת החיפוש ('@' = האחרונים שלי, '&' = השינויים שלי). מודול טהור: בלי React, DOM או רשת
// (נבדק ב-scripts/test_home_logic.mjs), כדי שאותה לוגיקה תשרת את החיפוש בדף הבית וגם את חיפוש התפריט.
//
// כלל (החלטת הבעלים 27.9): הקידומת פועלת רק כשהיא התו הראשון בשורת החיפוש; מה שאחריה מסנן את הרשימה.
// קיימות '@' (האחרונים של העובדת מההיסטוריה המקומית), '&' ("השינויים שלי": ההזמנות שיצרתי והשינויים שעשיתי, מהשרת),
// '#' (פעולות מהירות: הזמנה חדשה / טיוטות / ממתינים לתשלום, לפי הרשאות) ו-'$' (חיפושים שמורים אישיים) - החלטות PFX-01..11 (5.10.2026),
// המודלים ב-lib/quickShortcuts.js. קידומת חדשה נכנסת כך, בלי לגעת ברכיב המשותף:
//   1) שורה חדשה ב-QUICK_PREFIXES עם source משלה;
//   2) מודל שורות טהור למקור (כמו buildMineModel ב-lib/myRecentActivityView.js): { items, none, sub, note, ... };
//   3) רשומה ב-PREFIX_SOURCES (app/components/search/QuickPrefix.js: { buildModel, List }) — פתיחה, חצים, Enter, Esc והסינון כבר משותפים.
// source: 'local' = שורות פשוטות שהקורא מעביר (rows); 'mine' = אובייקט { state, data, load, reload } מ-useMyActivity;
// 'actions' = { allowed, draftCount } ; 'saved' = האובייקט של useSavedSearches (components/search/savedSearches.js).
//
// שורת רשימה (row): { key, kind, icon, title, sub?, url } — `kind` הוא סוג הרשומה ("לקוח", "הזמנה"...). כשיתווספו סוגי
// רשומות נוספים (חיפוש חכם, טיוטות...) הם נכנסים כשורות עם kind משלהם, בלי לשנות את הרכיב המשותף.

export const QUICK_PREFIXES = Object.freeze({
  '@': Object.freeze({ id: 'recent', source: 'local', listLabel: 'האחרונים שלי', empty: 'עוד לא נפתחו כאן הזמנות או לקוחות', noMatch: 'אין התאמות' }),
  '&': Object.freeze({ id: 'mine', source: 'mine', listLabel: 'השינויים שלי', empty: 'עוד לא יצרת או שינית הזמנות', noMatch: 'אין התאמות' }),
  '#': Object.freeze({ id: 'actions', source: 'actions', listLabel: 'פעולות מהירות', empty: 'אין לך פעולות מהירות זמינות כרגע', noMatch: 'אין התאמות' }),
  '$': Object.freeze({ id: 'saved', source: 'saved', listLabel: 'חיפושים שמורים', empty: 'אין עדיין חיפושים שמורים', noMatch: 'אין התאמות' }),
});

/** { prefix, term, def } אם שורת החיפוש מתחילה בקידומת מוכרת (התו הראשון בלבד), אחרת null. */
export function detectQuickPrefix(q) {
  const s = typeof q === 'string' ? q : '';
  if (!s) return null;
  const def = Object.prototype.hasOwnProperty.call(QUICK_PREFIXES, s[0]) ? QUICK_PREFIXES[s[0]] : null;
  return def ? { prefix: s[0], term: s.slice(1).trim(), def } : null;
}

/**
 * הקידומת שפעילה בפועל במקום מסוים: detectQuickPrefix (התו הראשון של השורה הלא-מקוצצת בלבד), מצומצם לקידומות שהמקום הזה מפעיל
 * (prefixes) ולקידומות שיש להן מקור שמותר לקרוא ממנו (mineUsable=false: אין מקור / 403 = אין הרשאה, ואז '&' היא סתם טקסט; actionsUsable / savedUsable
 * = אין לקורא מקור ל-'#' / '$' - בחיפוש שבלי חיווט, הקידומת היא טקסט רגיל).
 * מקור אחד לאמת: useQuickPrefix (הרשימה) וחיפוש התפריט (השעיית חיפוש השרת כשהרשימה מוצגת) משתמשים בו.
 */
export function resolveQuickPrefix(q, { enabled = true, prefixes = null, mineUsable = true, actionsUsable = true, savedUsable = true } = {}) {
  let hit = enabled ? detectQuickPrefix(q) : null;
  if (hit && Array.isArray(prefixes) && !prefixes.includes(hit.prefix)) hit = null;
  if (hit && hit.def.source === 'mine' && !mineUsable) hit = null;
  if (hit && hit.def.source === 'actions' && !actionsUsable) hit = null;
  if (hit && hit.def.source === 'saved' && !savedUsable) hit = null;
  return hit;
}

/** סינון שורות לפי מה שהוקלד אחרי הקידומת (תת-מחרוזת בכותרת / סוג / טקסט משנה). בלי term = הכול. לא משנה את הקלט. */
export function filterPrefixRows(rows, term) {
  const list = Array.isArray(rows) ? rows : [];
  const t = String(term || '').trim().toLowerCase();
  if (!t) return list.slice();
  return list.filter((r) => [r.title, r.kind, r.sub].some((x) => typeof x === 'string' && x.toLowerCase().includes(t)));
}

/** [לפני, התאמה, אחרי] להדגשת מה שהוקלד; בלי התאמה — [טקסט, '', '']. */
export function splitMatch(text, term) {
  const s = String(text == null ? '' : text);
  const t = String(term || '').trim();
  const i = t ? s.toLowerCase().indexOf(t.toLowerCase()) : -1;
  return i < 0 ? [s, '', ''] : [s.slice(0, i), s.slice(i, i + t.length), s.slice(i + t.length)];
}
