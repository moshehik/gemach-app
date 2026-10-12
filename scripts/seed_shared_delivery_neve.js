// "משלוח משותף" (docs/shared-delivery-discount.md) - הגדרות נווה יעקב בלבד. החלטת הבעלים 12.10.2026: מחיר מוזל כללי 20 ש"ח לכיוון (לא לפי עיר).
//
// מה הסקריפט כותב (org 2 = נווה יעקב בלבד):
//   shared_delivery_price_mode = global      (מחיר כללי אחד לכל הערים)
//   shared_delivery_price      = 20          (ש"ח לצד אחד; הלוך-חזור מחויב פעמיים)
//   shared_delivery_enabled    = false       (נוצר כבוי אם חסר, כדי שיופיע במסך ההגדרות; לא משנה שום חיוב)
// ההדלקה (shared_delivery_enabled=true) היא דגל נפרד --enable: ההדלקה משנה חיובים בשמירה הבאה של הזמנות בקבוצה, ולכן רגע ההפעלה
// הוא החלטת הרכז / הבעלים.
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

const NAME = {
  shared_delivery_price_mode: { name: 'משלוח משותף - סוג המחיר המוזל (מחיר כללי / לפי עיר)', type: 'text' },
  shared_delivery_price: { name: 'משלוח משותף - מחיר מוזל כללי (לצד אחד)', type: 'number' },
  shared_delivery_enabled: { name: 'משלוח משותף - מחיר מוזל לאותה כתובת באותו יום', type: 'boolean' },
};
const CATEGORY = 'משלוחים';
const TARGET_MODE = 'global';
const TARGET_PRICE = '20';

/**
 * תכנון טהור (בלי DB): existing = Map(key -> value) של שורות קיימות. opts: { enable, overwrite }.
 * מחזיר { refusal: string|null, actions: [{ key, action: 'create'|'update'|'none'|'keep', value, before }] }.
 *  create = חסר, ייווצר; update = ייכתב (שונה והותר לדרוס); none = כבר שווה; keep = קיים שונה ולא נדרס (דגל --overwrite חסר).
 */
function plan(existing, { enable = false, overwrite = false } = {}) {
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
  // המתג: ללא --enable נוצר כבוי אם חסר ולעולם לא משתנה; עם --enable קובעים true במפורש (גם אם היה false)
  if (enable) decide('shared_delivery_enabled', 'true', true);
  else decide('shared_delivery_enabled', 'false', false);

  let refusal = null;
  if (enable) {
    if (get('enable_deliveries') !== 'true') refusal = 'enable_deliveries אינו true בגמ"ח הזה - אי אפשר להדליק משלוח משותף בלי משלוחים.';
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
    const keys = ['shared_delivery_price_mode', 'shared_delivery_price', 'shared_delivery_enabled', 'enable_deliveries'];
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
    const existing = new Map(rows.map((r) => [r.key, r.value]));
    const { refusal, actions } = plan(existing, { enable, overwrite });
    for (const a of actions) {
      const label = { create: 'ייווצר', update: `יעודכן (היה ${a.before})`, none: 'כבר תקין, ללא שינוי', keep: `קיים ${a.before} - לא נדרס (יעד ${a.value}; להחלפה: --overwrite)` }[a.action];
      console.log(`org2: ${a.key} = ${a.value} - ${label}`);
    }
    if (refusal) throw new Error(`REFUSED: ${refusal}`);
    if (enable) console.log('שימו לב: הדלקה משנה חיובי משלוח בשמירה הבאה של הזמנות בקבוצה. ודאו שהרצתם את shared_delivery_reprice.mjs (dry-run) ובדקתם את הדוח.');
    if (!write) { console.log('dry-run - pass --write to apply'); return; }
    for (const a of actions) {
      if (a.action !== 'create' && a.action !== 'update') continue;
      if (a.action === 'update') await prisma.systemSetting.update({ where: { key: a.key }, data: { value: a.value } });
      else await prisma.systemSetting.create({ data: { key: a.key, value: a.value, name: NAME[a.key].name, category: CATEGORY, type: NAME[a.key].type, notes: 'נוצר ע"י scripts/seed_shared_delivery_neve.js (docs/shared-delivery-discount.md)' } });
    }
    console.log('org2: done');
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { plan, TARGET_MODE, TARGET_PRICE };

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message || e); process.exitCode = 1; });
}
