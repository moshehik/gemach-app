'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import LegacyHome from './LegacyHome';

// הדף החדש נטען בנפרד (dynamic) — כך קובץ ה-CSS הגדול של הפלטה (design-system/components.css, ~450KB)
// וקוד הדף החדש לא נטענים בכלל כשהדגל 'legacy' (ברירת המחדל), והאתר נשאר זהה לקודם.
const HomeA5 = dynamic(() => import('./HomeA5'), { ssr: false });

export default function HomeSwitch() {
  const variant = useUiVariant('home');
  return variant === 'a5' ? <HomeA5 /> : <LegacyHome />;
}
