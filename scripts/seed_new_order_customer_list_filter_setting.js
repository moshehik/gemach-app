// new_order_customer_list_filter (אילו לקוחות מופיעים בבחירת "לקוח קיים" בהזמנה חדשה: 'all' = כל הלקוחות הפעילים, 'complete' = רק לקוחות
// עם כל הפרטים שנדרשים ביצירת לקוח; ר' lib/newOrderCustomerFilter.js). החלטת הבעלים (12.10.2026): נווה יעקב (org 2) = complete, הגמח הראשי
// (org 1) = all. ההגדרה נוצרת בשני ה-DB (הנוהל: מפתח חדש בשני הגמחים כדי שמסך ההגדרות יישאר זהה), רק עם הערך שמיועד לאותו גמח.
// ערך קיים של גמח לעולם לא נדרס כאן (אם שונה מהיעד - רק מדווח; לשינוי מכוון: מסך ההגדרות, הזמנות -> "שדות חובה בלקוח").
// בדיקת host (connectOrg): ה-DB שנבחר חייב להיות שונה מה-DB של הגמח השני. dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים.
// לא הורץ בבנייה ולא על פרודקשן.
//   node scripts/seed_new_order_customer_list_filter_setting.js --org=1            (dry-run)
//   node scripts/seed_new_order_customer_list_filter_setting.js --org=2 --write
'use strict';

const { parseOrgArg } = require('./lib/db-env');
const { connectOrg } = require('./lib/seed-bool-setting');

const KEY = 'new_order_customer_list_filter';
const NAME = 'אילו לקוחות מופיעים בבחירת לקוח קיים בהזמנה חדשה';
const NOTES = 'כל הלקוחות הפעילים (ברירת מחדל) או רק לקוחות עם כל הפרטים הנדרשים ביצירת לקוח חדש בגמ"ח הזה. משפיע רק על החיפוש בהזמנה חדשה (לפי טלפון ומהרשימה).';
const TARGET = { 1: 'all', 2: 'complete' };

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const value = TARGET[org];
  const { prisma } = connectOrg(org, write);
  try {
    const exists = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    if (exists) {
      console.log(`org${org}: ${KEY} already exists (= ${exists.value}), nothing to do` +
        (exists.value !== value ? ` [intended target would be ${value}, but an existing value of this org is never overwritten here]` : ''));
      return;
    }
    console.log(`org${org}: create ${KEY} = ${value}`);
    if (!write) { console.log('dry-run - pass --write to apply'); return; }
    await prisma.systemSetting.create({ data: { key: KEY, value, name: NAME, category: 'הזמנות', type: 'select', notes: NOTES } });
    console.log(`org${org}: done`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
