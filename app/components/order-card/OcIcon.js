'use client';

import { MenuSprite } from '@/app/components/menu/menuParts';
import { SPRITE_ID_PREFIX, SPRITE_SYMBOLS } from '@/app/components/menu/spriteSymbols';
import { useA5Shell } from '@/app/components/menu/A5ShellContext';

// אייקון מספריית הפלטה בהפניה פנימית (#gmi-<שם>) ל-sprite שמוטמע בדף - לעולם לא /design-system/sprite.svg (מסנני תוכן מחליפים
// קובץ SVG חיצוני בריבוע לבן) ולא #i-* של IconSprite.js הישן (30 התנגשויות שמות). כמו ScheduleIcon / Ic בדף הבית והפרופיל.
// size: 'sm' | 'lg' | undefined (מחלקות הפלטה). anim: מוסיף את מחלקות אנימציית הריחוף של הפלטה (ia-<שם> ia-h) כמו בפרופיל.
export const OC_ICON_NAMES = new Set(SPRITE_SYMBOLS.map(s => s[0]));

export default function OcIcon({ name, size, className = '', anim = false, style }) {
  const cls = ['ic', size, anim ? `ia-${name} ia-h` : '', className].filter(Boolean).join(' ');
  return (
    <svg className={cls} style={style} aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${name}`} /></svg>
  );
}

// ה-sprite המוטמע חייב להיות בדף בדיוק פעם אחת: במעטפת החדשה (MenuA5Shell) הוא כבר שם; במעטפת ה-legacy / AppShell
// הכרטיס מטמיע בעצמו - לפי ה-A5ShellContext בפועל (אותו דפוס כמו HomeSprite / LocalSprite), לא לפי דגל.
export function OcSprite() {
  return useA5Shell() ? null : <MenuSprite />;
}

// אייקוני ה-xlbtn של שורת הכותרת (Excel / הורדה / הדפסה / מחיקה / נעילה) - SVG מוטבע כמו בעיצוב ובדף הבית (XlButtons ב-HomeParts.js),
// לא מה-sprite (הצבעים קבועים בתוך הציור).
export function XlGlyph({ kind }) {
  if (kind === 'excel') {
    return (
      <svg className="xlic" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3" fill="#107C41" /><path d="M5 4.5l6 7M11 4.5l-6 7" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none" /></svg>
    );
  }
  if (kind === 'download') {
    return (
      <svg className="dlic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#a83d6c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><g className="dl-arrow"><path d="M8 2v7.5M5 6.8l3 3 3-3" /></g><path d="M2.5 11.5v1.2a1.3 1.3 0 0 0 1.3 1.3h8.4a1.3 1.3 0 0 0 1.3-1.3v-1.2" /></svg>
    );
  }
  if (kind === 'print') {
    return (
      <svg className="prtic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#1e63c4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path className="prt-top" d="M4.5 5.5V2h7v3.5" /><rect x="1.5" y="5.5" width="13" height="6" rx="1.6" /><g className="prt-sheet"><rect x="4.5" y="9" width="7" height="5.5" rx=".6" fill="#fff" /><path d="M6.3 11.2h3.4M6.3 12.9h2.2" strokeWidth="1" /></g></svg>
    );
  }
  if (kind === 'delete') {
    return (
      <svg className="dlic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#a83d6c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5h11M6 4.5V2.8h4v1.7M4 4.5l.6 8.7h6.8l.6-8.7M6.6 7v4M9.4 7v4" /></svg>
    );
  }
  return null;
}
