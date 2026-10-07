// בדיקה ל"מעבר ישן / חדש בכל דף" (4.10.2026, docs/page-variant-switch-2026-10-04.md): הרשומה המרכזית (lib/uiVariantScreens.js),
// סדר ההכרעה עם ברירת המחדל לפי תפקיד (החלטת הבעלים: מתכנת חדש, כל השאר ישן), כלל המעבר העצמאי, נתיב ה-API הכללי, האייקון
// PageVariantToggle בגרסה החדשה ובישנה (ומתי הוא לא מוצג), ושהקבצים הישנים זהים בדיוק להיסטוריית git (blob hash).
// בלי DB, רשת ודפדפן (בדיקת התצוגה בדפדפן: scripts/variant-toggle-audit). הרצה: node scripts/test_page_variant_switch.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UI_SCREEN_REGISTRY, UI_SCREEN_IDS, NO_LEGACY_PAGES, EXTERNAL_VARIANT_SWITCHES, NEW_DESIGN_DEFAULT_ROLE_IDS,
  getScreenEntry, hasBothVersions, selfSwitchableScreenIds, roleDefaultVariant, matchRoute, screenMatchesPath, switchTargetFor,
} from '../lib/uiVariantScreens.js';
import { UI_SCREENS, UI_VARIANT_SETTING_KEYS, UI_VARIANT_SETTING_KEY_LIST, resolveUiVariant, resolveUiVariants, sanitizeUiVariants } from '../lib/uiVariant.js';
import {
  SELF_SWITCH_SCREENS, SELF_SWITCH_ROLE_IDS, applyUiVariantRequest, canSelfSwitchScreen, describeSelfSwitch, isManagementRole,
  shouldShowVariantToggle,
} from '../lib/uiVariantSelfSwitch.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => existsSync(path.join(ROOT, p));
const code = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'); // בלי שורות הערה
const require = createRequire(import.meta.url);

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const rows = (obj) => Object.entries(obj).map(([key, value]) => ({ key, value }));
const NEW_SCREENS = ['profile', 'admin_hub', 'attendance', 'error_report', 'board', 'settings'];
const BOTH = ['shell', 'home', 'order_card', 'customer_card', 'new_order', ...NEW_SCREENS]; // סדר הרשומה: order_card, customer_card אחרי home; new_order (6.10.2026) אחרי customer_card (employee_card ביניהם, עדיין בלי חדש)

