// lib/schedule/stages.js — הגדרות שלבי הלו״ז היומי (מקור אמת: scratch/schedule-build/DECISIONS-לוז-יומי.md).
//
// שמונה שלבים; שלב 3 "העברה בין סניפים" לא קיים (החלטה A1: מוסתר לגמרי) ואינו מוגדר כאן - אין לו
// מפתח, הגדרה או קבוע (FUTURE-העברה-בין-סניפים.md).
// המספור (number) נשמר כמו בעיצוב כדי שהמסך והבעלים ידברו על "שלב 4" ולא על "השלב השלישי ברשימה".
//
// שדות:
//   key / number / label / plural  זיהוי ותוויות.
//   infoOnly        הצגה בלבד (החלטה: שלבים 1 ו-7) - בלי "בוצע", בלי התראות איחור.
//   dateSource      'orderDate' | 'event' | 'returnDue' | 'deliveryOut' | 'deliveryReturn' - איך שורה "שייכת ליום X".
//   defaultOffset   ימי עסקים יחסית לאירוע (שלילי = לפני). null = אין offset (מקור התאריך אינו האירוע).
//                   ימי העסקים נספרים תמיד לפי הכלל האחיד (lib/businessDays.js: שישי, שבת, חג, ערב חג,
//                   רשימת הבעלים) - אין לוח לכל שלב (החלטות הבעלים B4 + 3, 1.10.2026). משלוחים (5/9):
//                   התאריכים מחושבים ב-lib/deliveries.js לפי אותו כלל (שישי/שבת שם לפי delivery_skip_weekends).
//   offsetConfigurable  האם מפתח SystemSetting `schedule_stage_<key>_days` רשאי לשנות את ה-offset.
//   doneSource      שדה "בוצע" קיים ברמת פריט: 'alterationDone' | 'isTaken' | 'isReturned' | null.
//                   null בשלב שאינו infoOnly = אין עדיין מקור נתונים (שלבים 4, 5, 9 - ר' INVENTORY G1).
//   showModel       האם השורה נושאת דגם/מידה (החלטה: לא בשלבים 5 ו-8).
//   showAddress     האם השורה נושאת כתובת (משלוחים והחזרה ידנית).
//   requiresSetting  מפתח SystemSetting שכיבויו מכבה את השלב כולו (משלוחים / תיקונים).

export const STAGES = [
  {
    key: 'order', number: 1, label: 'הזמנה', plural: 'הזמנות',
    infoOnly: true, dateSource: 'orderDate', defaultOffset: null, offsetConfigurable: false,
    doneSource: null, showModel: false, showAddress: false, requiresSetting: null,
    what: 'הזמנות חדשות שנרשמו באותו יום - לידיעה בלבד',
  },
  {
    key: 'repair', number: 2, label: 'תיקונים', plural: 'תיקונים',
    infoOnly: false, dateSource: 'event', defaultOffset: 0, offsetConfigurable: true,
    doneSource: 'alterationDone', showModel: true, showAddress: false, requiresSetting: 'enable_alterations',
    what: 'פריטים עם תיקון (צוואר/אורך/שרוול) - אותו כלל כמו מסך התיקונים',
  },
  {
    key: 'prep', number: 4, label: 'הכנה', plural: 'הכנות',
    infoOnly: false, dateSource: 'event', defaultOffset: -3, offsetConfigurable: true,
    doneSource: null, showModel: true, showAddress: false, requiresSetting: null,
    what: 'הכנה, בדיקה ואריזה - 3 ימי עסקים לפני האירוע (כמו "הכנות להיום" בהדפסה)',
  },
  {
    key: 'dout', number: 5, label: 'משלוח הלוך', plural: 'משלוחי הלוך',
    infoOnly: false, dateSource: 'deliveryOut', defaultOffset: null, offsetConfigurable: false,
    doneSource: null, showModel: false, showAddress: true, requiresSetting: 'enable_deliveries',
    what: 'משלוח יוצא ללקוחה - לפי כללי המשלוחים הקיימים (delivery_days_before)',
  },
  {
    key: 'pick', number: 6, label: 'איסוף מקומי', plural: 'איסופים מקומיים',
    infoOnly: false, dateSource: 'event', defaultOffset: -2, offsetConfigurable: true,
    doneSource: 'isTaken', showModel: true, showAddress: false, requiresSetting: null,
    what: 'הלקוחה מגיעה לקחת - 2 ימי עסקים לפני האירוע (כמו "קבלת השמלות" בדף ההזמנה)',
  },
  {
    key: 'event', number: 7, label: 'אירוע', plural: 'אירועים',
    infoOnly: true, dateSource: 'event', defaultOffset: 0, offsetConfigurable: false,
    doneSource: null, showModel: true, showAddress: false, requiresSetting: null,
    what: 'יום האירוע - מידע בלבד, בלי אולם ובלי שעה',
  },
  {
    key: 'manret', number: 8, label: 'החזרה ידנית', plural: 'החזרות ידניות',
    infoOnly: false, dateSource: 'returnDue', defaultOffset: 1, offsetConfigurable: true,
    doneSource: 'isReturned', showModel: false, showAddress: true, requiresSetting: null,
    what: 'הלקוחה מחזירה בסניף - מועד ההחזרה הצפוי (toDate / returnDate / יום עסקים אחרי האירוע)',
  },
  {
    key: 'dback', number: 9, label: 'משלוח חזור', plural: 'משלוחי חזור',
    infoOnly: false, dateSource: 'deliveryReturn', defaultOffset: null, offsetConfigurable: false,
    doneSource: null, showModel: false, showAddress: true, requiresSetting: 'enable_deliveries',
    what: 'השליח אוסף מהלקוחה - לפי כללי המשלוחים הקיימים (delivery_days_after)',
  },
];

export const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s]));
export const STAGE_KEYS = STAGES.map((s) => s.key);

// ערכי משמרת מותרים לשלב (S08): ברירת מחדל 'none' = בלי משמרות, לפי ימים בלבד.
export const SHIFT_VALUES = ['none', 'am', 'pm', 'all'];
export const SHIFT_LABELS = { none: '', am: 'בוקר', pm: 'ערב', all: 'כל היום' };

export function getStage(key) {
  return STAGE_BY_KEY[key] || null;
}
