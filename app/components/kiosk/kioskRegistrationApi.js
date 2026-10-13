// kioskRegistrationApi.js - נקודת השליחה היחידה של טופס "מילוי פרטים אישיים" (עמדה ומסלול ציבורי).
//
// נקודת הקצה: POST /api/public-kiosk/register (סוכן kiosk-backend, ענף feature/kiosk-public-backend-2026-10-12; ראו lib/publicKiosk/*).
// חוזה: גוף { firstName, lastName, phone1, phone2?, idNumber, email, city, street, houseNum, acceptedTerms, marketingConsent, acceptedPrivacy,
// channel: 'kiosk' | 'public', website: '' (honeypot) }; תשובה { ok:true } (זהה בין "נרשמה" ל"כבר קיימת", בלי נתוני לקוחה) או 400
// { ok:false, code:'validation', errors:[...], fields:{field:msg} } או 404 unavailable / 429 rate_limited / 413 / 415 / 500.
// channel: העמדה הנעולה בחנות (mode 'station') = 'kiosk' (דורשת kiosk_customer_self_service); קישור כללי (mode 'public') = 'public'.
//
// מחזירה תמיד אובייקט ולא זורקת: { ok, status, error, errors, fields }.

export const REGISTRATION_ENDPOINT = '/api/public-kiosk/register';

const GENERIC_ERROR = 'שגיאה בשמירה, נא לפנות לצוות הגמ"ח';

/**
 * @param {object} form  { firstName, lastName, idNumber|zeout, phone1, phone2, email, city, street, houseNum, acceptedTerms, marketingConsent, acceptedPrivacy, website }
 * @param {{ mode?: 'station'|'public', endpoint?: string }} [opts]
 */
export async function submitRegistration(form, opts = {}) {
  const endpoint = opts.endpoint || REGISTRATION_ENDPOINT;
  const body = {
    firstName: String(form.firstName || '').trim(),
    lastName: String(form.lastName || '').trim(),
    idNumber: String(form.idNumber != null ? form.idNumber : (form.zeout || '')).trim(),
    phone1: String(form.phone1 || '').trim(),
    phone2: String(form.phone2 || '').trim(),
    email: String(form.email || '').trim(),
    city: String(form.city || '').trim(),
    street: String(form.street || '').trim(),
    houseNum: String(form.houseNum || '').trim(),
    // הסכמות: true / false מפורש בלבד (השרת מתייחס לכל דבר אחר כ"לא נענה")
    acceptedTerms: form.acceptedTerms === true ? true : (form.acceptedTerms === false ? false : null),
    marketingConsent: form.marketingConsent === true ? true : (form.marketingConsent === false ? false : null),
    acceptedPrivacy: form.acceptedPrivacy === true,
    channel: opts.mode === 'public' ? 'public' : 'kiosk',
    website: String(form.website || ''), // honeypot: אדם משאיר ריק
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.ok && (!data || data.ok !== false)) return { ok: true, status: res.status, error: '', errors: [], fields: {} };
    const errors = data && Array.isArray(data.errors) ? data.errors : [];
    const fields = data && data.fields && typeof data.fields === 'object' ? data.fields : {};
    if (res.status === 400) return { ok: false, status: 400, error: errors.length ? errors.join(', ') : GENERIC_ERROR, errors, fields };
    if (res.status === 404) return { ok: false, status: 404, error: 'השמירה אינה זמינה כרגע. נא לפנות לצוות הגמ"ח.', errors, fields };
    if (res.status === 429) return { ok: false, status: 429, error: 'יותר מדי ניסיונות. נסי שוב בעוד רגע.', errors, fields };
    return { ok: false, status: res.status, error: (data && data.error) || GENERIC_ERROR, errors, fields };
  } catch (e) {
    return { ok: false, status: 0, error: 'שגיאת תקשורת - נא לפנות לצוות הגמ"ח', errors: [], fields: {} };
  }
}
