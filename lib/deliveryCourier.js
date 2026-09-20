import { getHebrewDateString, getHebrewWeekdayFullName } from '@/lib/hebrewDate';

// לוגיקת עזר משותפת להדפסה/מייל למשלוחן (§C/§D, docs/deliveries-feature-plan-2026-09-16.md) -
// קובץ נפרד מ-lib/deliveries.js (שם יושבת שאילתת ה-DB, מייבאת פריזמה) כדי שגם עמודי
// ההדפסה (client component, קורא ל-/api/deliveries בעצמו) יוכלו לייבא בלי לגרור prisma.

/**
 * הכותרת הקבועה לטבלת/מייל משלוחן - כיוון + "אירועים" + יום השבוע והתאריך העברי של
 * האירועים בקבוצה, ובסוגריים יום השבוע שבו המשלוח בפועל יוצא (הלוך) או נאסף (חזור),
 * לפי dispatchDate (התאריך שנבחר בפועל להדפסה/שליחה - לא תאריך האירוע עצמו).
 */
export function buildCourierGroupTitle({ direction, eventDate, eventDateHebrew, dispatchDate }) {
  const directionLabel = direction === 'out' ? 'הלוך' : 'חזור';
  const actionLabel = direction === 'out' ? 'יוצא' : 'נאסף';
  const eventWeekday = getHebrewWeekdayFullName(eventDate);
  const dispatchWeekday = getHebrewWeekdayFullName(dispatchDate);
  const hebrewDate = eventDateHebrew || getHebrewDateString(eventDate);
  return `משלוח ${directionLabel} אירועים ${eventWeekday} ${hebrewDate} (משלוח ${actionLabel} ${dispatchWeekday})`;
}

/**
 * מקבצת שורות משלוח (מכמה ימי-שיגור, כל אחד עם dispatchDate משלו) לחתכי כיוון+תאריך
 * אירוע - כל חתך הופך לטבלה/סעיף נפרד בהדפסה/במייל, עם כותרת נפרדת (buildCourierGroupTitle).
 * `rowsByDispatchDate` הוא מערך של { dispatchDate, rows } (rows בפורמט getDeliveriesForDate
 * מ-lib/deliveries.js, או תגובת GET /api/deliveries?date=).
 */
export function groupDeliveryRowsForCourier(rowsByDispatchDate, directionFilter) {
  const groups = new Map();
  for (const { dispatchDate, rows } of rowsByDispatchDate) {
    for (const row of rows) {
      for (const direction of row.directions) {
        if (directionFilter !== 'both' && direction !== directionFilter) continue;
        // מפתח הקבוצה הוא יום קלנדרי ישראלי (לא חיתוך UTC של ה-ISO): הזמנות מיובאות נושאות
        // eventDate בשעות שונות (21:00Z = חצות ישראל, 00:00Z = 03:00 ישראל) לאותו יום אירוע,
        // וחיתוך UTC פיצל אירוע אחד לשתי קבוצות באותו כותרת (נראה במייל למשלוחן החי, 2026-09-20).
        const eventDateKey = new Date(row.eventDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
        // במצב "בחירה לפי תאריך אירוע" (deliveries_select_by_event_date) התאריך שנבחר הוא
        // תאריך האירוע, לא יום היציאה/האיסוף - השרת מחשב את היום הזה לכל שורה
        // (row.dispatchDates) והכותרת ממשיכה לציין אותו כמו תמיד. במצב הרגיל השדה חסר
        // ו-dispatchDate של הקריאה הוא כבר יום היציאה/האיסוף.
        const rowDispatchIso = row.dispatchDates?.[direction];
        const rowDispatchDate = rowDispatchIso ? isoRangeToDates(rowDispatchIso, rowDispatchIso)[0] : dispatchDate;
        const key = rowDispatchIso ? `${direction}|${eventDateKey}|${rowDispatchIso}` : `${direction}|${eventDateKey}`;
        if (!groups.has(key)) {
          groups.set(key, {
            direction,
            eventDate: row.eventDate,
            eventDateHebrew: row.eventDateHebrew,
            dispatchDate: rowDispatchDate,
            title: buildCourierGroupTitle({ direction, eventDate: row.eventDate, eventDateHebrew: row.eventDateHebrew, dispatchDate: rowDispatchDate }),
            rows: []
          });
        }
        groups.get(key).rows.push(row);
      }
    }
  }
  return Array.from(groups.values()).sort((a, b) => (new Date(a.eventDate) - new Date(b.eventDate)) || (a.direction === b.direction ? 0 : a.direction === 'out' ? -1 : 1));
}

// 'YYYY-MM-DD' -> local midnight Date, ורשימת כל התאריכים (כולל) בין from ל-to.
export function isoRangeToDates(fromIso, toIso) {
  const parse = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  };
  const from = parse(fromIso);
  const to = parse(toIso) || from;
  if (!from) return [];
  const dates = [];
  for (let d = new Date(from); d.getTime() <= to.getTime(); d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }
  return dates;
}

// 'YYYY-MM-DD' פורמט מקומי (לא UTC) - זהה ל-todayIso/addDaysToIso ב-app/deliveries/page.js.
export function dateToIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
