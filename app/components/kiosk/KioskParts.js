'use client';

// KioskParts - חלקים קטנים משותפים של עמדת הלקוח החדשה.

import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';
import { getDressThumbUrl } from '@/app/lib/dressImageUrl';

// אייקון מה-sprite המוטמע של הפלטה (#gmi-<שם>, ר' design-system/README.md סעיף 3), בלי מחלקות הנפשת הריחוף ia-*:
// הלוח והחצים של העמדה מסובבים ב-CSS (transform) וההנפשה הייתה מתנגשת.
export function KIcon({ id, size, className, style }) {
  const cls = 'ic' + (size ? ` ${size}` : '') + (className ? ` ${className}` : '');
  return (
    <svg className={cls} style={style} aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${id}`} /></svg>
  );
}

// תמונת דגם בתאים הקטנים: קודם ה-thumb (קיים רק להעלאות חדשות - app/lib/dressImageUrl.js), ועם onError חוזרים לתמונה המלאה.
// loading="lazy" כדי שגלילה בקטלוג לא תוריד את כל התמונות מראש.
export function KioskThumbImg({ model }) {
  const thumbSrc = getDressThumbUrl(model);
  return (
    <img
      src={thumbSrc || model.imageUrl}
      alt={model.name || ''}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const img = e.target;
        if (thumbSrc && !img.dataset.fellBack) {
          img.dataset.fellBack = '1';
          img.src = model.imageUrl;
        }
      }}
    />
  );
}
