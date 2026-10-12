'use client';

// אייקון מה-sprite של הפלטה, בהפניה פנימית (#gmi-<שם>) ל-sprite שמוטמע בתוך הדף (ר' HomeSprite ב-HomeParts.js).
// בקובץ קטן משלו כדי ש-ResultRow.js (שורת התוצאה המשותפת, גם לפאנל התפוסה שבתפריט) לא יגרור את homeLogic.js לכל עמוד.
// לא הפניה חיצונית לקובץ sprite.svg: מסנני תוכן של אינטרנט מסונן (Netspark וכד') מחליפים את קובץ ה-SVG בריבוע לבן 2x2 והאייקונים נעלמים
// (אותה בעיה והסבר מלא ב-app/components/menu/menuParts.js).
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';

export function Ic({ id, size, className }) {
  const cls = 'ic' + (size ? ' ' + size : '') + (className ? ' ' + className : '');
  return (
    <svg className={cls} aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${id}`} /></svg>
  );
}
