// מוסיף את mandatory_field_groups (אם עדיין לא קיימת) - ר' lib/customerValidation.js:
// קבוצות "לפחות שדה אחד מספיק" (למשל טלפון נוסף / אימייל), עורך בהגדרות ע"י
// FieldGroupsEditor ב-app/admin/settings/SettingsClient.js. בניגוד לרוב ה-SystemSetting
// חדשות (שנוצרות בשני הגמחים אבל הערך המבוקש מוזן רק לגמח שביקש) - זו לא בקשה של גמח
// אחד, זו הפיכת התנהגות משותפת קיימת (טלפון-נוסף/מייל, אחד מספיק, קשיח בקוד בכ-9 מקומות)
// להגדרה - אז שני הגמחים מקבלים את אותו ערך שממש לתיאור ההתנהגות הקיימת שלהם.
// אידמפוטנטי (לא דורס ערך קיים). node scripts/seed_mandatory_field_groups_setting.js --org=1|2
'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

async function main() {
  const { org } = parseOrgArg(process.argv.slice(2));
  const url = resolveDbUrl(org);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const key = 'mandatory_field_groups';
    const exists = await prisma.systemSetting.findUnique({ where: { key } });
    if (exists) {
      console.log(`org${org}: already exists, skipped: ${key} = ${exists.value}`);
      return;
    }
    const value = JSON.stringify([['phone2', 'email']]);
    await prisma.systemSetting.create({
      data: {
        key,
        value,
        name: 'קבוצות "אחד מספיק" בשדות חובה',
        category: 'הזמנות',
        type: 'text',
        notes: 'קבוצות שדות "לפחות אחד מהם חובה" (למשל טלפון נוסף / אימייל) - בנפרד משדות חובה רגילים (חובה תמיד).',
      },
    });
    console.log(`org${org}: added setting ${key} = ${value}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
