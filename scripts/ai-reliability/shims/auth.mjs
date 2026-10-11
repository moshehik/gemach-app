export async function checkAuth() { return true; }
export async function checkPageAccess() { return true; }
export const HEAD_MANAGEMENT_ROLES = [0, 2];
// names lib/permissions.js (imported by lib/ai/aiCommon.js) takes from lib/auth.js; the harness runs as a fixed test user.
export const DEVELOPER_ONLY_ROLES = [0];
// הסשן של הבדיקה = העובד שב-globalThis.__AUTH_TOKEN (run.mjs בוחר מנהל / עובד רגיל מהמסד); lib/permissions.js (checkAiAccess) דורש עובד מאומת.
export async function getSessionEmployee() {
  const id = globalThis.__AUTH_TOKEN;
  if (!id) return null;
  const { default: prisma } = await import('./prisma.mjs');
  return prisma.employee.findUnique({ where: { id } });
}
export function readVerifiedSession() { return null; }
