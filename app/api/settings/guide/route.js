import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { buildSettingsGuide } from '@/lib/settingsMetadata';

export const dynamic = 'force-dynamic';

// "קובץ ההנחיות המלא" של ההגדרות - קטלוג קריא-מכונה של כל SystemSetting (שם/הערה
// בעברית, קטגוריה, מיקום בתפריט הניהול, סוג שדה, ערך נוכחי). שני צרכנים:
// 1. app/api/ai/route.js (ACTION: SETTINGS_GUIDE) - הסוכן/עוזר ה-AI קורא אותו
//    (קריאת פונקציה פנימית, לא HTTP) לפני שהוא עונה על שאלה על הגדרות מערכת.
// 2. app/components/SettingQuickPanel.js - הפאנל המהיר שנפתח מכפתור [OPEN_SETTING:key]
//    בצ'אט ה-AI, שקורא ל-endpoint הזה ישירות מהדפדפן.
// מוגבל למנהל/מתכנת (roleId 1/2) - אותה רמה בדיוק שכבר נותנת לעוזר ה-AI "גישה
// מלאה" ב-app/api/ai/route.js, ותואם את ההגבלה שכבר קיימת על עמוד ההגדרות עצמו.
export async function GET() {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'Unauthorized. Manager access required.' }, { status: 401 });
  }
  try {
    const rows = await getAllCachedSettings();
    const settings = buildSettingsGuide(rows);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error building settings guide:', error);
    return NextResponse.json({ error: 'Failed to build settings guide' }, { status: 500 });
  }
}
