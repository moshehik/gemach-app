// lib/customerConsent.js - הסכמות מפורשות של לקוחות (תקנון / דיוור שיווקי / מדיניות פרטיות): ולידציה, תכנון הכתיבה ורישום ביומן.
// מקור אמת יחיד לכל המסלולים שרושמים הסכמה: ה-API של העובדים (POST/PUT /api/customers) והרישום העצמי בעמדת הלקוח
// (POST /api/public-kiosk/register קורא ל-processRegistrationConsents / planConsentWrite כאן). תיעוד מלא: docs/customer-consents.md.
//
// עקרונות (חוקיים וטכניים):
//  1. ראיה, לא רק דגל: כל הסכמה / סירוב נרשמים כשורה חדשה ב-CustomerConsent (append-only; ביטול = שורה חדשה). העמודות הקיימות
//     Customer.marketingConsent / hasSignedRegulations נשארות "המצב הנוכחי" (כל הקוד הקיים קורא אותן) ומתעדכנות מאותה תוכנית.
//  2. הכל מחושב בשרת: createdAt, העובד (עוגייה מאומתת), הערוץ, גרסת התקנון / המדיניות (hash של מה שהיה בתוקף), נוסח הדיוור.
//     שום ערך כזה לא נלקח מגוף הבקשה. מהגוף נקראות רק התשובות (true/false מפורש) ואופציונלית גרסה מהדפדפן - אם היא אינה הגרסה
//     שבתוקף הבקשה נדחית (409), כדי שלא תירשם הסכמה לטקסט שלא הוצג.
//  3. חתימה על התקנון משתלבת במנגנון הקיים (lib/customerSignature.js planSignatureWrite: דגל + חותמת שרת) - לא מנגנון מקביל.
//  4. תשובה חסרה = "טרם נענתה" (לא "לא"). false נרשם כ"לא" רק כשהלקוחה/העובד בחרו אותו במפורש (consentExplicit:true).
//  5. כשל בכתיבה ליומן (טבלה שעוד לא נוצרה / קליינט ישן) לא מכשיל שמירת לקוח ולא מדלג בשקט: נרשם בקונסול והתשובה נושאת consentWarning.
//
// החוזה (שמות שדות בגוף הבקשה) - ר' CONSENT_BODY_FIELDS:
//   consentExplicit: true   מצהיר שהטופס השתמש בבחירה מפורשת (כן/לא) - רק אז false של marketingConsent נחשב "לא" ולא "לא נענה"
//   acceptedTerms:   true|false   חתם/ה על התקנון (כן/לא); חסר = לא נענה
//   marketingConsent: true|false  מאשר/ת קבלת דיוורים; חסר (ב-consentExplicit) = לא נענה
//   acceptedPrivacy: true         אישרתי את מדיניות הפרטיות (תיבת אישור; false / חסר = לא אושר)
//   termsVersion / privacyVersion  (אופציונלי) הגרסה שהדפדפן הציג (מ-GET /api/public-consent-info); לא תואם לבתוקף = 409
//   consentSurface: מחרוזת קצרה מרשימה סגורה (CONSENT_SURFACES) - איזה מסך; ערך אחר נשמר כ-'unknown'
//
// פונקציות טהורות (נבדקות ב-node: scripts/customer-consent-tests) + עוטפי DB קטנים עם prisma מוזרק.

import { planSignatureWrite } from './customerSignature.js';

export const CONSENT_KINDS = Object.freeze(['terms', 'marketing', 'privacy']);
export const CONSENT_CHANNELS = Object.freeze(['staff', 'kiosk', 'public']);
export const CONSENT_METHODS = Object.freeze(['staff_recorded', 'customer_self']);
export const CONSENT_SURFACES = Object.freeze(['new-order', 'new-customer', 'customer-card', 'kiosk-register', 'order-customer-edit', 'import']);