console.log('1. הרשומה המרכזית');
await t('מזהים ייחודיים, שדות חובה, נתיבים כמערך, מפתח הגדרה ui_variant_<id>', () => {
  assert.equal(new Set(UI_SCREEN_IDS).size, UI_SCREEN_IDS.length);
  assert.deepEqual(UI_SCREEN_IDS, ['shell', 'home', 'order_card', 'customer_card', 'employee_card', 'new_order', ...NEW_SCREENS]);
  for (const e of UI_SCREEN_REGISTRY) {
    assert.match(e.id, /^[a-z][a-z_]{1,30}$/, e.id);
    assert.ok(typeof e.label === 'string' && /[֐-׿]/.test(e.label), `${e.id}: label בעברית`);
    assert.ok(Array.isArray(e.routes), `${e.id}: routes`);
    for (const k of ['legacyExists', 'newExists', 'selfSwitch']) assert.equal(typeof e[k], 'boolean', `${e.id}.${k}`);
    assert.ok(!('defaultVariant' in e), `${e.id}: אין ברירת מחדל פר-מסך (החלטת הבעלים: לפי תפקיד)`);
    assert.equal(UI_VARIANT_SETTING_KEYS[e.id], `ui_variant_${e.id}`);
    assert.ok(Object.isFrozen(e));
  }
  assert.deepEqual(UI_SCREENS, UI_SCREEN_IDS, 'lib/uiVariant.js נגזר מהרשומה');
  assert.equal(UI_VARIANT_SETTING_KEY_LIST.length, UI_SCREEN_IDS.length);
});
await t('המצב היום: שתי הגרסאות קיימות ב-shell / home / profile / admin_hub / attendance / error_report / board / order_card / customer_card / new_order (6.10.2026); employee_card עוד לא', () => {
  for (const id of BOTH) assert.equal(hasBothVersions(id), true, id);
  for (const id of ['employee_card']) { assert.equal(hasBothVersions(id), false, id); assert.equal(getScreenEntry(id).newExists, false); }
  assert.deepEqual(selfSwitchableScreenIds(), BOTH);
  assert.equal(getScreenEntry('__proto__'), null); assert.equal(getScreenEntry('constructor'), null); assert.equal(getScreenEntry('SHELL'), null);
});
await t('דפים בלי גרסה ישנה ודף הכניסה לא ברשומה (אין מתג ואין אייקון)', () => {
  for (const p of NO_LEGACY_PAGES) assert.equal(getScreenEntry(p.id), null, p.id);
  const login = EXTERNAL_VARIANT_SWITCHES.find((x) => x.id === 'login');
  assert.ok(login && login.preAuth && !login.selfSwitch && login.settingKey === 'login_page_new');
  assert.equal(getScreenEntry('login'), null);
});
await t('scripts/set-ui-variant.js מכיר בדיוק את מסכי הרשומה', () => {
  assert.deepEqual(require('./set-ui-variant.js').SCREENS, UI_SCREEN_IDS);
});
await t('תפקיד ברירת המחדל החדשה = DEVELOPER_ONLY_ROLES ב-lib/roles.js; תפקידי המעבר העצמאי = HEAD_MANAGEMENT_ROLES', () => {
  const auth = read('lib/roles.js'); // הקבועים עברו ל-lib/roles.js (employee-card fix), lib/auth.js מייצא אותם מחדש
  assert.deepEqual([...NEW_DESIGN_DEFAULT_ROLE_IDS], JSON.parse(/DEVELOPER_ONLY_ROLES = (\[[^\]]*\])/.exec(auth)[1]));
  assert.deepEqual([...SELF_SWITCH_ROLE_IDS], JSON.parse(/HEAD_MANAGEMENT_ROLES = (\[[^\]]*\])/.exec(auth)[1]));
});
await t('employee_card: /employees/:id לא תופס את /employees/attendance ו-/employees/report (excludeRoutes), כן את מזהה העובד ו-/employees/new', () => {
  assert.ok(matchRoute('/employees/:id', '/employees/attendance'), 'matchRoute הגולמי תופס כל מקטע - לכן יש excludeRoutes');
  assert.equal(screenMatchesPath('employee_card', '/employees/attendance'), false);
  assert.equal(screenMatchesPath('employee_card', '/employees/report/'), false);
  assert.equal(screenMatchesPath('employee_card', '/employees/abc-123'), true);
  assert.equal(screenMatchesPath('employee_card', '/employees/new?x=1'), true);
  assert.equal(screenMatchesPath('employee_card', '/employees'), false);
  assert.equal(screenMatchesPath('employee_card', '/employees/abc/attendance'), false);
  assert.equal(screenMatchesPath('attendance', '/employees/attendance'), true);
  assert.equal(screenMatchesPath('shell', '/anything'), true);
  assert.equal(screenMatchesPath('error_report', '/x'), false);
  assert.equal(screenMatchesPath('nope', '/x'), false);
  const e = getScreenEntry('employee_card');
  assert.equal(e.newExists, false); assert.equal(e.switchTargets, null);
  assert.equal(roleDefaultVariant('employee_card', 2), 'legacy', 'מתכנת לא מקבל את הכרטיס החדש כברירת מחדל עד שהבעלים מאשר');
  assert.equal(resolveUiVariant('employee_card', { roleId: 0, settings: rows({ ui_variant_employee_card: 'a5' }) }), 'a5', 'הגדרת ארגון עדיין מדליקה');
  assert.equal(shouldShowVariantToggle({ canSelfSwitch: true, screen: 'employee_card', pathname: '/employees/abc' }), false, 'newExists:false -> אין אייקון');
});
await t('new_order (6.10.2026): /orders/new שייך רק ל-new_order ו-/orders/:id רק ל-order_card; מתכנת - חדש כברירת מחדל, כל השאר ישן; אייקון רק להנהלה / מתכנת ורק ב-/orders/new', async () => {
  const e = getScreenEntry('new_order');
  assert.equal(e.newExists, true); assert.equal(e.selfSwitch, true); assert.equal(e.legacyExists, true);
  assert.deepEqual([...e.routes], ['/orders/new']);
  assert.equal(screenMatchesPath('new_order', '/orders/new'), true);
  assert.equal(screenMatchesPath('new_order', '/orders/new/'), true);
  assert.equal(screenMatchesPath('new_order', '/orders/new?customerId=5'), true);
  assert.equal(screenMatchesPath('order_card', '/orders/new'), false, 'excludeRoutes של order_card');
  assert.equal(screenMatchesPath('order_card', '/orders/123'), true);
  assert.equal(screenMatchesPath('new_order', '/orders/123'), false);
  assert.equal(screenMatchesPath('new_order', '/orders'), false);
  for (const roleId of [0, 1, 3, null, undefined]) assert.equal(roleDefaultVariant('new_order', roleId), 'legacy', `role ${String(roleId)}`);
  assert.equal(roleDefaultVariant('new_order', 2), 'a5');
  assert.equal(resolveUiVariant('new_order', { roleId: 2, settings: rows({ ui_variant_new_order: 'legacy' }) }), 'legacy', 'הגדרת ארגון גוברת');
  assert.equal(resolveUiVariant('new_order', { roleId: 0, settings: rows({ ui_variant_new_order: 'a5' }) }), 'a5');
  for (const roleId of [0, 2]) {
    assert.equal(shouldShowVariantToggle({ canSelfSwitch: true, screen: 'new_order', pathname: '/orders/new' }), true);
    assert.ok(canSelfSwitchScreen(roleId, 'new_order'));
  }
  assert.equal(shouldShowVariantToggle({ canSelfSwitch: false, screen: 'new_order', pathname: '/orders/new' }), false);
  assert.equal(shouldShowVariantToggle({ canSelfSwitch: true, screen: 'new_order', pathname: '/orders/123' }), false, 'לא בכרטיס ההזמנה');
  assert.equal(shouldShowVariantToggle({ canSelfSwitch: true, screen: 'order_card', pathname: '/orders/new' }), false, 'לא של order_card באשף ההזמנה החדשה');
  const L = await import('../lib/pageVariantToggle.js');
  assert.deepEqual(L.toggleLabelsFor('new_order'), { toNew: 'מעבר לאשף ההזמנה החדש', toOld: 'חזרה לאשף ההזמנה הישן' });
});
await t('new_order: NewOrderSwitch עוטף ב-VariantFrame (פינה בישן), האשף החדש מציג PageVariantToggle בכותרת, הקובץ הישן לא נוגע', () => {
  const sw = code(read('app/components/new-order/NewOrderSwitch.js'));
  assert.match(sw, /variant !== 'a5'\) return <VariantFrame screen="new_order" variant="legacy"><LegacyNewOrderPage \/><\/VariantFrame>/);
  assert.match(sw, /return <VariantFrame screen="new_order" variant="a5"><NewOrderA5 \/><\/VariantFrame>/);
  const a5 = code(read('app/components/new-order/NewOrderA5.js'));
  assert.match(a5, /<PageVariantToggle screen="new_order" placement="header" systemTip \/>/);
  assert.ok(!/useCanSelfSwitch|VariantFrame/.test(code(read('app/orders/new/LegacyNewOrderPage.js'))), 'הקובץ הישן נשאר קפוא (אין בו כלום מהמעבר)');
});
await t('matchRoute / switchTargetFor', () => {
  assert.ok(matchRoute('/orders/:id', '/orders/12')); assert.ok(matchRoute('/orders/:id', '/orders/12/?x=1'));
  assert.ok(!matchRoute('/orders/:id', '/orders')); assert.ok(!matchRoute('/admin', '/admin/settings')); assert.ok(matchRoute('*', '/x/y'));
  assert.ok(matchRoute('/', '/')); assert.ok(!matchRoute('/', '/profile'));
  assert.equal(switchTargetFor('attendance', 'a5', '/employees'), '/employees/attendance');
  assert.equal(switchTargetFor('attendance', 'a5', '/employees/report'), '/employees/attendance');
  assert.equal(switchTargetFor('attendance', 'legacy', '/employees/attendance'), '/employees');
  assert.equal(switchTargetFor('attendance', 'legacy', '/my-hours'), null);
  assert.equal(switchTargetFor('profile', 'a5', '/profile'), null);
  assert.equal(switchTargetFor('nope', 'a5', '/x'), null);
});

