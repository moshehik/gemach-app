'use client';

// A5Icon - האייקונים של ערכת הרשימות: Ic = אותו אייקון של שאר דפי A5 (הפניה פנימית #gmi-<שם> ל-sprite המוטמע של הפלטה, עם
// מחלקות אנימציית הריחוף ia-<שם> ia-h), ועוד שבעה אייקונים שהעיצוב המאושר (employees.html / models.html) צייר ושאין ב-sprite
// של הפלטה (EXTRA_ICONS ב-scratch/emp-models-build/build.py): ban, online, building, hash, sortv, store, key.
// הם מוטמעים פעם אחת בדף (useA5Sprite) תחת אותם מזהים gmi-<שם>, כך שכל <use href="#gmi-ban"> עובד כמו אייקון רגיל.
// כשהאייקונים ייכנסו ל-design-system/sprite.svg (ויווצרו מחדש ב-spriteSymbols.js) - ההטמעה כאן הופכת ל-no-op בגלל הבדיקה לפי id.

import { useLayoutEffect } from 'react';
import { Ic, decorateButtons } from '../attendance/parts';
import { SPRITE_ID_PREFIX, SPRITE_SYMBOLS } from '../menu/spriteSymbols';

export { Ic, decorateButtons };

const EXTRA = {
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/>',
  online: '<path d="M4.5 10a11 11 0 0 1 15 0M7.7 13.2a6.5 6.5 0 0 1 8.6 0"/><circle cx="12" cy="17.5" r="1.3"/>',
  building: '<path d="M4 21V6l9-3v18M13 9l7 2v10M3 21h18M8 9v.01M8 13v.01M8 17v.01M17 15v.01M17 18v.01"/>',
  hash: '<path d="M9.5 3 7.5 21M16.5 3l-2 18M4 9h17M3 15h17"/>',
  sortv: '<path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4"/>',
  store: '<path d="M3 21V9l9-5 9 5v12M7 21v-7h10v7M7 17.5h10"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
};
const SPRITE_DOM_ID = 'a5l-extra-sprite';

/** מטמיע (פעם אחת בכל המסמך) את האייקונים שחסרים ב-sprite הרגיל. בטוח לקרוא מכמה רכיבים. */
export function useA5Sprite() {
  useLayoutEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(SPRITE_DOM_ID)) return;
    const known = new Set(SPRITE_SYMBOLS.map((s) => s[0]));
    const symbols = Object.entries(EXTRA).filter(([k]) => !known.has(k))
      .map(([k, body]) => `<symbol id="${SPRITE_ID_PREFIX}${k}" viewBox="0 0 24 24">${body}</symbol>`).join('');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', SPRITE_DOM_ID);
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.position = 'absolute';
    svg.innerHTML = `<defs>${symbols}</defs>`;
    document.body.appendChild(svg);
  }, []);
}

/** שלושת סמלי הייצוא של המערכת (xlbtn xlg / xld / xlp) - אותו markup כמו XL_SVG / DL_SVG / PRT_SVG בעיצוב. */
export function XlGlyph() {
  return (
    <svg className="xlic" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3" fill="#107C41" /><path d="M5 4.5l6 7M11 4.5l-6 7" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none" /></svg>
  );
}
export function DlGlyph() {
  return (
    <svg className="dlic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#a83d6c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><g className="dl-arrow"><path d="M8 2v7.5M5 6.8l3 3 3-3" /></g><path d="M2.5 11.5v1.2a1.3 1.3 0 0 0 1.3 1.3h8.4a1.3 1.3 0 0 0 1.3-1.3v-1.2" /></svg>
  );
}
export function PrtGlyph() {
  return (
    <svg className="prtic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#1e63c4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path className="prt-top" d="M4.5 5.5V2h7v3.5" /><rect x="1.5" y="5.5" width="13" height="6" rx="1.6" /><g className="prt-sheet"><rect x="4.5" y="9" width="7" height="5.5" rx=".6" fill="#fff" /><path d="M6.3 11.2h3.4M6.3 12.9h2.2" strokeWidth="1" /></g></svg>
  );
}
