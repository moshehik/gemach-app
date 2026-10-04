// בדיקות הצד של הדפדפן ל"חיפושים שמורים" (app/components/search/savedSearches.js): מטמון, הטבלה חסרה (unavailable נשאר עד רענון),
// יצירה / מחיקה אופטימית עם החזרה אחורה, תקרת 50 (409), רישום חיפוש להיסטוריה (כפילות, קידומת, טבלה חסרה). fetch מדומה, בלי DB ובלי DOM.
// הרצה: node scripts/test_saved_searches_client.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hooks = `
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = ${JSON.stringify(root)};
const withExt = (p) => { for (const c of [p, p + '.js']) { try { if (fs.statSync(c).isFile()) return c; } catch {} } return null; };
export async function resolve(spec, ctx, next) {
  let file = null;
  if (spec.startsWith('@/')) file = withExt(path.join(ROOT, spec.slice(2)));
  else if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL && ctx.parentURL.startsWith('file:')) file = withExt(path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec));
  if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  return next(spec, ctx);
}
`;
register('data:text/javascript;base64,' + Buffer.from(hooks).toString('base64'), pathToFileURL(root + path.sep));

const calls = [];
let handler = () => ({ status: 200, body: {} });
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
  const r = await handler(String(url), opts);
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => { if (r.bad) throw new SyntaxError('x'); return r.body; } };
};
const S = await import('../app/components/search/savedSearches.js');
const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
async function t(name, fn) {
  try { S.resetSavedSearchesStore(); calls.length = 0; handler = () => ({ status: 200, body: {} }); await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.stack || e.message); process.exitCode = 1; }
}
const row = (id, query = 'q' + id) => ({ id, label: 'l' + id, query, domain: null });

console.log('טעינה');
await t('loadSavedSearches: GET אחד; קריאה שנייה בתוך 60 שניות מהמטמון; force טוען שוב; קריאות במקביל משתפות בקשה אחת', async () => {
  handler = () => ({ status: 200, body: { savedSearches: [row('a')] } });
  await Promise.all([S.loadSavedSearches(), S.loadSavedSearches()]);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/saved-searches');
  await S.loadSavedSearches(); assert.equal(calls.length, 1, 'מטמון');
  await S.loadSavedSearches(true); assert.equal(calls.length, 2);
});
await t('טבלה חסרה (unavailable): המצב נשאר עד רענון, בלי ניסיונות חוזרים; אפילו force לא שולח', async () => {
  handler = () => ({ status: 200, body: { savedSearches: [], unavailable: true } });
  await S.loadSavedSearches(); assert.equal(calls.length, 1);
  await S.loadSavedSearches(true); await S.loadSavedSearches(); assert.equal(calls.length, 1);
});
await t('כשל שרת / תשובה לא תקינה / 401 = error ואפשר לנסות שוב (error לא נשמר במטמון)', async () => {
  handler = () => ({ status: 500, body: {} }); await S.loadSavedSearches(); assert.equal(calls.length, 1);
  handler = () => ({ status: 200, body: { savedSearches: [row('a')] } }); await S.loadSavedSearches(); assert.equal(calls.length, 2);
  S.resetSavedSearchesStore(); calls.length = 0;
  handler = () => ({ status: 401, body: { error: 'Unauthorized' } }); await S.loadSavedSearches(); assert.equal(calls.length, 1);
  handler = () => ({ status: 200, body: { savedSearches: [row('a')] } }); await S.loadSavedSearches(); assert.equal(calls.length, 2);
});

console.log('יצירה ומחיקה');
await t('createSavedSearch: POST עם label / query / domain; הפריט נכנס ראשון לרשימה (בלי GET נוסף)', async () => {
  handler = (u, o) => (o.method === 'POST' ? { status: 200, body: { success: true, savedSearch: row('new', 'חדש') } } : { status: 200, body: { savedSearches: [row('a')] } });
  await S.loadSavedSearches();
  const r = await S.createSavedSearch({ label: 'חדש', query: 'חדש', domain: null });
  assert.equal(r.ok, true); assert.equal(r.item.id, 'new');
  const post = calls.find((c) => c.method === 'POST'); assert.deepEqual(post.body, { label: 'חדש', query: 'חדש', domain: null });
  assert.equal(calls.filter((c) => c.method === 'GET').length, 1);
});
await t('409 = limit (לא נוסף), 503 + unavailable = unavailable (ונשאר), אחר / רשת = error', async () => {
  handler = () => ({ status: 409, body: { error: 'limit', limit: 50 } });
  assert.deepEqual(await S.createSavedSearch({ label: 'a', query: 'a' }), { ok: false, reason: 'limit' });
  handler = () => ({ status: 500, body: {} });
  assert.deepEqual(await S.createSavedSearch({ label: 'a', query: 'a' }), { ok: false, reason: 'error' });
  handler = () => { throw new Error('offline'); };
  assert.deepEqual(await S.createSavedSearch({ label: 'a', query: 'a' }), { ok: false, reason: 'error' });
  handler = () => ({ status: 503, body: { unavailable: true } });
  assert.deepEqual(await S.createSavedSearch({ label: 'a', query: 'a' }), { ok: false, reason: 'unavailable' });
  calls.length = 0; await S.loadSavedSearches(true); assert.equal(calls.length, 0, 'אחרי unavailable אין טעינה');
});
await t('deleteSavedSearch: DELETE ?id= (מקודד); 404 נחשב הצלחה; כשל = ok:false והרשימה נטענת מחדש', async () => {
  handler = (u, o) => (o.method === 'DELETE' ? { status: 200, body: { success: true } } : { status: 200, body: { savedSearches: [row('a'), row('b/c')] } });
  await S.loadSavedSearches();
  assert.deepEqual(await S.deleteSavedSearch('b/c'), { ok: true });
  assert.equal(calls.find((c) => c.method === 'DELETE').url, '/api/saved-searches?id=b%2Fc');
  handler = () => ({ status: 404, body: {} }); assert.deepEqual(await S.deleteSavedSearch('a'), { ok: true });
  handler = (u, o) => (o.method === 'DELETE' ? { status: 500, body: {} } : { status: 200, body: { savedSearches: [row('x')] } });
  S.resetSavedSearchesStore(); calls.length = 0;
  assert.deepEqual(await S.deleteSavedSearch('zzz'), { ok: false });
  await wait(); assert.ok(calls.some((c) => c.method === 'GET'), 'טעינה מחדש אחרי כשל');
});

console.log('החיפוש האחרון והיסטוריה');
await t('rememberSearch: POST להיסטוריה פעם אחת לאותו טקסט; קידומת / ריק לא נרשמים; טבלה חסרה = מפסיקים לשלוח', async () => {
  S.rememberSearch('  כהן ירושלים '); await wait();
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].body, { query: 'כהן ירושלים' }); assert.equal(calls[0].url, '/api/search-history');
  S.rememberSearch('כהן ירושלים'); S.rememberSearch('#x'); S.rememberSearch('   '); S.rememberSearch(null); await wait();
  assert.equal(calls.length, 1);
  handler = () => ({ status: 200, body: { success: false, unavailable: true } });
  S.rememberSearch('אחר'); await wait(15);
  S.rememberSearch('עוד אחד'); await wait(); assert.equal(calls.length, 2, 'אחרי unavailable אין עוד בקשות היסטוריה');
});
await t('כשל רשת ברישום ההיסטוריה לא זורק', async () => {
  handler = () => { throw new Error('offline'); };
  S.rememberSearch('משהו'); await wait(15);
});

console.log('מבנה (סטטי)');
await t('"אל תשאל שוב" רק בזיכרון המודול (PFX-10); ההוק לא קורא fetch ישירות ולא טוען ב-useEffect משלו; בלי window.alert / confirm', () => {
  const src = readFileSync(new URL('../app/components/search/savedSearches.js', import.meta.url), 'utf8');
  assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(src), 'בזיכרון המודול בלבד: עד רענון');
  assert.ok(/let skipDeleteConfirm = false/.test(src));
  const hook = src.slice(src.indexOf('export function useSavedSearches'));
  assert.ok(!/fetch\(/.test(hook), 'ההוק לא קורא fetch ישירות');
  assert.ok(!/load\(\);?\s*\}, \[\]\)/.test(hook), 'אין טעינה בעליית הרכיב');
  assert.ok(!/window\.(alert|confirm)|\balert\(|\bconfirm\(/.test(src.replace(/setConfirm|confirmDelete|const confirm|confirm\b[,)=;.:?]/g, '')));
});

console.log(String.fromCharCode(10) + passed + ' passed');
if (process.exitCode) process.exit(1);