export const CONSENT_BODY_FIELDS = Object.freeze(['consentExplicit', 'acceptedTerms', 'marketingConsent', 'acceptedPrivacy', 'termsVersion', 'privacyVersion', 'consentSurface']);

// ---- הנוסחים (בשרת, כדי שהנוסח שנרשם ביומן לא יבוא מהדפדפן) ----
export const TERMS_LABEL = 'חתם/ה על התקנון';
export const PRIVACY_LABEL = 'אישרתי את מדיניות הפרטיות';
export const MARKETING_LABEL = 'מאשר/ת קבלת דיוורים';
export const MARKETING_DETAIL = 'עדכונים והודעות שיווקיות מהגמ"ח, בדוא"ל ובהודעות. אפשר להסיר את ההסכמה בכל עת.';
export const MARKETING_WORDING = `${MARKETING_LABEL} - ${MARKETING_DETAIL}`;
export const MARKETING_WORDING_VERSION = '2026-10-12';

const settingGet = (settings, key) => {
  if (!settings) return undefined;
  if (typeof settings.get === 'function') return settings.get(key);
  return settings[key];
};

/** תצורת ההסכמות מההגדרות (שורה חסרה = ההתנהגות הקודמת: הכל כבוי). */
export function consentConfig(settings) {
  const enabled = settingGet(settings, 'explicit_consent_enabled') === 'true';
  return {
    enabled,
    hideMarketing: settingGet(settings, 'hide_marketing_consent_field') === 'true',
    requireMarketingYes: settingGet(settings, 'require_marketing_consent') === 'true',
    // אישור פרטיות חובה בלקוח חדש כשהמערכת פעילה, אלא אם נכבה במפורש
    requirePrivacy: enabled && settingGet(settings, 'require_privacy_acceptance') !== 'false',
  };
}

const isBool = (v) => v === true || v === false;

/**
 * קריאת התשובות מגוף הבקשה. מחזיר {explicit, terms, marketing, privacy, errors}.
 * terms/marketing: true|false|undefined (undefined = לא נענה); privacy: true|undefined.
 */
export function readConsentAnswers(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = [];
  const explicit = b.consentExplicit === true;
  const out = { explicit, terms: undefined, marketing: undefined, privacy: undefined, errors };

  if (b.acceptedTerms !== undefined && b.acceptedTerms !== null) {
    if (isBool(b.acceptedTerms)) out.terms = b.acceptedTerms; else errors.push('ערך "חתם/ה על התקנון" לא תקין');
  }
  if (b.marketingConsent !== undefined && b.marketingConsent !== null) {
    // בלי consentExplicit, false הוא ברירת המחדל של טפסים ישנים ("לא נענה") - planConsentWrite רושם אותו ביומן רק כמעבר אמיתי
    // של העמודה (true -> false בעריכה); ביצירה false בלי הצהרה לא נרשם בכלל.
    if (isBool(b.marketingConsent)) out.marketing = b.marketingConsent;
    else if (explicit) errors.push('ערך "מאשר/ת קבלת דיוורים" לא תקין');
  }
  if (b.acceptedPrivacy !== undefined && b.acceptedPrivacy !== null && b.acceptedPrivacy !== false) {
    if (b.acceptedPrivacy === true) out.privacy = true; else errors.push('ערך "אישור מדיניות פרטיות" לא תקין');
  }
  return out;
}

/** האם הגוף מנסה לכתוב משהו מתחום ההסכמות (לרוב: האם להפעיל את כל המנגנון). */
export function bodyTouchesConsents(body) {
  if (!body || typeof body !== 'object') return false;
  return body.consentExplicit === true || body.acceptedTerms === true || body.acceptedTerms === false || body.acceptedPrivacy === true;
}

/**
 * חובות בלקוח חדש כשהמערכת פעילה ובקשה מצהירה consentExplicit:
 * חתימה על התקנון: חייבת תשובה (כן/לא); דיוור: חייבת תשובה (אלא אם השדה מוסתר); פרטיות: חייבת אישור (אלא אם נכבה).
 * בלקוח קיים לא חובה כלום (לא חוסמים עריכת פרט אחר בלקוח ותיק - אותו כלל כמו בדיווח 48ff7055).
 */
