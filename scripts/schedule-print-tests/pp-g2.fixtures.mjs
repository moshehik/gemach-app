// נתוני דמה לדפי 03, 04, 08, 09 (קבוצה 2): הזמנות עם תיקונים (שלב 2, אירוע ב-1.10 = "היום") והזמנות להכנה (שלב 4, אירוע ב-6.10).
// בנוי על scripts/schedule-tests/fixtures.mjs (אותו מוק Prisma, אותו getScheduleDay אמיתי) ומוסיף:
//   - orderItem במוק (ה-extra 'itemInfo' קורא OrderItem שטוח) - נגזר מהפריטים של ההזמנות, עם id ו-orderId
//   - דגמי השמלות והלקוחות של העיצוב (דפי-הדפסה-עיצוב.html: MOD, PPL, REP) כדי שהשוואה לעיצוב תהיה על אותם נתונים
import { ORDERS, installDb } from '../schedule-tests/fixtures.mjs';

const d = (iso) => new Date(iso);
export const MOD = [['תחרה קלאסית', 4512], ['סאטן שנהב', 3087], ['טול נסיכות', 1893], ['קרפ מעטפת', 4519], ['שיפון זהב', 2214], ['קטיפה כחולה', 3355], ['מרמיד שחורה', 5021], ['תחרה שרוול ארוך', 4108], ['סאטן אדום', 2760], ['שיפון פודרה', 3921]];
export const SIZES = ['36', '38', '40', '42', '44', '46'];
export const PPL = [['מרים', 'אברמוביץ', '052-555-0101', '050-555-0201', 'ירושלים', 'הרב קוק', 12], ['שרה', 'לוי', '054-555-0102', '', 'בית שמש', 'נחל דולב', 7], ['רחל', 'כהן', '050-555-0103', '052-555-0203', 'בני ברק', 'רבי עקיבא', 44], ['לאה', 'פרידמן', '053-555-0104', '', 'ביתר עילית', 'הרב שך', 9], ['חנה', 'גולדברג', '058-555-0105', '050-555-0205', 'אלעד', 'בר אילן', 31], ['אסתר', 'שפירא', '052-555-0106', '', 'מעלה אדומים', 'הדקל', 5], ['דבורה', 'מזרחי', '054-555-0107', '', 'ירושלים', 'הנביאים', 18], ['רבקה', 'ישראלי', '050-555-0108', '053-555-0208', 'אשדוד', 'הרצל', 70], ['שושנה', 'בן דוד', '052-555-0109', '', 'רחובות', 'הרצל', 15], ['יעל', 'גרין', '058-555-0110', '', 'צפת', 'ירושלים', 22], ['תמר', 'וייס', '054-555-0111', '050-555-0211', 'פתח תקווה', 'רוטשילד', 8], ['נעמי', 'קליין', '052-555-0112', '', 'ירושלים', 'בן יהודה', 3]];
// REP של העיצוב: [צוואר, אורך, שרוול, פירוט]
export const REP = [[2, '', 0, ''], [0, 'קיצור 4', 0, ''], [0, '', 3, ''], [1, 'קיצור 2', 0, ''], [0, 'הארכה 3', 0, 'לשמור על התחרה בשולי השמלה'], [0, '', 2, 'שרוול שמאל בלבד']];
const ND = [1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 1, 2];

