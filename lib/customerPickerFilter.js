// lib/customerPickerFilter.js - צד שרת: תנאי הסינון של בורר "לקוח קיים" בהזמנה חדשה (GET /api/customers?pickerFor=new-order).
// ההגדרה (lib/newOrderCustomerFilter.js) נקראת מהשרת בכל בקשה (lib/settingsCache.js, 30 שנ' ומתבטלת בשמירת הגדרות) - הלקוח לא שולח ולא מכיר
// אותה, ולכן אין מפתח מטמון בלקוח שיכול להחזיר רשימה ישנה אחרי שינוי הגדרה (הבורר לא עובר דרך apiCache / pageCache).
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { resolveNewOrderCustomerFilter, NEW_ORDER_CUSTOMER_FILTER_KEY } from '@/lib/newOrderCustomerFilter';
import { buildCompletenessSpec, prismaCompleteConditions, completeEdgeSql, EDGE_ID_CAP } from '@/lib/customerCompleteness';

const EDGE_TTL_MS = 60 * 1000;
const edgeCache = new Map(); // JSON(spec) -> { at, ids }

async function edgeIds(spec) {
  const sql = completeEdgeSql(spec);
  if (!sql) return [];
  const key = JSON.stringify(spec);
  const hit = edgeCache.get(key);
  if (hit && Date.now() - hit.at < EDGE_TTL_MS) return hit.ids;
  const rows = await prisma.$queryRawUnsafe(sql);
  const ids = rows.slice(0, EDGE_ID_CAP).map((r) => r.id);
  edgeCache.set(key, { at: Date.now(), ids });
  return ids;
}

/**
 * תנאים להוספה ל-AND של שאילתת הלקוחות. ריק כשההגדרה = all (או חסרה), וגם בכשל בקריאת ההגדרות / החישוב (fail-open: עדיף להציג את
 * כולם מאשר לחסום בחירת לקוח בהזמנה).
 * @returns {Promise<object[]>}
 */
export async function newOrderPickerConditions() {
  try {
    const rows = await getAllCachedSettings();
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    if (resolveNewOrderCustomerFilter(settings[NEW_ORDER_CUSTOMER_FILTER_KEY]) !== 'complete') return [];
    const spec = buildCompletenessSpec(settings);
    const conditions = prismaCompleteConditions(spec);
    const exclude = await edgeIds(spec);
    if (exclude.length) conditions.push({ id: { notIn: exclude } });
    return conditions;
  } catch (e) {
    console.error('newOrderPickerConditions failed (fail-open: all customers)', e);
    return [];
  }
}
