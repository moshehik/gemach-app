// תצוגה מקדימה סטטית (HTML, בלי שליחת מייל, בלי DB) של מייל אישור ההזמנה בנווה יעקב - נתוני דמה בלבד (אין לקוח אמיתי).
// משתמש באותן פונקציות בדיוק כמו האתר: buildDeliverySection (lib/orderDelivery.js), visibleVisitLines, pickupAddressFrom / pickupMapsUrlFrom
// (lib/gmachContact.js) ו-renderOrderConfirmationEmailHtml (lib/emailTemplates.js). הרצה:
//   node --import ./scripts/order-docs-delivery-tests/register.mjs scripts/order-docs-delivery-tests/build-preview.mjs <תיקיית-יעד>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const D = await L('lib/orderDelivery.js');
const C = await L('lib/gmachContact.js');
const T = await L('lib/emailTemplates.js');
const H = await L('lib/hebrewDate.js');
const B = await L('lib/businessDays.js');
const CAT = await L('lib/emailCatalog.js');

const outDir = process.argv[2];
if (!outDir) throw new Error('usage: build-preview.mjs <out dir>');

// ---- הגדרות כמו נווה יעקב אחרי ה-seed (gmach_pickup_address = 'צוקרמן 1, נווה יעקב'); delivery_as_item_row כבוי ברירת מחדל
const baseSettings = [
  { key: 'gmach_name', value: 'גמ"ח שמלות נווה יעקב' },
  { key: 'gmach_address', value: 'צוקרמן 1 נווה יעקב - גבעת שאול 23. שימו לב: קבלת והחזרת השמלות בסניף נווה יעקב בלבד!' },
  { key: 'gmach_pickup_address', value: 'צוקרמן 1, נווה יעקב' },
  { key: 'gmach_phone', value: '0723168706' },
  { key: 'enable_deliveries', value: 'true' },
  { key: 'delivery_days_before', value: '0' },
  { key: 'delivery_days_after', value: '0' },
  { key: 'standard_pickup_hours', value: '20:00-21:30' },
  { key: 'standard_return_hour', value: '13:00' },
];
const withItemRow = [...baseSettings, { key: 'delivery_as_item_row', value: 'true' }];

const EVENT = new Date('2026-11-18T00:00:00Z'); // יום רביעי
const get = (settings) => (k) => settings.find((s) => s.key === k)?.value;

function build({ title, note, settings, order }) {
  const g = get(settings);
  const gmachName = g('gmach_name');
  const gmachAddress = C.pickupAddressFrom(g);
  const pickupMapsUrl = C.pickupMapsUrlFrom(g);
  const gmachPhone = g('gmach_phone');
  const hebrewDate = H.getHebrewDateString(EVENT);
  const pickupDate = B.subtractBusinessDays(EVENT, 2, B.EMPTY_NON_WORKING_CONFIG);
  const returnDate = B.addBusinessDays(EVENT, 1, B.EMPTY_NON_WORKING_CONFIG);
  const pickupLine = `ביום ${H.getHebrewWeekdayLabel(pickupDate)} ${H.getHebrewDateString(pickupDate)} בשעה ${g('standard_pickup_hours')}`;
  const returnLocal = B.localDateFromKey(returnDate);
  const returnLine = `${H.getHebrewWeekdayLabel(returnLocal)} ${H.getHebrewDateString(returnLocal)} עד השעה ${g('standard_return_hour')}`;
  const delivery = D.buildDeliverySection(order, { settings });
  const obligations = order.obligations.filter((o) => !o.isDeleted);
  const totalCharge = obligations.reduce((s, o) => s + o.amount, 0);
  const totalPaid = 100;
  const html = T.renderOrderConfirmationEmailHtml({
    customerName: 'דנה לוי (דוגמה)', orderId: 12345, eventDate: hebrewDate, pickupLine, returnLine,
    items: [{ name: 'שמלה לדוגמה א', size: '38' }, { name: 'שמלה לדוגמה ב', size: '40' }],
    totalCharge, totalPaid, balance: Math.max(0, totalCharge - totalPaid), gmachName, gmachAddress, gmachPhone, delivery, pickupMapsUrl,
  });
  const subject = CAT.emailSubject('orderCreatedAuto', { orderId: 12345, gmachName });
  return { title, note, subject, html, totalCharge };
}

const dressObl = [{ amount: 300, description: 'שמלה לדוגמה א', orderItemId: 'a' }, { amount: 150, description: 'שמלה לדוגמה ב', orderItemId: 'b' }];
const delivOrder = (direction, deliveryObl) => ({ isDelivery: true, deliveryDirection: direction, deliveryCity: 'ירושלים', deliveryAddress: 'רחוב הדוגמה 10 (דוגמה)', eventDate: EVENT, customer: {}, obligations: [...dressObl, ...deliveryObl] });
const pickupOrder = { isDelivery: false, deliveryDirection: null, eventDate: EVENT, customer: {}, obligations: dressObl };

