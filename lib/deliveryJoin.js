import prisma, { auditAs } from '@/app/lib/prisma';
import { getCachedSetting } from '@/lib/settingsCache';
import { getIsraelDayRange } from '@/lib/hebrewDate';

// "הצטרפות למשלוח קיים" (מייל נווה יעקב 2026-09-25, סעיף 2; R49 בכרטיס ההזמנה החדש) - הזמנה שמצטרפת למשלוח של הזמנה אחרת
// באותו יום ובאותו כיוון: מקבלת את כתובת/עיר המשלוח שלה, מחויבת במחיר הצטרפות (delivery_join_price,
// 20 ש"ח לצד בנווה יעקב), ואפשר לסמן מי מלקוחות הכתובת הוא ה"ראשי" (מודפס למשלוחן/על השקית).
//
// פורט של lib/deliveryJoin.js מהענף feature/neve-batch-2026-09-25 (wt-neve-batch-2026-09-25), עם שלושה שינויים מכוונים:
//  1. אין DDL בזמן ריצה: ensureDeliveryJoinTable() (CREATE TABLE IF NOT EXISTS מתוך הקוד) הוסר. הטבלה נוצרת רק ב-SQL ידני
//     מאושר (prisma/migrations-pending/2026-10-04-delivery-join.sql, DDL-1). עד אז / כשהמודל חסר בקליינט - כל הפונקציות
//     מתנהגות כ"כבוי" (בלי זריקה): P2021 / 42P01 נתפסים, ובדיקה חוזרת רק אחרי TABLE_RECHECK_MS (אותו דפוס כמו
//     lib/schedule/marks.js ו-lib/loginDeviceRegistry.js).
//  2. כתיבות דרך prisma.deliveryJoin.* (create / update / delete עם auditAs) ולא SQL גולמי - כך תוסף ה-audit רושם אותן
//     (upsert / updateMany לא נרשמים, ולכן אין בהם שימוש). אין AuditLog ידני ואין $transaction.
//  3. קריאות בשאילתות Prisma רגילות (בלי $queryRawUnsafe).
//
// מבנה הטבלה (model DeliveryJoin ב-prisma/schema.prisma):
//   orderId          - ההזמנה עצמה (PK)
//   joinedToOrderId  - "שורש" הקבוצה (ההזמנה שאליה הצטרפו). NULL = השורה קיימת רק כדי לשמור isPrimary לשורש.
//   isPrimary        - האם ההזמנה היא ה"ראשי" בקבוצת הכתובת (לכל היותר אחד בקבוצה).
//   direction        - deliveryDirection של ההזמנה בעת ההצטרפות ('הלוך' | 'חזור' | 'הלוך-חזור').
// קבוצה = שורש + כל השורות עם joinedToOrderId = שורש. הצטרפות למצטרף מתורגמת לשורש שלו (בלי שרשראות).

// ---------------------------------------------------------------------------------------------
// זמינות הטבלה (DDL-1 טרם הורץ => "כבוי" בלי שגיאות)
// ---------------------------------------------------------------------------------------------
export const TABLE_RECHECK_MS = 5 * 60 * 1000;
let tableMissingUntil = 0;
export function resetDeliveryJoinTableState() { tableMissingUntil = 0; }
export function isDeliveryJoinTableMarkedMissing(now = Date.now()) { return now < tableMissingUntil; }

export function isMissingTableError(e) {
  if (!e) return false;
  if (e.code === 'P2021') return true;
  const msg = String(e.message || e.meta?.message || '');
  return /DeliveryJoin.*does not exist|does not exist.*DeliveryJoin|42P01/i.test(msg);
}

// הקליינט של Prisma נבנה לפני שהמודל נוסף לסכימה (קליינט מיושן ב-globalThis בפיתוח / build ישן): prisma.deliveryJoin
// הוא undefined ו-.findMany היה זורק TypeError סינכרוני - מתייחסים לזה כמו לטבלה חסרה.
export function isJoinModelAvailable(client = prisma) {
  try {
    return !!(client && typeof client.deliveryJoin !== 'undefined' && client.deliveryJoin);
  } catch {
    return false;
  }
}

function markTableMissing(reason) {
  tableMissingUntil = Date.now() + TABLE_RECHECK_MS;
  console.warn(`delivery join: ${reason} - feature off until DDL-1 (prisma/migrations-pending/2026-10-04-delivery-join.sql) is applied / the client is regenerated`);
}

/** האם אפשר לגשת לטבלה עכשיו (המודל קיים בקליינט ולא סומנה כחסרה לאחרונה). */
export function isJoinTableUsable() {
  if (Date.now() < tableMissingUntil) return false;
  if (!isJoinModelAvailable()) { markTableMissing('prisma client has no deliveryJoin model'); return false; }
  return true;
}

