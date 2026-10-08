// lib/deviceBackupAccess.js - מי רשאי להפעיל "מצב גיבוי במחשב הזה בלבד" (lib/deviceDbView.js).
// מתכנת (roleId 2) תמיד. כל עובד אחר - רק אם המתכנת הוסיף אותו לרשימה (SystemSetting device_backup_employee_ids, מערך JSON של
// Employee.id). בכוונה לא דרך מערכת ההרשאות הרגילה: הנהלה ראשית (roleId 0) מורשית שם אוטומטית ויכולה לערוך שורות הרשאה,
// וכאן רק המתכנת מחליט (הכתיבה לרשימה חסומה לו ב-PUT /api/admin/db-view/access וב-POST /api/settings).

import prisma from '@/app/lib/prisma';

export const DEVICE_BACKUP_EMPLOYEES_KEY = 'device_backup_employee_ids';
const PROGRAMMER_ROLE_ID = 2; // DEVELOPER_ONLY_ROLES ב-lib/roles.js

export function parseAllowedIds(raw) {
  try {
    const arr = JSON.parse(String(raw || '[]'));
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x) : [];
  } catch {
    return [];
  }
}

// קריאה ישירה (לא מהמטמון של הגדרות): הסרת הרשאה צריכה לחול מיד.
export async function getAllowedEmployeeIds() {
  const row = await prisma.systemSetting.findUnique({ where: { key: DEVICE_BACKUP_EMPLOYEES_KEY } }).catch(() => null);
  return parseAllowedIds(row && row.value);
}

export async function canEnableDeviceBackup(employee) {
  if (!employee || !employee.id) return false;
  if (employee.roleId === PROGRAMMER_ROLE_ID) return true;
  return (await getAllowedEmployeeIds()).includes(employee.id);
}
