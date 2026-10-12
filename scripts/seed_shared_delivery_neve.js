// "משלוח משותף" (docs/shared-delivery-discount.md) - הגדרות נווה יעקב בלבד. החלטת הבעלים 12.10.2026: מחיר מוזל כללי 20 ש"ח לכיוון (לא לפי עיר).
//
// מה הסקריפט כותב (org 2 = נווה יעקב בלבד):
//   shared_delivery_price_mode = global      (מחיר כללי אחד לכל הערים)
//   shared_delivery_price      = 20          (ש"ח לצד אחד; הלוך-חזור מחויב פעמיים)
//   shared_delivery_enabled    = false       (נוצר כבוי אם חסר, כדי שיופיע במסך ההגדרות; לא משנה שום חיוב)
// ההדלקה (shared_delivery_enabled=true) היא דגל נפרד --enable: ההדלקה משנה חיובים בשמירה הבאה של הזמנות בקבוצה, ולכן רגע ההפעלה
// הוא החלטת הרכז / הבעלים.
//
// "מההזמנות הבאות והלאה" (החלטת הבעלים 12.10.2026): ב---enable הסקריפט קורא את ה-DB (קריאה בלבד), מחשב max(orderId)+1 בין *כל* ההזמנות
// (גם מחוקות / טיוטות / שמורות-ממקום) וכותב אותו כ-shared_delivery_first_order_id באותה כתיבה (טרנזקציה אחת, לפני המתג). הזמנה שמספרה קטן
// ממנו "קפואה": לא מקבלת הנחה ושום כתיבה של המשלוח המשותף לא נוגעת בה (docs/shared-delivery-discount.md). ערך קיים לא נדרס בלי --overwrite.
//
// סדר ההפעלה המומלץ:
//   1. seed של המחיר:      node scripts/seed_shared_delivery_neve.js --org=2            (dry-run)   ואז   ... --org=2 --write
//   2. dry-run של חישוב מחדש:  SD_DATABASE_URL=<DB נווה> node scripts/shared_delivery_reprice.mjs --expect-host=<מארח>
//      (הדוח מראה אילו הזמנות עתידיות היו משתנות, בכמה, ואילו זיכויים / חובות היו נוצרים. הדוח דורש שהמתג דלוק ב-DB שבו מריצים -
//       לכן בנווה מריצים אותו על עותק / ענף Neon, או מדליקים ובודקים מיד אחרי ההדלקה לפני שמירות - ר' docs/shared-delivery-discount.md סעיף 8.)
//   3. בדיקת הדוח עם הבעלים.
//   4. הדלקה:          node scripts/seed_shared_delivery_neve.js --org=2 --enable --write
//
// בטיחות (כמו שאר סקריפטי ה-seed, scripts/lib/seed-bool-setting.js):
//   * dry-run כברירת מחדל; כתיבה רק עם --write.
//   * נווה בלבד: --org=2 חובה; --org=1 (הגמ"ח הראשי, אין לו משלוחים) או בלי --org מסרבים. נבדק host (לא ריק ושונה מה-host של הגמ"ח השני) ומודפס.
//   * ערך קיים שונה לא נדרס אלא עם --overwrite (מדווח בלבד). ההדלקה היא החריג היחיד: --enable קובע true במפורש.
//   * --enable מסרב אם enable_deliveries אינו 'true' בנווה או שחסר מחיר מוזל תקין (מספר >= 0) - הדלקה בלי מחיר היא בלי הנחה.
//   * לא מורץ אוטומטית ע"י הבנייה; הרצה בפועל רק באישור הבעלים בזמן ההרצה.
'use strict';

const FIRST_ORDER_KEY = 'shared_delivery_first_order_id';
const NAME = {
  shared_delivery_price_mode: { name: 'משלוח משותף - סוג המחיר המוזל (מחיר כללי / לפי עיר)', type: 'text' },
  shared_delivery_price: { name: 'משלוח משותף - מחיר מוזל כללי (לצד אחד)', type: 'number' },
  shared_delivery_enabled: { name: 'משלוח משותף - מחיר מוזל לאותה כתובת באותו יום', type: 'boolean' },
  [FIRST_ORDER_KEY]: { name: 'משלוח משותף - מספר ההזמנה הראשון שחל עליו (קטנות ממנו לא משתתפות)', type: 'number' },
};
const CATEGORY = 'משלוחים';
const TARGET_MODE = 'global';
const TARGET_PRICE = '20';

