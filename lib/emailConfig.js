// lib/emailConfig.js - קריאה וכתיבה של התצורה שנערכת ב"מרכז המיילים" (/admin/email-center). צד שרת בלבד.
//
// אחסון (בלי שינוי סכמה, ב-SystemSetting הקיים; שורות בלי category - לא מופיעות במסכי ההגדרות הרגילים):
//   email_tpl:<emailId>      JSON { v:1, enabled?, subject?, texts?:{key:text}, schedule?:{days:[..]}, updatedAt, updatedBy }
//   email_fixed_fields       JSON { v:1, values:{ gmachName?, gmachAddress?, ... }, updatedAt, updatedBy }
//   email_campaign_log       JSON { v:1, items:[...] }  (היסטוריית דיוורים אחרונים - ר' lib/emailCampaign.js)
// שורה חסרה = ההתנהגות הקיימת בדיוק (ברירות המחדל ב-lib/emailRegistry.js, שהן הטקסט שהיה כתוב בקוד).
//
// עקרונות:
//  * cfg.fixed מכיל *רק עקיפות מפורשות* - לא את הערכים מהגדרות האתר. כך מייל שלא נערך מפיק בדיוק את הפלט הקודם, וכל גמ"ח
//    ממשיך להשתמש בערכי ההגדרות שלו (gmach_name וכו') עד שעורכים כאן. "איפוס" מוחק את העקיפה בלבד ולא נוגע בהגדרות האתר.
//  * מתג הפעלה/כיבוי של מייל עם הגדרה קיימת (pickup_reminder_enabled וכו') כותב את אותה הגדרה - אין "מתג שני".
//  * הכתיבה עוברת דרך תוסף ה-AuditLog של Prisma (כל כתיבה ל-SystemSetting נרשמת בהיסטוריה) - לא כותבים AuditLog ידנית.

import prisma from '@/app/lib/prisma';
import { getAllCachedSettings, invalidateSettingsCache } from '@/lib/settingsCache';
import {
  EMAIL_REGISTRY, FIXED_FIELDS, FIXED_FIELD_KEYS, allowedVarKeys, defaultTexts, COMMON_VARS,
} from './emailRegistry.js';
import { SETTINGS_HEBREW_NAMES } from './settingsMetadata.js';
import { cleanTextInput, validateText, MAX_SUBJECT_LENGTH, MAX_LINE_LENGTH } from './emailText.js';

export const TPL_KEY_PREFIX = 'email_tpl:';
export const FIXED_KEY = 'email_fixed_fields';
export const CAMPAIGN_LOG_KEY = 'email_campaign_log';

const parseJson = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch { return null; }
};

const rowsByKey = (rows) => new Map((rows || []).map((r) => [r.key, r]));

/** @returns {Promise<Map<string, {key:string,value:string|null}>>} */
async function settingsMap() {
  return rowsByKey(await getAllCachedSettings());
}

// ---------------------------------------------------------------------------
// קריאה
// ---------------------------------------------------------------------------

/** עקיפות השדות הקבועים בלבד (בלי הערכים מהגדרות האתר). { key: string } */
/** כתובת האתר הציבורית (ללוגו במייל): EMAIL_SITE_ORIGIN, אחרת הדומיין הראשי של פרויקט ה-Vercel. ריק = לא ידוע (אין לוגו). */
export function siteOrigin() {
  const explicit = (process.env.EMAIL_SITE_ORIGIN || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(explicit)) return explicit;
  const prod = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  return /^[A-Za-z0-9.-]+$/.test(prod) ? `https://${prod}` : '';
}

/** מוסיף fixed.logoUrl כשמסומן showLogo. הלוגו עצמו הוא /api/logo (ציבורי). */
export function withLogoUrl(fixed, origin = siteOrigin()) {
  if (fixed && fixed.showLogo === '1' && origin) return { ...fixed, logoUrl: `${origin}/api/logo` };
  return fixed;
}

export function readFixedOverrides(map) {
  const doc = parseJson(map.get(FIXED_KEY)?.value);
  const values = doc && doc.values && typeof doc.values === 'object' ? doc.values : {};
  const out = {};
  for (const f of FIXED_FIELDS) {
    if (typeof values[f.key] === 'string') out[f.key] = values[f.key];
  }
  return out;
}

