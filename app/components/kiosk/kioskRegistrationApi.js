// kioskRegistrationApi.js - נקודת השליחה היחידה של טופס "מילוי פרטים אישיים" בעמדה.
//
// נקודת חיבור (שלב האינטגרציה): היום הפונקציה קוראת ל-POST /api/customers הקיים (אותו endpoint וכללי חובה כמו "לקוח חדש" בהזמנה).
// כשה-API הציבורי הייעודי יהיה מוכן מחליפים כאן את ה-endpoint (REGISTRATION_ENDPOINT) ואת צורת הגוף - שום דבר אחר בממשק לא צריך להשתנות.
// הגוף כבר כולל את שדות ההסכמה החדשים בשמות המוסכמים: acceptedTerms / marketingConsent (true/false מפורש) / acceptedPrivacy.
//
// מחזירה תמיד אובייקט ולא זורקת: { ok, status, data, error }.

export const REGISTRATION_ENDPOINT = '/api/customers';

/**
 * @param {object} form  { firstName, lastName, zeout, phone1, email, city, street, houseNum, acceptedTerms, marketingConsent, acceptedPrivacy }
 * @param {{ mode?: 'station'|'public', endpoint?: string }} [opts]
 */
export async function submitRegistration(form, opts = {}) {
  const endpoint = opts.endpoint || REGISTRATION_ENDPOINT;
  const body = {
    firstName: String(form.firstName || '').trim(),
    lastName: String(form.lastName || '').trim(),
    zeout: String(form.zeout || '').trim(),
    phone1: String(form.phone1 || '').trim(),
    email: String(form.email || '').trim(),
    city: String(form.city || '').trim(),
    street: String(form.street || '').trim(),
    houseNum: String(form.houseNum || '').trim(),
    acceptedTerms: form.acceptedTerms === true,
    marketingConsent: form.marketingConsent === true,
    acceptedPrivacy: form.acceptedPrivacy === true,
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.ok) return { ok: true, status: res.status, data, error: '' };
    if (res.status === 401) {
      // require_login דלוק ואין עובד מחובר במסך הזה - אותה מגבלה שחלה היום על כל קריאות ה-API בעמדה
      return { ok: false, status: 401, data, error: 'השמירה דורשת עובד מחובר במערכת. נא לפנות לצוות הגמ"ח.' };
    }
    return { ok: false, status: res.status, data, error: (data && data.error) || 'שגיאה בשמירה, נא לפנות לצוות הגמ"ח' };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: 'שגיאת תקשורת - נא לפנות לצוות הגמ"ח' };
  }
}
