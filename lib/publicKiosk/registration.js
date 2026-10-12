// lib/publicKiosk/registration.js - רישום לקוחה מהעמדה (POST /api/public-kiosk/register), שכבת ה-DB.
// כללים:
//  * אותן בדיקות שדות כמו טופס "לקוח חדש" (collectNewCustomerErrors) - לא העתק מנוון.
//  * אנטי-enumeration: התוצאה למבקשת זהה (ok) בין "נוצרה לקוחה חדשה" לבין "כבר קיימת". לעולם לא מוחזרים נתוני לקוחה קיימת, ולא נכתבת
//    הודעת כפילות מפורטת (בניגוד ל-POST /api/customers שמציג "קיימת אצל <שם>").
//  * לקוחה קיימת (ת"ז זהה, או טלפון זהה + אותו שם פרטי ומשפחה): לא נוצרת כפילות ושום שדה לא נדרס. נכתב רק סימון קבוע בהערות המשרד
//    (lib/kioskRegistration.js) כדי שהעובדת תראה. טלפון בלבד (שם שונה) לא נחשב כפילות - טלפון משותף במשפחה לגיטימי (כמו ב-/api/customers).
//  * הרישום לא כותב שורות AuditLog ידנית - התוסף של Prisma (app/lib/prisma.js) רושם כל כתיבה.
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { collectNewCustomerErrors } from '@/lib/customerCreateValidation';
import { phoneKeysFromInput } from '@/lib/listSearch';
import { findCustomerIdsByPhone } from '@/lib/searchDb';
import { buildPendingOfficeNotes, buildRepeatOfficeNotes, kioskRegistrationState } from '@/lib/kioskRegistration';
import { CHANNELS, idNumberVariants, nameKey, normalizeRegistrationInput } from '@/lib/publicKiosk/registrationInput';
import { recordConsentsForCustomer } from '@/lib/publicKiosk/recordConsents';

const LEGACY_ID_RETRIES = 4;

// הגנה מלחיצה כפולה / שליחה כפולה מקבילה: אותו מפתח (ת"ז, אחרת טלפון+שם) בתוך חלון קצר באותו אינסטנס = נחשב "כבר נרשמה" ולא נוצר כפיל
// (בדיקת הקיום ב-DB לא מספיקה כשהבקשות רצות במקביל לפני שהראשונה נכתבה). זיכרון תהליך בלבד - הגנה חלקית, לא נעילה מבוזרת.
const RECENT_MS = 30 * 1000;
const recent = new Map();
function recentKey(v) { return v.zeout ? `id:${v.zeout}` : `ph:${v.phone1}|${nameKey(v.firstName)}|${nameKey(v.lastName)}`; }
function seenRecently(key, now) {
  for (const [k, t] of recent) if (now - t > RECENT_MS) recent.delete(k);
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}
export function resetRecentRegistrations() { recent.clear(); }

/** מסנן קלט + כללי ההגדרות. מחזיר { honeypot } | { invalid:true, errors, fields } | { input } (נקי לכתיבה). */
export async function validateRegistration(body, sMap) {
  const n = normalizeRegistrationInput(body);
  if (n.honeypot) return { honeypot: true };
  const errors = [];
  const fields = { ...n.fieldErrors };
  for (const m of Object.values(n.fieldErrors)) errors.push(m);
  if (Object.keys(n.fieldErrors).length === 0) {
    // רק כשהקלט בסיסי תקין: כללי ההגדרות (שדות חובה לפי גמ"ח) + בדיקות תבנית (טלפון/ת"ז/מייל) - אותו קוד כמו טופס לקוח חדש
    const asBody = { ...n.value, houseNum: n.value.houseNum == null ? '' : String(n.value.houseNum), marketingConsent: n.consent.marketingConsent };
    const { errors: ruleErrors } = collectNewCustomerErrors(asBody, sMap, { bankFields: false });
    for (const e of ruleErrors) if (!errors.includes(e)) errors.push(e);
  }
  if (errors.length > 0) return { invalid: true, errors, fields };
  return { input: n };
}

