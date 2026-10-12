import prisma, { auditAs } from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { getIsraelDayRange, getIsraelDateKey, getIsraelTodayKey } from '@/lib/hebrewDate';
import { DRAFT_ORDER_STATUS, RESERVED_ORDER_STATUS } from '@/lib/orderReservation';
import { resolveEffectiveDeliveryCity, computeDeliveryObligationPreview } from '@/lib/pricingCalc';
import { calculatePaymentStatus } from '@/lib/orderStatus';
import { syncPendingCreditRefund } from '@/lib/creditRefundSync';
import { getJoinRows, isDeliveryJoinEnabled, setSharedPrimaryFlag, isJoinTableUsable } from '@/lib/deliveryJoin';
import {
  buildAddressKey, groupCandidates, planSharedGroup, parsePriceMap, resolveSharedDiscountPrice, legsOf,
  computeStoredTotalAfterDeliveryChange, isSharedDeliveryDescription, compareByRegistration,
} from '@/lib/sharedDeliveryCalc';

// "משלוח משותף" - הנחה על משלוח לכתובת זהה באותו יום אירוע (השרת). החישוב הטהור והכללים: lib/sharedDeliveryCalc.js;
// המסמך המלא: docs/shared-delivery-discount.md.
//
// עקרונות (כסף - מחמירים):
//  1. כבוי כברירת מחדל ובלי שום שאילתה: ההגדרות enable_deliveries וגם shared_delivery_enabled חייבות להיות 'true'. בגמ"ח בלי
//     משלוחים (הראשי) אין שורות כאלה => כל פונקציה כאן חוזרת מיד {enabled:false}, בלי נגיעה ב-DB מעבר לקריאת ההגדרות המטמונית.
//  2. קבוצה = אותו יום אירוע (לפי היום הישראלי) + אותה כתובת מנורמלת (עיר מחויבת + רחוב + מספר בית). הזמנה שמחוקה / טיוטה /
//     "שמור לחיוב" / לא משלוח / בלי עיר מחויבת / בלי מספר בית - אינה בשום קבוצה. הזמנה שמצטרפת מפורשות למשלוח אחר
//     (enable_delivery_join, DeliveryJoin.joinedToOrderId) משלמת מחיר הצטרפות ואינה חלק מהקבוצה האוטומטית (בלי כפל הנחות).
//  3. חישוב מחדש של הזמנות אחרות נוגע אך ורק בשורת חיוב המשלוח האוטומטית הקיימת שלהן (לא יוצר, לא מוחק, לא נוגע בחיוב ידני),
//     ושומר את המחיר הרגיל שכבר נגבה (טבלת הערים ייתכן ששונתה מאז) - כך חישוב מחדש לעולם לא "מתקן" מחיר ישן בדרך.
//  4. אידמפוטנטי: חישוב מחדש חוזר על אותו מצב לא כותב כלום ולא יוצר זיכוי כפול (syncPendingCreditRefund מחשב את היתרה מחדש).
//  5. הזיכוי = המנגנון הקיים: סכום החיוב יורד => יתרת זכות => בקשת זיכוי אוטומטית (syncPendingCreditRefund). אין מנגנון מקביל.

const DELIVERY_WORD = 'משלוח';
const SETTING_KEYS = [
  'enable_deliveries', 'shared_delivery_enabled', 'shared_delivery_price_mode', 'shared_delivery_price', 'shared_delivery_price_by_city',
  'delivery_price_by_city', 'delivery_price', 'delivery_charge_customer_city_fallback',
];

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const agorot = (n) => Math.round(Number(n) * 100);

/** ההגדרות של הפיצ'ר + הגדרות המחיר הרגיל של המשלוח (שורה אחת מהמטמון). enabled=false => כל השאר לא רלוונטי. */
export async function loadSharedDeliverySettings() {
  const all = await getAllCachedSettings();
  const v = {};
  for (const k of SETTING_KEYS) v[k] = (all || []).find((s) => s.key === k)?.value;
  return {
    enabled: v.enable_deliveries === 'true' && v.shared_delivery_enabled === 'true',
    mode: v.shared_delivery_price_mode === 'by_city' ? 'by_city' : 'global',
    globalPrice: v.shared_delivery_price,
    discountByCity: parsePriceMap(v.shared_delivery_price_by_city),
    priceByCityRaw: v.delivery_price_by_city,
    flatPriceRaw: v.delivery_price,
    allowCustomerCityFallback: v.delivery_charge_customer_city_fallback === 'true',
  };
}

/** קיצור: האם הפיצ'ר פעיל בארגון הזה (בלי שאילתת DB מעבר למטמון ההגדרות). */
export async function isSharedDeliveryEnabled() {
  try { return (await loadSharedDeliverySettings()).enabled; } catch { return false; }
}

