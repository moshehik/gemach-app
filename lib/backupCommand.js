// lib/backupCommand.js - "פקודת" חיפוש בדף הבית שמבקשת לעבור למסד הגיבוי במחשב הזה (ר' useBackupSwitchCommand).
// טהור (בלי React/DB), נבדק ב-scripts/device-db-view.test.mjs. מזהה רק ביטוי שלם ("עבור למסד הגיבוי", "מצב גיבוי", "נתוני גיבוי",
// "מסד בדיקות"...) כדי ששם של לקוחה או חיפוש רגיל לא יפעילו אותה בטעות.

const VERB = '(?:עבור|מעבר|לעבור|עבוד|היכנס|כניסה|הפעל)';
const NOUN = '(?:מסד(?:\\s+נתונים)?|מצב|נתוני|נתונים)';
const TARGET = '(?:ה?גיבוי|ה?בדיקות|ה?בדיקה)';
const COMMAND_RE = new RegExp(`^(?:${VERB}\\s+)?ל?${NOUN}\\s+${TARGET}$`);

export function isBackupSwitchCommand(text) {
  const t = String(text || '')
    .replace(/[֑-ׇ]/g, '') // ניקוד וטעמים
    .replace(/["'׳״.,!?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return !!t && COMMAND_RE.test(t);
}
