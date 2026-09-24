// app/v3/tokens/breakpoints.js — הסט היחיד המותר (CONSTITUTION §ב.6, D-15 ✅).
// CSS לא תומך ב-var() בתוך @media, אז זהו מקור האמת ב-JS (למיון/לוגיקה ב-React)
// וגם מסמך-ייחוס לכל @media שנכתב ידנית ב-CSS. tools/v3-lint/media.mjs (§ח-11)
// נכשל על כל מספר @media שלא מופיע כאן.

export const BREAKPOINTS = {
  sm: 480,   // דחיסת seg קטנה / phone קטן מאוד
  md: 640,   // phone <-> sheet; כרטיס 16px; ציר זמן אנכי; חלונית = bottom sheet
  lg: 768,   // tablet: drawer <-> topbar מלא
  xl: 1024,  // laptop: רייל צדדי <-> bottom sheet; הסרגל העליון מתכווץ (container query/overflow, לא breakpoint נוסף)
  '2xl': 1440, // wide: חריג טבלה/לוח רחבים
  '3xl': 1920, // מגבלת רוחב עליונה
};

// מיפוי מהבלגן הקיים (diagnosis 01/03/04) לסט החדש - לתיעוד ולסקריפטי מיגרציה עתידיים.
// לא מבצע שום שינוי בפועל כאן; שימוש: כל @media חדש שנכתב מעתה משתמש רק בערכים ב-BREAKPOINTS.
export const LEGACY_BREAKPOINT_MAP = {
  380: 'sm', 420: 'sm',
  640: 'md',
  641: 'lg', 767: 'lg', 900: 'lg',
  980: 'lg', 1020: 'xl', 1040: 'xl', 1180: 'xl',
  1700: '3xl',
};

export function mq(name, type = 'max-width') {
  const px = BREAKPOINTS[name];
  if (!px) throw new Error(`Unknown v3 breakpoint: ${name}`);
  return `(${type}: ${px}px)`;
}

// מחלקות מסך (CONSTITUTION §ג.1) - data-screen שמוצב ע"י V3Page/הרכיב הרלוונטי.
export const SCREEN_CLASSES = ['phone', 'tablet', 'laptop', 'wide', 'kiosk'];

export function screenClassForWidth(px) {
  if (px < BREAKPOINTS.md) return 'phone';
  if (px < BREAKPOINTS.xl) return 'tablet';
  if (px < BREAKPOINTS['2xl']) return 'laptop';
  return 'wide';
}
