// lib/orderDeliveryServer.js - עטיפת שרת ל-buildDeliverySection (lib/orderDelivery.js): קוראת את ההגדרות מהמטמון (lib/settingsCache.js)
// כדי שנתיבי מייל/PDF יקבלו את בלוק המשלוח בקריאה אחת. תצוגה בלבד - לא כותבת ולא מחשבת מחיר.
// שימוש: const delivery = await loadDeliverySection(order, { settings }) ; settings = כבר-נטענו (אופציונלי, חוסך קריאה).
import { getAllCachedSettings } from '@/lib/settingsCache';
import { buildDeliverySection } from '@/lib/orderDelivery';

/** order = שורת Order עם customer ו-obligations (כמו ב-include של נתיבי המייל). מחזיר null כשאין מה להציג. */
export async function loadDeliverySection(order, { settings } = {}) {
  if (!order || !order.isDelivery) return null; // קיצור דרך: בלי קריאת הגדרות להזמנה רגילה
  const all = settings || (await getAllCachedSettings());
  return buildDeliverySection(order, { settings: all });
}
