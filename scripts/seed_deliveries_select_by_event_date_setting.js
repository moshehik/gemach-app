// מוסיף את deliveries_select_by_event_date (דיווח מייל 2026-09-18, סעיף 3 - נווה יעקב):
// כשדלוק, בחירת תאריך במסך המשלוחים/הדפסת משלוחן/מייל למשלוחן/דף "לשקית" היא לפי תאריך
// האירוע ולא לפי יום ההוצאה/החזרה. ברירת מחדל 'false' = ההתנהגות הקודמת. אידמפוטנטי (לא
// דורס ערך קיים). לפי הנוהל ב-CLAUDE.md מריצים גם נגד ה-DB של הגמ"ח הראשי וגם נגד נווה יעקב
// (שם מדליקים ל-true אחרי אישור בעל המערכת - זו הגדרה עסקית, ר' code-fixes-vs-settings scope).
// לא להריץ נגד PROD בלי אישור מפורש.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const key = 'deliveries_select_by_event_date';
  const exists = await prisma.systemSetting.findUnique({ where: { key } });
  if (exists) {
    console.log(`Already exists, skipped: ${key} = ${exists.value}`);
    return;
  }
  await prisma.systemSetting.create({
    data: {
      key,
      value: 'false',
      name: 'משלוחים - בחירת תאריך לפי תאריך האירוע',
      category: 'משלוחים',
      type: 'boolean',
      notes: 'כשמופעל, התאריך שנבחר במסך המשלוחים, בהדפסה/מייל למשלוחן ובדף "לשקית" הוא תאריך האירוע (ולא יום ההוצאה/החזרה); יום היציאה/האיסוף ממשיכים להופיע. כבוי = כמו היום.',
    },
  });
  console.log(`Added setting: ${key} = false`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
