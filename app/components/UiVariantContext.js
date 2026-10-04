'use client';

import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_UI_VARIANT, isForcedLegacyPath, isUiScreen } from '@/lib/uiVariant';
import { hasBothVersions } from '@/lib/uiVariantScreens';
import { isSelfSwitchScreen } from '@/lib/uiVariantSelfSwitch';

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
// האם המשתמש המחובר רשאי להחליף לעצמו "ישן / חדש" (הנהלה ראשית / מתכנת — isManagementRole ב-lib/uiVariantSelfSwitch.js),
// כפי ש-app/layout.js חישב בשרת מה-roleId (בלי בקשה נוספת). משמש רק להצגת האייקון PageVariantToggle — ה-POST אוכף מחדש מה-DB.
const UiVariantSelfSwitchContext = createContext(false);

export function UiVariantProvider({ value, canSelfSwitch = false, children }) {
  return (
    <UiVariantContext.Provider value={value || {}}>
      <UiVariantSelfSwitchContext.Provider value={canSelfSwitch === true}>{children}</UiVariantSelfSwitchContext.Provider>
    </UiVariantContext.Provider>
  );
}

/**
 * האם להציג את אייקון המעבר "ישן / חדש" של מסך (PageVariantToggle): המשתמש רשאי להחליף לעצמו, המסך ברשומה עם שתי
 * הגרסאות ומותר בו מעבר עצמאי, ולא בקיוסק / שעון נוכחות / הדפסה (isForcedLegacyPath).
 */
export function useCanSelfSwitch(screen) {
  const allowed = useContext(UiVariantSelfSwitchContext);
  const pathname = usePathname();
  if (!allowed) return false;
  if (!isUiScreen(screen) || !hasBothVersions(screen) || !isSelfSwitchScreen(screen)) return false;
  if (isForcedLegacyPath(pathname)) return false;
  return true;
}

// הערה: מחזיר את הערכים כפי שהוכרעו בשרת, בלי כלל ה-pathname — ל-shell העדיפו useUiVariant('shell').
export function useUiVariants() {
  return useContext(UiVariantContext);
}

// הכרעה מקומית של מסך בתוך עץ מסוים (VariantFrame, app/components/variant/VariantFrame.js): דף שרת שבחר בשרת בין Legacy* לחדש
// (getRequestUiVariant) עוטף את מה שבחר, כך שכל רכיב בפנים (האייקון, AutoClockSwitch) רואה בדיוק את אותה הכרעה — גם אם ערכי
// ה-layout ישנים (ה-root layout לא מרונדר מחדש בניווט רך).
const ScreenVariantScopeContext = createContext(null);

export function ScreenVariantScope({ screen, variant, children }) {
  const parent = useContext(ScreenVariantScopeContext);
  const value = isUiScreen(screen) && (variant === 'a5' || variant === 'legacy') ? { ...(parent || {}), [screen]: variant } : parent;
  return <ScreenVariantScopeContext.Provider value={value}>{children}</ScreenVariantScopeContext.Provider>;
}

export function useUiVariant(screen) {
  const values = useContext(UiVariantContext);
  const scoped = useContext(ScreenVariantScopeContext);
  const pathname = usePathname();
  if (!isUiScreen(screen)) return DEFAULT_UI_VARIANT;
  if (screen !== 'shell' && scoped && Object.prototype.hasOwnProperty.call(scoped, screen)) return scoped[screen];
  // ה-layout הראשי לא מרונדר מחדש בניווט רך, ולכן גם אם נכנסים מדף רגיל לקיוסק / הדפסה בלי טעינה
  // מלאה, המעטפת נשארת 'legacy' — אותו כלל כמו בשרת.
  if (screen === 'shell' && isForcedLegacyPath(pathname)) return DEFAULT_UI_VARIANT;
  return values[screen] === 'a5' ? 'a5' : DEFAULT_UI_VARIANT;
}