// מריץ פעולה על הטבלה; "טבלה חסרה" => מסמן + מחזיר fallback (לא זורק). כל שגיאה אחרת נזרקת הלאה.
async function guarded(fn, fallback) {
  if (!isJoinTableUsable()) return fallback;
  try {
    return await fn();
  } catch (e) {
    if (isMissingTableError(e)) { markTableMissing('table "DeliveryJoin" does not exist'); return fallback; }
    throw e;
  }
}

/** ההגדרה בלבד (enable_delivery_join). חסר = כבוי = ההתנהגות הישנה. */
export async function isDeliveryJoinEnabled() {
  const row = await getCachedSetting('enable_delivery_join');
  return row?.value === 'true';
}

/**
 * ההגדרה דלוקה וגם הטבלה קיימת. הבדיקה הראשונה שואלת את הטבלה (שאילתה קטנה); תוצאה שלילית נזכרת TABLE_RECHECK_MS.
 * זה מה שהממשק והמסלולים בודקים - "הטבלה חסרה" נראה כמו הגדרה כבויה.
 */
export async function isDeliveryJoinAvailable() {
  if (!(await isDeliveryJoinEnabled())) return false;
  const probe = await guarded(async () => { await prisma.deliveryJoin.findFirst({ select: { orderId: true } }); return true; }, false);
  return probe;
}

