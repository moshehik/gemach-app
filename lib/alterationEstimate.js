// lib/alterationEstimate.js — "תיקון בוצע (משוער)" (החלטת הבעלים 2026-10-06: "ברגע שפריט נלקח - לרשום שהתיקון בוצע, ולהוסיף הערה שהביצוע משוער").
// טהור (בלי prisma/DOM). הסמן נשמר בשדה הטקסט הקיים OrderItem.alterationDetails ("פירוט תיקון", String?) כמשפט קבוע - בלי עמודה חדשה (בלי DDL):
//   'בוצע (משוער) - נרשם אוטומטית בלקיחה'
// נוסף בסוף הטקסט הקיים (שורה חדשה) בלי למחוק אותו; לעולם לא פעמיים; מוסר כשאדם מסמן / מבטל סימון ידנית (כרטיס ההזמנה, הלו״ז, מסך התיקונים).
// "משוער" = alterationDone===true וגם המשפט בטקסט. אדם שערך את הטקסט והסיר את המשפט - הסימון נחשב ידני.
export const ESTIMATE_NOTE = 'בוצע (משוער) - נרשם אוטומטית בלקיחה';
export const ESTIMATE_TIP = 'נרשם אוטומטית בלקיחה - לא סומן ידנית';

const text = (v) => (v === null || v === undefined ? '' : String(v));

export const hasEstimateMarker = (details) => text(details).includes(ESTIMATE_NOTE);

/** מוסיף את המשפט בסוף הטקסט הקיים; אידמפוטנטי (אם כבר קיים - מחזיר כמו שהוא). */
export function addEstimateMarker(details) {
  const d = text(details);
  if (d.includes(ESTIMATE_NOTE)) return d;
  const trimmed = d.replace(/\s+$/, '');
  return trimmed ? `${trimmed}\n${ESTIMATE_NOTE}` : ESTIMATE_NOTE;
}

/** מסיר את המשפט (ואת שורת ההדבקה שלו) ומשאיר את שאר הטקסט; ריק -> null (כמו שדה שלא מולא). בלי המשפט - הערך כמו שהוא. */
export function stripEstimateMarker(details) {
  const d = text(details);
  if (!d.includes(ESTIMATE_NOTE)) return details === undefined ? null : details;
  const out = d.split(ESTIMATE_NOTE).join('').replace(/[ \t]*\n[ \t]*\n+/g, '\n').replace(/^\s+|\s+$/g, '');
  return out || null;
}

/** הטקסט להצגה בלי המשפט (התווית "(משוער)" מוצגת בנפרד) */
export const detailsWithoutMarker = (details) => text(stripEstimateMarker(details));

export const isAlterationEstimated = (item) => !!item && !!item.alterationDone && hasEstimateMarker(item.alterationDetails);

const hasAlteration = (i) => {
  if (!i) return false;
  if ((Number(i.neckAlteration) || 0) > 0 || (Number(i.sleeveAlteration) || 0) > 0) return true;
  const len = i.lengthAlteration;
  return len !== null && len !== undefined && !['', 'null', '0'].includes(String(len));
};

/**
 * מה נכתב לפריט בעת הלקיחה: { alterationDone: true, alterationDetails } או null. רק לפריט פעיל עם תיקון שעוד לא סומן "בוצע" (סימון של אדם לא נוגעים בו).
 * הפונקציה היחידה לשרת (lib/schedule/autoAlterationDone.js) ולכרטיס (שיקוף מקומי, כדי ששמירה מאוחרת לא תחזיר alterationDone=false).
 */
export function estimateOnTake(item) {
  if (!item || item.isDeleted || item.alterationDone || !hasAlteration(item)) return null;
  return { alterationDone: true, alterationDetails: addEstimateMarker(item.alterationDetails) };
}

/** תווית "בוצע" לתיקון: 'בוצע' / 'בוצע (משוער)' / '' (לא בוצע) */
export const alterationDoneLabel = (item) => (item && item.alterationDone ? (hasEstimateMarker(item.alterationDetails) ? 'בוצע (משוער)' : 'בוצע') : '');