console.log('2. סדר ההכרעה: עקיפה אישית > הגדרת ארגון > ברירת מחדל לפי תפקיד');
await t('ברירת מחדל לפי תפקיד: מתכנת (2) -> חדש בכל מסך שיש לו חדש; הנהלה (0), מנהל סניף (1), עובד, אורח -> ישן', () => {
  for (const id of UI_SCREEN_IDS) {
    const expectProg = getScreenEntry(id).newExists ? 'a5' : 'legacy';
    assert.equal(roleDefaultVariant(id, 2), expectProg, id);
    assert.equal(resolveUiVariant(id, { roleId: 2 }), expectProg, id);
    for (const r of [0, 1, 3, 5, null, undefined, '2', NaN]) assert.equal(resolveUiVariant(id, { roleId: r }), 'legacy', `${id} role ${String(r)}`);
  }
  assert.equal(resolveUiVariant('order_card', { roleId: 2 }), 'a5', 'כרטיס ההזמנה החדש קיים (newExists): המתכנת מקבל אותו כברירת מחדל');
  for (const r of [0, 1, 3, null, undefined]) assert.equal(resolveUiVariant('order_card', { roleId: r }), 'legacy', `order_card role ${String(r)}: ברירת מחדל ישן לכולם חוץ מהמתכנת`);
  assert.deepEqual(resolveUiVariants({}), Object.fromEntries(UI_SCREEN_IDS.map((s) => [s, 'legacy'])));
});
await t('הגדרת ארגון גוברת על ברירת המחדל לפי תפקיד (בשני הכיוונים)', () => {
  for (const id of BOTH) {
    assert.equal(resolveUiVariant(id, { roleId: 2, settings: rows({ [`ui_variant_${id}`]: 'legacy' }) }), 'legacy', id);
    assert.equal(resolveUiVariant(id, { roleId: 0, settings: rows({ [`ui_variant_${id}`]: 'a5' }) }), 'a5', id);
    assert.equal(resolveUiVariant(id, { roleId: 5, settings: { [`ui_variant_${id}`]: ' A5 ' } }), 'a5', `${id} סלחני`);
  }
  // המצב בייצור מ-4.10.2026: shell/home = 'legacy' בארגון -> גם המתכנת בישן, אלא אם יש לו עקיפה אישית
  const prod = rows({ ui_variant_shell: 'legacy', ui_variant_home: 'legacy' });
  assert.equal(resolveUiVariant('shell', { roleId: 2, settings: prod }), 'legacy');
  assert.equal(resolveUiVariant('profile', { roleId: 2, settings: prod }), 'a5', 'מסך בלי שורה - לפי תפקיד');
  assert.equal(resolveUiVariant('profile', { roleId: 0, settings: prod }), 'legacy');
});
await t('ערך ארגון לא תקין = כאילו אין שורה -> ברירת המחדל לפי תפקיד', () => {
  for (const bad of ['', 'A6', 'true', 5, null, {}]) {
    assert.equal(resolveUiVariant('profile', { roleId: 2, settings: rows({ ui_variant_profile: bad }) }), 'a5', String(bad));
    assert.equal(resolveUiVariant('profile', { roleId: 0, settings: rows({ ui_variant_profile: bad }) }), 'legacy', String(bad));
  }
});
await t('עקיפה אישית גוברת על שניהם; ערך עקיפה לא תקין מתעלמים ממנו', () => {
  const s = rows({ ui_variant_attendance: 'legacy' });
  assert.equal(resolveUiVariant('attendance', { roleId: 0, settings: s, userVariants: { attendance: 'a5' } }), 'a5');
  assert.equal(resolveUiVariant('attendance', { roleId: 2, settings: rows({ ui_variant_attendance: 'a5' }), userVariants: { attendance: 'legacy' } }), 'legacy');
  assert.equal(resolveUiVariant('attendance', { roleId: 2, userVariants: { attendance: 'legacy' } }), 'legacy', 'עוקף גם את ברירת המחדל של המתכנת');
  assert.equal(resolveUiVariant('attendance', { roleId: 2, userVariants: { attendance: 'bogus' } }), 'a5');
  // המצב של חשבון המתכנת בייצור: עקיפות shell/home='a5' מעל הגדרת ארגון 'legacy'
  const prod = rows({ ui_variant_shell: 'legacy', ui_variant_home: 'legacy' });
  assert.deepEqual([resolveUiVariant('shell', { roleId: 2, settings: prod, userVariants: { shell: 'a5', home: 'a5' } }), resolveUiVariant('home', { roleId: 2, settings: prod, userVariants: { shell: 'a5', home: 'a5' } })], ['a5', 'a5']);
  assert.deepEqual(sanitizeUiVariants({ profile: 'a5', error_report: 'legacy', login: 'a5', admin_hub: 'x' }), { profile: 'a5', error_report: 'legacy' });
});
await t('קיוסק / שעון נוכחות / הדפסה: המעטפת ישנה גם למתכנת ועם עקיפה', () => {
  for (const p of ['/customer-interface', '/punch-clock', '/print/x', '/dashboard/dresses/5/print']) {
    assert.equal(resolveUiVariant('shell', { roleId: 2, userVariants: { shell: 'a5' }, settings: rows({ ui_variant_shell: 'a5' }), pathname: p }), 'legacy', p);
  }
});
await t('ה-layout וההכרעה בשרת מעבירים roleId (ובלעדיו הכול ישן)', () => {
  const layout = read('app/layout.js');
  assert.match(layout, /resolveUiVariants\(\{[\s\S]*?roleId: isAuthenticated && emp && typeof emp\.roleId === 'number' \? emp\.roleId : null,[\s\S]*?\}\)/);
  assert.match(layout, /<UiVariantProvider value=\{uiVariants\} canSelfSwitch=\{canSelfSwitchVariant\}>/);
  assert.match(layout, /canSelfSwitchVariant = !!\(isAuthenticated && emp && isManagementRole\(emp\.roleId\)\)/);
  const srv = read('app/lib/uiVariantServer.js');
  assert.match(srv, /resolveUiVariant\(screen, \{ userVariants, settings, pathname: [^}]*roleId \}\)/);
  assert.match(srv, /readVerifiedSession\(cookieStore\)/);
});

