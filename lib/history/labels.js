// Hebrew wording for the customer-card history feed (lib/history/customerHistory.js).
//
// Pure module: no React, no Prisma, no path aliases - it is imported by the server-side history
// mapper, by components/HistoryViewer.js (client) and by a plain `node` test script.
//
// FIELD_TRANSLATIONS (components/HistoryViewer.js) is the site-wide field-label table, but it lives
// in a 'use client' file, and a server module cannot read values out of a client module. So the
// labels that were MISSING from it (customer.zeout, marketingConsent, bank*, hok*, isBlocked,
// blockedReason - CUSTOMER_ONLY_FIELD_LABELS below) are defined here and spread back into
// FIELD_TRANSLATIONS, which makes this file their single source: the existing history tabs stop
// printing raw keys and the new feed uses the same words. The keys FIELD_TRANSLATIONS already had
// are repeated in CUSTOMER_SHARED_FIELD_LABELS only because the server needs them too;
// scripts/customer-history.test.mjs checks that those copies still equal the table.

// Customer fields that FIELD_TRANSLATIONS did not translate. Spread into it (purely additive).
export const CUSTOMER_ONLY_FIELD_LABELS = {
  zeout: 'תעודת זהות',
  marketingConsent: 'אישור קבלת דיוורים',
  bankName: 'שם בנק',
  bankBranch: 'סניף בנק',
  bankAccount: 'מספר חשבון בנק',
  bankAccountName: 'שם בעל החשבון',
  hokBankName: 'הוראת קבע - בנק',
  hokBankBranch: 'הוראת קבע - סניף',
  hokBankAccount: 'הוראת קבע - חשבון',
  hokConsent: 'הסכמה להוראת קבע',
  isBlocked: 'חסימה מהזמנות חדשות',
  blockedReason: 'סיבת החסימה',
};

// Copies of entries FIELD_TRANSLATIONS already has (kept identical - see the header).
export const CUSTOMER_SHARED_FIELD_LABELS = {
  firstName: 'שם פרטי',
  lastName: 'שם משפחה',
  phone1: 'טלפון 1',
  phone2: 'טלפון 2',
  city: 'עיר',
  street: 'רחוב',
  houseNum: 'מספר בית',
  email: 'דוא"ל',
  emailSuffix: 'סיומת דוא"ל',
  notes: 'הערות',
  registrationDate: 'תאריך רישום',
  officeNotes: 'נתוני משרד',
  isDeleted: 'נמחק/בוטל',
};

// Labels used only by this feed (not worth adding to the site-wide table).
const CUSTOMER_LOCAL_FIELD_LABELS = {
  legacyId: 'מספר לקוח',
  id: 'מזהה רשומה',
  createdAt: 'תאריך יצירה',
  updatedAt: 'תאריך עדכון',
  firstNamePhoneticKey: 'מפתח חיפוש פונטי (שם פרטי)',
  lastNamePhoneticKey: 'מפתח חיפוש פונטי (שם משפחה)',
};

export const CUSTOMER_FIELD_LABELS = {
  ...CUSTOMER_SHARED_FIELD_LABELS,
  ...CUSTOMER_ONLY_FIELD_LABELS,
  ...CUSTOMER_LOCAL_FIELD_LABELS,
};

// Columns the write side keeps in sync by itself (app/lib/prisma.js phonetic keys, @updatedAt).
// A change to one of them is never the point of a save, so it gets no line of its own; if a row
// holds nothing else it still yields one "no visible change" entry (rows are never dropped).
export const HIDDEN_CUSTOMER_FIELDS = new Set([
  'firstNamePhoneticKey', 'lastNamePhoneticKey', 'updatedAt', 'emailSuffix',
]);

// Verb agreement for "עודכן <שדה>" (A5 wording: "עודכן מייל", "עודכנה כתובת"). Default is masculine.
const FEMININE_FIELDS = new Set(['city', 'zeout', 'blockedReason']);
const PLURAL_FIELDS = new Set(['notes', 'officeNotes']);

export function fieldLabel(key) {
  return CUSTOMER_FIELD_LABELS[key] || key;
}

export function updatedVerb(key) {
  if (PLURAL_FIELDS.has(key)) return 'עודכנו';
  if (FEMININE_FIELDS.has(key)) return 'עודכנה';
  return 'עודכן';
}

