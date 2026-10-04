'use client';

// VariantFrame — העטיפה של גרסה שנבחרה (Switch של מסך). שני תפקידים:
//   1. ScreenVariantScope: כל רכיב בפנים רואה את ההכרעה שנעשתה כאן (useUiVariant(screen)), גם אם ערכי ה-layout ישנים.
//   2. בגרסה הישנה (variant='legacy') — האייקון "מעבר לתצוגה החדשה" בפינה קבועה (portal ל-body, כדי ש-transform של אב לא
//      ישבור position:fixed), בלי לגעת בקובץ הישן עצמו (Legacy*.js משוחזרים מ-git כפי שהם). בגרסה החדשה האייקון יושב
//      בסרגל הכותרת של הדף החדש עצמו (PageVariantToggle placement="header"), ולכן כאן אין פינה.
// האייקון מוצג רק למי שרשאי (useCanSelfSwitch) — לכל השאר העטיפה שקופה לגמרי.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScreenVariantScope, useCanSelfSwitch } from '../UiVariantContext';
import PageVariantToggle from './PageVariantToggle';

export function CornerToggle({ screen, placement = 'corner' }) {
  const allowed = useCanSelfSwitch(screen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!allowed || !mounted || typeof document === 'undefined') return null;
  // מרווח בסוף התוכן (רק כשהאייקון מוצג), כדי שגלילה עד הסוף לא תשאיר כפתור של הדף (למשל "שמירת פרטים") מתחת לאייקון הקבוע
  return (
    <>
      <div className="gm-pvt-spacer" aria-hidden="true" />
      {createPortal(<PageVariantToggle screen={screen} placement={placement} />, document.body)}
    </>
  );
}

export default function VariantFrame({ screen, variant, children }) {
  return (
    <ScreenVariantScope screen={screen} variant={variant}>
      {children}
      {variant === 'legacy' ? <CornerToggle screen={screen} /> : null}
    </ScreenVariantScope>
  );
}
