// newOrderLogic.js — הלוגיקה הטהורה של אשף "הזמנה חדשה" החדש (בלי React, בלי fetch, בלי DOM).
// כל פונקציה כאן היא העתקה נאמנה של הלוגיקה של האשף הישן (app/orders/new/LegacyNewOrderPage.js) כדי שגופי הבקשות לשרת
// יישארו זהים בדיוק: scripts/new-order-tests/payload-parity.test.mjs מחלץ את הליטרלים מהקובץ הישן בזמן הבדיקה ומשווה.
// אם משנים כאן בנייה של גוף בקשה - הבדיקה תיכשל עד שגם הישן משתנה (או שהשינוי מתועד כסטייה מכוונת).
// בלי '@/' imports - חייב להיטען ב-node רגיל (הבדיקות). ייבוא יחסי מ-lib הטהור (businessDays / lateReturn - בלי prisma) מותר.
import { parseNonWorkingDaysSetting, addBusinessDays } from '../../../lib/businessDays';
import { getExpectedReturnKey } from '../../../lib/lateReturn';

// ---------- לקוח ----------
export const getCustomerFullName = (c) => {
  if (!c) return 'לא נבחר';
  const f = (c.firstName === 'null' || c.firstName === 'undefined' || !c.firstName) ? '' : c.firstName;
  const l = (c.lastName === 'null' || c.lastName === 'undefined' || !c.lastName) ? '' : c.lastName;
  return `${f} ${l}`.trim() || 'לקוח ללא שם';
};

export const EMPTY_NEW_CUSTOMER = Object.freeze({
  firstName: '', lastName: '', phone1: '', phone2: '', email: '', city: '', street: '', houseNum: '', marketingConsent: false, zeout: ''
});

export const EMPTY_ORDER = Object.freeze({
  customerId: '', selectedCustomer: null, eventDate: '', eventDateHebrew: '', returnDate: '', isAbroad: false, isWeekdayEvent: false,
  fromDate: '', toDate: '', notes: '', items: [], customSpacing: null,
  isDelivery: false, deliveryDirection: 'הלוך-חזור', deliveryAddress: '', deliveryCity: '', deliveryOneDayBefore: false,
  isPhoneOrder: false, branch: '', pickupBranch: '',
  hokBankName: '', hokBankBranch: '', hokBankAccount: '', hokConsent: false,
});

export const EMPTY_NEW_ITEM = Object.freeze({ dressModelId: '', selectedSizes: [], quantity: 1, repairs: '', dressName: '' });

// כינויי השדות בהגדרת mandatory_fields (כמו CUSTOMER_FIELD_ALIASES בישן)
export const CUSTOMER_FIELD_ALIASES = {
  firstName: ['firstname', 'שם פרטי', 'שם_פרטי'],
  lastName: ['lastname', 'שם משפחה', 'שם_משפחה'],
  phone1: ['phone1', 'טלפון ראשי (נייד)', 'טלפון_1'],
  email: ['email', 'אימייל'],
  city: ['city', 'עיר'],
  street: ['street', 'רחוב'],
  houseNum: ['housenum', 'מספר בית', 'מספר_בית']
};
export const CUSTOMER_FIELD_LABELS = {
  firstName: 'שם פרטי', lastName: 'שם משפחה', phone1: 'טלפון', email: 'אימייל', city: 'עיר', street: 'רחוב', houseNum: 'מספר בית', marketingConsent: 'אישור דיוור'
};

