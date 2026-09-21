// Resolution + mutation for the department/employee permission system — the data
// layer behind /admin/permissions and the "הרשאות ספציפיות" section on an employee's
// card. See lib/permissionsMetadata.js for the catalog and CLAUDE.md's "Permissions
// system" section for the standing rule on when new access-control decisions must be
// added here instead of a new hardcoded roleId check.
//
// ONE model for every item (pages AND features - AI and error reports included).
// Precedence for an employee's effective value of a given key:
//   0. Head management (roleId 0) and programmer (roleId 2) - always allowed every boolean item.
//   1. Explicit EmployeePermissionOverride row for that employee+key (true OR false) - wins.
//   2. Explicit DepartmentPermission row for the employee's roleId+key.
//   3. The catalog item's defaultForRoleId(roleId) — chosen to match today's real
//      behavior, so an untouched system changes nothing.
// /admin/permissions (permission rows -> syncKeys) and the employee card write the SAME two tables.
// Nothing reads Employee.showAi / Employee.canReportErrors any more (2026-09-20: their values were
// migrated into override rows by scripts/migrate_legacy_permission_flags.js; the columns stay in
// the schema, unused).
//
// Everything here keys department-level rows by roleId (int), not Department.id
// (uuid) — matches Employee's own relation to Department (Employee.roleId →
// Department.roleId) so every call site can resolve a value from a roleId it
// already has (session token, an existing `select: { roleId: true }`, Employee.roleId
// itself) without an extra join to load the Department row.
import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';
import { getCachedSetting } from '@/lib/settingsCache';
import { getCatalogItem, defaultValueForRoleId, ALWAYS_ALLOWED_ROLE_IDS } from './permissionsMetadata';
import { getVerifiedAuthCookie } from './authTokens';
import { checkAuth, getSessionEmployee, readVerifiedSession } from './auth';

// Items whose default follows an org-level SystemSetting (catalog `settingKeys`: refunds, dress
// catalog, monthly board) resolve it here, through the 30s settings cache.
async function loadItemSettings(item) {
  if (!item || !item.settingKeys) return undefined;
  const out = {};
  for (const key of item.settingKeys) {
    const row = await getCachedSetting(key).catch(() => null);
    out[key] = row ? row.value : undefined;
  }
  return out;
}

// Every write below changes what canOpenPage()/resolvePageAccess() may have cached.
const explicitCache = new Map();
const EXPLICIT_TTL_MS = 8 * 1000; // writes only clear the cache of the instance that handled them; other instances converge within this window
export function invalidatePermissionCache() {
  explicitCache.clear();
}

