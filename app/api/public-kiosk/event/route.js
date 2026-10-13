// POST /api/public-kiosk/event - ספירה אנונימית של שלבי הפתיחה במשפך העמדה הציבורית (/station): ביקור, בדיקת זמינות / דגמים, פתיחת טופס הפרטים.
// ציבורי (בלי התחברות), אבל:
//  * allow-list סגורה של סוגי אירוע (lib/stationAnalytics/constants.js), מזהה סשן אקראי בלבד ({type, sid}) - שום שדה אחר בגוף לא נקרא ושום PII לא נשמר.
//  * נשמר רק HMAC קטום של "יום + sid" (לא ה-sid עצמו), בלי IP ובלי User-Agent. סשן נספר פעם אחת ליום לכל סוג אירוע (אילוץ ייחודיות ב-DB).
//  * מכבד את הגדרות הקישור הציבורי: kiosk_public_link_enabled כבוי = אין איסוף בכלל (ורישום form_start רק כשהרישום דלוק).
//  * מגבלת קצב לכל כתובת + תקרה גלובלית; בקשה שאינה same-origin (כותרת Sec-Fetch-Site, כשהדפדפן שולח אותה) מתעלמים ממנה.
//  * תמיד תשובה { ok:true } (גם כשלא נספר / הטבלה חסרה) - הדפדפן לא מושפע ואין מה ללמוד על מצב השרת. כשל שמירה לא מפיל את העמדה.
// המסמך: docs/station-analytics.md.
import { loadPublicKioskConfig } from '@/lib/publicKiosk/config';
import { publicJson, rateLimited, readJsonBody } from '@/lib/publicKiosk/http';
import prisma from '@/app/lib/prisma';
import { parseAnonEvent, recordAnonEvent } from '@/lib/stationAnalytics/record';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const limited = rateLimited(request, 'event');
  if (limited) return limited;
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return publicJson({ ok: true });
  const parsed = await readJsonBody(request);
  if (parsed.error) return parsed.error;
  const ev = parseAnonEvent(parsed.body);
  if (!ev) return publicJson({ ok: false, code: 'bad_request', error: 'בקשה לא תקינה' }, 400);
  try {
    const cfg = await loadPublicKioskConfig();
    if (!cfg.linkEnabled) return publicJson({ ok: true });
    if (ev.type === 'form_start' && !cfg.showRegistration) return publicJson({ ok: true });
    await recordAnonEvent(prisma, { type: ev.type, sid: ev.sid, channel: 'public' });
  } catch (e) {
    console.error('public-kiosk event failed:', e && e.message ? e.message : e);
  }
  return publicJson({ ok: true });
}
