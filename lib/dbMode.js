// lib/dbMode.js - איזה מסד הבקשה הנוכחית צריכה לקרוא: זיהוי "מצב גיבוי במחשב הזה בלבד" ותגית-מסד למטמוני שרת.
//
// "מצב גיבוי במחשב הזה בלבד" = עוגייה חתומה בדפדפן (lib/deviceDbView.js). ההחלטה חייבת להתקבל פר בקשה, והפרוקסי של
// app/lib/prisma.js לא יכול לעשות await ל-cookies(), לכן העוגייה נקראת סינכרונית מה-request store של Next עצמו.
// כל כשל בקריאה = "אין עקיפה למחשב הזה" (לא זורק). במודול נפרד מ-prisma.js כדי שלא יצטרך להיות חלק מה-shim של prisma בבדיקות.

import { DEVICE_DB_VIEW_COOKIE, isDeviceBackupToken } from '@/lib/deviceDbView';

const deviceViewByRequest = new WeakMap(); // request store -> boolean: החתימה מאומתת פעם אחת לכל בקשה

export function readDeviceBackupFlag() {
  try {
    const { workUnitAsyncStorage } = require('next/dist/server/app-render/work-unit-async-storage.external');
    const store = workUnitAsyncStorage.getStore();
    if (!store || store.type !== 'request' || !store.cookies) return false;
    if (deviceViewByRequest.has(store)) return deviceViewByRequest.get(store);
    const token = store.cookies.get(DEVICE_DB_VIEW_COOKIE)?.value;
    const on = isDeviceBackupToken(token);
    deviceViewByRequest.set(store, on);
    return on;
  } catch (e) {
    return false;
  }
}

// true כשהבקשה שמטופלת עכשיו שייכת למחשב שעבר למצב גיבוי (ויש מסד גיבוי בתהליך)
export function isDeviceBackupRequest() {
  return !!globalThis.prismaTest && readDeviceBackupFlag();
}

// תגית למפתחות של מטמוני זיכרון בשרת שמחזיקים שורות מה-DB: בקשה שקוראת ממסד אחד לא תקבל שורות של המסד השני
// (גם הדגלים הגלובליים .active-db / web_backup_mode וגם העוגייה של המחשב).
export function currentDbModeTag() {
  try { return `${globalThis.activeDbMode || ''}|${globalThis.webDbModeState?.mode || ''}|${readDeviceBackupFlag() ? 'dev' : ''}`; } catch { return ''; }
}
