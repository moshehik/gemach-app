'use client';

// KioskSwitch - הבחירה בין עמדת הלקוח החדשה (A5) לישנה ("אטלייה חמה"). העמדה ציבורית וייתכן שאין בה עובד מחובר, ולכן ההכרעה לפי הגדרת הארגון
// ui_variant_kiosk ('legacy' = הישנה; חסרה / כל ערך אחר = החדשה), לא לפי עקיפה אישית של עובד.
// נקודת חיבור: אם המסך יירשם ב-UI_SCREEN_REGISTRY (lib/uiVariantScreens.js, id 'kiosk') אותו מפתח הגדרה (ui_variant_kiosk) כבר מתאים לו.
// כל גרסה נטענת בנפרד (dynamic) כדי שה-CSS הגדול של הפלטה לא ייכנס לגרסה הישנה ולהפך.

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const KioskA5 = dynamic(() => import('./KioskA5'), { ssr: false });
const LegacyKiosk = dynamic(() => import('@/app/customer-interface/LegacyKioskPage'), { ssr: false });

export default function KioskSwitch() {
  const [variant, setVariant] = useState(null); // null = עוד לא נטען; 'a5' | 'legacy'
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        const obj = { hide_dress_images: 'false' };
        if (Array.isArray(data)) data.forEach((s) => { if (s.key) obj[s.key] = s.value; });
        setSettings(obj);
        setVariant(obj.ui_variant_kiosk === 'legacy' ? 'legacy' : 'a5');
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setSettings({ hide_dress_images: 'false' });
        setVariant('a5');
      });
    return () => { alive = false; };
  }, []);

  if (!variant) return null;
  return variant === 'legacy' ? <LegacyKiosk /> : <KioskA5 initialSettings={settings} />;
}
