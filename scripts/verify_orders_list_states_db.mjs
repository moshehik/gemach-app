// אימות מול ה-DB (קריאה בלבד, רק TEST_DATABASE_URL): תנאי ה-Prisma של הסטטוסים הנגזרים ב-lib/adminOrdersList.js (stateWhere) == calculateOrderStatus (lib/orderStatus.js)
// על כל ההזמנות, בשני מצבי draft_orders_show_as_deleted; בלי חפיפות ובלי הזמנה שלא מכוסה. הרצה: node scripts/verify_orders_list_states_db.mjs   (דורש node_modules נגיש + .env)
// (הבדיקה ללא DB של אותם תנאים נמצאת ב-scripts/test_a5_orders_customers_lists.mjs; זו הוכחה על הנתונים האמיתיים - 27,397 הזמנות ב-TEST ב-11.10.2026: 0 הבדלים.)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const base = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const require = createRequire(base);
fs.readFileSync(base + '.env', 'utf8').split('\n').forEach((l) => { const m = l.trim().match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, ''); });
const { PrismaClient } = require('@prisma/client');
if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL === process.env.PROD_DATABASE_URL) throw new Error('TEST_DATABASE_URL חסר או זהה ל-PROD');
const lib = await import(pathToFileURL(base + 'lib/adminOrdersList.js').href);

// calculateOrderStatus כפי שהוא (מועתק מהמקור כדי לא להתעסק עם imports בלי סיומת)
const src = fs.readFileSync(base + 'lib/orderStatus.js', 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/export function getStatusColor[\s\S]*$/m, '')
  .replace(/export function/g, 'function');
const hd = fs.readFileSync(base + 'lib/hebrewDate.js', 'utf8');
const IL = `const IL_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'});
function getIsraelDateKey(d){const x=d instanceof Date?d:new Date(d);if(isNaN(x.getTime()))return null;const p=IL_DATE_FORMATTER.formatToParts(x).reduce((a,q)=>{a[q.type]=q.value;return a},{});return p.year+'-'+p.month+'-'+p.day}
function getIsraelDaysUntil(dateInput, now=new Date()){if(!dateInput)return null;const t=getIsraelDateKey(dateInput),n=getIsraelDateKey(now);if(!t||!n)return null;const u=k=>{const [y,m,d]=k.split('-').map(Number);return Date.UTC(y,m-1,d)};return Math.round((u(t)-u(n))/86400000)}
const DRAFT_ORDER_STATUS='טיוטה';`;
const calc = new Function(`${IL}\n${src}\nreturn { calculateOrderStatus };`)().calculateOrderStatus;

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
// getIsraelDayRange(todayKey).start - מחושב כאן מחדש (אותה נוסחה בקירוב: חצות ישראל)
const probe = new Date(`${todayKey}T00:00:00+03:00`);
const off = (() => { const a = new Date(`${todayKey}T12:00:00Z`); const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', hour: '2-digit' }).formatToParts(a); return Number(parts.find((p) => p.type === 'hour').value) - 12; })();
const today = new Date(Date.parse(`${todayKey}T00:00:00Z`) - off * 3600 * 1000);
console.log('today', todayKey, today.toISOString(), 'offset', off);

for (const draftsAsDeleted of [true, false]) {
  console.log('--- draftsAsDeleted =', draftsAsDeleted);
  const orders = [];
  let skip = 0;
  for (;;) {
    const rows = await prisma.order.findMany({ select: { orderId: true, isDeleted: true, status: true, eventDate: true, items: { select: { isDeleted: true, isTaken: true, isReturned: true } } }, orderBy: { orderId: 'asc' }, skip, take: 4000 });
    if (!rows.length) break;
    orders.push(...rows); skip += rows.length;
  }
  console.log('orders loaded', orders.length);
  const word = lib.STATE_WORD;
  const js = {};
  const jsById = new Map();
  for (const o of orders) {
    const w = calc(o, { draftsAsDeleted });
    const k = lib.stateKeyOfWord(w);
    js[k] = (js[k] || 0) + 1; jsById.set(o.orderId, k);
    // השוואה גם לגרסת הספירות (deriveStateKey)
    const valid = o.items.filter((i) => !i.isDeleted);
    const k2 = lib.deriveStateKey({ isDeleted: o.isDeleted, status: o.status, eventDate: o.eventDate, nAll: o.items.length, nValid: valid.length, nReturned: valid.filter((i) => i.isReturned).length, nTaken: valid.filter((i) => i.isTaken).length }, { todayKey, eventDateKey: o.eventDate ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(o.eventDate) : '', draftsAsDeleted });
    if (k2 !== k) { js.__deriveMismatch = (js.__deriveMismatch || 0) + 1; if (js.__deriveMismatch < 4) console.log('deriveStateKey mismatch', o.orderId, k, k2); }
  }
  console.log('JS truth      ', JSON.stringify(js));
  const sql = {};
  const seen = new Map();
  for (const k of lib.ORDER_STATE_KEYS) {
    const ids = (await prisma.order.findMany({ where: lib.stateWhere(k, { today, draftsAsDeleted }), select: { orderId: true } })).map((r) => r.orderId);
    sql[k] = ids.length;
    for (const id of ids) { if (seen.has(id)) console.log('OVERLAP', id, seen.get(id), k); seen.set(id, k); }
    // השוואה לפי מזהה
    let bad = 0; for (const id of ids) if (jsById.get(id) !== k) { bad++; if (bad < 4) console.log('  WRONG', k, id, 'js says', jsById.get(id)); }
    if (bad) console.log('  state', k, 'wrong rows:', bad);
  }
  console.log('stateWhere    ', JSON.stringify(sql));
  console.log('covered', seen.size, 'of', orders.length);
  const def = await prisma.order.count({ where: lib.statesWhere([], { today, draftsAsDeleted }) });
  const expectedDef = orders.filter((o) => jsById.get(o.orderId) !== 'deleted').length;
  console.log('default (no deleted):', def, 'expected', expectedDef);
}
await prisma.$disconnect();
