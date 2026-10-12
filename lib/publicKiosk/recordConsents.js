// lib/publicKiosk/recordConsents.js - נקודת החיבור היחידה של הרישום העצמי לרישום הסכמות.
//
// STUB ZMANI. הסוכן "customer-consent" (ענף feature/customer-consent-2026-10-12) בונה את lib/customerConsent.js: אימות והקלטה של
// הסכמות (חתימה על תקנון, דיוור כן/לא מפורש, אישור מדיניות פרטיות, ערוץ=עובד/עמדה/ציבורי, חותמת שרת, גרסת תקנון).
// כשהוא נכנס ל-main - מחליפים את גוף recordConsentsForCustomer בקריאה אליו (שורה אחת, ראו TODO למטה). אסור ליצור כאן מבנה נתונים מקביל.
//
// מה ה-stub עושה היום (בלי שינוי סכמה, רק שדות קיימים של Customer):
//   * acceptedTerms === true  -> Customer.hasSignedRegulations=true + regulationsSignedAt=עכשיו (השרת; כמו lib/customerSignature.js)
//   * marketingConsent        -> כבר נכתב ביצירת הלקוחה (Customer.marketingConsent)
//   * acceptedPrivacy         -> נבדק (חובה true) אך עדיין לא מתועד בשום מקום עד שתהיה תשתית הסכמות. נקודת החיבור: כאן.
import prisma, { auditAs } from '@/app/lib/prisma';
import { planSignatureWrite } from '@/lib/customerSignature';

/**
 * @param {{customerId:string, channel:'public'|'kiosk', consents:{acceptedTerms:boolean, marketingConsent:boolean, acceptedPrivacy:boolean}, now?:Date}} args
 * @returns {Promise<{ok:boolean, stub:true}>}
 */
export async function recordConsentsForCustomer({ customerId, channel, consents, now = new Date() }) {
  // TODO(customer-consent): החלפה כשיש lib/customerConsent.js:
  //   import { recordConsents } from '@/lib/customerConsent';
  //   return recordConsents({ customerId, channel: channel === 'kiosk' ? 'kiosk' : 'public', ...consents, now });
  void channel;
  if (consents && consents.acceptedTerms === true) {
    const plan = planSignatureWrite({ requested: true, current: { hasSignedRegulations: false }, now });
    if (plan) await prisma.customer.update(auditAs('UPDATE', { where: { id: customerId }, data: plan.data }, plan.changes));
  }
  return { ok: true, stub: true };
}
