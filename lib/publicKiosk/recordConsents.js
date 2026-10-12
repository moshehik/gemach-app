// lib/publicKiosk/recordConsents.js - נקודת החיבור היחידה של הרישום העצמי (עמדת הלקוח / הקישור הציבורי) לרישום הסכמות.
//
// היה stub זמני עד שנכנס lib/customerConsent.js (ענף feature/customer-consent-2026-10-12); מאז האינטגרציה (12.10.2026) זה re-export של
// recordConsentsForCustomer מ-lib/customerConsentServer.js - אותה חתימה בדיוק: { customerId, channel, consents, now } -> { ok, recorded, reason?, errors? }.
// הוא עושה: חתימה על התקנון דרך planSignatureWrite הקיים (דגל + חותמת שרת, מסלול אחד - lib/customerSignature.js), ושורות ליומן CustomerConsent
// (ערוץ kiosk|public, method customer_self, surface kiosk-register, בלי עובד). לא זורק; כשל מוחזר כ-ok:false (הקורא רושם בלוג ולא מבטל את הרישום).
// אסור ליצור כאן מבנה נתונים מקביל - ר' docs/customer-consents.md.
export { recordConsentsForCustomer } from '@/lib/customerConsentServer';
