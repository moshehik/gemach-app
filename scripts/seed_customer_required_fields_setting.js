// מוסיף את customer_required_fields (כרטיס הלקוח החדש, תשובת הבעלים 4.10.2026: "מקום בהגדרות לקבוע איזה שדות הם חובה").
// בלי השורה ב-DB ההגדרה פשוט לא מוצגת במסך ההגדרות - הקוד משתמש בברירת המחדל (שם פרטי, שם משפחה, טלפון = מה שחובה היום),
// כך שאין שינוי התנהגות. הערך שנזרע זהה לברירת המחדל בשני הגמחים (אין כאן החלטה עסקית פר-ארגון).
// אידמפוטנטי (לא דורס ערך קיים). לא הורץ - להריץ רק באישור, לכל ארגון בנפרד:
//   node scripts/seed_customer_required_fields_setting.js --org=1
//   node scripts/seed_customer_required_fields_setting.js --org=2
'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

async function main() {
  const { org } = parseOrgArg(process.argv.slice(2));
  const url = resolveDbUrl(org);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const key = 'customer_required_fields';
    const exists = await prisma.systemSetting.findUnique({ where: { key } });
    if (exists) {
      console.log(`org${org}: already exists, skipped: ${key} = ${exists.value}`);
      return;
    }
    await prisma.systemSetting.create({
      data: {
        key,
        value: 'firstName,lastName,phone1',
        name: 'שדות חובה בכרטיס לקוח',
        category: 'הזמנות',
        type: 'text',
        notes: 'השדות שחייבים להיות מלאים בכרטיס הלקוח החדש - נבדק בכל שמירה (עריכה ולקוח חדש), במסך ובשרת.',
      },
    });
    console.log(`org${org}: added setting ${key}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
