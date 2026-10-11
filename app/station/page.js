// /station - עמדת הלקוח בקישור כללי (ציבורי, בלי התחברות). PLACEHOLDER: בודק רק את ההגדרה kiosk_public_link_enabled.
// סוכן ה-skin ימלא כאן את המסך (קטלוג + רישום) מעל החוזה של /api/public-kiosk/{config,models,register} - ר' lib/publicKiosk/*.
// בלי מעטפת עובדים: app/layout.js מרנדר /station ללא תפריט / עוזר AI (stationBare) וללא קיר התחברות.
import { loadPublicKioskConfig } from '@/lib/publicKiosk/config';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'עמדת לקוח', robots: { index: false, follow: false } };

export default async function StationPage() {
  const cfg = await loadPublicKioskConfig();
  if (!cfg.linkEnabled) {
    return (
      <main dir="rtl" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24 }}>העמדה אינה זמינה</h1>
      </main>
    );
  }
  // TODO(kiosk-skin): כאן נכנס הממשק. הקונפיג (cfg) זמין בשרת; בצד הלקוח - GET /api/public-kiosk/config.
  return (
    <main dir="rtl" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <h1 style={{ fontSize: 24 }}>עמדת לקוח</h1>
    </main>
  );
}
