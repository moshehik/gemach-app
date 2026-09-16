// מוסיף את הגדרות המשלוחן (§D, docs/deliveries-feature-plan-2026-09-16.md) - courier_email
// ו-courier_name - אם עדיין לא קיימות. אידמפוטנטי (בודק existence לפני יצירה, לא דורס ערך
// קיים). לא הרצה אוטומטית - ר' ההערה למטה לפני הפעלה.
//
// ההגדרות האלו כלליות (לא ספציפיות לארגון אחד), ולכן לפי הנוהל הקבוע ב-CLAUDE.md
// ("Standing procedure... for any new SystemSetting") יש ליצור את שתיהן בשני ה-DB-ים
// (הגמ"ח הראשי + נווה יעקב), עם ערך ריק בשניהם - זו הגדרה חדשה, אין עדיין ערך "נוכחי"
// לשמר. הרצה: `node scripts/seed_courier_settings.js` פעם אחת נגד ה-DATABASE_URL הרגיל
// (הגמ"ח הראשי), ופעם נוספת עם משתני הסביבה של נווה יעקב טעונים (ר' scratch/new_gemach_db.env).
//
// לא הרצתי סקריפט זה בסשן הזה - .active-db מצביע כרגע ל-prod ולא הייתה לי דרך בטוחה
// לבדוק מול TEST בסשן זה (חסימת הרשאות על העלאת שרת פיתוח משותף, ר' תיעוד ב-CLAUDE.md
// תחת "Deliveries feature"). להריץ ידנית אחרי בדיקה.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedCourierSettings() {
  const settings = [
    { key: 'courier_email', name: 'כתובת מייל למשלוחן', category: 'משלוחים', notes: 'הכתובת שאליה נשלחים נתוני משלוחים בלחיצה על "שליחה במייל" (הדפסת משלוחים > לשונית משלוחים).', type: 'text', value: '' },
    { key: 'courier_name', name: 'שם המשלוחן', category: 'משלוחים', notes: 'לתצוגה בלבד, לא בשימוש עדיין בהדפסה/במייל.', type: 'text', value: '' },
  ];

  let added = 0;
  for (const s of settings) {
    const exists = await prisma.systemSetting.findUnique({ where: { key: s.key } });
    if (!exists) {
      await prisma.systemSetting.create({ data: s });
      added++;
      console.log(`Added setting: ${s.key}`);
    } else {
      console.log(`Already exists, skipped: ${s.key}`);
    }
  }
  console.log(`Done. Added ${added} new setting(s).`);
}

seedCourierSettings()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
