// lib/customerConsentServer.js - נקודת החיבור של הרישום העצמי (עמדת לקוח / קישור ציבורי) להסכמות. מחליף את ה-stub
// lib/publicKiosk/recordConsents.js של ענף ה-kiosk-backend: אותה חתימה בדיוק, ולכן ההחלפה היא שורת import אחת:
//   import { recordConsentsForCustomer } from '@/lib/customerConsentServer';
//
// נקרא אחרי שהלקוחה כבר נוצרה (עם Customer.marketingConsent). עושה: טוען את המסמכים שבתוקף, מאמת גרסאות שהדפדפן הציג, מחשב תוכנית
// (חתימה על התקנון דרך planSignatureWrite הקיים: דגל + חותמת שרת; דיוור: העמודה כבר נכתבה, כאן רק היומן), וכותב שורות ליומן CustomerConsent
// עם channel kiosk|public, method customer_self, surface kiosk-register. לא זורק לעולם - מחזיר {ok, recorded, reason?, errors?}.
// כשל ביומן (הטבלה עוד לא נוצרה) לא מבטל את הרישום עצמו; הקורא יכול לרשום אזהרה.
import prisma, { auditAs } from '@/app/lib/prisma';
import { loadConsentContext } from '@/lib/consentDocsLoad';
import { checkEchoedVersions, planConsentWrite, readConsentAnswers, recordConsentEntries } from '@/lib/customerConsent';

/**
 * @param {{customerId:string, channel?:'public'|'kiosk', consents:{acceptedTerms?:boolean, marketingConsent?:boolean, acceptedPrivacy?:boolean, termsVersion?:string, privacyVersion?:string}, now?:Date, meta?:object}} args
 * @returns {Promise<{ok:boolean, recorded:number, reason?:string, errors?:string[]}>}
 */
export async function recordConsentsForCustomer({ customerId, channel = 'kiosk', consents = {}, now = new Date(), meta }) {
  try {
    const ctx = await loadConsentContext();
    const answers = readConsentAnswers({ ...consents, consentExplicit: true });
    const errors = [...answers.errors, ...checkEchoedVersions(consents, ctx.docs)];
    if (errors.length) return { ok: false, recorded: 0, reason: 'invalid', errors };
    const existing = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, marketingConsent: true, hasSignedRegulations: true } });
    if (!existing) return { ok: false, recorded: 0, reason: 'no-customer' };
    const plan = planConsentWrite({
      answers, existing, latest: {}, now,
      ctx: { channel: channel === 'public' ? 'public' : 'kiosk', method: 'customer_self', surface: 'kiosk-register', employeeId: null, docs: ctx.docs, meta },
    });
    // העמודות: רק החתימה (הדיוור נכתב ביצירת הלקוחה); עדכון רגיל + auditAs = שורת היסטוריה אחת בלי שורה ידנית
    const columns = {};
    if ('hasSignedRegulations' in plan.data) { columns.hasSignedRegulations = plan.data.hasSignedRegulations; columns.regulationsSignedAt = plan.data.regulationsSignedAt; }
    if ('marketingConsent' in plan.data) columns.marketingConsent = plan.data.marketingConsent;
    if (Object.keys(columns).length) await prisma.customer.update(auditAs('UPDATE', { where: { id: customerId }, data: columns }, plan.changes));
    const journal = await recordConsentEntries(prisma, customerId, plan.entries);
    return journal.ok ? { ok: true, recorded: journal.count } : { ok: true, recorded: 0, reason: journal.reason };
  } catch (error) {
    console.error('recordConsentsForCustomer failed:', error);
    return { ok: false, recorded: 0, reason: 'error' };
  }
}