function readTpl(map, emailId) {
  const doc = parseJson(map.get(TPL_KEY_PREFIX + emailId)?.value) || {};
  const reg = EMAIL_REGISTRY[emailId];
  const lineKeys = new Set((reg?.lines || []).map((l) => l.key));
  const texts = {};
  if (doc.texts && typeof doc.texts === 'object') {
    for (const [k, v] of Object.entries(doc.texts)) if (lineKeys.has(k) && typeof v === 'string') texts[k] = v;
  }
  return {
    enabled: typeof doc.enabled === 'boolean' ? doc.enabled : null,
    subject: typeof doc.subject === 'string' && doc.subject.trim() ? doc.subject : null,
    texts,
    days: Array.isArray(doc.schedule?.days) ? doc.schedule.days.filter((n) => Number.isInteger(n)) : null,
    orderAfterDays: Number.isInteger(doc.schedule?.orderAfterDays) && doc.schedule.orderAfterDays > 0 ? doc.schedule.orderAfterDays : null,
    updatedAt: doc.updatedAt || null,
    updatedBy: doc.updatedBy || null,
  };
}

/** ימי "לפני האירוע" האפקטיביים של תזכורת האיסוף (ברירת מחדל [1] = כמו היום). */
export function pickupDaysFrom(map) {
  const reg = EMAIL_REGISTRY.pickupReminder.schedule;
  const days = readTpl(map, 'pickupReminder').days;
  if (days && days.length) {
    const clean = [...new Set(days.filter((n) => n >= 0 && n <= reg.maxDays))].sort((a, b) => b - a);
    if (clean.length) return clean;
  }
  return [...reg.defaultDays];
}

/**
 * התצורה האפקטיבית של מייל, לשימוש אתרי השליחה והתבניות.
 * @returns {Promise<{id:string, enabled:boolean, subject:string|null, texts:object, fixed:object, days:number[]|null, customized:boolean, senderName:string}>}
 *   enabled: false רק אם נכבה במפורש (עקיפה) - הגדרות-שער קיימות (pickup_reminder_enabled...) ממשיכות להיבדק באתר השליחה עצמו.
 *   customized: true אם יש עקיפת טקסט/נושא/שדה קבוע - אז כדאי לבנות גם את גרסת הטקסט הפשוט מה-HTML (cfgPlain).
 */
export async function getEmailConfig(emailId, preloadedSettings) {
  // לעולם לא זורק: כשל בקריאת ההגדרות (מסד לא זמין) = מייל ברירת מחדל, כדי שמייל איפוס סיסמה / זיכוי לא ייכשל בגלל מרכז המיילים
  let map;
  try {
    map = preloadedSettings ? rowsByKey(preloadedSettings) : await settingsMap();
  } catch (e) {
    console.error('[emailConfig] settings read failed - using defaults', e);
    return { ...EMPTY_CFG, id: emailId, texts: {}, fixed: {}, days: emailId === 'pickupReminder' ? [...EMAIL_REGISTRY.pickupReminder.schedule.defaultDays] : null };
  }
  const tpl = readTpl(map, emailId);
  const fixed = withLogoUrl(readFixedOverrides(map));
  const reg = EMAIL_REGISTRY[emailId];
  const days = emailId === 'pickupReminder' ? pickupDaysFrom(map) : null;
  return {
    id: emailId,
    enabled: reg?.enabled?.type === 'override' ? tpl.enabled !== false : true,
    subject: tpl.subject,
    texts: tpl.texts,
    fixed,
    days,
    orderAfterDays: emailId === 'orderCreatedAuto' ? tpl.orderAfterDays : null,
    customized: !!(tpl.subject || Object.keys(tpl.texts).length || Object.keys(fixed).length),
    senderName: (fixed.senderName || fixed.gmachName || '').trim(),
  };
}

/** תצורה "ריקה" (ללא עקיפות) - לשימוש בבדיקות / כשאין גישה למסד. */
export const EMPTY_CFG = Object.freeze({ id: null, enabled: true, subject: null, texts: {}, fixed: {}, days: null, orderAfterDays: null, customized: false, senderName: '' });

/** שם השולח (senderName) האפקטיבי: עקיפה שנקבעה כאן > עקיפת שם הגמ"ח כאן > null (מי שקורא יחזור להגדרה gmach_name). */
export async function getSenderNameOverride() {
  try {
    const f = readFixedOverrides(await settingsMap());
    return (f.senderName || f.gmachName || '').trim() || null;
  } catch {
    return null;
  }
}

