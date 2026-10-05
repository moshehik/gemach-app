import { getCachedSetting } from '@/lib/settingsCache';

// hide_internal_messaging (הגדרות > תצוגה, "הפעל מערכת הודעות פנימית"): הערך 'true' = מערכת ההודעות הפנימית בין עובדים כבויה.
// התפריטים כבר מסתירים אותה (app/layout.js, lib/menu/buildMenuTree.js), אבל הדף /messages נבדק רק מול ההרשאה page:messages ולכן
// נפתח בכתובת ישירה גם כשההודעות כבויות (דיווח f1f46d04). app/messages/layout.js משתמש בזה כדי לחסום את הדף.
// נכשל פתוח (שגיאת DB = לא כבוי) כמו שאר קריאות ההגדרות בשרת - ההרשאה עדיין נבדקת אחרי זה.
export async function isInternalMessagingOff() {
  try {
    const row = await getCachedSetting('hide_internal_messaging');
    return String(row?.value ?? '').trim().toLowerCase() === 'true';
  } catch {
    return false;
  }
}
