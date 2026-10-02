// lib/schedule/print/pages/PP-07.js — "דף הכנה" (דף 07): שמלות להכנה היום, משלוחים קודם, בלי שדה "יעד".
//
// העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, p07() (גרסה א, דף מרוכז) ו-p07b() (גרסה ב, כל הזמנה בעמוד נפרד).
// ההחלטות: PP-07 "כן; ללא שדה יעד, גם בגרסה שכל הזמנה בעמוד אחר" (הוסרה עמודת היעד/הסניף משתי הגרסאות);
// PQ-05 שתי הגרסאות נשארות כבחירה בזמן ההדפסה; PQ-08 ההפרדה בין משלוח לאיסוף נשארת (כותרות קבוצה
// "משלוחים (הלוך) / איסוף עצמי" בגרסה א, וסוג ההזמנה בשורת הפרטים בגרסה ב). ברקוד: PRP-<מספר הזמנה> בכל שורה
// (גרסה א, `barcode.rows='order'`) ו"כל הדף" בכותרת; בגרסה ב ברקוד הכותרת בכל עמוד הוא של אותה הזמנה.
//
// מזין: שלב 4 (prep) של getScheduleDay - אין שאילתה נוספת על מה שהלו״ז כבר מחזיק (שורה + פריטים עם דגם/מידה).
// שורת שלב 4 לא נושאת (א) סוג ההזמנה (משלוח הלוך / איסוף עצמי) ו-(ב) פרטי התיקון לכל פריט, ולכן ה-extra 'prepInfo'
// (lib/schedule/print/data.js; שאילתת Order אחת, בלי תשלומים) מביא אותם. "שמלה חסרה" מהעיצוב: אין מקור נתונים בלו״ז
// (הבדיקה בכרטיס ההזמנה היא N+1 לכל פריט) ולכן לא מודפס; אפשר להוסיף כש-WP של החסרות יספק שדה.
import { hShort, hFull, greg, customerName, customerPhones, cnt } from '../format';
import { orderCode } from '../barcode';

export const SHEET_NAME = 'דף הכנה';

// אותו כלל "אורך = אין תיקון" כמו app/print/alterations (הייבוא מ-Access השאיר '', 'null', '0')
const hasLength = (v) => { const s = String(v ?? '').trim(); return !!s && s !== 'null' && s !== '0'; };

/** "צוואר: הצרה 2 | אורך: קיצור 4 | שרוול: הארכה 3" (כמו מדבקת התיקון, ריק = אין תיקון) */
export function repairText(a) {
  if (!a) return '';
  return [
    a.neck > 0 ? `צוואר: הצרה ${a.neck}` : '',
    hasLength(a.length) ? `אורך: ${String(a.length).trim()}` : '',
    a.sleeve > 0 ? `שרוול: הארכה ${a.sleeve}` : '',
  ].filter(Boolean).join(' | ');
}

function buildRow(r, info) {
  const i = info[r.orderId] || {};
  const isDelivery = !!i.isDelivery && i.direction !== 'חזור';
  const src = Array.isArray(r.items) && r.items.length ? r.items : Array.from({ length: r.dressCount || 0 }, () => ({}));
  const dresses = src.map((it, k) => {
    const a = i.items && it.orderItemId !== undefined ? i.items[it.orderItemId] : null;
    const repair = repairText(a);
    return { n: k + 1, model: it.model || '', size: it.size === null || it.size === undefined ? '' : String(it.size), repair, details: repair && a ? a.details || '' : '' };
  });
  return {
    orderId: r.orderId,
    code: orderCode('PRP', r.orderId),
    name: customerName(r.customer),
    phone: customerPhones(r.customer)[0] || '',
    eventKey: r.eventKey || null,
    eventShort: r.eventKey ? hShort(r.eventKey) : (r.eventDateHebrew || ''),
    eventFull: r.eventKey ? hFull(r.eventKey) : (r.eventDateHebrew || ''),
    eventGreg: r.eventKey ? greg(r.eventKey) : '',
    isDelivery,
    type: isDelivery ? 'משלוח' : 'איסוף עצמי',
    notes: r.notes || '',
    dressCount: r.dressCount || dresses.length,
    dresses,
    hasRepair: dresses.some((d) => d.repair),
  };
}

export function build({ day, version, extras }) {
  const stage = (day.stages || []).find((s) => s.key === 'prep');
  const items = stage ? stage.items : [];
  const info = (extras && extras.prepInfo) || {};
  // משלוחים קודם (כמו "הכנות להיום" בהדפסה הקיימת, אפשרות sortDeliveriesFirst), ובתוך כל קבוצה לפי תאריך האירוע והזמנה
  const rows = items.map((r) => buildRow(r, info)).sort((a, b) => (Number(b.isDelivery) - Number(a.isDelivery))
    || String(a.eventKey || '').localeCompare(String(b.eventKey || '')) || a.orderId - b.orderId);
  const dressTotal = rows.reduce((s, r) => s + r.dressCount, 0);
  // קבוצות = כותרות בלבד (המטען נשלח לדפדפן; השורות ב-rows פעם אחת, והתבנית מסננת לפי isDelivery)
  const mk = (key, label, list) => ({ key, label, orders: list.length, dresses: list.reduce((s, r) => s + r.dressCount, 0) });
  const groups = [mk('delivery', 'משלוחים (הלוך)', rows.filter((r) => r.isDelivery)), mk('pickup', 'איסוף עצמי', rows.filter((r) => !r.isDelivery))].filter((g) => g.orders);
  return {
    version: version || 'a',
    title: 'דף הכנה',
    sub: version === 'b' ? 'הזמנה אחת בכל עמוד' : 'שמלות להכנה היום · משלוחים קודם',
    sum: `${cnt(rows.length, 'הזמנה אחת', 'הזמנות')} · ${cnt(dressTotal, 'שמלה אחת', 'שמלות')}`,
    empty: rows.length === 0,
    rows, // לפי הסדר המודפס: משלוחים קודם. גרסה ב: גיליון אחד לכל שורה, באותו סדר
    groups,
    totals: { orders: rows.length, dresses: dressTotal, deliveries: groups.find((g) => g.key === 'delivery')?.orders || 0 },
  };
}

// שורה לכל שמלה (כמו ההדפסה: מי, מה ובאיזו מידה להכין; מסננים לפי דגם / סוג)
export function toRows(data) {
  const out = [];
  for (const r of data.rows) {
    const list = r.dresses.length ? r.dresses : [{ n: '', model: '', size: '', repair: '', details: '' }];
    for (const d of list) {
      out.push({
        'הזמנה': r.orderId,
        'לקוחה': r.name,
        'טלפון': r.phone,
        'תאריך אירוע': r.eventGreg,
        'תאריך עברי': r.eventShort,
        'סוג': r.type,
        'שמלה': d.n,
        'דגם': d.model,
        'מידה': d.size,
        'תיקון': d.repair,
        'פירוט תיקון': d.details,
        'הערה להזמנה': r.notes,
      });
    }
  }
  return out;
}