export function validateConsentAnswers({ answers, config, isNew }) {
  const errors = [...(answers.errors || [])];
  if (!config.enabled || !answers.explicit || !isNew) return errors;
  if (answers.terms === undefined) errors.push('יש לבחור אם הלקוחה חתמה על התקנון (כן / לא)');
  if (!config.hideMarketing && answers.marketing === undefined) errors.push('יש לבחור אם הלקוחה מאשרת קבלת דיוורים (כן / לא)');
  if (config.requirePrivacy && answers.privacy !== true) errors.push('יש לאשר את מדיניות הפרטיות');
  return errors;
}

/**
 * גרסאות שהדפדפן הציג מול הבתוקף. docs = {termsVersion, privacyVersion} מהשרת.
 * חסר בגוף = בסדר (הטופס לא שלח; נרשמת הגרסה שבתוקף). שונה = שגיאה (הטקסט התעדכן בזמן המילוי).
 */
export function checkEchoedVersions(body, docs) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};
  const d = docs || {};
  if (typeof b.termsVersion === 'string' && b.termsVersion && d.termsVersion && b.termsVersion !== d.termsVersion) {
    errors.push('התקנון עודכן בזמן המילוי - יש לרענן את הדף ולהציג אותו מחדש');
  }
  if (typeof b.privacyVersion === 'string' && b.privacyVersion && d.privacyVersion && b.privacyVersion !== d.privacyVersion) {
    errors.push('מדיניות הפרטיות עודכנה בזמן המילוי - יש לרענן את הדף ולהציג אותה מחדש');
  }
  return errors;
}

export function normalizeSurface(surface, fallback = 'unknown') {
  return typeof surface === 'string' && CONSENT_SURFACES.includes(surface) ? surface : fallback;
}

/**
 * מאפה (kind -> שורה אחרונה) מרשימת שורות מהחדש לישן (או בכל סדר: ממיינים כאן לפי createdAt).
 */
export function latestByKind(rows) {
  const out = {};
  for (const r of rows || []) {
    if (!r || !CONSENT_KINDS.includes(r.kind)) continue;
    const cur = out[r.kind];
    if (!cur || new Date(r.createdAt) > new Date(cur.createdAt)) out[r.kind] = r;
  }
  return out;
}

/**
 * תוכנית הכתיבה: אילו עמודות של Customer מתעדכנות ואילו שורות נכנסות ליומן.
 *
 * @param {object} p
 * @param {ReturnType<typeof readConsentAnswers>} p.answers
 * @param {object|null} p.existing  שורת הלקוח השמורה ({marketingConsent, hasSignedRegulations}) או null ביצירה
 * @param {object} p.latest         latestByKind() של היומן (ריק ביצירה / כשהיומן לא זמין)
 * @param {{channel:string, method:string, surface:string, employeeId:string|null, docs:object, meta?:object}} p.ctx
 * @param {Date} [p.now]
 * @returns {{data:object, changes:object, entries:object[]}}
 */
