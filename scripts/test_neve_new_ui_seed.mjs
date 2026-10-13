// בדיקת בטיחות ל-scripts/seed_neve_new_ui_default.js (נווה יעקב: ממשק חדש כברירת מחדל). בלי DB: רק סירובים שקורים לפני כל חיבור.
// הרצה: node scripts/test_neve_new_ui_seed.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_SCREEN_REGISTRY } from '../lib/uiVariantScreens.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'seed_neve_new_ui_default.js');
let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const run = (args, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], {
  env: { PATH: process.env.PATH, PROD_DATABASE_URL: 'postgresql://u:p@ep-main-00000000.c-1.aws.neon.tech/neondb', ...env }, encoding: 'utf8', timeout: 30000,
});
const NEVE = { PROD_DATABASE_URL_ORG2: 'postgresql://u:p@ep-neve-00000000.c-5.aws.neon.tech/neondb' };

t('בלי --org=2 הסקריפט מסרב (גם בלי דגלים בכלל)', () => {
  const r = run([], NEVE);
  assert.notEqual(r.status, 0); assert.match(r.stderr, /Neve Yaakov only/);
});
t('--org=1 (הגמ"ח הראשי) נדחה לפני חיבור', () => {
  const r = run(['--org=1', '--write'], NEVE);
  assert.notEqual(r.status, 0); assert.match(r.stderr, /Neve Yaakov only/);
});
t('org2 שה-host שלו זהה ל-org1 נדחה (SAFETY ABORT)', () => {
  const same = 'postgresql://u:p@ep-main-00000000.c-1.aws.neon.tech/neondb';
  const r = run(['--org=2'], { PROD_DATABASE_URL_ORG2: same });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /SAFETY ABORT/);
});
t('--write בלי --confirm-host (או עם אחר) נדחה לפני חיבור', () => {
  for (const args of [['--org=2', '--write'], ['--org=2', '--write', '--confirm-host', 'ep-other-99999999']]) {
    const r = run(args, NEVE);
    assert.notEqual(r.status, 0, args.join(' ')); assert.match(r.stderr, /--confirm-host must equal/);
  }
});
t('--clear-user-legacy-overrides בלי --write נדחה', () => {
  const r = run(['--org=2', '--clear-user-legacy-overrides'], NEVE);
  assert.notEqual(r.status, 0); assert.match(r.stderr, /requires --write/);
});
t('הסקריפט גוזר את המסכים מהרשומה (לא רשימה קשיחה) ולא נוגע ב-login_page_new', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  assert.match(src, /UI_SCREEN_REGISTRY\.filter\(\(s\) => s\.legacyExists && s\.newExists\)/);
  assert.ok(!/login_page_new/.test(src.replace(/\/\*[\s\S]*?\*\//, '')), 'login_page_new רק בהערת הכותרת');
  assert.ok(UI_SCREEN_REGISTRY.filter((s) => s.legacyExists && s.newExists).length >= 19);
});

console.log(`\n${passed} passed${process.exitCode ? ' - WITH FAILURES' : ''}`);
