// מוסיף את ai_screen_recording_enabled (עוזר ה-AI - ניתוח הקלטות מסך, ר' תוכנית
// AI-assistant-capture-features) - false כברירת מחדל (תכונה חדשה לגמרי, כבויה
// עד שמישהו מדליק אותה במפורש דרך /admin/settings ← בינה מלאכותית).
// אידמפוטנטי (בודק existence לפני יצירה, לא דורס ערך קיים אם כבר רץ).
//
// לפי הנוהל הקבוע ב-CLAUDE.md ("Standing procedure... for any new SystemSetting")
// יש להריץ את זה גם נגד ה-DB של הגמ"ח הראשי (סקריפט זה, נגד ה-DATABASE_URL הרגיל)
// וגם נגד נווה יעקב (scratch/seed_ai_screen_recording_setting_org2.js) - שני
// הארגונים מקבלים את אותו מפתח, שניהם false כי זו תכונה חדשה שאף אחד לא ביקש עדיין.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const key = 'ai_screen_recording_enabled';
  const exists = await prisma.systemSetting.findUnique({ where: { key } });
  if (exists) {
    console.log(`Already exists, skipped: ${key}`);
    return;
  }
  await prisma.systemSetting.create({
    data: { key, value: 'false', name: 'אפשר ניתוח הקלטות מסך בעוזר ה-AI', category: 'בינה מלאכותית', type: 'boolean' },
  });
  console.log(`Added setting: ${key} = false`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
