// "משלוח משותף" (הנחה על משלוח לכתובת זהה באותו יום אירוע) - החישוב הטהור. אין כאן Prisma, אין קריאות DB ואין imports:
// הקובץ נטען גם ב-Node טהור (scripts/shared-delivery-tests) וגם בשרת. כל הכסף מחושב באגורות שלמות (ללא שגיאות ציפה).
// מסמך התכנון והכללים: docs/shared-delivery-discount.md.
//
// הרעיון: כמה משפחות מזמינות לאותו בית (אותה חתונה) בהזמנות נפרדות. בכל "קבוצה" (אותו יום אירוע + אותה כתובת מנורמלת) משלם
// "המשלוח הראשי" את המחיר הרגיל, ושאר ההזמנות משלמות מחיר מוזל. החלוקה היא לפי כל צד (הלוך / חזור) בנפרד:
// הנחה על צד ניתנת רק כשיש עוד הזמנה בקבוצה שנוסעת באותו צד (הזמנת "הלוך" בלבד לא מוזלת בגלל "חזור" של אחרת).

// ---------------------------------------------------------------------------------------------
// נרמול טקסט עברי וכתובת
// ---------------------------------------------------------------------------------------------

// ניקוד / טעמים, תווי כיווניות, גרש / גרשיים / מירכאות (כל הווריאציות) - נמחקים כליל ("רח'" = "רח", 'החיד"א' = "החידא")
const STRIP_RE = /[֑-ׇ‎‏‪-‮⁦-⁩׳״"'`´‘’“”״׳]/g;
const FINAL_LETTERS = { 'ם': 'מ', 'ן': 'נ', 'ך': 'כ', 'ף': 'פ', 'ץ': 'צ' };

/** טקסט בסיסי לשוואה: בלי ניקוד/גרשיים, מפרידים (- _ . , ; : ( ) / \) הופכים לרווח, אותיות סופיות לרגילות, רווחים מכווצים. */
export function normalizeBasicText(value) {
  let s = String(value ?? '').normalize('NFKC').replace(STRIP_RE, '');
  s = s.toLowerCase();
  s = s.replace(/[\-‐-―_.,;:()\[\]{}\\|*+#]/g, ' ');
  s = s.replace(/[םןךףץ]/g, (c) => FINAL_LETTERS[c]);
  return s.replace(/\s+/g, ' ').trim();
}

/** מפתח עיר להשוואה (אחרי trim ונרמול). ריק = אין עיר. */
export function normalizeCityKey(city) {
  return normalizeBasicText(city);
}

// מילות "סוג רחוב" שמוסרות מתחילת שם הרחוב (רחוב X = X)
const STREET_PREFIX_WORDS = new Set(['רחוב', 'רח', 'רחב', 'שדרות', 'שד', 'שדרת', 'דרך', 'סמטת', 'סמטה']);
// סימני "דירה / קומה / כניסה" - מה שאחריהם נחתך (אותו בניין). 'ד' ו'קו' לבד לא כלולים כדי לא לפגוע בשמות רחוב.
const APARTMENT_MARKERS = new Set(['דירה', 'דיר', 'קומה', 'קומת', 'כניסה', 'כנ', 'כניסת', 'דירת']);
// מילים שהן "מספר" ולא חלק משם הרחוב
const NUMBER_WORDS = new Set(['מס', 'מספר', 'בית', 'בנין', 'בניין', 'מבנה']);
// אותיות שנחשבות כתיב מלא/חסר ולכן נמחקות בהשוואה בין שמות רחוב (יהושוע = יהושע, אליהו = אליהו)
const MATRES_RE = /[יו]/g;

function isHouseToken(tok) {
  return /^\d{1,4}[א-ת]?$/.test(tok);
}

/**
 * מפרק כתובת רחוב חופשית ל-{ street, house } מנורמלים, או null כשאי אפשר לזהות מספר בית.
 *  - cityHints: שמות ערים שמוסרים אם הם מופיעים בסוף הכתובת ("חיי יצחק 7 ביתר" עם עיר "ביתר" = "חיי יצחק 7").
 *  - דירה/קומה/כניסה והכל אחריהם נחתכים; "12/3" = בית 12 (דירה 3 אחרי הסלאש); "12א" נשאר "12א" (כניסה/בניין שונים).
 *  - בלי מספר בית אי אפשר לדעת שמדובר באותו בית => null (ההזמנה לא מצטרפת לקבוצה; מחמיר בכוונה כדי לא להעניק הנחה בטעות).
 */
export function parseStreetAddress(text, cityHints = []) {
  let t = String(text ?? '').normalize('NFKC');
  // "12/3", "12 / 3": הסלאש מפריד דירה - נחתך כולו (לפני שהוא הופך לרווח בנרמול)
  t = t.replace(/(\d{1,4}[א-ת]?)\s*[\/\\]\s*\S*/g, '$1');
  let s = normalizeBasicText(t);
  if (!s) return null;
  // מוסרים עיר שצמודה לסוף הכתובת (כמה פעמים, למקרה של שתי רמזים זהים)
  const hints = [...new Set((cityHints || []).map(normalizeCityKey).filter(Boolean))].sort((a, b) => b.length - a.length);
  let changed = true;
  while (changed) {
    changed = false;
    for (const h of hints) {
      if (s === h) return null;
      if (s.endsWith(' ' + h)) { s = s.slice(0, s.length - h.length - 1).trim(); changed = true; }
    }
  }
  let tokens = s.split(' ').filter(Boolean);
  // חיתוך מסימן דירה / קומה / כניסה והלאה
  const aptAt = tokens.findIndex((tok, i) => i > 0 && APARTMENT_MARKERS.has(tok));
  if (aptAt > 0) tokens = tokens.slice(0, aptAt);
  // מילות "מס'" וכד' לא חלק מהשם
  tokens = tokens.filter((tok) => !NUMBER_WORDS.has(tok));
  // אות כניסה נפרדת מיד אחרי המספר ("12 א") => "12א"
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (/^\d{1,4}$/.test(tokens[i]) && /^[א-ת]$/.test(tokens[i + 1]) && i + 2 === tokens.length) {
      tokens = [...tokens.slice(0, i), tokens[i] + tokens[i + 1]];
      break;
    }
  }
  // מספר הבית = הטוקן המספרי האחרון; מה שאחריו (שכונה / יישוב שנשאר) מתעלמים ממנו
  let houseIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (isHouseToken(tokens[i])) { houseIdx = i; break; }
  }
  if (houseIdx <= 0) return null; // בלי מספר, או מספר בלבד בלי שם רחוב
  let nameTokens = tokens.slice(0, houseIdx);
  while (nameTokens.length && STREET_PREFIX_WORDS.has(nameTokens[0])) nameTokens.shift();
  if (!nameTokens.length) return null;
  // ר' / רבי / הרב => רב; "ה" הידוע בראש השם הראשון נחתך ("הנטקה" = "נטקה")
  nameTokens = nameTokens.map((tok) => (tok === 'ר' || tok === 'רבי' || tok === 'הרב' ? 'רב' : tok));
  if (nameTokens[0].length >= 4 && nameTokens[0].startsWith('ה')) nameTokens[0] = nameTokens[0].slice(1);
  const street = nameTokens.join(' ').replace(MATRES_RE, '').replace(/\s+/g, ' ').trim();
  if (!street) return null;
  return { street, house: tokens[houseIdx] };
}

/**
 * מפתח הכתובת של הזמנה: עיר מנורמלת + רחוב + מספר בית. null = אי אפשר לקבץ (אין עיר / אין מספר בית).
 *  - order.deliveryAddress (כתובת משלוח מפורשת, טקסט חופשי) גובר; אחרת רחוב ומספר הבית של כרטיס הלקוח.
 *  - pricedCity: העיר שלפיה ההזמנה מחויבת (מקור העיר היחיד שנכנס למפתח; הזמנה בלי עיר מחויבת אינה משלמת משלוח ולכן אינה בקבוצה).
 */
export function buildAddressKey({ deliveryAddress, deliveryCity, customerStreet, customerHouseNum, customerCity, pricedCity }) {
  const cityKey = normalizeCityKey(pricedCity);
  if (!cityKey) return null;
  const hints = [pricedCity, deliveryCity, customerCity];
  let parsed = null;
  if (String(deliveryAddress ?? '').trim()) {
    parsed = parseStreetAddress(deliveryAddress, hints);
  } else {
    const street = String(customerStreet ?? '').trim();
    if (!street) return null;
    const house = String(customerHouseNum ?? '').trim();
    // houseNum בכרטיס הלקוח יכול להיות "12", "12א", "12/3"; אם הרחוב כבר נושא מספר (ואין houseNum) מפרקים אותו כמו שהוא
    parsed = parseStreetAddress(house ? `${street} ${house}` : street, hints);
  }
  if (!parsed) return null;
  return `${cityKey}|${parsed.street}|${parsed.house}`;
}

// ---------------------------------------------------------------------------------------------
// צדדים (הלוך / חזור) וקבוצות
// ---------------------------------------------------------------------------------------------

/** הצדדים של הזמנה לפי כיוון המשלוח (חסר = הלוך-חזור, כמו ב-applyDeliveryCharge). */
export function legsOf(direction) {
  const d = direction || 'הלוך-חזור';
  if (d === 'הלוך') return ['out'];
  if (d === 'חזור') return ['ret'];
  return ['out', 'ret'];
}

// מפתח צד: הלוך מתפצל ל"יוצא יום לפני" (יום יציאה אחר => לא אותה נסיעה). חזור - נסיעה אחת ביום.
function legBucket(leg, oneDayBefore) {
  return leg === 'out' ? (oneDayBefore ? 'out-1' : 'out') : 'ret';
}

const ORDER_SORT_LAST = Number.MAX_SAFE_INTEGER;
function sortKeyOf(m) {
  const raw = m.orderDateMs;
  const t = raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : ORDER_SORT_LAST;
  return [t, Number(m.orderId)];
}
/** סדר "מי נרשם ראשון": זמן רישום ההזמנה (orderDate), ובשוויון / חוסר - מספר הזמנה. */
export function compareByRegistration(a, b) {
  const [ta, ia] = sortKeyOf(a);
  const [tb, ib] = sortKeyOf(b);
  if (ta !== tb) return ta - tb;
  return ia - ib;
}

/**
 * תכנון הנחות לקבוצה אחת (כל החברים באותו יום ובאותה כתובת מנורמלת).
 * members: [{ orderId, orderDateMs, direction, oneDayBefore, primaryFlag }]  (primaryFlag = סומן ידנית כ"משלוח ראשי")
 * מחזיר { primaryOrderId, shared, perOrder: Map(orderId -> { isPrimary, discountedLegs: ['out'|'ret'], legPayers: {out?:id, ret?:id}, sharedWith: [ids] }) }.
 * כללים:
 *  - הראשי = המסומן ידנית (אם כמה מסומנים - הראשון בסדר הרישום); בלי סימון = ההזמנה שנרשמה ראשונה.
 *  - לכל צד: אם הראשי נוסע בצד הזה - הוא המשלם המלא; אחרת הראשון בסדר הרישום מבין הנוסעים בצד. כל השאר בצד = מוזל.
 *  - צד שרק הזמנה אחת נוסעת בו = מחיר רגיל (אין עם מי לחלוק).
 * כפילויות orderId בקלט מתעלמים (הראשונה נשארת).
 */
export function planSharedGroup(members) {
  const seen = new Set();
  const list = [];
  for (const m of members || []) {
    const id = Number(m.orderId);
    if (!Number.isInteger(id) || seen.has(id)) continue;
    seen.add(id);
    list.push({ ...m, orderId: id });
  }
  list.sort(compareByRegistration);
  const perOrder = new Map();
  if (list.length === 0) return { primaryOrderId: null, shared: false, perOrder };
  const flagged = list.find((m) => m.primaryFlag);
  const primaryOrderId = (flagged || list[0]).orderId;
  for (const m of list) perOrder.set(m.orderId, { isPrimary: m.orderId === primaryOrderId, discountedLegs: [], legPayers: {}, sharedWith: [] });
  if (list.length < 2) return { primaryOrderId, shared: false, perOrder };

  const buckets = new Map(); // bucket -> members that travel that leg (registration order)
  for (const m of list) {
    for (const leg of legsOf(m.direction)) {
      const b = legBucket(leg, !!m.oneDayBefore);
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push({ ...m, leg });
    }
  }
  let anyShared = false;
  for (const [, travellers] of buckets) {
    if (travellers.length < 2) continue;
    anyShared = true;
    const payer = travellers.find((t) => t.orderId === primaryOrderId) || travellers[0];
    for (const t of travellers) {
      const info = perOrder.get(t.orderId);
      info.legPayers[t.leg] = payer.orderId;
      if (t.orderId !== payer.orderId) info.discountedLegs.push(t.leg);
      for (const other of travellers) if (other.orderId !== t.orderId && !info.sharedWith.includes(other.orderId)) info.sharedWith.push(other.orderId);
    }
  }
  for (const info of perOrder.values()) info.discountedLegs.sort();
  return { primaryOrderId, shared: anyShared, perOrder };
}

/**
 * קיבוץ רשימת הזמנות-מועמדות לקבוצות לפי addressKey (+ יום האירוע). members: [{ orderId, dayKey, addressKey, ... }].
 * חברים בלי addressKey / בלי dayKey אינם בשום קבוצה. מחזיר Map(groupKey -> members[]).
 */
export function groupCandidates(members) {
  const groups = new Map();
  for (const m of members || []) {
    if (!m || !m.addressKey || !m.dayKey) continue;
    const key = `${m.dayKey}|${m.addressKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return groups;
}

// ---------------------------------------------------------------------------------------------
// מחירים (באגורות שלמות)
// ---------------------------------------------------------------------------------------------

const toAgorot = (n) => Math.round(Number(n) * 100);
const fromAgorot = (a) => a / 100;

/** מספר >= 0 סופי, אחרת null (מחרוזת ריקה / NaN / שלילי = לא מוגדר). */
export function parseNonNegativePrice(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const n = Number(typeof raw === 'string' ? raw.trim() : raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** פירוק טבלת JSON של מחירים לפי עיר => { [cityTrimmed]: number }. פגום / לא אובייקט => {}. ערכים לא תקינים נשמטים. */
export function parsePriceMap(rawJson) {
  let obj = {};
  try { obj = typeof rawJson === 'string' ? JSON.parse(rawJson || '{}') : (rawJson || {}); } catch { obj = {}; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = parseNonNegativePrice(v);
    if (n !== null && String(k).trim()) out[String(k).trim()] = n;
  }
  return out;
}

/**
 * המחיר המוזל לצד אחד בעיר נתונה, לפי ההגדרות. null = לא מוגדר (אין הנחה).
 *  mode 'by_city': טבלת מחירים מוזלים לפי עיר, ואם אין לעיר ערך - נופלים למחיר הגלובלי; mode אחר / חסר = גלובלי בלבד.
 * מחיר 0 חוקי (משלוח מצורף ללא עלות). ערך ריק / לא מספר / שלילי = לא מוגדר.
 */
export function resolveSharedDiscountPrice({ mode, globalPrice, priceByCity, city }) {
  const global = parseNonNegativePrice(globalPrice);
  if (mode === 'by_city') {
    const map = typeof priceByCity === 'object' && priceByCity && !Array.isArray(priceByCity) ? priceByCity : parsePriceMap(priceByCity);
    const c = String(city ?? '').trim();
    if (c && Object.prototype.hasOwnProperty.call(map, c)) {
      const v = parseNonNegativePrice(map[c]);
      if (v !== null) return v;
    }
    return global;
  }
  return global;
}

/**
 * סכום חיוב המשלוח של הזמנה: לכל צד - מלא או מוזל. המחיר המוזל לעולם לא עולה על הרגיל (min).
 *  regularPerLeg - המחיר הרגיל לצד (ל-city הזו; אחרי נפילה לאחידה/50); discountedPerLeg - null = אין הנחה.
 * מחזיר { amount, quantity, fullLegs, discountedLegs, regularAmount } (amount ו-regularAmount בשקלים, מדויקים לאגורה).
 */
export function computeLegAmounts({ direction, regularPerLeg, discountedPerLeg = null, discountedLegs = [] }) {
  const legs = legsOf(direction);
  const reg = toAgorot(regularPerLeg);
  const disc = discountedPerLeg === null || discountedPerLeg === undefined ? null : Math.min(toAgorot(discountedPerLeg), reg);
  const discSet = new Set(disc === null ? [] : discountedLegs);
  let total = 0;
  const appliedDiscounted = [];
  const full = [];
  for (const leg of legs) {
    if (discSet.has(leg)) { total += disc; appliedDiscounted.push(leg); } else { total += reg; full.push(leg); }
  }
  return {
    amount: fromAgorot(total),
    quantity: legs.length,
    fullLegs: full,
    discountedLegs: appliedDiscounted,
    regularAmount: fromAgorot(reg * legs.length),
  };
}

export const SHARED_DELIVERY_DESCRIPTION_SUFFIX = ' (משלוח משותף - מחיר מוזל)';

/** תיאור שורת החיוב: הרגיל + סיומת כשיש הנחה בפועל. "משלוח" נשאר בתחילת התיאור (הקוד הקיים מזהה חיוב משלוח לפי המילה). */
export function sharedDeliveryDescription(baseDescription, discounted) {
  return discounted ? `${baseDescription}${SHARED_DELIVERY_DESCRIPTION_SUFFIX}` : baseDescription;
}

export function isSharedDeliveryDescription(description) {
  return String(description ?? '').includes(SHARED_DELIVERY_DESCRIPTION_SUFFIX.trim());
}

/**
 * הסכום ששמור ב-Order.totalAmount אחרי שינוי סכום חיוב המשלוח (כללי הזהירות בשינוי כסף):
 *  - totalAmount ריק / 0 => נשאר כמו שהוא (syncPendingCreditRefund ממילא נופל לסכום ההתחייבויות).
 *  - totalAmount שווה לסכום ההתחייבויות הפעילות (כולל משלוח) => מוסיפים את ההפרש.
 *  - totalAmount שווה לסכום בלי חיוב המשלוח (הבאג הידוע: recalc שומר סכום בלי משלוח) => מתקנים לסכום כולל המשלוח החדש.
 *  - לא תואם לאף אחד => מוסיפים את ההפרש (best effort) ומסמנים mismatch כדי שהקורא יתעד.
 * obligationsSumBefore - סכום כל ההתחייבויות הפעילות לפני השינוי (כולל חיוב המשלוח הישן); deliveryOld/deliveryNew - סכומי המשלוח.
 */
export function computeStoredTotalAfterDeliveryChange({ storedTotal, obligationsSumBefore, deliveryOld, deliveryNew }) {
  const total = Number(storedTotal);
  if (!Number.isFinite(total) || total <= 0) return { total: storedTotal ?? null, mode: 'untouched', mismatch: false };
  const before = toAgorot(obligationsSumBefore);
  const dOld = toAgorot(deliveryOld);
  const dNew = toAgorot(deliveryNew);
  const t = toAgorot(total);
  const after = before - dOld + dNew;
  if (t === before) return { total: fromAgorot(after), mode: 'included', mismatch: false };
  if (t === before - dOld) return { total: fromAgorot(after), mode: 'excluded-normalised', mismatch: false };
  return { total: fromAgorot(t - dOld + dNew), mode: 'delta', mismatch: true };
}
