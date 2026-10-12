// lib/schedule/barcodeEntry.js — ברקוד בלו״ז (docs/schedule-barcode-plan.md): הגדרות, מי נדרש להיסרק, ומטריצת החסימה.
// **פונקציות טהורות בלבד** (בלי prisma / next) - נבדקות ב-scripts/schedule-tests/barcode-entry.test.mjs ונטענות גם בלקוח.
//
// הרעיון (D1/D2/D3 בתכנון):
//   * שתי הגדרות, אחת לכל סוג הזמנה: barcode_entry_when_delivery (משלוח הלוך) ו-barcode_entry_when_local_pickup (איסוף מקומי).
//     ערך: 'off' (ברירת מחדל, חסר/ריק/לא מוכר = ההתנהגות של היום בדיוק) | 'prep' | 'pickup'.
//   * 'prep' כשהשלב "הכנה" כבוי בהגדרות הלו״ז (schedule_stage_prep_enabled='false') = 'pickup' בפועל (אין היכן להזין בהכנה).
//   * "נדרש" = כל פריט פעיל שיש לו זהות דגם (קידומת) חייב OrderItem.barcode. פריט שכבר נלקח בלי ברקוד (לפני ההגדרה) נחשב מסופק.
//   * חסימה: הכנה - רק ב-'prep'; מסירה (pick/dout) - בכל ערך שאינו 'off'.
//   * isTaken/takenDate ממשיכים לסמן "יצא מהחנות" ומתהפכים רק במסירה (D1).

export const BARCODE_WHEN_KEYS = {
  delivery: 'barcode_entry_when_delivery',
  local: 'barcode_entry_when_local_pickup',
};
export const BARCODE_WHEN_VALUES = ['off', 'prep', 'pickup'];
export const HANDOVER_STAGE_BY_KIND = { delivery: 'dout', local: 'pick' };
export const GATED_STAGE_KEYS = ['prep', 'pick', 'dout'];

/** ערך הגדרה גולמי -> 'off' | 'prep' | 'pickup' (כל דבר אחר = 'off'). */
export function normalizeWhen(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === 'prep' || v === 'pickup' ? v : 'off';
}

/** map: { key: value } (כמו SystemSetting) -> { delivery, local } מנורמלים. */
export function resolveBarcodeSettings(map = {}) {
  return {
    delivery: normalizeWhen(map[BARCODE_WHEN_KEYS.delivery]),
    local: normalizeWhen(map[BARCODE_WHEN_KEYS.local]),
  };
}

/** משלוח הלוך (כמו isDeliveryOut ב-lib/schedule/deliveryDirection.js; מועתק כדי שהקובץ יישאר טהור וללא ייבוא). */
export function orderKind(order) {
  const out = !!(order && order.isDelivery) && ((order.deliveryDirection || 'הלוך-חזור') !== 'חזור');
  return out ? 'delivery' : 'local';
}

/**
 * הערך האפקטיבי לסוג הזמנה.
 * @param {'delivery'|'local'} kind
 * @param {{delivery:string, local:string}} settings  תוצאת resolveBarcodeSettings
 * @param {{prepEnabled?: boolean, deliveriesEnabled?: boolean}} [opts]  prepEnabled=false => 'prep' הופך 'pickup'
 * @returns {'off'|'prep'|'pickup'}
 */
export function effectiveWhen(kind, settings, { prepEnabled = true } = {}) {
  const raw = (settings && settings[kind === 'delivery' ? 'delivery' : 'local']) || 'off';
  if (raw === 'prep' && !prepEnabled) return 'pickup';
  return raw;
}

/** הערכים האפקטיביים לשני הסוגים - לחישוב חד-פעמי לכל יום/בקשה. */
export function effectiveSettings(settings, opts) {
  return { delivery: effectiveWhen('delivery', settings, opts), local: effectiveWhen('local', settings, opts) };
}

export const isFeatureOn = (eff) => !!eff && (eff.delivery !== 'off' || eff.local !== 'off');

// ---- פריטים -------------------------------------------------------------------------------------

export const itemBarcodeOf = (item) => {
  const b = item && item.barcode;
  if (b === null || b === undefined) return '';
  return String(b).trim();
};
export const itemHasBarcode = (item) => itemBarcodeOf(item) !== '';
/**
 * "נרשם ברקוד": יש ברקוד, והוא לא סומן "לא תקין" שטרם טופל (rentals/scan כותב barcode גם לברקוד שלא קיים במאגר, עם barcodeInvalid) -
 * ברקוד כזה לא נחשב רישום (סקירה עצמאית, ממצא 1).
 */
export const itemIsRegistered = (item) => itemHasBarcode(item) && !(item.barcodeInvalid && !item.barcodeInvalidHandled);
export const itemIsTaken = (item) => !!(item && (item.isTaken || item.takenDate));
export const itemIsDeleted = (item) => !!(item && item.isDeleted);

/** זהות דגם (קידומת) של פריט הזמנה - אותו סדר עדיפויות כמו lib/rentalBarcodeMatch.js getOrderedIdentity. */
export function itemModelPrefix(item) {
  const p = (item && item.dressItem && item.dressItem.dress && item.dressItem.dress.barcodePrefix)
    || (item && item.dressItem && item.dressItem.barcodePrefix)
    || (item && item.barcodePrefix)
    || null;
  return p === null || p === undefined || p === '' ? null : p;
}

/** D4: פריט בלי זהות דגם אינו נדרש להיסרק (כמו barcodeForItem בכרטיס ההזמנה). */
export const itemNeedsBarcode = (item) => itemModelPrefix(item) !== null;