/** המחיר המוזל לצד אחד לעיר נתונה (null = לא מוגדר => אין הנחה). */
export function discountedPricePerLeg(settings, pricedCity) {
  return resolveSharedDiscountPrice({ mode: settings.mode, globalPrice: settings.globalPrice, priceByCity: settings.discountByCity, city: pricedCity });
}

// ---------------------------------------------------------------------------------------------
// בניית "חבר קבוצה" מהזמנה
// ---------------------------------------------------------------------------------------------
const CUSTOMER_FIELDS = { id: true, firstName: true, lastName: true, street: true, houseNum: true, city: true };
const ORDER_FIELDS = {
  orderId: true, orderDate: true, status: true, isDelivery: true, isDeleted: true, eventDate: true, fromDate: true,
  deliveryDirection: true, deliveryOneDayBefore: true, deliveryAddress: true, deliveryCity: true, customerId: true,
  customer: { select: CUSTOMER_FIELDS },
};

function customerName(c) {
  return `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || 'לא ידוע';
}

/** חבר קבוצה מהזמנה (עם customer) - בלי DB. addressKey/dayKey ריקים => אינו חבר בשום קבוצה. */
export function memberFromOrder(o, settings) {
  const resolved = resolveEffectiveDeliveryCity({
    deliveryCity: o.deliveryCity,
    customerCity: o.customer?.city,
    deliveryPriceByCity: settings.priceByCityRaw,
    allowCustomerCityFallback: settings.allowCustomerCityFallback,
  });
  const pricedCity = resolved.city ? String(resolved.city) : '';
  const addressKey = pricedCity
    ? buildAddressKey({
      deliveryAddress: o.deliveryAddress,
      deliveryCity: o.deliveryCity,
      customerStreet: o.customer?.street,
      customerHouseNum: o.customer?.houseNum,
      customerCity: o.customer?.city,
      pricedCity,
    })
    : null;
  const dayKey = o.eventDate || o.fromDate ? getIsraelDateKey(o.eventDate || o.fromDate) : null;
  const orderDateMs = o.orderDate ? new Date(o.orderDate).getTime() : null;
  return {
    orderId: Number(o.orderId),
    dayKey,
    addressKey,
    groupKey: dayKey && addressKey ? `${dayKey}|${addressKey}` : null,
    pricedCity,
    orderDateMs: Number.isFinite(orderDateMs) ? orderDateMs : null,
    direction: o.deliveryDirection || null,
    oneDayBefore: !!o.deliveryOneDayBefore,
    primaryFlag: false,
    customerId: o.customerId || o.customer?.id || null,
    customerName: customerName(o.customer),
  };
}

/** מפתח הקבוצה של הזמנה קיימת ב-DB (לפני / אחרי שינוי), או null. מחזיר null גם כשהפיצ'ר כבוי. */
export async function getSharedGroupKeyForOrder(orderId, settingsIn) {
  const settings = settingsIn || await loadSharedDeliverySettings();
  if (!settings.enabled) return null;
  const o = await prisma.order.findUnique({ where: { orderId: Number(orderId) }, select: ORDER_FIELDS });
  if (!o || o.isDeleted || !o.isDelivery) return null;
  if (o.status === DRAFT_ORDER_STATUS || o.status === RESERVED_ORDER_STATUS) return null;
  return memberFromOrder(o, settings).groupKey;
}

// ---------------------------------------------------------------------------------------------
// טעינת יום והחלת התכנון
// ---------------------------------------------------------------------------------------------
async function loadDayOrders(dayKey) {
  const range = getIsraelDayRange(dayKey);
  return prisma.order.findMany({
    where: {
      isDeleted: false,
      isDelivery: true,
      AND: [
        { OR: [{ eventDate: { gte: range.start, lte: range.end } }, { eventDate: null, fromDate: { gte: range.start, lte: range.end } }] },
        // בטוח ל-NULL (Order.status עמוס NULL): לא notIn חשוף
        { OR: [{ status: null }, { status: { notIn: [DRAFT_ORDER_STATUS, RESERVED_ORDER_STATUS] } }] },
      ],
    },
    select: ORDER_FIELDS,
    orderBy: { orderId: 'asc' },
  });
}

/**
 * מצב כל קבוצות המשלוח של יום אירוע אחד. extra: { replaceOrderId?, member? } להזמנה היפותטית (תצוגה מקדימה, לפני שמירה) -
 * ההזמנה הקיימת replaceOrderId מוחלפת בחבר ההיפותטי (או נוספת, כשאין replaceOrderId).
 * מחזיר { dayKey, members, groups: Map(groupKey -> {members, plan}), byOrder: Map(orderId -> {groupKey, member, info, plan}) }.
 */
export async function getDayState(dayKey, settings, extra = {}) {
  const orders = await loadDayOrders(dayKey);
  const joinActive = await isDeliveryJoinEnabled().catch(() => false);
  const joinRows = await getJoinRows(orders.map((o) => o.orderId));
  const members = [];
  for (const o of orders) {
    if (extra.replaceOrderId && Number(o.orderId) === Number(extra.replaceOrderId)) continue;
    const row = joinRows.get(Number(o.orderId));
    if (joinActive && row?.joinedToOrderId) continue; // הצטרפות מפורשת => מחיר הצטרפות, לא קבוצה אוטומטית
    const m = memberFromOrder(o, settings);
    m.primaryFlag = !!(row?.isPrimary && !row?.joinedToOrderId);
    members.push(m);
  }
  if (extra.member) members.push(extra.member);
  const groups = new Map();
  const byOrder = new Map();
  for (const [groupKey, gm] of groupCandidates(members)) {
    const plan = planSharedGroup(gm);
    groups.set(groupKey, { members: [...gm].sort(compareByRegistration), plan });
    for (const m of gm) byOrder.set(m.orderId, { groupKey, member: m, info: plan.perOrder.get(m.orderId), plan });
  }
  return { dayKey, members, groups, byOrder };
}

/**
 * ההנחה שיש להחיל על חיוב המשלוח של הזמנה שמורה: { discountedPerLeg, discountedLegs, isPrimary, primaryOrderId, sharedWith } או null
 * (הפיצ'ר כבוי / ההזמנה לא בקבוצה / אין עם מי לחלוק / לא הוגדר מחיר מוזל). מחושב מההזמנות השמורות ב-DB.
 */
export async function getSharedDiscountForOrder(orderId, settingsIn) {
  const settings = settingsIn || await loadSharedDeliverySettings();
  if (!settings.enabled) return null;
  const o = await prisma.order.findUnique({ where: { orderId: Number(orderId) }, select: ORDER_FIELDS });
  if (!o || o.isDeleted || !o.isDelivery) return null;
  const m0 = memberFromOrder(o, settings);
  if (!m0.groupKey) return null;
  const state = await getDayState(m0.dayKey, settings);
  return discountFromState(state, Number(orderId), settings);
}

function discountFromState(state, orderId, settings) {
  const entry = state.byOrder.get(Number(orderId));
  if (!entry || !entry.info || entry.info.discountedLegs.length === 0) return null;
  const perLeg = discountedPricePerLeg(settings, entry.member.pricedCity);
  if (perLeg === null) return null;
  return {
    discountedPerLeg: perLeg,
    discountedLegs: [...entry.info.discountedLegs],
    isPrimary: entry.info.isPrimary,
    primaryOrderId: entry.plan.primaryOrderId,
    sharedWith: [...entry.info.sharedWith],
  };
}

/**
 * הנחה להזמנה היפותטית (חישוב מחיר לפני שמירה - אשף הזמנה חדשה, תצוגה מקדימה בכרטיס): fields = שדות ההזמנה כפי שהם עכשיו במסך.
 * { orderId? (קיימת: מוחלפת), customerId | customer:{street,houseNum,city}, eventDate, fromDate, isDelivery, deliveryAddress, deliveryCity,
 *   deliveryDirection, deliveryOneDayBefore, orderDate? }. מחזיר { enabled, shared, isPrimary, discount|null, matches:[{orderId,customerName}] }.
 * הזמנה חדשה נחשבת כנרשמת עכשיו => אחרונה בסדר הרישום (מצטרפת כמוזלת), אלא אם orderDate נתון.
 */
export async function previewSharedDelivery(fields, settingsIn) {
  const settings = settingsIn || await loadSharedDeliverySettings();
  if (!settings.enabled) return { enabled: false };
  if (!fields?.isDelivery) return { enabled: true, shared: false, isPrimary: false, discount: null, matches: [] };
  let customer = fields.customer || null;
  if (!customer && fields.customerId) {
    customer = await prisma.customer.findUnique({ where: { id: fields.customerId }, select: CUSTOMER_FIELDS });
  }
  const virtualId = fields.orderId ? Number(fields.orderId) : -1;
  const m = memberFromOrder({
    orderId: virtualId,
    orderDate: fields.orderDate || new Date(),
    isDelivery: true,
    eventDate: fields.eventDate || null,
    fromDate: fields.fromDate || null,
    deliveryDirection: fields.deliveryDirection || null,
    deliveryOneDayBefore: !!fields.deliveryOneDayBefore,
    deliveryAddress: fields.deliveryAddress || null,
    deliveryCity: fields.deliveryCity || null,
    customer,
  }, settings);
  if (!m.groupKey) return { enabled: true, shared: false, isPrimary: false, discount: null, matches: [] };
  if (fields.orderId) {
    // הזמנה קיימת שנערכת שומרת את זמן הרישום המקורי שלה ואת סימון ה"ראשי" (לא נחשבת "נרשמת עכשיו")
    const existing = await prisma.order.findUnique({ where: { orderId: Number(fields.orderId) }, select: { orderDate: true } });
    if (existing?.orderDate && !fields.orderDate) m.orderDateMs = new Date(existing.orderDate).getTime();
    const row = (await getJoinRows([fields.orderId])).get(Number(fields.orderId));
    m.primaryFlag = !!(row?.isPrimary && !row?.joinedToOrderId);
  }
  const state = await getDayState(m.dayKey, settings, { replaceOrderId: fields.orderId || null, member: m });
  return summariseState(state, virtualId, settings);
}

function summariseState(state, orderId, settings) {
  const entry = state.byOrder.get(Number(orderId));
  if (!entry) return { enabled: true, shared: false, isPrimary: false, discount: null, matches: [] };
  const d = discountFromState(state, orderId, settings);
  const group = state.groups.get(entry.groupKey);
  return {
    enabled: true,
    shared: entry.info.sharedWith.length > 0,
    isPrimary: entry.info.isPrimary,
    primaryOrderId: entry.plan.primaryOrderId,
    discountedLegs: [...entry.info.discountedLegs],
    discount: d,
    matches: (group?.members || []).filter((x) => x.orderId !== Number(orderId)).map((x) => ({ orderId: x.orderId, customerName: x.customerName, isPrimary: x.orderId === entry.plan.primaryOrderId })),
  };
}

// ---------------------------------------------------------------------------------------------
// חישוב מחדש של חיוב המשלוח של הזמנה שמורה (בלי סריקת כל ההזמנה)
// ---------------------------------------------------------------------------------------------

/**
 * מחשב מחדש את שורת חיוב המשלוח האוטומטית הקיימת של הזמנה לפי מצב הקבוצה הנוכחי.
 *  - לא יוצר חיוב חדש ולא מוחק (שורה חסרה => skipped); לא נוגע בחיוב ידני / בכמה שורות משלוח (skipped).
 *  - שורה "מלאה" (בלי הנחה) קיימת: המחיר הרגיל לצד נלקח ממנה (סכום/צדדים), לא מהטבלה הנוכחית. שורה שכבר מוזלת - מהטבלה הנוכחית.
 *  - מעדכן את Order.totalAmount בהתאם (computeStoredTotalAfterDeliveryChange) ומסנכרן את בקשת הזיכוי האוטומטית.
 * info: { entry } מ-getDayState (אופציונלי; אחרת נטען). מחזיר אובייקט תוצאה (status: updated | unchanged | skipped).
 */
export async function repriceDeliveryCharge(orderId, { settings: settingsIn, state: stateIn, reason, dryRun = false } = {}) {
  const id = parseInt(orderId, 10);
  const settings = settingsIn || await loadSharedDeliverySettings();
  if (!settings.enabled) return { orderId: id, status: 'skipped', reason: 'disabled' };
  const order = await prisma.order.findUnique({
    where: { orderId: id },
    select: {
      ...ORDER_FIELDS,
      totalAmount: true,
      obligations: { where: { isDeleted: false }, select: { id: true, amount: true, quantity: true, description: true, isManual: true } },
      payments: { where: { isDeleted: false }, select: { amount: true } },
    },
  });
  if (!order || order.isDeleted || !order.isDelivery) return { orderId: id, status: 'skipped', reason: 'not-delivery' };
  const rows = order.obligations.filter((o) => String(o.description || '').includes(DELIVERY_WORD));
  if (rows.length === 0) return { orderId: id, status: 'skipped', reason: 'no-existing-charge' };
  if (rows.length > 1 || rows[0].isManual) return { orderId: id, status: 'skipped', reason: rows[0].isManual ? 'manual-charge' : 'multiple-charges' };
  const row = rows[0];

  // מצב הקבוצה
  let discount = null;
  const m0 = memberFromOrder(order, settings);
  const state = stateIn && m0.dayKey && stateIn.dayKey === m0.dayKey ? stateIn : (m0.dayKey ? await getDayState(m0.dayKey, settings) : null);
  if (state) discount = discountFromState(state, id, settings);

  // המחיר הרגיל לצד: משורה "מלאה" קיימת (משמר מחיר ישן), אחרת מהטבלה הנוכחית
  const wasShared = isSharedDeliveryDescription(row.description);
  const legsCount = legsOf(order.deliveryDirection).length;
  let regularPerLegOverride = null;
  if (!wasShared && Number(row.quantity) === legsCount && Number.isFinite(Number(row.amount)) && Number(row.amount) >= 0) {
    regularPerLegOverride = Number(row.amount) / legsCount;
  }
  const desired = computeDeliveryObligationPreview({
    isDelivery: true,
    deliveryCity: order.deliveryCity,
    customerCity: order.customer?.city,
    allowCustomerCityFallback: settings.allowCustomerCityFallback,
    deliveryDirection: order.deliveryDirection,
    deliveryPriceByCity: settings.priceByCityRaw,
    deliveryPrice: settings.flatPriceRaw,
    joinPrice: null,
    existingObligations: [],
    sharedDiscount: { discountedPerLeg: discount ? discount.discountedPerLeg : null, discountedLegs: discount ? discount.discountedLegs : [] },
    regularPerLegOverride,
    ignoreExistingCharge: true,
  });
  const name = customerName(order.customer);
  if (!desired) return { orderId: id, customerName: name, status: 'skipped', reason: 'no-city' };

  const sameAmount = agorot(row.amount) === agorot(desired.amount);
  // תיאור שונה רק בשם העיר (עיר הלקוחה השתנתה) הוא לא שינוי של משלוח משותף - לא כותבים; רק נוכחות הסיומת "משלוח משותף" נחשבת
  const sameSharedMark = isSharedDeliveryDescription(row.description) === isSharedDeliveryDescription(desired.description);
  if (sameAmount && Number(row.quantity) === Number(desired.quantity) && sameSharedMark) {
    return { orderId: id, customerName: name, status: 'unchanged', before: row.amount, after: desired.amount, delta: 0, nowShared: !!(discount && desired.sharedDiscountedLegs?.length) };
  }

  const obligationsSumBefore = order.obligations.reduce((s, o) => s + Number(o.amount || 0), 0);
  const stored = computeStoredTotalAfterDeliveryChange({
    storedTotal: order.totalAmount, obligationsSumBefore, deliveryOld: row.amount, deliveryNew: desired.amount,
  });
  const totalChanged = stored.mode !== 'untouched' && agorot(stored.total) !== agorot(order.totalAmount);

  // dryRun (scripts/shared_delivery_reprice.mjs, ברירת מחדל שם): מחשב ומחזיר את התוצאה בלי שום כתיבה ובלי סנכרון זיכוי
  // סטטוס תשלום שמור: ראה storedStatusFor. החישוב לפי סכום החיובים אחרי השינוי (לא לפי totalAmount, שבו הבאג הידוע של "בלי משלוח")
  const paidNow = order.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const obligationsAfter = order.obligations.reduce((s, o) => s + Number(o.amount || 0), 0) - Number(row.amount) + Number(desired.amount);
  const newStatus = storedStatusFor(order.status, obligationsAfter, paidNow);
  const statusChanged = newStatus !== order.status;

  if (!dryRun) await prisma.$transaction(async (tx) => {
    await tx.paymentObligation.update(auditAs('DELIVERY_REPRICED', {
      where: { id: row.id },
      data: { amount: desired.amount, quantity: desired.quantity, description: desired.description },
    }, {
      amount: { from: row.amount, to: desired.amount },
      description: { from: row.description, to: desired.description },
      note: reason || 'משלוח משותף - חישוב מחדש של חיוב המשלוח',
    }));
    if (totalChanged) {
      await tx.order.update(auditAs('DELIVERY_TOTAL_SYNC', {
        where: { orderId: id },
        data: { totalAmount: stored.total },
      }, { totalAmount: { from: order.totalAmount, to: stored.total }, note: 'סכום ההזמנה עודכן לפי חיוב המשלוח' }));
    }
    if (statusChanged) {
      await tx.order.update(auditAs('DELIVERY_PAYMENT_STATUS', {
        where: { orderId: id },
        data: { status: newStatus },
      }, { status: { from: order.status, to: newStatus }, note: 'סטטוס התשלום עודכן אחרי שינוי חיוב המשלוח' }));
    }
  }, { timeout: 30000, maxWait: 15000 });

  if (!dryRun) await syncPendingCreditRefund(id);

  const paid = order.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const obligationsSumAfter = obligationsSumBefore - Number(row.amount) + Number(desired.amount);
  const required = totalChanged ? stored.total : (order.totalAmount && order.totalAmount > 0 ? order.totalAmount : obligationsSumAfter);
  const balance = round2(required - paid); // חיובי = חוב לתשלום, שלילי = יתרת זכות
  return {
    orderId: id,
    customerName: name,
    status: 'updated',
    dryRun: !!dryRun,
    isPrimary: state && state.byOrder.get(id) ? !!state.byOrder.get(id).info.isPrimary : null,
    before: round2(row.amount),
    after: round2(desired.amount),
    delta: round2(desired.amount - row.amount),
    wasShared,
    nowShared: !!(desired.sharedDiscountedLegs && desired.sharedDiscountedLegs.length),
    debtAmount: balance > 0 ? balance : 0,
    creditAmount: balance < 0 ? round2(-balance) : 0,
    totalMismatch: !!stored.mismatch,
    statusFrom: statusChanged ? order.status : null,
    statusTo: statusChanged ? newStatus : null,
  };
}

// סטטוס תשלום שמור (Order.status): נקבע ביצירה ('חדש' / 'שולם חלקי' / 'שולם', deriveConfirmedOrderStatus) ולא מתעדכן בתשלומים מאוחרים.
// החלטת הבעלים 12.10.2026 (סעיף 16): כשחיוב המשלוח משתנה בהזמנה ששולמה, הסטטוס השמור עוקב אחרי היתרה - לפי calculatePaymentStatus
// (lib/orderStatus.js), בלי לוגיקה חדשה: 'שולם' / 'ממתין לזיכוי' => 'שולם'; 'שולם חלקי' => 'שולם חלקי'; 'לא שולם' => 'חדש' (ערך היצירה).
// נוגעים *רק* בסטטוס ששייך לאוצר המילים הזה ('שולם' / 'שולם חלקי'); 'חדש' / 'טיוטה' / 'שמור לחיוב' / סטטוס אחר לא משתנה.
// אידמפוטנטי: אותו מצב => אותו סטטוס => אפס כתיבות.
// מי צורך את הסטטוס השמור: app/orders/page.js (הרשימה הישנה: סימון "שולם" ומיון), ייצוא / חיפוש AI (app/api/ai/smart-search, app/api/orders GET) -
// כולם משלימים אותו מחישוב מסכומים; רשימות חייבים, יתרות, לוח, הדפסות ותזכורות מחשבים מסכומי החיובים והתשלומים ולא קוראים אותו.
export const PAID_VOCAB_STATUSES = ['שולם', 'שולם חלקי'];
export function storedStatusFor(currentStatus, required, paid) {
  if (!PAID_VOCAB_STATUSES.includes(currentStatus)) return currentStatus;
  const calc = calculatePaymentStatus(round2(required), round2(paid));
  if (calc === 'שולם' || calc === 'ממתין לזיכוי') return 'שולם';
  if (calc === 'שולם חלקי') return 'שולם חלקי';
  return 'חדש';
}

/**
 * מיישר את הסטטוס השמור של הזמנה (ההזמנה שנשמרת עכשיו ב-PUT/POST) לפי היתרה הנוכחית: סכום החיובים הפעילים מול התשלומים.
 * מחזיר { changed, from, to }. לא זורק על הזמנה חסרה.
 */
export async function syncStoredPaymentStatus(orderId, { dryRun = false } = {}) {
  const id = parseInt(orderId, 10);
  const o = await prisma.order.findUnique({
    where: { orderId: id },
    select: { status: true, isDeleted: true, obligations: { where: { isDeleted: false }, select: { amount: true } }, payments: { where: { isDeleted: false }, select: { amount: true } } },
  });
  if (!o || o.isDeleted) return { changed: false, from: null, to: null };
  const required = o.obligations.reduce((s, x) => s + Number(x.amount || 0), 0);
  const paid = o.payments.reduce((s, x) => s + Number(x.amount || 0), 0);
  const to = storedStatusFor(o.status, required, paid);
  if (to === o.status) return { changed: false, from: o.status, to };
  if (!dryRun) await prisma.order.update(auditAs('DELIVERY_PAYMENT_STATUS', { where: { orderId: id }, data: { status: to } }, { status: { from: o.status, to }, note: 'סטטוס התשלום עודכן אחרי שינוי חיוב המשלוח' }));
  return { changed: true, from: o.status, to };
}

/** נוסח ההתראה בעברית להזמנה שחיוב המשלוח שלה השתנה. */
const statusTail = (r) => (r.statusTo ? ` סטטוס התשלום עודכן ל"${r.statusTo}".` : '');
export function describeRepriceNotice(r) {
  if (!r || r.status !== 'updated') return null;
  const head = `הזמנה #${r.orderId} (${r.customerName})`;
  if (r.delta < 0) {
    const tail = r.creditAmount > 0
      ? ` נרשמה בקשת זיכוי אוטומטית על ${r.creditAmount} ₪ (יתרת זכות) - יש לטפל בה מכרטיס ההזמנה.`
      : (r.debtAmount > 0 ? ` נותרה יתרה לתשלום ${r.debtAmount} ₪.` : '');
    return `${head}: חיוב המשלוח הופחת מ-${r.before} ₪ ל-${r.after} ₪ (משלוח משותף).${tail}${statusTail(r)}`;
  }
  const tail = r.debtAmount > 0 ? ` יש לגבות ${r.debtAmount} ₪ נוספים.` : '';
  return `${head}: חיוב המשלוח עלה מ-${r.before} ₪ ל-${r.after} ₪ (כבר אינו מוזל / הפך ל"משלוח ראשי").${tail}${statusTail(r)}`;
}

