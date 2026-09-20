// Shared client+server validation for numeric SystemSetting values — used by both
// app/admin/settings/SettingsClient.js (inline UI validation) and
// app/api/settings/route.js (server-side guard, since the API can be called directly).
// Bounds are sanity caps, not business-precise limits — the goal is to catch obvious
// mistakes (e.g. "1000" days for a refund window) rather than encode exact policy.
export const NUMBER_FIELD_LIMITS = {
  max_items_per_order: { min: 1, max: 100 },
  barcodePrefixLength: { min: 1, max: 10 },
  barcode_length: { min: 1, max: 30 },
  BUFFER_DAYS: { min: 0, max: 60 },
  inventory_buffer_days: { min: 0, max: 60 },
  REFUND_PERCENTAGE: { min: 0, max: 100, allowDecimal: true },
  REFUND_DAYS: { min: 0, max: 365 },
  NO_REFUND_DAYS_BEFORE_EVENT: { min: 0, max: 365 },
  REFUND_DAYS_FROM_ORDER: { min: 0, max: 365 },
  full_refund_days: { min: 0, max: 365 },
  CANCELLATION_CREDIT_MINUTES: { min: 0, max: 10080 }, // one week, in minutes
  hok_charge_amount: { min: 0, max: 10000, allowDecimal: true },
  delivery_price: { min: 0, max: 1000, allowDecimal: true },
  backup_interval_hours: { min: 1, max: 336, allowDecimal: true }, // 336h = 2 weeks
  late_return_threshold_days: { min: 1, max: 90 },
};

// allowEmpty: ערך ריק (או שורה חסרה) חוקי ומשמעותו "ברירת המחדל הישנה" - חל על הגדרות
// מדיניות ההחלפה/ביטול, שבהן ריק = התנהגות legacy. emptyHint: הטקסט שמוצג בשדה הריק.
export const POLICY_NUMBER_LIMITS = {
  swap_min_days_before_event: { min: 0, max: 365, allowEmpty: true, emptyHint: 'ריק = בלי הגבלה' },
  swap_pairing_window_minutes: { min: 0, max: 1440, allowEmpty: true, emptyHint: 'ריק = בלי הגבלה' },
  instant_undo_minutes: { min: 0, max: 10080, allowEmpty: true, emptyHint: 'ריק = כמו זיכוי דמי ביטול' },
  size_edit_until_days_before_event: { min: 0, max: 365, allowEmpty: true, emptyHint: 'ריק = כבוי' },
};
Object.assign(NUMBER_FIELD_LIMITS, POLICY_NUMBER_LIMITS);

// הגדרות בחירה עם רשימה סגורה של ערכים תקינים (ריק חוקי = ברירת המחדל).
export const SELECT_FIELD_ALLOWED_VALUES = {
  gap_size_price_rule: ['none', 'cheaper'],
};

// Returns null when the value is valid, otherwise a Hebrew error message.
export function validateSelectSetting(key, value) {
  const allowed = SELECT_FIELD_ALLOWED_VALUES[key];
  if (!allowed) return null;
  if (value === '' || value === null || value === undefined) return null;
  return allowed.includes(String(value)) ? null : 'ערך לא תקין - יש לבחור מהרשימה.';
}

// Returns null when the value is valid (or the key has no numeric limit configured),
// otherwise a Hebrew error message describing why it was rejected.
export function validateNumericSetting(key, value) {
  const limit = NUMBER_FIELD_LIMITS[key];
  if (!limit) return null;
  if (value === '' || value === null || value === undefined) {
    return limit.allowEmpty ? null : 'יש להזין ערך מספרי.';
  }

  const num = Number(value);
  if (Number.isNaN(num)) return 'יש להזין מספר בלבד.';
  if (!limit.allowDecimal && !Number.isInteger(num)) return 'יש להזין מספר שלם (ללא נקודה עשרונית).';
  if (num < limit.min) return `הערך קטן מדי — המינימום המותר הוא ${limit.min}.`;
  if (num > limit.max) return `הערך גדול מדי — המקסימום המותר הוא ${limit.max}.`;
  return null;
}
