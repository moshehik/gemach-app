#!/usr/bin/env node
/**
 * scripts/grant-employee-permission.js
 * ============================================================================
 * מעניק לעובד/ת אחד/ת הרשאה אישית (חריגה אישית = EmployeePermissionOverride, value 'true') בדיוק כמו
 * "הרשאות ספציפיות" בכרטיס העובד (PUT /api/admin/permissions/employees/[employeeId] -> setEmployeeOverride
 * עם audit:true ב-lib/permissions.js). dry-run כברירת מחדל - כתיבה רק עם --write.
 *
 * ארגומנטים
 *   --org=1|2                  הגמח (חובה). org1 = הראשי, org2 = נווה יעקב. בדיקת host: ה-DB חייב להיות שונה מה-DB של הגמח השני.
 *   --employee-name="<שם>"     שם מלא או חלקי (עברית). כל מילה בשם חייבת להופיע בשם הפרטי/משפחה (בכל סדר).
 *                              חייב להתאים בדיוק לעובד/ת פעיל/ה אחד/ת; אחרת מודפסת רשימת מועמדים עם id ויציאה עם קוד 2.
 *   --key=<מפתח>               מפתח מקטלוג ההרשאות (lib/permissionsMetadata.js), למשל feature:export_over_limit_approval.
 *                              חייב להיות פריט בוליאני בקטלוג ולא notConfigurable.
 *   --write                    כתיבה בפועל (בלי זה - רק מדפיס מה היה משתנה).
 *   --replace-block            נדרש רק אם לעובד/ת קיימת חסימה אישית (override=false) על המפתח; בלי הדגל הסקריפט מסרב.
 *
 * מה הסקריפט עושה (ומה הוא לא)
 *   - אידמפוטנטי: אם כבר יש override='true' (או שהעובד/ת רשום/ה בשורת הרשאה שמכילה את המפתח, או רול 0/2 שמורשים תמיד) - לא משנה כלום.
 *   - שומר על כלל הבעלות של האפליקציה: מפתח שהעובד/ת רשום/ה עליו בשורת הרשאה (PermissionPageGroup) שייך לשורה, ולכן
 *     לא נוצרת חריגה אישית (האפליקציה עצמה מסרבת - 409). משנים אותו במסך /admin/permissions.
 *   - ה-note של החריגה נשאר ריק, כמו בכרטיס העובד (note שמתחיל ב"גישה פרטנית דרך שורת ההרשאה" היה נמחק בסנכרון שורות).
 *   - מחיקה/סנכרון של שורות הרשאה לא נוגעים כאן.
 *
 * רישום היסטוריה (AuditLog)
 *   האפליקציה כותבת היסטוריה דרך תוסף ה-Prisma של app/lib/prisma.js (קובץ ESM של Next שלא ניתן לטעון מסקריפט node רגיל:
 *   next/headers, @/ aliases). לכן הסקריפט עושה במדויק מה שהתוסף עושה לקריאת auditAs של setEmployeeOverride:
 *   שורת AuditLog אחת באותה טרנזקציה, entityType=EmployeePermissionOverride, action=CREATE/UPDATE,
 *   changesJson={employeeId,key,value:{from,to}}, employeeId=null (אין עובד מחובר). שורת היסטוריה אחת בלבד לכל שינוי.
 *
 * מטמון הרשאות
 *   האפליקציה מנקה מטמון בתוך התהליך שטיפל בבקשה (invalidatePermissionCache); סקריפט חיצוני לא יכול לנקות את
 *   המטמון של שרתי Vercel. המטמון הזה (explicitCache ב-lib/permissions.js) הוא TTL של 8 שניות, ולכן ההרשאה נכנסת
 *   לתוקף בכל המופעים תוך ~8 שניות מהכתיבה, בלי פעולה נוספת.
 *
 * דוגמה - אהובה פינקל, נווה יעקב, "אישור ייצוא מעל הכמות המרבית":
 *   node scripts/grant-employee-permission.js --org=2 --employee-name="אהובה פינקל" --key=feature:export_over_limit_approval
 *   node scripts/grant-employee-permission.js --org=2 --employee-name="אהובה פינקל" --key=feature:export_over_limit_approval --write
 * (הפקודה הראשונה היא dry-run: מדפיסה את העובדת שנמצאה ומה ישתנה. מריצים את השנייה רק אחרי בדיקת ההדפסה.)
 */
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const { connectOrg } = require('./lib/seed-bool-setting');
const { parseOrgArg } = require('./lib/db-env');