// Icon names from design-system/sprite.svg (rendered inline by MenuSprite as `#gmi-<name>`).
const FIELD_ICONS = {
  firstName: 'user', lastName: 'user',
  phone1: 'phone', phone2: 'phone',
  email: 'mail', emailSuffix: 'mail', marketingConsent: 'mail',
  city: 'pin', street: 'pin', houseNum: 'pin',
  zeout: 'file',
  notes: 'note', officeNotes: 'note',
  bankName: 'bank', bankBranch: 'bank', bankAccount: 'bank', bankAccountName: 'bank',
  hokBankName: 'bank', hokBankBranch: 'bank', hokBankAccount: 'bank', hokConsent: 'bank',
  isBlocked: 'shield', blockedReason: 'shield',
  isDeleted: 'alert',
};
export function fieldIcon(key) {
  return FIELD_ICONS[key] || 'user';
}

export const CATEGORY_LABELS = {
  cust: 'פרטים',
  orders: 'הזמנות',
  pay: 'תשלומים',
  docs: 'מסמכים',
};
export const CATEGORIES = Object.keys(CATEGORY_LABELS);

// Action names of AuditLog rows the feed shows a specific line for. Anything else falls back to
// `פעולה: <ACTION>` - a row is never dropped just because its action is unknown.
export const ACTION_LABELS = {
  CREATE: 'יצירה',
  UPDATE: 'עדכון',
  DELETE: 'מחיקה',
  EMAIL_SENT: 'שליחת מייל',
  ADD_AUTO_NOTE: 'הערה אוטומטית',
  CANCEL_ORDER: 'ביטול הזמנה',
  DEBT_APPROVED: 'אישור יתרת חוב',
  CANCEL_DEBT_APPROVAL: 'ביטול אישור יתרת חוב',
};

export const ISSUE_TYPE_LABELS = {
  'returned-bad': 'חזרה לא תקינה',
};

// ---- value formatters -------------------------------------------------------------------------

export const EMPTY_TEXT = 'ריק';

export function isEmptyValue(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatBoolean(v) {
  return v ? 'כן' : 'לא';
}

// "₪1,200" (negative: "-₪1,200"). Amounts are shekels, integers in practice.
export function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  const abs = Math.abs(num).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${num < 0 ? '-' : ''}₪${abs}`;
}

export function shorten(text, max = 26) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// Display text for one field value. `hebrewDate` (Date -> string) is injected because the Hebrew
// calendar helper needs @hebcal/core; without it an ISO date is left as-is.
export function formatFieldValue(key, value, { hebrewDate } = {}) {
  if (isEmptyValue(value)) return EMPTY_TEXT;
  if (typeof value === 'boolean') return formatBoolean(value);
  if (typeof value === 'string' && ISO_DATETIME.test(value) && typeof hebrewDate === 'function') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return hebrewDate(d) || value;
  }
  // a date-only value ("2026-09-16") is a calendar day, not an instant: noon UTC lands on that day in Israel
  if (typeof value === 'string' && DATE_ONLY.test(value) && typeof hebrewDate === 'function') {
    const d = new Date(`${value}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) return hebrewDate(d) || value;
  }
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

// Payment method -> the wording after "התקבל תשלום " (A5: "התקבל תשלום במזומן / באשראי").
const PAYMENT_METHOD_PHRASES = {
  'מזומן': 'במזומן',
  'אשראי': 'באשראי',
  'העברה': 'בהעברה',
  'העברה בנקאית': 'בהעברה בנקאית',
  'צ׳ק': 'בצ׳ק',
  "צ'ק": 'בצ׳ק',
  'שיק': 'בשיק',
  'ביט': 'בביט',
};
export function paymentMethodPhrase(method) {
  const m = String(method || '').trim();
  return PAYMENT_METHOD_PHRASES[m] || null;
}
export function paymentMethodIcon(method) {
  const m = String(method || '').trim();
  if (m === 'מזומן') return 'cash';
  if (m === 'אשראי') return 'card';
  if (m.startsWith('העברה')) return 'bank';
  if (m === 'צ׳ק' || m === "צ'ק" || m === 'שיק') return 'cheque';
  return 'cash';
}

// A record id as the database generates it (uuid()): the only shape the history routes hand to Prisma (ID-1).
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuidShaped(id) {
  return typeof id === 'string' && id.length === 36 && UUID_SHAPE.test(id);
}
