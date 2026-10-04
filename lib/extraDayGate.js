// "יום השכרה נוסף" (extraDay: 'before' | 'after', תוספת 50% - lib/pricingCalc.js) מותר לשנות בשרת רק כש-enable_rental_extension='true'.
// בלי זה בקשה ישירה (או כרטיס ישן/מיושן) יכלה לדרוס את הערך ולהוסיף חיוב בגמ"ח שהכבה את התכונה (סקירת אינטגרציה S2).
// חשוב: מלאי/לו"ז עדיין לא "מחזיקים" את היום הנוסף (INTEGRATION-NOTES R-6/R-7) - לכן הבקרה נשארת כבויה בנווה עד אישור הבעלים.

export const normalizeExtraDay = (v) => (v === 'before' || v === 'after' ? v : null);

/**
 * @param {{enabledSetting: string|null|undefined, requested: any, current: any}} p
 * @returns {{ok:boolean, value:('before'|'after'|null), changed:boolean}} ok=false ⇒ ההגדרה כבויה ומבקשים להוסיף/להחליף ערך. value = הערך שנשאר בתוקף
 */
export function resolveExtraDay({ enabledSetting, requested, current }) {
  const cur = normalizeExtraDay(current);
  if (requested === undefined) return { ok: true, value: cur, changed: false };
  const want = normalizeExtraDay(requested);
  if (want === cur) return { ok: true, value: cur, changed: false };
  // הסרת יום נוסף קיים (→ null) תמיד מותרת - היא לא מוסיפה חיוב; הוספה/החלפה רק כשההגדרה דלוקה
  if (want !== null && enabledSetting !== 'true') return { ok: false, value: cur, changed: false };
  return { ok: true, value: want, changed: true };
}
