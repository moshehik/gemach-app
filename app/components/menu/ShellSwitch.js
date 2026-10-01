'use client';

// בורר המעטפת: וריאנט 'shell' = 'legacy' (ברירת מחדל) -> AppShell הקיים, בלי שום שינוי.
// 'a5' (ui_variant_shell או עקיפה אישית, ר' lib/uiVariant.js) -> המעטפת החדשה MenuA5Shell.
// useUiVariant כבר מחיל את כלל ה-pathname: קיוסק / שעון נוכחות / דפי הדפסה תמיד 'legacy'.
// המעטפת החדשה נטענת בעצלות (dynamic): ה-CSS שלה (design-system/components.css, ~450KB) לא נשלח בכלל
// למי שנשארת על 'legacy' - כך שהאתר ללא דגלים לא משתנה ולא נעשה כבד יותר.

import dynamic from 'next/dynamic';
import AppShell from '../AppShell';
import { useUiVariant } from '../UiVariantContext';

const MenuA5Shell = dynamic(() => import('./MenuA5Shell'));

export default function ShellSwitch({ menuTree, ...shellProps }) {
  const variant = useUiVariant('shell');
  if (variant === 'a5' && menuTree) return <MenuA5Shell menuTree={menuTree} {...shellProps} />;
  return <AppShell {...shellProps} />;
}
