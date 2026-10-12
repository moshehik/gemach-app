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

/**
 * בחירה מפורשת כן / לא בלי ברירת מחדל: שני לחצני .btn.tgl (בורר 13 בפלטה) בתוך radiogroup.
 * value: null | true | false. רווח / לחיצה בוחרים; חצים עוברים בין שתי האפשרויות; Enter מועבר לשדה הבא ע"י useEnterNav (ה-hook המשותף; role=radio).
 */
export function YesNo({ id, label, value, onChange, yesLabel = 'כן', noLabel = 'לא', invalid }) {
  const pick = (v) => () => onChange(v);
  const onKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(value === true ? false : true);
    }
  };
  return (
    <div className={`ks-yn${invalid ? ' bad' : ''}`} role="radiogroup" aria-labelledby={`${id}-l`} onKeyDown={onKey}>
      <span className="ks-yn-l" id={`${id}-l`}>{label}</span>
      <div className="ks-yn-b">
        <button type="button" id={`${id}-y`} role="radio" aria-checked={value === true} className={`btn tgl${value === true ? ' on' : ''}`} data-agy-id={`${id}_yes`} onClick={pick(true)}>
          {value === true ? <KIcon id="check" size="sm" /> : null}{yesLabel}
        </button>
        <button type="button" id={`${id}-n`} role="radio" aria-checked={value === false} className={`btn tgl${value === false ? ' on' : ''}`} data-agy-id={`${id}_no`} onClick={pick(false)}>
          {value === false ? <KIcon id="x" size="sm" /> : null}{noLabel}
        </button>
      </div>
    </div>
  );
}
