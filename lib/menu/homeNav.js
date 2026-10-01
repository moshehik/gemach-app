// lib/menu/homeNav.js — לחיצה חוזרת על פריט "בית" (גם כשהכתובת לא משתנה). Next לא מפעיל שום אפקט כשמנווטים לכתובת הנוכחית,
// ולכן המעטפת משדרת אירוע חלון בכל לחיצה על קישור שמצביע ל-"/" ודף הבית (HomeA5) מחיל מחדש את ההוראה. מודול טהור.

export const HOME_NAV_EVENT = 'gm-home-nav';

/** { isHome, query } לקישור פנימי: isHome = הנתיב הוא "/" בדיוק; query = מחרוזת ה-query בלי '?' ובלי #hash. */
export function homeNavTarget(href) {
  const s = typeof href === 'string' ? href : '';
  const noHash = s.split('#')[0];
  const q = noHash.indexOf('?');
  const path = (q === -1 ? noHash : noHash.slice(0, q)) || '/';
  return { isHome: path === '/', query: q === -1 ? '' : noHash.slice(q + 1) };
}