/**
 * מיישר מחדש את חיוב המשלוח של כל חברי הקבוצות שצוינו (אחרי שינוי: הזמנה חדשה / עריכת כתובת או תאריך / ביטול / החלפת ראשי / כתובת לקוח).
 *  groupKeys: מפתחות `${dayKey}|${addressKey}` (לפני ואחרי השינוי). excludeOrderIds: הזמנות שמחושבות בנפרד (זו שנשמרת עכשיו).
 *  ימים שעברו לא נוגעים (includePast=true לדריסה) - הזמנות שהאירוע שלהן עבר כבר נמסרו וחויבו.
 * מחזיר { enabled, results, notices } (notices = נוסח עברי לכל הזמנה שהסכום שלה השתנה). לא זורק: כישלון בהזמנה אחת נרשם ב-results ולא עוצר את השאר.
 */
export async function reconcileSharedDelivery({ groupKeys = [], excludeOrderIds = [], includePast = false, reason, dryRun = false } = {}) {
  const settings = await loadSharedDeliverySettings();
  if (!settings.enabled) return { enabled: false, results: [], notices: [] };
  const keys = [...new Set((groupKeys || []).filter(Boolean))];
  const exclude = new Set((excludeOrderIds || []).map(Number));
  const today = getIsraelTodayKey();
  const byDay = new Map();
  for (const k of keys) {
    const day = String(k).split('|')[0];
    if (!includePast && day < today) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(k);
  }
  const results = [];
  for (const [day, dayKeys] of byDay) {
    const state = await getDayState(day, settings);
    const done = new Set();
    for (const k of dayKeys) {
      const group = state.groups.get(k);
      if (!group) continue;
      for (const m of group.members) {
        if (exclude.has(m.orderId) || done.has(m.orderId)) continue;
        done.add(m.orderId);
        try {
          results.push({ groupKey: k, ...(await repriceDeliveryCharge(m.orderId, { settings, state, reason, dryRun })) });
        } catch (e) {
          console.error(`shared delivery: reprice of order ${m.orderId} failed`, e);
          results.push({ orderId: m.orderId, status: 'error', error: String(e?.message || e) });
        }
      }
    }
  }
  const notices = results.filter((r) => r.status === 'updated').map((r) => ({ ...r, message: describeRepriceNotice(r) }));
  return { enabled: true, results, notices };
}

