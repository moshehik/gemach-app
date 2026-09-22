// מוסיף את ההגדרה delivery_skip_weekends (אם עדיין לא קיימת) - דיווח a74ffa6d
// (נווה יעקב, 2026-09-22): תאריך ההוצאה/איסוף של משלוח צריך להיספר בימי עסקים
// בלבד (לא כולל שישי-שבת). לפי הנוהל הקבוע ב-CLAUDE.md - הגדרה חדשה שנוצרה
// בעקבות בקשה של גמח אחד בלבד נוצרת כשורה בשני הגמחים, אבל הערך המבוקש בפועל
// (true) מוכנס רק לגמח שביקש (org 2) - org 1 מקבל false, ששומר על ההתנהגות
// הקיימת שלו (ספירת ימים קלנדרית רגילה, כמו היום).
//
// אידמפוטנטי: בודק existence לפני יצירה, לא דורס ערך קיים.
// שימוש: node scripts/seed_delivery_skip_weekends_setting.js --org=1
//        node scripts/seed_delivery_skip_weekends_setting.js --org=2
const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const { org } = parseOrgArg(process.argv.slice(2));
const dbUrl = resolveDbUrl(org);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function main() {
  const value = org === 2 ? 'true' : 'false';
  const key = 'delivery_skip_weekends';
  const exists = await prisma.systemSetting.findUnique({ where: { key } });
  if (exists) {
    console.log(`org ${org}: already exists, skipped (value=${exists.value})`);
    return;
  }
  await prisma.systemSetting.create({
    data: {
      key,
      name: 'משלוחים - ספירת ימים לפי ימי עסקים (לא כולל שישי-שבת)',
      category: 'משלוחים',
      notes: 'כשמופעל, "ימי משלוח הלוך/חזור לפני/אחרי האירוע" נספרים בימי עסקים בלבד - יום שישי ושבת לא נספרים ולא נבחרים כיום הוצאה/איסוף. כבוי (ברירת מחדל) = ספירת ימים קלנדרית רגילה, כמו היום.',
      type: 'boolean',
      value,
    },
  });
  console.log(`org ${org}: created delivery_skip_weekends = ${value}`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
