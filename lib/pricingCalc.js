import { findPriceRowForSize, normalizeGapRule } from './priceRows';

// יום קלנדרי בישראל (Asia/Jerusalem) כמספר ימים מאז 1970 - כדי שהפרש "ימי לוח" בין
// תאריך האירוע להיום לא יושפע מאזור הזמן של השרת (Vercel רץ ב-UTC). זהה בכוונה לשיטה של
// toIsraelCalendarDate ב-lib/hebrewDate.js - שם לא מייבאים כי הקובץ הזה חייב להיטען
// ב-Node טהור, בלי alias '@/' וללא ספריות חיצוניות.
function israelDayNumber(dateInput) {
  if (!dateInput) return null;
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
  const [y, m, day] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, day) / 86400000;
}

/**
 * Pure calculation of an order's obligations from already-fetched data.
 * No DB access here - callers are responsible for fetching order/items/priceList/settings/deletedItems.
 * Follows the logic from the Access VBA 'שמלות_תשלום_רישום'.
 */
export function computeOrderObligations({ order, items, deletedItems, priceList, settings, customNote = null }) {
  const getSetting = (key, def) => {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : def;
  };
  // מספר לא-שלילי מהגדרה; שורה חסרה / ריקה / לא מספרית = null (התנהגות legacy של אותה הגדרה).
  const getNonNegativeNumber = (key) => {
    const setting = settings.find(s => s.key === key);
    if (!setting || setting.value === null || setting.value === undefined) return null;
    const raw = String(setting.value).trim();
    if (raw === '') return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const refundDaysFromOrder = parseFloat(getSetting('REFUND_DAYS_FROM_ORDER', '7'));
  const noRefundDaysBeforeEvent = parseFloat(getSetting('NO_REFUND_DAYS_BEFORE_EVENT', '7'));
  // ברירת המחדל כשההגדרה חסרה לגמרי היא 50%, לא 100% - תואם את מדיניות ההחזר המתועדת
  // ב-app/admin/refund-policy/page.js (שינוי 04.08.2026 מ-100% ל-50%), לא רק ערך שרירותי.
  const refundPercentage = parseFloat(getSetting('REFUND_PERCENTAGE', '50')) / 100;
  const refundRepairs = getSetting('REFUND_REPAIRS', 'false') === 'true';
  const enableSetDiscounts = getSetting('ENABLE_SET_DISCOUNTS', 'false') === 'true';
  // חלון "דמי ביטול הופכים לזיכוי על פריט חלופי" בלבד (0 או ערך לא תקין = הפיצ'ר כבוי).
  const cancellationCreditMinutes = parseFloat(getSetting('CANCELLATION_CREDIT_MINUTES', '15'));
  // חלון "ביטול מיידי" (פריט שנוסף ובוטל תוך N דקות נחשב כאילו לא נוסף). ריק/חסר = נופל לערך
  // של CANCELLATION_CREDIT_MINUTES, בדיוק כמו שהיה לפני שההגדרה נפרדה (legacy).
  const instantUndoSetting = getNonNegativeNumber('instant_undo_minutes');
  const instantUndoMinutes = instantUndoSetting !== null ? instantUndoSetting : cancellationCreditMinutes;
  // בקשה מפורשת של נווה יעקב (2026-09-15) - כבויה כברירת מחדל, כך שגמחים אחרים ממשיכים
  // עם מדיניות "זיכוי דמי ביטול על פריט חלופי" הרגילה (creditCandidates/isCreditEligible
  // למטה) ללא שינוי.
  const sameModelSwapNoFee = getSetting('same_model_swap_no_fee', 'false') === 'true';
  // תנאי ההחלפה (רלוונטיים רק כש-same_model_swap_no_fee דלוקה). ברירות המחדל = legacy.
  const swapMinDaysBeforeEvent = getNonNegativeNumber('swap_min_days_before_event') || 0;
  const swapSameCategoryOnly = getSetting('swap_same_category_only', 'false') === 'true';
  const swapPairingWindowMinutes = getNonNegativeNumber('swap_pairing_window_minutes') || 0;
  // כלל "מידה שבין טווחי מחיר" (ר' lib/priceRows.js) - none/cheaper.
  const gapRule = normalizeGapRule(getSetting('gap_size_price_rule', 'none'));
  // מדרגות ההחזר (החזר מלא / אחוז / אין החזר) נקבעות לפי רגע המחיקה ולא לפי "היום": כך ביטול
  // שבוצע 20 יום לפני האירוע נשאר ב-50% גם כשההזמנה מחושבת מחדש (תשלום, שמירה) בתוך חלון "אין החזר".
  // ברירת מחדל כבוי = כמו תמיד (לפי הרגע שבו החישוב רץ).
  const refundTiersAtDeletion = getSetting('refund_tiers_at_deletion_time', 'false') === 'true';

  // Abroad markup
  let abroadMarkup = 1;
  if (order.isAbroad) {
    const abroadPrice = priceList.find(p => p.category === 'חול' || p.category === 'חו"ל');
    if (abroadPrice && abroadPrice.price) {
      abroadMarkup = (abroadPrice.price / 100) + 1; // Assuming it's a percentage (e.g. 10%)
    }
  }

  // Map of generated obligations
  const newObligations = [];

  // -- Set Discounts Logic --
  // Count how many "main" dresses we have to allow discounting accessories
  let mainDressesCount = 0;
  if (enableSetDiscounts) {
    for (const item of items) {
      const category = item.dressItem?.dress?.priceCategory || '';
      if (!category.includes('כלול ב')) {
        mainDressesCount += (item.quantity || 1);
      }
    }
  }

  let totalValid = 0;

  for (const item of items) {
    if (!item.dressItem || !item.dressItem.dress) continue;
    const category = item.dressItem.dress.priceCategory || '';
    const isPremiumItem = !!item.dressItem.dress.isPremium;
    const size = parseInt(item.sizeText || '0');

    // 35/36 - פרימיום: אם premium_pricing_enabled מופעל והדגם מסומן פרימיום - מחפש קודם קטגוריית פרימיום (אם לא נמצא - נופל לרגיל)
    let effectiveCategory = category;
    const premiumEnabled = settings.find(s => s.key === 'premium_pricing_enabled')?.value === 'true';
    if (premiumEnabled && isPremiumItem) {
      const premiumCats = (settings.find(s => s.key === 'premium_categories')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
      // בוחרים את קטגוריית הפרימיום הראשונה (לפי הסדר בהגדרה) שקיימת בכלל עבורה שורת מחיר
      // כלשהי במחירון. ההתאמה המדויקת לפי מידה/תאריך מתבצעת למטה ב-priceMatch - אם היא
      // לא תניב תוצאה עבור קטגוריית הפרימיום שנבחרה, המחיר ייפול חזרה לקטגוריה הרגילה של
      // הדגם (category), בדיוק כפי שקורה היום עבור פריטים שאינם פרימיום.
      const foundPremiumCat = premiumCats.find(pc => priceList.some(p => p.category === pc));
      if (foundPremiumCat) effectiveCategory = foundPremiumCat;
    }

    // חיפוש שורת מחיר לפי מידה בקטגוריה נתונה (כולל סינון לפי תאריך האירוע וכלל המידות
    // שבין הטווחים) - דרך המנגנון המשותף lib/priceRows.js, אותו כלל שבו משתמש המחירון.
    const priceMatch = (cat) => findPriceRowForSize(priceList, cat, size, { eventDate: order.eventDate, gapRule });

    // Priority: premium category (only when it differs from the regular one, i.e. isPremium
    // actually resolved to a premium tier above) -> regular category -> 'כלול ב' variant.
    // התאמה ישירה בכל אחת משלוש הרמות גוברת על התאמה "מבין הטווחים" (gapRule) - כך שכלל
    // המידות שבין הטווחים של קטגוריית פרימיום לעולם לא דורס שורה רגילה שמתאימה ישירות.
    // כש-gapRule כבוי אין תוצאות viaGap בכלל, והסדר זהה בדיוק למה שהיה.
    const lookups = [
      effectiveCategory !== category ? priceMatch(effectiveCategory) : null,
      priceMatch(category),
      priceMatch(category.replace('כלול ב', '').trim())
    ];
    const matchedPrice =
      lookups.find(r => r && r.row && !r.viaGap)?.row
      || lookups.find(r => r && r.row)?.row
      || null;

    let basePrice = matchedPrice ? matchedPrice.price : 0;

    // Apply Set Discounts (מבצע סטים)
    let isDiscountedSet = false;
    if (enableSetDiscounts && category.includes('כלול ב') && mainDressesCount > 0) {
      const qty = item.quantity || 1;
      if (mainDressesCount >= qty) {
        mainDressesCount -= qty;
        basePrice = 0; // Discounted!
        isDiscountedSet = true;
      } else {
        mainDressesCount -= 1;
        basePrice = 0;
        isDiscountedSet = true;
      }
    }

    let finalPrice = basePrice * abroadMarkup;

    const isPending = !order.legacyId && item.cartStatus === 'pending';

    let desc = item.dressItem.dress.name + (item.sizeText ? ` מידה ${item.sizeText}` : '') + ` (פריט #${item.id})`;
    if (isDiscountedSet) desc += ' (חינם בסט)';
    if (customNote) desc += ` - ${customNote}`;

    newObligations.push({
      orderId: order.orderId,
      productId: matchedPrice ? matchedPrice.id : null,
      amount: finalPrice,
      quantity: item.quantity || 1,
      description: desc,
      isManual: false,
      orderItemId: item.id,
      isDraft: isPending
    });
    totalValid += finalPrice;

    // Repairs calculation
    let repairsTotal = 0;
    if (item.neckAlteration) {
      const neckPriceObj = priceList.find(p => p.category === 'תיקונים' && p.description === 'תיקון צוואר');
      const neckCost = neckPriceObj ? neckPriceObj.price : 0;
      repairsTotal += neckCost;
      newObligations.push({
        orderId: order.orderId,
        productId: neckPriceObj ? neckPriceObj.id : null,
        amount: neckCost,
        quantity: item.quantity || 1,
        description: `תיקון צוואר - ${item.dressItem.dress.name} (פריט #${item.id})`,
        isManual: false,
        orderItemId: item.id,
        isDraft: isPending
      });
      totalValid += neckCost;
    }

    if (item.sleeveAlteration) {
      const sleevePriceObj = priceList.find(p => p.category === 'תיקונים' && p.description === 'תיקון שרוול');
      const sleeveCost = sleevePriceObj ? sleevePriceObj.price : 0;
      repairsTotal += sleeveCost;
      newObligations.push({
        orderId: order.orderId,
        productId: sleevePriceObj ? sleevePriceObj.id : null,
        amount: sleeveCost,
        quantity: item.quantity || 1,
        description: `תיקון שרוול - ${item.dressItem.dress.name} (פריט #${item.id})`,
        isManual: false,
        orderItemId: item.id,
        isDraft: isPending
      });
      totalValid += sleeveCost;
    }

    if (item.lengthAlteration && String(item.lengthAlteration).trim() !== '') {
      const lengthPriceObj = priceList.find(p => p.category === 'תיקון אורך' && size >= (p.fromSize || 0) && (p.toSize === null || size <= p.toSize));
      const lengthCost = lengthPriceObj ? lengthPriceObj.price : 0;
      repairsTotal += lengthCost;
      newObligations.push({
        orderId: order.orderId,
        productId: lengthPriceObj ? lengthPriceObj.id : null,
        amount: lengthCost,
        quantity: item.quantity || 1,
        description: `תיקון אורך - ${item.dressItem.dress.name} (פריט #${item.id})`,
        isManual: false,
        orderItemId: item.id,
        isDraft: isPending
      });
      totalValid += lengthCost;
    }
  }

  // יום השכרה נוסף (extraDay: 'before'/'after') - תוספת של 50% מסך ההזמנה (totalValid
  // שנצבר עד כה מכל הפריטים+תיקונים, לפני זיכויי ביטול), מחושבת אוטומטית בכל הרצה מחדש.
  // מוגבל בצד ה-UI להזמנות עם תאריכים מפורשים (isAbroad/isWeekdayEvent) - ר' ModernGeneralDetails.
  if (order.extraDay === 'before' || order.extraDay === 'after') {
    const extraDayAmount = totalValid * 0.5;
    if (extraDayAmount > 0) {
      newObligations.push({
        orderId: order.orderId,
        productId: null,
        amount: extraDayAmount,
        quantity: 1,
        description: `תוספת יום השכרה נוסף (${order.extraDay === 'before' ? 'לפני התקופה' : 'אחרי התקופה'}) - 50%`,
        isManual: false,
        orderItemId: null,
        isDraft: false
      });
      totalValid += extraDayAmount;
    }
  }

  // Cancellations (זיכויים) logic - handling deleted items
  const eventDate = order.eventDate ? new Date(order.eventDate) : new Date();
  const orderDate = order.orderDate || new Date(); // Use orderDate to check full refund window
  const currentDate = new Date();

  const fullRefundCutoff = new Date(orderDate);
  fullRefundCutoff.setDate(fullRefundCutoff.getDate() + refundDaysFromOrder);

  const noRefundCutoff = new Date(eventDate);
  noRefundCutoff.setDate(noRefundCutoff.getDate() - noRefundDaysBeforeEvent);

  // רגע ההתייחסות של פריט מחוק למדרגות ההחזר (ר' refundTiersAtDeletion למעלה).
  const refundReferenceDate = (delItem) => {
    if (refundTiersAtDeletion && delItem.deletedAt) {
      const d = new Date(delItem.deletedAt);
      if (!isNaN(d.getTime())) return d;
    }
    return currentDate;
  };

  // Cancellation-fee credit: a fee can be redirected toward another item in the same order
  // instead of being pure loss, if that item was added at/after the cancellation and the
  // cancellation is still within CANCELLATION_CREDIT_MINUTES. `deletedAt` is stamped at save
  // time (not when the item was toggled off in the UI), so a cancel+add done in one sitting
  // always shares one "now" and passes this check regardless of how long the sitting took -
  // see app/api/orders/[id]/route.js's PUT handler for where that stamp happens. This is the
  // default policy for every gemach except one with same_model_swap_no_fee enabled above.
  const itemChargeRemaining = new Map();
  for (const ob of newObligations) {
    if (ob.orderItemId && ob.amount > 0) {
      itemChargeRemaining.set(ob.orderItemId, (itemChargeRemaining.get(ob.orderItemId) || 0) + ob.amount);
    }
  }
  const creditCandidates = [...items]
    .filter(i => i.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const sortedDeletedItems = [...deletedItems].sort((a, b) => {
    const ta = a.deletedAt ? new Date(a.deletedAt).getTime() : Infinity;
    const tb = b.deletedAt ? new Date(b.deletedAt).getTime() : Infinity;
    return ta - tb;
  });

  // פריטים שמקורם ב-Access (legacyId) מקבלים כולם, ללא יוצא מן הכלל, אותו createdAt -
  // רגע הרצת סקריפט הייבוא (ראו scripts/import_all_data.js) - ולא את המועד שבו הפריט
  // באמת נוסף להזמנה בזמנו. תאריך כזה לא אומר כלום על "כמה זמן חי הפריט", ומינוף שלו
  // ישירות בבדיקת "ביטול מיידי" למטה עובד נכון היום רק במקרה (מפני שהייבוא רץ מעל 15
  // דקות לפני כל ביטול בפועל) - הרצה חוזרת עתידית של סקריפט ייבוא/תיקון נתונים הייתה
  // מאפסת שוב את ה-createdAt של כל הפריטים המיובאים ל"עכשיו", והופכת כל ביטול של פריט
  // ישן שבוצע תוך 15 דקות מריצת הסקריפט ל"ביטול מיידי" שגוי - בלי חיוב מקורי, בלי זיכוי
  // ובלי דמי ביטול, על פריט אמיתי שהיה קיים שנים. עבור פריט legacy אנחנו מעדיפים אפוא את
  // תאריך ההזמנה האמיתי (ברמת הפריט, ואם חסר - ברמת ההזמנה, ששניהם מיובאים כראוי
  // ומייצגים תאריך היסטורי אמיתי) כנקודת הייחוס - כך שהחלון של 15 הדקות לעולם לא ייפתח
  // בטעות לפריט legacy ותיק, ללא תלות בזמן שחלף מאז שהייבוא האחרון רץ.
  const getItemAddReference = (item) => {
    if (item.legacyId) {
      return item.orderDate || order.orderDate || null;
    }
    return item.createdAt || null;
  };

  // "ביטול מיידי": פריט שכל חייו - מהוספה ועד מחיקה - התרחשו בתוך חלון instant_undo_minutes
  // (ואם לא הוגדרה - CANCELLATION_CREDIT_MINUTES) נחשב כאילו מעולם לא נוסף - בלי חיוב מקורי,
  // בלי זיכוי ובלי דמי ביטול, ללא קשר לחלונות הזמן הרגילים של ההזמנה. 0 = כבוי.
  const isInstantUndo = (delItem) => {
    if (!Number.isFinite(instantUndoMinutes) || instantUndoMinutes <= 0) return false;
    const addReference = getItemAddReference(delItem);
    if (!addReference || !delItem.deletedAt) return false;
    const lifetimeMs = new Date(delItem.deletedAt).getTime() - new Date(addReference).getTime();
    return lifetimeMs >= 0 && lifetimeMs <= instantUndoMinutes * 60000;
  };

  // ---- החלפת מידה לאותו דגם (מאחורי same_model_swap_no_fee) ----
  // פריט שנמחק ופריט פעיל אחר של אותו דגם (DressModel) מתפקדים כזוג "החלפה" - הלקוח/ה
  // משלמ/ת רק את ההפרש בין המידות, בלי דמי ביטול, ללא תלות בחלון הזמן/במדיניות הביטול
  // הרגילה (ר' בקשה בדיווח 87ba8e3d). פריט פעיל משמש כתחליף לפריט מחוק אחד לכל היותר.
  // ההחלפה נקבעת מראש, לכל הפריטים המחוקים יחד, כדי שפריט פעיל יינצל רק כשההחלפה באמת
  // אושרה: פריט שנפסל (רחוק מדי מהאירוע / קטגוריית מחיר אחרת / מחוץ לחלון הזיווג) לא
  // "אוכל" פריט מהמאגר וחוזר לחלוטין לזרימת הביטול הרגילה למטה (שלוש מדרגות + זיכוי
  // דמי ביטול אם החלון פתוח). החלפת דגם (דגם שונה) ממשיכה לפי מדיניות הביטול הרגילה.
  const swapPairs = new Map(); // פריט מחוק -> הפריט הפעיל שמחליף אותו
  if (sameModelSwapNoFee) {
    const sizeOf = (it) => parseInt(it.sizeText || '0');
    const bandOf = (it) => findPriceRowForSize(
      priceList, it.dressItem.dress.priceCategory || '', sizeOf(it), { eventDate: order.eventDate, gapRule }
    );
    // אותה שורת מחיר; ואם לשתיהן אין שורה כלל - אותה קטגוריה ואותה מידה (החלפת פריט
    // פיזי באותה מידה בדיוק תמיד נחשבת אותה קטגוריית מחיר).
    const isSameBand = (a, b) => {
      const ra = bandOf(a);
      const rb = bandOf(b);
      if (ra.row && rb.row) return ra.row.id !== undefined && ra.row.id === rb.row.id;
      if (!ra.row && !rb.row) {
        return (a.dressItem.dress.priceCategory || '') === (b.dressItem.dress.priceCategory || '')
          && sizeOf(a) === sizeOf(b);
      }
      return false;
    };
    // ימי לוח (לפי תאריך ישראלי) שנותרו מרגע המחיקה ועד האירוע. הבדיקה נעשית ברגע המחיקה
    // (deletedAt) ולא ב"היום" - כדי שהחלפה שבוצעה כדין לא תהפוך לביטול עם דמי ביטול
    // כשההזמנה מחושבת מחדש (למשל בתשלום) יום לפני האירוע. תאריך אירוע חסר = לא חסום.
    const passesMinDays = (delItem) => {
      if (!(swapMinDaysBeforeEvent > 0) || !order.eventDate) return true;
      const eventDay = israelDayNumber(order.eventDate);
      const refDay = israelDayNumber(delItem.deletedAt || currentDate);
      if (eventDay === null || refDay === null) return true;
      return (eventDay - refDay) >= swapMinDaysBeforeEvent;
    };

    const eligibleDeleted = sortedDeletedItems.filter(d =>
      d.dressItem?.dress?.id && !isInstantUndo(d) && passesMinDays(d)
    );
    const activeByModel = new Map(); // לפי סדר הפריטים בהזמנה
    for (const it of items) {
      const modelId = it.dressItem?.dress?.id;
      if (!modelId) continue;
      if (!activeByModel.has(modelId)) activeByModel.set(modelId, []);
      activeByModel.get(modelId).push(it);
    }
    const claimedActive = new Set();

    if (swapPairingWindowMinutes > 0) {
      // זיווג לפי קרבה בזמן: פריט מחוק מזווג רק עם "יורש" מאותו דגם שנוצר בטווח N דקות מרגע
      // המחיקה, ושנוסף בפועל באותה מחיקה או אחריה (לא לפני) - אחרת שני פריטים נפרדים מאותו
      // דגם שנוספו יחד להזמנה (למשל 2 מידות לאותה משפחה) והאחד מהם בוטל מאוחר יותר היו
      // מזווגים בטעות כ"החלפה" עם השני, למרות ששניהם קיימים במקביל ולא הוחלפו זה בזה - זה
      // גרם לזיכוי מלא במקום דמי ביטול הרגילים (ר' דיווח bb3978c5, הזמנה #53375). יורש הוא
      // פריט פעיל שנוסף בזמן המחיקה או אחריה, או פריט שנמחק בעצמו מאוחר יותר (שרשרת החלפות:
      // 34→36 ואחריה 36→38 - הפריט האמצעי הוא יורש של הראשון וגם מוחלף בשלישי; וכן החלפה
      // שבוטלה אחר כך - ההחלפה עצמה חינם והביטול הבא נגבה כביטול רגיל, בלי כפל). מזווגים
      // קודם את הזוגות הקרובים ביותר בזמן, כדי שיורש לא ייגנב על ידי מחיקה רחוקה יותר.
      // פריט מחוק מיובא (legacy) נמדד לפי deletedAt האמיתי שלו, אבל יורש legacy לעולם לא
      // מזווג - ה-createdAt שלו הוא רגע הייבוא ולא מועד הוספה אמיתי.
      const windowMs = swapPairingWindowMinutes * 60000;
      const candidatePairs = [];
      eligibleDeleted.forEach((d, di) => {
        if (!d.deletedAt) return;
        const delTime = new Date(d.deletedAt).getTime();
        if (isNaN(delTime)) return;
        const modelId = d.dressItem.dress.id;
        const dCreated = d.createdAt ? new Date(d.createdAt).getTime() : null;
        const successors = [
          ...(activeByModel.get(modelId) || []).filter(a =>
            a.createdAt && new Date(a.createdAt).getTime() >= delTime
          ),
          ...sortedDeletedItems.filter(o =>
            o !== d && o.dressItem?.dress?.id === modelId && !isInstantUndo(o)
            // יורש שנמחק חייב להיווצר אחרי הפריט שהוא מחליף (מונע זיווג הדדי)
            && (d.legacyId || dCreated === null || !o.createdAt || new Date(o.createdAt).getTime() >= dCreated)
          ),
        ];
        successors.forEach((a, ai) => {
          if (a.legacyId || !a.createdAt) return;
          const distance = Math.abs(new Date(a.createdAt).getTime() - delTime);
          if (isNaN(distance) || distance > windowMs) return;
          if (swapSameCategoryOnly && !isSameBand(d, a)) return;
          candidatePairs.push({ d, a, distance, di, ai });
        });
      });
      candidatePairs.sort((x, y) => x.distance - y.distance || x.di - y.di || x.ai - y.ai);
      for (const { d, a } of candidatePairs) {
        if (swapPairs.has(d) || claimedActive.has(a)) continue;
        swapPairs.set(d, a);
        claimedActive.add(a);
      }
    } else {
      // ללא חלון זיווג (legacy): כל פריט פעיל מאותו דגם שעוד לא נוצל, לפי סדר הפריטים בהזמנה.
      for (const d of eligibleDeleted) {
        const a = (activeByModel.get(d.dressItem.dress.id) || [])
          .find(cand => !claimedActive.has(cand) && (!swapSameCategoryOnly || isSameBand(d, cand)));
        if (!a) continue;
        swapPairs.set(d, a);
        claimedActive.add(a);
      }
    }
  }

  for (const delItem of sortedDeletedItems) {
    if (!delItem.dressItem || !delItem.dressItem.dress) continue;

    if (isInstantUndo(delItem)) continue;

    const category = delItem.dressItem.dress.priceCategory || '';
    const size = parseInt(delItem.sizeText || '0');

    // פריט מחוק - בלי סינון לפי תאריך אירוע (כמו תמיד), אבל עם כלל המידות שבין הטווחים.
    const matchedPrice = findPriceRowForSize(priceList, category, size, { gapRule }).row;
    let basePrice = matchedPrice ? matchedPrice.price : 0;

    let repairsTotal = 0;
    if (delItem.neckAlteration) {
      const p = priceList.find(p => p.category === 'תיקונים' && p.description === 'תיקון צוואר');
      repairsTotal += p ? p.price : 0;
    }
    if (delItem.sleeveAlteration) {
      const p = priceList.find(p => p.category === 'תיקונים' && p.description === 'תיקון שרוול');
      repairsTotal += p ? p.price : 0;
    }
    if (delItem.lengthAlteration && String(delItem.lengthAlteration).trim() !== '') {
      const p = priceList.find(p => p.category === 'תיקון אורך' && size >= (p.fromSize || 0) && (p.toSize === null || size <= p.toSize));
      repairsTotal += p ? p.price : 0;
    }

    let itemBaseValue = basePrice * abroadMarkup;
    let itemLost = refundRepairs ? 0 : repairsTotal;
    let itemRefundableValue = itemBaseValue + (refundRepairs ? repairsTotal : 0);

    // החלפת מידה לאותו דגם (ר' swapPairs למעלה) - זיכוי מלא על השמלה, בלי דמי ביטול,
    // ללא תלות במדיניות/בחלון הזמן הרגילים. תיקונים (itemLost) ממשיכים להיות חיוב קבוע
    // כרגיל - לא נדונו בבקשה. פריט שלא אושר כהחלפה נופל לזרימת הביטול הרגילה למטה.
    const isSameModelSwap = swapPairs.has(delItem);

    const tierDate = refundReferenceDate(delItem);
    const isFullRefund = tierDate <= fullRefundCutoff;
    const isNoRefund = tierDate >= noRefundCutoff;

    let R = 0; // Cash Refund
    if (isSameModelSwap) {
      R = itemRefundableValue;
    } else if (isNoRefund) {
      // isNoRefund (proximity to the event) is checked first: if the order itself was placed
      // less than NO_REFUND_DAYS_BEFORE_EVENT before the event, isFullRefund's order-date window
      // can still be "open" (it counts from orderDate, not eventDate) - without this priority an
      // order made 3 days before an imminent event would wrongly qualify for a full refund just
      // because it's within REFUND_DAYS_FROM_ORDER of itself. Event proximity always wins.
      R = 0;
    } else if (isFullRefund) {
      R = itemRefundableValue;
    } else {
      if (matchedPrice && matchedPrice.deposit !== null && matchedPrice.deposit > 0) {
        // [החזר] is the cash refund amount they get
        R = matchedPrice.deposit * abroadMarkup + (refundRepairs ? repairsTotal : 0);
      } else {
        R = itemRefundableValue * refundPercentage;
      }
    }

    // Safety boundaries
    if (R > itemRefundableValue) R = itemRefundableValue;
    if (R < 0) R = 0;

    let C = itemRefundableValue - R; // The rest is Cancellation Fee
    if (C < 0) C = 0;

    let originalCharge = itemBaseValue + repairsTotal;

    if (delItem.legacyId === null && originalCharge > 0) {
      newObligations.push({
        orderId: order.orderId,
        productId: matchedPrice ? matchedPrice.id : null,
        amount: originalCharge,
        quantity: delItem.quantity || 1,
        description: `חיוב מקורי: ${delItem.dressItem.dress.name} (פריט #${delItem.id})`,
        isManual: false,
        orderItemId: delItem.id,
        isDraft: false
      });
    }

    if (originalCharge > 0) {
      newObligations.push({
        orderId: order.orderId,
        productId: matchedPrice ? matchedPrice.id : null,
        amount: -originalCharge,
        quantity: delItem.quantity || 1,
        description: `זיכוי בגין ביטול: ${delItem.dressItem.dress.name} (פריט #${delItem.id})`,
        isManual: false,
        orderItemId: delItem.id,
        isDraft: false
      });
    }

    const feeAmount = C + itemLost;
    if (feeAmount > 0) {
      newObligations.push({
        orderId: order.orderId,
        productId: matchedPrice ? matchedPrice.id : null,
        amount: feeAmount,
        quantity: delItem.quantity || 1,
        description: `דמי ביטול ותיקונים: ${delItem.dressItem.dress.name}${customNote ? ` - ${customNote}` : ''} (פריט #${delItem.id})`,
        isManual: false,
        orderItemId: delItem.id,
        isDraft: false
      });
    }

    const deletedAtTime = delItem.deletedAt ? new Date(delItem.deletedAt).getTime() : null;
    // רק C (החלק הבלתי-מוחזר של השמלה) ניתן לניצול כזיכוי על פריט חלופי - itemLost
    // (עלות תיקונים) חייב להישאר חיוב קבוע ללקוח תמיד, גם כשיש פריט חלופי זמין.
    // כש-isSameModelSwap פעיל C כבר 0 למעלה, אז הבלוק הזה ממילא לא עושה כלום עבורו.
    // CANCELLATION_CREDIT_MINUTES = 0 (או ערך לא תקין) מכבה את הזיכוי לגמרי.
    const isCreditEligible = C > 0
      && deletedAtTime !== null
      && Number.isFinite(cancellationCreditMinutes)
      && cancellationCreditMinutes > 0
      && (currentDate.getTime() - deletedAtTime) <= cancellationCreditMinutes * 60000;

    if (isCreditEligible) {
      let remainingFee = C;
      let consumedCredit = 0;
      for (const candidate of creditCandidates) {
        if (remainingFee <= 0) break;
        if (new Date(candidate.createdAt).getTime() < deletedAtTime) continue;
        const capacity = itemChargeRemaining.get(candidate.id) || 0;
        if (capacity <= 0) continue;
        const take = Math.min(capacity, remainingFee);
        itemChargeRemaining.set(candidate.id, capacity - take);
        remainingFee -= take;
        consumedCredit += take;
      }

      if (consumedCredit > 0) {
        newObligations.push({
          orderId: order.orderId,
          productId: matchedPrice ? matchedPrice.id : null,
          amount: -consumedCredit,
          quantity: delItem.quantity || 1,
          description: `זיכוי דמי ביטול (מומש על פריט חדש): ${delItem.dressItem.dress.name} (פריט #${delItem.id})`,
          isManual: false,
          orderItemId: delItem.id,
          isDraft: false
        });
      }
    }
  }

  return { newObligations, totalValid };
}
