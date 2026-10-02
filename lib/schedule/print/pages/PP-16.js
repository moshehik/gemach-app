// lib/schedule/print/pages/PP-16.js — "דף קבלת החזרות" (דף 16): מי מחזירה בסניף, מפורט לכל פריט. מודפס בלבד.
//
// העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, p16() (עוצב מחדש לפי הבעלים: "מפורט לפריט ועם תקין / לא תקין").
// ההחלטות: PP-16 "לא - מפורט לפריט ועם תקין / לא תקין"; PP-17 (צ'ק ליסט בדיקת שמלה) הוסר ו"תקין / לא תקין" לכל פריט
// עבר לכאן; PQ-01 "לא" = הפירוט (דגם ומידה) חל רק על הדף המודפס - מסך הלו״ז באתר נשאר ללא דגם (A3/B05/B17);
// ברקוד MRT-<מספר הזמנה> בכותרת כל בלוק משפחה (registry: barcode.rows='order') + ALL-MRT-YYMMDD בכותרת הדף.
//
// מבנה הדף: בלוק לכל משפחה/הזמנה (שם משפחה, מספר הזמנה, טלפון, כתובת, תיבת "התקבל", ברקוד), ובתוכו שורה לכל פריט
// (דגם, מידה, תיבות "תקין" / "לא תקין", שורה לכתיבת הבעיה). "מחזירות היום" והחזרות "באיחור" בקבוצות נפרדות.
//
// מזין: שלב 8 (manret) של getScheduleDay = ההזמנות שמועד ההחזרה שלהן ביום (נחתך כבר לפי סניף), + ה-extra 'manretDetail'
// (extras/manretDetail.js): הפריטים של כל הזמנה, ההחזרות באיחור (מועד ההחזרה לפני היום, עוד לא הוחזרו) ושעת ההחזרה.
//
// הלשון זהה לסימון בלו״ז (docs/schedule-page-logic-spec.md, "סימון בוצע", שלב 8): הפריט שכבר הוחזר מסומן "הוחזר"
// (תקין) או "הוחזר לא תקין" (returnedOk=false) - אותם ערכים ש-POST /api/schedule/marks ו-/api/rentals/toggle כותבים
// ל-OrderItem.isReturned/returnedOk. התיבות המודפסות ריקות; הסימון עצמו נעשה בלו״ז (או בסריקה) אחרי שהדף מולא.
import { hDay, hShort, customerName, customerPhones, cnt } from '../format';
import { orderCode } from '../barcode';

export const SHEET_NAME = 'קבלת החזרות';

export const STATE_RETURNED = 'הוחזר';
export const STATE_RETURNED_BAD = 'הוחזר לא תקין';

export const lateText = (n) => (n === 1 ? 'באיחור יום אחד' : `באיחור ${n} ימים`);

/** פריטי בלוק: מה שה-extra טען; אם אין (ה-extra לא נטען) - שורת מקום לכל "שמלה" כדי שהדף עדיין ישמש */
function itemsFor(loaded, dressCount) {
  const src = loaded && loaded.length ? loaded : Array.from({ length: dressCount || 0 }, () => ({ model: '', size: '', returned: false, ok: null }));
  return src.map((it, i) => ({
    n: i + 1,
    of: src.length,
    model: it.model || '',
    size: it.size == null ? '' : String(it.size),
    state: it.returned ? (it.ok ? STATE_RETURNED : STATE_RETURNED_BAD) : '',
  }));
}

function block({ orderId, customer, street, city, eventKey, items, lateDays, threshold, prefix }) {
  const last = (customer && customer.lastName) || '';
  const full = customerName(customer);
  const itemList = items;
  return {
    orderId,
    name: last ? `משפחת ${last}` : (full || 'לא ידוע'),
    fullName: full,
    phone: customerPhones(customer)[0] || '',
    street: street || '',
    city: city || '',
    addressMissing: !street,
    eventKey: eventKey || null,
    itemCount: itemList.length,
    items: itemList,
    lateDays: lateDays || 0,
    lateSevere: !!lateDays && lateDays >= threshold,
    code: orderCode(prefix, orderId),
  };
}

