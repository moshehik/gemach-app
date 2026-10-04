'use client';

// VariantFrame — העטיפה של גרסה שנבחרה (Switch של מסך). שני תפקידים:
//   1. ScreenVariantScope: כל רכיב בפנים רואה את ההכרעה שנעשתה כאן (useUiVariant(screen)), גם אם ערכי ה-layout ישנים.
//   2. בגרסה הישנה (variant='legacy') — האייקון "מעבר לתצוגה החדשה" בפינה קבועה (portal ל-body, כדי ש-transform של אב לא
//      ישבור position:fixed), בלי לגעת בקובץ הישן עצמו (Legacy*.js משוחזרים מ-git כפי שהם). בגרסה החדשה האייקון יושב
//      בסרגל הכותרת של הדף החדש עצמו (PageVariantToggle placement="header"), ולכן כאן אין פינה.
// האייקון מוצג רק למי שרשאי (useCanSelfSwitch) — לכל השאר העטיפה שקופה לגמרי.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScreenVariantScope } from '../UiVariantContext';
import PageVariantToggle from './PageVariantToggle';

export function CornerToggle({ screen, placement = 'corner' }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(<PageVariantToggle screen={screen} placement={placement} />, document.body);
}

export default function VariantFrame({ screen, variant, children }) {
  return (
    <ScreenVariantScope screen={screen} variant={variant}>
      {children}
      {variant === 'legacy' ? <CornerToggle screen={screen} /> : null}
    </ScreenVariantScope>
  );
}
