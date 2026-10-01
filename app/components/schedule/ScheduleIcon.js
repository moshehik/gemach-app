// אייקון מה-sprite של מערכת העיצוב (design-system/sprite.svg) - הפניה חיצונית, כמו שמורה ה-README
// (ה-sprite הישן של האתר, IconSprite.js, מכיל מזהים באותם שמות). משתמש בכל רכיבי דף הלו״ז.
export default function ScheduleIcon({ name, className = '', style }) {
  return (
    <svg className={'ic' + (className ? ' ' + className : '')} style={style} aria-hidden="true" focusable="false">
      <use href={'/design-system/sprite.svg#i-' + name} />
    </svg>
  );
}

// וי בעיגול (i-checkc): אייקון דגימה שאין לו מספר בפלטה (החלטה J09 - נשאר כמו בעיצוב). מוטמע כאן
// כ-symbol מקומי של הדף ולא ב-sprite הגלובלי. נדרש לרנדר LocalSprite פעם אחת בדף.
export function LocalSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="lz-i-checkc" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12.5 2.7 2.7L16 9.5" />
        </symbol>
      </defs>
    </svg>
  );
}

export function CheckCircleIcon({ className = '' }) {
  return (
    <svg className={'ic' + (className ? ' ' + className : '')} aria-hidden="true" focusable="false">
      <use href="#lz-i-checkc" />
    </svg>
  );
}
