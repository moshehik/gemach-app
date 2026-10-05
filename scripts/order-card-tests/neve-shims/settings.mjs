export async function getCachedSetting(key) {
  const v = globalThis.__neveFake.settings[key];
  return v === undefined ? null : { key, value: v };
}
export async function getAllCachedSettings() {
  return Object.entries(globalThis.__neveFake.settings).map(([key, value]) => ({ key, value }));
}