const ROW_OVERRIDE_NOTE_PREFIX = 'גישה פרטנית דרך שורת ההרשאה'; // lib/permissionPageGroups.js
const ALWAYS_ALLOWED_ROLE_IDS = [0, 2]; // lib/permissionsMetadata.js (נטען מהקטלוג בפועל, ראו loadCatalog)

function getArg(argv, name) {
  const prefix = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function normName(s) {
  return String(s || '')
    .replace(/["'`׳״‘’“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function fullName(e) {
  return `${e.firstName || ''} ${e.lastName || ''}`.trim();
}

function matchesName(e, query) {
  const tokens = normName(query).split(' ').filter(Boolean);
  if (!tokens.length) return false;
  const hay = `${normName(e.firstName)} ${normName(e.lastName)}`;
  return tokens.every((t) => hay.includes(t));
}

function printCandidates(list) {
  for (const e of list) {
    console.log(`  id=${e.id}  name="${fullName(e)}"  roleId=${e.roleId}  isActive=${e.isActive}`);
  }
}

// הקטלוג הוא ESM בלי תלויות (lib/permissionsMetadata.js) - טוענים אותו ישירות כדי לא לשכפל את רשימת המפתחות.
async function loadCatalog() {
  const file = path.join(__dirname, '..', 'lib', 'permissionsMetadata.js');
  return import(pathToFileURL(file).href);
}

async function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const replaceBlock = argv.includes('--replace-block');
  if (!argv.some((a) => /^--org=/.test(a))) throw new Error('--org=1|2 is required');
  const { org } = parseOrgArg(argv);
  const nameQuery = getArg(argv, 'employee-name');
  const key = getArg(argv, 'key');
  if (!nameQuery || !key) throw new Error('usage: --org=1|2 --employee-name="<name>" --key=<permission key> [--write] [--replace-block]');

  // 1) מפתח מול הקטלוג - לפני כל חיבור ל-DB
  const catalog = await loadCatalog();
  const item = catalog.getCatalogItem(key);
  if (!item) {
    const known = catalog.PERMISSION_CATALOG.filter((i) => i.type === 'boolean' && !i.notConfigurable).map((i) => i.key);
    console.error(`Unknown permission key "${key}". Configurable boolean keys in the catalog:\n  ${known.join('\n  ')}`);
    process.exitCode = 2;
    return;
  }
  if (item.type !== 'boolean') throw new Error(`"${key}" is a ${item.type} item - this script only grants boolean permissions`);
  if (item.notConfigurable) throw new Error(`"${key}" is locked (notConfigurable) - the app does not allow personal overrides for it`);
  const alwaysAllowed = catalog.ALWAYS_ALLOWED_ROLE_IDS || ALWAYS_ALLOWED_ROLE_IDS;
  console.log(`permission: ${key} - ${item.label}`);

  const { prisma } = connectOrg(org, write);
  try {
    // 2) הפיכת השם לעובד/ת פעיל/ה אחד/ת בדיוק (בלי שדות סיסמה)
    const all = await prisma.employee.findMany({
      select: { id: true, firstName: true, lastName: true, roleId: true, isActive: true },
    });
    const matches = all.filter((e) => matchesName(e, nameQuery));
    const active = matches.filter((e) => e.isActive);
    if (active.length !== 1) {
      if (active.length === 0) {
        console.error(`No ACTIVE employee matches "${nameQuery}" on org${org}.` + (matches.length ? ' Inactive matches:' : ' No employee matches at all.'));
        printCandidates(matches);
      } else {
        console.error(`"${nameQuery}" matches ${active.length} active employees on org${org} - refine --employee-name. Candidates:`);
        printCandidates(active);
      }
      process.exitCode = 2;
      return;
    }
    const emp = active[0];
    console.log(`employee: id=${emp.id}  name="${fullName(emp)}"  roleId=${emp.roleId}`);

    // 3) מצב נוכחי
    if (alwaysAllowed.includes(emp.roleId)) {
      console.log(`NO CHANGE: roleId ${emp.roleId} (head management / programmer) is always allowed every boolean permission.`);
      return;
    }
    const groupRows = await prisma.permissionPageGroup.findMany();
    const parse = (v, fb) => { try { return JSON.parse(v) ?? fb; } catch { return fb; } };
    const owningRows = groupRows.filter((r) => parse(r.keys, []).includes(key) && parse(r.employeeIds, []).includes(emp.id));
    if (owningRows.length) {
      console.log(`NO CHANGE: the employee is already listed in permission row(s) ${owningRows.map((r) => `"${r.name}"`).join(', ')} that contain this key.`
        + ' Such a grant belongs to the row (edit it at /admin/permissions, the app refuses a personal override here).');
      return;
    }
    const where = { employeeId_key: { employeeId: emp.id, key } };
    const prev = await prisma.employeePermissionOverride.findUnique({ where });
    const deptRow = emp.roleId === null || emp.roleId === undefined ? null
      : await prisma.departmentPermission.findUnique({ where: { roleId_key: { roleId: emp.roleId, key } } });
    console.log(`department (roleId ${emp.roleId}) explicit value: ${deptRow ? deptRow.value : '(none - catalog default)'}`);
    console.log(`current personal override: ${prev ? `value=${prev.value}${prev.note ? ` note="${prev.note}"` : ''}` : '(none)'}`);

    if (prev && prev.value === 'true') {
      console.log('NO CHANGE: the employee already has this permission (override = true).');
      return;
    }
    if (prev && prev.value === 'false' && !replaceBlock) {
      console.error('REFUSED: the employee has a personal BLOCK (override = false) on this key. Pass --replace-block to overwrite it.');
      process.exitCode = 2;
      return;
    }

    const action = prev ? 'UPDATE' : 'CREATE';
    console.log(`WOULD ${action}: EmployeePermissionOverride { employeeId: ${emp.id}, key: ${key}, value: 'true', note: null }`
      + (prev ? ` (was value=${prev.value}${prev.note ? `, note="${prev.note}"` : ''})` : '')
      + ` + 1 AuditLog row (${action}, changes {employeeId,key,value:{from:${prev ? prev.value === 'true' : null},to:true}}).`);
    if (!write) { console.log('dry-run - pass --write to apply'); return; }

    // 4) כתיבה: override + שורת היסטוריה אחת באותה טרנזקציה (כמו התוסף של האפליקציה)
    const changes = { employeeId: emp.id, key, value: { from: prev ? prev.value === 'true' : null, to: true } };
    await prisma.$transaction(async (tx) => {
      const saved = prev
        ? await tx.employeePermissionOverride.update({ where, data: { value: 'true', note: null } })
        : await tx.employeePermissionOverride.create({ data: { employeeId: emp.id, key, value: 'true', note: null } });
      await tx.auditLog.create({
        data: {
          entityType: 'EmployeePermissionOverride',
          entityId: String(saved.id),
          action,
          changesJson: JSON.stringify(changes),
          employeeId: null,
        },
      });
    });
    console.log(`DONE: ${action} written for "${fullName(emp)}" (${key} = true). Takes effect on all server instances within ~8s (permission cache TTL).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