export function isFieldMandatoryFromPicker(settings, key) {
  const configuredMandatory = String((settings && settings.mandatory_fields) || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return (CUSTOMER_FIELD_ALIASES[key] || []).some(alias => configuredMandatory.includes(alias.toLowerCase()));
}

// אותה פונקציה כמו getMissingMandatoryCustomerFields בישן (משותפת ללקוח חדש ולאישור לקוח קיים)
export function getMissingMandatoryCustomerFields(settings, customerObj) {
  const s = settings || {};
  const c = customerObj || {};
  const baseMissing = Object.keys(CUSTOMER_FIELD_ALIASES).filter((key) => {
    const alwaysRequired = key === 'firstName' || key === 'lastName' || key === 'phone1';
    const isRequired = alwaysRequired || isFieldMandatoryFromPicker(s, key);
    return isRequired && !String(c[key] || '').trim();
  });
  const extra = [];
  if (s.require_customer_email === 'true' && !String(c.email || '').trim()) extra.push('email');
  if (s.require_full_address === 'true') {
    if (!String(c.city || '').trim()) extra.push('city');
    if (!String(c.street || '').trim()) extra.push('street');
    if (!String(c.houseNum || '').trim()) extra.push('houseNum');
  }
  if (s.hide_marketing_consent_field !== 'true' && s.require_marketing_consent === 'true' && !c.marketingConsent) extra.push('marketingConsent');
  return [...baseMissing, ...extra.filter(k => !baseMissing.includes(k))];
}

// "פרטים נוספים" נפתח לבד כשיש בו שדה חובה (בעיצוב B2 אין מגירה - כל השדות גלויים; נשאר לשימוש התוויות)
export const requiresFullAddress = (s, key) => s.require_full_address === 'true' || isFieldMandatoryFromPicker(s, key);

// ---------- חלונות (שתי שכבות) ----------
// מנהל החלונות של האשף (טהור, נבדק ב-scripts/new-order-tests/review-fixes.test.mjs). כל חלון נושא מזהה (id): תשובה מאוחרת
// של חלון שכבר נסגר (למשל תגובת verify-pin איטית אחרי Escape) נושאת את המזהה הישן ולכן לא נוגעת בחלון הבא באותה שכבה -
// בלי זה היא הייתה מאשרת בקשת אישור אחרת (ממצא סקירה 6). setSlot(layer, {type, props, id} | null) מעדכן את ה-state של React.
export function createDialogManager(setSlot) {
  const resolvers = { 1: null, 2: null };
  const occupied = { 1: false, 2: false }; // מי פתוח כרגע (סינכרוני, בלי לחכות לרינדור)
  let seq = 0;
  return {
    occupied,
    setBusy(on) { occupied[2] = on; }, // חלון "busy" (חיוב / שמירה) תופס את שכבה 2 בלי resolver
    ask(type, props = {}, layer) {
      return new Promise((resolve) => {
        const L = layer || (occupied[1] ? 2 : 1);
        const prev = resolvers[L];
        const id = ++seq;
        resolvers[L] = { resolve, id };
        occupied[L] = true;
        if (prev) prev.resolve(undefined);
        setSlot(L, { type, props, id });
      });
    },
    answer(L, result, id) {
      const r = resolvers[L];
      if (id !== undefined && (!r || r.id !== id)) return false; // תשובה מתוייגת של חלון שכבר נסגר / הוחלף - מתעלמים
      resolvers[L] = null;
      occupied[L] = false;
      setSlot(L, null);
      if (r) r.resolve(result);
      return true;
    },
  };
}

// ---------- אמצעי תשלום ----------
// זהה ל-computePaymentMethodOptions בישן
export const computePaymentMethodOptions = (settingsObj) => {
  const s = settingsObj || {};
  const raw = s.ALLOWED_PAYMENT_METHODS
    ? s.ALLOWED_PAYMENT_METHODS.split(',').map(x => x.trim()).filter(Boolean)
    : ['אשראי (דרך נדרים פלוס)', 'מזומן', 'יציאה באישור מנהל'];
  if (s.nedarim_plus_enabled !== 'false') return raw;
  const withoutCredit = raw.filter(opt => !(opt.includes('אשראי') && !opt.includes('חיצונית')));
  return withoutCredit.length > 0 ? withoutCredit : ['יציאה באישור מנהל'];
};
export const MANAGER_EXIT_METHOD = 'יציאה באישור מנהל';
export const isCreditMethod = (method) => String(method || '').includes('אשראי') && !String(method || '').includes('חיצונית');
// האייקון של כל אמצעי בבורר .methods (כמו METHOD_ICON בעיצוב)
export const methodIcon = (m) => (m.includes('אשראי') ? 'card' : m.includes('מזומן') ? 'cash' : m.includes('העברה') ? 'bank' : m.includes('צ') ? 'cheque' : 'lock');

// R27: בקשת אישור רק כשרמת PAYMENT_APPROVAL_LEVEL היא אחת משלוש הרמות; חלה על יציאה באישור מנהל ועל תשלום רגיל (לא אשראי) בסכום חיובי
export function paymentApprovalRequired(settings, method, amount) {
  const isManagerExitPayment = method === MANAGER_EXIT_METHOD;
  const isCredit = isCreditMethod(method);
  if (!(isManagerExitPayment || (amount > 0 && !isCredit))) return false;
  const level = (settings && settings.PAYMENT_APPROVAL_LEVEL) || 'כולם';
  return level === 'מנהל' || level === 'עובד' || level === 'מנהל סניף ומעלה';
}

// אמצעי התשלום שנרשם בחיוב אשראי שעבר: תמיד אמצעי האשראי (הראשון ברשימה המותרת), לא האמצעי שנבחר בבורר -
// אחרת "חיוב אשראי" כשנבחר "מזומן" נשמר כתשלום מזומן (ממצא סקירה 2). בלי אמצעי אשראי ברשימה - השם הרגיל.
export const DEFAULT_CREDIT_METHOD = 'אשראי (דרך נדרים פלוס)';
export const creditPaymentMethod = (options) => (options || []).find(isCreditMethod) || DEFAULT_CREDIT_METHOD;

// מה עושה "אישור תשלום / פיצול" (ממצא סקירה 1). "יציאה באישור מנהל" אינה תשלום - היא נרשמת רק בסיום ההזמנה, בסכום 0
// (buildFinalPayments); כתשלום ₪ אמיתי השרת היה סופר אותה ככסף ששולם. אשראי - חלון החיוב. כל השאר (גם מזומן) - דרך אישור
// PAYMENT_APPROVAL_LEVEL כמו ברישום הסופי: בפיצול הסכום שנשאר ב-payment.amount אחרי הרישום הוא 0, ולכן בדיקת השמירה לא
// הייתה מתעוררת אף פעם.
export function paymentAddDecision(settings, method, amount) {
  const amt = parseFloat(amount) || 0;
  if (amt <= 0) return { action: 'reject', reason: 'amount', amount: amt };
  if (method === MANAGER_EXIT_METHOD) return { action: 'reject', reason: 'manager-exit', amount: amt };
  if (isCreditMethod(method)) return { action: 'credit', amount: amt };
  return { action: paymentApprovalRequired(settings, method, amt) ? 'approve' : 'add', amount: amt };
}

// הרשימה הסופית שנשלחת בשמירה (זהה ל-finalPayments ב-saveOrder בישן)
export function buildFinalPayments(paymentsList, payment) {
  const pAmount = parseFloat(payment.amount) || 0;
  const isManagerExitPayment = payment.method === MANAGER_EXIT_METHOD;
  const finalPayments = [...paymentsList];
  if (isManagerExitPayment) {
    finalPayments.push({ ...payment, amount: 0, notes: `יציאה באישור מנהל (סכום מבוקש: ₪${payment.amount}) | ${payment.notes}` });
  } else if (pAmount > 0) {
    finalPayments.push({ ...payment, amount: pAmount });
  }
  return finalPayments;
}
export const sumPaid = (list) => (list || []).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
export const isChargedPayment = (p) => String((p && p.notes) || '').includes('אישור נדרים');

// ---------- תאריכים ----------
export const usesRange = (order) => !!(order.isAbroad || order.isWeekdayEvent);
export const datesFilledOf = (order) => (usesRange(order) ? !!(order.fromDate && order.toDate) : !!order.eventDate);
// ה-preload / האפקט החי בודקים isAbroad בלבד (כמו בישן) - לא isWeekdayEvent
export const hasDatesForInventory = (order) => (order.isAbroad ? !!(order.fromDate && order.toDate) : !!order.eventDate);

export function buildPreloadParams(order, draftOrderId, bust) {
  const queryParams = new URLSearchParams({ isAbroad: order.isAbroad || false });
  if (order.eventDate) queryParams.append('eventDate', order.eventDate);
  if (order.fromDate) queryParams.append('fromDate', order.fromDate);
  if (order.toDate) queryParams.append('toDate', order.toDate);
  if (draftOrderId) queryParams.append('excludeOrderId', draftOrderId);
  if (bust !== undefined && bust !== null) queryParams.append('_t', bust);
  return queryParams.toString();
}

// handleDateChangeWithValidation בישן: שגיאת טווח הפוך, ואחריה ההזמנה המוצעת (eventDate מסונכרן ל-fromDate בחו"ל)
export function proposeDateChange(order, fieldOrUpdates, valueIfField) {
  const isMulti = typeof fieldOrUpdates === 'object';
  const updates = isMulti ? fieldOrUpdates : { [fieldOrUpdates]: valueIfField };
  if (order.isAbroad) {
    const fromDateVal = 'fromDate' in updates ? updates.fromDate : order.fromDate;
    const toDateVal = 'toDate' in updates ? updates.toDate : order.toDate;
    if (fromDateVal && toDateVal && new Date(toDateVal) < new Date(fromDateVal)) {
      return { error: 'שגיאה: תאריך החזרה (עד תאריך) אינו יכול להיות לפני תאריך ההתחלה (מתאריך)!' };
    }
  }
  const proposedOrder = { ...order, ...updates };
  if (proposedOrder.isAbroad && ('fromDate' in updates || 'isAbroad' in updates)) {
    const fromDateVal = 'fromDate' in updates ? updates.fromDate : proposedOrder.fromDate;
    if (fromDateVal) proposedOrder.eventDate = fromDateVal;
  }
  return { proposedOrder };
}

export function buildValidateBody(activeItems, proposedOrder, draftOrderId) {
  return {
    items: activeItems,
    eventDate: proposedOrder.eventDate,
    isAbroad: proposedOrder.isAbroad,
    isWeekdayEvent: proposedOrder.isWeekdayEvent,
    fromDate: proposedOrder.fromDate,
    toDate: proposedOrder.toDate,
    customSpacing: proposedOrder.customSpacing,
    orderId: draftOrderId
  };
}

// שורות חוסר המלאי (validate-inventory / 409 בשמירה) - לחלון / להודעה מתחת לכפתור השמירה במקום alert
export function stockShortageLines(errors) {
  return (errors || []).map(e => ({
    dressName: e.dressName,
    sizeText: e.sizeText,
    missing: (e.requested || 0) - (e.available || 0),
    spacing: !!e.isCustomSpacingIssue,
    text: `${e.dressName} (מידה ${e.sizeText}): חסרים ${(e.requested || 0) - (e.available || 0)} במלאי${e.isCustomSpacingIssue ? ' (בגלל ציפוף)' : ''}`,
  }));
}
export const SPACING_NOTE = 'כמה מהבעיות קשורות לציפוף מיוחד. אם בחרת ציפוף מיוחד, נסה לבחור ציפוף קטן יותר.';

// "האם התאריך עבר" - לפי מפתח היום הישראלי (לא setHours מקומי)
export function isPastDateKey(dateStr, todayKey) {
  if (!dateStr || !todayKey) return false;
  return String(dateStr).slice(0, 10) < todayKey;
}

export const SPACING_OPTIONS = [
  { val: null, label: 'רגיל' }, { val: 0, label: 'ללא' }, { val: 1, label: 'יום' },
  { val: 2, label: 'יומיים' }, { val: 3, label: '3 ימים' }, { val: 4, label: '4 ימים' }
];
export const spacingLabel = (v) => ((v === null || v === undefined) ? 'רגיל (לפי המערכת)' : (v === 0 ? 'ללא רווח כלל' : v === 1 ? 'יום רווח אחד' : `${v} ימי רווח`));
export const spacingHint = (v) => ((v === null || v === undefined) ? 'ברירת המחדל של המערכת.' : v < 3 ? 'ציפוף מיוחד — משפיע על בדיקת המלאי להזמנה זו בלבד, מסמן את ההזמנה ודורש אישור מנהל.' : 'ריווח מורחב — פחות זמינות לשאר ההזמנות.');
// handleSpacingChange בישן: ציפוף קטן מ-3 וגם קטן מהקודם דורש את חלון "רגע, בדקת מלאי?" + אישור
export function spacingNeedsApproval(prevSpacing, nextSpacing) {
  const prev = (prevSpacing !== null && prevSpacing !== undefined) ? prevSpacing : 3;
  const next = (nextSpacing !== null && nextSpacing !== undefined) ? nextSpacing : 3;
  return next < 3 && next < prev;
}

// ---------- פריטים ----------
export const describeAlterations = (item) => [
  item.neckAlteration && 'צוואר',
  item.sleeveAlteration && 'שרוול',
  item.lengthAlteration && `אורך (${item.lengthAlteration})`
].filter(Boolean).join(', ') || 'ללא תיקונים';
export const alterationsChosen = (it) => !!(it.neckAlteration || it.sleeveAlteration || it.lengthAlteration);

// R23: דגם שנשמר בשם הזמני "ללא שם" מוצג לפי הקוד (כמו OrderModelSelector.displayModelName)
export function displayModelName(model) {
  const name = String((model && model.name) || '').trim();
  if (name.startsWith('ללא שם') && model && model.barcodePrefix) return String(model.barcodePrefix);
  return name;
}
// R23 (הערת הבעלים): בנווה יעקב הקוד והשם זהים - מציגים את הקוד בנפרד רק כשהוא שונה מהשם המוצג
export function modelCodeSuffix(model) {
  const code = model && model.barcodePrefix ? String(model.barcodePrefix).trim() : '';
  if (!code) return '';
  return code === displayModelName(model) ? '' : code;
}

export const buildPricingUrl = (dressModelId, sizeText, eventDate) =>
  `/api/orders/pricing?dressModelId=${dressModelId}&sizeText=${sizeText}&eventDate=${eventDate || ''}`;

// בדיקת הזמינות ברגע ההוספה (addItemToOrder בישן)
export function splitSizesByAvailability(selectedSizes, availableSizes) {
  const unavailable = [];
  const validSizes = [];
  for (const sizeText of selectedSizes) {
    const info = (availableSizes || []).find(s => s.sizeText === sizeText);
    if (!info || info.availableQuantity <= 0) unavailable.push(sizeText);
    else validSizes.push({ sizeText, sampleItemId: info.sampleItemId });
  }
  return { unavailable, validSizes };
}

export function maxItemsError(settings, currentCount, adding) {
  const maxItems = parseInt(settings && settings.max_items_per_order, 10);
  if (!isNaN(maxItems) && maxItems > 0 && currentCount + adding > maxItems) {
    return `הגבלת מערכת: לא ניתן להוסיף יותר מ-${maxItems} פריטים להזמנה (בחרת ${adding} מידות, יש כבר ${currentCount} בסל).`;
  }
  return null;
}

export function buildItemsToAdd(newItem, validSizes, prices) {
  return validSizes.map(({ sizeText, sampleItemId }, idx) => ({
    dressModelId: newItem.dressModelId,
    dressName: newItem.dressName,
    sizeText,
    sampleItemId,
    quantity: 1,
    basePrice: (prices[idx] && prices[idx].basePrice) || 0,
    finalPrice: (prices[idx] && prices[idx].basePrice) || 0,
    repairs: newItem.repairs,
    neckAlteration: newItem.neckAlteration,
    sleeveAlteration: newItem.sleeveAlteration,
    lengthAlteration: newItem.lengthAlteration
  }));
}

// Q8 (הבעלים): "פירוט לתופרת * (חובה)" נאכף כשסומן תיקון, אלא אם ההגדרה alteration_details_optional = 'true'
// (אז חוזרת ההתנהגות הישנה: פירוט ברירת מחדל מהסימונים). ר' NOTES.md - Q8.
export const alterationDetailsRequired = (settings) => (settings || {}).enable_alterations !== 'false' && (settings || {}).alteration_details_optional !== 'true';
export function prepareItemForAdd(settings, newItem) {
  const itemToAdd = { ...newItem };
  if ((settings || {}).enable_alterations !== 'false' && alterationsChosen(itemToAdd) && (!itemToAdd.repairs || !itemToAdd.repairs.trim())) {
    if (alterationDetailsRequired(settings)) return { error: 'יש למלא "פירוט לתופרת" לפני ההוספה לסל.' };
    itemToAdd.repairs = describeAlterations(itemToAdd);
  }
  return { itemToAdd };
}

export function buildCalculateBody(order) {
  return {
    items: order.items,
    eventDate: order.eventDate,
    isAbroad: order.isAbroad,
    isWeekdayEvent: order.isWeekdayEvent,
    isDelivery: order.isDelivery,
    deliveryCity: order.deliveryCity,
    deliveryDirection: order.deliveryDirection
  };
}

// S06: גוף תצוגה-מקדימה של מחיר (אותו /api/orders/calculate, קריאה בלבד) - פריט לכל מידה מסומנת עם התיקונים שסומנו
export function buildAddPreviewBody(order, newItem) {
  return {
    items: (newItem.selectedSizes || []).map(sizeText => ({
      dressModelId: newItem.dressModelId, sizeText, quantity: 1,
      neckAlteration: !!newItem.neckAlteration, sleeveAlteration: !!newItem.sleeveAlteration, lengthAlteration: newItem.lengthAlteration || ''
    })),
    eventDate: order.eventDate, isAbroad: order.isAbroad, isWeekdayEvent: order.isWeekdayEvent,
  };
}
// S06 (ממצא סקירה 8): "להוספה: ₪N" כולל את הסל - הפרש בין חישוב (סל + פריטים חדשים) לחישוב הסל לבד, באותם שדות משלוח/חו"ל
// (הנחות סט / דמי משלוח תלויים בסל כולו). סל ריק: הגוף הקודם (פריטים חדשים בלבד, בלי משלוח - אין מה להפחית).
export function buildAddPreviewBodies(order, newItem) {
  const add = buildAddPreviewBody(order, newItem);
  const cart = order.items || [];
  if (!cart.length) return { withCart: add, base: null };
  const base = buildCalculateBody(order);
  return { withCart: { ...base, items: [...cart, ...add.items] }, base };
}
export const addPreviewTotal = (withCartTotal, baseTotal) => Math.round(((Number(withCartTotal) || 0) - (Number(baseTotal) || 0)) * 100) / 100;
export const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;
// S06: מחיר כל אפשרות תיקון בנפרד (שלושה פריטי בדיקה למידה הראשונה המסומנת, ההפרש = repairsCost)
export function buildAltProbeBody(order, newItem, sizeText) {
  const base = { dressModelId: newItem.dressModelId, sizeText, quantity: 1 };
  return {
    items: [
      { ...base, neckAlteration: true },
      { ...base, sleeveAlteration: true },
      { ...base, lengthAlteration: '1' },
    ],
    eventDate: order.eventDate, isAbroad: order.isAbroad, isWeekdayEvent: order.isWeekdayEvent,
  };
}

export function buildDraftBody(order, draftOrderId, totalAmount, activeItems) {
  return {
    orderId: draftOrderId,
    customerId: order.customerId,
    eventDate: order.eventDate,
    eventDateHebrew: order.eventDateHebrew,
    returnDate: order.returnDate,
    isAbroad: order.isAbroad,
    isWeekdayEvent: order.isWeekdayEvent,
    fromDate: order.fromDate,
    toDate: order.toDate,
    notes: order.notes,
    customSpacing: order.customSpacing,
    totalAmount,
    items: activeItems
  };
}

export function buildItemsToSave(order, calculatedItems) {
  return order.items.map((item, idx) => {
    const calcItem = (calculatedItems || [])[idx];
    return { ...item, finalPrice: calcItem ? calcItem.calculatedPrice : item.finalPrice };
  });
}

export function buildHokDetailsPayload(settings, order, newCustomer) {
  if ((settings || {}).hok_enabled !== 'true') return undefined;
  if (order.hokBankName || order.hokBankBranch || order.hokBankAccount || order.hokConsent) {
    return JSON.stringify({ bankName: order.hokBankName || '', bankBranch: order.hokBankBranch || '', bankAccount: order.hokBankAccount || '', consent: !!order.hokConsent });
  }
  if (newCustomer.hokBankName || newCustomer.hokBankBranch || newCustomer.hokBankAccount || newCustomer.hokConsent) {
    return JSON.stringify({ bankName: newCustomer.hokBankName || '', bankBranch: newCustomer.hokBankBranch || '', bankAccount: newCustomer.hokBankAccount || '', consent: !!newCustomer.hokConsent });
  }
  return undefined;
}

// גוף POST /api/orders - אותם שדות באותו סדר כמו payload ב-executeSaveOrderForList בישן
export function buildSavePayload({ order, totalAmount, itemsToSave, hokDetailsPayload, finalPaymentsList, reservedOrderId, draftOrderId, force }) {
  return {
    customerId: order.customerId,
    eventDate: order.eventDate,
    eventDateHebrew: order.eventDateHebrew,
    returnDate: order.returnDate,
    isAbroad: order.isAbroad,
    isWeekdayEvent: order.isWeekdayEvent,
    fromDate: order.fromDate,
    toDate: order.toDate,
    notes: order.notes,
    customSpacing: order.customSpacing,
    totalAmount,
    items: itemsToSave,
    isDelivery: !!order.isDelivery,
    deliveryDirection: order.deliveryDirection || null,
    deliveryAddress: order.deliveryAddress || null,
    deliveryCity: order.deliveryCity || null,
    isPhoneOrder: !!order.isPhoneOrder,
    branch: order.branch || null,
    pickupBranch: order.pickupBranch || null,
    deliveryOneDayBefore: !!order.deliveryOneDayBefore,
    ...(hokDetailsPayload !== undefined ? { hokDetails: hokDetailsPayload } : {}),
    paymentsList: finalPaymentsList,
    reservedOrderId,
    draftOrderId,
    forceDuplicate: force
  };
}

// ---------- אשראי (נדרים פלוס) ----------
export function buildNedarimBody(cust, creditCardData, paymentAmount, orderNumberForCharge) {
  const fullAddress = [cust.street || '', cust.houseNum || '', cust.city || ''].filter(Boolean).join(' ');
  return {
    clientName: getCustomerFullName(cust),
    phone: cust.phone1 || '',
    address: fullAddress,
    cardNumber: creditCardData.cardNumber.replace(/\s/g, ''),
    tokef: creditCardData.tokef.replace(/\//g, ''),
    amount: paymentAmount,
    installments: parseInt(creditCardData.installments) || 1,
    notes: [creditCardData.notes, `באמצעות תכנת הגמח; מס הזמנה: ${orderNumberForCharge || 'חדשה'}`].filter(Boolean).join(' - '),
    zeout: cust.idNumber || cust.zeout || '',
    email: cust.email || ''
  };
}
export const groupCard = (digits) => (String(digits).match(/.{1,4}/g) || []).join(' ');
// קורא כרטיסים מגנטי (handleSwipeInputChange בישן): מחזיר {cardNumber, tokef} או null
export function parseSwipe(val) {
  let card = '';
  let tokef = '';
  if (val.includes('=')) {
    const parts = val.split('=');
    if (parts[1] && parts[1].length >= 4) {
      card = parts[0].replace(/[^0-9]/g, '');
      tokef = `${parts[1].substring(2, 4)}/${parts[1].substring(0, 2)}`;
      card = groupCard(card);
    }
  } else if (val.includes('^')) {
    const parts = val.split('^');
    if (parts.length > 2 && parts[2] && parts[2].length >= 4) {
      card = parts[0].replace(/[^0-9]/g, '');
      tokef = `${parts[2].substring(2, 4)}/${parts[2].substring(0, 2)}`;
      card = groupCard(card);
    }
  }
  return card && tokef ? { cardNumber: card, tokef } : null;
}
// handleCardNumberChange בישן: מחזיר את הערכים החדשים {cardNumber, tokef?}
export function cardNumberInput(val, prevTokef) {
  if (val.includes('=')) {
    const parts = val.split('=');
    const card = parts[0].replace(/[^0-9]/g, '');
    const expYY = (parts[1] || '').substring(0, 2);
    const expMM = (parts[1] || '').substring(2, 4);
    return { cardNumber: groupCard(card), tokef: (expMM && expYY) ? `${expMM}/${expYY}` : prevTokef };
  }
  if (val.includes('^')) {
    const parts = val.split('^');
    const card = parts[0].replace(/[^0-9]/g, '');
    if (parts.length > 2) {
      const expYY = parts[2].substring(0, 2);
      const expMM = parts[2].substring(2, 4);
      return { cardNumber: groupCard(card), tokef: (expMM && expYY) ? `${expMM}/${expYY}` : prevTokef };
    }
  }
  return { cardNumber: groupCard(val.replace(/[^0-9]/g, '')), tokef: prevTokef };
}
export function tokefInput(val) {
  const raw = String(val).replace(/[^0-9]/g, '');
  return raw.length > 2 ? `${raw.substring(0, 2)}/${raw.substring(2, 4)}` : raw;
}

// ---------- משלוח ----------
export function deliveryPriceCitiesOf(settings) {
  try { return Object.keys(JSON.parse((settings || {}).delivery_price_by_city || '{}')); } catch { return []; }
}
export function deliveryCityOptionsOf(settings, customerCities) {
  const cities = deliveryPriceCitiesOf(settings);
  return cities.length ? cities : (customerCities || []);
}
export const branchListOf = (settings) => String((settings || {}).branch_list || '').split(',').map(s => s.trim()).filter(Boolean);
// כמו בישן (LegacyNewOrderPage ~2030): כל הכרטיס "משלוח / סניף / טלפוני" מוצג כשאחד מדגלי הטלפוני/סניף דלוק או
// delivery_show_in_order !== 'false'; "הזמנת משלוח" בתוכו דורשת גם enable_deliveries === 'true'. אופן ההזמנה - לפי הדגלים עצמם.
export function deliveryStepVisibility(s) {
  const st = s || {};
  const showMode = st.phone_order_marker_enabled === 'true' || st.track_branch_on_order === 'true' || st.branches_enabled === 'true';
  const cardVisible = showMode || st.delivery_show_in_order !== 'false';
  return { showMode, showDelivery: cardVisible && st.enable_deliveries === 'true' };
}
export const showOrderModeCard = (s) => s.phone_order_marker_enabled === 'true' || s.track_branch_on_order === 'true' || s.branches_enabled === 'true' || s.delivery_show_in_order !== 'false';
export const DELIVERY_DIRECTIONS = [
  { v: 'הלוך', icon: 'arrr' }, { v: 'חזור', icon: 'arrl' }, { v: 'הלוך-חזור', icon: 'arrlr' }
];

// ---------- שלבים ----------
// B2: שישה שלבים (משלוח כשלב נפרד). תנאי הנעילה זהים לישן: תאריכים <- לקוח; משלוח/פריטים <- לקוח+תאריכים; סיכום/תשלום <- + פריט
export const STEP_KEYS = ['customer', 'dates', 'delivery', 'items', 'summary', 'payment'];
export const STEP_META = {
  customer: { l: 'לקוח', i: 'user', q: 'מי הלקוח?' },
  dates: { l: 'תאריכים', i: 'cal', q: 'מתי האירוע?' },
  delivery: { l: 'משלוח', i: 'truck', q: 'איך תרצו לקבל את ההזמנה?' },
  items: { l: 'פריטים', i: 'dress', q: 'אילו פריטים?' },
  summary: { l: 'סיכום', i: 'list', q: 'הכול נכון?' },
  payment: { l: 'תשלום', i: 'card', q: 'תשלום וסיום' },
};
export const LOCK_REASONS = { noCustomer: 'יש לבחור לקוח תחילה', noDates: 'יש למלא תאריכים תחילה', noItems: 'יש להוסיף לפחות פריט אחד להזמנה' };

export function stepOpenInfo(order) {
  const hasC = !!order.customerId;
  const hasD = datesFilledOf(order);
  const hasI = (order.items || []).length > 0;
  const reasonD = hasC ? LOCK_REASONS.noDates : LOCK_REASONS.noCustomer;
  const reasonI = !hasC ? LOCK_REASONS.noCustomer : !hasD ? LOCK_REASONS.noDates : LOCK_REASONS.noItems;
  return {
    customer: { open: true, reason: '' },
    dates: { open: hasC, reason: LOCK_REASONS.noCustomer },
    delivery: { open: hasC && hasD, reason: reasonD },
    items: { open: hasC && hasD, reason: reasonD },
    summary: { open: hasC && hasD && hasI, reason: reasonI },
    payment: { open: hasC && hasD && hasI, reason: reasonI },
  };
}

// סכום כספי לתצוגה: שקלים שלמים בלי אגורות; כשיש אגורות (מחיר/תשלום לא שלם) - שתי ספרות אחרי הנקודה, כדי שלא יוסתרו
export const moneyAmount = (n) => {
  const v = Math.abs(Number(n) || 0);
  const whole = Math.abs(v - Math.round(v)) < 0.005;
  return whole
    ? Math.round(v).toLocaleString('he-IL')
    : v.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
export const moneyTxt = (n) => '₪' + moneyAmount(n);
export const plural = (n, one, many) => (n === 1 ? one : `${n} ${many}`);

// ---------- מועדי לקיחה / החזרה (S07, ממצא סקירה 4) ----------
// אותם כללים כמו השרת, על אותה הגדרות (/api/settings): הדפסה / מייל / שמירת ההזמנה (app/api/orders/route.js) מחשבים
// לקיחה = subtractBusinessDays(אירוע, 2) והחזרה = getExpectedReturnKey; משלוח יוצא = delivery_days_before ימי עסקים
// לפני האירוע (יום אחד כשסומן "יום לפני"), עם delivery_skip_weekends (חג/ערב חג/ימי הבעלים מדולגים תמיד) - lib/deliveries.js.
// lib/deliveries.js עצמו מייבא prisma ולכן הכלל משוכפל כאן על הפונקציות הטהורות; scripts/new-order-tests מוכיחים שוויון.
export function pickupReturnKeys(order, settings) {
  const s = settings || {};
  const useRange = !!(order.isAbroad || order.isWeekdayEvent);
  const ev = useRange && order.fromDate ? order.fromDate : order.eventDate; // כמו effectiveEventDateRaw בשרת
  if (!ev) return null;
  const nonWorking = parseNonWorkingDaysSetting(s.non_working_days_extra ?? null);
  let pickup;
  if (order.isDelivery && order.deliveryDirection !== 'חזור') {
    const parsed = parseInt(s.delivery_days_before, 10);
    const daysBefore = isNaN(parsed) ? 1 : parsed; // כמו getDeliveriesForDate: שורה חסרה = 1
    pickup = addBusinessDays(ev, -(order.deliveryOneDayBefore ? 1 : daysBefore), nonWorking, { skipWeekend: s.delivery_skip_weekends === 'true' });
  } else {
    pickup = addBusinessDays(ev, -2, nonWorking);
  }
  const ret = getExpectedReturnKey({ eventDate: ev, toDate: order.toDate || '', returnDate: order.returnDate || '' }, nonWorking);
  return pickup && ret ? { pickup, ret } : null;
}
