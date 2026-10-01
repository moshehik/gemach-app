'use client';

import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_UI_VARIANT, isForcedLegacyPath, isUiScreen } from '@/lib/uiVariant';

// גרסאות "ישן / A5" לכל מסך, כפי ש-app/layout.js הכריע בשרת (lib/uiVariant.js):
// { shell, home, order_card, customer_card } עם 'legacy' | 'a5'.
// מחוץ ל-Provider (למשל בדף בדיקה) כל מסך הוא 'legacy'.
//
// שימוש ברכיב לקוח:
//   const variant = useUiVariant('order_card');   // 'legacy' | 'a5'
//   return variant === 'a5' ? <A5OrderCard /> : <LegacyOrderCard />;
//
// זה הקורא היחיד המותר של הדגלים. ה-layout כותב אמנם גם data-ui-shell / data-ui-home / ... על ה-<body>,
// אבל ה-root layout לא מרונדר מחדש בניווט רך (client navigation), ולכן אחרי מעבר מדף רגיל לקיוסק / הדפסה
// data-ui-shell עלול להישאר 'a5'. אסור להתבסס עליהם ב-CSS (selectors כמו body[data-ui-shell=...]) או ב-JS;
// רק ה-hooks כאן מחילים את כלל ה-pathname (isForcedLegacyPath) בצד הלקוח.
const UiVariantContext = createContext({});

export function UiVariantProvider({ value, children }) {
  return <UiVariantContext.Provider value={value || {}}>{children}</UiVariantContext.Provider>;
}

// הערה: מחזיר את הערכים כפי שהוכרעו בשרת, בלי כלל ה-pathname — ל-shell העדיפו useUiVariant('shell').
export function useUiVariants() {
  return useContext(UiVariantContext);
}

export function useUiVariant(screen) {
  const values = useContext(UiVariantContext);
  const pathname = usePathname();
  if (!isUiScreen(screen)) return DEFAULT_UI_VARIANT;
  // ה-layout הראשי לא מרונדר מחדש בניווט רך, ולכן גם אם נכנסים מדף רגיל לקיוסק / הדפסה בלי טעינה
  // מלאה, המעטפת נשארת 'legacy' — אותו כלל כמו בשרת.
  if (screen === 'shell' && isForcedLegacyPath(pathname)) return DEFAULT_UI_VARIANT;
  return values[screen] === 'a5' ? 'a5' : DEFAULT_UI_VARIANT;
}
