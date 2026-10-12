// POST /api/public-kiosk/register - רישום עצמי של לקוחה בעמדה (ציבורי; גם העמדה הנעולה בחנות). ראו lib/publicKiosk/registration.js.
// תשובה למבקשת: { ok:true } בהצלחה - זהה בדיוק בין "נרשמה" ל"כבר קיימת" (אנטי-enumeration; שום נתון של לקוחה קיימת לא מוחזר).
// שגיאת ולידציה: 400 { ok:false, code:'validation', errors:[...], fields:{field:msg} }. הגבלות: 429 rate_limited, 413, 415, 404 unavailable.
import { loadPublicKioskConfig } from '@/lib/publicKiosk/config';
import { publicJson, rateLimited, readJsonBody } from '@/lib/publicKiosk/http';
import { loadSettingsMap, performRegistration, validateRegistration } from '@/lib/publicKiosk/registration';
import prisma from '@/app/lib/prisma';
import { recordRegistrationEvent } from '@/lib/stationAnalytics/record';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const limited = rateLimited(request, 'register');
  if (limited) return limited;
  const parsed = await readJsonBody(request);
  if (parsed.error) return parsed.error;
  try {
    const cfg = await loadPublicKioskConfig();
    // פתוח לציבור רק כשהקישור וגם הרישום דלוקים; העמדה הנעולה בחנות (channel:'kiosk') נשענת על kiosk_customer_self_service הקיימת
    const wantsKioskChannel = parsed.body && parsed.body.channel === 'kiosk';
    const allowed = cfg.showRegistration || (wantsKioskChannel && cfg.storeSelfService);
    if (!allowed) return publicJson({ ok: false, code: 'unavailable', error: 'הרישום אינו זמין' }, 404);

    const sMap = await loadSettingsMap();
    const v = await validateRegistration(parsed.body, sMap);
    // honeypot: בוט מקבל תשובת הצלחה רגילה ושום דבר לא נכתב
    if (v.honeypot) return publicJson({ ok: true });
    if (v.invalid) return publicJson({ ok: false, code: 'validation', errors: v.errors, fields: v.fields }, 400);

    const r = await performRegistration(v.input);
    // לא חושפים outcome - הלוג בצד השרת בלבד
    console.info('public-kiosk register outcome:', r.outcome, 'channel:', v.input.channel);
    // מדדי המרה (/admin/station-analytics): אירוע "הרישום הושלם" עם מזהה הלקוחה הפנימי בלבד. best-effort - כשל / טבלה חסרה לא משפיעים על התשובה ללקוחה
    if (r.customerId) await recordRegistrationEvent(prisma, { customerId: r.customerId, channel: v.input.channel, outcome: r.outcome });
    return publicJson({ ok: true });
  } catch (e) {
    console.error('public-kiosk register failed:', e && e.message ? e.message : e);
    return publicJson({ ok: false, code: 'server_error', error: 'שגיאה זמנית, נסו שוב' }, 500);
  }
}
