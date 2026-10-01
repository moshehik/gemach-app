// lib/permissions בבדיקה: רושם איזה מפתח נשאל, ועונה לפי מה שהבדיקה קבעה.
// __PAGE_OK: ברירת מחדל לכל מפתח; __PAGE_ALLOW: { 'page:x': bool } לפי מפתח (למשל page:dresses_catalog סגור).
export async function canOpenPage(key) {
  (globalThis.__PAGE_KEYS ||= []).push(key);
  const per = globalThis.__PAGE_ALLOW;
  if (per && Object.prototype.hasOwnProperty.call(per, key)) return !!per[key];
  return globalThis.__PAGE_OK !== false;
}
export async function resolvePageAccess() { return {}; }
export async function checkAiAccess() { return false; }
export async function hasPermission() { return true; }