function eventNote(blocks, count) {
  const keys = blocks.map((b) => b.eventKey).filter(Boolean).sort();
  const n = cnt(count, 'החזרה אחת', 'החזרות');
  if (!keys.length) return n;
  if (keys[0] === keys[keys.length - 1]) return `אירוע ${hDay(keys[0])} · ${n}`;
  return `אירועים ${hShort(keys[0])} עד ${hShort(keys[keys.length - 1])} · ${n}`;
}

export function build({ day, page, extras }) {
  const stage = (day.stages || []).find((s) => s.key === 'manret');
  const rows = stage && stage.enabled ? stage.items : [];
  const detail = (extras && extras.manretDetail) || {};
  const loaded = detail.items || {};
  const prefix = (page && page.barcode && page.barcode.prefix) || 'MRT';
  const threshold = (day.settings && day.settings.lateReturnThresholdDays) || 7;

  const todayBlocks = rows.map((r) => block({
    orderId: r.orderId,
    customer: r.customer,
    street: r.address && r.address.street,
    city: (r.address && r.address.city) || '',
    eventKey: r.eventKey,
    items: itemsFor(loaded[r.orderId], r.dressCount),
    lateDays: 0,
    threshold,
    prefix,
  }));
  const lateBlocks = (detail.late || []).map((l) => block({
    orderId: l.orderId,
    customer: l.customer,
    street: l.street,
    city: l.city,
    eventKey: null,
    items: itemsFor(l.items, l.items ? l.items.length : 0),
    lateDays: l.daysLate,
    threshold,
    prefix,
  }));

  const all = todayBlocks.concat(lateBlocks);
  const dayWord = day.isToday ? 'היום' : hDay(day.date);
  const totals = {
    returns: all.length,
    items: all.reduce((s, b) => s + b.itemCount, 0),
    today: todayBlocks.length,
    late: lateBlocks.length,
  };
  return {
    title: 'דף קבלת החזרות',
    sub: `מי מחזירה בסניף ${dayWord} · פירוט לכל פריט`,
    sum: `${cnt(totals.returns, 'החזרה אחת', 'החזרות')} · ${cnt(totals.items, 'פריט אחד', 'פריטים')}`,
    empty: all.length === 0,
    returnHour: detail.returnHour || '13:00',
    lateThreshold: threshold,
    sections: [
      {
        key: 'today',
        label: day.isToday ? 'מחזירות היום' : `מחזירות ב${hDay(day.date)}`,
        note: todayBlocks.length ? eventNote(todayBlocks, todayBlocks.length) : 'אין החזרות מתוכננות',
        blocks: todayBlocks,
      },
      ...(lateBlocks.length ? [{
        key: 'late',
        label: 'באיחור',
        note: `מעבר למועד ההחזרה · ${cnt(lateBlocks.length, 'החזרה אחת', 'החזרות')}${detail.lateTruncated ? ' · מוצגות הראשונות בלבד' : ''}`,
        blocks: lateBlocks,
      }] : []),
    ],
    // שטוח - לבדיקות ה-PDF (הזמנה + שם בכל בלוק) ולייצוא
    rows: all,
    totals,
  };
}

/** Excel: שורה לכל פריט (פרטי המשפחה חוזרים בכל שורה); הדף ריק מבלוקים = גיליון ריק */
export function toRows(data) {
  const out = [];
  for (const sec of data.sections) {
    for (const b of sec.blocks) {
      for (const it of b.items) {
        out.push({
          'קבוצה': sec.key === 'late' ? 'באיחור' : 'מחזירות היום',
          'הזמנה': b.orderId,
          'משפחה': b.name,
          'טלפון': b.phone,
          'כתובת': b.street ? `${b.street}, ${b.city}` : b.city,
          'ברקוד': b.code,
          'פריט': it.n,
          'מתוך': it.of,
          'דגם': it.model,
          'מידה': /^\d+$/.test(it.size) ? Number(it.size) : it.size,
          'מצב בלו״ז': it.state,
          'ימי איחור': b.lateDays || '',
        });
      }
    }
  }
  return out;
}
