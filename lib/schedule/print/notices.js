// lib/schedule/print/notices.js — "הרשימה עלולה להיות חלקית": הודעות שחייבות להופיע על הדף המודפס ובקובץ ה-Excel,
// כדי שרשימת שליח / קבלה לא תודפס חסרה בשקט. טהור, בלי imports (נקרא גם בדפדפן - PrintShell, וגם בשרת - route.js).
//   meta.truncated          getScheduleDay סרק רק את schedule_max_scan_rows ההזמנות הראשונות
//   meta.warnings           אזהרות getScheduleDay - בלי אזהרת "אין עדיין שדה בוצע" (נוגעת למונה במסך, לא לתוכן הדף)
//   meta.skipped            דפים שנבחרו ולא הודפסו כי אין לעובד/ת הרשאה להם (route.js)
//   page.data.lateTruncated דף 16: רשימת ההחזרות באיחור קוצרה (manretDetail LATE_MAX) - הכי מאחרות נשארות
const COUNTER_ONLY_WARNING = /אין עדיין שדה "בוצע"/;

/** @returns {string[]} הודעות לפי הסדר; [] כשהכל שלם */
export function printNotices(payload) {
  const out = [];
  const meta = (payload && payload.meta) || {};
  const warnings = (Array.isArray(meta.warnings) ? meta.warnings : []).filter((w) => typeof w === 'string' && w && !COUNTER_ONLY_WARNING.test(w));
  if (meta.truncated && !warnings.some((w) => /נסרקו רק/.test(w))) {
    out.push('הרשימה עלולה להיות חלקית: נסרק רק חלק מההזמנות (schedule_max_scan_rows).');
  }
  for (const w of warnings) out.push(/נסרקו רק/.test(w) ? `הרשימה עלולה להיות חלקית: ${w}` : w);
  const skipped = Array.isArray(meta.skipped) ? meta.skipped : [];
  if (skipped.length) out.push(`לא הודפס (אין הרשאה): ${skipped.map((x) => x.label || x.key).join(', ')}.`);
  for (const p of (payload && payload.pages) || []) {
    if (p && p.data && p.data.lateTruncated) {
      out.push(`${(p.def && p.def.label) || p.key}: רשימת ההחזרות באיחור קוצרה ל-${p.data.lateMax || 'מספר מוגבל של'} הזמנות - מוצגות המאחרות ביותר.`);
    }
  }
  return out;
}