const frame = (heading, sub, cards) => `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title>
<style>body{font-family:Tahoma,Arial,sans-serif;background:#e9e4dd;margin:0;padding:24px;color:#2b2424}h1{font-size:22px;margin:0 0 4px}.sub{color:#6b6157;margin:0 0 22px;font-size:14px;line-height:1.7}
.card{max-width:760px;margin:0 auto 34px}.cap{background:#fff;border:1px solid #d8d0c6;border-radius:10px 10px 0 0;padding:12px 16px;font-size:14px;line-height:1.7}.cap b{font-size:16px}.cap .subj{color:#6b6157}
iframe{width:100%;height:1250px;border:1px solid #d8d0c6;border-top:0;border-radius:0 0 10px 10px;background:#f3eee8;display:block}.wrap{max-width:760px;margin:0 auto}
.note{background:#fff6e0;border:1px solid #f3d78a;border-radius:8px;padding:10px 14px;margin:0 auto 24px;max-width:760px;font-size:13.5px;line-height:1.7}</style></head><body>
<div class="wrap"><h1>${heading}</h1><p class="sub">${sub}</p></div>
<div class="note">תצוגה מקדימה בלבד - נוצרה באותן פונקציות של האתר, עם נתוני דמה (אין לקוח אמיתי) ובלי שליחת מייל. הנתונים: אירוע ביום רביעי ח' כסלו תשפ"ז, 2 שמלות (₪450), משלוח ₪60 לכיוון, שולם ₪100.</div>
${cards.map((c) => `<div class="card"><div class="cap"><b>${c.title}</b><br>${c.note}<br><span class="subj">נושא המייל: ${c.subject}</span></div><iframe sandbox="" srcdoc="${c.html.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe></div>`).join('\n')}
</body></html>`;

const deliveryCards = [
  build({ title: 'א. משלוח הלוך+חזור (ברירת המחדל - "משלוח כשורת פריט" כבוי)', note: 'אין שורות "קבלת/החזרת השמלות" ואין כתובת איסוף (אין צורך לבוא); בלוק המשלוח, פירוט המשלוח בסיכום התשלום והכיתוב "שימו לב".', settings: baseSettings, order: delivOrder('הלוך-חזור', [{ amount: 120, description: 'משלוח הלוך-חזור - ירושלים' }]) }),
  build({ title: 'ב. משלוח הלוך+חזור כש"משלוח כשורת פריט" דלוק (החלטה 26 - כבוי כברירת מחדל)', note: 'אותו מייל, עם שורה לכל כיוון ("משלוח הלוך" / "משלוח חזור") ברשימת הפריטים, כל אחת עם הכתובת, היום והמחיר.', settings: withItemRow, order: delivOrder('הלוך-חזור', [{ amount: 120, description: 'משלוח הלוך-חזור - ירושלים' }]) }),
  build({ title: 'ג. משלוח הלוך בלבד (מחזירים בגמ"ח)', note: 'מוצגת רק שורת ההחזרה + כתובת האיסוף וקישור "פתיחה במפות Google"; אין שורת "קבלת השמלות"; בכיתוב "שימו לב" רק שורת "משלוח הלוך".', settings: baseSettings, order: delivOrder('הלוך', [{ amount: 60, description: 'משלוח הלוך - ירושלים' }]) }),
  build({ title: 'ד. משלוח חזור בלבד (לוקחים בגמ"ח)', note: 'מוצגת רק שורת "קבלת השמלות" + כתובת האיסוף וקישור המפות; בכיתוב "שימו לב" רק שורת "משלוח חזור".', settings: baseSettings, order: delivOrder('חזור', [{ amount: 60, description: 'משלוח חזור - ירושלים' }]) }),
];
const pickupCards = [
  build({ title: 'איסוף עצמי (הזמנה בלי משלוח)', note: 'כמו היום: קבלת והחזרת השמלות, כתובת האיסוף "צוקרמן 1, נווה יעקב" וקישור "פתיחה במפות Google". אין בלוק משלוח ואין כיתוב "שימו לב".', settings: baseSettings, order: pickupOrder }),
];

fs.mkdirSync(outDir, { recursive: true });
const f1 = path.join(outDir, 'מייל-אישור-נווה-תצוגה.html');
const f2 = path.join(outDir, 'מייל-אישור-נווה-איסוף-עצמי-תצוגה.html');
fs.writeFileSync(f1, frame('מייל אישור הזמנה - נווה יעקב - הזמנת משלוח (תצוגה מקדימה)', 'ארבעה מצבים של הזמנת משלוח. נא לבדוק נוסח, שעות הכיוונים, כתובת האיסוף וקישור המפות.', deliveryCards), 'utf8');
fs.writeFileSync(f2, frame('מייל אישור הזמנה - נווה יעקב - איסוף עצמי (תצוגה מקדימה)', 'הזמנה בלי משלוח - כדי לוודא שאין שינוי מיותר.', pickupCards), 'utf8');
console.log(f1);
console.log(f2);
for (const c of [...deliveryCards, ...pickupCards]) console.log(c.title.slice(0, 40), '| total', c.totalCharge);