/**
 * מצב כל הפריטים הפעילים של הזמנה לצורך ברקוד.
 * satisfied = נדרש ויש ברקוד, או נלקח בלי ברקוד (לא חוסמים אחורה). missing = נדרש, אין ברקוד תקף, לא נלקח.
 * requiredAllTaken = כל הפריטים הנדרשים נלקחו; allTaken = כל הפריטים הפעילים (גם הפטורים מברקוד) נלקחו - זו "העובדה" שהמסירה נשענת עליה.
 * @returns {{total:number, required:number, registered:number, taken:number, satisfied:number, missing:object[], complete:boolean, allTaken:boolean, requiredAllTaken:boolean}}
 */
export function summarizeItems(items) {
  const active = (items || []).filter((it) => !itemIsDeleted(it));
  const required = active.filter(itemNeedsBarcode);
  const missing = [];
  let registered = 0;
  let taken = 0;
  let satisfied = 0;
  for (const it of required) {
    const has = itemIsRegistered(it);
    const tk = itemIsTaken(it);
    if (has) registered++;
    if (tk) taken++;
    if (has || tk) satisfied++; else missing.push(it);
  }
  return {
    total: active.length,
    required: required.length,
    registered,
    taken,
    satisfied,
    missing,
    complete: missing.length === 0,
    requiredAllTaken: required.length > 0 && taken === required.length,
    allTaken: active.length > 0 && active.every(itemIsTaken),
  };
}

// ---- מטריצת החסימה ------------------------------------------------------------------------------

/**
 * @param {string} stageKey  prep | pick | dout (כל שלב אחר: לא מוגבל)
 * @param {'delivery'|'local'} kind
 * @param {'off'|'prep'|'pickup'} when  הערך האפקטיבי לסוג ההזמנה
 * @returns {'none'|'register'|'handover'}
 *   'register' = הכנה: הסריקה רושמת בלבד; 'handover' = מסירה: הסריקה רושמת ולוקחת; 'none' = אין חסימה
 */
export function gateTypeFor(stageKey, kind, when) {
  if (when === 'off') return 'none';
  if (stageKey === 'prep') return when === 'prep' ? 'register' : 'none';
  if (stageKey === 'pick') return kind === 'local' ? 'handover' : 'none';
  if (stageKey === 'dout') return kind === 'delivery' ? 'handover' : 'none';
  return 'none';
}

/**
 * הערכת החסימה לשורה אחת.
 * @param {object} p
 * @param {string} p.stageKey
 * @param {object} p.order  { isDelivery, deliveryDirection }
 * @param {object[]} p.items  פריטי ההזמנה (barcode, isTaken, takenDate, isDeleted, barcodePrefix, dressItem?)
 * @param {{delivery:string, local:string}} p.eff  effectiveSettings(...)
 * @returns {{applies:boolean, gate:'none'|'register'|'handover', when:string, kind:string, ok:boolean,
 *            total:number, required:number, registered:number, taken:number, missing:object[], complete:boolean, allTaken:boolean, requiredAllTaken:boolean}}
 */
export function evaluateGate({ stageKey, order, items, eff }) {
  const kind = orderKind(order);
  const when = (eff && eff[kind]) || 'off';
  const gate = gateTypeFor(stageKey, kind, when);
  const s = summarizeItems(items);
  return {
    applies: gate !== 'none',
    gate,
    when,
    kind,
    ok: gate === 'none' || s.complete,
    total: s.total,
    required: s.required,
    registered: s.registered,
    taken: s.taken,
    missing: s.missing,
    complete: s.complete,
    allTaken: s.allTaken,
    requiredAllTaken: s.requiredAllTaken,
  };
}

/** מה שנשלח בשורת הלו״ז (JSON): null כשאין חסימה לשלב/הזמנה - אז השורה זהה לחלוטין להיום. */
export function rowBarcodeInfo(args) {
  const g = evaluateGate(args);
  if (!g.applies) return null;
  return {
    gate: g.gate,
    when: g.when,
    required: g.required,
    registered: g.registered,
    taken: g.taken,
    missing: g.missing.length,
    complete: g.complete,
    // "העובדה" של שורת מסירה: כל הפריטים הנדרשים נלקחו (ר' decorateRowWithMark ב-marks.js: בהגדרה פעילה השורה "בוצע" לפי העובדה, והסימון = מי/מתי)
    allRequiredTaken: g.required > 0 && g.taken >= g.required,
  };
}

/** תיאור פריט חסר לחלונית / לשגיאת 409 (בלי שדות פנימיים). */
export function missingItemView(item, modelName = null) {
  return {
    orderItemId: item.id,
    model: modelName || (item.dressItem && item.dressItem.dress && item.dressItem.dress.name) || item.description || null,
    modelPrefix: itemModelPrefix(item),
    size: item.sizeText || (item.dressItem && item.dressItem.sizeText) || null,
  };
}

// ---- קלט ברקוד ----------------------------------------------------------------------------------

/** ניקוי כמו /api/returns/scan: רק [0-9A-Za-z] (תווי כיווניות/רווחים בלתי נראים נופלים). */
export function normalizeScannedBarcode(raw) {
  return String(raw ?? '').replace(/[^0-9A-Za-z]/g, '');
}

/** ברקוד שמלה שניתן לפענוח: ספרות בלבד, 5 ומעלה (lib/rentalBarcodeMatch.js); בפועל 7 בשני הגמ"חים. */
export function isDressBarcodeFormat(barcode) {
  return /^\d{5,}$/.test(String(barcode ?? ''));
}
