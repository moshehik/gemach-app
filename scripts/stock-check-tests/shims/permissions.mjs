// lib/permissions בבדיקה: רושם איזה מפתח נשאל, ועונה לפי מה שהבדיקה קבעה.
export async function canOpenPage(key) {
  (globalThis.__PAGE_KEYS ||= []).push(key);
  return globalThis.__PAGE_OK !== false;
}
export async function resolvePageAccess() { return {}; }
export async function checkAiAccess() { return false; }
export async function hasPermission() { return true; }
