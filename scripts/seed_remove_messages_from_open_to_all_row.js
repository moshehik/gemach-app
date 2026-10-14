// דיווח f1f46d04 (הגמח הראשי, אישור רחלי 5.10.2026): להוריד את ההרשאה "הודעות פנימיות" (page:messages) מהשורה "עמודים ופעולות פתוחים
// לכל עובד" במסך ההרשאות, כך שכרטיס העובד יציג אותה "כבוי". זה שינוי נתוני הרשאות (PermissionPageGroup + DepartmentPermission) -
// לא קוד, ולכן סקריפט.
//
// מה הוא עושה (אותו דבר בדיוק כמו עריכת השורה במסך /admin/permissions: PUT page-groups/[groupId] + syncKeys ב-lib/permissionPageGroups.js):
//   1. מוצא את השורה בשם "עמודים ופעולות פתוחים לכל עובד" (חייבת להיות אחת בדיוק ועם page:messages), ומוריד ממנה את המפתח page:messages.
//   2. מחשב מחדש את הערכים האמיתיים של המפתח הזה משאר השורות שמכילות אותו: אם אין שורה כזו - נמחקות שורות DepartmentPermission
//      שלו ושורות EmployeePermissionOverride שנוצרו משורה (הערה שמתחילה ב"גישה פרטנית דרך שורת ההרשאה"), והמפתח חוזר לברירת
//      המחדל של הקטלוג (סגור - רק הנהלה ראשית ומתכנת נכנסים). override שהוגדר ידנית בכרטיס עובד לא נוגע.
// הגמח הראשי בלבד (org 1): הסקריפט מסרב לרוץ על org אחר ועל host שאינו של הגמח הראשי.
// dry-run כברירת מחדל (רק SELECT, מדפיס לפני/אחרי); כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
// כתיבה מסקריפט עצמאי לא נרשמת ביומן (הרחבת ה-AuditLog פועלת רק בתוך Next) - לכן הסקריפט מדפיס במקום זה את הערכים לפני ואחרי.
//   node scripts/seed_remove_messages_from_open_to_all_row.js --org=1          (dry-run)
//   node scripts/seed_remove_messages_from_open_to_all_row.js --org=1 --write
'use strict';

const { parseOrgArg } = require('./lib/db-env');
const { connectOrg } = require('./lib/seed-bool-setting');

const KEY = 'page:messages';
const ROW_NAME = 'עמודים ופעולות פתוחים לכל עובד';
const ORG1_HOST_PREFIX = 'ep-weathered-tree-avpypjjr'; // הגמח הראשי (docs/fix-protocol-error-reports.md סעיף 1)
const ROW_OVERRIDE_NOTE_PREFIX = 'גישה פרטנית דרך שורת ההרשאה'; // כמו ב-lib/permissionPageGroups.js

const parseJson = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };

// מצב המפתח כרגע: שורות הרשאה שמכילות אותו + ערכי המחלקות + overrides
async function snapshot(prisma) {
  const rows = await prisma.permissionPageGroup.findMany({ select: { id: true, name: true, keys: true, access: true, employeeIds: true } });
  const dept = await prisma.departmentPermission.findMany({ where: { key: KEY }, select: { roleId: true, value: true }, orderBy: { roleId: 'asc' } });
  const overrides = await prisma.employeePermissionOverride.findMany({ where: { key: KEY }, select: { employeeId: true, value: true, note: true } });
  return {
    rows,
    rowsWithKey: rows.filter((r) => parseJson(r.keys, []).includes(KEY)),
    dept,
    overrides,
  };
}