/**
 * תצוגת מנהל: כל המיילים עם הערך האפקטיבי, מה נערך, ומה ברירת המחדל. (ללא מידע רגיש - אין כאן נמענים.)
 */
export async function loadAdminOverview() {
  const rows = await getAllCachedSettings();
  const map = rowsByKey(rows);
  const get = (k) => map.get(k)?.value ?? null;
  const emails = {};
  for (const [id, reg] of Object.entries(EMAIL_REGISTRY)) {
    const tpl = readTpl(map, id);
    const lines = reg.lines.map((l) => {
      const saved = l.bindSetting ? get(l.bindSetting) : tpl.texts[l.key];
      const value = typeof saved === 'string' && saved !== '' ? saved : l.default;
      return { key: l.key, label: l.label, default: l.default, value, edited: value !== l.default, multiline: !!l.multiline, hint: l.hint || '', vars: l.vars || [], bindSetting: l.bindSetting || null };
    });
    let enabled = true;
    let enabledEditable = false;
    if (reg.enabled.type === 'setting') { enabled = get(reg.enabled.key) === 'true'; enabledEditable = true; }
    else if (reg.enabled.type === 'override') { enabled = tpl.enabled !== false; enabledEditable = true; }
    const schedule = { modes: reg.schedule.modes, note: reg.schedule.note, maxDays: reg.schedule.maxDays || null };
    if (id === 'pickupReminder') schedule.days = pickupDaysFrom(map);
    if (id === 'orderCreatedAuto') schedule.orderAfterDays = tpl.orderAfterDays;
    if (id === 'lateReturnReminder') {
      const v = Number(get(reg.schedule.bindSetting));
      schedule.days = Number.isInteger(v) && v > 0 ? v : reg.schedule.defaultDays;
    }
    emails[id] = {
      id,
      editable: reg.editable,
      enabled, enabledEditable, enabledMode: reg.enabled.type, enabledNote: reg.enabled.note,
      subject: reg.subject ? { default: reg.subject.default, value: tpl.subject || reg.subject.default, edited: !!tpl.subject, note: reg.subject.note || '', realSubject: !!reg.subject.realSubject } : null,
      vars: [...COMMON_VARS, ...(reg.vars || [])],
      lines,
      schedule,
      edited: !!(tpl.subject || Object.keys(tpl.texts).length || lines.some((l) => l.bindSetting && l.edited)),
      updatedAt: tpl.updatedAt, updatedBy: tpl.updatedBy,
    };
  }
  return { emails, fixed: describeFixedFields(map) };
}

export function describeFixedFields(map) {
  const overrides = readFixedOverrides(map);
  return FIXED_FIELDS.map((f) => {
    const settingVal = f.settingKey ? (map.get(f.settingKey)?.value ?? '') : '';
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, f.key);
    const base = (settingVal && settingVal.trim()) ? settingVal : f.fallback;
    return {
      key: f.key, label: f.label, hint: f.hint, ltr: !!f.ltr, maxLength: f.maxLength,
      defaultValue: base, defaultSource: settingVal && settingVal.trim() ? 'setting' : 'builtin',
      value: hasOverride ? overrides[f.key] : base,
      overridden: hasOverride,
    };
  });
}

// ---------------------------------------------------------------------------
// כתיבה
// ---------------------------------------------------------------------------

async function writeJsonSetting(key, name, doc) {
  const value = JSON.stringify(doc);
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value, name },
    create: { key, value, name, type: 'json' },
  });
}

// כותבת הגדרה קיימת של המערכת (מתג/ימים של מייל). אם השורה עוד לא קיימת ב-DB (למשל daily_manager_report_enabled שמעולם לא נזרעה) נוצרת
// עם השם העברי והקטגוריה "אוטומציה" - כך היא גם מופיעה במסך הגדרות מערכת (לשונית הודעות) ולא רק כאן.
async function writePlainSetting(key, value, fallbackName) {
  const name = fallbackName || SETTINGS_HEBREW_NAMES[key] || key;
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value), name, category: 'אוטומציה', type: key === 'late_return_threshold_days' ? 'number' : 'text' },
  });
}

/**
 * שמירת עריכה של מייל. patch: { subject?, texts?:{key:text|null}, enabled?, scheduleDays? }.
 * text=null/'' או שווה לברירת המחדל -> העקיפה נמחקת (חזרה לברירת מחדל). מחזיר { ok:true } או { ok:false, error }.
 */
