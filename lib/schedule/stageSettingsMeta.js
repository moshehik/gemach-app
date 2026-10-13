// lib/schedule/stageSettingsMeta.js - קבועים טהורים של חלון "הגדרות תהליכים" שמותר לייבא גם בצד הלקוח (בלי settings.js / prisma).
export { SHIFT_VALUES, SHIFT_LABELS } from './stages.js';

/** קבוצות התצוגה, כמו בעיצוב: לפני האירוע / יום האירוע / אחרי האירוע (+ שלבים שאינם נגזרי תאריך האירוע) */
export const GROUP_ORDER = [['before', 'לפני האירוע'], ['event', 'יום האירוע'], ['after', 'אחרי האירוע'], ['other', 'לא תלוי ביום האירוע']];