// ---------------------------------------------------------------------------------------------
// כרטיס ההזמנה: מצב + החלפת "משלוח ראשי"
// ---------------------------------------------------------------------------------------------

/** המצב להצגה בכרטיס הזמנה שמורה. enabled=false => הכרטיס לא מציג כלום. */
export async function getSharedDeliveryInfo(orderId) {
  const settings = await loadSharedDeliverySettings();
  if (!settings.enabled) return { enabled: false };
  const id = Number(orderId);
  const o = await prisma.order.findUnique({ where: { orderId: id }, select: ORDER_FIELDS });
  if (!o || o.isDeleted || !o.isDelivery) return { enabled: true, shared: false, applicable: false };
  const m0 = memberFromOrder(o, settings);
  if (!m0.groupKey) return { enabled: true, shared: false, applicable: false, reason: 'no-address-key' };
  const state = await getDayState(m0.dayKey, settings);
  const entry = state.byOrder.get(id);
  if (!entry) return { enabled: true, shared: false, applicable: false, reason: 'explicit-join' };
  const group = state.groups.get(entry.groupKey);
  const ids = group.members.map((m) => m.orderId);
  const oblig = ids.length
    ? await prisma.paymentObligation.findMany({ where: { orderId: { in: ids }, isDeleted: false, isManual: false, description: { contains: DELIVERY_WORD } }, select: { orderId: true, amount: true, description: true } })
    : [];
  const amountOf = new Map(oblig.map((x) => [x.orderId, x]));
  const discountPerLeg = discountedPricePerLeg(settings, entry.member.pricedCity);
  return {
    enabled: true,
    applicable: true,
    shared: entry.info.sharedWith.length > 0,
    groupKey: entry.groupKey,
    dayKey: m0.dayKey,
    isPrimary: entry.info.isPrimary,
    primaryOrderId: entry.plan.primaryOrderId,
    discountedLegs: [...entry.info.discountedLegs],
    discountConfigured: discountPerLeg !== null,
    canChangePrimary: isJoinTableUsable(),
    members: group.members.map((m) => ({
      orderId: m.orderId,
      customerName: m.customerName,
      isPrimary: m.orderId === entry.plan.primaryOrderId,
      isSelf: m.orderId === id,
      direction: m.direction || 'הלוך-חזור',
      discountedLegs: [...(group.plan.perOrder.get(m.orderId)?.discountedLegs || [])],
      deliveryAmount: amountOf.has(m.orderId) ? round2(amountOf.get(m.orderId).amount) : null,
    })),
  };
}

