// lib/kioskRegistration.js - סימון "נרשמה בעמדת הלקוח - לאמת פרטים" על Customer, בלי שינוי סכמה.
// הסימון נשמר בשדה הקיים Customer.officeNotes ("נתוני משרד", שדה פנימי של הצוות שלא נחשף ללקוח) כשורת-סימון קבועה בתחילת השדה.
// פונקציות טהורות (בלי DB/React): נבדקות ב-scripts/kiosk-public-tests.
//
// שלושה מצבים (טקסט קבוע בלבד - לעולם לא טקסט שהוקלד ע"י הלקוחה, כדי שהעמדה הציבורית לא תוכל להזריק תוכן לתיק לקוחה):
//   PENDING  - לקוחה חדשה שנוצרה מהעמדה, ממתינת לאימות פרטים אצל העובדת.
//   REPEAT   - מישהי נרשמה שוב בעמדה והתאימה ללקוחה קיימת (ת"ז זהה / טלפון+שם זהים): לא נוצר כפיל ושום נתון לא נדרס;
//              רק מסומן שהעובדת תראה. מופיע גם ברשימת "ממתינות לאימות".
//   VERIFIED - העובדת אימתה (הסימון הקודם הוחלף; נשאר כתיעוד בשדה).
export const KIOSK_REG_PENDING_TAG = '[עמדה: נרשמה - לאמת פרטים]';
export const KIOSK_REG_REPEAT_TAG = '[עמדה: רישום חוזר - לקוחה קיימת, לאמת]';
export const KIOSK_REG_VERIFIED_TAG = '[עמדה: אומתה]';

const MAX_OFFICE_NOTES = 2000;

/** 'pending' | 'repeat' | 'verified' | null לפי officeNotes. */
export function kioskRegistrationState(officeNotes) {
  const t = String(officeNotes == null ? '' : officeNotes);
  if (t.includes(KIOSK_REG_PENDING_TAG)) return 'pending';
  if (t.includes(KIOSK_REG_REPEAT_TAG)) return 'repeat';
  if (t.includes(KIOSK_REG_VERIFIED_TAG)) return 'verified';
  return null;
}

/** האם דורשת אימות (חדשה או רישום חוזר). */
export function isKioskRegistrationUnverified(officeNotes) {
  const s = kioskRegistrationState(officeNotes);
  return s === 'pending' || s === 'repeat';
}

function stamp(now, channelLabel) {
  // תאריך ושעה בישראל (לא UTC) - לצוות שקורא
  let when = '';
  try {
    when = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' }).format(now);
  } catch (e) {
    when = now.toISOString();
  }
  return `${when}${channelLabel ? ` · ${channelLabel}` : ''}`;
}

/** הערך הנכתב ב-officeNotes ללקוחה חדשה שנרשמה בעמדה (הקיים נשמר אחרי הסימון, אם יש). */
export function buildPendingOfficeNotes({ existing = '', now = new Date(), channelLabel = '' } = {}) {
  const line = `${KIOSK_REG_PENDING_TAG} ${stamp(now, channelLabel)}`;
  const rest = String(existing || '').trim();
  return (rest ? `${line}\n${rest}` : line).slice(0, MAX_OFFICE_NOTES);
}

/**
 * הערך החדש של officeNotes ללקוחה קיימת שנרשמה שוב בעמדה, או null כשאין מה לכתוב (כבר מסומנת כממתינה / כבר סומנה כחוזרת:
 * אידמפוטנטי - ספאם מהעמדה לא מצטבר שורות). לא נוגע בשום שדה אחר של הלקוחה.
 */
export function buildRepeatOfficeNotes({ existing = '', now = new Date(), channelLabel = '' } = {}) {
  if (isKioskRegistrationUnverified(existing)) return null;
  const line = `${KIOSK_REG_REPEAT_TAG} ${stamp(now, channelLabel)}`;
  const rest = String(existing || '').trim();
  return (rest ? `${line}\n${rest}` : line).slice(0, MAX_OFFICE_NOTES);
}

/** officeNotes אחרי אימות ע"י העובדת: כל סימון "לאמת" מוחלף בסימון "אומתה" (תיעוד), שאר ההערות נשמרות. null = לא היה מה לאמת. */
export function buildVerifiedOfficeNotes(existing, { now = new Date() } = {}) {
  const t = String(existing == null ? '' : existing);
  if (!isKioskRegistrationUnverified(t)) return null;
  const when = stamp(now, '');
  return t
    .split(KIOSK_REG_PENDING_TAG).join(`${KIOSK_REG_VERIFIED_TAG} (אומתה ${when})`)
    .split(KIOSK_REG_REPEAT_TAG).join(`${KIOSK_REG_VERIFIED_TAG} (אומתה ${when})`)
    .slice(0, MAX_OFFICE_NOTES);
}

/** תנאי Prisma (על Customer) לרשימת "ממתינות לאימות". */
export function kioskUnverifiedWhere() {
  return { OR: [{ officeNotes: { contains: KIOSK_REG_PENDING_TAG } }, { officeNotes: { contains: KIOSK_REG_REPEAT_TAG } }] };
}