export async function saveEmailTemplate(emailId, patch, { employeeId = null } = {}) {
  const reg = EMAIL_REGISTRY[emailId];
  if (!reg) return { ok: false, error: 'מייל לא מוכר' };
  const allowed = allowedVarKeys(emailId);
  const map = await settingsMap();
  const cur = readTpl(map, emailId);
  const next = { subject: cur.subject, texts: { ...cur.texts }, enabled: cur.enabled, days: cur.days, orderAfterDays: cur.orderAfterDays };
  const settingWrites = []; // [key, value, name]

  if (patch.subject !== undefined) {
    if (!reg.editable || !reg.subject) return { ok: false, error: 'הנושא של המייל הזה אינו ניתן לעריכה' };
    const s = cleanTextInput(patch.subject, { max: MAX_SUBJECT_LENGTH, multiline: false });
    if (!s || s === reg.subject.default) next.subject = null;
    else {
      const err = validateText(s, allowed, { label: 'הנושא', required: true, max: MAX_SUBJECT_LENGTH });
      if (err) return { ok: false, error: err };
      next.subject = s;
    }
  }

  if (patch.texts && typeof patch.texts === 'object') {
    if (!reg.editable) return { ok: false, error: 'הטקסט של המייל הזה אינו ניתן לעריכה' };
    const defs = new Map(reg.lines.map((l) => [l.key, l]));
    for (const [key, raw] of Object.entries(patch.texts)) {
      const def = defs.get(key);
      if (!def) return { ok: false, error: `שורה לא מוכרת: ${key}` };
      if (raw === null) { delete next.texts[key]; if (def.bindSetting) settingWrites.push([def.bindSetting, def.default, null]); continue; }
      const text = cleanTextInput(raw, { max: MAX_LINE_LENGTH, multiline: !!def.multiline });
      if (def.bindSetting) {
        const err = validateText(text, allowed, { label: def.label, max: MAX_LINE_LENGTH });
        if (err) return { ok: false, error: err };
        settingWrites.push([def.bindSetting, text === def.default ? def.default : text, null]);
        continue;
      }
      if (text === def.default) { delete next.texts[key]; continue; }
      const err = validateText(text, allowed, { label: def.label, max: MAX_LINE_LENGTH });
      if (err) return { ok: false, error: err };
      next.texts[key] = text;
    }
  }

  if (patch.enabled !== undefined) {
    if (typeof patch.enabled !== 'boolean') return { ok: false, error: 'ערך הפעלה לא תקין' };
    if (reg.enabled.type === 'setting') settingWrites.push([reg.enabled.key, patch.enabled ? 'true' : 'false', null]);
    else if (reg.enabled.type === 'override') next.enabled = patch.enabled ? null : false;
    else return { ok: false, error: reg.enabled.note || 'אי אפשר לכבות מייל זה' };
  }

  if (patch.schedule && typeof patch.schedule === 'object') {
    const sc = reg.schedule;
    const p = patch.schedule;
    if (p.eventBefore !== undefined) {
      if (!sc.modes.includes('days_before_event')) return { ok: false, error: 'למייל הזה אין תזמון "ימים לפני האירוע"' };
      const arr = Array.isArray(p.eventBefore) ? p.eventBefore : [p.eventBefore];
      const days = [...new Set(arr.map(Number))];
      if (!days.length || days.length > 5 || days.some((n) => !Number.isInteger(n) || n < 0 || n > sc.maxDays)) {
        return { ok: false, error: `ימים לפני האירוע: עד 5 ערכים, כל אחד בין 0 ל-${sc.maxDays}` };
      }
      days.sort((a, b) => b - a);
      next.days = days.length === 1 && days[0] === sc.defaultDays[0] && sc.defaultDays.length === 1 ? null : days;
    }
    if (p.returnAfter !== undefined) {
      if (!sc.modes.includes('days_after_return')) return { ok: false, error: 'למייל הזה אין תזמון "אחרי תאריך ההחזרה"' };
      const n = Number(p.returnAfter);
      if (!Number.isInteger(n) || n < 1 || n > sc.maxDays) return { ok: false, error: `ימים אחרי תאריך ההחזרה: מספר שלם בין 1 ל-${sc.maxDays}` };
      settingWrites.push([sc.bindSetting, String(n), null]);
    }
    if (p.orderAfter !== undefined) {
      if (!sc.modes.includes('order_after')) return { ok: false, error: 'למייל הזה אין תזמון "אחרי יצירת ההזמנה" - הוא נשלח מיד' };
      if (p.orderAfter === null || p.orderAfter === 0) next.orderAfterDays = null;
      else {
        const n = Number(p.orderAfter);
        if (!Number.isInteger(n) || n < 1 || n > sc.maxDays) return { ok: false, error: `ימים אחרי יצירת ההזמנה: מספר שלם בין 1 ל-${sc.maxDays}, או "מיד"` };
        next.orderAfterDays = n;
      }
    }
  }

  const hasData = next.subject || Object.keys(next.texts).length || next.enabled === false || (next.days && next.days.length) || next.orderAfterDays;
  if (hasData) {
    await writeJsonSetting(TPL_KEY_PREFIX + emailId, `מרכז מיילים - ${emailId}`, {
      v: 1,
      ...(next.enabled === false ? { enabled: false } : {}),
      ...(next.subject ? { subject: next.subject } : {}),
      ...(Object.keys(next.texts).length ? { texts: next.texts } : {}),
      ...((next.days && next.days.length) || next.orderAfterDays ? { schedule: { ...(next.days && next.days.length ? { days: next.days } : {}), ...(next.orderAfterDays ? { orderAfterDays: next.orderAfterDays } : {}) } } : {}),
      updatedAt: new Date().toISOString(), updatedBy: employeeId,
    });
  } else if (map.has(TPL_KEY_PREFIX + emailId)) {
    await prisma.systemSetting.deleteMany({ where: { key: TPL_KEY_PREFIX + emailId } });
  }
  for (const [key, value] of settingWrites) await writePlainSetting(key, value, null);
  invalidateSettingsCache();
  return { ok: true };
}

