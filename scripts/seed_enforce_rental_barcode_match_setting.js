// מוסיף את enforce_rental_barcode_match (חסימת השכרה של ברקוד שלא תואם לדגם/מידה שהוזמנו,
// ר' lib/rentalBarcodeMatch.js + lib/rentalBarcodeGuard.js) - false כברירת מחדל = ההתנהגות
// הישנה (כל ברקוד מתקבל), לפי docs/fix-protocol-error-reports.md סעיף 3. הקוד עובד גם
// כשהשורה חסרה (חסר = כבוי), כך שאין בעיה אם הפריסה קודמת להרצת הסקריפט.
// אידמפוטנטי (בודק existence, לא דורס ערך קיים).
//
// לפי הנוהל הקבוע ב-CLAUDE.md ("Standing procedure... for any new SystemSetting") יש ליצור
// את המפתח בשני ה-DB (גמ"ח ראשי + נווה יעקב) - אבל להדליק (true) רק במקום שביקשו.
//
// הרצה (מקומית, נגד ה-DB שב-DATABASE_URL):  node scripts/seed_enforce_rental_barcode_match_setting.js
// הסקריפט מדפיס את ה-host לפני הכתיבה - יש לוודא שזה ה-DB המיועד.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const key = 'enforce_rental_barcode_match';
  const host = (process.env.DATABASE_URL || '').match(/@([^/?]+)/)?.[1] || '(לא ידוע)';
  console.log(`DB host: ${host}`);
  const exists = await prisma.systemSetting.findUnique({ where: { key } });
  if (exists) {
    console.log(`Already exists, skipped: ${key} = ${exists.value}`);
    return;
  }
  await prisma.systemSetting.create({
    data: {
      key,
      value: 'false',
      name: 'חסום השכרה של ברקוד שלא תואם לשמלה שהוזמנה',
      category: 'מלאי',
      type: 'boolean',
      notes: 'כשמופעל, השרת דוחה השכרה של ברקוד שהדגם/מידה שלו שונים ממה שהוזמן בפריט; מנהל יכול לעקוף בסיסמה (ונשלחת התראה למנהלים). כבוי = כל ברקוד מתקבל.',
    },
  });
  console.log(`Added setting: ${key} = false`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