export function planConsentWrite({ answers, existing, latest = {}, ctx, now = new Date() }) {
  const data = {};
  const changes = {};
  const entries = [];
  const docs = ctx.docs || {};
  const base = {
    channel: ctx.channel,
    method: ctx.method,
    surface: ctx.surface || 'unknown',
    recordedByEmployeeId: ctx.employeeId || null,
    meta: ctx.meta ? JSON.stringify(ctx.meta) : null,
  };
  // כלל הרישום: תשובה מפורשת נרשמת כשאין שורה ביומן או שהיא שונה מהאחרונה (אין שורות כפולות בשמירה חוזרת);
  // בלי הצהרת consentExplicit (טפסים ישנים) נרשם רק מעבר אמיתי בעמודה (ביצירה: true), כדי לא להמציא ראיה להסכמה ישנה.
  const should = (kind, requested, columnChanged) => {
    if (answers.explicit) return !latest[kind] || latest[kind].granted !== requested;
    return columnChanged;
  };

  if (answers.terms !== undefined) {
    const plan = planSignatureWrite({ requested: answers.terms, current: existing, now });
    if (plan) { Object.assign(data, plan.data); Object.assign(changes, plan.changes); }
    if (should('terms', answers.terms, !!plan)) {
      entries.push({ ...base, kind: 'terms', granted: answers.terms, documentVersion: docs.termsVersion || null, documentRef: docs.termsRef || null, wording: null });
    }
  }
  if (answers.marketing !== undefined) {
    const was = !!(existing && existing.marketingConsent);
    const changed = !existing ? answers.marketing === true : was !== answers.marketing;
    if (changed || !existing) {
      data.marketingConsent = answers.marketing;
      if (existing && changed) changes.marketingConsent = { from: was, to: answers.marketing };
    }
    if (should('marketing', answers.marketing, changed)) {
      entries.push({ ...base, kind: 'marketing', granted: answers.marketing, documentVersion: MARKETING_WORDING_VERSION, documentRef: null, wording: MARKETING_WORDING });
    }
  }
  if (answers.privacy === true) {
    const l = latest.privacy;
    const sameVersion = l && l.granted === true && (l.documentVersion || null) === (docs.privacyVersion || null);
    if (!sameVersion) {
      entries.push({ ...base, kind: 'privacy', granted: true, documentVersion: docs.privacyVersion || null, documentRef: null, wording: PRIVACY_LABEL });
    }
  }
  return { data, changes, entries };
}

/** שורות לטבלה (createMany): customerId נוסף, createdAt נקבע ב-DB (CURRENT_TIMESTAMP) - לא נשלח מכאן. */
export function entriesToRows(customerId, entries) {
  return (entries || []).map((e) => ({ customerId, ...e }));
}

/**
 * רישום השורות ביומן. prisma מוזרק. לא זורק לעולם: מחזיר {ok, count, reason}.
 * reason: 'client-missing' (קליינט Prisma בלי המודל) | 'table-missing' (P2021: ה-DDL עוד לא הורץ) | 'error'.
 */
export async function recordConsentEntries(prisma, customerId, entries) {
  const rows = entriesToRows(customerId, entries);
  if (rows.length === 0) return { ok: true, count: 0 };
  const model = prisma && prisma.customerConsent;
  if (!model || typeof model.createMany !== 'function') {
    console.error('customer consent: Prisma client has no CustomerConsent model (run prisma generate); consent NOT journaled for customer', customerId);
    return { ok: false, count: 0, reason: 'client-missing' };
  }
  try {
    // createMany בכוונה: היומן עצמו הוא הרישום; תוסף ה-AuditLog אינו רואה createMany ולכן אין שורת היסטוריה כפולה
    await model.createMany({ data: rows });
    return { ok: true, count: rows.length };
  } catch (error) {
    const reason = error && (error.code === 'P2021' || /does not exist/i.test(String(error.message))) ? 'table-missing' : 'error';
    console.error(`customer consent: journal write failed (${reason}); consent NOT journaled for customer`, customerId, error);
    return { ok: false, count: 0, reason };
  }
}

/** שורות היומן האחרונות ללקוחה (כל הסוגים) -> latestByKind. כשל = {} (נחשב "אין ביומן"). */
export async function loadLatestConsents(prisma, customerId) {
  const model = prisma && prisma.customerConsent;
  if (!model || typeof model.findMany !== 'function' || !customerId) return {};
  try {
    const rows = await model.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 60 });
    return latestByKind(rows);
  } catch (error) {
    if (!(error && (error.code === 'P2021' || /does not exist/i.test(String(error.message))))) console.error('customer consent: journal read failed', error);
    return {};
  }
}

