// Pure role constants + seniority helpers (no next/headers / prisma), split out of lib/auth.js so
// they can be unit-tested and shared by pure logic (lib/employeeCardSave.js). lib/auth.js re-exports them.

// Shared with checkPageAccess()'s allowedRoles param — kept as one constant
// so the page-guard and API-guard gates for these head-management-only
// screens can't drift apart.
export const HEAD_MANAGEMENT_ROLES = [0, 2];

// A narrower gate than HEAD_MANAGEMENT_ROLES: roleId 2 (מתכנת) only, excluding
// roleId 0 (הנהלה ראשית). Used for developer-only screens under /admin — e.g.
// /admin/site-settings (DB/system/email config) — that head management itself
// shouldn't see or edit, even though they otherwise pass the /admin layout gate.
export const DEVELOPER_ONLY_ROLES = [2];

// Seniority ladder used to stop privilege escalation through the employee-management
// endpoints: מתכנת (2) > הנהלה ראשית (0) > מנהל סניף (1) > everyone else. An actor may only
// create / edit / reset the password of an employee at or below their own rank, and may only
// assign a roleId at or below their own rank — so a branch manager can no longer mint or take
// over a programmer/head-management account (found 2026-09-20, see CLAUDE.md "Auth cookie
// forgery and privilege escalation").
const ROLE_RANK = { 2: 3, 0: 2, 1: 1 };
export function roleRank(roleId) {
  return ROLE_RANK[roleId] ?? 0;
}
export function canManageRoles(actorRoleId, ...roleIds) {
  const actor = roleRank(actorRoleId);
  return roleIds.every((r) => r === null || r === undefined || roleRank(r) <= actor);
}
