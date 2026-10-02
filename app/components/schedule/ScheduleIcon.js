'use client';

import { MenuSprite } from '@/app/components/menu/menuParts';
import { SPRITE_ID_PREFIX } from '@/app/components/menu/spriteSymbols';
import { useA5Shell } from '@/app/components/menu/A5ShellContext';

// אייקון מספריית הפלטה בהפניה פנימית (#gmi-<שם>) ל-sprite שמוטמע בתוך הדף - לא הפניה חיצונית לקובץ
// design-system/sprite.svg: מסנני תוכן של אינטרנט מסונן (Netspark/רימון/נטפרי) מחליפים את קובץ ה-SVG בריבוע
// לבן והאייקונים נעלמים (כך קרה למעטפת לפני 1.10; הסבר מלא ב-app/components/menu/menuParts.js ובדף הבית,
// app/components/home/HomeParts.js). משתמש בכל רכיבי דף הלו״ז. כל השמות קיימים ב-spriteSymbols.js (נאכף
// בבדיקה scripts/schedule-tests/ui-source.test.mjs).
export default function ScheduleIcon({ name, className = '', style }) {
  return (
    <svg className={'ic' + (className ? ' ' + className : '')} style={style} aria-hidden="true" focusable="false">
      <use href={'#' + SPRITE_ID_PREFIX + name} />
    </svg>
  );
}

// ה-sprite המוטמע חייב להיות בדף בדיוק פעם אחת. במעטפת החדשה (MenuA5Shell) הוא כבר שם; כשה-layout נפל חזרה
// ל-AppShell או למעטפת ה-legacy אין מי שמטמיע אותו, ולכן הדף מטמיע בעצמו - לפי ה-A5ShellContext שהמעטפת
// החדשה מספקת בפועל (אותו דפוס כמו HomeSprite בדף הבית, #207), לא לפי דגל, כדי שלא יהיה כפול ולא חסר.
// בנוסף: וי בעיגול (lz-i-checkc) - אייקון דגימה שאין לו מספר בפלטה (החלטה J09, נשאר כמו בעיצוב), symbol
// מקומי של הדף ולא ב-sprite הגלובלי. LocalSprite מרונדר פעם אחת ב-ScheduleDay.js.
export function LocalSprite() {
  const inA5Shell = useA5Shell();
  return (
    <>
      {inA5Shell ? null : <MenuSprite />}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <symbol id="lz-i-checkc" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12.5 2.7 2.7L16 9.5" />
          </symbol>
          {/* וי כפול (i-checks) - "הכל בוצע" לשלב; גם הוא אייקון דגימה בלי מספר בפלטה (החלטה J09) */}
          <symbol id="lz-i-checks" viewBox="0 0 24 24">
            <path d="m2.5 12.5 4 4L13 10M9.5 16.5l2 2L21.5 8" />
          </symbol>
        </defs>
      </svg>
    </>
  );
}

export function DoubleCheckIcon({ className = '' }) {
  return (
    <svg className={'ic' + (className ? ' ' + className : '')} aria-hidden="true" focusable="false">
      <use href="#lz-i-checks" />
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
