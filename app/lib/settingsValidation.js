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
};

// Returns null when the value is valid (or the key has no numeric limit configured),
// otherwise a Hebrew error message describing why it was rejected.
export function validateNumericSetting(key, value) {
  const limit = NUMBER_FIELD_LIMITS[key];
  if (!limit) return null;
  if (value === '' || value === null || value === undefined) return 'יש להזין ערך מספרי.';

  const num = Number(value);
  if (Number.isNaN(num)) return 'יש להזין מספר בלבד.';
  if (!limit.allowDecimal && !Number.isInteger(num)) return 'יש להזין מספר שלם (ללא נקודה עשרונית).';
  if (num < limit.min) return `הערך קטן מדי — המינימום המותר הוא ${limit.min}.`;
  if (num > limit.max) return `הערך גדול מדי — המקסימום המותר הוא ${limit.max}.`;
  return null;
}
