// "אורקל" של לשונית הפריטים הישנה (W3): מחלץ בזמן הבדיקה פונקציות שלמות מתוך components/orders/modern/ModernItemsManager.js
// (הקוד החי, לא העתק) ומחזיר אותן כפונקציות שאפשר להריץ ב-node עם תלויות מדומות (fetch, alert, window.custom*, onItemsChange...).
// rentalToggle.js עצמו מיובא כמו שהוא (ESM) ורץ מול fetch / window מדומים גלובליים. אם מישהו ישנה את הישן — הבדיקות יראו.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { objectLiteralAt } from './legacy.mjs';

export const MIM_PATH = path.join(process.env.PROJ, 'components/orders/modern/ModernItemsManager.js');
export const MIM_SRC = fs.readFileSync(MIM_PATH, 'utf8');
export const RENTAL_TOGGLE_PATH = path.join(process.env.PROJ, 'components/orders/modern/rentalToggle.js');

// מקור של `const NAME = [async] (...) => {...}` (פונקציית חץ עם גוף בלוק) מתוך MIM
export function mimArrowSource(name) {
  const i = MIM_SRC.indexOf(`const ${name} = `);
  if (i < 0) throw new Error(`MIM: ${name} not found`);
  const start = i + `const ${name} = `.length;
  const arrow = MIM_SRC.indexOf('=>', start);
  const after = MIM_SRC.slice(arrow + 2).match(/^\s*/)[0].length + arrow + 2;
  if (MIM_SRC[after] !== '{') { const m = /;\r?\n/.exec(MIM_SRC.slice(after)); return MIM_SRC.slice(start, after + m.index); } // חץ עם ביטוי (בלי בלוק)
  const block = objectLiteralAt(MIM_SRC, arrow);
  const braceAt = MIM_SRC.indexOf('{', arrow);
  return MIM_SRC.slice(start, braceAt) + block;
}

// מריץ פונקציה מהישן בתוך scope מדומה: scope = {שם: ערך}
export function mimFunction(name, scope) {
  const names = Object.keys(scope);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `return (${mimArrowSource(name)});`)(...names.map((k) => scope[k]));
}

// קבועים ופונקציות ברמת הקובץ (מחוץ לרכיב) — dedupeAuditLogs וחבריו
export function mimTopLevel() {
  const from = MIM_SRC.indexOf('const AUDIT_DUP_WINDOW_MS');
  const to = MIM_SRC.indexOf('/**', from);
  // eslint-disable-next-line no-new-func
  return new Function(`${MIM_SRC.slice(from, to)}; return { dedupeAuditLogs, AUDIT_DUP_WINDOW_MS };`)();
}

let rentalToggleMod = null;
export async function legacyRentalToggle() {
  if (!rentalToggleMod) rentalToggleMod = await import(pathToFileURL(RENTAL_TOGGLE_PATH).href);
  return rentalToggleMod;
}

// שרת מדומה משותף: script(url, opts, n) → {status, body}; כל קריאה נרשמת
export function fakeServer(script) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body !== undefined ? JSON.parse(opts.body) : undefined, rawBody: opts.body });
    const r = (script && script(String(url), opts, calls.length)) || {};
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { calls, fetch: fetchImpl };
}

// מריץ fn כשה-globals של הדפדפן (fetch / window / alert) מוחלפים זמנית (rentalToggle.js ו-mocAuth.js קוראים להם ישירות)
export async function withBrowserGlobals({ fetch: fetchImpl, window: win, alert: alertImpl }, fn) {
  const saved = { fetch: globalThis.fetch, window: globalThis.window, alert: globalThis.alert };
  globalThis.fetch = fetchImpl;
  globalThis.window = win;
  globalThis.alert = alertImpl;
  try { return await fn(); } finally {
    globalThis.fetch = saved.fetch;
    if (saved.window === undefined) delete globalThis.window; else globalThis.window = saved.window;
    if (saved.alert === undefined) delete globalThis.alert; else globalThis.alert = saved.alert;
  }
}
