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
    assert.match(src, /fetchSharedJson\('\/api\/settings', \{ ttl: TTL\.STATIC \}\)/);
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

console.log(`\n${passed} passed, ${failed} failed`);
