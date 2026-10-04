// lib/schedule/print/singleOrder.js — טוען הזמנה אחת ובונה ממנה "יום" סינתטי (באותה צורה ש-getScheduleDay מחזיר) כך שדפי ההדפסה
// PP-07 (דף הכנה, גרסה ב׳) ו-PP-12 (תעודת משלוח) ירנדרו אותה בלי לדעת שזו לא רשימת יום. ר' lib/schedule/print/orderMode.js.
//
// למה לא getScheduleDay(date): ההזמנה שייכת ליום הכנה/משלוח מחושב מתאריך האירוע, ועובדת שפותחת את כרטיס ההזמנה רוצה את הדף עכשיו -
// גם אם היום אינו יום ההכנה, וגם אם שלב ההכנה כבוי בהגדרות הלו״ז. לכן השורה נבנית ישר מההזמנה, בדיוק בפונקציה שהלו״ז משתמש בה
// (buildEventStageRow של loaders.js) ובאותה צורת שורת משלוח (deliveryRow). קריאה בלבד: findUnique אחד + שאילתת שמות דגמים (רק אם צריך),
// בלי $transaction, בלי כתיבה. התאריך שבכותרת = יום ההכנה / יום יציאת המשלוח המחושב (או היום כשאין תאריך אירוע).
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { addBusinessDays as plusBusiness, NON_WORKING_DAYS_SETTING_KEY, parseNonWorkingDaysSetting } from '@/lib/businessDays';
import { STAGES, STAGE_BY_KEY } from '@/lib/schedule/stages';
import { loadScheduleSettings } from '@/lib/schedule/settings';
import { ORDER_SELECT, buildEventStageRow, effectiveStartKey } from '@/lib/schedule/loaders';
import { isDeliveryOut } from '@/lib/schedule/deliveryDirection';
import { addBusinessDays, dayStatus, hebrewLabel, instantToKey, todayKey, weekdayLabel } from '@/lib/schedule/dates';
import { ORDER_MODE_PAGES } from './orderMode';

export class SingleOrderError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// שורת משלוח הלוך (שלב 5) להזמנה אחת - אותן שדות כמו deliveryRow ב-loaders.js (שם הפונקציה פרטית ומקבלת את צורת getDeliveriesForDate)
function deliveryRowOf(order, dispatchKey, stage) {
  const c = order.customer || {};
  const firstName = c.firstName || '';
  const lastName = c.lastName || '';
  const eventKey = instantToKey(order.eventDate);
  // כמו lib/deliveries.js: כתובת המשלוח של ההזמנה, אחרת רחוב+בית של הלקוחה; עיר המשלוח, אחרת עיר הלקוחה
  const street = order.deliveryAddress || [c.street, c.houseNum].filter(Boolean).join(' ');
  const city = order.deliveryCity || c.city || '';
  const full = street && city ? `${street}, ${city}` : (street || city || '');
  return {
    orderId: order.orderId,
    stage: 'dout',
    customer: { firstName, lastName, name: `${firstName} ${lastName}`.trim() || 'לא ידוע', phone1: c.phone1 || '', phone2: c.phone2 || '' },
    eventDate: order.eventDate || null,
    eventKey,
    eventDateHebrew: order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : null) || null,
    dressCount: (order.items || []).length,
    branch: order.branch || null,
    pickupBranch: order.pickupBranch || null,
    flags: { isAbroad: !!order.isAbroad, isWeekdayEvent: !!order.isWeekdayEvent, extraDay: order.extraDay || null, customSpacing: order.customSpacing ?? null },
    notes: order.notes || '',
    address: { street, city, full },
    dispatchDate: dispatchKey || null,
    chargeExists: false,
    done: null,
    doneSource: stage.doneSource,
    alerts: [],
  };
}

/**
 * @param {object} p
 * @param {number} p.orderId
 * @param {string[]} p.keys      מפתחות דפים מ-ORDER_MODE_PAGES (PP-07 / PP-12)
 * @param {Date} [p.now]
 * @param {object} [p.client]    prisma (לבדיקות)
 * @returns {Promise<object>} אובייקט "יום" ל-loadExtras/buildPrintPayload (+ singleOrderId)
 * @throws {SingleOrderError} 404 (אין הזמנה) / 400 (אין משלוח הלוך להזמנה / משלוחים כבויים)
 */
