// noCapacityLogic.js - הלוגיקה הטהורה של חלון "בדוק תפוסה" בפלטה (R22): אותם כללים, אותן בקשות ואותן הודעות כמו
// components/orders/ItemCapacityModal.js (תפוסה לפריט מהסל) ו-components/CapacitySearchModal.js (חיפוש תפוסה) הישנים.
// בלי React / fetch / DOM - נבדק ב-scripts/new-order-tests/capacity.test.mjs מול הקוד הישן (מחולץ בזמן הבדיקה).
import { addMonthsToDateKey, getIsraelTodayKey } from '../../../lib/hebrewDate';
import { monthStart, nextMonthStart } from '../schedule/hebrewCalendar';

export const CAPACITY_HISTORY_KEY = 'capacity_search_history';
export const CAPACITY_HISTORY_MAX = 50;

// ---------- תפוסה לפריט מהסל (ItemCapacityModal) ----------
// חודש לפני ואחרי תאריך האירוע - אותו חישוב Date מקומי כמו בישן (כולל גלישת סוף חודש של setMonth), כדי שהבקשה תהיה זהה
export function itemCapacityRange(eventDate) {
  const eventD = new Date(eventDate);
  const from = new Date(eventD);
  from.setMonth(from.getMonth() - 1);
  const to = new Date(eventD);
  to.setMonth(to.getMonth() + 1);
  return { fromDate: from.toISOString().split('T')[0], toDate: to.toISOString().split('T')[0] };
}

export const itemCapacityActualSize = (item) => (item && (item.sizeText || item.size)) || undefined;
export const itemCapacityPrefix = (item) => (item && (item.barcodePrefix || (item.dressItem && item.dressItem.barcodePrefix) || (item.dressItem && item.dressItem.dress && item.dressItem.dress.barcodePrefix))) || undefined;
export const itemCapacityModelId = (item) => (item && (item.dressModelId || (item.dressItem && item.dressItem.dressModelId))) || undefined;

// הודעת השגיאה לפני כל בקשה (או null אם אפשר לבדוק) - אותו סדר בדיקות ואותם נוסחים כמו הישן
export function itemCapacityPrecheck(item, order) {
  const hasIdentifier = !!(item && (item.dressModelId || (item.dressItem && item.dressItem.dressModelId) || item.barcodePrefix || (item.dressItem && item.dressItem.barcodePrefix) || (item.dressItem && item.dressItem.dress && item.dressItem.dress.barcodePrefix)));
  const actualSize = itemCapacityActualSize(item);
  if (!order || !order.eventDate) return 'לא הוגדר תאריך אירוע להזמנה זו.';
  if (!hasIdentifier) return 'לא ניתן לבדוק תפוסה לפריט ללא דגם (פריט כללי).';
  if (!actualSize) return 'לא ניתן לבדוק תפוסה לפריט ללא מידה מוגדרת.';
  return null;
}

// GET /api/inventory/capacity?barcodePrefix&size&fromDate&toDate (אותו סדר פרמטרים כמו הישן)
export function capacityQuery({ barcodePrefix, size, fromDate, toDate }) {
  return new URLSearchParams({ barcodePrefix, size, fromDate, toDate }).toString();
}

// ---------- חיפוש תפוסה (CapacitySearchModal) ----------
export const SEARCH_NEEDS_MODEL_AND_SIZE = 'יש להזין דגם ומידה';
// ברירת מחדל לטווח: מהיום ועד חצי שנה קדימה (שעון ישראל) - כמו performSearch בישן
export function searchRangeDefaults(todayKey = getIsraelTodayKey()) {
  return { fromDate: todayKey, toDate: addMonthsToDateKey(todayKey, 6) };
}
export function resolveSearchRange(fromDate, toDate, todayKey = getIsraelTodayKey()) {
  return { fromDate: fromDate || todayKey, toDate: toDate || addMonthsToDateKey(todayKey, 6) };
}

// רשומת היסטוריית חיפושים (localStorage 'capacity_search_history', 50 אחרונים, החדש ראשון) - אותם שדות כמו הישן
export function buildHistoryEntry({ employeeCode, customerName, barcodePrefix, size, fromDate, toDate }, now = new Date()) {
  return { id: now.getTime(), timestamp: now.toISOString(), employeeCode, customerName, barcodePrefix, size, fromDate, toDate };
}
export const pushHistory = (prev, entry) => [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, CAPACITY_HISTORY_MAX);

// סינון הצעות הדגמים: לפי שם או קוד (כמו הישן; אחרי בחירה - הכל)
export function filterModels(models, query) {
  const q = String(query || '').trim();
  if (!q) return models;
  return models.filter(m => String(m.name || '').includes(q) || String(m.barcodePrefix || '').includes(q));
}
export const modelLabel = (m) => `${m.name} (${m.barcodePrefix})`;

// ---------- תצוגת התוצאות ----------
export const sortOccupied = (orders) => [...(orders || [])].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

// מפתח היום (YYYY-MM-DD) לפי שעון ישראל של רגע שהשרת החזיר (eventDate/returnDate נשמרים כחצות בשתי צורות - ר' lib/hebrewDate.getIsraelDayRange)
export function dayKeyOf(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return getIsraelTodayKey(d);
}

// אילו הזמנות תופסות את היום ובאיזו כמות - אותו כלל כמו CapacityCalendar: eventDate <= יום <= (returnDate או eventDate)
export function occupancyOn(orders, key) {
  let total = 0;
  const list = [];
  for (const o of orders || []) {
    const s = dayKeyOf(o.eventDate);
    if (!s) continue;
    const e = (o.returnDate ? dayKeyOf(o.returnDate) : '') || s;
    if (key >= s && key <= e) { total += o.quantity || 0; list.push(o); }
  }
  return { total, orders: list };
}

// תחילות החודשים העבריים שהטווח נוגע בהם (לניווט בלוח)
export function boardMonths(fromKey, toKey, max = 60) {
  const out = [];
  if (!fromKey || !toKey) return out;
  let m = monthStart(fromKey);
  while (m <= toKey && out.length < max) { out.push(m); m = nextMonthStart(m); }
  return out;
}
