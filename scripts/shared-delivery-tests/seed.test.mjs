// scripts/seed_shared_delivery_neve.js - התכנון הטהור (plan) וסירובי בטיחות. בלי DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const require = createRequire(import.meta.url);
const seed = require(path.join(process.env.PROJ, 'scripts', 'seed_shared_delivery_neve.js'));
const M = (o) => new Map(Object.entries(o));
const byKey = (p) => Object.fromEntries(p.actions.map((a) => [a.key, a]));

test('יעד: מחיר כללי 20 לכיוון, מצב global', () => {
  assert.equal(seed.TARGET_MODE, 'global');
  assert.equal(seed.TARGET_PRICE, '20');
});

test('בלי שורות: נוצרים mode=global, price=20 והמתג נוצר כבוי (false) - לא דלוק', () => {
  const p = seed.plan(M({ enable_deliveries: 'true' }));
  const a = byKey(p);
  assert.deepEqual([a.shared_delivery_price_mode.action, a.shared_delivery_price_mode.value], ['create', 'global']);
  assert.deepEqual([a.shared_delivery_price.action, a.shared_delivery_price.value], ['create', '20']);
  assert.deepEqual([a.shared_delivery_enabled.action, a.shared_delivery_enabled.value], ['create', 'false']);
  assert.equal(p.refusal, null);
});

test('ערך קיים שונה לא נדרס בלי --overwrite (keep), ונדרס איתו (update); זהה = none', () => {
  const ex = M({ shared_delivery_price: '15', shared_delivery_price_mode: 'by_city', shared_delivery_enabled: 'true' });
  let a = byKey(seed.plan(ex));
  assert.equal(a.shared_delivery_price.action, 'keep'); assert.equal(a.shared_delivery_price.before, '15');
  assert.equal(a.shared_delivery_price_mode.action, 'keep');
  assert.equal(a.shared_delivery_enabled.action, 'keep', 'בלי --enable המתג הקיים (true) לעולם לא משתנה');
  a = byKey(seed.plan(ex, { overwrite: true }));
  assert.equal(a.shared_delivery_price.action, 'update'); assert.equal(a.shared_delivery_price.value, '20');
  assert.equal(a.shared_delivery_price_mode.action, 'update');
  assert.equal(a.shared_delivery_enabled.action, 'keep', '--overwrite לא מדליק ולא מכבה את המתג');
  a = byKey(seed.plan(M({ shared_delivery_price: '20', shared_delivery_price_mode: 'global' })));
  assert.equal(a.shared_delivery_price.action, 'none'); assert.equal(a.shared_delivery_price_mode.action, 'none');
});

test('--enable: קובע true במפורש (גם מ-false), רק כשמשלוחים דלוקים ויש מחיר מוזל תקין', () => {
  let p = seed.plan(M({ enable_deliveries: 'true', shared_delivery_enabled: 'false' }), { enable: true });
  assert.equal(p.refusal, null);
  assert.deepEqual([byKey(p).shared_delivery_enabled.action, byKey(p).shared_delivery_enabled.value], ['update', 'true']);
  p = seed.plan(M({ enable_deliveries: 'true' }), { enable: true });
  assert.equal(byKey(p).shared_delivery_enabled.action, 'create'); assert.equal(byKey(p).shared_delivery_enabled.value, 'true');
  assert.equal(p.refusal, null, 'המחיר 20 נקבע באותה ריצה');
  assert.equal(seed.plan(M({ shared_delivery_enabled: 'true', enable_deliveries: 'true' }), { enable: true }).actions.find((a) => a.key === 'shared_delivery_enabled').action, 'none');
});

test('--enable מסרב: משלוחים כבויים / חסרים; מחיר קיים לא תקין (ריק / טקסט) בלי --overwrite', () => {
  assert.match(seed.plan(M({}), { enable: true }).refusal, /enable_deliveries/);
  assert.match(seed.plan(M({ enable_deliveries: 'false' }), { enable: true }).refusal, /enable_deliveries/);
  assert.match(seed.plan(M({ enable_deliveries: 'true', shared_delivery_price: '' }), { enable: true }).refusal, /מחיר מוזל/);
  assert.match(seed.plan(M({ enable_deliveries: 'true', shared_delivery_price: 'abc' }), { enable: true }).refusal, /מחיר מוזל/);
  assert.equal(seed.plan(M({ enable_deliveries: 'true', shared_delivery_price: '0' }), { enable: true }).refusal, null, '0 הוגדר במפורש - תקף');
  assert.equal(seed.plan(M({ enable_deliveries: 'true', shared_delivery_price: 'abc' }), { enable: true, overwrite: true }).refusal, null, 'עם --overwrite המחיר יוחלף ל-20');
});

test('CLI: בלי --org או עם --org=1 (הגמ"ח הראשי) מסרב לפני כל חיבור ל-DB', () => {
  for (const args of [[], ['--org=1'], ['--org=1', '--write'], ['--write', '--enable']]) {
    const r = spawnSync(process.execPath, ['--no-warnings', 'scripts/seed_shared_delivery_neve.js', ...args], { cwd: process.env.PROJ, encoding: 'utf8', env: { ...process.env, PROD_DATABASE_URL: '', DATABASE_URL: '', PROD_DATABASE_URL_ORG2: '', DATABASE_URL_ORG2: '' }, timeout: 60000 });
    assert.notEqual(r.status, 0, args.join(' '));
    assert.match(r.stdout + r.stderr, /SAFETY ABORT/, args.join(' '));
    assert.match(r.stdout + r.stderr, /--org=2/);
  }
});
