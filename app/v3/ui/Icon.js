'use client';
// v3 <Icon> — עוטף <svg><use href="#i-name"> מהספרייט הקיים (IconSprite) + IconSpriteV3.
// אין path מקומי בעמוד (R2). אנימציה: ברירת מחדל לפי שם (ICON-INVENTORY), ניתנת לדריסה.
// האליאסים/אנימציית-ברירת-המחדל עברו ל-app/v3/icons/aliases.js (LIBRARY-MAP §1) - כאן
// רק re-export לתאימות אחורה (שום import קיים של השמות האלה מ-'./Icon' לא נשבר).
import '../icons.css';
import { ICON_ALIASES, ICON_ANIM, DIRECTIONAL_ICON_NAMES, resolveIconId } from '../icons/aliases';

export { ICON_ALIASES, ICON_ANIM, DIRECTIONAL_ICON_NAMES, resolveIconId };

const SIZE_CLASS = { xs: 'v3-ic--xs', sm: 'v3-ic--sm', md: '', lg: 'v3-ic--lg', xl: 'v3-ic--xl', '2xl': 'v3-ic--2xl' };

/**
 * name  — id בספרייט או כינוי (עם/בלי i-/ic-)
 * size  — xs|sm|md|lg|xl|2xl (md = --v3-ic)
 * anim  — שם אנימציה | false לכיבוי | undefined = ברירת מחדל לפי שם
 * loop  — רציף (טעינה/המתנה); enter — קפיצת כניסה בטעינה
 * title — אם ניתן האיקון נגיש (role=img); אחרת aria-hidden
 */
export default function Icon({ name, size = 'md', anim, loop = false, enter = false, title, className = '', ...rest }) {
  const id = resolveIconId(name);
  const a = anim === false ? undefined : anim || ICON_ANIM[id];
  const cls = ['v3-ic', SIZE_CLASS[size] ?? '', enter ? 'v3-icon--enter' : '', className].filter(Boolean).join(' ');
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': 'true', focusable: 'false' };
  return (
    <svg className={cls} data-anim={a} data-loop={loop ? 'true' : undefined} {...a11y} {...rest}>
      <use href={`#i-${id}`} />
    </svg>
  );
}