/**
 * תכנון טהור (בלי DB): existing = Map(key -> value) של שורות קיימות. opts: { enable, overwrite, maxOrderId }.
 *  maxOrderId = max(Order.orderId) בין כל ההזמנות (נקרא מה-DB ב---enable; 0 = אין הזמנות). ב---enable חובה מספר שלם >= 0, אחרת סירוב.
 * מחזיר { refusal: string|null, actions: [{ key, action: 'create'|'update'|'none'|'keep', value, before }] }.
 *  create = חסר, ייווצר; update = ייכתב (שונה והותר לדרוס); none = כבר שווה; keep = קיים שונה ולא נדרס (דגל --overwrite חסר).
 */
function plan(existing, { enable = false, overwrite = false, maxOrderId = null } = {}) {
  const get = (k) => (existing.has(k) ? existing.get(k) : null);
  const actions = [];
  const decide = (key, value, canOverwrite) => {
    const before = get(key);
    if (before === null) return actions.push({ key, action: 'create', value, before });
    if (before === value) return actions.push({ key, action: 'none', value, before });
    return actions.push({ key, action: canOverwrite ? 'update' : 'keep', value, before });
  };
  decide('shared_delivery_price_mode', TARGET_MODE, overwrite);
  decide('shared_delivery_price', TARGET_PRICE, overwrite);
  // "מההזמנות הבאות והלאה": מספר ההזמנה הראשון שמשתתף = max+1, נכתב לפני המתג (אותה טרנזקציה). ללא --enable לא נוגעים בו.
  const maxOk = Number.isSafeInteger(maxOrderId) && maxOrderId >= 0;
  if (enable && maxOk) decide(FIRST_ORDER_KEY, String(maxOrderId + 1), overwrite);
  // המתג: ללא --enable נוצר כבוי אם חסר ולעולם לא משתנה; עם --enable קובעים true במפורש (גם אם היה false)
  if (enable) decide('shared_delivery_enabled', 'true', true);
  else decide('shared_delivery_enabled', 'false', false);

  let refusal = null;
  if (enable) {
    if (!maxOk) refusal = 'לא נקרא max(orderId) מה-DB - בלי מספר ההזמנה הראשון כל ההזמנות הקיימות היו מקבלות הנחה / זיכוי. ההדלקה נעצרה.';
    const firstNow = actions.find((a) => a.key === FIRST_ORDER_KEY);
    if (!refusal && firstNow && (firstNow.action === 'keep' || firstNow.action === 'none')) {
      const kept = Number(String(firstNow.before).trim());
      if (!/^\d+$/.test(String(firstNow.before).trim()) || !Number.isSafeInteger(kept) || kept < 1) refusal = `shared_delivery_first_order_id קיים אך אינו מספר תקין ("${firstNow.before}") - ריק / טקסט פירושו שאין הזמנות קפואות. תקנו או הריצו עם --overwrite.`;
    }
    if (!refusal && get('enable_deliveries') !== 'true') refusal = 'enable_deliveries אינו true בגמ"ח הזה - אי אפשר להדליק משלוח משותף בלי משלוחים.';
    const priceNow = actions.find((a) => a.key === 'shared_delivery_price');
    const effectivePrice = priceNow.action === 'keep' || priceNow.action === 'none' ? priceNow.before : priceNow.value;
    const n = effectivePrice === null || String(effectivePrice).trim() === '' ? NaN : Number(effectivePrice);
    if (!refusal && !(Number.isFinite(n) && n >= 0)) refusal = 'אין מחיר מוזל תקין (shared_delivery_price) - הדלקה בלי מחיר היא בלי הנחה. הריצו קודם את ה-seed בלי --enable.';
  }
  return { refusal, actions };
}

