// lib/schedule/print/extras/itemInfo.js — ה-extra 'itemInfo' (דפים 03, 04, 08, 09): לכל הזמנה בשלבים שהדף מזין,
// לכל פריט לא מחוק: { n, alt } - n = מספר סידורי 1..k בהזמנה (ממוין לפי id של הפריט, דטרמיניסטי), alt = יש בו תיקון.
// משמש לברקוד פריט (REP-40113-2 / PRP-40113-2: n לא תלוי בסינון של השלב) ולסימון "יש תיקון" בהכנה.
// שאילתה אחת (findMany שטוח על OrderItem), select צר, take קבוע, בלי קריאה בתוך טרנזקציה.
import { hasAlteration } from '../repairItems';

export const ITEM_INFO_TAKE = 8000;

export async function loadItemInfo(day, pageDefs, client) {
  const ids = new Set();
  for (const p of pageDefs) {
    if (!(p.extras || []).includes('itemInfo')) continue;
    for (const s of day.stages || []) if (p.stages.includes(s.key)) for (const r of s.items) ids.add(r.orderId);
  }
  const out = {};
  if (!ids.size) return out;
  const rows = await client.orderItem.findMany({
    where: { orderId: { in: [...ids] }, isDeleted: false },
    select: { id: true, orderId: true, neckAlteration: true, lengthAlteration: true, sleeveAlteration: true },
    orderBy: { id: 'asc' },
    take: ITEM_INFO_TAKE,
  });
  for (const it of rows) {
    const m = (out[it.orderId] ||= {});
    m[it.id] = { n: Object.keys(m).length + 1, alt: hasAlteration(it) };
  }
  return out;
}
