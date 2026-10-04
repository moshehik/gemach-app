// בדיקת יחידה לדגלי "ישן / A5" (lib/uiVariant.js), לסניטייזר של העדפות העיצוב
// (lib/designPrefsSchema.js) ולעוזרי הסקריפט scripts/set-ui-variant.js. לא נוגעת ב-DB.
// הרצה: node scripts/test_ui_variant.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  UI_SCREENS, UI_VARIANT_SETTING_KEYS, isForcedLegacyPath, normalizeUiVariant,
  resolveUiVariant, resolveUiVariants, sanitizeUiVariants,
} from '../lib/uiVariant.js';
import { mergeDesignPrefs, parseStoredDesignPrefs, sanitizeDesignPrefs, splitServerPrefs } from '../lib/designPrefsSchema.js';

const require = createRequire(import.meta.url);
const cli = require('./set-ui-variant.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
async function ta(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const rows = (obj) => Object.entries(obj).map(([key, value]) => ({ key, value }));

console.log('resolution order');
t('בלי כלום: כל המסכים legacy', () => {
  // 4.10.2026: נוספו profile / admin_hub / attendance / error_report (lib/uiVariantScreens.js) + board (5.10.2026) - בלי roleId כולם legacy.
  assert.deepEqual(resolveUiVariants({}), { shell: 'legacy', home: 'legacy', order_card: 'legacy', customer_card: 'legacy', profile: 'legacy', admin_hub: 'legacy', attendance: 'legacy', error_report: 'legacy', board: 'legacy' });
  assert.deepEqual(resolveUiVariants(), resolveUiVariants({}));
});
t('הגדרת ארגון (מערך שורות) מדליקה רק את המסך שלה', () => {
  const settings = rows({ ui_variant_order_card: 'a5' });
  assert.equal(resolveUiVariant('order_card', { settings }), 'a5');
  assert.equal(resolveUiVariant('home', { settings }), 'legacy');
});
t('הגדרת ארגון כמפה { key: value }', () => {
  assert.equal(resolveUiVariant('home', { settings: { ui_variant_home: 'a5' } }), 'a5');
});
t('עקיפה אישית גוברת על הארגון (בשני הכיוונים)', () => {
  assert.equal(resolveUiVariant('home', { settings: rows({ ui_variant_home: 'legacy' }), userVariants: { home: 'a5' } }), 'a5');
  assert.equal(resolveUiVariant('home', { settings: rows({ ui_variant_home: 'a5' }), userVariants: { home: 'legacy' } }), 'legacy');
});
t('עקיפה אישית של מסך אחד לא משפיעה על מסך אחר', () => {
  const r = resolveUiVariants({ settings: rows({ ui_variant_home: 'a5' }), userVariants: { customer_card: 'a5' } });
  assert.deepEqual(r, { shell: 'legacy', home: 'a5', order_card: 'legacy', customer_card: 'a5', profile: 'legacy', admin_hub: 'legacy', attendance: 'legacy', error_report: 'legacy', board: 'legacy' });
});
t('מפתחות ההגדרה בדיוק כפי שסוכם', () => {
  assert.deepEqual(UI_VARIANT_SETTING_KEYS, {
    shell: 'ui_variant_shell', home: 'ui_variant_home', order_card: 'ui_variant_order_card', customer_card: 'ui_variant_customer_card',
    // 4.10.2026 (lib/uiVariantScreens.js):
    profile: 'ui_variant_profile', admin_hub: 'ui_variant_admin_hub', attendance: 'ui_variant_attendance', error_report: 'ui_variant_error_report',
    board: 'ui_variant_board', // 5.10.2026 (הלוח החודשי החדש, F13)
  });
});

console.log('invalid values');
t('ערך ארגון לא תקין / ריק / לא מחרוזת => legacy', () => {
  for (const bad of ['', '  ', 'A6', 'true', 'a5x', null, undefined, 5, {}, ['a5']]) {
    assert.equal(resolveUiVariant('home', { settings: rows({ ui_variant_home: bad }) }), 'legacy', String(bad));
  }
});
t('ערך ארגון עם רווחים / אותיות גדולות מתקבל (הוקלד ידנית)', () => {
  assert.equal(resolveUiVariant('home', { settings: rows({ ui_variant_home: ' A5 ' }) }), 'a5');
  assert.equal(normalizeUiVariant('LEGACY'), 'legacy');
});
t('עקיפה אישית לא תקינה = אין עקיפה (נופלים לארגון)', () => {
  assert.equal(resolveUiVariant('home', { settings: rows({ ui_variant_home: 'a5' }), userVariants: { home: 'nope' } }), 'a5');
  assert.equal(resolveUiVariant('home', { settings: rows({ ui_variant_home: 'a5' }), userVariants: 'a5' }), 'a5');
  assert.equal(resolveUiVariant('home', { userVariants: { home: 'nope' } }), 'legacy');
});
t('מסך לא מוכר => legacy, גם אם יש הגדרה', () => {
  for (const bad of ['orders', '', null, undefined, 'SHELL', 'constructor']) {
    assert.equal(resolveUiVariant(bad, { settings: { ui_variant_orders: 'a5' }, userVariants: { [bad]: 'a5' } }), 'legacy', String(bad));
  }
});
t('settings/ctx שבורים לא זורקים', () => {
  assert.equal(resolveUiVariant('home', { settings: 'x' }), 'legacy');
  assert.equal(resolveUiVariant('home', null), 'legacy');
  assert.equal(resolveUiVariant('home', { settings: [null, 5, { key: 'ui_variant_home' }] }), 'legacy');
});

console.log('kiosk / punch clock / print => shell is always legacy');
const allA5 = { settings: rows({ ui_variant_shell: 'a5', ui_variant_home: 'a5' }), userVariants: { shell: 'a5' } };
t('הנתיבים האסורים', () => {
  for (const p of [
    '/customer-interface', '/customer-interface/', '/customer-interface/models/12', '/punch-clock', '/punch-clock/x',
    '/print/order', '/print/alterations', '/print/delivery-bag', '/print/delivery-courier', '/print',
    '/dashboard/dresses/abc-123/print', '/dashboard/dresses/abc-123/print/', '/print/order?id=5',
  ]) {
    assert.equal(isForcedLegacyPath(p), true, p);
    assert.equal(resolveUiVariant('shell', { ...allA5, pathname: p }), 'legacy', p);
  }
});
t('מסכים אחרים לא מושפעים מנתיב הקיוסק/הדפסה (רק shell נכפה)', () => {
  assert.equal(resolveUiVariant('home', { ...allA5, pathname: '/print/order' }), 'a5');
});
t('נתיבים רגילים לא נחסמים (גם דומים בשם)', () => {
  for (const p of ['/', '/orders', '/orders/52103', '/customers/abc', '/board', '/admin/site',
    '/customer-interfaces', '/printing', '/blueprint', '/punch-clock-report', '/dashboard/dresses/5', '', undefined, null, 5]) {
    assert.equal(isForcedLegacyPath(p), false, String(p));
  }
  assert.equal(resolveUiVariant('shell', { ...allA5, pathname: '/orders' }), 'a5');
  assert.equal(resolveUiVariant('shell', { ...allA5 }), 'a5');
});

console.log('design prefs sanitizer (per-user override storage)');
t('מסכים וערכים תקינים נשמרים, כל השאר נזרק', () => {
  assert.deepEqual(sanitizeUiVariants({ shell: 'a5', home: 'legacy', bogus: 'a5', order_card: 'zzz', customer_card: 5 }), { shell: 'a5', home: 'legacy' });
  assert.equal(sanitizeUiVariants({}), undefined);
  assert.equal(sanitizeUiVariants({ shell: 'nope' }), undefined);
  for (const bad of [null, undefined, 'a5', 5, ['a5']]) assert.equal(sanitizeUiVariants(bad), undefined);
});
t('sanitizeDesignPrefs: uiVariants נכנס מסונן; מפתחות לא מוכרים עדיין נזרקים; שאר ההעדפות ללא שינוי', () => {
  const out = sanitizeDesignPrefs({ palette: 'wine', mode: 'dark', uiVariants: { shell: 'a5', x: 'a5' }, evil: 1, __proto__: { z: 1 } });
  assert.deepEqual(out, { palette: 'wine', mode: 'dark', uiVariants: { shell: 'a5' } });
  assert.deepEqual(sanitizeDesignPrefs({ palette: 'wine' }), { palette: 'wine' }); // בלי uiVariants: בלי מפתח
  assert.deepEqual(sanitizeDesignPrefs({ uiVariants: {} }), {});
  assert.deepEqual(sanitizeDesignPrefs({ uiVariants: { shell: 'nope' } }), {});
});
t('parse/merge שומרים uiVariants קיים כשעדכון בא בלי המפתח', () => {
  const stored = JSON.stringify({ v: 1, palette: 'wine', uiVariants: { shell: 'a5' } });
  const existing = parseStoredDesignPrefs(stored);
  assert.deepEqual(existing.uiVariants, { shell: 'a5' });
  assert.deepEqual(mergeDesignPrefs(existing, { mode: 'dark' }), { v: 1, palette: 'wine', uiVariants: { shell: 'a5' }, mode: 'dark' });
  assert.equal(parseStoredDesignPrefs('standard'), null); // ערך legacy = אין העדפות
});

console.log('scripts/set-ui-variant.js helpers');
const base = ['--screen', 'shell', '--value', 'a5', '--scope', 'org', '--confirm-host', 'ep-cool'];
t('parseArgs: קלט תקין (גם --flag=value)', () => {
  assert.deepEqual(cli.parseArgs(base), { screen: 'shell', value: 'a5', scope: 'org', 'confirm-host': 'ep-cool' });
  const u = cli.parseArgs(['--screen=home', '--value=legacy', '--scope=user', '--employee=123', '--confirm-host=ep-cool', '--dry-run']);
  assert.equal(u.employee, '123');
  assert.equal(u['dry-run'], true);
  assert.equal(cli.parseArgs([...base, '--i-know-this-is-prod'])['i-know-this-is-prod'], true);
  assert.equal(cli.parseArgs([...base, '--not-prod'])['not-prod'], true);
  assert.equal(cli.parseArgs(['--screen', 'home', '--clear', '--scope', 'user', '--employee', 'abc', '--confirm-host', 'ep-cool']).clear, true);
});
t('parseArgs: קלט שגוי נדחה', () => {
  const bad = [
    ['--screen', 'orders', ...base.slice(2)],
    ['--screen', 'shell', '--value', 'A5', '--scope', 'org', '--confirm-host', 'ep-cool'],
    ['--screen', 'shell', '--value', 'a5', '--scope', 'global', '--confirm-host', 'ep-cool'],
    ['--screen', 'shell', '--value', 'a5', '--scope', 'user', '--confirm-host', 'ep-cool'], // חסר --employee
    [...base, '--employee', '5'], // --employee עם scope=org
    ['--screen', 'shell', '--value', 'a5', '--scope', 'org'], // חסר --confirm-host
    [...base, '--nope'],
    [...base, 'stray'],
    ['--screen', 'shell', '--clear', '--scope', 'org', '--confirm-host', 'ep-cool'],
    ['--screen', 'shell', '--clear', '--value', 'a5', '--scope', 'user', '--employee', '5', '--confirm-host', 'ep-cool'],
    ['--screen', 'shell', '--value', 'a5', '--scope', 'user', '--employee', "5'; drop", '--confirm-host', 'ep-cool'],
    [...base, '--not-prod', '--i-know-this-is-prod'], // סותרים זה את זה
  ];
  for (const argv of bad) assert.throws(() => cli.parseArgs(argv), Error, argv.join(' '));
});
const PROD_HOST = 'ep-prod-wind-111111-pooler.c-2.eu-central-1.aws.neon.tech';
const TEST_HOST = 'ep-test-moon-222222-pooler.c-2.eu-central-1.aws.neon.tech';
const ORG2_PROD_HOST = 'ep-org2-star-333333.c-2.eu-central-1.aws.neon.tech';
const knownEnv = {
  PROD_DATABASE_URL: `postgresql://u:SECRETPASS@${PROD_HOST}/db`,
  TEST_DATABASE_URL: `postgresql://u:SECRETPASS@${TEST_HOST}/db`,
  PROD_DATABASE_URL_ORG2: `postgresql://u:SECRETPASS@${ORG2_PROD_HOST}/db`,
  DATABASE_URL_ORG2: 'not a url', // מדולג
};
const known = cli.collectKnownDbs(knownEnv);
t('collectKnownDbs: מזהה PROD/TEST/org2, מדלג על URL שבור, בלי סיסמאות', () => {
  assert.deepEqual(known.map((k) => [k.env, k.prod, k.endpoint]), [
    ['PROD_DATABASE_URL', true, 'ep-prod-wind-111111'],
    ['PROD_DATABASE_URL_ORG2', true, 'ep-org2-star-333333'],
    ['TEST_DATABASE_URL', false, 'ep-test-moon-222222'],
  ]);
  assert.ok(!JSON.stringify(known).includes('SECRETPASS'));
  assert.deepEqual(cli.collectKnownDbs({}), []);
});
t('checkHost (R1): התאמה מדויקת ל-host המלא או ל-endpoint id בלבד', () => {
  assert.equal(cli.checkHost(TEST_HOST, TEST_HOST, known).ok, true);
  assert.equal(cli.checkHost(TEST_HOST, 'EP-TEST-MOON-222222-POOLER', known).ok, true); // לא רגיש לאותיות
  assert.equal(cli.checkHost(TEST_HOST, 'ep-test-moon-222222', known).ok, true); // בלי -pooler
  assert.equal(cli.checkHost(TEST_HOST, `  ${TEST_HOST}  `, known).ok, true);
  assert.equal(cli.checkHost(TEST_HOST, 'ep-test-moon-222222', known).label, 'TEST');
  assert.equal(cli.checkHost(TEST_HOST, 'ep-test-moon-222222', known).prod, false);
});
t('checkHost (fail-closed): DB לא מוכר = ייצור — נדחה בלי --i-know-this-is-prod, גם עם סביבה מלאה', () => {
  const r = cli.checkHost('ep-dev-x-999999.neon.tech', 'ep-dev-x-999999', known);
  assert.equal(r.ok, false); assert.equal(r.prod, true); assert.match(r.reason, /--i-know-this-is-prod/); assert.match(r.reason, /fail-closed/);
  const allowed = cli.checkHost('ep-dev-x-999999.neon.tech', 'ep-dev-x-999999', known, { allowProd: true });
  assert.equal(allowed.ok, true); assert.equal(allowed.prod, true); assert.equal(allowed.label, null);
});
t('checkHost (fail-closed): תרחיש הסקירה — worktree נקי, רק DATABASE_URL של ייצור, בלי PROD_DATABASE_URL*', () => {
  // collectKnownDbs לא מכיר את DATABASE_URL עצמו: העובדה שהוא מוגדר לא אומרת כלום על זהותו.
  const cleanEnv = { DATABASE_URL: `postgresql://u:SECRETPASS@${PROD_HOST}/db` };
  const none = cli.collectKnownDbs(cleanEnv);
  assert.deepEqual(none, []);
  for (const conf of [PROD_HOST, 'ep-prod-wind-111111', 'ep-prod-wind-111111-pooler']) {
    const denied = cli.checkHost(PROD_HOST, conf, none);
    assert.equal(denied.ok, false, conf); assert.equal(denied.prod, true, conf); assert.match(denied.reason, /PRODUCTION/);
    // --dry-run לא עוקף: הבדיקה רצה לפני ה-dry-run ב-main (אין פרמטר dry ב-checkHost)
    const allowed = cli.checkHost(PROD_HOST, conf, none, { allowProd: true });
    assert.equal(allowed.ok, true, conf); assert.equal(allowed.prod, true, conf);
  }
  // גם ה-host של org2 בלי DATABASE_URL_ORG2 בסביבה — ייצור
  assert.equal(cli.checkHost(ORG2_PROD_HOST, 'ep-org2-star-333333', []).ok, false);
  // --not-prod לא עוזר ל-host של Neon
  const np = cli.checkHost(PROD_HOST, PROD_HOST, none, { notProd: true });
  assert.equal(np.ok, false); assert.equal(np.prod, true); assert.match(np.reason, /--not-prod is only accepted for a local host/);
  assert.equal(cli.checkHost('ep-dev-x-999999.neon.tech', 'ep-dev-x-999999', known, { notProd: true }).ok, false);
});
t('checkHost (fail-closed): host מקומי — ייצור בלי --not-prod, מותר איתו; --not-prod על DB ייצור מוכר נדחה', () => {
  for (const host of ['localhost', '127.0.0.1', 'db.gemach.test', 'pg.localhost', 'postgres.local']) {
    const denied = cli.checkHost(host, host, []);
    assert.equal(denied.ok, false, host); assert.equal(denied.prod, true, host); assert.match(denied.reason, /--not-prod/);
    const ok = cli.checkHost(host, host, [], { notProd: true });
    assert.equal(ok.ok, true, host); assert.equal(ok.prod, false, host); assert.match(ok.label, /not-prod/);
    assert.equal(cli.checkHost(host, host, known, { notProd: true }).ok, true, host); // גם עם סביבה מלאה
  }
  assert.equal(cli.checkHost('localhost', 'localhost', [], { allowProd: true }).ok, true); // הדרך השנייה (מצהיר ייצור) גם עובדת
  for (const [host, conf] of [[PROD_HOST, PROD_HOST], [ORG2_PROD_HOST, 'ep-org2-star-333333']]) {
    const r = cli.checkHost(host, conf, known, { notProd: true });
    assert.equal(r.ok, false, host); assert.match(r.reason, /known PRODUCTION/);
  }
  // TEST מוכר: מותר גם בלי דגלים וגם עם --not-prod
  assert.equal(cli.checkHost(TEST_HOST, TEST_HOST, known, { notProd: true }).ok, true);
  assert.equal(cli.checkHost(TEST_HOST, TEST_HOST, known, { notProd: true }).prod, false);
  // --not-prod לא עוקף אי-התאמה של האישור
  assert.equal(cli.checkHost('localhost', 'localhost!', [], { notProd: true }).ok, false);
});
t('checkHost (fail-closed): סביבה סותרת — אותו endpoint גם ב-PROD וגם ב-TEST = ייצור', () => {
  const both = cli.collectKnownDbs({ PROD_DATABASE_URL: `postgresql://u:x@${PROD_HOST}/db`, TEST_DATABASE_URL: `postgresql://u:x@${PROD_HOST}/db` });
  const r = cli.checkHost(PROD_HOST, PROD_HOST, both);
  assert.equal(r.ok, false); assert.equal(r.prod, true);
  assert.equal(cli.checkHost(PROD_HOST, PROD_HOST, both, { notProd: true }).ok, false);
});
t('isLocalDevHost', () => {
  for (const h of ['localhost', 'LOCALHOST', '127.0.0.1', '127.1.2.3', '[::1]', '::1', 'a.localhost', 'db.gemach.test', 'x.y.local']) assert.equal(cli.isLocalDevHost(h), true, h);
  for (const h of ['', null, undefined, 'ep-x-1.neon.tech', 'localhost.evil.com', 'test', 'local', '128.0.0.1', 'neon.tech', 'my.test.com', 'localhost2']) assert.equal(cli.isLocalDevHost(h), false, String(h));
});
t('checkHost (R1): תת-מחרוזות גנריות נדחות (neon, neon.tech, aws, חלק מה-endpoint)', () => {
  for (const frag of ['neon', 'neon.tech', 'aws', '.tech', 'ep-test-moon', 'test-moon-222222', 'c-2.eu-central-1.aws.neon.tech', 'moon-222222-pooler']) {
    const r = cli.checkHost(TEST_HOST, frag, known);
    assert.equal(r.ok, false, frag);
  }
});
t('checkHost (R1): מחרוזת אישור קצרה מ-8 תווים נדחית, גם אם היא ה-host המלא', () => {
  assert.equal(cli.checkHost('ep-a1.io', 'ep-a1.io', [], { allowProd: true }).ok, true); // 8 תווים בדיוק => מותר (DB לא מוכר = ייצור, לכן allowProd)
  assert.equal(cli.checkHost('ep-a.io', 'ep-a.io', [], { allowProd: true }).ok, false); // 7 => נדחה
  assert.equal(cli.checkHost(TEST_HOST, 'ep', known).ok, false);
  assert.equal(cli.checkHost(TEST_HOST, '', known).ok, false);
  assert.equal(cli.checkHost(TEST_HOST, undefined, known).ok, false);
  assert.equal(cli.checkHost('', 'ep-test-moon-222222', known).ok, false);
});
t('checkHost (R1): אישור של DB אחר לא מתאים', () => {
  assert.equal(cli.checkHost(TEST_HOST, PROD_HOST, known).ok, false);
  assert.equal(cli.checkHost(TEST_HOST, 'ep-prod-wind-111111', known).ok, false);
});
t('checkHost (R1): DB של ייצור נדחה בלי --i-know-this-is-prod, ומותר איתו', () => {
  for (const [host, conf] of [[PROD_HOST, PROD_HOST], [PROD_HOST, 'ep-prod-wind-111111'], [ORG2_PROD_HOST, 'ep-org2-star-333333']]) {
    const denied = cli.checkHost(host, conf, known);
    assert.equal(denied.ok, false, host);
    assert.equal(denied.prod, true);
    assert.match(denied.reason, /--i-know-this-is-prod/);
    const allowed = cli.checkHost(host, conf, known, { allowProd: true });
    assert.equal(allowed.ok, true);
    assert.equal(allowed.prod, true);
  }
  // גרסת unpooled של אותו endpoint של PROD גם היא ייצור
  assert.equal(cli.checkHost('ep-prod-wind-111111.c-2.eu-central-1.aws.neon.tech', 'ep-prod-wind-111111', known).ok, false);
  // --i-know-this-is-prod לא עוקף אי-התאמה של האישור
  assert.equal(cli.checkHost(PROD_HOST, 'ep-test-moon-222222', known, { allowProd: true }).ok, false);
});
t('checkHost (R1): מסרב כשהמחרוזת מזהה יותר מ-DB מוכר אחד', () => {
  const dup = [
    { env: 'A', label: 'A', prod: false, host: 'shared.example.com', endpoint: 'ep-one-000001' },
    { env: 'B', label: 'B', prod: false, host: 'shared.example.com', endpoint: 'ep-two-000002' },
  ];
  const r = cli.checkHost('shared.example.com', 'shared.example.com', dup);
  assert.equal(r.ok, false);
  assert.match(r.reason, /more than one/);
});
t('endpointId', () => {
  assert.equal(cli.endpointId('EP-Cool-Sky-123-pooler.us-east-1.aws.neon.tech'), 'ep-cool-sky-123');
  assert.equal(cli.endpointId('localhost'), 'localhost');
  assert.equal(cli.endpointId(''), '');
});
t('describeDbTarget: host בלי סיסמה', () => {
  const d = cli.describeDbTarget('postgresql://user:SECRETPASS@ep-cool-sky.neon.tech/mydb?sslmode=require');
  assert.deepEqual(d, { host: 'ep-cool-sky.neon.tech', database: 'mydb' });
  assert.ok(!JSON.stringify(d).includes('SECRETPASS'));
  assert.throws(() => cli.describeDbTarget('not a url'));
});
await ta('buildUserThemeColor: שומר העדפות קיימות, מוסיף / מסיר עקיפה', async () => {
  const start = JSON.stringify({ v: 1, palette: 'wine', mode: 'dark' });
  const a = await cli.buildUserThemeColor(start, 'shell', 'a5');
  assert.deepEqual(JSON.parse(a.serialized), { v: 1, palette: 'wine', mode: 'dark', uiVariants: { shell: 'a5' } });
  assert.equal(a.previous, undefined);
  const b = await cli.buildUserThemeColor(a.serialized, 'home', 'legacy');
  assert.deepEqual(JSON.parse(b.serialized).uiVariants, { shell: 'a5', home: 'legacy' });
  const c = await cli.buildUserThemeColor(b.serialized, 'shell', null);
  assert.deepEqual(JSON.parse(c.serialized).uiVariants, { home: 'legacy' });
  assert.equal(c.previous, 'a5');
  const d = await cli.buildUserThemeColor(c.serialized, 'home', null);
  assert.deepEqual(JSON.parse(d.serialized), { v: 1, palette: 'wine', mode: 'dark' }); // המפתח הוסר לגמרי
});
await ta('buildUserThemeColor: עמודה ריקה / legacy ("standard") מתחילה מאפס', async () => {
  for (const raw of [null, undefined, 'standard', '', 'not json']) {
    const r = await cli.buildUserThemeColor(raw, 'order_card', 'a5');
    assert.deepEqual(JSON.parse(r.serialized), { v: 1, uiVariants: { order_card: 'a5' } });
  }
});
// --- R2: compare-and-swap ---
function fakePrisma(initialThemeColor, { concurrentWrites = [] } = {}) {
  const row = { id: 'emp-1', legacyId: 7, firstName: 'A', lastName: 'B', isActive: true, themeColor: initialThemeColor };
  const state = { row, findCalls: 0, updateCalls: [], writes: [...concurrentWrites] };
  state.prisma = {
    employee: {
      async findFirst() { state.findCalls++; return { ...row }; },
      async updateMany({ where, data }) {
        state.updateCalls.push({ where, data });
        // כתיבה מקבילה של האפליקציה (PUT design-prefs) שנוחתת בין הקריאה לכתיבה
        if (state.writes.length) row.themeColor = state.writes.shift();
        if (where.id !== row.id || where.themeColor !== row.themeColor) return { count: 0 };
        row.themeColor = data.themeColor;
        return { count: 1 };
      },
    },
  };
  return state;
}
const W = { id: 'emp-1' };
await ta('applyUserVariant (R2): כתיבה רגילה משתמשת ב-updateMany עם where על themeColor שנקרא', async () => {
  const start = JSON.stringify({ v: 1, palette: 'wine' });
  const st = fakePrisma(start);
  const r = await cli.applyUserVariant(st.prisma, W, 'shell', 'a5');
  assert.equal(r.status, 'written');
  assert.equal(r.attempts, 1);
  assert.deepEqual(st.updateCalls[0].where, { id: 'emp-1', themeColor: start });
  assert.deepEqual(JSON.parse(st.row.themeColor), { v: 1, palette: 'wine', uiVariants: { shell: 'a5' } });
});
await ta('applyUserVariant (R2): themeColor null (אין העדפות) נכתב עם where themeColor:null', async () => {
  const st = fakePrisma(null);
  const r = await cli.applyUserVariant(st.prisma, W, 'home', 'a5');
  assert.equal(r.status, 'written');
  assert.equal(st.updateCalls[0].where.themeColor, null);
});
await ta('applyUserVariant (R2): עדכון מקביל בין הקריאה לכתיבה לא נדרס - קוראים שוב ומשלבים', async () => {
  const start = JSON.stringify({ v: 1, palette: 'wine' });
  const concurrent = JSON.stringify({ v: 1, palette: 'sea', mode: 'dark' }); // המשתמש שינה פלטה במקביל
  const st = fakePrisma(start, { concurrentWrites: [concurrent] });
  const r = await cli.applyUserVariant(st.prisma, W, 'shell', 'a5');
  assert.equal(r.status, 'written');
  assert.equal(r.attempts, 2);
  assert.equal(st.updateCalls.length, 2);
  // העדכון המקביל (sea/dark) שרד, והעקיפה נוספה עליו
  assert.deepEqual(JSON.parse(st.row.themeColor), { v: 1, palette: 'sea', mode: 'dark', uiVariants: { shell: 'a5' } });
});
await ta('applyUserVariant (R2): אחרי 3 כישלונות זורק שגיאה ולא דורס', async () => {
  const start = JSON.stringify({ v: 1, palette: 'p0' });
  const writes = [1, 2, 3].map((n) => JSON.stringify({ v: 1, palette: `p${n}` }));
  const st = fakePrisma(start, { concurrentWrites: writes });
  await assert.rejects(() => cli.applyUserVariant(st.prisma, W, 'shell', 'a5'), /kept changing/);
  assert.equal(st.updateCalls.length, 3);
  assert.deepEqual(JSON.parse(st.row.themeColor), { v: 1, palette: 'p3' }); // הערך המקביל האחרון נשאר בשלמותו
});
await ta('applyUserVariant (R2): dry-run לא כותב; ניקוי בלי עקיפה = nothing; עובד חסר זורק', async () => {
  const st = fakePrisma(JSON.stringify({ v: 1, palette: 'wine' }));
  assert.equal((await cli.applyUserVariant(st.prisma, W, 'shell', 'a5', { dry: true })).status, 'dry');
  assert.equal((await cli.applyUserVariant(st.prisma, W, 'shell', null)).status, 'nothing');
  assert.equal(st.updateCalls.length, 0);
  const none = { employee: { async findFirst() { return null; } } };
  await assert.rejects(() => cli.applyUserVariant(none, W, 'shell', 'a5'), /not found/);
});

// --- R4: DesignPrefsSync - prefs עם uiVariants בלבד אינם "יש העדפות" ---
console.log('DesignPrefsSync helper (R4)');
t('splitServerPrefs (R4): uiVariants בלבד => hasPrefs=false (לא חוסם הגירה)', () => {
  const r = splitServerPrefs({ uiVariants: { shell: 'a5' } });
  assert.equal(r.hasPrefs, false);
  assert.deepEqual(r.uiVariants, { shell: 'a5' });
  assert.deepEqual(r.prefs, {});
  assert.equal(splitServerPrefs({ v: 1, uiVariants: { home: 'a5' } }).hasPrefs, false);
});
t('splitServerPrefs (R4): העדפות אמיתיות => hasPrefs=true, uiVariants מופרד החוצה', () => {
  const r = splitServerPrefs({ palette: 'wine', uiVariants: { shell: 'a5' } });
  assert.equal(r.hasPrefs, true);
  assert.deepEqual(r.prefs, { palette: 'wine' });
  assert.deepEqual(r.uiVariants, { shell: 'a5' });
  assert.equal(splitServerPrefs({ mode: 'dark' }).uiVariants, null);
});
t('splitServerPrefs (R4): null / undefined / לא-אובייקט => אין העדפות', () => {
  for (const bad of [null, undefined, 'x', 5]) {
    assert.deepEqual(splitServerPrefs(bad), { uiVariants: null, prefs: {}, hasPrefs: false });
  }
  assert.equal(splitServerPrefs({}).hasPrefs, false);
});
t('splitServerPrefs (R4): התאמה ל-GET האמיתי - parseStoredDesignPrefs של blob עם uiVariants בלבד', () => {
  const stored = JSON.stringify({ v: 1, uiVariants: { shell: 'a5' } });
  assert.equal(splitServerPrefs(parseStoredDesignPrefs(stored)).hasPrefs, false);
  assert.equal(splitServerPrefs(parseStoredDesignPrefs('standard')).hasPrefs, false);
});
t('כל המסכים נבדקים בפועל', () => assert.equal(UI_SCREENS.length, 9)); // 4 המקוריים + 4 המסכים של 4.10.2026 + board (scripts/test_page_variant_switch.mjs)

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