function print(label, s) {
  console.log(`--- ${label}`);
  console.log(`  rows containing ${KEY}: ${s.rowsWithKey.length}${s.rowsWithKey.length ? ' -> ' + s.rowsWithKey.map((r) => `"${r.name}" (${parseJson(r.keys, []).length} keys, access ${r.access})`).join('; ') : ''}`);
  console.log(`  DepartmentPermission rows for ${KEY}: ${s.dept.length}${s.dept.length ? ' -> ' + s.dept.map((d) => `role ${d.roleId}=${d.value}`).join(', ') : ''}`);
  console.log(`  EmployeePermissionOverride rows for ${KEY}: ${s.overrides.length}${s.overrides.length ? ' -> ' + s.overrides.map((o) => `${o.employeeId.slice(0, 8)}=${o.value}${(o.note || '').startsWith(ROW_OVERRIDE_NOTE_PREFIX) ? ' (from row)' : ' (personal)'}`).join(', ') : ''}`);
}

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  if (org !== 1) throw new Error('SAFETY ABORT: this script is for org 1 (the main gemach) only');
  const { prisma, host } = connectOrg(org, write);
  try {
    if (!host.startsWith(ORG1_HOST_PREFIX)) throw new Error(`SAFETY ABORT: org1 host "${host}" is not the main gemach host (${ORG1_HOST_PREFIX}...)`);

    const before = await snapshot(prisma);
    print('BEFORE', before);

    const candidates = before.rows.filter((r) => r.name === ROW_NAME);
    if (candidates.length !== 1) {
      console.log(`SAFETY ABORT: expected exactly one row named "${ROW_NAME}", found ${candidates.length}. Existing rows: ${before.rows.map((r) => `"${r.name}"`).join(', ') || '(none)'}`);
      process.exitCode = 1;
      return;
    }
    const row = candidates[0];
    const keys = parseJson(row.keys, []);
    if (!keys.includes(KEY)) {
      console.log(`Nothing to do: the row "${ROW_NAME}" no longer contains ${KEY}.`);
      return;
    }
    const newKeys = keys.filter((k) => k !== KEY);
    const otherRows = before.rows.filter((r) => r.id !== row.id && parseJson(r.keys, []).includes(KEY));
    console.log(`Plan: row "${ROW_NAME}" ${keys.length} -> ${newKeys.length} keys (removes ${KEY}); other rows still containing ${KEY}: ${otherRows.length}`);
    if (otherRows.length) console.log('  (the key is also in other rows, so its real values are re-derived from them - see syncKeys)');

    // השורות אחרי העדכון - אותה לוגיקה כמו resolveKeyFromRows / syncKeys
    const rowsAfter = before.rows.map((r) => (r.id === row.id ? { ...r, keys: JSON.stringify(newKeys) } : r)).filter((r) => parseJson(r.keys, []).includes(KEY));
    const access = {};
    const employeeIds = new Set();
    for (const r of rowsAfter) {
      for (const [roleId, value] of Object.entries(parseJson(r.access, {}))) access[roleId] = !!access[roleId] || !!value;
      for (const id of parseJson(r.employeeIds, [])) employeeIds.add(id);
    }
    const deptToClear = rowsAfter.length ? before.dept.filter((d) => !(String(d.roleId) in access)) : before.dept;
    const deptToSet = rowsAfter.length ? Object.entries(access) : [];
    const overridesToClear = before.overrides.filter((o) => (o.note || '').startsWith(ROW_OVERRIDE_NOTE_PREFIX) && !employeeIds.has(o.employeeId));
    console.log(`  would delete DepartmentPermission rows: ${deptToClear.length}; would upsert: ${deptToSet.length}; would delete row-created overrides: ${overridesToClear.length}`);

    if (!write) { console.log('dry-run - pass --write to apply'); return; }

    await prisma.permissionPageGroup.update({ where: { id: row.id }, data: { keys: JSON.stringify(newKeys) } });
    for (const d of deptToClear) await prisma.departmentPermission.delete({ where: { roleId_key: { roleId: d.roleId, key: KEY } } }).catch(() => null);
    for (const [roleIdStr, value] of deptToSet) {
      const roleId = parseInt(roleIdStr, 10);
      await prisma.departmentPermission.upsert({ where: { roleId_key: { roleId, key: KEY } }, create: { roleId, key: KEY, value: value ? 'true' : 'false' }, update: { value: value ? 'true' : 'false' } });
    }
    for (const o of overridesToClear) await prisma.employeePermissionOverride.delete({ where: { employeeId_key: { employeeId: o.employeeId, key: KEY } } }).catch(() => null);

    print('AFTER', await snapshot(prisma));
    console.log('done (the permission cache expires by itself within ~8 seconds per server instance)');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