/** איפוס מייל לברירת מחדל: מוחק את העקיפות (נושא, טקסטים, כיבוי, ימים). הגדרות-שער קיימות לא משתנות. */
export async function resetEmailTemplate(emailId) {
  const reg = EMAIL_REGISTRY[emailId];
  if (!reg) return { ok: false, error: 'מייל לא מוכר' };
  await prisma.systemSetting.deleteMany({ where: { key: TPL_KEY_PREFIX + emailId } });
  // שורה שקשורה להגדרה קיימת (late_return_email_text) חוזרת לברירת המחדל גם היא - זו הגדרה שהמסך הזה מציג כשורה
  for (const l of reg.lines) {
    if (l.bindSetting) {
      const row = await prisma.systemSetting.findUnique({ where: { key: l.bindSetting } });
      if (row && row.value !== l.default) await prisma.systemSetting.update({ where: { key: l.bindSetting }, data: { value: l.default } });
    }
  }
  invalidateSettingsCache();
  return { ok: true };
}

/**
 * שמירת שדות קבועים. values: { key: string|null } - null = איפוס השדה (מחיקת העקיפה).
 * ערך זהה לברירת המחדל הנוכחית (הגדרת האתר) נשמר בכל זאת רק אם המנהל ביקש במפורש (explicit) - אחרת נמחק כדי ששינוי עתידי בהגדרת האתר יתפוס.
 */
