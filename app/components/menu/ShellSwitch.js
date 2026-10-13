'use client';

// בורר המעטפת: וריאנט 'shell' = 'legacy' (ברירת מחדל) -> AppShell הקיים, בלי שום שינוי.
// 'a5' (ui_variant_shell או עקיפה אישית, ר' lib/uiVariant.js) -> המעטפת החדשה MenuA5Shell.
// useUiVariant כבר מחיל את כלל ה-pathname: קיוסק / שעון נוכחות / דפי הדפסה תמיד 'legacy'.
// המעטפת החדשה נטענת בעצלות (dynamic): ה-CSS שלה (design-system/components.css, ~450KB) לא נשלח בכלל
// למי שנשארת על 'legacy' - כך שהאתר ללא דגלים לא משתנה ולא נעשה כבד יותר.
//
// עמדת הלקוח (/customer-interface): בלי שלד בכלל (lib/shellBare.js). בטעינה מלאה ה-layout כבר לא מרנדר אותנו; כאן ההגנה לניווט רך אליה
// (ה-layout לא מרונדר מחדש): הנתיב נבדק באותו רינדור של הניווט, ולכן השלד לא מבהב אפילו רגע.

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import AppShell from '../AppShell';
import { useUiVariant } from '../UiVariantContext';
import { isKioskBarePath } from '@/lib/shellBare';

const MenuA5Shell = dynamic(() => import('./MenuA5Shell'));

export default function ShellSwitch({ menuTree, ...shellProps }) {
  const variant = useUiVariant('shell');
  const pathname = usePathname();
  if (isKioskBarePath(pathname)) return <>{shellProps.children}</>;
  if (variant === 'a5' && menuTree) return <MenuA5Shell menuTree={menuTree} {...shellProps} />;
  return <AppShell {...shellProps} />;
}