console.log('3. מי רשאי לעבור בעצמו');
const emp = (o = {}) => ({ id: 'emp-1', isActive: true, roleId: 0, themeColor: null, ...o });
const fakePrisma = () => { const calls = []; return { calls, employee: { update: async (a) => { calls.push(a); return { id: a.where.id }; } } }; };
await t('SELF_SWITCH_SCREENS מהרשומה; canSelfSwitchScreen רק להנהלה ראשית / מתכנת', () => {
  assert.deepEqual([...SELF_SWITCH_SCREENS], BOTH);
  for (const s of BOTH) { assert.ok(canSelfSwitchScreen(0, s)); assert.ok(canSelfSwitchScreen(2, s)); assert.ok(!canSelfSwitchScreen(1, s)); assert.ok(!canSelfSwitchScreen(null, s)); }
  for (const s of ['employee_card', 'login', 'schedule', '__proto__']) assert.ok(!canSelfSwitchScreen(2, s), s);
  assert.ok(!isManagementRole('0'));
  assert.deepEqual(describeSelfSwitch(emp({ roleId: 2 })).screens, BOTH);
});
await t('POST למסכים החדשים: הנהלה / מתכנת - a5 / legacy / null נכתבים לעובד המאומת בלבד', async () => {
  for (const screen of NEW_SCREENS) {
    for (const roleId of [0, 2]) {
      for (const value of ['a5', 'legacy', null]) {
        const fp = fakePrisma();
        const start = JSON.stringify({ v: 1, palette: 'forest', uiVariants: { shell: 'a5', [screen]: value === null ? 'a5' : (value === 'a5' ? 'legacy' : 'a5') } });
        const r = await applyUiVariantRequest({ screen, body: { value, employeeId: 'other' }, employee: emp({ roleId, themeColor: start }), prisma: fp });
        assert.equal(r.status, 200, `${screen}/${roleId}/${value}`);
        assert.equal(fp.calls.length, 1);
        assert.equal(fp.calls[0].where.id, 'emp-1');
        const stored = JSON.parse(fp.calls[0].data.themeColor);
        assert.equal(stored.palette, 'forest');
        assert.equal(stored.uiVariants.shell, 'a5', 'מסכים אחרים נשמרים');
        assert.equal(stored.uiVariants[screen], value === null ? undefined : value);
        assert.equal(r.json.value, value);
      }
    }
  }
});
await t('POST: מנהל סניף / עובד -> 403 בכל ערך; מסך לא מוכר / בלי גרסה חדשה -> 400; לא מחובר -> 401; בלי כתיבה', async () => {
  for (const screen of NEW_SCREENS) for (const roleId of [1, 3, null]) for (const value of ['a5', 'legacy', null]) {
    const fp = fakePrisma();
    const r = await applyUiVariantRequest({ screen, body: { value }, employee: emp({ roleId }), prisma: fp });
    assert.equal(r.status, 403, `${screen}/${roleId}/${value}`); assert.equal(fp.calls.length, 0);
  }
  for (const screen of ['employee_card', 'login', 'schedule', '', '__proto__', 'PROFILE']) {
    const fp = fakePrisma();
    const r = await applyUiVariantRequest({ screen, body: { value: 'a5' }, employee: emp({ roleId: 2 }), prisma: fp });
    assert.equal(r.status, 400, screen); assert.equal(fp.calls.length, 0);
  }
  const r = await applyUiVariantRequest({ screen: 'profile', body: { value: 'a5' }, employee: null, prisma: fakePrisma() });
  assert.equal(r.status, 401);
});
await t('נתיב ה-API הכללי: /api/me/ui-variant/[screen] דוחה מסך לא ניתן להחלפה (404) לפני העוגייה / ה-DB, ואותה ליבה', () => {
  const src = read('app/api/me/ui-variant/[screen]/route.js');
  const c = code(src);
  assert.ok(c.indexOf('isSelfSwitchScreen(screen)') > -1 && c.indexOf('isSelfSwitchScreen(screen)') < c.indexOf('handleUiVariantPost(request, screen)'));
  assert.match(c, /status: 404/);
  assert.ok(!/export async function (GET|PUT|DELETE|PATCH)/.test(c), 'POST בלבד');
  assert.ok(exists('app/api/me/ui-variant/shell/route.js') && exists('app/api/me/ui-variant/home/route.js'), 'הנתיבים הסטטיים נשארו');
});

