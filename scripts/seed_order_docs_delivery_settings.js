// נושא 9 (דוחות, 12.10.2026) - ההגדרות החדשות של מסמכי ההזמנה בנווה יעקב (org 2 בלבד; הגמ"ח הראשי אין בו משלוחים ולא משתנה):
//   delivery_as_item_row     'false'  - המשלוח כשורת פריט (שורה לכל כיוון) בכרטיס/הדפסה/PDF/מייל. כבוי = ההתנהגות הקודמת; הדלקה = החלטת הבעלים.
//   gmach_pickup_address     'נווה יעקב' - "כתובת האיסוף" במיילים ובמסמכים ללקוחות. ב-DB של נווה `gmach_address` הוא "צוקרמן 1 נווה יעקב - גבעת שאול 23. שימו לב: ..."
//                                          (כתובת שנייה + הערה) ולכן "כתובת האיסוף" במייל הציגה אותה; הכתובת המלאה נשארת בראש המסמכים. הערך 'נווה יעקב' כפי
//                                          שהבעלים ביקש - אם רוצים כתובת מלאה יותר, מעדכנים בהגדרות.
//   delivery_notice_text / delivery_outbound_hours / delivery_return_hours - הכיתוב "שימו לב" ושעות הכיוונים במייל אישור ההזמנה (ברירות המחדל שאישר הבעלים;
//                                          הקוד משתמש באותן ברירות מחדל גם כשהשורות חסרות).
// כל המפתחות נוצרים רק אם חסרים - ערך קיים לעולם לא נדרס. dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית.
//   node scripts/seed_order_docs_delivery_settings.js --org=2          (dry-run)
//   node scripts/seed_order_docs_delivery_settings.js --org=2 --write
'use strict';

const { parseOrgArg } = require('./lib/db-env');
const { connectOrg } = require('./lib/seed-bool-setting');

const DEFS = [
  { key: 'delivery_as_item_row', name: 'המשלוח מוצג כשורת פריט בטבלת הפריטים (כרטיס, הדפסה, מייל)', category: 'משלוחים', type: 'boolean', value: 'false',
    notes: 'כשמופעל (ורק יחד עם "הצג משלוחים"), בהזמנת משלוח המשלוח מוצג כשורה לכל כיוון בטבלת הפריטים - בכרטיס ההזמנה, בהדפסה, בקובץ ה-PDF המצורף ובמייל אישור ההזמנה - עם כתובת, יום והמחיר. תצוגה בלבד: אינו פריט מלאי והסכום הכולל זהה. כבוי = כמו קודם.' },
  { key: 'gmach_pickup_address', name: 'כתובת האיסוף (במיילים ובמסמכים ללקוחות)', category: 'כללי', type: 'text', value: 'נווה יעקב',
    notes: 'הכתובת שמופיעה ללקוחות כ"כתובת האיסוף" - במייל אישור ההזמנה, בתזכורות, בכרטיס ההזמנה, בקובץ ה-PDF המצורף ובהדפסה. אם ריקה - מוצגת "כתובת הגמ"ח" כמו קודם.' },
  { key: 'delivery_notice_text', name: 'משלוח - כיתוב "שימו לב" במייל אישור ההזמנה', category: 'משלוחים', type: 'text', value: 'שימו לב: אם הזמנתם משלוח אין צורך לבוא לגמ"ח, והמשלוחן ייצור אתכם קשר.',
    notes: 'הכיתוב שמופיע במייל אישור ההזמנה כשיש משלוח בהזמנה (מעל שורות השעות). ריק = בלי משפט פתיחה.' },
  { key: 'delivery_outbound_hours', name: 'משלוח הלוך - שעות (בכיתוב "שימו לב")', category: 'משלוחים', type: 'text', value: 'בשעות אחה"צ–ערב',
    notes: 'השעות שמופיעות בשורה "משלוח הלוך" במייל אישור ההזמנה (רק כשההזמנה כוללת משלוח הלוך). ריק = בלי השורה.' },
  { key: 'delivery_return_hours', name: 'משלוח חזור - שעות (בכיתוב "שימו לב")', category: 'משלוחים', type: 'text', value: '10:00–13:00',
    notes: 'השעות שמופיעות בשורה "משלוח חזור" במייל אישור ההזמנה (רק כשההזמנה כוללת משלוח חזור). ריק = בלי השורה.' },
];

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  if (org !== 2) throw new Error('סקריפט זה מיועד לנווה יעקב בלבד (--org=2): בגמ"ח הראשי אין משלוחים ושום הגדרה לא משתנה');
  const { prisma } = connectOrg(org, write); // בודק host (לא ריק ושונה מה-DB של הגמ"ח השני)
  try {
    for (const def of DEFS) {
      const exists = await prisma.systemSetting.findUnique({ where: { key: def.key } });
      if (exists) { console.log(`org${org}: ${def.key} already exists (= ${JSON.stringify(exists.value)}), kept`); continue; }
      console.log(`org${org}: ${write ? 'create' : 'would create'} ${def.key} = ${JSON.stringify(def.value)}`);
      if (write) await prisma.systemSetting.create({ data: def });
    }
    if (!write) console.log('dry-run - pass --write to apply');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