async function findExistingCustomer(value) {
  if (value.zeout) {
    const variants = idNumberVariants(value.zeout);
    if (variants.length) {
      const byId = await prisma.customer.findFirst({ where: { isDeleted: false, zeout: { in: variants } }, select: { id: true, officeNotes: true } });
      if (byId) return byId;
    }
  }
  const keys = phoneKeysFromInput(value.phone1);
  if (keys && keys.exact && keys.exact.length) {
    const ids = await findCustomerIdsByPhone(keys, { limit: 50 });
    if (ids.length) {
      const rows = await prisma.customer.findMany({ where: { id: { in: ids }, isDeleted: false }, select: { id: true, firstName: true, lastName: true, officeNotes: true } });
      const fk = nameKey(value.firstName), lk = nameKey(value.lastName);
      const same = rows.find((r) => nameKey(r.firstName) === fk && nameKey(r.lastName) === lk);
      if (same) return { id: same.id, officeNotes: same.officeNotes };
    }
  }
  return null;
}

async function createWithNextLegacyId(data) {
  for (let attempt = 0; attempt < LEGACY_ID_RETRIES; attempt++) {
    const max = await prisma.customer.findFirst({ where: { legacyId: { not: null } }, orderBy: { legacyId: 'desc' }, select: { legacyId: true } });
    const legacyId = (max?.legacyId || 0) + 1 + attempt; // attempt: אחרי התנגשות unique מדלגים קדימה
    try {
      return await prisma.customer.create({ data: { ...data, legacyId }, select: { id: true } });
    } catch (e) {
      if (e && e.code === 'P2002' && attempt < LEGACY_ID_RETRIES - 1) continue;
      throw e;
    }
  }
  return null;
}

/**
 * מבצע רישום (אחרי validateRegistration). תמיד מחזיר { ok:true } כלפי חוץ - כולל כשהלקוחה כבר קיימת.
 * הפרט הפנימי (outcome: 'created' | 'existing-marked' | 'existing-already-marked') מיועד ללוג/בדיקות בלבד ואינו נשלח ללקוחה.
 */
export async function performRegistration(input, { now = new Date() } = {}) {
  const { value, consent, channel } = input;
  const channelLabel = CHANNELS[channel] || CHANNELS.public;
  if (seenRecently(recentKey(value), now.getTime())) return { ok: true, outcome: 'duplicate-submit' };
  const rkey = recentKey(value);
  try {
    const existing = await findExistingCustomer(value);
    if (existing) {
      const next = buildRepeatOfficeNotes({ existing: existing.officeNotes, now, channelLabel });
      if (next === null) return { ok: true, outcome: 'existing-already-marked' };
      await prisma.customer.update({ where: { id: existing.id }, data: { officeNotes: next } });
      return { ok: true, outcome: 'existing-marked' };
    }
    const created = await createWithNextLegacyId({
      firstName: value.firstName,
      lastName: value.lastName,
      phone1: value.phone1,
      phone2: value.phone2 || null,
      zeout: value.zeout || null,
      email: value.email || null,
      city: value.city || null,
      street: value.street || null,
      houseNum: value.houseNum,
      marketingConsent: consent.marketingConsent === true,
      officeNotes: buildPendingOfficeNotes({ now, channelLabel }),
    });
    if (!created) throw new Error('customer create failed');
    try {
      const rec = await recordConsentsForCustomer({ customerId: created.id, channel, consents: consent, now });
      // recordConsentsForCustomer לא זורק: כשל (גרסת מסמך ישנה / שגיאה) חוזר כ-ok:false - הלקוחה כבר נשמרה, רק נרשם בלוג השרת
      if (rec && rec.ok === false) console.error('public-kiosk register: consents not recorded for customer', created.id, rec.reason, rec.errors || '');
    } catch (e) {
      // הלקוחה כבר נשמרה (והסימון "לאמת פרטים" מבטיח שהעובדת תבדוק) - כשל בתיעוד הסכמה לא מבטל את הרישום, אך נרשם בלוג השרת
      console.error('public-kiosk register: recordConsentsForCustomer failed for customer', created.id, e && e.message ? e.message : e);
    }
    return { ok: true, outcome: 'created' };
  } catch (e) {
    recent.delete(rkey); // הכתיבה נכשלה - שליחה חוזרת של הלקוחה צריכה לעבוד
    throw e;
  }
}

export async function loadSettingsMap() {
  const rows = await getAllCachedSettings();
  return new Map(rows.map((s) => [s.key, s.value]));
}

export { kioskRegistrationState };