console.log('4. האייקון');
await t('shouldShowVariantToggle: רק לרשאי, רק במסך עם שתי גרסאות, לא בקיוסק / שעון / הדפסה, רק בנתיבי המסך', () => {
  const ok = (screen, pathname, canSelfSwitch = true) => shouldShowVariantToggle({ canSelfSwitch, screen, pathname });
  assert.ok(ok('profile', '/profile')); assert.ok(ok('admin_hub', '/admin')); assert.ok(ok('home', '/'));
  assert.ok(ok('attendance', '/employees/attendance')); assert.ok(ok('attendance', '/my-hours')); assert.ok(ok('attendance', '/employees/report')); assert.ok(ok('attendance', '/employees'));
  assert.ok(ok('error_report', '/orders/5'), 'חלון גלובלי'); assert.ok(ok('shell', '/anything'));
  assert.ok(!ok('profile', '/profile', false)); assert.ok(!ok('profile', '/profile', 'true'));
  assert.ok(!ok('attendance', '/employees/abc/attendance'), 'אין גרסה ישנה לעריכת עובד');
  assert.ok(!ok('admin_hub', '/admin/settings')); assert.ok(!ok('profile', '/'));
  assert.ok(ok('order_card', '/orders/5')); assert.ok(!ok('order_card', '/orders/new'), 'מסך ההזמנה החדשה הוא דף אחר'); assert.ok(!ok('order_card', '/orders'));
  assert.ok(ok('customer_card', '/customers/5')); assert.ok(!ok('customer_card', '/orders/5'));
  for (const p of ['/customer-interface', '/punch-clock', '/print/order/5', '/dashboard/dresses/5/print']) { assert.ok(!ok('shell', p), p); assert.ok(!ok('error_report', p), p); }
});
const TOGGLE = read('app/components/variant/PageVariantToggle.js');
await t('PageVariantToggle: null כשאסור; POST /api/me/ui-variant/<screen> { value }; טקסטים; אייקון 57 מה-sprite', () => {
  const c = code(TOGGLE);
  assert.match(c, /const allowed = useCanSelfSwitch\(screen\)/);
  assert.match(c, /if \(!allowed\) return null;/);
  assert.match(c, /fetch\(`\/api\/me\/ui-variant\/\$\{encodeURIComponent\(screen\)\}`/);
  assert.match(c, /body: JSON\.stringify\(\{ value: target \}\)/);
  assert.match(c, /window\.location\.reload\(\)/);
  assert.match(c, /toggleLabelsFor\(screen\)/);
  assert.match(c, /SPRITE_SYMBOLS\.find\(\(s\) => s\[0\] === 'swap'\)/);
  const icons = JSON.parse(read('design-system/icons.json')).icons;
  assert.equal(icons.find((x) => x.id === 'swap').n, 57);
  assert.match(code(read('app/components/UiVariantContext.js')), /shouldShowVariantToggle\(\{ canSelfSwitch: allowed, screen, pathname \}\)/);
});
const NEW_PLACES = [
  ['app/components/profile/ProfilePage.js', 'profile', 'header'],
  ['app/components/admin-hub/AdminHubPage.js', 'admin_hub', 'header'],
  ['app/components/attendance/AttendancePage.js', 'attendance', 'header'],
  ['app/components/errorReport/ErrorReportWindow.js', 'error_report', 'window'],
  ['app/components/board/BoardPage.js', 'board', 'header'],
  ['app/components/home/HomeA5.js', 'home', 'hero'],
  ['app/components/AppShell.js', 'shell', 'topbar'],
];
await t('האייקון בגרסה החדשה: בכותרת של כל דף חדש (ובחלון הדיווח בשתי הכותרות); במעטפת הישנה - בסרגל העליון', () => {
  for (const [f, screen, placement] of NEW_PLACES) {
    const c = code(read(f));
    assert.ok(new RegExp(`<PageVariantToggle screen="${screen}" placement="${placement}"`).test(c), f);
    assert.match(c, /import PageVariantToggle from '[^']*variant\/PageVariantToggle'/, f);
  }
  assert.equal((code(read('app/components/errorReport/ErrorReportWindow.js')).match(/<PageVariantToggle screen="error_report"/g) || []).length, 2);
  assert.match(read('app/components/menu/MenuA5Shell.js'), /\/api\/me\/ui-variant\/shell/, 'התפריט החדש שומר את "האתר הישן"');
});
await t('האייקון בגרסה הישנה: VariantFrame (פינה) סביב כל דף ישן; חלון הדיווח הישן - מעל החלון כשהוא פתוח', () => {
  const frame = code(read('app/components/variant/VariantFrame.js'));
  assert.match(frame, /variant === 'legacy' \? <CornerToggle screen=\{screen\} \/> : null/);
  assert.match(frame, /createPortal\(<PageVariantToggle screen=\{screen\} placement=\{placement\} \/>, document\.body\)/);
  const legacyMounts = [
    ['app/profile/page.js', /<VariantFrame screen="profile" variant=\{variant\}>[\s\S]*<LegacyProfilePage \/>/],
    ['app/admin/page.js', /<VariantFrame screen="admin_hub" variant="legacy">\s*<LegacyAdminPage showSite=\{showSite\} \/>/],
    ['app/my-hours/page.js', /<VariantFrame screen="attendance" variant="legacy">\s*<LegacyMyHoursPage \/>/],
    ['app/employees/report/page.js', /<VariantFrame screen="attendance" variant="legacy">\s*<LegacyReportPage \/>/],
    ['app/employees/page.js', /<VariantFrame screen="attendance" variant="legacy">\s*<LegacyEmployeesPage \/>/],
    ['app/components/home/HomeSwitch.js', /<VariantFrame screen="home" variant="legacy"><LegacyHome \/><\/VariantFrame>/],
    ['app/board/page.js', /<VariantFrame screen="board" variant=\{variant\}>[\s\S]*<LegacyBoardPage \/>/],
  ];
  for (const [f, re] of legacyMounts) assert.match(code(read(f)), re, f);
  assert.match(code(read('app/employees/attendance/page.js')), /=== 'legacy'\) redirect\('\/employees'\)/);
  assert.match(code(read('app/employees/report/page.js')), /redirect\('\/employees\/attendance'\)/);
  const erb = code(read('app/components/ErrorReportButton.js'));
  assert.match(erb, /if \(variant === 'legacy'\) return <LegacyErrorReportFrame trigger=\{trigger\} \/>;/);
  const lef = code(read('app/components/variant/LegacyErrorReportFrame.js'));
  assert.match(lef, /<LegacyErrorReportButton trigger=\{trigger\} \/>/);
  assert.match(lef, /allowed && open \? createPortal\(<PageVariantToggle screen="error_report" placement="overlay" \/>/);
  assert.match(lef, /if \(!allowed \|\| typeof MutationObserver === 'undefined'\) return undefined;/, 'observer רק למי שרואה את האייקון');
});
await t('/display-settings: הרשימה מהשרת + שמות מהרשומה, וכפתור "ברירת מחדל" (value null)', () => {
  const c = code(read('app/display-settings/page.js'));
  assert.match(c, /data\.screens\.filter\(\(id\) => getScreenEntry\(id\)\)/);
  assert.match(c, /onClick=\{\(\) => choose\(screen, null\)\}/);
  assert.ok(!/DESIGN_SWITCH_ROWS/.test(c), 'אין רשימה קשיחה');
});

console.log('4b. ביקורת עצמאית (4.10.2026)');
await t('"ניהול אתר": LegacyAdminPage מסתיר את הכרטיס בלי showSite, ו-app/admin/page.js מחשב אותו עם אותו שער של app/admin/site/layout.js', () => {
  const legacy = code(read('app/admin/LegacyAdminPage.js'));
  assert.match(legacy, /AdminHubPage\(\{ showSite = false \}\)/, 'ברירת מחדל: מוסתר');
  assert.match(legacy, /cards\.filter\(\(card\) => card\.href !== '\/admin\/site'\)/);
  assert.match(legacy, /visibleCards\.map\(/);
  assert.ok(!/\bcards\.map\(/.test(legacy), 'אין map על הרשימה המלאה');
  const page = code(read('app/admin/page.js'));
  assert.match(page, /const showSite = await checkPageAccess\(DEVELOPER_ONLY_ROLES\);[\s\S]*<LegacyAdminPage showSite=\{showSite\} \/>/);
  const layout = code(read('app/admin/site/layout.js'));
  assert.match(layout, /checkPageAccess\(DEVELOPER_ONLY_ROLES\)[\s\S]*redirect\('\/admin'\)/, 'אותו שער כמו הלייאאוט של /admin/site');
});
await t('הפרופיל הישן: "שם מלא" לקריאה בלבד, נגזר משם פרטי + משפחה, ולא נשלח ב-name=fullName', () => {
  const c = read('app/profile/LegacyProfilePage.js');
  const m = c.match(/<input[^>]*id="profile-fullName"[^>]*\/>/);
  assert.ok(m, 'השדה קיים');
  assert.match(m[0], /disabled/); assert.match(m[0], /readOnly/);
  assert.match(m[0], /profile\.firstName[\s\S]*profile\.lastName/);
  assert.ok(!/name="fullName"/.test(m[0]) && !/onChange/.test(m[0]), 'לא שדה ערוך');
});
await t('כיתובי האייקון לפי מסך: המעטפת ("תפריט") שונה מכל דף, ואין שני כיתובים זהים בין מעטפת לדף באותו מסך', async () => {
  const L = await import('../lib/pageVariantToggle.js');
  assert.equal(L.toggleLabelsFor('shell').toNew, 'מעבר לתפריט החדש'); assert.equal(L.toggleLabelsFor('shell').toOld, 'חזרה לתפריט הישן');
  for (const id of BOTH.filter((x) => x !== 'shell')) {
    const l = L.toggleLabelsFor(id);
    assert.notEqual(l.toNew, L.toggleLabelsFor('shell').toNew, id); assert.notEqual(l.toOld, L.toggleLabelsFor('shell').toOld, id);
    assert.ok(/החד/.test(l.toNew) && /היש/.test(l.toOld), id);
  }
  assert.deepEqual(L.toggleLabelsFor('profile'), L.DEFAULT_TOGGLE_LABELS);
  assert.deepEqual(L.toggleLabelsFor('nope'), L.DEFAULT_TOGGLE_LABELS);
  assert.doesNotMatch(code(TOGGLE), /TOGGLE_LABELS\b/, 'אין כיתוב קבוע אחד לכל המסכים');
});
await t('לפני טעינה מחדש: דף מלוכלך -> חלונית האישור של האתר (showConfirm, לא window.confirm); דף נקי -> ישר', async () => {
  const L = await import('../lib/pageVariantToggle.js');
  const ctl = (o) => ({ tagName: 'INPUT', type: 'text', value: '', defaultValue: '', disabled: false, readOnly: false, closest: () => null, ...o });
  const doc = (els) => ({ querySelectorAll: () => els });
  assert.equal(L.isPageDirty({ win: {}, doc: doc([ctl({})]) }), false, 'נקי');
  assert.equal(L.isPageDirty({ win: {}, doc: doc([ctl({ value: 'x' })]) }), true, 'טקסט שונה');
  assert.equal(L.isPageDirty({ win: {}, doc: doc([ctl({ type: 'checkbox', checked: true, defaultChecked: false })]) }), true, 'תיבת סימון');
  assert.equal(L.isPageDirty({ win: {}, doc: doc([{ tagName: 'SELECT', options: [{ selected: true, defaultSelected: false }], closest: () => null }]) }), true, 'select');
  assert.equal(L.isPageDirty({ win: {}, doc: doc([ctl({ type: 'search', value: 'x' })]) }), false, 'חיפוש לא נחשב');
  assert.equal(L.isPageDirty({ win: {}, doc: doc([ctl({ type: 'hidden', value: 'x' })]) }), false);
  assert.equal(L.isPageDirty({ win: {}, doc: doc([ctl({ value: 'x', disabled: true })]) }), false);
  assert.equal(L.isPageDirty({ win: {}, doc: doc([ctl({ value: 'x', closest: () => ({}) })]) }), false, 'בתוך האייקון עצמו');
  assert.equal(L.isPageDirty({ win: { __gmDirty: true }, doc: doc([]) }), true, 'window.__gmDirty');
  assert.equal(L.isPageDirty({ win: { __gmDirty: () => true }, doc: doc([]) }), true, '__gmDirty כפונקציה');
  assert.equal(L.isPageDirty({ win: { __gmDirty: () => { throw new Error('x'); } }, doc: doc([]) }), false);
  // 6.10.2026 (האשף החדש של הזמנה חדשה): פונקציה היא ההכרעה הסופית - false גובר על עריכה אמיתית ועל בקרה ששונתה (אחרי שמירה); boolean false עדיין ממשיך לבדיקות הכלליות
  assert.equal(L.isPageDirty({ win: { __gmDirty: () => false }, doc: doc([ctl({ value: 'x' })]), userEdited: true }), false, '__gmDirty כפונקציה שמחזירה false גובר');
  assert.equal(L.isPageDirty({ win: { __gmDirty: false }, doc: doc([]), userEdited: true }), true, 'boolean false לא גובר (SettingsSimPage)');
  assert.equal(L.isPageDirty({ win: { __gmDirty: () => { throw new Error('x'); } }, doc: doc([]), userEdited: true }), true, 'פונקציה שזורקת - נופלים לבדיקות הכלליות');
  assert.equal(L.isPageDirty({ win: {}, doc: doc([]), userEdited: true }), true, 'עריכה אמיתית (בקרה מבוקרת)');
  assert.equal(L.UNSAVED_CONFIRM_MESSAGE, 'יש שינויים שלא נשמרו - לעבור בכל זאת?');
  const c = code(TOGGLE);
  assert.match(c, /isPageDirty\(\{ win: window, doc: document, userEdited: userEdited\.current \}\)[\s\S]*await popup\.showConfirm\(UNSAVED_CONFIRM_MESSAGE[\s\S]*if \(!ok\) return;[\s\S]*setBusy\(true\)/, 'האישור לפני ה-POST');
  assert.ok(!/window\.confirm|[^.\w]confirm\(/.test(c), 'לא חלונית הדפדפן');
  assert.match(c, /e\.isTrusted/, 'רק קלט אמיתי של משתמש');
  // חלון האישור מעל החלון הישן של דיווח השגיאות (z-index 999999)
  assert.match(read('app/components/PopupProvider.js'), /\{confirmConfig\.isOpen && \(\s*<div className="modal-backdrop" style=\{\{ position: 'fixed', inset: 0, zIndex: 1000001,/);
});
await t('הדפסה: גם .gm-pvt-spacer מוסתר (pageVariantToggle.css)', () => {
  const css = read('app/components/variant/pageVariantToggle.css');
  assert.match(css, /@media print\{[^}]*\.gm-pvt-spacer[^}]*display:none!important/);
});


console.log('5. השחזור מ-git והתאימות ל-API של היום');
const RESTORED = [
  ['7917382f^', 'app/profile/page.js', 'app/profile/LegacyProfilePage.js'],
  ['079fc226^1', 'app/admin/page.js', 'app/admin/LegacyAdminPage.js'],
  ['079fc226^1', 'app/admin/EmailListCard.js', 'app/admin/EmailListCard.js'],
  ['079fc226^1', 'app/components/menu/AdminHubA5Cards.js', 'app/components/menu/AdminHubA5Cards.js'],
  ['079fc226^1', 'components/FullEmailListModal.js', 'components/FullEmailListModal.js'],
  ['f3b1f771^1', 'app/employees/page.js', 'app/employees/LegacyEmployeesPage.js'],
  ['f3b1f771^1', 'app/employees/report/page.js', 'app/employees/report/LegacyReportPage.js'],
  ['f3b1f771^1', 'app/my-hours/page.js', 'app/my-hours/LegacyMyHoursPage.js'],
  ['c944cb95', 'app/components/ErrorReportButton.js', 'app/components/LegacyErrorReportButton.js'],
  ['c944cb95', 'app/board/page.js', 'app/board/LegacyBoardPage.js'], // הלוח החודשי הישן (feature/board-new-design-2026-10-04)
  ['ea579b00', 'app/orders/new/page.js', 'app/orders/new/LegacyNewOrderPage.js'], // אשף "הזמנה חדשה" הישן כפי ש-main מכיל אותו (כולל תיקוני ה-hotfix של lib/newOrderPayments)
];
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
let gitOk = true;
try { git('cat-file', '-e', 'c944cb95^{commit}'); } catch { gitOk = false; }
// חריגים מתועדים (ביקורת עצמאית 4.10.2026): שני קבצים ישנים נערכו בכוונה, וההבדל מול ה-blob מוגבל בדיוק לתחליפים האלה.
//  - LegacyAdminPage.js: ה-prop showSite (ברירת מחדל false) מסתיר את הכרטיס "ניהול אתר" (/admin/site) - app/admin/site/layout.js מחזיר
//    כל מי שאינו מתכנת ל-/admin, כך שבמסך הישן הכרטיס היה קישור מת להנהלה ראשית. app/admin/page.js מחשב אותו עם אותו שער.
//  - LegacyProfilePage.js: השדה "שם מלא" מוצג לקריאה בלבד ומחושב משם פרטי + שם משפחה - PUT /api/me/profile מתעלם ממנו (fullName נגזר
//    מהשניים מאז 8321f436), והשדה הערוך הציג "נשמר" בלי לשמור.
const RESTORED_EXCEPTIONS = {
  'app/admin/LegacyAdminPage.js': [
    ['export default function AdminHubPage() {', `// showSite: "ניהול אתר" (/admin/site) מיועד למתכנת בלבד (app/admin/site/layout.js מחזיר כל אחר ל-/admin) - הכרטיס מוצג רק כש-app/admin/page.js מאשר את אותו שער.
export default function AdminHubPage({ showSite = false }) {
  const visibleCards = showSite ? cards : cards.filter((card) => card.href !== '/admin/site');`],
    ['{cards.map((card) => (', '{visibleCards.map((card) => ('],
  ],
  // CPU 5.10.2026: קריאת /api/settings בכפתור הישן עברה למטמון המשותף (fetchSharedJson, 5 דק') - בלי זה כל טעינת דף משכה 66KB בשביל דגל אחד.
  'app/components/LegacyErrorReportButton.js': [
    ["import { getHebrewDateString } from '../../lib/hebrewDate';\n", "import { getHebrewDateString } from '../../lib/hebrewDate';\nimport { fetchSharedJson, TTL } from '../../lib/apiCache';\n"],
    ["    fetch('/api/settings')\n      .then(r => r.json())\n      .then(data => {\n        if (!Array.isArray(data)) return;\n        const s = data.find(x => x.key === 'error_report_handled_at_bottom');",
     "    // /api/settings משותף (מטמון apiCache, 5 דק') - לפני כן כל טעינת דף משכה את כל ההגדרות (~66KB) שוב רק בשביל מפתח אחד.\n    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })\n      .then(data => {\n        if (!Array.isArray(data)) return;\n        const s = data.find(x => x.key === 'error_report_handled_at_bottom');"],
  ],
  'app/profile/LegacyProfilePage.js': [
    ['id="profile-fullName" name="fullName" value={profile.fullName || \'\'} onChange={handleChange} autoComplete="new-password" />', 'id="profile-fullName" value={`${profile.firstName || \'\'} ${profile.lastName || \'\'}`.trim()} disabled readOnly />'],
  ],
};
// קבצים ישנים שנערכו בכוונה אחרי השחזור (דיווחי נווה יעקב 5.10.2026 - הגמח עדיין על העיצוב הישן, ותיקונים חייבים לשבת גם בעותק הזה):
//  - LegacyNewOrderPage.js: מתג הסתרת "הערה לתשלום" (hide_order_payment_note), מתג allow_abroad_long_stay_orders (הסתרת לשוניות חו"ל/תפוסה ארוכה),
//    כפתור/חלונית "הוסף משלוח" בשלבים 3-5 עם שורת חיוב המשלוח, "טוען מידות…", בלי גלילה פנימית בסיכום, ושליחת customerCity ל-/api/orders/calculate.
//    + window.open של ההדפסה האוטומטית עם 'noopener' (דיווח 2c827b93, 5.10.2026).
//    במקום השוואה ל-blob בהיסטוריה (שאי אפשר לכוון אליו אחרי העריכה) נעול כאן ה-hash של הקובץ עצמו: כל עריכה נוספת בו מחייבת עדכון מודע של השורה.
const PINNED_BLOBS = {
  // + קיזוז זיכוי פתוח אחרי יצירת הזמנה עם חוב (דיווח 679a860b, מאחורי customer_credit_offset_prompt; כבוי = אפס שינוי)
  'app/orders/new/LegacyNewOrderPage.js': '0835c2c53cc56afbb06544e75b965387caa56323',
};
const norm = (x) => x.replace(/\r\n/g, '\n');
await t('כל קובץ ישן זהה בדיוק ל-blob בהיסטוריה (git hash-object מול git rev-parse <commit>:<path>); חריגים: רק התחליפים המתועדים', () => {
  if (!gitOk) { console.log('         (אין היסטוריית git מלאה - דילוג)'); return; }
  for (const [rev, from, to] of RESTORED) {
    if (PINNED_BLOBS[to]) { assert.equal(git('hash-object', to), PINNED_BLOBS[to], `${to}: הקובץ השתנה מאז הנעילה - עדכנו את PINNED_BLOBS אחרי בדיקה`); continue; }
    const edits = RESTORED_EXCEPTIONS[to];
    if (!edits) { assert.equal(git('hash-object', to), git('rev-parse', `${rev}:${from}`), to); continue; }
    let blob = norm(execFileSync('git', ['show', `${rev}:${from}`], { cwd: ROOT, encoding: 'utf8' }));
    for (const [a, b] of edits) { assert.ok(blob.includes(a), `${to}: חסר בבלוב: ${a.slice(0, 40)}`); blob = blob.replace(a, () => b); }
    assert.equal(norm(read(to)), blob, `${to}: ההבדל מול ה-blob חורג מהתחליפים המתועדים`);
  }
});
await t('לא שוחזר אף מטפל API ישן: נתיבי התאימות בנויים על השערים המוקשחים של היום', () => {
  const att = code(read('app/api/employees/attendance/route.js'));
  assert.match(att, /const viewer = await getAttendanceViewer\(\);/);
  assert.match(att, /decideReadAccess\(\{ isManager: viewer\.isManager, sessionEmployeeId: viewer\.employeeId, scope: 'month' \}\)/);
  assert.ok(!/checkAuth|checkPageAccess|include:|password|pinHash/.test(att), 'לא המטפל הישן / לא כל שורת העובד');
  assert.ok(!/\b(create|update|delete|upsert)\w*\(/.test(att), 'קריאה בלבד');
  const em = code(read('app/api/customers/emails/route.js'));
  assert.match(em, /const me = await getSessionEmployee\(\);[\s\S]*if \(!me\) return[\s\S]*if \(!HEAD_MANAGEMENT_ROLES\.includes\(me\.roleId\)\) return/);
  assert.ok(!/checkAuth/.test(em), 'לא השער הישן (כל עובד מחובר)');
  // החיזוקים של "סיכום נוכחות" לא נגעו: בעלות על כתיבת משמרות, GET /api/attendance להנהלה בלבד
  assert.match(read('app/api/employees/[id]/shifts/route.js'), /authorizeShiftWrite\(/);
  assert.match(read('app/api/employees/[id]/shifts/[shiftId]/route.js'), /authorizeShiftWrite\(/);
  assert.match(read('app/api/attendance/route.js'), /resolveAttendanceManager/);
});
await t('כל כתובת API שהקבצים הישנים קוראים לה קיימת היום', () => {
  const files = RESTORED.map((r) => r[2]);
  const missing = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/['`](\/api\/[A-Za-z0-9/_${}.-]+)/g)) {
      const segs = m[1].replace(/\?.*$/, '').split('/').filter(Boolean);
      let dir = path.join(ROOT, 'app');
      let ok = true;
      for (const seg of segs) {
        if (/\$\{/.test(seg)) {
          const dyn = existsSync(dir) ? readdirDyn(dir) : null;
          if (!dyn) { ok = false; break; }
          dir = path.join(dir, dyn);
        } else { dir = path.join(dir, seg); if (!existsSync(dir)) { ok = false; break; } }
      }
      if (!ok || !existsSync(path.join(dir, 'route.js'))) missing.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});
function readdirDyn(dir) { return readdirSync(dir).find((n) => /^\[[^\]]+\]$/.test(n)) || null; }
await t('הדף הישן של הפרופיל: המתג "רישום אוטומטי" במראה הקודם רק כשהמסך ישן', () => {
  const auto = code(read('app/components/login/AutoClockSwitch.js'));
  assert.match(auto, /const profileVariant = useUiVariant\('profile'\);/);
  assert.match(auto, /if \(profileVariant === 'legacy'\) \{[\s\S]*className="checkbox-row"/);
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
