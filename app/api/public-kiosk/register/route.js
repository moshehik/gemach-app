// POST /api/public-kiosk/register - רישום עצמי של לקוחה בעמדה (ציבורי; גם העמדה הנעולה בחנות). ראו lib/publicKiosk/registration.js.
// תשובה למבקשת: { ok:true } בהצלחה - זהה בדיוק בין "נרשמה" ל"כבר קיימת" (אנטי-enumeration; שום נתון של לקוחה קיימת לא מוחזר).
// שגיאת ולידציה: 400 { ok:false, code:'validation', errors:[...], fields:{field:msg} }. הגבלות: 429 rate_limited, 413, 415, 404 unavailable.
import { loadPublicKioskConfig } from '@/lib/publicKiosk/config';
import { publicJson, rateLimited, readJsonBody } from '@/lib/publicKiosk/http';
import { loadSettingsMap, performRegistration, validateRegistration } from '@/lib/publicKiosk/registration';
import prisma from '@/app/lib/prisma';
import { getSessionEmployee } from '@/lib/auth';
import { recordRegistrationEvent } from '@/lib/stationAnalytics/record';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const limited = rateLimited(request, 'register');
  if (limited) return limited;
  const parsed = await readJsonBody(request);
  if (parsed.error) return parsed.error;
  try {
    const cfg = await loadPublicKioskConfig();
    // ערוץ ציבורי: רק כשהקישור וגם הרישום הציבורי דלוקים (cfg.showRegistration כולל linkEnabled).
    // ערוץ 'kiosk' (העמדה הנעולה בחנות): kiosk_customer_self_service דלוק **וגם** עוגיית עובד תקפה ופעילה בבקשה - ההגדרה לבדה לא פותחת רישום לאינטרנט
    // (סקירת אבטחה 12.10.2026). הערוץ הציבורי לא נשען על ההגדרה של החנות, והערוץ 'kiosk' לא נשען על הדגל הציבורי.
    const wantsKioskChannel = !!(parsed.body && parsed.body.channel === 'kiosk');
    const allowed = wantsKioskChannel
      ? !!(cfg.storeSelfService && (await getSessionEmployee()))
      : cfg.showRegistration;
    if (!allowed) return publicJson({ ok: false, code: 'unavailable', error: 'הרישום אינו זמין' }, 404);

    const sMap = await loadSettingsMap();
    const v = await validateRegistration(parsed.body, sMap);
    // honeypot: בוט מקבל תשובת הצלחה רגילה ושום דבר לא נכתב
    if (v.honeypot) return publicJson({ ok: true });
    if (v.invalid) return publicJson({ ok: false, code: 'validation', errors: v.errors, fields: v.fields }, 400);

    const r = await performRegistration(v.input);
    // לא חושפים outcome - הלוג בצד השרת בלבד
    console.info('public-kiosk register outcome:', r.outcome, 'channel:', v.input.channel);
    // מדדי המרה (/station-analytics): אירוע "הרישום הושלם" עם מזהה הלקוחה הפנימי בלבד. best-effort - כשל / טבלה חסרה לא משפיעים על התשובה ללקוחה
    if (r.customerId) await recordRegistrationEvent(prisma, { customerId: r.customerId, channel: v.input.channel, outcome: r.outcome });
    return publicJson({ ok: true });
  } catch (e) {
    console.error('public-kiosk register failed:', e && e.code ? e.code : (e && e.name) || 'error'); // לא e.message: עלול להכיל נתוני לקוחה (ת"ז, טלפון)
    return publicJson({ ok: false, code: 'server_error', error: 'שגיאה זמנית, נסו שוב' }, 500);
  }
}