let seq = 0;
const cust = (i, extra = {}) => { const p = PPL[i % PPL.length]; return { firstName: p[0], lastName: p[1] + (i >= PPL.length ? ' ' + Math.floor(i / PPL.length) : ''), phone1: p[2], phone2: p[3], city: p[4], street: p[5], houseNum: p[6], ...extra }; };
function item(oi, k, withRepair) {
  const m = MOD[(oi * 3 + k * 2) % MOD.length];
  const size = SIZES[(oi * 5 + k * 3) % SIZES.length];
  const r = REP[(oi + k * 2) % REP.length];
  return {
    id: 'g2-it-' + (++seq).toString().padStart(5, '0'), description: m[0], sizeText: size, barcodePrefix: m[1],
    isTaken: false, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, isDeleted: false,
    neckAlteration: withRepair ? r[0] : 0, lengthAlteration: withRepair ? (r[1] || null) : null, sleeveAlteration: withRepair ? r[2] : 0,
    alterationDetails: withRepair ? (r[3] || null) : null, alterationDone: false,
    dressItem: { location: 'מדף 1', inRepair: false, sizeText: size, dress: { name: m[0], barcodePrefix: m[1] } },
  };
}
function order(orderId, i, n, { repair, event, branch = null, delivery = false, notes = '' }) {
  return {
    orderId, status: null, isDeleted: false, orderDate: d('2026-09-01T08:00:00Z'), eventDate: d(event), eventDateHebrew: null,
    fromDate: null, toDate: null, returnDate: null, isAbroad: false, isWeekdayEvent: false, extraDay: null, customSpacing: null,
    branch, pickupBranch: branch, notes, internalNotes: '', isDelivery: delivery, deliveryDirection: delivery ? 'הלוך-חזור' : null,
    deliveryAddress: null, deliveryCity: null, deliveryOneDayBefore: false,
    customer: cust(i), employee: { id: 'emp-1', firstName: 'רחלי', lastName: 'לוי', fullName: 'רחלי לוי', roleId: 1, isActive: true, hourlyWage: 50 },
    items: Array.from({ length: n }, (_, k) => item(i, k, repair === 'all' || (repair === 'some' && k % 2 === 0))), obligations: [],
  };
}

const EV_REPAIR = '2026-09-30T21:00:00Z'; // 1.10 בשעון ישראל = היום -> שלב 2 (offset 0)
const EV_PREP = '2026-10-05T21:00:00Z';   // 6.10 -> הכנה חמישי 1.10 (-3 ימי עסקים)

/** 12 הזמנות תיקונים + 12 הזמנות הכנה (כמו 12 הלקוחות של העיצוב); long = הרבה יותר, כדי לקבל כמה עמודים */
export function g2Orders({ long = false } = {}) {
  const out = [];
  const nRep = long ? 70 : 6;
  const nPrep = long ? 60 : 12;
  for (let i = 0; i < nRep; i++) out.push(order(40100 + i * 13, i, ND[i % 12], { repair: 'all', event: EV_REPAIR, branch: i % 3 === 1 ? 'בית שמש' : null, notes: i % 4 === 2 ? 'נא להתקשר לפני ההגעה' : '' }));
  for (let i = 0; i < nPrep; i++) out.push(order(41000 + i * 11, i, ND[i % 12], { repair: i % 3 === 0 ? 'some' : 'none', event: EV_PREP, branch: i % 3 === 1 ? 'נווה יעקב' : i % 3 === 2 ? 'בית שמש' : null, delivery: i % 3 !== 1, notes: i % 5 === 4 ? 'מבקשת אריזה בקולב' : '' }));
  return out;
}

/** מתקין את מוק ה-DB: ההזמנות של הקבוצה בנוסף לאלה של הלו״ז, ו-orderItem שטוח (ל-extra 'itemInfo') */
export function installG2Db({ long = false, orders = null, base = true } = {}) {
  const g2 = orders || g2Orders({ long });
  const all = [...(base ? ORDERS : []), ...g2];
  const orderItem = [];
  for (const o of all) for (const it of o.items || []) orderItem.push({ ...it, orderId: o.orderId });
  installDb({ extra: { order: all, orderItem } });
  return all;
}

// ---- מטען הדפסה אמיתי מהנתונים האלה: getScheduleDay (מוק Prisma) -> loadExtras -> buildPrintPayload ----
import { pathToFileURL } from 'node:url';
import { NOW } from '../schedule-tests/fixtures.mjs';
const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
export const DAY = '2026-10-01';
export const GMACH = { name: 'גמ״ח שמלות', address: 'רחוב הדוגמה 12, ירושלים', phone: '02-555-0100' };

export async function g2Payload(keys, { versions = {}, long = false, base = false, orders = null } = {}) {
  installG2Db({ long, base, orders });
  const { getScheduleDay } = await L('lib/schedule/index.js');
  const { loadExtras, buildPrintPayload } = await L('lib/schedule/print/data.js');
  const { getPrintPage } = await L('lib/schedule/print/registry.js');
  const day = await getScheduleDay({ date: DAY, user: { id: 'emp-head', roleId: 0 }, now: NOW });
  const defs = keys.map(getPrintPage);
  const extras = await loadExtras(day, defs);
  const payload = buildPrintPayload({ day, keys, versions, extras, gmach: GMACH, printedBy: 'מנהלת (דוגמה)', now: NOW });
  return { day, extras, payload, calls: globalThis.__MOCK_CALLS };
}