/**
 * קובע את `primaryOrderId` כ"משלוח ראשי" בקבוצה של `orderId` ומחשב מחדש את כל החברים (כולל ההזמנה עצמה).
 * מחזיר { ok, changed, error?, notices, info }. ההזמנות שנעלמה/הופיעה בהן הנחה רשומות ב-notices (עם קישור לפי orderId).
 */
export async function setSharedDeliveryPrimary(orderId, primaryOrderId) {
  const settings = await loadSharedDeliverySettings();
  if (!settings.enabled) return { ok: false, changed: false, error: 'משלוח משותף אינו פעיל' };
  const id = Number(orderId);
  const target = Number(primaryOrderId);
  const o = await prisma.order.findUnique({ where: { orderId: id }, select: ORDER_FIELDS });
  if (!o || o.isDeleted || !o.isDelivery) return { ok: false, changed: false, error: 'ההזמנה אינה הזמנת משלוח פעילה' };
  const m0 = memberFromOrder(o, settings);
  if (!m0.groupKey) return { ok: false, changed: false, error: 'להזמנה אין כתובת משלוח מזוהה (עיר + רחוב + מספר בית)' };
  const state = await getDayState(m0.dayKey, settings);
  const entry = state.byOrder.get(id);
  if (!entry) return { ok: false, changed: false, error: 'ההזמנה מצטרפת למשלוח אחר ולכן אינה חלק מקבוצת משלוח משותף' };
  const group = state.groups.get(entry.groupKey);
  if (group.members.length < 2) return { ok: false, changed: false, error: 'אין הזמנות נוספות לאותה כתובת באותו יום' };
  if (!group.members.some((m) => m.orderId === target)) return { ok: false, changed: false, error: 'ההזמנה שנבחרה אינה בקבוצת המשלוח של כתובת זו' };
  if (entry.plan.primaryOrderId === target) return { ok: true, changed: false, notices: [], info: await getSharedDeliveryInfo(id) };
  if (!isJoinTableUsable()) return { ok: false, changed: false, unavailable: true, error: 'החלפת "משלוח ראשי" אינה זמינה כרגע' };

  // מנקים סימון מהאחרים, מסמנים את הנבחרת. אם הנבחרת היא ברירת המחדל (הראשונה ברישום) - מספיק לנקות את כולם.
  const defaultPrimary = [...group.members].sort(compareByRegistration)[0].orderId;
  for (const m of group.members) {
    if (m.orderId === target) continue;
    if (m.primaryFlag) {
      const r = await setSharedPrimaryFlag(m.orderId, false);
      if (!r.ok) return { ok: false, changed: false, error: r.error || 'ניקוי סימון "משלוח ראשי" נכשל' };
    }
  }
  const mark = await setSharedPrimaryFlag(target, target !== defaultPrimary ? true : false);
  if (!mark.ok) return { ok: false, changed: false, error: mark.error || 'סימון "משלוח ראשי" נכשל' };

  const rec = await reconcileSharedDelivery({ groupKeys: [entry.groupKey], reason: `החלפת "משלוח ראשי" ל-#${target}` });
  return { ok: true, changed: true, notices: rec.notices, results: rec.results, info: await getSharedDeliveryInfo(id) };
}

