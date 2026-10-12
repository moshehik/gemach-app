// Stand-in for lib/permissions.js: globalThis.__PERM = { 'page:x': true|false }; a key that is not listed is ALLOWED unless globalThis.__PERM_DEFAULT === false.
const allowed = (key) => {
  const p = globalThis.__PERM || {};
  return Object.prototype.hasOwnProperty.call(p, key) ? p[key] === true : globalThis.__PERM_DEFAULT !== false;
};
export async function canOpenPage(key) { return allowed(key); }
export async function canOpenAnyPage(keys) { return keys.some(allowed); }
