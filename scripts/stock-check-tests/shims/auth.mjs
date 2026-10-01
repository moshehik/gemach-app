// lib/auth בבדיקה: מחובר אלא אם הבדיקה קבעה אחרת.
export async function checkAuth() { return globalThis.__AUTH_OK !== false; }
export async function checkPageAccess() { return true; }
export async function getSessionEmployee() { return null; }
export function readVerifiedSession() { return null; }
export const HEAD_MANAGEMENT_ROLES = [0, 2];