// מחיר הצטרפות לצד אחד (מספר) או null כשלא מוגדר/כבוי - null = מחיר המשלוח הרגיל.
export async function getDeliveryJoinPrice() {
  if (!(await isDeliveryJoinEnabled())) return null;
  const row = await getCachedSetting('delivery_join_price');
  const n = parseFloat(row?.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// שורות ההצטרפות של קבוצת הזמנות -> Map(orderId -> {joinedToOrderId,isPrimary,direction}).
// מחזיר Map ריק (ולא זורק) כש-DeliveryJoin לא נגישה - כדי שמסך המשלוחים לא יישבר בגלל פיצ'ר צד.
export async function getJoinRows(orderIds) {
  const map = new Map();
  const ids = [...new Set((orderIds || []).map(Number).filter(Number.isInteger))];
  if (ids.length === 0) return map;
  try {
    const rows = await guarded(() => prisma.deliveryJoin.findMany({
      where: { OR: [{ orderId: { in: ids } }, { joinedToOrderId: { in: ids } }] },
      select: { orderId: true, joinedToOrderId: true, isPrimary: true, direction: true },
    }), []);
    for (const r of rows) {
      map.set(r.orderId, { joinedToOrderId: r.joinedToOrderId, isPrimary: !!r.isPrimary, direction: r.direction });
    }
  } catch (err) {
    console.error('getJoinRows failed', err);
  }
  return map;
}

// האם להזמנה יש הצטרפות פעילה (joinedToOrderId לא ריק) - לחיוב במחיר הצטרפות.
export async function isOrderJoined(orderId) {
  try {
    const row = await guarded(() => prisma.deliveryJoin.findUnique({ where: { orderId: Number(orderId) }, select: { joinedToOrderId: true } }), null);
    return !!(row && row.joinedToOrderId);
  } catch (err) {
    console.error('isOrderJoined failed', err);
    return false;
  }
}

// כתובת משלוח אפקטיבית של הזמנה (זהה ללוגיקה של lib/deliveries.js): כתובת משלוח מפורשת, אחרת רחוב הלקוח.
export function effectiveAddress(order) {
  const street = order.deliveryAddress || [order.customer?.street, order.customer?.houseNum].filter(Boolean).join(' ');
  const city = order.deliveryCity || order.customer?.city || '';
  return { street: street || '', city: city || '' };
}

const CUSTOMER_SELECT = { select: { firstName: true, lastName: true, phone1: true, phone2: true, city: true, street: true, houseNum: true } };

// מחזיר את השורש של הקבוצה שהזמנה שייכת אליה (או עצמה אם אין הצטרפות).
async function resolveRoot(orderId) {
  const row = await prisma.deliveryJoin.findUnique({ where: { orderId: Number(orderId) }, select: { joinedToOrderId: true } });
  return row?.joinedToOrderId ?? Number(orderId);
}

// כל חברי הקבוצה (שורש + מצטרפים) עם שם/כתובת/סטטוס "ראשי". טבלה חסרה => [].
export async function getJoinGroup(rootOrderId) {
  const root = Number(rootOrderId);
  const rows = await guarded(async () => {
    const [joined, rootRow] = await Promise.all([
      prisma.deliveryJoin.findMany({ where: { joinedToOrderId: root }, select: { orderId: true, isPrimary: true } }),
      prisma.deliveryJoin.findUnique({ where: { orderId: root }, select: { isPrimary: true } }),
    ]);
    return { joined, rootRow };
  }, null);
  if (!rows) return [];
  const primaryMap = new Map(rows.joined.map(r => [r.orderId, !!r.isPrimary]));
  primaryMap.set(root, !!rows.rootRow?.isPrimary);
  const orders = await prisma.order.findMany({
    where: { orderId: { in: [...primaryMap.keys()] }, isDeleted: false },
    select: { orderId: true, deliveryAddress: true, deliveryCity: true, customer: CUSTOMER_SELECT },
    orderBy: { orderId: 'asc' },
  });
  return orders.map(o => ({
    orderId: o.orderId,
    customerName: `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim() || 'לא ידוע',
    isPrimary: primaryMap.get(o.orderId) || false,
    isRoot: o.orderId === root,
    ...effectiveAddress(o),
  }));
}

// מצב ההצטרפות של הזמנה (לטופס העריכה): לאיזה שורש היא מצורפת, והקבוצה כולה.
export async function getJoinInfo(orderId) {
  const id = Number(orderId);
  const row = await guarded(() => prisma.deliveryJoin.findUnique({ where: { orderId: id }, select: { joinedToOrderId: true, isPrimary: true } }), undefined);
  if (row === undefined) return { orderId: id, joinedToOrderId: null, rootOrderId: id, isPrimary: false, group: [] };
  const joinedToOrderId = row?.joinedToOrderId ?? null;
  const rootOrderId = joinedToOrderId ?? id;
  const group = await getJoinGroup(rootOrderId);
  const hasJoiners = group.some(g => g.orderId !== rootOrderId);
  return {
    orderId: id,
    joinedToOrderId,
    rootOrderId,
    isPrimary: !!row?.isPrimary,
    group: joinedToOrderId || hasJoiners ? group : [],
  };
}

/**
 * משלוחים שהזמנה חדשה/קיימת יכולה להצטרף אליהם: אותו יום אירוע (לפי היום הישראלי) ואותו כיוון -
 * הלוך מצטרף להלוך, חזור לחזור (הלוך-חזור מצטרף רק למשלוח שכולל את שני הכיוונים). אותו יום אירוע
 * + אותם ימי לפני/אחרי (הגדרות גלובליות) = אותו יום יציאה/איסוף; ההעדפה "יוצא יום לפני" חייבת להיות
 * זהה כי היא מזיזה את יום היציאה. מציג רק "שורשים" (הזמנות שלא מצורפות לאחרות), עם המצטרפים כבר.
 */
export async function listJoinCandidates({ eventDateIso, direction, oneDayBefore, excludeOrderId }) {
  const range = getIsraelDayRange(eventDateIso);
  const wanted = direction === 'הלוך' || direction === 'חזור' ? [direction] : ['הלוך', 'חזור'];
  const orders = await prisma.order.findMany({
    where: {
      isDeleted: false,
      isDelivery: true,
      eventDate: { gte: range.start, lte: range.end },
      ...(excludeOrderId ? { orderId: { not: Number(excludeOrderId) } } : {}),
    },
    select: {
      orderId: true, deliveryAddress: true, deliveryCity: true, deliveryDirection: true, deliveryOneDayBefore: true,
      customer: CUSTOMER_SELECT,
    },
    orderBy: { orderId: 'asc' },
  });
  const rowMap = await getJoinRows(orders.map(o => o.orderId));
  const joinerCounts = new Map();
  for (const r of rowMap.values()) {
    if (r.joinedToOrderId) joinerCounts.set(r.joinedToOrderId, (joinerCounts.get(r.joinedToOrderId) || 0) + 1);
  }
  const result = [];
  for (const o of orders) {
    if (rowMap.get(o.orderId)?.joinedToOrderId) continue; // מצטרף - לא שורש
    const cand = o.deliveryDirection || 'הלוך-חזור';
    const covers = wanted.every(w => cand === 'הלוך-חזור' || cand === w);
    if (!covers) continue;
    if (wanted.includes('הלוך') && !!o.deliveryOneDayBefore !== !!oneDayBefore) continue;
    const addr = effectiveAddress(o);
    if (!addr.street && !addr.city) continue;
    result.push({
      orderId: o.orderId,
      customerName: `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim() || 'לא ידוע',
      direction: cand,
      street: addr.street,
      city: addr.city,
      address: addr.street && addr.city ? `${addr.street}, ${addr.city}` : (addr.street || addr.city),
      joinedCount: joinerCounts.get(o.orderId) || 0,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// כתיבות (create / update / delete עם auditAs - כך תוסף ה-audit של Prisma רושם; בלי upsert / updateMany)
// ---------------------------------------------------------------------------------------------
const isUniqueViolation = (e) => e && e.code === 'P2002';

// שורת הצטרפות להזמנה (joinedToOrderId = שורש, isPrimary נשמר אם כבר היה). אידמפוטנטי: בלי כתיבה כשאין שינוי.
async function writeJoinRow(orderId, rootOrderId, direction) {
  const where = { orderId };
  const existing = await prisma.deliveryJoin.findUnique({ where });
  if (existing) {
    if (existing.joinedToOrderId === rootOrderId && existing.direction === direction) return;
    await prisma.deliveryJoin.update(auditAs('DELIVERY_JOIN_UPDATED', {
      where, data: { joinedToOrderId: rootOrderId, direction, updatedAt: new Date() },
    }, { joinedToOrderId: { from: existing.joinedToOrderId, to: rootOrderId }, direction: { from: existing.direction, to: direction } }));
    return;
  }
  try {
    await prisma.deliveryJoin.create(auditAs('DELIVERY_JOINED', {
      data: { orderId, joinedToOrderId: rootOrderId, isPrimary: false, direction },
    }, { joinedToOrderId: { from: null, to: rootOrderId }, direction: { from: null, to: direction } }));
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // שתי שמירות בו-זמנית (אותו סגנון כמו ScheduleStageMark): השנייה מעדכנת
    await prisma.deliveryJoin.update(auditAs('DELIVERY_JOIN_UPDATED', {
      where, data: { joinedToOrderId: rootOrderId, direction, updatedAt: new Date() },
    }, { joinedToOrderId: { to: rootOrderId }, direction: { to: direction } }));
  }
}

// מסמן את `primaryOrderId` כ"ראשי" בקבוצה של `rootOrderId` (ומנקה את הסימון משאר החברים).
async function setGroupPrimary(rootOrderId, primaryOrderId) {
  const root = Number(rootOrderId);
  const primary = Number(primaryOrderId);
  const others = await prisma.deliveryJoin.findMany({
    where: { isPrimary: true, orderId: { not: primary }, OR: [{ joinedToOrderId: root }, { orderId: root }] },
    select: { orderId: true },
  });
  for (const o of others) {
    await prisma.deliveryJoin.update(auditAs('DELIVERY_PRIMARY_CLEARED', {
      where: { orderId: o.orderId }, data: { isPrimary: false, updatedAt: new Date() },
    }, { isPrimary: { from: true, to: false } }));
  }
  const mine = await prisma.deliveryJoin.findUnique({ where: { orderId: primary }, select: { isPrimary: true } });
  if (mine) {
    if (mine.isPrimary) return;
    await prisma.deliveryJoin.update(auditAs('DELIVERY_PRIMARY_SET', {
      where: { orderId: primary }, data: { isPrimary: true, updatedAt: new Date() },
    }, { isPrimary: { from: false, to: true } }));
    return;
  }
  try {
    await prisma.deliveryJoin.create(auditAs('DELIVERY_PRIMARY_SET', {
      data: { orderId: primary, joinedToOrderId: null, isPrimary: true },
    }, { isPrimary: { from: false, to: true } }));
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    await prisma.deliveryJoin.update(auditAs('DELIVERY_PRIMARY_SET', {
      where: { orderId: primary }, data: { isPrimary: true, updatedAt: new Date() },
    }, { isPrimary: { to: true } }));
  }
}

/**
 * שמירת הצטרפות/ראשי להזמנה (נקראת מ-POST/PUT של ההזמנה וממסלול /api/deliveries/join).
 * payload: { joinedToOrderId: number|null, primaryOrderId: number|'self'|null|undefined }
 *  - joinedToOrderId מספר: הצטרפות; הכתובת/עיר של ההזמנה נדרסות לאלו של השורש.
 *  - joinedToOrderId null: ביטול הצטרפות (אם הייתה).
 *  - primaryOrderId: מי ה"ראשי" בקבוצה (undefined/null = לא נוגעים).
 * מחזיר { ok, error?, rootOrderId, address, city, unavailable? }. טבלה חסרה => { ok:false, unavailable:true } (בלי זריקה).
 */
export async function saveDeliveryJoin(orderId, payload) {
  if (!isJoinTableUsable()) return { ok: false, unavailable: true, error: 'הצטרפות למשלוח אינה זמינה כרגע' };
  try {
    return await saveDeliveryJoinCore(orderId, payload);
  } catch (e) {
    if (isMissingTableError(e)) { markTableMissing('table "DeliveryJoin" does not exist'); return { ok: false, unavailable: true, error: 'הצטרפות למשלוח אינה זמינה כרגע' }; }
    throw e;
  }
}

async function saveDeliveryJoinCore(orderId, payload) {
  const id = Number(orderId);
  const order = await prisma.order.findUnique({
    where: { orderId: id },
    select: { orderId: true, isDelivery: true, deliveryDirection: true, deliveryAddress: true, deliveryCity: true, customer: CUSTOMER_SELECT },
  });
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };

  const requestedJoin = payload?.joinedToOrderId ? Number(payload.joinedToOrderId) : null;
  let rootOrderId = id;
  let address;
  let city;

  const touchJoin = payload?.joinedToOrderId !== undefined; // חסר = רק ה"ראשי" משתנה, ההצטרפות נשארת
  if (!touchJoin) {
    const own = await prisma.deliveryJoin.findUnique({ where: { orderId: id }, select: { joinedToOrderId: true } });
    rootOrderId = own?.joinedToOrderId ?? id;
  } else if (requestedJoin) {
    if (!order.isDelivery) return { ok: false, error: 'ההזמנה אינה מסומנת כהזמנת משלוח' };
    if (requestedJoin === id) return { ok: false, error: 'לא ניתן להצטרף למשלוח של אותה הזמנה' };
    const ownJoiner = await prisma.deliveryJoin.findFirst({ where: { joinedToOrderId: id }, select: { orderId: true } });
    if (ownJoiner) return { ok: false, error: 'הזמנות אחרות כבר הצטרפו למשלוח של הזמנה זו - לא ניתן לצרף אותה למשלוח אחר' };

    rootOrderId = await resolveRoot(requestedJoin);
    const root = await prisma.order.findUnique({
      where: { orderId: rootOrderId },
      select: { orderId: true, isDelivery: true, isDeleted: true, deliveryAddress: true, deliveryCity: true, customer: CUSTOMER_SELECT },
    });
    if (!root || root.isDeleted || !root.isDelivery) return { ok: false, error: 'המשלוח שנבחר כבר אינו קיים' };

    const addr = effectiveAddress(root);
    address = addr.street;
    city = addr.city;
    if (order.deliveryAddress !== address || order.deliveryCity !== city) {
      await prisma.order.update({ where: { orderId: id }, data: { deliveryAddress: address || null, deliveryCity: city || null } });
    }
    await writeJoinRow(id, rootOrderId, order.deliveryDirection || 'הלוך-חזור');
  } else {
    // ביטול הצטרפות: מוחקים את השורה רק אם היא הצטרפות (שורת "ראשי" של שורש נשארת)
    const own = await prisma.deliveryJoin.findUnique({ where: { orderId: id }, select: { joinedToOrderId: true } });
    if (own?.joinedToOrderId) {
      await prisma.deliveryJoin.delete(auditAs('DELIVERY_JOIN_CANCELLED', { where: { orderId: id } }, { joinedToOrderId: { from: own.joinedToOrderId, to: null } }));
    }
  }

  if (payload?.primaryOrderId !== undefined && payload?.primaryOrderId !== null && payload.primaryOrderId !== '') {
    const primaryId = payload.primaryOrderId === 'self' ? id : Number(payload.primaryOrderId);
    const members = await getJoinGroup(rootOrderId);
    const memberIds = new Set([...members.map(m => m.orderId), id]);
    if (!Number.isInteger(primaryId) || !memberIds.has(primaryId)) {
      return { ok: false, error: 'ההזמנה שסומנה כ"ראשי" אינה חלק מקבוצת המשלוח' };
    }
    await setGroupPrimary(rootOrderId, primaryId);
  }

  return { ok: true, rootOrderId, address, city };
}

// הסרת שורת ההצטרפות של הזמנה שאינה עוד משלוח (מצטרפת בלבד; שורש שיש לו מצטרפים נשאר). טבלה חסרה => no-op.
export async function clearOrderJoin(orderId) {
  const id = Number(orderId);
  await guarded(async () => {
    const own = await prisma.deliveryJoin.findUnique({ where: { orderId: id }, select: { joinedToOrderId: true } });
    if (own?.joinedToOrderId) {
      await prisma.deliveryJoin.delete(auditAs('DELIVERY_JOIN_CANCELLED', { where: { orderId: id } }, { joinedToOrderId: { from: own.joinedToOrderId, to: null } }));
    }
  }, undefined);
}
