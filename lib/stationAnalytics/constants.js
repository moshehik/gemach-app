// lib/stationAnalytics/constants.js - קבועים משותפים של מדדי ההמרה של העמדה הציבורית (/station). מודול טהור (בלי DB / Next).
// ההגדרות המלאות של כל מדד: docs/station-analytics.md.

/** סוגי האירועים האנונימיים שהעמדה הציבורית שולחת (POST /api/public-kiosk/event). allow-list סגורה: כל סוג אחר נדחה. */
export const ANON_EVENT_TYPES = Object.freeze(['visit', 'availability', 'form_start']);
/** כל סוגי האירועים בטבלה. 'register' נכתב בשרת בלבד (בתוך POST /api/public-kiosk/register), לעולם לא מהדפדפן. */
export const EVENT_TYPES = Object.freeze([...ANON_EVENT_TYPES, 'register']);
export const EVENT_CHANNELS = Object.freeze(['public', 'kiosk']);

/** סינון ערוץ במסך: 'public' קישור כללי, 'kiosk' עמדת חנות, 'all' שניהם. */
export const VIEW_CHANNELS = Object.freeze(['public', 'kiosk', 'all']);
export const VIEW_CHANNEL_LABELS = Object.freeze({ public: 'קישור כללי', kiosk: 'עמדת חנות', all: 'כל הערוצים' });

/** חלון ההמרה לסגירת הזמנה: כמה ימי לוח (בישראל) אחרי הרישום, כולל יום הרישום עצמו. ברירת מחדל 14. */
export const DEFAULT_WINDOW_DAYS = 14;
export const MIN_WINDOW_DAYS = 1;
export const MAX_WINDOW_DAYS = 60;

/** טווח מרבי בבקשה אחת (ימים) - מגביל עלות שאילתה. */
export const MAX_RANGE_DAYS = 180;
/** כמה ימים אחורה נמדד "ממוצע שבועי" בכרטיסי הסיכום. */
export const WEEK_AVG_DAYS = 7;

/** סטטוסי הזמנה שאינם הזמנה סגורה (lib/orderReservation.js: DRAFT_ORDER_STATUS / RESERVED_ORDER_STATUS). מועתקים כדי שהמודול יישאר טהור; נבדק מול המקור בבדיקות. */
export const NON_ORDER_STATUSES = Object.freeze(['טיוטה', 'שמור לחיוב']);

/** תוויות עבריות לשלבי המשפך. parent = שלב ההורה שממנו נמדד אחוז ההמרה. */
export const FUNNEL_STAGES = Object.freeze([
  { key: 'visits', label: 'נכנסו לעמדה', parent: null, top: true },
  { key: 'availability', label: 'בדקו זמינות או דגמים', parent: 'visits', top: true },
  { key: 'formStart', label: 'פתחו את טופס הפרטים', parent: 'visits', top: true },
  { key: 'registered', label: 'מילאו פרטים', parent: 'formStart', top: false },
  { key: 'verified', label: 'אומתו על ידי עובדת', parent: 'registered', top: false },
  { key: 'opened', label: 'נפתחה להן הזמנה', parent: 'registered', top: false },
  { key: 'approved', label: 'הזמנה אושרה או שולמה', parent: 'opened', top: false },
]);
