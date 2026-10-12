// נושא 9 (דוחות, 12.10.2026) - ההגדרות החדשות של מסמכי ההזמנה בנווה יעקב (org 2 בלבד; הגמ"ח הראשי אין בו משלוחים ולא משתנה):
//   delivery_as_item_row     'true'   - המשלוח כשורת פריט (שורה לכל כיוון) בכרטיס/הדפסה/PDF/מייל. הבעלים החליט (12.10.2026) להדליק בנווה. ברירת המחדל בקוד
//                                          (כשהשורה חסרה) נשארת כבויה. שורה קיימת (למשל 'false') לא נדרסת, אלא עם --force-delivery-item-row.
//   gmach_pickup_address     'צוקרמן 1, נווה יעקב' - "כתובת האיסוף" במיילים ובמסמכים ללקוחות (החלטת הבעלים 12.10.2026). ב-DB של נווה `gmach_address` הוא
//                                          "צוקרמן 1 נווה יעקב - גבעת שאול 23. שימו לב: ..." (כתובת שנייה + הערה) ולכן "כתובת האיסוף" במייל הציגה אותה.
//                                          קישור "פתיחה במפות Google" נגזר ממנה אוטומטית (lib/gmachContact.js).
//   gmach_pickup_maps_url    ''       - קישור ניווט מותאם אישית (אופציונלי; ריק = נגזר מכתובת האיסוף).
//   delivery_notice_text / delivery_outbound_hours / delivery_return_hours - הכיתוב "שימו לב" ושעות הכיוונים במייל אישור ההזמנה (ברירות המחדל שאישר הבעלים;
//                                          הקוד משתמש באותן ברירות מחדל גם כשהשורות חסרות).
// כל המפתחות נוצרים רק אם חסרים - ערך קיים לעולם לא נדרס, חוץ מ-delivery_as_item_row בלבד כשצוין --force-delivery-item-row (מעדכן אותה ל-true).
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית.
//   node scripts/seed_order_docs_delivery_settings.js --org=2                                        (dry-run)
//   node scripts/seed_order_docs_delivery_settings.js --org=2 --write
//   node scripts/seed_order_docs_delivery_settings.js --org=2 --write --force-delivery-item-row      (גם אם השורה קיימת כ-false)
'use strict';

const { parseOrgArg } = require('./lib/db-env');
const { connectOrg } = require('./lib/seed-bool-setting');

const DEFS = [
  { key: 'delivery_as_item_row', name: 'המשלוח מוצג כשורת פריט בטבלת הפריטים (כרטיס, הדפסה, מייל)', category: 'משלוחים', type: 'boolean', value: 'true', forceFlag: '--force-delivery-item-row',
    notes: 'כשמופעל (ורק יחד עם "הצג משלוחים"), בהזמנת משלוח המשלוח מוצג כשורה לכל כיוון בטבלת הפריטים - בכרטיס ההזמנה, בהדפסה, בקובץ ה-PDF המצורף ובמייל אישור ההזמנה - עם כתובת, יום והמחיר. תצוגה בלבד: אינו פריט מלאי והסכום הכולל זהה. כבוי = כמו קודם.' },
  { key: 'gmach_pickup_address', name: 'כתובת האיסוף (במיילים ובמסמכים ללקוחות)', category: 'כללי', type: 'text', value: 'צוקרמן 1, נווה יעקב',
    notes: 'הכתובת שמופיעה ללקוחות כ"כתובת האיסוף" - במייל אישור ההזמנה, בתזכורות, בכרטיס ההזמנה, בקובץ ה-PDF המצורף ובהדפסה. אם ריקה - מוצגת "כתובת הגמ"ח" כמו קודם.' },
  { key: 'gmach_pickup_maps_url', name: 'קישור "פתיחה במפות Google" לכתובת האיסוף (אופציונלי)', category: 'כללי', type: 'text', value: '',
    notes: 'קישור ניווט מותאם אישית (חייב להתחיל ב-https://). אם הוזן - הוא מחליף את הקישור שנגזר מכתובת האיסוף. ריק = נגזר אוטומטית.' },
  { key: 'delivery_notice_text', name: 'משלוח - כיתוב "שימו לב" במייל אישור ההזמנה', category: 'משלוחים', type: 'text', value: 'שימו לב: אם הזמנתם משלוח אין צורך לבוא לגמ"ח, והמשלוחן ייצור אתכם קשר.',
    notes: 'הכיתוב שמופיע במייל אישור ההזמנה כשיש משלוח בהזמנה (מעל שורות השעות). ריק = בלי משפט פתיחה.' },
  { key: 'delivery_outbound_hours', name: 'משלוח הלוך - שעות (בכיתוב "שימו לב")', category: 'משלוחים', type: 'text', value: 'בשעות אחה"צ–ערב',
    notes: 'השעות שמופיעות בשורה "משלוח הלוך" במייל אישור ההזמנה (רק כשההזמנה כוללת משלוח הלוך). ריק = בלי השורה.' },
  { key: 'delivery_return_hours', name: 'משלוח חזור - שעות (בכיתוב "שימו לב")', category: 'משלוחים', type: 'text', value: '10:00–13:00',
    notes: 'השעות שמופיעות בשורה "משלוח חזור" במייל אישור ההזמנה (רק כשההזמנה כוללת משלוח חזור). ריק = בלי השורה.' },
];

/**
 * מה לעשות עם הגדרה אחת - טהור (נבדק ב-scripts/order-docs-delivery-tests/seed.test.mjs).
 * existing = ערך שנמצא ב-DB (undefined = חסר). מחזיר { action: 'create'|'update'|'keep', value }.
 * 'update' רק להגדרה עם forceFlag שצוין, וכשהערך הקיים שונה מהיעד.
 */
function planSetting(def, existing, flags = []) {
  if (existing === undefined || existing === null) return { action: 'create', value: def.value };
  if (def.forceFlag && flags.includes(def.forceFlag) && existing !== def.value) return { action: 'update', value: def.value };
  return { action: 'keep', value: existing };
}

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  if (org !== 2) throw new Error('סקריפט זה מיועד לנווה יעקב בלבד (--org=2): בגמ"ח הראשי אין משלוחים ושום הגדרה לא משתנה');
  const { prisma } = connectOrg(org, write); // בודק host (לא ריק ושונה מה-DB של הגמ"ח השני)
  try {
    for (const def of DEFS) {
      const exists = await prisma.systemSetting.findUnique({ where: { key: def.key } });
      const plan = planSetting(def, exists ? exists.value : undefined, rest);
      if (plan.action === 'keep') {
        console.log(`org${org}: ${def.key} already exists (= ${JSON.stringify(plan.value)}), kept` + (def.forceFlag && plan.value !== def.value ? ` [target is ${JSON.stringify(def.value)}; pass ${def.forceFlag} to update]` : ''));
        continue;
      }
      console.log(`org${org}: ${write ? plan.action : `would ${plan.action}`} ${def.key} = ${JSON.stringify(plan.value)}${exists ? ` (was ${JSON.stringify(exists.value)})` : ''}`);
      if (write && plan.action === 'create') await prisma.systemSetting.create({ data: { key: def.key, name: def.name, category: def.category, type: def.type, value: def.value, notes: def.notes } });
      if (write && plan.action === 'update') await prisma.systemSetting.update({ where: { key: def.key }, data: { value: plan.value } });
    }
    if (!write) console.log('dry-run - pass --write to apply');
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { DEFS, planSetting };

if (require.main === module) main().catch((e) => { console.error(e); process.exitCode = 1; });