async function main(argv) {
  const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');
  const { hostOf } = require('./lib/seed-bool-setting');
  const { org, rest } = parseOrgArg(argv);
  const write = rest.includes('--write');
  const enable = rest.includes('--enable');
  const overwrite = rest.includes('--overwrite');
  if (!argv.some((a) => a === '--org=2') || org !== 2) {
    throw new Error('SAFETY ABORT: סקריפט זה מיועד לנווה יעקב בלבד - חובה --org=2 (הגמ"ח הראשי אין לו משלוחים).');
  }
  const url = resolveDbUrl(2);
  const host = hostOf(url);
  const otherHost = hostOf(resolveDbUrl(1));
  if (!host || host === otherHost) throw new Error(`SAFETY ABORT: org2 host "${host}" is empty or equals the main gemach's host "${otherHost}"`);
  console.log(`org2 DB host: ${host} | mode: ${write ? 'WRITE' : 'dry-run'}${enable ? ' | --enable' : ''}${overwrite ? ' | --overwrite' : ''}`);

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const keys = ['shared_delivery_price_mode', 'shared_delivery_price', 'shared_delivery_enabled', 'enable_deliveries', FIRST_ORDER_KEY];
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
    const existing = new Map(rows.map((r) => [r.key, r.value]));
    // קריאה בלבד: max(orderId) בין *כל* ההזמנות (בלי סינון isDeleted / סטטוס - טיוטות ומחוקות כלולות; כך נקבע מספר ההזמנה הבאה באתר, app/api/orders/route.js)
    let maxOrderId = null;
    if (enable) {
      const agg = await prisma.order.aggregate({ _max: { orderId: true } });
      maxOrderId = agg._max.orderId === null ? 0 : Number(agg._max.orderId);
      console.log(`org2: max(orderId) בין כל ההזמנות = ${maxOrderId}`);
    }
    const { refusal, actions } = plan(existing, { enable, overwrite, maxOrderId });
    for (const a of actions) {
      const label = { create: 'ייווצר', update: `יעודכן (היה ${a.before})`, none: 'כבר תקין, ללא שינוי', keep: `קיים ${a.before} - לא נדרס (יעד ${a.value}; להחלפה: --overwrite)` }[a.action];
      console.log(`org2: ${a.key} = ${a.value} - ${label}`);
    }
    if (refusal) throw new Error(`REFUSED: ${refusal}`);
    if (enable) {
      const f = actions.find((a) => a.key === FIRST_ORDER_KEY);
      const effective = f && (f.action === 'create' || f.action === 'update') ? f.value : (f ? f.before : null);
      console.log(`org2: ${FIRST_ORDER_KEY} = ${effective} - הזמנות עם מספר קטן מזה קפואות (לא משתתפות בהנחה ולא ייגעו בהן); הזמנות ${effective} ומעלה חדשות.`);
      console.log('שימו לב: הדלקה משנה חיובי משלוח בשמירה הבאה של הזמנות *חדשות* בקבוצה. ודאו שהרצתם את shared_delivery_reprice.mjs (dry-run, עם --first-order-id) ובדקתם את הדוח.');
      if (overwrite && f && f.action === 'update') console.log(`אזהרה: --overwrite הזיז את ${FIRST_ORDER_KEY} (היה ${f.before}) - הזמנות שנוצרו מאז ייחשבו קפואות; הקטנת הערך מחילה הנחה על הזמנות ישנות.`);
    }
    if (!write) { console.log('dry-run - pass --write to apply'); return; }
    // טרנזקציה אחת: ההגדרות (כולל shared_delivery_first_order_id לפני shared_delivery_enabled, לפי סדר actions) נכתבות יחד או לא בכלל
    const writes = actions.filter((a) => a.action === 'create' || a.action === 'update');
    await prisma.$transaction(writes.map((a) => (a.action === 'update'
      ? prisma.systemSetting.update({ where: { key: a.key }, data: { value: a.value } })
      : prisma.systemSetting.create({ data: { key: a.key, value: a.value, name: NAME[a.key].name, category: CATEGORY, type: NAME[a.key].type, notes: 'נוצר ע"י scripts/seed_shared_delivery_neve.js (docs/shared-delivery-discount.md)' } }))));
    console.log('org2: done');
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { plan, TARGET_MODE, TARGET_PRICE, FIRST_ORDER_KEY };

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message || e); process.exitCode = 1; });
}