export async function saveFixedFields(values, { employeeId = null } = {}) {
  if (!values || typeof values !== 'object') return { ok: false, error: 'בקשה לא תקינה' };
  const map = await settingsMap();
  const doc = parseJson(map.get(FIXED_KEY)?.value);
  const cur = doc && doc.values && typeof doc.values === 'object' ? { ...doc.values } : {};
  const defs = new Map(FIXED_FIELDS.map((f) => [f.key, f]));
  const view = new Map(describeFixedFields(map).map((f) => [f.key, f]));
  for (const [key, raw] of Object.entries(values)) {
    const def = defs.get(key);
    if (!def) return { ok: false, error: `שדה לא מוכר: ${key}` };
    if (raw === null) { delete cur[key]; continue; }
    if (typeof raw !== 'string') return { ok: false, error: `${def.label}: ערך לא תקין` };
    if (raw.length > def.maxLength) return { ok: false, error: `${def.label}: ארוך מדי (עד ${def.maxLength} תווים)` };
    const text = cleanTextInput(raw, { max: def.maxLength, multiline: false });
    if (key === 'contactEmail' && text && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(text)) return { ok: false, error: `${def.label}: כתובת מייל לא תקינה` };
    if (def.toggle) { if (text === '1') cur[key] = '1'; else delete cur[key]; continue; } // מתג: '1' = דלוק, אחרת אין עקיפה
    if (key === 'gmachName' && !text) { delete cur[key]; continue; } // ריק = אין עקיפה (חוזר להגדרת האתר)
    if (key === 'footerNote') {
      const err = validateText(text, COMMON_VARS.map((v) => v.key), { label: def.label, max: def.maxLength });
      if (err) return { ok: false, error: err };
    }
    // ריק בשדה שמותר לרוקן (בס"ד / שורת סיום) נשמר כעקיפה ריקה = "הסתר"; בשאר השדות ריק = אין עקיפה
    if (text === '' && !def.allowEmptyOverride) { delete cur[key]; continue; }
    if (text !== '' && text === view.get(key)?.defaultValue && !view.get(key)?.overridden) { delete cur[key]; continue; }
    cur[key] = text;
  }
  const keep = Object.fromEntries(Object.entries(cur).filter(([k]) => FIXED_FIELD_KEYS.includes(k)));
  if (Object.keys(keep).length) {
    await writeJsonSetting(FIXED_KEY, 'מרכז מיילים - שדות קבועים', { v: 1, values: keep, updatedAt: new Date().toISOString(), updatedBy: employeeId });
  } else if (map.has(FIXED_KEY)) {
    await prisma.systemSetting.deleteMany({ where: { key: FIXED_KEY } });
  }
  invalidateSettingsCache();
  return { ok: true };
}

export async function resetAllFixedFields() {
  await prisma.systemSetting.deleteMany({ where: { key: FIXED_KEY } });
  invalidateSettingsCache();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// עזרים לאתרי השליחה
// ---------------------------------------------------------------------------

/** הטקסט של שורה (אחרי עקיפה והחלפת משתנים) - לאתרים שבונים HTML בעצמם (cron/daily, send-email). */
export { defaultTexts };

export { cfgPlain, htmlToPlain } from './emailText.js';

/**
 * תצורת טיוטה לתצוגה מקדימה חיה (לא נשמרת): מאמתת כמו בשמירה ומחזירה cfg שאפשר להעביר לתבניות / ל-emailSubject.
 * draft: { subject?, texts?:{key:text}, fixed?:{key:text} } - fixed מהטיוטה גובה על השמור.
 */
export async function buildDraftCfg(emailId, draft = {}, { origin } = {}) {
  const reg = EMAIL_REGISTRY[emailId];
  if (!reg) return { ok: false, error: 'מייל לא מוכר' };
  const allowed = allowedVarKeys(emailId);
  const base = await getEmailConfig(emailId);
  const texts = { ...base.texts };
  const defs = new Map(reg.lines.map((l) => [l.key, l]));
  for (const [key, raw] of Object.entries(draft.texts || {})) {
    const def = defs.get(key);
    if (!def) continue;
    if (raw === null) { delete texts[key]; continue; }
    const text = cleanTextInput(raw, { max: MAX_LINE_LENGTH, multiline: !!def.multiline });
    const err = validateText(text, allowed, { label: def.label, max: MAX_LINE_LENGTH });
    if (err) return { ok: false, error: err, key };
    texts[key] = text;
  }
  let subject = base.subject;
  if (draft.subject !== undefined && reg.subject) {
    const s = cleanTextInput(draft.subject, { max: MAX_SUBJECT_LENGTH, multiline: false });
    const err = s ? validateText(s, allowed, { label: 'הנושא', max: MAX_SUBJECT_LENGTH }) : null;
    if (err) return { ok: false, error: err, key: '__subject' };
    subject = s && s !== reg.subject.default ? s : null;
  }
  const fixed = { ...base.fixed };
  for (const [key, raw] of Object.entries(draft.fixed || {})) {
    const def = FIXED_FIELDS.find((f) => f.key === key);
    if (!def) continue;
    if (raw === null) { delete fixed[key]; continue; }
    const text = cleanTextInput(raw, { max: def.maxLength, multiline: false });
    if (text === '' && !def.allowEmptyOverride) delete fixed[key]; else fixed[key] = text;
  }
  return { ok: true, cfg: { ...base, texts, subject, fixed: withLogoUrl(fixed, origin || siteOrigin()), customized: true } };
}
