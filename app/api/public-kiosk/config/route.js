// GET /api/public-kiosk/config - ציבורי, קריאה בלבד. מחזיר רק את דגלי העמדה הציבורית (allow-list) - לעולם לא שאר SystemSetting.
// ראו lib/publicKiosk/config.js. כשהקישור כבוי: { enabled:false } בלבד (שום דבר אחר לא יוצא).
import { loadPublicKioskConfig } from '@/lib/publicKiosk/config';
import { publicJson, rateLimited } from '@/lib/publicKiosk/http';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const limited = rateLimited(request, 'config');
  if (limited) return limited;
  const cfg = await loadPublicKioskConfig();
  if (!cfg.linkEnabled) return publicJson({ enabled: false });
  return publicJson({
    enabled: true,
    showInventory: cfg.showInventory,
    showRegistration: cfg.showRegistration,
    hideImages: cfg.hideImages,
    // רמזי טופס (נגזרים, לא ערכי הגדרות): אילו שדות חובה וקבוצות "לפחות אחד מהם". נשלח רק כשהרישום פתוח.
    ...(cfg.showRegistration ? { registration: cfg.registrationRules } : {}),
  });
}
