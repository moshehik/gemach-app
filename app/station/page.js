// /station - עמדת הלקוח הציבורית: קישור כללי שלקוחות פותחות מהטלפון (ציבורי, בלי התחברות, בלי שלד האתר: app/layout.js מרנדר אותו ב-stationBare).
// הממשק: app/components/kiosk/KioskPublic.js (עיצוב דף נחיתה). מקור הנתונים - ה-API הציבורי בלבד (lib/publicKiosk/*, /api/public-kiosk/*).
// הקונפיג נקרא כאן בשרת (אותה allow-list ואותו חוזה כמו GET /api/public-kiosk/config) כדי שהמסך ייפתח בלי הבהוב; קישור כבוי = "העמדה אינה זמינה".
import { loadPublicKioskConfig } from '@/lib/publicKiosk/config';
import KioskPublic from '@/app/components/kiosk/KioskPublic';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'עמדת לקוח', robots: { index: false, follow: false } };

export default async function StationPage() {
  const cfg = await loadPublicKioskConfig();
  // רק הדגלים הציבוריים (כמו התשובה של /api/public-kiosk/config); storeSelfService ושאר ההגדרות הפנימיות לא יוצאים
  const config = cfg.linkEnabled
    ? {
        enabled: true,
        showInventory: cfg.showInventory,
        showRegistration: cfg.showRegistration,
        hideImages: cfg.hideImages,
        ...(cfg.showRegistration ? { registration: cfg.registrationRules } : {}),
      }
    : { enabled: false };
  return <KioskPublic config={config} />;
}