/** תקציר לתצוגה בכרטיס הלקוח (בלי מזהי עובד גולמיים): kind -> {granted, at, channel, method, surface, documentVersion}. */
export function summarizeConsents(latest) {
  const out = {};
  for (const k of CONSENT_KINDS) {
    const r = latest && latest[k];
    if (r) out[k] = { granted: !!r.granted, at: r.createdAt, channel: r.channel, method: r.method, surface: r.surface || null, documentVersion: r.documentVersion || null };
  }
  return out;
}

/**
 * מסלול העובדים (POST /api/customers, PUT /api/customers/[id]): קורא תשובות, מאמת, ומתכנן.
 * legacyTerms: true|false|undefined - החתימה במסלול הישן של הכרטיס (readSignatureFlag: cardVariant a5 + signatureEdit) כשאין acceptedTerms;
 * היא מועברת לאותה תוכנית כך שגם עריכת חתימה בכרטיס הקיים נרשמת ביומן.
 * ledgerOn=false (המערכת כבויה והבקשה לא הצהירה consentExplicit) => אין שורות ביומן והתנהגות העמודות כמו לפני השינוי.
 * @returns {Promise<{errors:string[], status?:number, plan:{data:object,changes:object,entries:object[]}|null, answers:object, config:object, ledgerOn:boolean}>}
 */
export async function prepareStaffConsent({ prisma, body, settings, existing, customerId = null, docs, employeeId, legacyTerms, now = new Date() }) {
  const config = consentConfig(settings);
  const answers = readConsentAnswers(body);
  if (answers.terms === undefined && (legacyTerms === true || legacyTerms === false)) answers.terms = legacyTerms;
  const isNew = !existing;
  const errors = [...validateConsentAnswers({ answers, config, isNew }), ...checkEchoedVersions(body, docs)];
  const versionMismatch = errors.length > 0 && checkEchoedVersions(body, docs).length > 0;
  if (errors.length) return { errors, status: versionMismatch ? 409 : 400, plan: null, answers, config, ledgerOn: false };
  const ledgerOn = config.enabled || answers.explicit;
  const latest = ledgerOn && existing && answers.explicit && customerId ? await loadLatestConsents(prisma, customerId) : {};
  const surface = normalizeSurface(body && body.consentSurface, body && body.cardVariant === 'a5' ? (isNew ? 'new-customer' : 'customer-card') : 'unknown');
  const plan = planConsentWrite({
    answers, existing, latest, now,
    ctx: { channel: 'staff', method: 'staff_recorded', surface, employeeId: employeeId || null, docs },
  });
  if (!ledgerOn) plan.entries = [];
  return { errors: [], plan, answers, config, ledgerOn };
}

/**
 * הרישום העצמי בעמדה (kind=kiosk, method=customer_self). לשימוש POST /api/public-kiosk/register.
 * מחזיר {errors, plan} - errors ריק => plan = {data, changes, entries} שה-register מוסיף ל-prisma.customer.create ואחריו
 * recordConsentEntries(prisma, newCustomer.id, plan.entries). בעמדה הכל מפורש: consentExplicit נכפה true.
 * שימו לב: בעמדה אישור הפרטיות חובה תמיד כשהמערכת פעילה, והתקנון/הדיוור חייבים תשובה (כן/לא).
 */
export function processRegistrationConsents({ body, settings, docs, now = new Date(), meta }) {
  const config = consentConfig(settings);
  const forced = { ...(body && typeof body === 'object' ? body : {}), consentExplicit: true };
  const answers = readConsentAnswers(forced);
  const errors = [...validateConsentAnswers({ answers, config, isNew: true }), ...checkEchoedVersions(body, docs)];
  if (errors.length) return { errors, plan: null };
  const plan = planConsentWrite({
    answers, existing: null, latest: {}, now,
    ctx: { channel: 'kiosk', method: 'customer_self', surface: 'kiosk-register', employeeId: null, docs, meta },
  });
  return { errors: [], plan };
}