export async function loadSingleOrderDay({ orderId, keys, now = new Date(), client = prisma }) {
  const settings = await loadScheduleSettings();
  const nonWorking = settings.nonWorkingDays;
  const order = await client.order.findUnique({
    where: { orderId },
    select: { ...ORDER_SELECT, deliveryAddress: true, deliveryCity: true, deliveryOneDayBefore: true, isDeleted: true },
  });
  if (!order) throw new SingleOrderError(404, 'ההזמנה לא נמצאה');

  const today = todayKey(now);
  const startKey = effectiveStartKey(order);
  const wantPrep = keys.includes('PP-07');
  const wantDelivery = keys.includes('PP-12');
  if (wantDelivery) {
    if (!settings.deliveriesEnabled) throw new SingleOrderError(400, 'המשלוחים כבויים בהגדרות - אין תעודת משלוח');
    if (!isDeliveryOut(order)) throw new SingleOrderError(400, 'להזמנה זו אין משלוח הלוך - אין תעודת משלוח');
  }

  const rowsByStage = {};
  let dayKey = null;

  if (wantPrep) {
    // שמות דגמים לפריטים בלי DressItem משויך - שאילתה אחת לפי קידומת (כמו loadEventStageRows)
    const prefixes = new Set();
    for (const it of order.items || []) if (!it.dressItem?.dress?.name && it.barcodePrefix != null) prefixes.add(it.barcodePrefix);
    let modelByPrefix = {};
    if (prefixes.size) {
      const models = await client.dressModel.findMany({ where: { barcodePrefix: { in: [...prefixes] } }, select: { barcodePrefix: true, name: true } });
      modelByPrefix = Object.fromEntries(models.map((m) => [m.barcodePrefix, m.name]));
    }
    const ctx = { dayKey: today, todayKey: today, stageDefs: STAGE_BY_KEY, stageSettings: settings.stages, nonWorkingDays: nonWorking, includeInternalNotes: false };
    rowsByStage.prep = [buildEventStageRow(order, 'prep', ctx, modelByPrefix)];
    const offset = settings.stages.prep ? settings.stages.prep.offset : STAGE_BY_KEY.prep.defaultOffset;
    if (startKey) dayKey = addBusinessDays(startKey, offset, nonWorking);
  }

  if (wantDelivery) {
    // יום היציאה: אותה נוסחה כמו lib/deliveries.js (delivery_days_before, "יום לפני", שישי/שבת לפי delivery_skip_weekends)
    const rows = await getAllCachedSettings().catch(() => []);
    const map = {};
    for (const r of rows || []) if (r && r.key) map[r.key] = r.value;
    const parsedBefore = parseInt(map.delivery_days_before, 10);
    const daysBefore = Number.isNaN(parsedBefore) ? 1 : parsedBefore;
    const nw = parseNonWorkingDaysSetting(map[NON_WORKING_DAYS_SETTING_KEY] ?? null);
    const dispatchKey = startKey ? plusBusiness(startKey, -(order.deliveryOneDayBefore ? 1 : daysBefore), nw, { skipWeekend: map.delivery_skip_weekends === 'true' }) : null;
    rowsByStage.dout = [deliveryRowOf(order, dispatchKey, STAGE_BY_KEY.dout)];
    if (!dayKey && dispatchKey) dayKey = dispatchKey;
  }

  dayKey = dayKey || today;
  const status = dayStatus(dayKey, nonWorking);
  const stages = STAGES.map((stage) => {
    const items = rowsByStage[stage.key] || [];
    return {
      key: stage.key, number: stage.number, label: stage.label, plural: stage.plural, what: stage.what, infoOnly: stage.infoOnly,
      enabled: true, offsetBusinessDays: null, shift: 'none', shiftLabel: '', doneSource: stage.doneSource,
      showModel: stage.showModel, showAddress: stage.showAddress,
      counts: { total: items.length, done: 0, pending: 0, unknown: items.length, alerts: 0 }, items,
    };
  });
  return {
    date: dayKey,
    dateHebrew: hebrewLabel(dayKey),
    weekday: weekdayLabel(dayKey),
    isToday: dayKey === today,
    today,
    nonWorkingDay: !status.working,
    dayStatus: { working: status.working, reasons: status.reasons, titles: status.titles, note: status.note },
    generatedAt: now.toISOString(),
    settings: { deliveriesEnabled: settings.deliveriesEnabled, branchFilter: null, pickupHours: settings.pickupHours, includeInternalNotes: false },
    staff: [],
    stages,
    totals: { total: 0, done: 0, pending: 0, unknown: 0, alerts: 0 },
    truncated: false,
    warnings: [],
    marks: { available: false, canMark: false, canMarkAll: false },
    singleOrderId: order.orderId,
    singleOrderDeleted: !!order.isDeleted,
  };
}

// נוח לבדיקות ולרישום: איזה דף שייך לאיזה שלב
export const ORDER_MODE_STAGE = Object.fromEntries(Object.entries(ORDER_MODE_PAGES).map(([k, v]) => [k, v.stage]));
