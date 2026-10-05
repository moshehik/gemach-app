export async function checkAuth() { return true; }
export async function checkPageAccess() { return true; }
export const HEAD_MANAGEMENT_ROLES = [0, 2];
// names lib/permissions.js (imported by lib/ai/aiCommon.js) takes from lib/auth.js; the harness runs as a fixed test user.
export const DEVELOPER_ONLY_ROLES = [0];
export async function getSessionEmployee() { return null; }
export function readVerifiedSession() { return null; }
