// בדיקות להפחתת עומס ה-CPU (5.10.2026, docs/cpu-reduction-2026-10-05.md). לא נוגעת ב-DB ולא בדפדפן.
// הרצה: node scripts/test_cpu_reduction.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let passed = 0;
let failed = 0;
async function t(name, fn) {
  try { await fn(); passed += 1; console.log(`  ok   - ${name}`); }
  catch (e) { failed += 1; process.exitCode = 1; console.log(`  FAIL - ${name}\n         ${e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n         ') : e}`); }
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/[^'"`\n]*$/gm, '');

console.log('1. קריאות GET /api/settings גולמיות עברו למטמון המשותף');
const MIGRATED = [
  'app/deliveries/page.js',
  'app/messages/page.js',
  'app/components/employee-card/EmployeeCardA5.js',
  'app/employees/[id]/LegacyEmployeeCardPage.js',
  'app/components/profile/ProfilePage.js',
  'app/dashboard/pricelist/page.js',
  'app/components/AIFloatingWidget.js',
  'app/components/LegacyErrorReportButton.js',
  'app/components/errorReport/ErrorReportWindow.js',
  'app/rentals/page.js',
];
for (const f of MIGRATED) {
  await t(`${f}: fetchSharedJson('/api/settings', { ttl: TTL.STATIC }) ובלי fetch גולמי`, () => {
    const src = stripComments(read(f));
    assert.match(src, /fetchSharedJson\('\/api\/settings', \{ ttl: TTL\.STATIC(, persist: true)? \}\)/);
    assert.match(src, /import \{[^}]*fetchSharedJson[^}]*TTL[^}]*\} from '(@\/lib|\.\.\/\.\.\/lib|\.\.\/\.\.\/\.\.\/lib)\/apiCache'/);
    assert.doesNotMatch(src, /fetch\('\/api\/settings'/);
  });
}
// בכוונה נשארו גולמיים: דפי הדפסה (no-store), קיוסק ציבורי, כניסה/שעון נוכחות, מסכי עריכת הגדרות, והעתקים ישנים נעולים (blob)
const INTENTIONALLY_RAW = [
  'app/print/order/page.js', 'app/print/customer/page.js', 'app/print/alterations/page.js', 'app/print/delivery-courier/page.js', 'app/print/order-history/page.js',
  'app/dashboard/dresses/[id]/print/page.js', 'app/customer-interface/page.js',
  'app/components/LoginScreen.js', 'app/components/login/LoginNew.js', 'app/components/login/PunchClockNew.js', 'app/punch-clock/PunchClockLegacy.js',
  'app/admin/settings/SettingsClient.js', 'app/components/SettingQuickPanel.js', 'app/components/settings-sim/SettingsSimPage.js',
  'app/profile/LegacyProfilePage.js', // נעול ע"י test_page_variant_switch.mjs (השוואת blob)
];
await t('הקבצים שנשארו גולמיים בכוונה עדיין קיימים (הרשימה לא התיישנה)', () => {
  for (const f of INTENTIONALLY_RAW) assert.ok(read(f).length > 0, f);
});

console.log('3. קריאות האתחול נשמרות ב-sessionStorage - רק במקומות שבחרנו (opt-in), רק ל-4 הכתובות');
const PERSIST_SITES = [
  ['app/components/AIFloatingWidget.js', "fetchSharedJson('/api/settings', { ttl: TTL.STATIC, persist: true })"],
  ['app/components/LabelsContext.js', "fetchSharedJson('/api/settings/labels', { ttl: TTL.STATIC, persist: true })"],
  ['app/components/UserMenu.js', "fetchSharedJson('/api/me', { ttl: TTL.STATIC, persist: true })"],
  ['app/components/menu/MenuA5Shell.js', "fetchSharedJson('/api/me', { ttl: TTL.STATIC, persist: true })"],
  ['app/components/PopupProvider.js', "fetchSharedJson('/api/me', { ttl: TTL.STATIC, persist: true })"],
];
for (const [f, snippet] of PERSIST_SITES) await t(`${f}: persist:true על קריאת האתחול`, () => assert.ok(stripComments(read(f)).includes(snippet)));
await t('persist:true מופיע רק באתרי האתחול שנבחרו (אף קובץ אחר בקוד האפליקציה לא מפעיל אותו)', async () => {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync('git', ['grep', '-l', 'persist: true', '--', 'app', 'components', 'lib', 'hooks'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  const allowed = [...PERSIST_SITES.map((s) => s[0]), 'lib/apiCache.js'].sort();
  assert.deepEqual(out.filter((f) => !allowed.includes(f)), []);
});
await t('app/layout.js מרנדר data-gm-uid רק למחובר, מהעוגייה המאומתת', () => {
  assert.match(read('app/layout.js'), /data-gm-uid=\{isAuthenticated \? String\(authToken\.value\) : undefined\}/);
});
await t("DesignPrefsSync: קורא מהאחסון (60 שנ') ושומר רק תשובה תקינה; הכותרת x-design-prefs-cookie עדיין נקראת בקריאת רשת", () => {
  const src = stripComments(read('app/components/DesignPrefsSync.js'));
  assert.match(src, /readPersistedFresh\('\/api\/me\/design-prefs'\)/);
  assert.match(src, /if \(d && d\.success && d\.employeeId\) writePersisted\('\/api\/me\/design-prefs', d\)/);
  assert.match(src, /res\.headers\.get\('x-design-prefs-cookie'\) === 'rebuilt'/);
});

console.log('5. רשימת דיווחי התקלות (לא ה-light) במטמון 60 שנ\'');
await t('ErrorReportWindow קורא את הרשימה דרך fetchFreshJson (60 שנ\'), בלי GET גולמי; הבדיקה הקלה נשארה fetch גולמי ב-ErrorReportButton', () => {
  const win = stripComments(read('app/components/errorReport/ErrorReportWindow.js'));
  assert.match(win, /fetchFreshJson\('\/api\/error-report', \{ maxAge: REPORTS_LIST_MAX_AGE_MS \}\)/);
  assert.match(win, /const REPORTS_LIST_MAX_AGE_MS = 60 \* 1000;/);
  assert.doesNotMatch(win, /fetch\('\/api\/error-report'\)/);
  const btn = stripComments(read('app/components/ErrorReportButton.js'));
  assert.match(btn, /fetch\('\/api\/error-report\?light=1'\)/);
  assert.match(btn, /invalidate\('\/api\/error-report'\)/);
});

console.log(`\n${passed} passed, ${failed} failed`);