function coerceValue(item, rawValue) {
  if (rawValue === undefined || rawValue === null) return undefined;
  if (item.type === 'boolean') return rawValue === true || rawValue === 'true';
  if (item.type === 'number') {
    const n = typeof rawValue === 'number' ? rawValue : parseInt(rawValue, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return rawValue;
}

function serializeValue(item, value) {
  if (item.type === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

// --- Department level (keyed by roleId) -------------------------------------

export async function getDepartmentPermissionRows(roleId) {
  if (roleId === null || roleId === undefined) return [];
  return prisma.departmentPermission.findMany({ where: { roleId } });
}

export async function getDepartmentEffectiveValue(roleId, key) {
  const item = getCatalogItem(key);
  if (!item) return undefined;
  const settings = await loadItemSettings(item);
  if (roleId === null || roleId === undefined) return defaultValueForRoleId(item, null, settings);
  // roleId 2 (מתכנת) and roleId 0 (הנהלה ראשית) are unconditionally allowed every boolean
  // permission (ALWAYS_ALLOWED_ROLE_IDS) - no DepartmentPermission row can restrict them,
  // on purpose, so there's nothing to look up or show as an editable column for these
  // roles. What is restricted to the programmer alone is gated by DEVELOPER_ONLY_ROLES in
  // lib/auth.js, outside this catalog. Numeric items still resolve normally (a threshold
  // has no meaningful "unlimited" boolean equivalent).
  if (ALWAYS_ALLOWED_ROLE_IDS.includes(roleId) && item.type === 'boolean') return true;
  const row = await prisma.departmentPermission.findUnique({
    where: { roleId_key: { roleId, key } },
  });
  if (row) return coerceValue(item, row.value);
  return defaultValueForRoleId(item, roleId, settings);
}

export async function setDepartmentPermission(roleId, key, value) {
  const item = getCatalogItem(key);
  if (!item) throw new Error(`Unknown permission key: ${key}`);
  const serialized = serializeValue(item, value);
  invalidatePermissionCache();
  try {
    return await prisma.departmentPermission.upsert({
      where: { roleId_key: { roleId, key } },
      create: { roleId, key, value: serialized },
      update: { value: serialized },
    });
  } finally {
    invalidatePermissionCache(); // a request that landed mid-write must not keep the old value cached
  }
}

export async function clearDepartmentPermission(roleId, key) {
  invalidatePermissionCache();
  try {
    return await prisma.departmentPermission
      .delete({ where: { roleId_key: { roleId, key } } })
      .catch(() => null); // no-op if it was already at its default
  } finally {
    invalidatePermissionCache();
  }
}

// --- Employee level (includes department fallback) --------------------------

// `employee` must include at least { id, roleId } — the selects already used across the app for
// auth/session purposes include both, so no new query shape is needed at most call sites.
export async function getEmployeeEffectiveValue(employee, key) {
  const item = getCatalogItem(key);
  if (!item || !employee) return undefined;

  const deptDefault = await getDepartmentEffectiveValue(employee.roleId, key);
  // head management / programmer: no override can restrict them (same rule as resolvePageAccess)
  if (item.type === 'boolean' && ALWAYS_ALLOWED_ROLE_IDS.includes(employee.roleId)) return true;

  if (!employee.id) return deptDefault;
  const override = await prisma.employeePermissionOverride
    .findUnique({ where: { employeeId_key: { employeeId: employee.id, key } } })
    .catch(() => null);
  if (override) return coerceValue(item, override.value);
  return deptDefault;
}

export async function hasPermission(employee, key) {
  return !!(await getEmployeeEffectiveValue(employee, key));
}

export async function setEmployeeOverride(employeeId, key, value, { note } = {}) {
  const item = getCatalogItem(key);
  if (!item) throw new Error(`Unknown permission key: ${key}`);
  const serialized = serializeValue(item, value);
  invalidatePermissionCache();
  try {
    return await prisma.employeePermissionOverride.upsert({
      where: { employeeId_key: { employeeId, key } },
      create: { employeeId, key, value: serialized, note: note || null },
      update: { value: serialized, note: note || null },
    });
  } finally {
    invalidatePermissionCache();
  }
}

export async function clearEmployeeOverride(employeeId, key) {
  invalidatePermissionCache();
  try {
    return await prisma.employeePermissionOverride
      .delete({ where: { employeeId_key: { employeeId, key } } })
      .catch(() => null);
  } finally {
    invalidatePermissionCache();
  }
}

export async function getEmployeeOverrideRows(employeeId) {
  if (!employeeId) return [];
  return prisma.employeePermissionOverride.findMany({ where: { employeeId } });
}

// --- Batch helper for lists (avoids N+1 when resolving one key across many
// already-loaded employees, e.g. the manager-approval employee picker) ------
export async function getEffectiveValueForEmployees(employees, key) {
  const item = getCatalogItem(key);
  if (!item) return new Map();
  const itemSettings = await loadItemSettings(item);

  const roleIds = [...new Set(employees.map((e) => e.roleId).filter((r) => r !== null && r !== undefined))];
  const employeeIds = employees.map((e) => e.id);

  const [deptRows, overrideRows] = await Promise.all([
    roleIds.length
      ? prisma.departmentPermission.findMany({ where: { roleId: { in: roleIds }, key } })
      : [],
    prisma.employeePermissionOverride.findMany({ where: { employeeId: { in: employeeIds }, key } }),
  ]);
  const deptRowByRoleId = new Map(deptRows.map((r) => [r.roleId, r]));
  const overrideByEmployee = new Map(overrideRows.map((r) => [r.employeeId, r]));

  const result = new Map();
  for (const employee of employees) {
    const deptRow = employee.roleId !== null && employee.roleId !== undefined ? deptRowByRoleId.get(employee.roleId) : null;
    let deptDefault = deptRow ? coerceValue(item, deptRow.value) : defaultValueForRoleId(item, employee.roleId, itemSettings);
    if (ALWAYS_ALLOWED_ROLE_IDS.includes(employee.roleId) && item.type === 'boolean') deptDefault = true;

    let effective = deptDefault;
    const override = overrideByEmployee.get(employee.id);
    if (override) effective = coerceValue(item, override.value);
    if (ALWAYS_ALLOWED_ROLE_IDS.includes(employee.roleId) && item.type === 'boolean') effective = true;
    result.set(employee.id, effective);
  }
  return result;
}

// --- feature:ai, enforced at the API (not just by hiding the widget) --------------------
// Every route under app/api/ai/** calls this. Before 2026-09-20 the feature was enforced only
// by whether app/layout.js mounted the AI widget, so ANY logged-in employee could POST to
// /api/ai (an LLM that writes SQL against the whole database) directly.
// Rules, identical to what app/layout.js does to hide the UI:
//   - the global kill switch hide_ai_features=true blocks everybody;
//   - a logged-in employee needs feature:ai (head management / programmer always have it;
//     otherwise an employee override, their department row, or the default);
//   - an anonymous caller is allowed ONLY while require_login is off (open mode - that is the
//     customer kiosk's AI box, which has no employee identity by design).
// (The old enable_ai_specific_employees setting no longer gates this: it silently turned every
// department/employee grant made on /admin/permissions into a no-op.)
export async function checkAiAccess() {
  const hide = await getCachedSetting('hide_ai_features').catch(() => null);
  if (hide && hide.value === 'true') return false;

  const employee = await getSessionEmployee();
  if (employee) return hasPermission(employee, 'feature:ai');

  const cookieStore = await cookies();
  if (getVerifiedAuthCookie(cookieStore)?.value) return false; // verified session of a deleted/deactivated employee
  return !!(await checkAuth()); // anonymous: true only in open mode
}

// --- feature:debt_approval, checked where the approval is RECORDED ----------------------
// The order-save popup asks a manager to identify + type their password (POST /api/auth/verify-pin)
// and then sends that manager's id back as debtApprovedBy. The routes that write the
// DEBT_APPROVED audit row used to trust whatever id arrived, so a direct API call could attribute
// an approval to anyone. They now confirm the named approver is an active employee who actually
// holds feature:debt_approval. (The server still does not refuse to save an unpaid order - that is
// a business process, not a permission - it only refuses to record a forged approver.)
export async function canApproveDebt(employeeId) {
  if (!employeeId || typeof employeeId !== 'string') return false;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, roleId: true, isActive: true },
  });
  if (!employee || !employee.isActive) return false;
  return hasPermission(employee, 'feature:debt_approval');
}

// --- boolean items (page:* AND feature:*), resolved in one place -------------------------------
// One place decides "may this employee open this page / use this feature": head management /
// programmer always; otherwise the employee's own override, else their department's explicit value,
// else the catalog default (which, for refunds / dress catalog / monthly board, follows the org's
// restrict_* setting). The layouts (canOpenPage), the sidebar and the AI widget (resolvePageAccess in
// app/layout.js) all call this, so a link / widget is shown exactly when the thing really works.
async function getExplicitValues(roleId, employeeId) {
  const cacheKey = `${roleId}|${employeeId || ''}`;
  const hit = explicitCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.value;
  const [deptRows, overrideRows] = await Promise.all([
    roleId === null || roleId === undefined ? [] : prisma.departmentPermission.findMany({ where: { roleId } }),
    employeeId ? prisma.employeePermissionOverride.findMany({ where: { employeeId } }) : [],
  ]);
  const value = {
    dept: new Map(deptRows.map((r) => [r.key, r.value === 'true'])),
    emp: new Map(overrideRows.map((r) => [r.key, r.value === 'true'])),
  };
  explicitCache.set(cacheKey, { value, expires: Date.now() + EXPLICIT_TTL_MS });
  return value;
}

export async function resolvePageAccess(roleId, employeeId, keys) {
  const explicit = await getExplicitValues(roleId, employeeId);
  const out = {};
  for (const key of keys) {
    const item = getCatalogItem(key);
    if (!item || item.type !== 'boolean') { out[key] = false; continue; }
    if (ALWAYS_ALLOWED_ROLE_IDS.includes(roleId)) { out[key] = true; continue; }
    if (explicit.emp.has(key)) { out[key] = explicit.emp.get(key); continue; }
    if (explicit.dept.has(key)) { out[key] = explicit.dept.get(key); continue; }
    out[key] = !!defaultValueForRoleId(item, roleId, await loadItemSettings(item));
  }
  return out;
}

// For a layout.js: true = render the page. A verified logged-in employee is judged by
// resolvePageAccess; an anonymous visitor passes only while require_login is off (open mode).
export async function canOpenPage(key) {
  try {
    const cookieStore = await cookies();
    const verified = getVerifiedAuthCookie(cookieStore);
    if (!verified || !verified.value) return !!(await checkAuth());
    let roleId;
    const session = readVerifiedSession(cookieStore);
    if (session) {
      roleId = session.r;
    } else {
      const employee = await getSessionEmployee();
      if (!employee) return false;
      roleId = employee.roleId;
    }
    return !!(await resolvePageAccess(roleId, verified.value, [key]))[key];
  } catch (error) {
    console.error('canOpenPage error:', error);
    return false;
  }
}
