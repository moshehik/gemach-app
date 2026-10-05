'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import LegacyHome from './LegacyHome';
import VariantFrame from '../variant/VariantFrame';

// הדף החדש נטען בנפרד (dynamic) — כך קובץ ה-CSS הגדול של הפלטה (design-system/components.css, ~450KB)
// וקוד הדף החדש לא נטענים בכלל כשהדגל 'legacy' (ברירת המחדל), והאתר נשאר זהה לקודם.
const HomeA5 = dynamic(() => import('./HomeA5'), { ssr: false });

export default function HomeSwitch() {
  const variant = useUiVariant('home');
  // בישן: אייקון "מעבר לתצוגה החדשה" בפינה (VariantFrame, רק להנהלה ראשית / מתכנת); בחדש: בפינת אזור החיפוש של HomeA5.
  return variant === 'a5' ? <HomeA5 /> : <VariantFrame screen="home" variant="legacy"><LegacyHome /></VariantFrame>;
}