// ---------------------------------------------------------------------------------------------
// שינוי כתובת בכרטיס לקוח
// ---------------------------------------------------------------------------------------------

/**
 * אחרי עדכון כתובת / עיר בכרטיס לקוח: הזמנות עתידיות של הלקוחה שכתובת המשלוח שלהן היא כתובת הכרטיס (אין כתובת משלוח מפורשת)
 * ייתכן שיצאו מקבוצה (חוזרות למחיר מלא - צריך לגבות) או ייכנסו לאחת (מוזלות). מיישר את הקבוצות הישנות והחדשות.
 *  before: { street, houseNum, city } של הלקוחה לפני העדכון (השורה שנקראה לפני ה-update).
 * מחזיר { enabled, notices, affectedOrders }.
 */
export async function reconcileAfterCustomerAddressChange(customerId, before) {
  const settings = await loadSharedDeliverySettings();
  if (!settings.enabled) return { enabled: false, notices: [], results: [], affectedOrders: [] };
  const todayKey = getIsraelTodayKey();
  const todayStart = getIsraelDayRange(todayKey).start;
  const orders = await prisma.order.findMany({
    where: {
      customerId, isDeleted: false, isDelivery: true,
      AND: [
        { OR: [{ eventDate: { gte: todayStart } }, { eventDate: null, fromDate: { gte: todayStart } }] },
        { OR: [{ status: null }, { status: { notIn: [DRAFT_ORDER_STATUS, RESERVED_ORDER_STATUS] } }] },
      ],
    },
    select: ORDER_FIELDS,
  });
  const keys = new Set();
  const affected = [];
  for (const o of orders) {
    // הזמנה עם כתובת משלוח מפורשת לא תלויה בכתובת הלקוחה (חוץ מהעיר שלפיה היא מחויבת, כשאין deliveryCity)
    const after = memberFromOrder(o, settings);
    const beforeMember = memberFromOrder({ ...o, customer: { ...(o.customer || {}), street: before.street, houseNum: before.houseNum, city: before.city } }, settings);
    if (beforeMember.groupKey) keys.add(beforeMember.groupKey);
    if (after.groupKey) keys.add(after.groupKey);
    if (beforeMember.groupKey !== after.groupKey) affected.push(o.orderId);
  }
  if (keys.size === 0) return { enabled: true, notices: [], results: [], affectedOrders: [] };
  const rec = await reconcileSharedDelivery({ groupKeys: [...keys], reason: 'שינוי כתובת בכרטיס הלקוחה - משלוח משותף' });
  return { enabled: true, notices: rec.notices, results: rec.results, affectedOrders: affected };
}
