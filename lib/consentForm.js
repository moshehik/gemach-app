// lib/consentForm.js - החלק הטהור של טפסי ההסכמה בצד הלקוח (בלי React, בלי DOM): איזה שדות מוצגים / חובה, מה חסר, ואיך בונים את גוף הבקשה.
// נטען גם בדפדפן וגם בבדיקות node. השרת מאמת מחדש הכל (lib/customerConsent.js) - כאן רק חוויית המשתמש.
// החוזה מול השרת (שמות השדות) מתועד ב-lib/customerConsent.js ובדוח docs/customer-consents.md.

export const explicitConsentOn = (settings) => !!settings && settings.explicit_consent_enabled === 'true';

/** מצב התחלתי של ההסכמות בטופס: הכל "טרם נענה" (בלי ברירת מחדל), אישור הפרטיות לא מסומן. */
export const EMPTY_CONSENT_ANSWERS = Object.freeze({ acceptedTerms: null, marketingConsent: null, acceptedPrivacy: false });

/** אילו שדות מוצגים ואילו חובה, לפי ההגדרות. isNew = טופס רישום / לקוח חדש; בעריכת לקוח קיים אין חובה (לא חוסמים עריכת פרט אחר). */
export function consentRequirements(settings, { isNew = false } = {}) {
  const s = settings || {};
  const hideMarketing = s.hide_marketing_consent_field === 'true';
  return {
    showTerms: true,
    showMarketing: !hideMarketing,
    showPrivacy: true,
    termsRequired: isNew,
    marketingRequired: isNew && !hideMarketing,
    privacyRequired: isNew && s.require_privacy_acceptance !== 'false',
    marketingMustBeYes: !hideMarketing && s.require_marketing_consent === 'true',
  };
}

/** תוויות מה שחסר (מערך ריק = אפשר לשמור). */
export function missingConsentLabels(value, settings, { isNew = false } = {}) {
  const v = value || EMPTY_CONSENT_ANSWERS;
  const r = consentRequirements(settings, { isNew });
  const out = [];
  if (r.termsRequired && v.acceptedTerms !== true && v.acceptedTerms !== false) out.push('חתימה על התקנון (כן / לא)');
  if (r.marketingRequired && v.marketingConsent !== true && v.marketingConsent !== false) out.push('אישור קבלת דיוורים (כן / לא)');
  if (r.marketingMustBeYes && v.marketingConsent !== true && !out.includes('אישור קבלת דיוורים (כן / לא)')) out.push('אישור קבלת דיוורים');
  if (r.privacyRequired && v.acceptedPrivacy !== true) out.push('אישור מדיניות הפרטיות');
  return out;
}

/** שדות לשדה השגיאה לפי חוסרים: {terms, marketing, privacy} -> true. */
export function invalidConsentFields(value, settings, { isNew = false } = {}) {
  const v = value || EMPTY_CONSENT_ANSWERS;
  const r = consentRequirements(settings, { isNew });
  return {
    terms: r.termsRequired && v.acceptedTerms !== true && v.acceptedTerms !== false,
    marketing: (r.marketingRequired && v.marketingConsent !== true && v.marketingConsent !== false) || (r.marketingMustBeYes && v.marketingConsent !== true),
    privacy: r.privacyRequired && v.acceptedPrivacy !== true,
  };
}

/**
 * מוסיף לגוף הבקשה את שדות ההסכמה (החוזה מול השרת). שדה שלא נענה לא נשלח (חסר = "טרם נענה").
 * @param {object} body        הגוף הקיים של POST / PUT
 * @param {object} value       {acceptedTerms, marketingConsent, acceptedPrivacy}
 * @param {object|null} info   תשובת GET /api/public-consent-info (הגרסאות שהוצגו)
 * @param {string} surface     'new-order' | 'new-customer' | 'customer-card' | ...
 * @param {{only?: string[]}} [opts] only: להוסיף רק שדות מסוימים (בעריכת לקוח קיים - רק מה שהשתנה)
 */
export function withConsentBody(body, value, info, surface, opts = {}) {
  const v = value || EMPTY_CONSENT_ANSWERS;
  const only = opts.only || null;
  const want = (k) => !only || only.includes(k);
  const out = { ...body, consentExplicit: true, consentSurface: surface };
  delete out.acceptedTerms;
  delete out.acceptedPrivacy;
  if (want("acceptedTerms") && (v.acceptedTerms === true || v.acceptedTerms === false)) out.acceptedTerms = v.acceptedTerms;
  if (want("marketingConsent")) {
    if (v.marketingConsent === true || v.marketingConsent === false) out.marketingConsent = v.marketingConsent; else delete out.marketingConsent;
  } else delete out.marketingConsent;
  if (want("acceptedPrivacy") && v.acceptedPrivacy === true) out.acceptedPrivacy = true;
  if (info && info.terms && info.terms.version) out.termsVersion = info.terms.version;
  if (info && info.privacy && info.privacy.version) out.privacyVersion = info.privacy.version;
  return out;
}

/** מצב נוכחי מהלקוחה השמורה (כרטיס לקוח): true נשמר; false / חסר = "טרם נענה" אלא אם היומן אומר שסירבה במפורש. consents = תשובת GET [id]. */
export function answersFromCustomer(customer, consents) {
  const c = customer || {};
  const ledger = consents || {};
  const terms = c.hasSignedRegulations === true ? true : (ledger.terms && ledger.terms.granted === false ? false : (c.hasSignedRegulations === false && c.regulationsSignedAt ? false : null));
  const marketing = c.marketingConsent === true ? true : (ledger.marketing && ledger.marketing.granted === false ? false : null);
  const privacy = !!(ledger.privacy && ledger.privacy.granted === true);
  return { acceptedTerms: terms, marketingConsent: marketing, acceptedPrivacy: privacy };
}
