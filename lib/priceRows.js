// חיפוש שורת מחיר במחירון לפי קטגוריה ומידה - פונקציות טהורות (בלי import),
// כדי שגם מנוע החישוב, המחירון בממשק וסקריפטי בדיקה ישתמשו באותו כלל בדיוק.
//
// gapRule (הגדרת המערכת `gap_size_price_rule`):
//   'none'    - ברירת מחדל: מידה שנופלת בין טווחי מחיר לא מקבלת שורת מחיר (מחיר 0), כמו תמיד.
//   'cheaper' - מידה שנופלת בין שני טווחים סמוכים של אותה קטגוריה מחויבת לפי המחיר הזול
//               מבין שתי השורות הסמוכות (זו מתחת ל-size וזו מעליה). אם אין שורה סמוכה
//               משני הצדדים (מידה מחוץ לכל הטווחים) - עדיין אין מחיר, כמו קודם.

export const GAP_RULE_NONE = 'none';
export const GAP_RULE_CHEAPER = 'cheaper';

export function normalizeGapRule(value) {
  return String(value || '').trim() === GAP_RULE_CHEAPER ? GAP_RULE_CHEAPER : GAP_RULE_NONE;
}

export function rowMatchesSize(row, size) {
  const from = row.fromSize || 0;
  const to = row.toSize === undefined ? null : row.toSize;
  return size >= from && (to === null || size <= to);
}

function rowValidForEvent(row, eventDate) {
  if (!eventDate) return true;
  const ev = new Date(eventDate);
  if (row.startDate && ev < new Date(row.startDate)) return false;
  if (row.endDate && ev > new Date(row.endDate)) return false;
  return true;
}

/**
 * מחזיר { row, viaGap } - row הוא שורת המחיר בה מחויבת המידה (או null אם אין), ו-viaGap=true
 * כשהיא נבחרה לפי כלל המידות שבין הטווחים ולא כהתאמה ישירה.
 * eventDate (אופציונלי) - מסנן שורות לפי startDate/endDate, בדיוק כמו סינון התאריכים
 * שהיה קיים במנוע לפריטים פעילים. לפריטים מחוקים המנוע מעביר null (ללא סינון), כמו תמיד.
 */
export function findPriceRowForSize(priceList, category, size, { eventDate = null, gapRule = GAP_RULE_NONE } = {}) {
  const rows = (priceList || []).filter(p => p.category === category && rowValidForEvent(p, eventDate));
  const direct = rows.find(p => rowMatchesSize(p, size));
  if (direct) return { row: direct, viaGap: false };

  if (normalizeGapRule(gapRule) !== GAP_RULE_CHEAPER || !Number.isFinite(size)) {
    return { row: null, viaGap: false };
  }

  let below = null;
  let above = null;
  for (const p of rows) {
    if (p.price === null || p.price === undefined) continue;
    if (p.toSize !== null && p.toSize !== undefined && p.toSize < size) {
      if (!below || p.toSize > below.toSize) below = p;
    }
    if ((p.fromSize || 0) > size) {
      if (!above || (p.fromSize || 0) < (above.fromSize || 0)) above = p;
    }
  }
  if (!below || !above) return { row: null, viaGap: false };
  return { row: below.price <= above.price ? below : above, viaGap: true };
}

/** האם שתי תוצאות של findPriceRowForSize הן אותה "קטגוריית מחיר" (אותה שורה במחירון). */
export function isSamePriceBand(a, b) {
  return !!(a && b && a.row && b.row && a.row.id !== undefined && a.row.id === b.row.id);
}

/**
 * טווחי המידות שאינם מכוסים בשום שורה של הקטגוריה, בין שורות סמוכות - לתצוגה במסך המחירון.
 * מחזיר [{ fromSize, toSize, row, price }] כש-row היא השורה הזולה שהכלל בוחר להם.
 */
export function listGapRanges(priceList, category, { eventDate = null } = {}) {
  const rows = (priceList || [])
    .filter(p => p.category === category && rowValidForEvent(p, eventDate) && p.price !== null && p.price !== undefined)
    .filter(p => p.toSize !== null && p.toSize !== undefined)
    .slice()
    .sort((a, b) => (a.fromSize || 0) - (b.fromSize || 0));
  const gaps = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const cur = rows[i];
    const next = rows[i + 1];
    const from = cur.toSize + 1;
    const to = (next.fromSize || 0) - 1;
    if (from <= to) {
      const cheaper = cur.price <= next.price ? cur : next;
      gaps.push({ fromSize: from, toSize: to, row: cheaper, price: cheaper.price });
    }
  }
  return gaps;
}
