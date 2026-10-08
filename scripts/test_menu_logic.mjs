// בדיקת יחידה לשכבת הלוגיקה של התפריט החדש (lib/menu/*). לא נוגעת ב-DB ולא ב-DOM.
// הרצה: node scripts/test_menu_logic.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import {
  buildMenuTree as buildMenuTreeRaw, deriveLegacyFlags, findActive, flattenMenuTree, isJsonSafe,
  REMOVED_HREFS, RESTORED_ITEMS, NOT_BUILT_ITEM_IDS, NAV_PAGE_KEYS, MENU_PAGE_KEYS, ITEM_IDS, TAB_IDS, settingsToMap,
  composeAdminItems, applyAdminRecents, matchAdminPoolItem, ADMIN_MENU_MAX_ROWS, ADMIN_MENU_RECENTS, ADMIN_POOL_IDS, ADMIN_FIXED_IDS,
  ADMIN_DEFAULT_IDS, ADMIN_RECENT_TIP, PANEL_ONLY_REMOVED,
} from '../lib/menu/buildMenuTree.js';
import {
  ADMIN_RECENTS_CAP, ADMIN_RECENTS_KEY_PREFIX, adminRecentsKey, recordAdminVisit, adminRecentHrefs, serializeAdminRecents,
  deserializeAdminRecents, readAdminRecents, writeAdminRecents, clearAdminRecentsStorage,
  toggleAdminPin, sanitizeAdminPins, samePins,
} from '../lib/menu/adminRecents.js';
import { sanitizeDesignPrefs, mergeDesignPrefs, splitServerPrefs } from '../lib/designPrefsSchema.js';
import { DESIGN_PREFS_COOKIE_FIELDS, pickCookiePrefs, signDesignPrefsCookie, readDesignPrefsFromCookie } from '../lib/designPrefsSig.js';
import { selectHub, accessForRole } from '../lib/adminHubCatalog.js';
import {
  createNavHistory, visit, back, forward, go, clear, relabel, current, canGoBack, canGoForward,
  previousEntry, nextEntry, position, recentsView, buttonLabels, serializeNavHistory, deserializeNavHistory,
  normalizeNavPath, shouldRecordPath, clearNavHistoryStorage, NAV_HISTORY_CAP, NAV_HISTORY_STORAGE_KEY,
  NAV_HISTORY_MAX_PARSE_ENTRIES, NAV_HISTORY_MAX_RAW_CHARS,
} from '../lib/menu/navHistory.js';
import {
  parseEntityPath, entityHref, defaultLabel, legacyItemToRecent, navEntryToRecent, visitRowToRecent,
  mergeRecents, toLegacyItem, RECENTS_CAP,
} from '../lib/menu/recents.js';
import { buildNavGroups, NAV_GROUPS } from '../app/components/navConfig.js';
import { shiftClockInfo, MAX_PLAUSIBLE_SHIFT_MS } from '../lib/menu/shiftClock.js';
import { hebrewVersionStamp, hebrewDateOfInstant } from '../lib/hebrewStamp.js';
import { SPRITE_SYMBOLS, SPRITE_ID_PREFIX } from '../app/components/menu/spriteSymbols.js';
import { buildModuleText, isSpriteInSync, normalizeEol, SPRITE_OUT } from './build_menu_sprite.mjs';
import { readFileSync } from 'node:fs';

// ברירת המחדל של הבדיקות: דף הבית החדש (a5) פעיל; הצירוף "מעטפת a5 + בית legacy" נבדק במפורש למטה (homeA5:false)
const buildMenuTree = (ctx) => buildMenuTreeRaw({ homeA5: true, ...ctx });

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const rows = (obj) => Object.entries(obj).map(([key, value]) => ({ key, value }));

// --- עוזרים ---------------------------------------------------------------------------------
const HEAD = { id: 'e0', firstName: 'שרה', lastName: 'כהן', roleId: 0, department: { name: 'הנהלה' } };
const BRANCH = { id: 'e1', firstName: 'רחל', lastName: 'לוי', roleId: 1 };
const PROG = { id: 'e2', firstName: 'משה', lastName: 'ה', roleId: 2 };
const STAFF = { id: 'e3', firstName: 'דנה', lastName: 'ב', roleId: 3 };
const ALL_OPEN = Object.fromEntries(NAV_PAGE_KEYS.map((k) => [k, true]));
const ALL_CLOSED = Object.fromEntries(NAV_PAGE_KEYS.map((k) => [k, false]));
const tab = (tree, id) => tree.tabs.find((x) => x.id === id);
const ids = (list) => (list || []).filter((x) => x.kind === 'link' || x.kind === 'action').map((x) => x.id);
const hrefs = (tree) => flattenMenuTree(tree).map((x) => x.href).filter(Boolean);
// כמו hrefs, אבל כולל גם את העמוד הישן של פריט "בית" (match) — השוואת נראות מול navConfig.js נעשית לפיו
const legacyEquivHrefs = (tree) => flattenMenuTree(tree).flatMap((x) => [x.href, x.match]).filter(Boolean);
const legacyHrefsOf = (flags) => buildNavGroups(flags).flatMap((g) => g.items.map((i) => i.href));

console.log('deriveLegacyFlags — אותם כללים כמו app/layout.js');
t('הנהלה ראשית מחוברת: ניהול/עובדים פתוחים, עמודים סגורים לפי ההרשאות', () => {
  const f = deriveLegacyFlags({ logged: true, roleId: 0, permissions: ALL_OPEN, settings: rows({ require_login: 'true' }) });
  assert.equal(f.showAdminTab, true); assert.equal(f.showEmployeesTab, true); assert.equal(f.isHeadManagement, true);
  assert.equal(f.showBoardTab, true); assert.equal(f.showDressesTab, true); assert.equal(f.showRefundsTab, true);
  assert.equal(f.isProgrammer, false);
});
t('הנהלה ראשית בלי הרשאות טעונות (תקלה): עמודים סגורים נופלים ל"הנהלה בלבד" = מוצג', () => {
  const f = deriveLegacyFlags({ logged: true, roleId: 0, permissions: null, settings: [] });
  assert.equal(f.showBoardTab, true); assert.equal(f.showOrders, true); assert.equal(f.showOrdersNew, true);
});
t('מנהלת סניף: ניהול/עובדים סגורים; דגמים/לוח לפי שורת ההרשאה; בלי הרשאות טעונות = סגור', () => {
  const f = deriveLegacyFlags({ logged: true, roleId: 1, permissions: { ...ALL_OPEN, 'page:board': false }, settings: [] });
  assert.equal(f.showAdminTab, false); assert.equal(f.showEmployeesTab, false);
  assert.equal(f.showDressesTab, true); assert.equal(f.showBoardTab, false);
  const g = deriveLegacyFlags({ logged: true, roleId: 1, permissions: null, settings: [] });
  assert.equal(g.showDressesTab, false); assert.equal(g.showBoardTab, false); assert.equal(g.showOrders, true);
});
t('עובדת: הרשאה סגורה מסתירה הזמנה חדשה / השכרות / לקוחות', () => {
  const f = deriveLegacyFlags({ logged: true, roleId: 3, permissions: { ...ALL_OPEN, 'page:orders_new': false, 'page:rentals': false, 'page:customers': false }, settings: [] });
  assert.equal(f.showOrdersNew, false); assert.equal(f.showRentals, false); assert.equal(f.showCustomers, false); assert.equal(f.showOrders, true);
});
t('אורח: הכול לפי require_login (פתוח = רואה גם ניהול, כמו היום)', () => {
  const open = deriveLegacyFlags({ logged: false, settings: rows({ require_login: 'false' }) });
  assert.equal(open.showAdminTab, true); assert.equal(open.showBoardTab, true); assert.equal(open.showOrders, true);
  const closed = deriveLegacyFlags({ logged: false, settings: rows({ require_login: 'true' }) });
  assert.equal(closed.showAdminTab, false); assert.equal(closed.showBoardTab, false); assert.equal(closed.showOrders, true);
});
t('הגדרות: תיקונים/משלוחים/הודעות/דיווח שגיאות; קפדני כמו layout.js — " TRUE " / " True" אינם true', () => {
  const f = deriveLegacyFlags({ logged: true, roleId: 0, permissions: ALL_OPEN, settings: rows({ enable_alterations: 'false', enable_deliveries: 'true', hide_internal_messaging: 'true', hide_error_reporting: 'true' }) });
  assert.equal(f.enableAlterations, false); assert.equal(f.showDeliveries, true); assert.equal(f.showMessages, false); assert.equal(f.hideErrorReporting, true);
  const g = deriveLegacyFlags({ logged: true, roleId: 0, permissions: ALL_OPEN, settings: {} });
  assert.equal(g.enableAlterations, true); assert.equal(g.showDeliveries, false); assert.equal(g.showMessages, true); assert.equal(g.hideErrorReporting, false);
  // layout.js:112-147 בודק `value === 'true'` בדיוק — ערך עם רווח/אות גדולה לא מדליק כלום (ולא מכבה תיקונים).
  const s = deriveLegacyFlags({ logged: true, roleId: 0, permissions: ALL_OPEN, settings: rows({ enable_alterations: ' False', enable_deliveries: ' TRUE ', hide_internal_messaging: 'True', require_login: 'TRUE' }) });
  assert.equal(s.enableAlterations, true); assert.equal(s.showDeliveries, false); assert.equal(s.showMessages, true); assert.equal(s.requireLogin, false);
});
t('roleId כמחרוזת מתקבל; roleId זבל = לא הנהלה', () => {
  assert.equal(deriveLegacyFlags({ logged: true, roleId: '2', settings: [] }).isProgrammer, true);
  assert.equal(deriveLegacyFlags({ logged: true, roleId: 'x', settings: [] }).isHeadManagement, false);
});
t('settingsToMap: מערך / מפה / זבל', () => {
  assert.deepEqual(settingsToMap(rows({ a: '1' })), { a: '1' });
  assert.deepEqual(settingsToMap({ a: '1' }), { a: '1' });
  assert.deepEqual(settingsToMap(null), {}); assert.deepEqual(settingsToMap('x'), {}); assert.deepEqual(settingsToMap([null, 5, { key: 'k', value: 'v' }]), { k: 'v' });
});

console.log('buildMenuTree — לפי תפקיד');
const HEAD_TREE = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ management_messages: 'true', gmach_name: 'גמ״ח שמלות נווה יעקב' }), version: { version: '0.1.434', date: '29/09/2026 12:56' } });
t('הנהלה ראשית: חמש לשוניות (בית, לוז, לוח חודשי, ניהול, הזמנה) — "לוז" אחרי "בית", כמו בעיצוב', () => {
  assert.deepEqual(HEAD_TREE.tabs.map((x) => x.id), ['home', 'sched', 'month', 'admin', 'order']);
  assert.ok(TAB_IDS.includes('sched'));
  const sched = tab(HEAD_TREE, 'sched');
  assert.equal(sched.href, '/schedule'); assert.equal(sched.label, 'לוז'); assert.equal(sched.soon, undefined, 'page:schedule=true → לשונית פעילה');
});
t('הנהלה ראשית: תפריט בית — בלי הכותרת הקטנה "אחרונים"; כל הפריטים פותחים את דף החיפוש הראשי ("/") עם פרמטר (2.10.2026)', () => {
  const home = tab(HEAD_TREE, 'home');
  assert.deepEqual(home.items.map((x) => x.kind === 'link' ? x.id : x.kind === 'heading' ? `h:${x.label}` : x.kind === 'soon' ? `soon:${x.id}` : '-'),
    ['home-search', '-', 'recent-orders', 'recent-customers', 'recent-rentals', 'recent-returns', 'recent-alterations', 'recent-all', 'recent-mine', '-', 'home-adv']);
  assert.equal(home.href, '/');
  assert.ok(!home.items.some((x) => x.kind === 'heading'), 'אין כותרת קבוצה בתפריט בית');
  assert.ok(!home.items.some((x) => x.kind === 'soon'), '"שינויים אחרונים" ו"חיפוש מתקדם" כבר לא "בקרוב"');
  const byId = Object.fromEntries(home.items.filter((x) => x.kind === 'link').map((x) => [x.id, x]));
  assert.deepEqual(Object.fromEntries(Object.entries(byId).map(([k, v]) => [k, v.href])), {
    'home-search': '/', 'recent-orders': '/?scope=orders', 'recent-customers': '/?scope=customers', 'recent-rentals': '/?scope=rentals',
    'recent-returns': '/?scope=returns', 'recent-alterations': '/?scope=alterations', 'recent-all': '/?recent=changes', 'recent-mine': '/?recent=mine', 'home-adv': '/?adv=1',
  });
  assert.deepEqual(['recent-orders', 'recent-customers', 'recent-rentals', 'recent-returns', 'recent-alterations'].map((k) => byId[k].label), ['הזמנות', 'לקוחות', 'השכרות', 'החזרות', 'תיקונים']);
  assert.equal(byId['recent-all'].label, 'שינויים אחרונים'); assert.equal(byId['home-adv'].label, 'חיפוש מתקדם');
  assert.equal(byId['recent-mine'].label, 'השינויים שלי'); assert.equal(byId['recent-mine'].icon, 'pencil');
  // הפריט נשאר "נוכח" גם בעמוד הישן של הקטגוריה (match), כדי שההדגשה לא תיעלם בעמוד /orders וכו'
  assert.deepEqual(Object.fromEntries(['recent-orders', 'recent-customers', 'recent-rentals', 'recent-returns', 'recent-alterations'].map((k) => [k, byId[k].match])),
    { 'recent-orders': '/orders', 'recent-customers': '/customers', 'recent-rentals': '/rentals#rented', 'recent-returns': '/rentals#returned', 'recent-alterations': '/alterations' });
});
t('הנהלה ראשית: פאנל "ניהול" מקוצר (4.10.2026) — בלי אחרונים: עובדים, הרשאות, ניהול מחירון | הגדרות מערכת, כל כלי הניהול; השאר במאגר', () => {
  const admin = tab(HEAD_TREE, 'admin');
  assert.deepEqual(ids(admin.items), ['ad-staff', 'ad-perms', 'ad-pricelist', 'ad-settings', 'ad-all']);
  assert.equal(admin.items.filter((x) => x.kind === 'separator').length, 1);
  assert.equal(admin.items[3].kind, 'separator', 'המפריד לפני השורות הקבועות');
  assert.equal(admin.href, '/admin');
  const by = Object.fromEntries(admin.items.filter((x) => x.id).map((x) => [x.id, x]));
  assert.deepEqual([by['ad-settings'].label, by['ad-settings'].href], ['הגדרות מערכת', '/admin/settings']);
  assert.deepEqual([by['ad-all'].label, by['ad-all'].href, by['ad-all'].icon], ['כל כלי הניהול', '/admin', admin.icon]);
  // מה שיצא מהפאנל נשאר במאגר (חיפוש בתפריט, הדגשת הלשונית, מועמד ל"אחרונים") עם אותם יעדים
  const pool = Object.fromEntries(admin.pool.map((x) => [x.id, x]));
  assert.deepEqual(Object.keys(pool), ['ad-models', 'ad-staff', 'finance', 'ad-refunds', 'ad-nwd', 'ad-perms', 'ad-pricelist', 'ad-stats', 'ad-info']);
  assert.equal(pool.finance.href, '/dashboard'); assert.equal(pool['ad-refunds'].href, '/refunds');
  assert.deepEqual(ids(admin.fixed), ['ad-settings', 'ad-all']);
  const neve = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ enable_deliveries: 'true' }) });
  assert.deepEqual(ids(tab(neve, 'admin').items), ['ad-staff', 'ad-perms', 'ad-pricelist', 'ad-settings', 'ad-all']);
  assert.equal(tab(neve, 'admin').pool.find((x) => x.id === 'ad-deliveries').href, '/deliveries');
});
t('הנהלה ראשית: תפריט הזמנה בלי משלוחים (הם תחת "ניהול", לא כאן) ובלי בדיקת מלאי (לא קיים)', () => {
  assert.deepEqual(ids(tab(HEAD_TREE, 'order').items), ['order-new', 'order-kiosk']);
  assert.equal(tab(HEAD_TREE, 'order').href, '/orders/new');
  const neve = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ enable_deliveries: 'true' }) });
  assert.deepEqual(ids(tab(neve, 'order').items), ['order-new', 'order-kiosk']);
});
t('הנהלה ראשית: פאנל משתמש בלי "הודעות" (R08), בלי ריענון (R03), בלי ערכת נושא (R04); בלי היסטוריית הודעות (לא מתכנת)', () => {
  assert.deepEqual(ids(HEAD_TREE.user.items), ['u-profile', 'u-punch', 'u-hours', 'u-logout']);
  assert.equal(HEAD_TREE.user.items.filter((x) => x.kind === 'separator').length, 1);
  assert.equal(HEAD_TREE.user.name, 'שרה כהן'); assert.equal(HEAD_TREE.user.initials, 'שכ'); assert.equal(HEAD_TREE.user.roleLabel, 'הנהלה ראשית'); assert.equal(HEAD_TREE.user.department, 'הנהלה');
});
t('הנהלה ראשית: פעמון עם "סמן הכל כנקרא"/"ניקוי", "פתח מרכז הודעות" ו"הודעה למנהל" (ההגדרה פעילה)', () => {
  const bell = HEAD_TREE.rail.bell;
  assert.equal(bell.show, true); assert.deepEqual(bell.tools, { markAllRead: true, clearAll: true });
  assert.deepEqual(ids(bell.rows), ['n-center', 'n-manager-message']);
  assert.equal(bell.rows[0].href, '/messages'); assert.equal(bell.rows[1].action, 'message-to-manager');
});
t('הנהלה ראשית: סרגל צד — חיפוש, דיווח שגיאה, "האתר הישן" זמני, שעון משמרת; ברקוד ברצף כבוי', () => {
  const r = HEAD_TREE.rail;
  assert.equal(r.search.show, true); assert.equal(r.search.barcodeScan, false);
  assert.equal(r.errorReport.show, true);
  assert.deepEqual(r.oldSite, { show: true, temporary: true, action: 'switch-to-legacy-shell', label: 'האתר הישן', badge: 'זמני' });
  assert.equal(r.shiftClock.show, true);
});
t('מותג: לוגו מ-/api/logo, שם מההגדרות, גרסה בטולטיפ', () => {
  assert.equal(HEAD_TREE.brand.logoUrl, '/api/logo'); assert.equal(HEAD_TREE.brand.name, 'גמ״ח שמלות נווה יעקב');
  assert.equal(HEAD_TREE.brand.tooltip, 'גירסא 0.1.434 | יח תשרי תשפ"ז, 12:56', 'תאריך הגרסה עברי בלבד (בלי תאריך לועזי)'); assert.equal(HEAD_TREE.brand.hasLogoSetting, false);
  const withLogo = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ BRAND_LOGO: 'data:image/png;base64,AAAA' }) });
  assert.equal(withLogo.brand.hasLogoSetting, true); assert.equal(withLogo.brand.name, 'גמ"ח שמלות'); assert.equal(withLogo.brand.tooltip, '');
});

const PROG_TREE = buildMenuTree({ user: PROG, permissions: ALL_OPEN, settings: [] });
t('מתכנת: כמו הנהלה + "היסטוריית הודעות מערכת" בפאנל המשתמש (R05)', () => {
  assert.deepEqual(PROG_TREE.tabs.map((x) => x.id), ['home', 'sched', 'month', 'admin', 'order']);
  assert.deepEqual(ids(PROG_TREE.user.items), ['u-profile', 'u-punch', 'u-hours', 'u-hist', 'u-logout']);
  assert.equal(PROG_TREE.user.items.find((x) => x.id === 'u-hist').action, 'system-messages-history');
  assert.equal(PROG_TREE.meta.prog, true);
});
t('תפריט "ניהול": קיצורים ניהול אתר / הרשאות / ניהול מחירון (החלטת הבעלים 4.10.2026) — ניהול אתר למתכנת בלבד', () => {
  const prog = tab(PROG_TREE, 'admin');
  assert.deepEqual(ids(prog.items), ['ad-staff', 'ad-perms', 'ad-pricelist', 'ad-settings', 'ad-all']);
  assert.deepEqual(prog.pool.map((x) => x.id), ['ad-models', 'ad-staff', 'finance', 'ad-refunds', 'ad-nwd', 'ad-site', 'ad-perms', 'ad-pricelist', 'ad-stats', 'ad-info']);
  const by = Object.fromEntries(prog.pool.map((x) => [x.id, x]));
  assert.deepEqual([by['ad-site'].label, by['ad-site'].href], ['ניהול אתר', '/admin/site']);
  assert.deepEqual([by['ad-perms'].label, by['ad-perms'].href], ['הרשאות', '/admin/permissions']);
  assert.deepEqual([by['ad-pricelist'].label, by['ad-pricelist'].href], ['ניהול מחירון', '/dashboard/pricelist']);
  assert.ok(!hrefs(HEAD_TREE).includes('/admin/site'), 'הנהלה ראשית לא רואה את "ניהול אתר"');
  assert.ok(hrefs(HEAD_TREE).includes('/admin/permissions') && hrefs(HEAD_TREE).includes('/dashboard/pricelist'));
  const branch = buildMenuTree({ user: BRANCH, permissions: ALL_OPEN, settings: [] });
  for (const h of ['/admin/site', '/admin/permissions', '/dashboard/pricelist']) assert.ok(!hrefs(branch).includes(h), 'מנהלת סניף: ' + h);
  const anon = buildMenuTree({ user: null, settings: rows({ require_login: 'false' }) });
  assert.ok(!hrefs(anon).includes('/admin/site'), 'אורח לא רואה את "ניהול אתר" (gate prog דורש מחובר)');
  assert.deepEqual(findActive(PROG_TREE, '/admin/permissions'), { tabId: 'admin', itemId: 'ad-perms' });
  assert.deepEqual(findActive(PROG_TREE, '/admin/site'), { tabId: 'admin', itemId: 'ad-site' });
});

t('מנהלת סניף עם הרשאת דגמים: "ניהול" מוצג עם דגמים (וזיכויים כשיש הרשאה), בלי href לדף הניהול (D10)', () => {
  const tree = buildMenuTree({ user: BRANCH, permissions: { ...ALL_OPEN, 'page:refunds': false }, settings: [] });
  const admin = tab(tree, 'admin');
  assert.ok(admin); assert.deepEqual(ids(admin.items), ['ad-models', 'ad-nwd']); assert.equal(admin.href, null); assert.equal(admin.opensMenuOnly, true);
  assert.ok(!hrefs(tree).includes('/employees')); assert.ok(!hrefs(tree).includes('/dashboard')); assert.ok(!hrefs(tree).includes('/admin/settings'));
  const withRefunds = buildMenuTree({ user: BRANCH, permissions: { ...ALL_OPEN }, settings: [] });
  assert.deepEqual(ids(tab(withRefunds, 'admin').items), ['ad-models', 'ad-refunds', 'ad-nwd']); assert.equal(tab(withRefunds, 'admin').href, null);
});
t('מנהלת סניף בלי הרשאת דגמים/זיכויים/משלוחים: "ניהול" עם "ימי אי-פעילות" בלבד (NW-I9); עם זיכויים בלבד — זיכויים + ימי אי-פעילות', () => {
  const tree = buildMenuTree({ user: BRANCH, permissions: { ...ALL_OPEN, 'page:dresses_catalog': false, 'page:refunds': false }, settings: [] });
  assert.deepEqual(ids(tab(tree, 'admin').items), ['ad-nwd']); assert.equal(tab(tree, 'admin').href, null); assert.equal(tab(tree, 'admin').opensMenuOnly, true);
  // משלוחים מותרים בהרשאה אבל ההגדרה כבויה (הגמ"ח הראשי) → עדיין רק "ימי אי-פעילות"
  assert.deepEqual(ids(tab(buildMenuTree({ user: BRANCH, permissions: { ...ALL_OPEN, 'page:dresses_catalog': false, 'page:refunds': false, 'page:deliveries': true }, settings: [] }), 'admin').items), ['ad-nwd']);
  const refundsOnly = buildMenuTree({ user: BRANCH, permissions: { ...ALL_CLOSED, 'page:refunds': true }, settings: [] });
  assert.deepEqual(ids(tab(refundsOnly, 'admin').items), ['ad-refunds', 'ad-nwd']); assert.equal(tab(refundsOnly, 'admin').href, null); assert.equal(tab(refundsOnly, 'admin').opensMenuOnly, true);
  // נווה יעקב: משלוחים מופעלים + הרשאת משלוחים → "ניהול" עם משלוחים בלבד
  const deliveriesOnly = buildMenuTree({ user: BRANCH, permissions: { ...ALL_CLOSED, 'page:deliveries': true }, settings: rows({ enable_deliveries: 'true' }) });
  assert.deepEqual(ids(tab(deliveriesOnly, 'admin').items), ['ad-deliveries', 'ad-nwd']); assert.equal(tab(deliveriesOnly, 'admin').href, null);
});
t('עובדת בלי הרשאות (הכול סגור): רק בית (חיפוש כללי) והזמנה (עמדת לקוח); אין לוח חודשי', () => {
  const tree = buildMenuTree({ user: STAFF, permissions: ALL_CLOSED, settings: [] });
  // + "ניהול" עם "ימי אי-פעילות" בלבד (NW-I9: הפריט מוצג לכל עובד מחובר, צפייה בלבד)
  assert.deepEqual(tree.tabs.map((x) => x.id), ['home', 'sched', 'admin', 'order']);
  assert.deepEqual(ids(tab(tree, 'admin').items), ['ad-nwd']);
  // "שינויים אחרונים" (האחרונים של העובדת, מקומי) מוצג לכולן; "חיפוש מתקדם" רק כשמותר לפחות תחום אחד (אין כאן — הכול סגור)
  assert.deepEqual(ids(tab(tree, 'home').items), ['home-search', 'recent-all']); // בלי page:orders אין "השינויים שלי" (אותה הרשאה של דף ההזמנות)
  assert.ok(!tab(tree, 'home').items.some((x) => x.kind === 'soon' || x.kind === 'heading'));
  assert.equal(tab(tree, 'sched').soon, true, 'אין page:schedule → "לוז" בקרוב');
  assert.deepEqual(ids(tab(tree, 'order').items), ['order-kiosk']);
  assert.equal(tab(tree, 'order').href, null); // אין הרשאה להזמנה חדשה → הלשונית רק פותחת תפריט
});
t('עובדת עם הרשאות עמוד פתוחות: בית מלא, לוח לפי page:board, "ניהול" רק עם דגמים/זיכויים (D10: לפי ההרשאה לכל שורה)', () => {
  const tree = buildMenuTree({ user: STAFF, permissions: ALL_OPEN, settings: [] });
  assert.deepEqual(tree.tabs.map((x) => x.id), ['home', 'sched', 'month', 'admin', 'order']);
  assert.deepEqual(ids(tab(tree, 'admin').items), ['ad-models', 'ad-refunds', 'ad-nwd']); assert.equal(tab(tree, 'admin').href, null);
  assert.deepEqual(ids(tab(tree, 'order').items), ['order-new', 'order-kiosk']);
  const noDresses = buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:dresses_catalog': false, 'page:refunds': false }, settings: [] });
  assert.deepEqual(noDresses.tabs.map((x) => x.id), ['home', 'sched', 'month', 'admin', 'order']);
  assert.deepEqual(ids(tab(noDresses, 'admin').items), ['ad-nwd']);
});
t('"ימי אי-פעילות" (NWD-Q01 + NW-I9): בניהול אחרי "הגדרות", לכל עובד מחובר (צפייה בלבד למי שאין לו הרשאת עריכה); אורח לא רואה; אין featureKey', () => {
  const NWD = 'feature:non_working_days_manage';
  // התפריט המקוצר (4.10.2026): הפריט במאגר הלשונית (ומועמד ל"אחרונים"), לא שורה קבועה בפאנל; אריח במסך /admin
  const item = tab(HEAD_TREE, 'admin').pool.find((x) => x.id === 'ad-nwd');
  assert.deepEqual([item.label, item.href, item.icon], ['ימי אי-פעילות', '/non-working-days', 'lock']);
  assert.deepEqual(findActive(HEAD_TREE, '/non-working-days'), { tabId: 'admin', itemId: 'ad-nwd' });
  // הנהלה ראשית: גם כשההרשאות לא נטענו
  assert.ok(ids(tab(buildMenuTree({ user: HEAD, permissions: null, settings: [] }), 'admin').pool).includes('ad-nwd'));
  // מנהלת סניף / עובדת: הפריט מוצג בלי תלות בהרשאה feature:non_working_days_manage (גם כשההרשאות לא נטענו או סגורות) -
  // "ניהול" נפתח אצלן רק כתפריט (בלי href), עם הפריט הזה בלבד
  for (const user of [BRANCH, STAFF]) {
    for (const permissions of [null, ALL_OPEN, ALL_CLOSED, { ...ALL_CLOSED, [NWD]: false }, { ...ALL_CLOSED, [NWD]: true }]) {
      const adm = tab(buildMenuTree({ user, permissions, settings: [] }), 'admin');
      assert.ok(ids(adm.items).includes('ad-nwd'), 'הפריט מוצג');
      assert.equal(adm.href, null); assert.equal(adm.opensMenuOnly, true);
    }
    for (const permissions of [null, ALL_CLOSED, { ...ALL_CLOSED, [NWD]: false }, { ...ALL_CLOSED, [NWD]: true }]) {
      assert.deepEqual(ids(tab(buildMenuTree({ user, permissions, settings: [] }), 'admin').items), ['ad-nwd'], 'בלי הרשאות עמוד - הפריט היחיד בניהול');
    }
  }
  // אין עוד featureKey בעץ, ולא מפתחות feature נוספים שנטענים לתפריט
  assert.doesNotMatch(readFileSync(new URL('../lib/menu/buildMenuTree.js', import.meta.url), 'utf8'), /MENU_FEATURE_KEYS/, 'MENU_FEATURE_KEYS הוסר');
  assert.doesNotMatch(readFileSync(new URL('../lib/menu/buildMenuTree.js', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, ''), /featureKey/);
  // אורח כשההתחברות חובה: אין "ניהול" בכלל
  assert.equal(tab(buildMenuTree({ user: null, permissions: null, settings: rows({ require_login: 'true' }) }), 'admin'), undefined);
  // app/layout.js טוען רק את NAV_PAGE_KEYS ל-resolvePageAccess
  const LAYOUT = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.match(LAYOUT, /resolvePageAccess\(emp\.roleId, authToken\.value, NAV_PAGE_KEYS\)/);
  assert.doesNotMatch(LAYOUT, /MENU_FEATURE_KEYS/);
  // אותו מפתח הרשאה (עריכה) כמו ב-lib/businessDays.js (NON_WORKING_DAYS_PERMISSION_KEY) ובקטלוג ההרשאות
  assert.match(readFileSync(new URL('../lib/businessDays.js', import.meta.url), 'utf8'), /NON_WORKING_DAYS_PERMISSION_KEY = 'feature:non_working_days_manage'/);
});
t('עובדת: הודעות פנימיות מוסתרות (hide_internal_messaging) → הפעמון נשאר (לא קשור להודעות), בלי "הודעה למנהל", ופאנל המשתמש לא משתנה', () => {
  const tree = buildMenuTree({ user: STAFF, permissions: ALL_OPEN, settings: rows({ hide_internal_messaging: 'true', management_messages: 'true' }) });
  assert.equal(tree.rail.bell.show, true);
  assert.deepEqual(tree.rail.bell.tools, { markAllRead: true, clearAll: true });
  assert.ok(!ids(tree.rail.bell.rows).includes('n-manager-message'), 'הודעה למנהל נשארת תלויה ב-msgs');
  assert.deepEqual(ids(tree.user.items), ['u-profile', 'u-punch', 'u-hours', 'u-logout']);
  // גם הנהלה ראשית: פעמון קיים, "הודעה למנהל" מוסתרת כשההודעות הפנימיות מוסתרות
  const head = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ hide_internal_messaging: 'true', management_messages: 'true' }) });
  assert.equal(head.rail.bell.show, true); assert.deepEqual(ids(head.rail.bell.rows), [], 'MS-08: גם "פתח מרכז הודעות" מוסתרת כשההודעות הפנימיות מוסתרות');
  // עם הודעות פנימיות פעילות ו-management_messages — השורה חוזרת
  const on = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ hide_internal_messaging: 'false', management_messages: 'true' }) });
  assert.deepEqual(ids(on.rail.bell.rows), ['n-center', 'n-manager-message']);
});
t('אורח (לא מחובר): אין פעמון, גם כשהודעות פנימיות פעילות', () => {
  const g = buildMenuTree({ user: null, permissions: ALL_OPEN, settings: rows({ hide_internal_messaging: 'false', management_messages: 'true' }) });
  assert.deepEqual(g.rail.bell, { show: false });
});
t('"הודעה למנהל" מופיע רק כשההגדרה management_messages פעילה (השרת מסרב אחרת); " True" = לא פעילה', () => {
  const off = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [] });
  assert.deepEqual(ids(off.rail.bell.rows), ['n-center']);
  const on = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ management_messages: 'true' }) });
  assert.deepEqual(ids(on.rail.bell.rows), ['n-center', 'n-manager-message']);
  // api/notifications/route.js:140 בודק `setting.value === 'true'` — ערך ' True' מקבל 403, אז השורה לא מוצגת.
  const sloppy = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ management_messages: ' True' }) });
  assert.deepEqual(ids(sloppy.rail.bell.rows), ['n-center']);
});
t('"פתח מרכז הודעות" — כשל-סגור: עובדת רואה רק כש-page:messages נטען ואומר true', () => {
  assert.deepEqual([...MENU_PAGE_KEYS], ['page:messages', 'page:schedule']); assert.ok(NAV_PAGE_KEYS.includes('page:messages'));
  const withPerm = buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:messages': true }, settings: [] });
  assert.deepEqual(ids(withPerm.rail.bell.rows), ['n-center']);
  const closed = buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:messages': false }, settings: [] });
  assert.deepEqual(ids(closed.rail.bell.rows), []);
  // המפתח לא נטען (כמו layout.js:202 היום, שחסר בו page:messages) → מוסתר
  const { 'page:messages': _omit, ...withoutKey } = ALL_OPEN;
  const missing = buildMenuTree({ user: STAFF, permissions: withoutKey, settings: [] });
  assert.deepEqual(ids(missing.rail.bell.rows), []);
  const missingBranch = buildMenuTree({ user: BRANCH, permissions: withoutKey, settings: [] });
  assert.deepEqual(ids(missingBranch.rail.bell.rows), []);
  // permissions=null (תקלת טעינה) → מוסתר לעובדת
  const unknown = buildMenuTree({ user: STAFF, permissions: null, settings: [] });
  assert.deepEqual(ids(unknown.rail.bell.rows), []);
  // ערך שאינו true בדיוק (למשל 'yes') → מוסתר
  const truthy = buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:messages': 'yes' }, settings: [] });
  assert.deepEqual(ids(truthy.rail.bell.rows), []);
  // הנהלה ראשית / מתכנת: resolvePageAccess מחזיר להם true תמיד, אז בלי מידע — מוצג
  assert.deepEqual(ids(buildMenuTree({ user: HEAD, permissions: withoutKey, settings: [] }).rail.bell.rows), ['n-center']);
  assert.deepEqual(ids(buildMenuTree({ user: PROG, permissions: null, settings: [] }).rail.bell.rows), ['n-center']);
  // אבל שורת הרשאה מפורשת false מסתירה גם להנהלה (כמו היום בעמוד עצמו)
  assert.deepEqual(ids(buildMenuTree({ user: HEAD, permissions: { ...ALL_OPEN, 'page:messages': false }, settings: [] }).rail.bell.rows), []);
});
t('דיווח שגיאות מוסתר לפי hide_error_reporting', () => {
  const tree = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ hide_error_reporting: 'true' }) });
  assert.equal(tree.rail.errorReport.show, false);
});
t('תיקונים נעלמים כש-enable_alterations=false או כשההרשאה סגורה', () => {
  const a = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ enable_alterations: 'false' }) });
  assert.ok(!ids(tab(a, 'home').items).includes('recent-alterations'));
  const b = buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:alterations': false }, settings: [] });
  assert.ok(!ids(tab(b, 'home').items).includes('recent-alterations'));
});

console.log('buildMenuTree — אורח');
t('אורח במצב פתוח (require_login כבוי): כל הלשוניות כמו הנהלה, פאנל משתמש = "היכנס למערכת" בלבד (כמו בעיצוב), בלי פעמון/שעון/האתר הישן', () => {
  const tree = buildMenuTree({ user: null, settings: rows({ require_login: 'false', management_messages: 'true' }) });
  assert.deepEqual(tree.tabs.map((x) => x.id), ['home', 'sched', 'month', 'admin', 'order']);
  // זיכויים: במצב פתוח התפריט הישן מציג /refunds לאורח (showRefundsTab = !requireLogin) → גם כאן
  // 'ad-nwd' (ימי אי-פעילות) הוא logged: true (NW-I9) ולכן אורח במצב פתוח לא רואה אותו
  assert.deepEqual(ids(tab(tree, 'admin').items), ['ad-staff', 'ad-perms', 'ad-pricelist', 'ad-settings', 'ad-all']);
  assert.deepEqual(tab(tree, 'admin').pool.map((x) => x.id), ['ad-models', 'ad-staff', 'finance', 'ad-refunds', 'ad-perms', 'ad-pricelist', 'ad-stats', 'ad-info']);
  assert.ok(!ids(tab(tree, 'home').items).includes('sched'), 'לוז למחוברים בלבד');
  assert.equal(tree.user.logged, false); assert.equal(tree.user.name, 'אורח'); assert.equal(tree.user.initials, 'א');
  assert.deepEqual(ids(tree.user.items), ['u-login']);
  assert.ok(!hrefs(tree).includes('/display-settings'), 'אורח לא רואה "עיצוב ותצוגה"');
  assert.ok(!ids(HEAD_TREE.user.items).includes('u-display'), '"עיצוב ותצוגה" הוסר מתפריט הפרופיל (בקשת הבעלים 4.10.2026)');
  assert.deepEqual(tree.rail.bell, { show: false }); assert.equal(tree.rail.shiftClock.show, false); assert.deepEqual(tree.rail.oldSite, { show: false });
  assert.equal(tree.rail.errorReport.show, true);
});
t('אורח כשההתחברות חובה: אין ניהול/לוח; העמודים הפתוחים נשארים (המסך עצמו ננעל ע"י ה-layout)', () => {
  const tree = buildMenuTree({ user: null, settings: rows({ require_login: 'true' }) });
  assert.deepEqual(tree.tabs.map((x) => x.id), ['home', 'sched', 'order']);
  assert.equal(tree.meta.requireLogin, true);
});

console.log('buildMenuTree — עקביות עם התפריט הישן (navConfig.js)');
const CASES = [
  ['הנהלה', { user: HEAD, permissions: ALL_OPEN }], ['מנהלת סניף', { user: BRANCH, permissions: ALL_OPEN }],
  ['עובדת פתוח', { user: STAFF, permissions: ALL_OPEN }], ['עובדת סגור', { user: STAFF, permissions: ALL_CLOSED }],
  ['אורח פתוח', { user: null, settings: rows({ require_login: 'false' }) }], ['אורח סגור', { user: null, settings: rows({ require_login: 'true' }) }],
  ['מנהלת בלי הרשאות טעונות', { user: BRANCH, permissions: null }],
];
t('כל href שקיים בתפריט הישן מופיע בעץ החדש אם ורק אם הישן מציג אותו (חוץ מהפריטים שהוסרו)', () => {
  for (const [name, ctx] of CASES) {
    const settings = ctx.settings || rows({ enable_deliveries: 'true' });
    const logged = !!ctx.user;
    const flags = deriveLegacyFlags({ logged, roleId: ctx.user ? ctx.user.roleId : null, permissions: ctx.permissions, settings });
    const legacy = new Set(legacyHrefsOf(flags));
    const tree = buildMenuTree({ ...ctx, settings });
    const mine = new Set(legacyEquivHrefs(tree));
    for (const h of legacy) {
      if (REMOVED_HREFS.includes(h)) { assert.ok(!mine.has(h), `${name}: ${h} הוסר ולא אמור להופיע`); continue; }
      assert.ok(mine.has(h), `${name}: ${h} מוצג בישן אבל חסר בחדש`);
    }
    for (const h of NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href))) {
      if (!legacy.has(h)) assert.ok(!mine.has(h), `${name}: ${h} מוסתר בישן אבל מוצג בחדש`);
    }
  }
});
t('מעטפת a5 + דף בית legacy (דגלים עצמאיים): אין קישורי ?scope/?adv/?recent — חוזרים ל-href הישנים, ושורות "שינויים אחרונים"/"חיפוש מתקדם" "בקרוב" כמו קודם', () => {
  const legacyHome = (ctx) => buildMenuTreeRaw({ ...ctx, homeA5: false });
  for (const [name, ctx] of CASES) {
    const settings = ctx.settings || rows({ enable_deliveries: 'true' });
    const lt = legacyHome({ ...ctx, settings });
    const nt = buildMenuTree({ ...ctx, settings });
    // (קישורי "היום"/"מחר" של הלוז (/schedule?date=) אינם תלויים בדף הבית - הדף עצמו קורא את הפרמטר)
    assert.ok(!flattenMenuTree(lt).some((x) => x.href && x.href.includes('?') && !x.href.startsWith('/schedule?')), `${name}: אין href עם query`);
    // אותן שורות בדיוק (נראות זהה); רק ה-href וסוג שתי השורות החדשות משתנים
    assert.deepEqual(ids(tab(lt, 'home').items).filter((i) => !['recent-all', 'recent-mine', 'home-adv'].includes(i)), ids(tab(nt, 'home').items).filter((i) => !['recent-all', 'recent-mine', 'home-adv'].includes(i)), name);
    if (tab(lt, 'home')) assert.ok(!tab(lt, 'home').items.some((x) => x.kind === 'heading'));
  }
  const lt = legacyHome({ user: HEAD, permissions: ALL_OPEN, settings: [] });
  const home = tab(lt, 'home');
  assert.deepEqual(Object.fromEntries(home.items.filter((x) => x.kind === 'link').map((x) => [x.id, x.href])),
    { 'home-search': '/', 'recent-orders': '/orders', 'recent-customers': '/customers', 'recent-rentals': '/rentals#rented', 'recent-returns': '/rentals#returned', 'recent-alterations': '/alterations' });
  assert.deepEqual(home.items.filter((x) => x.kind === 'soon').map((x) => x.id), ['recent-all', 'recent-mine', 'home-adv']);
  for (const x of home.items.filter((i) => i.kind === 'soon')) { assert.equal(x.href, undefined); assert.equal(x.action, undefined); }
  assert.ok(!home.items.some((x) => 'match' in x), 'בלי match כשהקישור הוא הדף הישן עצמו');
  // ברירת מחדל (בלי הדגל) = בטוח: קישורים ישנים
  assert.deepEqual(hrefs(buildMenuTreeRaw({ user: HEAD, permissions: ALL_OPEN, settings: [] })).filter((h) => h.includes('?') && !h.startsWith('/schedule?')), []);
  // עם הדגל — הקישורים החדשים; ולא משפיע על נראות
  assert.ok(hrefs(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [] })).includes('/?scope=customers'));
  assert.equal(isJsonSafe(lt), true);
});
t('הפריטים שהוסרו (R11 — מ-4.10 רק דוח הנוכחות) לעולם לא בעץ; /deliveries ו-/refunds (1.10) וקיצורי מסך הניהול (4.10) כבר לא ברשימת ההסרה', () => {
  const tree = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ enable_deliveries: 'true' }) });
  const all = hrefs(tree);
  for (const h of REMOVED_HREFS) assert.ok(!all.includes(h), h);
  assert.ok(!REMOVED_HREFS.includes('/deliveries')); assert.ok(!REMOVED_HREFS.includes('/refunds'));
  assert.deepEqual([...REMOVED_HREFS], ['/employees/report']);
  assert.deepEqual(RESTORED_ITEMS.R09.id, 'ad-deliveries'); assert.deepEqual(RESTORED_ITEMS.R09.href, '/deliveries');
  assert.deepEqual(RESTORED_ITEMS.R10.id, 'ad-refunds'); assert.deepEqual(RESTORED_ITEMS.R10.href, '/refunds');
  for (const r of Object.values(RESTORED_ITEMS)) assert.ok(ITEM_IDS.includes(r.id), r.id);
  // בישן הם מוצגים — ועכשיו גם בחדש, באותם תנאים
  const flags = deriveLegacyFlags({ logged: true, roleId: 0, permissions: ALL_OPEN, settings: rows({ enable_deliveries: 'true' }) });
  const legacy = legacyHrefsOf(flags);
  assert.ok(legacy.includes('/deliveries')); assert.ok(legacy.includes('/refunds'));
  assert.ok(all.includes('/deliveries')); assert.ok(all.includes('/refunds'));
});
t('משלוחים (ad-deliveries): רק כש-enable_deliveries===\'true\' וגם page:deliveries — ותמיד תחת "ניהול"', () => {
  const where = (tree) => flattenMenuTree(tree).find((x) => x.id === 'ad-deliveries')?.group;
  // הגמ"ח הראשי: ההגדרה כבויה → אין שורה, גם להנהלה עם כל ההרשאות
  assert.equal(where(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [] })), undefined);
  assert.equal(where(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ enable_deliveries: 'false' }) })), undefined);
  assert.equal(where(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ enable_deliveries: ' TRUE ' }) })), undefined, 'קפדני כמו layout.js');
  // נווה יעקב: ההגדרה דלוקה → לפי page:deliveries
  const on = rows({ enable_deliveries: 'true' });
  assert.equal(where(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: on })), 'ניהול');
  assert.equal(where(buildMenuTree({ user: STAFF, permissions: ALL_OPEN, settings: on })), 'ניהול');
  assert.equal(where(buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:deliveries': false }, settings: on })), undefined);
  // בלי הרשאות טעונות: עמוד "פתוח" בישן (pageVisible → true) — אותו דבר כאן
  assert.equal(where(buildMenuTree({ user: STAFF, permissions: null, settings: on })), 'ניהול');
  // אורח במצב פתוח — כמו הישן (showDeliveries לא תלוי בהתחברות)
  assert.equal(where(buildMenuTree({ user: null, settings: rows({ enable_deliveries: 'true', require_login: 'false' }) })), 'ניהול');
  // לעולם לא תחת "הזמנה" או "בית"
  const neve = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: on });
  assert.ok(!ids(tab(neve, 'order').items).includes('ad-deliveries')); assert.ok(!ids(tab(neve, 'home').items).includes('ad-deliveries'));
});
t('זיכויים וחובות (ad-refunds): לפי page:refunds בלבד — תחת "ניהול"; שורת false מסתירה גם להנהלה', () => {
  const where = (tree) => flattenMenuTree(tree).find((x) => x.id === 'ad-refunds')?.group;
  assert.equal(where(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [] })), 'ניהול');
  assert.equal(where(buildMenuTree({ user: STAFF, permissions: { ...ALL_CLOSED, 'page:refunds': true }, settings: [] })), 'ניהול');
  assert.equal(where(buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:refunds': false }, settings: [] })), undefined);
  assert.equal(where(buildMenuTree({ user: HEAD, permissions: { ...ALL_OPEN, 'page:refunds': false }, settings: [] })), undefined);
  // עמוד "סגור" (ברירת מחדל הנהלה בלבד): בלי הרשאות טעונות — הנהלה כן, עובדת לא (כמו showRefundsTab ב-layout.js)
  assert.equal(where(buildMenuTree({ user: HEAD, permissions: null, settings: [] })), 'ניהול');
  assert.equal(where(buildMenuTree({ user: STAFF, permissions: null, settings: [] })), undefined);
  assert.equal(where(buildMenuTree({ user: null, settings: rows({ require_login: 'true' }) })), undefined);
  assert.equal(flattenMenuTree(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [] })).find((x) => x.id === 'ad-refunds').href, '/refunds');
});
t('"לוז" (sched): לשונית אחרי "בית" → /schedule רק כש-page:schedule נטען ואומר true (גם להנהלה, strict); בכל מצב אחר "בקרוב" בלי קישור', () => {
  assert.ok(!NOT_BUILT_ITEM_IDS.includes('sched')); assert.ok(NAV_PAGE_KEYS.includes('page:schedule')); assert.ok(MENU_PAGE_KEYS.includes('page:schedule'));
  const sched = (tree) => tab(tree, 'sched');
  const live = (tree) => { const t0 = sched(tree); return !!t0 && t0.href === '/schedule' && !t0.soon; };
  const soon = (tree) => { const t0 = sched(tree); return !!t0 && t0.soon === true && t0.href === null && Array.isArray(t0.items) && t0.items.length === 0; };
  const staff = buildMenuTree({ user: STAFF, permissions: { ...ALL_CLOSED, 'page:schedule': true }, settings: [] });
  assert.ok(live(staff)); assert.equal(sched(staff).label, 'לוז'); assert.deepEqual(staff.tabs.map((x) => x.id), ['home', 'sched', 'admin', 'order']);
  assert.ok(soon(buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:schedule': false }, settings: [] })));
  assert.ok(soon(buildMenuTree({ user: HEAD, permissions: { ...ALL_OPEN, 'page:schedule': false }, settings: [] })), 'שורת false מסתירה (בקרוב) גם להנהלה');
  // המפתח לא נטען / permissions=null: "בקרוב" לכולם, כולל הנהלה ראשית ומתכנת (הדף אולי עוד לא בפריסה)
  const { 'page:schedule': _omit, ...withoutKey } = ALL_OPEN;
  for (const u of [STAFF, BRANCH, HEAD, PROG]) {
    assert.ok(soon(buildMenuTree({ user: u, permissions: withoutKey, settings: [] })), `${u.id} בלי המפתח`);
    assert.ok(soon(buildMenuTree({ user: u, permissions: null, settings: [] })), `${u.id} permissions=null`);
  }
  assert.ok(soon(buildMenuTree({ user: HEAD, permissions: { ...ALL_OPEN, 'page:schedule': 'yes' }, settings: [] })), 'רק true בדיוק');
  // אורח: תמיד "בקרוב" (גם במצב פתוח) - לא קישור
  assert.ok(soon(buildMenuTree({ user: null, settings: rows({ require_login: 'false' }) })));
  assert.ok(soon(buildMenuTree({ user: null, settings: rows({ require_login: 'true' }) })));
  // "בקרוב" לעולם לא נכנס לרשימת יעדי הניווט (חיפוש בתפריט / כרטיסי /admin) ואינו מסומן כנוכחי
  for (const t0 of [HEAD_TREE, buildMenuTree({ user: HEAD, permissions: null, settings: [] }), buildMenuTree({ user: null, settings: [] })]) {
    const flat = flattenMenuTree(t0);
    for (const tb of t0.tabs.filter((x) => x.soon)) assert.ok(!flat.some((x) => x.id === tb.id), 'לשונית soon לא ב-flatten');
    for (const tb of t0.tabs) for (const it of tb.items) if (it.kind === 'soon') assert.ok(!flat.some((x) => x.id === it.id), 'שורת soon לא ב-flatten');
  }
  assert.deepEqual(findActive(buildMenuTree({ user: HEAD, permissions: null, settings: [] }), '/schedule'), { tabId: null, itemId: null }, 'לשונית בקרוב לא מסומנת');
  // "פתח מרכז הודעות" לא השתנה: הנהלה בלי המפתח עדיין רואה (fail-closed רק לשאר) — ההקשחה היא ל-sched בלבד
  assert.deepEqual(ids(buildMenuTree({ user: HEAD, permissions: withoutKey, settings: [] }).rail.bell.rows), ['n-center']);
  // סימון העמוד הנוכחי כשהלשונית פעילה
  assert.deepEqual(findActive(HEAD_TREE, '/schedule'), { tabId: 'sched', itemId: null });
  assert.deepEqual(findActive(HEAD_TREE, '/schedule?date=2026-01-02'), { tabId: 'sched', itemId: null }, 'תאריך שאינו היום/מחר: הלשונית בלבד');
  assert.deepEqual(findActive(staff, '/schedule/'), { tabId: 'sched', itemId: null });
});
t('"לוז": תפריט הריחוף "היום" / "מחר" (תפריט-חדש.html, SCH-S01) - קישורים ל-/schedule?date= לפי שעון ישראל, לא לאורח ולא כשהלשונית "בקרוב"', () => {
  const live = buildMenuTree({ user: STAFF, permissions: { ...ALL_CLOSED, 'page:schedule': true }, settings: [], todayKey: '2026-10-04' });
  const items = tab(live, 'sched').items;
  // הקישורים הם מילות יחס (today/tomorrow) שהדף מפענח לפי שעון ישראל של השרת - לא תאריך שחושב פעם אחת ב-layout
  // ומתיישן אחרי חצות (סקירה 2.10, C). match = התאריך המוחלט של רגע הבנייה, רק להדגשה כשהכתובת היא ISO.
  assert.deepEqual(items.map((x) => [x.kind, x.id, x.label, x.icon, x.href, x.match]), [
    ['link', 'sched-today', 'היום', 'cal', '/schedule?date=today', '/schedule?date=2026-10-04'],
    ['link', 'sched-tomorrow', 'מחר', 'arrl', '/schedule?date=tomorrow', '/schedule?date=2026-10-05'],
  ]);
  // מעבר חודש/שנה בחשבון לוח-שנה טהור (ב-match)
  assert.equal(tab(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [], todayKey: '2026-12-31' }), 'sched').items[1].match, '/schedule?date=2027-01-01');
  // בלי todayKey: היום לפי שעון ישראל (YYYY-MM-DD), לא Invalid Date; ה-href לא תלוי בתאריך בכלל
  const auto = tab(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [] }), 'sched').items;
  assert.equal(auto[0].href, '/schedule?date=today'); assert.equal(auto[1].href, '/schedule?date=tomorrow');
  assert.match(auto[0].match, /^\/schedule\?date=\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(auto[0].match, auto[1].match);
  // todayKey לא תקין מתעלמים ממנו
  assert.match(tab(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [], todayKey: 'מחר' }), 'sched').items[0].match, /^\/schedule\?date=\d{4}-\d{2}-\d{2}$/);
  // "בקרוב": בלי שורות; אורח: בלי לשונית פעילה
  assert.deepEqual(tab(buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:schedule': false }, settings: [] }), 'sched').items, []);
  assert.deepEqual(tab(buildMenuTree({ user: null, settings: rows({ require_login: 'false' }) }), 'sched').items, []);
  // סימון הנוכחי: מילת היחס מסמנת את השורה שלה; גם התאריך המוחלט של היום/מחר (דרך match); תאריך אחר - רק את הלשונית
  assert.deepEqual(findActive(live, '/schedule', '', 'date=today'), { tabId: 'sched', itemId: 'sched-today' });
  assert.deepEqual(findActive(live, '/schedule', '', '?date=tomorrow'), { tabId: 'sched', itemId: 'sched-tomorrow' });
  assert.deepEqual(findActive(live, '/schedule', '', 'date=2026-10-04'), { tabId: 'sched', itemId: 'sched-today' });
  assert.deepEqual(findActive(live, '/schedule', '', '?date=2026-10-05'), { tabId: 'sched', itemId: 'sched-tomorrow' });
  assert.deepEqual(findActive(live, '/schedule', '', 'date=2026-10-06'), { tabId: 'sched', itemId: null });
  assert.deepEqual(findActive(live, '/schedule'), { tabId: 'sched', itemId: null });
  // יעדי ניווט (חיפוש בתפריט) כוללים את שתי השורות; JSON נקי
  assert.ok(flattenMenuTree(live).some((x) => x.id === 'sched-today') && flattenMenuTree(live).some((x) => x.id === 'sched-tomorrow'));
  assert.ok(isJsonSafe(live));
  assert.ok(ITEM_IDS.includes('sched-today') && ITEM_IDS.includes('sched-tomorrow'));
});
t('NAV_PAGE_KEYS: מכיל את 9 המפתחות שהיו ב-app/layout.js + page:messages + page:schedule (ה-layout מייבא מכאן)', () => {
  const legacyLayoutKeys = ['page:refunds', 'page:dresses_catalog', 'page:board', 'page:orders', 'page:orders_new', 'page:rentals', 'page:customers', 'page:deliveries', 'page:alterations'];
  for (const k of legacyLayoutKeys) assert.ok(NAV_PAGE_KEYS.includes(k), k);
  assert.deepEqual([...NAV_PAGE_KEYS].filter((k) => !legacyLayoutKeys.includes(k)), ['page:messages', 'page:schedule']);
  assert.equal(new Set(NAV_PAGE_KEYS).size, NAV_PAGE_KEYS.length);
});
t('פריטים "עדיין לא קיימים": שורה כבויה "בקרוב" (kind:soon, בלי href/action), ורגילים רק עם available[id]=true', () => {
  const tabsOf = (tree) => tree.tabs.flatMap((x) => x.items);
  const soonIds = (tree) => tabsOf(tree).filter((x) => x.kind === 'soon').map((x) => x.id);
  assert.deepEqual(soonIds(HEAD_TREE).sort(), [...NOT_BUILT_ITEM_IDS].sort());
  const all = flattenMenuTree(HEAD_TREE).map((x) => x.id);
  for (const id of NOT_BUILT_ITEM_IDS) assert.ok(!all.includes(id), `${id} לא יעד ניווט`);
  for (const x of tabsOf(HEAD_TREE).filter((i) => i.kind === 'soon')) { assert.ok(!('href' in x) && !('action' in x), x.id); assert.ok(x.label && x.icon); }
  assert.deepEqual(tab(HEAD_TREE, 'order').items.map((x) => `${x.kind}:${x.id}`), ['link:order-new', 'link:order-kiosk', 'soon:order-stock']);
  const withStock = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [], available: { 'order-stock': true, 'recent-all': true, 'home-adv': true } });
  assert.deepEqual(ids(tab(withStock, 'order').items), ['order-new', 'order-kiosk', 'order-stock']);
  // בדיקת מלאי (2.10.2026): עם available - קישור אמיתי ל-/stock-check; הנראות לפי page:orders (GQ-06a), כמו "הזמנות"
  const stockRow = tab(withStock, 'order').items.find((x) => x.id === 'order-stock');
  assert.deepEqual([stockRow.kind, stockRow.href, stockRow.icon], ['link', '/stock-check', 'sn-inv']);
  assert.deepEqual(findActive(withStock, '/stock-check'), { tabId: 'order', itemId: 'order-stock' });
  const noOrders = buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:orders': false }, settings: [], available: { 'order-stock': true } });
  assert.deepEqual(ids(tab(noOrders, 'order').items), ['order-kiosk'], 'בלי page:orders אין בדיקת מלאי (ולא הזמנה חדשה) - נשארת רק עמדת לקוח');
  const noNew = buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:orders_new': false }, settings: [], available: { 'order-stock': true } });
  assert.deepEqual(ids(tab(noNew, 'order').items), ['order-kiosk', 'order-stock'], 'page:orders בלי page:orders_new: בדיקת מלאי כן, הזמנה חדשה לא');
  assert.deepEqual(withStock.tabs.map((x) => x.id), ['home', 'sched', 'month', 'admin', 'order']);
  assert.ok(ids(tab(withStock, 'home').items).includes('recent-all')); assert.ok(ids(tab(withStock, 'home').items).includes('home-adv'));
  assert.ok(ids(tab(withStock, 'home').items).includes('recent-mine'));
  assert.deepEqual(soonIds(withStock), []);
  // available לא יכול "להדליק" את לוז — הוא נשלט רק ע"י page:schedule
  const forced = buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:schedule': false }, settings: [], available: { sched: true } });
  assert.equal(tab(forced, 'sched').soon, true);
});
t('"השינויים שלי" (recent-mine): אחרי "שינויים אחרונים", לפי הרשאת page:orders בלבד (כמו דף ההזמנות); בלי דף בית חדש — "בקרוב"', () => {
  const homeIds = (tree) => ids(tab(tree, 'home').items);
  const open = homeIds(buildMenuTree({ user: STAFF, permissions: ALL_OPEN, settings: [], homeA5: true }));
  assert.equal(open.indexOf('recent-mine'), open.indexOf('recent-all') + 1, 'מיד אחרי recent-all');
  const noOrders = buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:orders': false }, settings: [], homeA5: true });
  assert.ok(!homeIds(noOrders).includes('recent-mine'), 'בלי page:orders השורה לא מוצגת');
  assert.ok(homeIds(noOrders).includes('recent-all'), '"שינויים אחרונים" (מקומי) כן');
  const legacyOpen = buildMenuTreeRaw({ user: STAFF, permissions: ALL_OPEN, settings: [], homeA5: false });
  const row = tab(legacyOpen, 'home').items.find((x) => x.id === 'recent-mine');
  assert.equal(row.kind, 'soon'); assert.equal(row.href, undefined);
  const noOrdersLegacy = buildMenuTreeRaw({ user: STAFF, permissions: { ...ALL_OPEN, 'page:orders': false }, settings: [], homeA5: false });
  assert.ok(!tab(noOrdersLegacy, 'home').items.some((x) => x.id === 'recent-mine'));
  assert.equal(tab(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [], homeA5: true }), 'home').items.find((x) => x.id === 'recent-mine').href, '/?recent=mine');
});
t('"חיפוש מתקדם" (home-adv): מוצג רק כשמותר לפחות תחום אחד שהחיפוש יכול לעבוד עליו; "שינויים אחרונים" תמיד', () => {
  assert.ok(!NOT_BUILT_ITEM_IDS.includes('recent-all') && !NOT_BUILT_ITEM_IDS.includes('home-adv'));
  assert.deepEqual([...NOT_BUILT_ITEM_IDS], ['order-stock']);
  assert.ok(ids(tab(HEAD_TREE, 'home').items).includes('home-adv'));
  const onlyCustomers = buildMenuTree({ user: STAFF, permissions: { ...ALL_CLOSED, 'page:customers': true }, settings: [] });
  assert.ok(ids(tab(onlyCustomers, 'home').items).includes('home-adv'));
  const none = buildMenuTree({ user: STAFF, permissions: ALL_CLOSED, settings: [] });
  assert.ok(!ids(tab(none, 'home').items).includes('home-adv')); assert.ok(ids(tab(none, 'home').items).includes('recent-all'));
  // קטגוריות לפי אותה הרשאה בדיוק כמו קודם (legacy לא השתנה): בלי page:customers אין "לקוחות"
  const noCust = buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:customers': false }, settings: [] });
  assert.ok(!ids(tab(noCust, 'home').items).includes('recent-customers')); assert.ok(ids(tab(noCust, 'home').items).includes('recent-orders'));
});
t('דגלים מה-layout (flags) גוברים על הנגזרים: showBoardTab=false מסתיר לוח חודשי גם להנהלה; undefined לא דורס', () => {
  const tree = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [], flags: { showBoardTab: false } });
  assert.equal(tab(tree, 'month'), undefined);
  const u = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ hide_internal_messaging: 'true' }), flags: { hideInternalMessaging: undefined, showBoardTab: undefined } });
  assert.equal(u.rail.bell.show, true); assert.ok(!ids(u.rail.bell.rows).includes('n-manager-message')); assert.ok(!ids(u.rail.bell.rows).includes('n-center')); assert.ok(tab(u, 'month'));
});
t('חוזה a5Shell.flags מ-app/layout.js: עם flags בלבד (בלי settings/permissions) העץ מציג משלוחים/זיכויים/לוח בדיוק לפי הדגלים', () => {
  // אותו אובייקט שה-layout בונה (legacyNavFlags + 6 הנוספים) — אם buildMenuTree יתחיל לקרוא דגל חדש, הבדיקה הזאת תיפול.
  const layoutFlags = {
    showAdminTab: false, showEmployeesTab: false, showRefundsTab: true, showDressesTab: false, showBoardTab: true,
    enableAlterations: true, showMessages: true, showDeliveries: true, showOrdersNew: true, showOrders: true, showRentals: true, showCustomers: true,
    isHeadManagement: false, isProgrammer: false, hideInternalMessaging: false, hideErrorReporting: false, requireLogin: true, isAuthenticated: true,
  };
  const tree = buildMenuTree({ user: STAFF, permissions: { 'page:schedule': true }, flags: layoutFlags, settings: { management_messages: 'true', gmach_name: 'נווה' } });
  assert.deepEqual(tree.tabs.map((x) => x.id), ['home', 'sched', 'month', 'admin', 'order']);
  assert.deepEqual(ids(tab(tree, 'admin').items), ['ad-refunds', 'ad-deliveries', 'ad-nwd']); assert.equal(tab(tree, 'admin').href, null);
  assert.equal(tab(tree, 'sched').href, '/schedule'); assert.ok(ids(tab(tree, 'home').items).includes('recent-alterations'));
  assert.deepEqual(ids(tree.rail.bell.rows), ['n-manager-message'], 'page:messages לא נטען → מרכז הודעות מוסתר לעובדת; הודעה למנהל לפי ההגדרה');
  assert.equal(tree.rail.errorReport.show, true); assert.equal(tree.brand.name, 'נווה');
  const off = buildMenuTree({ user: STAFF, permissions: {}, flags: { ...layoutFlags, showDeliveries: false, showRefundsTab: false, showBoardTab: false, hideErrorReporting: true }, settings: {} });
  assert.deepEqual(off.tabs.map((x) => x.id), ['home', 'sched', 'admin', 'order']); assert.equal(off.rail.errorReport.show, false);
  // הדגלים שהעץ קורא — כולם ברשימה (אם deriveLegacyFlags יחזיר מפתח חדש, ה-layout צריך להעביר גם אותו)
  assert.deepEqual(Object.keys(deriveLegacyFlags({ logged: true, roleId: 3, permissions: {}, settings: [] })).sort(), Object.keys(layoutFlags).sort());
});
t('העץ הוא JSON נקי (בלי פונקציות) — ניתן לשלוח מהשרת ללקוח', () => {
  for (const [, ctx] of CASES) assert.equal(isJsonSafe(buildMenuTree(ctx)), true);
  assert.equal(JSON.stringify(HEAD_TREE).includes('function'), false);
});
t('קלט זבל לא זורק', () => {
  for (const bad of [undefined, null, {}, { user: 'x' }, { user: { id: 'a', roleId: 'zzz' }, settings: 'x', permissions: 'y', flags: 5 }]) {
    const tree = buildMenuTree(bad);
    assert.ok(Array.isArray(tree.tabs)); assert.ok(tree.user);
  }
});
t('כל מזהי הפריטים והלשוניות ייחודיים', () => {
  assert.equal(new Set(ITEM_IDS).size, ITEM_IDS.length); assert.equal(new Set(TAB_IDS).size, TAB_IDS.length);
});

console.log('findActive — סימון העמוד הנוכחי');
t('כללי isActive של AppShell: "/" רק מדויק, אחרת תחילית, הארוך ביותר מנצח, hash חייב להתאים', () => {
  assert.deepEqual(findActive(HEAD_TREE, '/'), { tabId: 'home', itemId: 'home-search' });
  assert.deepEqual(findActive(HEAD_TREE, '/orders/52103'), { tabId: 'home', itemId: 'recent-orders' });
  assert.deepEqual(findActive(HEAD_TREE, '/orders/new'), { tabId: 'order', itemId: 'order-new' });
  assert.deepEqual(findActive(HEAD_TREE, '/rentals', '#returned'), { tabId: 'home', itemId: 'recent-returns' });
  assert.deepEqual(findActive(HEAD_TREE, '/rentals', 'rented'), { tabId: 'home', itemId: 'recent-rentals' });
  assert.deepEqual(findActive(HEAD_TREE, '/rentals'), { tabId: null, itemId: null });
  assert.deepEqual(findActive(HEAD_TREE, '/board/'), { tabId: 'month', itemId: null });
  assert.deepEqual(findActive(HEAD_TREE, '/admin/settings?x=1'), { tabId: 'admin', itemId: 'ad-settings' });
  assert.deepEqual(findActive(HEAD_TREE, '/admin/permissions'), { tabId: 'admin', itemId: 'ad-perms' });
  assert.deepEqual(findActive(HEAD_TREE, '/admin/barcode-invalid'), { tabId: 'admin', itemId: null });
  assert.deepEqual(findActive(HEAD_TREE, '/dashboard/dresses/5'), { tabId: 'admin', itemId: 'ad-models' });
  assert.deepEqual(findActive(HEAD_TREE, '/customers/abc'), { tabId: 'home', itemId: 'recent-customers' });
  assert.deepEqual(findActive(HEAD_TREE, '/profile'), { tabId: null, itemId: null });
  assert.deepEqual(findActive(null, '/orders'), { tabId: null, itemId: null });
  // פריטי בית עם פרמטר (2.10.2026): הכתובת "/" עם ?scope / ?adv / ?recent מסמנת את הפריט המתאים; בלי פרמטר — "חיפוש כללי"
  assert.deepEqual(findActive(HEAD_TREE, '/', '', '?scope=customers'), { tabId: 'home', itemId: 'recent-customers' });
  assert.deepEqual(findActive(HEAD_TREE, '/', '', 'scope=orders'), { tabId: 'home', itemId: 'recent-orders' });
  assert.deepEqual(findActive(HEAD_TREE, '/', '', 'scope=returns'), { tabId: 'home', itemId: 'recent-returns' });
  assert.deepEqual(findActive(HEAD_TREE, '/', '', '?adv=1'), { tabId: 'home', itemId: 'home-adv' });
  assert.deepEqual(findActive(HEAD_TREE, '/', '', '?recent=changes'), { tabId: 'home', itemId: 'recent-all' });
  assert.deepEqual(findActive(HEAD_TREE, '/', '', '?recent=mine'), { tabId: 'home', itemId: 'recent-mine' });
  assert.deepEqual(findActive(HEAD_TREE, '/', '', ''), { tabId: 'home', itemId: 'home-search' });
  assert.deepEqual(findActive(HEAD_TREE, '/', '', '?q=כהן'), { tabId: 'home', itemId: 'home-search' }, 'פרמטר לא מוכר = חיפוש כללי');
  assert.deepEqual(findActive(HEAD_TREE, '/', '', '?scope=evil'), { tabId: 'home', itemId: 'home-search' }, 'ערך לא מוכר לא מסמן שום פריט');
  assert.deepEqual(findActive(HEAD_TREE, '/', '', '?scope=customers&x=1'), { tabId: 'home', itemId: 'recent-customers' });
  assert.deepEqual(findActive(HEAD_TREE, '/orders/5', '', '?scope=customers'), { tabId: 'home', itemId: 'recent-orders' }, 'פרמטר לא משפיע מחוץ ל-"/"');
});

console.log('navHistory — כללי דפדפן');
const V = (s, path, label, now) => visit(s, { path, label }, { now });
t('נרמול נתיבים', () => {
  assert.equal(normalizeNavPath('/orders/'), '/orders'); assert.equal(normalizeNavPath('orders'), '/orders');
  assert.equal(normalizeNavPath('https://x.y/board?m=1#top'), '/board?m=1#top'); assert.equal(normalizeNavPath('/rentals#rented'), '/rentals#rented');
  assert.equal(normalizeNavPath('//a//b/'), '/a/b'); assert.equal(normalizeNavPath('/'), '/'); assert.equal(normalizeNavPath(''), ''); assert.equal(normalizeNavPath(5), '');
  assert.equal(normalizeNavPath('/x?'), '/x'); assert.equal(normalizeNavPath('/x#'), '/x');
});
t('הקשחה: "/\\evil.com", "//evil.com", "\\\\evil.com" הופכים לנתיב פנימי (לא open redirect)', () => {
  assert.equal(normalizeNavPath('/\\evil.com'), '/evil.com'); assert.equal(normalizeNavPath('//evil.com/x'), '/evil.com/x');
  assert.equal(normalizeNavPath('\\\\evil.com'), '/evil.com'); assert.equal(normalizeNavPath('/\\/evil.com?a=1#h'), '/evil.com?a=1#h');
  assert.equal(normalizeNavPath('/a\\b'), '/a/b');
  for (const p of ['/\\evil.com', '//evil.com', '\\\\evil.com']) assert.ok(!/^\/[\\/]/.test(normalizeNavPath(p)), p);
  let s = createNavHistory(); s = visit(s, { path: '/\\evil.com', label: 'x' }); assert.equal(current(s).path, '/evil.com');
});
const SITE = 'https://gemach.example';
const resolvedOrigin = (p) => new URL(p, SITE).origin;
t('הקשחה: תווי בקרה (Tab / LF / CR / \\u2028 / NUL / BOM) באמצע הנתיב — הנתיב נדחה כולו', () => {
  // דפדפן מסיר את התווים האלה לפני הפענוח: '/\t/evil.com' הופך ל-//evil.com = אתר חיצוני. אומת מול new URL.
  assert.equal(resolvedOrigin('/\t/evil.com'), 'https://evil.com', 'הנחת הבדיקה: URL מסיר Tab');
  for (const p of ['/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '/\r\n/evil.com', '/\u2028/evil.com', '/\u2029/evil.com',
    '/orders\u0000', '/\u0001orders', '/orders/\u007f', '/\ufeff/evil.com', '/or\tders', '/x?q=\n1', '/x#a\tb', '/x\r?q=1']) {
    assert.equal(normalizeNavPath(p), '', JSON.stringify(p));
    assert.equal(shouldRecordPath(p), false, JSON.stringify(p));
  }
  // תווים כאלה בקצוות נחתכים (trim) כמו קודם — '\t//evil.com' נשאר נתיב פנימי, '/x?q=\n' הוא '/x?q='
  assert.equal(normalizeNavPath('\t//evil.com'), '/evil.com'); assert.equal(normalizeNavPath('  /orders \n'), '/orders');
  assert.equal(normalizeNavPath('/x?q=\n'), '/x?q='); assert.equal(normalizeNavPath('\t/x#\t'), '/x');
  // visit / deserialize לא רושמים נתיב כזה
  let s = createNavHistory(); s = visit(s, { path: '/\t/evil.com', label: 'x' }); assert.equal(s.list.length, 0);
  const raw = JSON.stringify({ v: 1, cur: 1, list: [{ path: '/orders', label: 'a' }, { path: '/\t/evil.com', label: 'b' }] });
  const d = deserializeNavHistory(raw); assert.deepEqual(d.list.map((e) => e.path), ['/orders']); assert.equal(d.cur, 0);
});
t('הקשחה: %09 מקודד הוא נתיב רגיל (נשאר באותו origin) — מותר בכוונה', () => {
  assert.equal(normalizeNavPath('/%09/evil.com'), '/%09/evil.com'); assert.equal(resolvedOrigin('/%09/evil.com'), SITE);
  assert.equal(normalizeNavPath('/%0a/evil.com'), '/%0a/evil.com'); assert.equal(normalizeNavPath('/%2F%2Fevil.com'), '/%2F%2Fevil.com');
  assert.equal(resolvedOrigin('/%2F%2Fevil.com'), SITE);
});
t('הקשחה: סכימות (javascript: / data: / https:evil) נדחות; https://host/path מפושט לנתיב', () => {
  for (const p of ['javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.c',
    'https:evil.com', 'https:/evil.com', 'vbscript:x', 'blob:https://evil.com/x']) {
    assert.equal(normalizeNavPath(p), '', p);
  }
  assert.equal(normalizeNavPath('https://evil.com'), '/'); assert.equal(normalizeNavPath('javascript://evil/%0aalert(1)'), '/%0aalert(1)');
  assert.equal(normalizeNavPath('/javascript:alert(1)'), '/javascript:alert(1)'); // נתיב פנימי, לא סכימה
  assert.equal(resolvedOrigin('/javascript:alert(1)'), SITE);
});
t('הקשחה: כל פלט לא-ריק מתפענח לאותו origin (רשת ביטחון) — גם לוכסנים הפוכים, //, @, query ו-hash', () => {
  const inputs = ['//evil.com', '/\\evil.com', '\\\\evil.com', '/\\\\evil.com', '////evil.com', '/\\/\\evil.com', '//evil.com:443/x',
    '/@evil.com', '//user:pw@evil.com/x', '/x?u=//evil.com', '/x#//evil.com', '/x?u=https://evil.com', '/לקוחות/12', '/orders 1',
    '/ /evil.com', '/orders/52103', '/rentals#rented', '/board?m=1#top', 'https://x.y/board'];
  for (const p of inputs) {
    const out = normalizeNavPath(p);
    assert.ok(out === '' || resolvedOrigin(out) === SITE, `${JSON.stringify(p)} -> ${JSON.stringify(out)}`);
  }
  assert.equal(normalizeNavPath('//user:pw@evil.com/x'), '/user:pw@evil.com/x'); // נתיב פנימי, בלי credentials
  assert.equal(new URL(normalizeNavPath('//user:pw@evil.com/x'), SITE).username, '');
  assert.equal(normalizeNavPath('/x?u=//evil.com'), '/x?u=//evil.com'); assert.equal(normalizeNavPath('/לקוחות/12'), '/לקוחות/12');
});
t('מה נרשם: לא API, לא _next, לא קיוסק / שעון / הדפסה', () => {
  for (const p of ['/', '/orders/1', '/board', '/rentals#rented', '/admin/settings']) assert.equal(shouldRecordPath(p), true, p);
  for (const p of ['/api/me', '/api', '/_next/x', '/customer-interface', '/punch-clock', '/print/order?id=1', '/dashboard/dresses/1/print', '', null]) assert.equal(shouldRecordPath(p), false, String(p));
});
t('ביקורים: 3 ביקורים → אחורה ×2 → קדימה', () => {
  let s = createNavHistory();
  assert.equal(current(s), null); assert.equal(canGoBack(s), false); assert.equal(canGoForward(s), false);
  s = V(s, '/', 'בית', 1); s = V(s, '/orders', 'הזמנות', 2); s = V(s, '/board', 'לוח חודשי', 3);
  assert.deepEqual(s.list.map((e) => e.key), ['/', '/orders', '/board']); assert.equal(s.cur, 2);
  assert.deepEqual(position(s), { index: 3, total: 3 });
  s = back(s); assert.equal(current(s).key, '/orders'); s = back(s); assert.equal(current(s).key, '/');
  assert.equal(canGoBack(s), false); assert.equal(back(s), s, 'בקצה מחזיר את אותו מצב');
  s = forward(s); assert.equal(current(s).key, '/orders'); assert.equal(canGoForward(s), true);
  assert.equal(previousEntry(s).label, 'בית'); assert.equal(nextEntry(s).label, 'לוח חודשי');
});
t('ביקור חדש אחרי אחורה מוחק את "קדימה"', () => {
  let s = createNavHistory();
  s = V(s, '/', 'בית', 1); s = V(s, '/orders', 'הזמנות', 2); s = V(s, '/board', 'לוח', 3);
  s = back(s); s = back(s);
  s = V(s, '/customers', 'לקוחות', 4);
  assert.deepEqual(s.list.map((e) => e.key), ['/', '/customers']); assert.equal(s.cur, 1); assert.equal(canGoForward(s), false);
});
t('כפילות: כניסה חוזרת לעמוד שברשימה מעבירה אותו לראש בלי להכפיל', () => {
  let s = createNavHistory();
  s = V(s, '/', 'בית', 1); s = V(s, '/orders', 'הזמנות', 2); s = V(s, '/board', 'לוח', 3);
  s = V(s, '/', 'בית', 4);
  assert.deepEqual(s.list.map((e) => e.key), ['/orders', '/board', '/']); assert.equal(s.cur, 2);
  assert.equal(s.list[2].ts, 4);
});
t('ביקור בעמוד הנוכחי = לא-כלום (אותו אובייקט)', () => {
  let s = createNavHistory(); s = V(s, '/orders', 'הזמנות', 1);
  assert.equal(V(s, '/orders/', 'הזמנות', 2), s); assert.equal(visit(s, null), s); assert.equal(visit(s, ''), s);
});
t('גבול: מעל התקרה הישנה ביותר נופלת; cur נשאר על האחרון', () => {
  let s = createNavHistory();
  for (let i = 1; i <= NAV_HISTORY_CAP + 3; i++) s = V(s, `/p${i}`, `עמוד ${i}`, i);
  assert.equal(s.list.length, NAV_HISTORY_CAP); assert.equal(s.list[0].key, '/p4'); assert.equal(current(s).key, `/p${NAV_HISTORY_CAP + 3}`);
  let c = createNavHistory(); for (let i = 1; i <= 5; i++) c = visit(c, { path: `/q${i}` }, { cap: 3 });
  assert.deepEqual(c.list.map((e) => e.key), ['/q3', '/q4', '/q5']);
});
t('נקה משאיר רק את הנוכחי; אחורה/קדימה כבויים', () => {
  let s = createNavHistory();
  s = V(s, '/', 'בית', 1); s = V(s, '/orders', 'הזמנות', 2); s = V(s, '/board', 'לוח', 3); s = back(s);
  s = clear(s);
  assert.deepEqual(s.list.map((e) => e.key), ['/orders']); assert.equal(s.cur, 0);
  assert.equal(canGoBack(s), false); assert.equal(canGoForward(s), false);
  assert.equal(clear(s), s); assert.deepEqual(clear(createNavHistory()), { list: [], cur: -1 });
});
t('קפיצה לשורה (go): לא רושמת ביקור, גבולות, אותו אינדקס = אותו מצב', () => {
  let s = createNavHistory();
  s = V(s, '/', 'בית', 1); s = V(s, '/orders', 'הזמנות', 2); s = V(s, '/board', 'לוח', 3);
  const g = go(s, 0); assert.equal(current(g).key, '/'); assert.equal(g.list, s.list); assert.equal(canGoForward(g), true);
  assert.equal(go(s, 2), s); assert.equal(go(s, 3), s); assert.equal(go(s, -1), s); assert.equal(go(s, 1.5), s); assert.equal(go(s, '1'), s);
});
t('recentsView: החדש למעלה, "עכשיו" ו"קדימה" מסומנים, index אמיתי ל-go', () => {
  let s = createNavHistory();
  s = V(s, '/', 'בית', 1); s = V(s, '/orders', 'הזמנות', 2); s = V(s, '/board', 'לוח', 3); s = back(s);
  const v = recentsView(s);
  assert.deepEqual(v.map((x) => [x.key, x.index, x.isCurrent, x.isForward]), [['/board', 2, false, true], ['/orders', 1, true, false], ['/', 0, false, false]]);
  assert.deepEqual(recentsView(null), []);
});
t('תוויות הכפתורים: שם העמוד הבא/הקודם, מושבת בקצוות, "עמוד 2 מתוך 3"', () => {
  let s = createNavHistory();
  s = V(s, '/', 'בית', 1); s = V(s, '/orders', 'הזמנות', 2); s = V(s, '/board', 'לוח חודשי', 3); s = back(s);
  const b = buttonLabels(s);
  assert.equal(b.back, 'אחורה: בית'); assert.equal(b.forward, 'קדימה: לוח חודשי'); assert.equal(b.backDisabled, false); assert.equal(b.positionText, 'עמוד 2 מתוך 3');
  const e = buttonLabels(createNavHistory());
  assert.equal(e.backDisabled, true); assert.equal(e.forwardDisabled, true); assert.equal(e.back, 'אחורה (אין עמוד קודם)'); assert.equal(e.positionText, '');
});
t('relabel: מעדכן תווית בלי לשנות סדר; מפתח לא קיים / בלי שינוי = אותו מצב', () => {
  let s = createNavHistory(); s = V(s, '/orders/5', '/orders/5', 1); s = V(s, '/', 'בית', 2);
  const r = relabel(s, '/orders/5', { label: 'הזמנה #5 · שרה לוי', icon: 'file' });
  assert.equal(r.list[0].label, 'הזמנה #5 · שרה לוי'); assert.equal(r.cur, 1); assert.deepEqual(r.list.map((e) => e.key), s.list.map((e) => e.key));
  assert.equal(relabel(s, '/nope', { label: 'x' }), s); assert.equal(relabel(r, '/orders/5', { label: 'הזמנה #5 · שרה לוי' }), r); assert.equal(relabel(s, '/orders/5', { label: '   ' }), s);
});
t('סריאליזציה הלוך ושוב; קלט שבור → ריק; cur מחוץ לגבולות מתוקן; כפילויות נזרקות; תקרה נאכפת', () => {
  let s = createNavHistory(); s = V(s, '/', 'בית', 1); s = V(s, '/orders', 'הזמנות', 2); s = back(s);
  const d = deserializeNavHistory(serializeNavHistory(s));
  assert.deepEqual(d, s);
  for (const bad of ['', 'x', '{}', '[]', JSON.stringify({ v: 99, list: [] }), JSON.stringify({ v: 1, list: 'x' }), null, 5]) assert.deepEqual(deserializeNavHistory(bad), { list: [], cur: -1 }, String(bad));
  const fixed = deserializeNavHistory(JSON.stringify({ v: 1, cur: 9, list: [{ path: '/a', label: 'א', ts: 1 }, { path: '/a', ts: 2 }, { path: '', label: 'ריק' }, 5, { path: '/b', label: 'ב', ts: 3 }] }));
  assert.deepEqual(fixed.list.map((e) => e.key), ['/a', '/b']); assert.equal(fixed.cur, 1);
  const big = { v: 1, cur: 0, list: Array.from({ length: 30 }, (_, i) => ({ path: `/n${i}`, ts: i })) };
  assert.equal(deserializeNavHistory(JSON.stringify(big)).list.length, NAV_HISTORY_CAP);
  assert.ok(!serializeNavHistory(s).includes('undefined'));
});
t('deserialize: cur עוקב אחרי הרשומה המקורית אחרי קיצוץ/השמטה; נזרקה → האחרונה', () => {
  // 12 רשומות, cur על p0 (נופל בקיצוץ) → האחרונה; cur על p5 (שורד) → האינדקס החדש שלו
  const mk = (cur) => JSON.stringify({ v: 1, cur, list: Array.from({ length: 12 }, (_, i) => ({ path: `/p${i}`, ts: i })) });
  const dropped = deserializeNavHistory(mk(0)); assert.equal(dropped.list.length, NAV_HISTORY_CAP); assert.equal(current(dropped).key, '/p11');
  const kept = deserializeNavHistory(mk(5)); assert.equal(current(kept).key, '/p5'); assert.equal(kept.cur, 3);
  // רשומה פגומה לפני cur: cur=2 הצביע על /c, ואחרי השמטת הפגומה /c באינדקס 1
  const d = deserializeNavHistory(JSON.stringify({ v: 1, cur: 2, list: [{ path: '/a' }, { path: '' }, { path: '/c' }, { path: '/d' }] }));
  assert.equal(current(d).key, '/c'); assert.equal(d.cur, 1); assert.equal(canGoForward(d), true);
  // cur על רשומה כפולה (המופע השני נזרק) → עדיין אותו עמוד
  const dup = deserializeNavHistory(JSON.stringify({ v: 1, cur: 2, list: [{ path: '/a' }, { path: '/b' }, { path: '/a' }] }));
  assert.equal(current(dup).key, '/a'); assert.equal(dup.cur, 0);
  // cur על רשומה פגומה → האחרונה
  const onBad = deserializeNavHistory(JSON.stringify({ v: 1, cur: 1, list: [{ path: '/a' }, 7, { path: '/c' }] }));
  assert.equal(current(onBad).key, '/c');
  // cap מותאם: cur על רשומה ששורדת
  const c3 = deserializeNavHistory(mk(10), { cap: 3 }); assert.deepEqual(c3.list.map((e) => e.key), ['/p9', '/p10', '/p11']); assert.equal(c3.cur, 1);
});
t('deserialize: קלט ענק נחתך לפני העיבוד (מהיר), מחרוזת גדולה מדי נזרקת', () => {
  const n = 50000;
  const huge = JSON.stringify({ v: 1, cur: n - 2, list: Array.from({ length: n }, (_, i) => ({ path: `/h${i}`, ts: i })) });
  const t0 = Date.now();
  // המחרוזת גדולה מ-NAV_HISTORY_MAX_RAW_CHARS → ריק, בלי לנתח
  assert.ok(huge.length > NAV_HISTORY_MAX_RAW_CHARS); assert.deepEqual(deserializeNavHistory(huge), { list: [], cur: -1 });
  // מתחת לתקרת התווים אבל מעל תקרת הרשומות (2,000 רשומות קצרות) → רק האחרונות מעובדות, cur נשמר
  const m = 2000;
  const long = JSON.stringify({ v: 1, cur: m - 2, list: Array.from({ length: m }, (_, i) => ({ path: `/${i}` })) });
  assert.ok(long.length < NAV_HISTORY_MAX_RAW_CHARS); assert.ok(m > NAV_HISTORY_MAX_PARSE_ENTRIES);
  const r = deserializeNavHistory(long);
  assert.equal(r.list.length, NAV_HISTORY_CAP); assert.equal(current(r).key, `/${m - 2}`); assert.equal(r.list[r.list.length - 1].key, `/${m - 1}`);
  assert.ok(Date.now() - t0 < 2000, 'צריך להסתיים מיד');
});
t('clearNavHistoryStorage: מוחק את המפתח מהאחסון שניתן; בלי אחסון / אחסון שזורק → false בלי חריגה', () => {
  const store = new Map(); const fake = { removeItem: (k) => store.delete(k), setItem: (k, v) => store.set(k, v) };
  fake.setItem(NAV_HISTORY_STORAGE_KEY, serializeNavHistory(visit(createNavHistory(), '/orders/5'))); fake.setItem('other', '1');
  assert.equal(clearNavHistoryStorage(fake), true); assert.equal(store.has(NAV_HISTORY_STORAGE_KEY), false); assert.equal(store.get('other'), '1');
  assert.equal(clearNavHistoryStorage(null), false); assert.equal(clearNavHistoryStorage({}), false);
  assert.equal(clearNavHistoryStorage({ removeItem: () => { throw new Error('quota'); } }), false);
  assert.equal(clearNavHistoryStorage(), false, 'ב-node אין sessionStorage');
});
t('אי-שינוי הקלט: visit/back/clear לא משנים את המצב הקודם', () => {
  let s = createNavHistory(); s = V(s, '/', 'בית', 1);
  const frozen = JSON.stringify(s);
  V(s, '/orders', 'הזמנות', 2); back(s); clear(s); relabel(s, '/', { label: 'x' });
  assert.equal(JSON.stringify(s), frozen);
});

console.log('recents — נצפו לאחרונה');
t('parseEntityPath: הזמנה / לקוח / דגם / השכרה; עמודים אחרים = null', () => {
  assert.deepEqual(parseEntityPath('/orders/52103'), { type: 'order', id: '52103' });
  assert.deepEqual(parseEntityPath('/orders/52103/'), { type: 'order', id: '52103' });
  assert.deepEqual(parseEntityPath('/customers/3f2a-b'), { type: 'customer', id: '3f2a-b' });
  assert.deepEqual(parseEntityPath('/dashboard/dresses/4512'), { type: 'dress', id: '4512' });
  assert.deepEqual(parseEntityPath('/rentals?orderId=52103'), { type: 'rental', id: '52103' });
  for (const p of ['/orders', '/orders/new', '/customers/new', '/customers', '/dashboard/dresses', '/rentals', '/rentals#rented', '/rentals?orderId=abc', '/orders/12/print', '/api/orders/12', '', null, '/customers/a b']) assert.equal(parseEntityPath(p), null, String(p));
});
t('קידוד פגום ("%"): parseEntityPath / navEntryToRecent / visitRowToRecent / mergeRecents לא זורקים', () => {
  for (const p of ['/rentals?orderId=%', '/rentals?orderId=%E0%A4%A', '/rentals?orderId=%zz']) assert.equal(parseEntityPath(p), null, p);
  assert.deepEqual(parseEntityPath('/rentals?orderId=%35'), { type: 'rental', id: '5' });
  assert.equal(navEntryToRecent({ path: '/rentals?orderId=%', label: 'x' }).type, 'page', 'עמוד לא-ישות עדיין נרשם כעמוד');
  assert.equal(visitRowToRecent({ pageUrl: '/rentals?orderId=%', timestamp: 1 }), null);
  const merged = mergeRecents({ nav: [{ path: '/rentals?orderId=%', ts: 2 }, { path: '/orders/3', ts: 1 }], visits: [{ pageUrl: '/rentals?orderId=%' }], legacy: [{ type: 'order', id: 4 }] }, { entitiesOnly: true });
  assert.deepEqual(merged.map((x) => x.key), ['order:3', 'order:4']);
  // רשומה שזורקת בתוך המרה (getter רעיל) נזרקת בשקט ולא מפילה את המיזוג
  const toxic = { get pageUrl() { throw new Error('boom'); } };
  assert.deepEqual(mergeRecents({ visits: [toxic, { pageUrl: '/orders/9', timestamp: 1 }] }).map((x) => x.key), ['order:9']);
});
t('entityHref / defaultLabel', () => {
  assert.equal(entityHref('order', '5'), '/orders/5'); assert.equal(entityHref('rental', '5'), '/rentals?orderId=5'); assert.equal(entityHref('x', '5'), null);
  assert.equal(defaultLabel('order', '5'), 'הזמנה #5'); assert.equal(defaultLabel('dress', '4512'), 'דגם 4512'); assert.equal(defaultLabel('customer', 'a'), 'לקוח');
});
t('legacyItemToRecent: agy_history → פריט; זבל נזרק', () => {
  const r = legacyItemToRecent({ type: 'order', id: 52103, name: 'הזמנה #52103', subtext: 'שרה לוי', timestamp: 10 });
  assert.deepEqual(r, { key: 'order:52103', type: 'order', id: '52103', label: 'הזמנה #52103', subtext: 'שרה לוי', href: '/orders/52103', icon: 'file', ts: 10, source: 'legacy' });
  assert.equal(legacyItemToRecent({ type: 'customer', id: 'c1' }).label, 'לקוח');
  for (const bad of [null, {}, { type: 'x', id: 1 }, { type: 'order' }, { type: 'order', id: 'a b' }, 'x']) assert.equal(legacyItemToRecent(bad), null);
});
t('navEntryToRecent: עמוד ישות מקבל מפתח ישות (מתאחד עם הישן); עמוד רגיל = page; קיוסק/API נזרקים', () => {
  const o = navEntryToRecent({ key: '/orders/52103', path: '/orders/52103', label: 'הזמנה #52103 · שרה לוי', icon: 'file', ts: 5 });
  assert.equal(o.key, 'order:52103'); assert.equal(o.label, 'הזמנה #52103 · שרה לוי'); assert.equal(o.source, 'nav');
  const plain = navEntryToRecent({ path: '/orders/7', label: '/orders/7', ts: 1 }); assert.equal(plain.label, 'הזמנה #7');
  const p = navEntryToRecent({ key: '/board', path: '/board', label: 'לוח חודשי', icon: 'cal', ts: 6 });
  assert.deepEqual(p, { key: 'page:/board', type: 'page', id: null, label: 'לוח חודשי', subtext: '', href: '/board', icon: 'cal', ts: 6, source: 'nav' });
  assert.equal(navEntryToRecent({ path: '/customer-interface', label: 'קיוסק' }), null); assert.equal(navEntryToRecent({ path: '/api/me' }), null); assert.equal(navEntryToRecent(null), null);
});
t('visitRowToRecent: רק עמודי ישות מ-PageVisitLog; API ו-light=1 נזרקים; timestamp בכל צורה', () => {
  assert.equal(visitRowToRecent({ pageUrl: '/orders/9', timestamp: new Date(1000) }).ts, 1000);
  assert.equal(visitRowToRecent({ pageUrl: '/orders/9', timestamp: '1970-01-01T00:00:02.000Z' }).ts, 2000);
  assert.equal(visitRowToRecent({ pageUrl: '/orders/9', timestamp: 3 }).source, 'server');
  for (const bad of [{ pageUrl: '/api/orders/9' }, { pageUrl: '/api/notifications?light=1' }, { pageUrl: '/board' }, { pageUrl: 5 }, null]) assert.equal(visitRowToRecent(bad), null);
  // הסינון המפורש ב-visitRowToRecent (לא רק parseEntityPath): עמוד ישות עם light=1 הוא קריאת רקע, לא צפייה
  assert.equal(visitRowToRecent({ pageUrl: '/orders/5?light=1', timestamp: 1 }), null);
  assert.equal(visitRowToRecent({ pageUrl: '/orders/5?x=1&light=1', timestamp: 1 }), null);
  assert.equal(visitRowToRecent({ pageUrl: '/api/orders/5?x=1', timestamp: 1 }), null);
  assert.equal(visitRowToRecent({ pageUrl: '/api', timestamp: 1 }), null);
  assert.equal(visitRowToRecent({ pageUrl: '/orders/5?x=1', timestamp: 1 }).key, 'order:5', 'query אחר לא מפריע');
});
t('mergeRecents: איחוד שלושת המקורות, החדש למעלה, בלי כפילויות, תווית עשירה מנצחת, תקרה', () => {
  const merged = mergeRecents({
    nav: [{ path: '/orders/1', label: '/orders/1', ts: 50 }, { path: '/board', label: 'לוח חודשי', icon: 'cal', ts: 40 }],
    legacy: [{ type: 'order', id: 1, name: 'הזמנה #1 · שרה לוי', subtext: '050', timestamp: 10 }, { type: 'customer', id: 'c1', name: 'לקוח: רחל', timestamp: 30 }],
    visits: [{ pageUrl: '/orders/1', timestamp: 60 }, { pageUrl: '/dashboard/dresses/4512', timestamp: 20 }, { pageUrl: '/api/x', timestamp: 70 }],
  });
  assert.deepEqual(merged.map((x) => x.key), ['order:1', 'page:/board', 'customer:c1', 'dress:4512']);
  assert.equal(merged[0].ts, 60); assert.equal(merged[0].label, 'הזמנה #1 · שרה לוי'); assert.equal(merged[0].subtext, '050');
  assert.deepEqual(mergeRecents({ nav: [{ path: '/board', label: 'לוח', ts: 1 }, { path: '/orders/2', ts: 2 }] }, { entitiesOnly: true }).map((x) => x.key), ['order:2']);
  const many = mergeRecents({ visits: Array.from({ length: 30 }, (_, i) => ({ pageUrl: `/orders/${i}`, timestamp: i })) });
  assert.equal(many.length, RECENTS_CAP); assert.equal(many[0].key, 'order:29');
  assert.deepEqual(mergeRecents(), []); assert.deepEqual(mergeRecents({ nav: 'x', legacy: null }), []);
});
t('toLegacyItem: תאימות לאחור לצורת agy_history', () => {
  const r = legacyItemToRecent({ type: 'dress', id: '4512', name: 'שמלה 4512', timestamp: 7 });
  assert.deepEqual(toLegacyItem(r), { type: 'dress', id: '4512', name: 'שמלה 4512', subtext: '', timestamp: 7 });
  assert.equal(toLegacyItem({ type: 'page', key: 'page:/board' }), null);
});

// --- ה-sprite המוטמע (MenuSprite) ----------------------------------------------------------------
t('spriteSymbols.js מסונכרן עם design-system/sprite.svg (node scripts/build_menu_sprite.mjs)', () => {
  // נרמול CRLF: checkout של Windows (core.autocrlf=true) מחזיק את הקובץ עם סופי שורה CRLF, המחולל פולט LF.
  assert.equal(normalizeEol(readFileSync(SPRITE_OUT, 'utf8')), buildModuleText());
  assert.ok(isSpriteInSync());
});
t('כל אייקון שהעץ פולט קיים ב-sprite המוטמע', () => {
  const ids = new Set(SPRITE_SYMBOLS.map(([id]) => id));
  assert.equal(SPRITE_ID_PREFIX, 'gmi-');
  assert.ok(ids.size >= 71);
  for (const n of ['bell', 'chev', 'ext', 'menu', 'search', 'sn-bug', 'user', 'x', 'arrl', 'arrr', 'msg']) assert.ok(ids.has(n), `missing ${n}`);
  const tree = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ enable_deliveries: 'true', management_messages: 'true' }) });
  for (const it of flattenMenuTree(tree)) if (it.icon) assert.ok(ids.has(it.icon), `tree icon "${it.icon}" (${it.id}) missing from sprite`);
  for (const tab of tree.tabs) if (tab.icon) assert.ok(ids.has(tab.icon), `tab icon "${tab.icon}" missing from sprite`);
  for (const [id, viewBox, shapes] of SPRITE_SYMBOLS) {
    assert.match(id, /^[a-z0-9-]+$/); assert.match(viewBox, /^0 0 \d+ \d+$/); assert.ok(shapes.length > 0, `empty symbol ${id}`);
  }
});

// --- שעון "במשמרת": משמרת פתוחה ישנה לא מציגה מונה שעות ענק ---------------------------------------
t('shiftClockInfo: משמרת סבירה → H:MM; מעל 16 שעות → "משמרת פתוחה · <תאריך עברי>" עם טולטיפ; קלט לא תקין → null', () => {
  const now = Date.parse('2026-10-01T10:00:00Z');
  assert.deepEqual(shiftClockInfo('2026-10-01T06:18:00Z', now), { kind: 'ok', text: '3:42' });
  assert.deepEqual(shiftClockInfo('2026-10-01T10:00:00Z', now), { kind: 'ok', text: '0:00' });
  assert.equal(shiftClockInfo('2026-10-01T10:00:30Z', now).text, '0:00', 'סטייה קטנה של שעונים לא מפילה');
  assert.equal(shiftClockInfo(new Date(now - MAX_PLAUSIBLE_SHIFT_MS).toISOString(), now).kind, 'ok', 'בדיוק 16 שעות עדיין סבירה');
  const stale = shiftClockInfo('2022-11-22T06:52:05.000Z', now); // המשמרת הפתוחה מ-2022 שהראתה 33819:46
  assert.equal(stale.kind, 'stale');
  assert.equal(stale.since, hebrewDateOfInstant('2022-11-22T06:52:05.000Z'));
  assert.ok(stale.text.startsWith('משמרת פתוחה') && stale.text.includes(stale.since));
  assert.ok(!/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(stale.text + stale.tip), 'אין תאריך לועזי');
  assert.ok(!/\d{4,}:\d{2}/.test(stale.text), 'אין מונה שעות ענק');
  assert.equal(shiftClockInfo(null, now), null); assert.equal(shiftClockInfo('garbage', now), null);
  assert.equal(shiftClockInfo('2027-01-01T00:00:00Z', now), null, 'שעת כניסה עתידית');
});

// --- תאריך עברי בלבד (כלל קבוע): תאריך הגרסה בטולטיפ הלוגו ובתחתית הבית ---------------------------
t('hebrewVersionStamp: "DD/MM/YYYY HH:MM" → תאריך עברי + שעה; בלי תאריך לועזי; לא ניתן לפירוש → ""', () => {
  assert.equal(hebrewVersionStamp('01/10/2026 12:47'), 'כ תשרי תשפ"ז, 12:47');
  assert.equal(hebrewVersionStamp('29/09/2026 12:56'), 'יח תשרי תשפ"ז, 12:56');
  assert.equal(hebrewVersionStamp('1/10/2026 4:05'), 'כ תשרי תשפ"ז, 04:05');
  assert.equal(hebrewVersionStamp('01/10/2026'), 'כ תשרי תשפ"ז');
  for (const bad of ['', null, undefined, 'x', '31/02/2026 10:00', '2026-10-01 12:47', '01/13/2026 10:00']) assert.equal(hebrewVersionStamp(bad), '', String(bad));
  assert.ok(!/\d{4}/.test(hebrewVersionStamp('01/10/2026 12:47')), 'אין שנה לועזית');
});
t('hebrewDateOfInstant: היום האזרחי בישראל (לא UTC): 22:30Z ב-30.9 כבר 1.10 בישראל; בלי תלות באזור הזמן של המכונה', () => {
  assert.equal(hebrewDateOfInstant('2026-09-30T22:30:00Z'), hebrewVersionStamp('01/10/2026'));
  assert.equal(hebrewDateOfInstant('2026-10-01T10:00:00Z'), hebrewVersionStamp('01/10/2026'));
  assert.equal(hebrewDateOfInstant('nope'), '');
});
t('טולטיפ הלוגו: תאריך הגרסה עברי; תאריך שלא ניתן לפירוש לא מוצג כלועזי', () => {
  const tip = (date) => buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [], version: { version: '0.1.446', date } }).brand.tooltip;
  assert.equal(tip('01/10/2026 04:54'), 'גירסא 0.1.446 | כ תשרי תשפ"ז, 04:54');
  assert.equal(tip('לא תאריך'), 'גירסא 0.1.446');
  assert.equal(tip(''), 'גירסא 0.1.446');
});
t('"האתר הישן": התווית "זמני" נשארת בנתוני העץ (לטולטיפ) אבל לא מצוירת כתג על האייקון', () => {
  assert.equal(HEAD_TREE.rail.oldSite.temporary, true);
  const src = readFileSync(new URL('../app/components/menu/MenuA5Shell.js', import.meta.url), 'utf8');
  const btn = src.slice(src.indexOf('id="snOld"'), src.indexOf('</button>', src.indexOf('id="snOld"')));
  assert.ok(!btn.includes('sn-badge') && !btn.includes('זמני</'), 'אין תג על האייקון');
  assert.ok(/data-tip="האתר הישן \(זמני\)/.test(btn), 'הניסוח בטולטיפ');
});
t('פאנל החיפוש: אין חיצי אחורה/קדימה ולא "עמוד X מתוך Y"; הריחוף מציג את שורת החיפוש; פוקוס בשדה מצמיד', () => {
  const dir = '../app/components/menu/';
  const panel = readFileSync(new URL(dir + 'MenuSearchPanel.js', import.meta.url), 'utf8');
  const shell = readFileSync(new URL(dir + 'MenuA5Shell.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL(dir + 'menu.css', import.meta.url), 'utf8');
  assert.ok(!/sn-hist|sn-hpos|data-hist|positionText/.test(panel), 'אין שורת אחורה/קדימה בפאנל');
  assert.ok(!/\.sn-hist|\.sn-hpos/.test(css), 'אין CSS של השורה');
  assert.ok(!/\.sn-item\.peek[^{]*\.sn-sbox/.test(css), 'שורת החיפוש לא מוסתרת בהצצה');
  assert.ok(shell.includes('onFocus={onSearchFieldFocus}'), 'פוקוס בשדה מצמיד את הפאנל');
  assert.ok(/\.sn-sbox input:focus[^{]*\{[^}]*outline:0!important[^}]*box-shadow:none!important/.test(css), 'אין טבעת פוקוס של האתר הישן על השדה');
});

t('"השינויים שלי" בחיפוש התפריט: ה-CSS בהיקף .gm-ds.gm-menu בלבד, רק משתני --gm-*, והפאנל עושה את שלושת הדברים: אין בקשת חיפוש ל-&, רק '&' פעילה, Enter על הרשימה לא מריץ חיפוש', () => {
  const css = readFileSync(new URL('../app/components/menu/menu.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = css.split('}').map((x) => x.trim()).filter((x) => /\.mine-/.test(x.split('{')[0]));
  assert.ok(rules.length >= 15, 'נמצאו ' + rules.length);
  for (const r of rules) {
    const [sel, body] = r.split('{');
    for (const one of sel.split(',')) assert.ok(/^\s*\.gm-ds\.gm-menu /.test(one), 'מחוץ להיקף: ' + one);
    for (const m of body.matchAll(/var\(--([a-z0-9-]+)/gi)) assert.ok(m[1].startsWith('gm-'), 'משתנה לא gm-: ' + m[1]);
    assert.ok(!/!important/.test(body), r);
  }
  const panel = readFileSync(new URL('../app/components/menu/MenuSearchPanel.js', import.meta.url), 'utf8');
  // חיפוש השרת מושעה רק כשהרשימה עצמה מוצגת (prefixOn של SearchBody: '&' '#' '$'), לא לפי "מתחיל בקידומת" - אחרת: 403 / שורה לא מקוצצת / אחרי Esc = אין רשימה ואין חיפוש
  const hook = panel.slice(panel.indexOf('export function useMenuSearch'), panel.indexOf('const MENU_PREFIXES'));
  assert.ok(/term\.length < MIN_CHARS \|\| prefixActive/.test(hook) && /\[debounced, prefixActive\]/.test(hook), 'useMenuSearch לא שולח חיפוש כשהרשימה מוצגת');
  assert.ok(!/detectQuickPrefix|startsWith\('&'\)/.test(hook), 'ההחלטה לא מתבססת על התו הראשון בלבד');
  assert.ok(/reportPrefix\(drawer, prefixOn\)/.test(panel) && /const prefixOn = qp\.open && !!qp\.def;/.test(panel) && /const mineOn = prefixOn && qp\.def\.source === 'mine'/.test(panel), 'prefixActive = אותו תנאי שמצייר את הרשימה');
  assert.ok(/MENU_PREFIXES = \['&', '#', '\$', '%'\]/.test(panel) && /prefixes: MENU_PREFIXES/.test(panel), "בתפריט '&' '#' '$' '%' ('@' ומדריך הקיצורים רק בדף הבית)");
  assert.ok(/qp\.onKeyDown\(e\);[\s\S]{0,120}if \(e\.defaultPrevented\) return;/.test(panel), 'Enter על רשימת & לא מריץ חיפוש');
  assert.ok(/nav\.navigate\(href\)/.test(panel) && /row\.url\.startsWith\(MINE_URL\)/.test(panel) && /HOME_NAV_EVENT/.test(panel), '"הכל" פותח /?recent=mine (עם emp של הנהלה)');
});
// ---- תוויות עבריות ל"נצפו לאחרונה" (תיקון רוחבי: אף נתיב גולמי באנגלית) ----
import { pageLabel, hebrewLabelOr, hasPageLabel, ROUTE_LABELS, FALLBACK_PAGE_LABEL } from '../lib/menu/pageLabels.js';
import { makeEntry } from '../lib/menu/navHistory.js';
import { readdirSync, statSync } from 'node:fs';
const HEB = /[\u05d0-\u05ea]/;
function pageRoutes(dir = 'app', base = '') {
  const out = [];
  for (const name of readdirSync(new URL('../' + dir, import.meta.url))) {
    const rel = dir + '/' + name;
    const st = statSync(new URL('../' + rel, import.meta.url));
    if (st.isDirectory()) { out.push(...pageRoutes(rel, base + '/' + name)); }
    else if (name === 'page.js') out.push(base || '/');
  }
  return out;
}
t('כל עמוד באתר (app/**/page.js) מקבל תווית עברית - לא נתיב ולא "עמוד במערכת" (נוסף עמוד? צריך להוסיף ל-lib/menu/pageLabels.js)', () => {
  const missing = [];
  for (const route of pageRoutes()) {
    const sample = route.replace(/\[[^\]]+\]/g, 'x1');
    if (!hasPageLabel(sample) || !HEB.test(pageLabel(sample))) missing.push(route); // תווית מפורשת בלבד - לא אב קרוב ולא ברירת מחדל
  }
  assert.deepEqual(missing, [], 'עמודים בלי תווית עברית: ' + missing.join(', '));
});
t('pageLabel: מדויק, דינמי, אב קרוב, וברירת מחדל עברית', () => {
  assert.equal(pageLabel('/stock-check'), 'בדיקת מלאי');
  assert.equal(pageLabel('/my-hours?x=1#a'), 'השעות שלי');
  assert.equal(pageLabel('/employees/abc123'), 'כרטיס עובד');
  assert.equal(pageLabel('/admin/new-future-page'), 'לוח ניהול');
  assert.equal(pageLabel('/totally/unknown'), FALLBACK_PAGE_LABEL);
  assert.ok(Object.values(ROUTE_LABELS).every((l) => HEB.test(l)));
});
t('רשומת ניווט / פריט "נצפו לאחרונה" בלי תווית עברית (נתיב, אנגלית, ריק) מקבלים תווית עברית; תווית עברית נשמרת', () => {
  assert.equal(makeEntry({ path: '/stock-check', label: '/stock-check' }, 1).label, 'בדיקת מלאי');
  assert.equal(makeEntry({ path: '/profile', label: 'profile' }, 1).label, 'הפרופיל שלי');
  assert.equal(makeEntry({ path: '/profile' }, 1).label, 'הפרופיל שלי');
  assert.equal(makeEntry({ path: '/schedule', label: 'לוז' }, 1).label, 'לוז');
  const r = navEntryToRecent({ key: '/my-hours', path: '/my-hours', label: '/my-hours', icon: 'file', ts: 5 });
  assert.equal(r.label, 'השעות שלי');
  assert.equal(hebrewLabelOr('הזמנה #123', '/orders/123'), 'הזמנה #123');
  assert.equal(hebrewLabelOr('52103', '/orders/52103'), '52103'); // תווית ישות מועשרת לא מוחלפת
  assert.equal(hebrewLabelOr('Sarah Cohen', '/customers/abc'), 'Sarah Cohen');
  assert.equal(hebrewLabelOr('', '/customers/abc'), 'לקוח');
});

console.log('תפריט "ניהול" מקוצר — אחרונים + הגדרות מערכת + כל כלי הניהול (4.10.2026)');
const real = (list) => (list || []).filter((x) => x.kind === 'link' || x.kind === 'action');
const hubTools = (roleId, opts) => selectHub(accessForRole(roleId, opts)).tools;
const ADM = (user, recents, extra = {}) => tab(buildMenuTree({ user, permissions: ALL_OPEN, settings: [], adminTools: user ? hubTools(user.roleId) : hubTools(null, { logged: false, requireLogin: false }), adminRecents: recents, ...extra }), 'admin');
t('קבועים: עד 5 שורות, 3 אחרונים, ברירות מחדל עובדים → הרשאות → מחירון; R13 מתעד את מה שיצא מהפאנל', () => {
  assert.equal(ADMIN_MENU_MAX_ROWS, 5); assert.equal(ADMIN_MENU_RECENTS, 3);
  assert.deepEqual([...ADMIN_DEFAULT_IDS], ['ad-staff', 'ad-perms', 'ad-pricelist']);
  assert.deepEqual([...ADMIN_FIXED_IDS], ['ad-settings', 'ad-all']);
  for (const id of [...ADMIN_POOL_IDS, ...ADMIN_FIXED_IDS]) assert.ok(ITEM_IDS.includes(id), id);
  assert.ok(PANEL_ONLY_REMOVED.R13.ids.every((id) => ITEM_IDS.includes(id)));
  assert.ok(!REMOVED_HREFS.some((h) => ['/dashboard', '/refunds', '/admin/statistics'].includes(h)), 'R13 לא מסיר שום href מהעץ');
});
t('כל תפקיד, 0-8 אחרונים: לכל היותר 5 שורות, "כל כלי הניהול" אחרונה כשמותר לפתוח את /admin, בלי כפילויות', () => {
  const many = ['/admin/statistics', '/refunds', '/admin/backups', '/dashboard', '/admin/ai', '/admin/site', '/employees', '/admin/departments'];
  for (const user of [HEAD, PROG, BRANCH, STAFF, null]) {
    for (let n = 0; n <= many.length; n++) {
      const a = ADM(user, many.slice(0, n));
      if (!a) continue;
      const r = real(a.items);
      assert.ok(r.length <= ADMIN_MENU_MAX_ROWS, `${user && user.roleId} n=${n}: ${r.length}`);
      assert.equal(new Set(r.map((x) => x.id)).size, r.length, 'כפילות'); assert.equal(new Set(r.map((x) => x.href)).size, r.length, 'כפילות href');
      if (a.href === '/admin') { assert.equal(r[r.length - 1].id, 'ad-all'); assert.equal(r[r.length - 2].id, 'ad-settings'); }
      else assert.ok(!r.some((x) => x.id === 'ad-all' || x.id === 'ad-settings'), 'בלי /admin — בלי השורות הקבועות');
      assert.ok(a.items[a.items.length - 1].kind !== 'separator' && a.items[0].kind !== 'separator');
    }
  }
});
t('אחרונים: החדש ראשון, עד 3, עם סימון recent וטולטיפ; ברירות מחדל ממלאות את החסר בלי כפילות', () => {
  const two = ADM(HEAD, ['/admin/statistics', '/refunds']);
  assert.deepEqual(ids(two.items), ['ad-stats', 'ad-refunds', 'ad-staff', 'ad-settings', 'ad-all']);
  assert.deepEqual(two.items.slice(0, 3).map((x) => !!x.recent), [true, true, false]);
  assert.equal(two.items[0].tip, ADMIN_RECENT_TIP);
  // אחרון שהוא גם ברירת מחדל — לא מופיע פעמיים
  assert.deepEqual(ids(ADM(HEAD, ['/admin/permissions']).items), ['ad-perms', 'ad-staff', 'ad-pricelist', 'ad-settings', 'ad-all']);
  // 5 אחרונים → רק 3 הראשונים; כלי קטלוג (שאינו פריט תפריט) עם התווית של מסך /admin
  const five = ADM(HEAD, ['/admin/backups', '/dashboard', '/admin/ai', '/admin/statistics', '/refunds']);
  assert.deepEqual(ids(five.items), ['hub-backups', 'finance', 'hub-ai', 'ad-settings', 'ad-all']);
  assert.deepEqual([five.items[0].label, five.items[0].href, five.items[0].icon], ['גיבוי לדרייב', '/admin/backups', 'table']);
  // אותו כלי פעמיים / href לא מוכר / ההגדרות (קבועה) / /admin עצמו — לא תופסים מקום
  assert.deepEqual(ids(ADM(HEAD, ['/admin/ai', '/admin/ai', '/nope', '/admin/settings', '/admin', null, 5, { href: '/refunds' }]).items), ['hub-ai', 'ad-refunds', 'ad-staff', 'ad-settings', 'ad-all']);
});
t('שערים לכל תפקיד: אחרון שאינו מותר נזרק (מתכנת → הנהלה, ניהול אתר / כלי מתכנת; מנהלת סניף; עובדת; אורח)', () => {
  // הנהלה ראשית: "ניהול אתר" וכלי מתכנת (סייר נתונים) לא במאגר → נזרקים
  assert.deepEqual(ids(ADM(HEAD, ['/admin/site', '/admin/data-explorer', '/admin/statistics']).items), ['ad-stats', 'ad-staff', 'ad-perms', 'ad-settings', 'ad-all']);
  // מתכנת: מותר
  assert.deepEqual(ids(ADM(PROG, ['/admin/site', '/admin/data-explorer']).items), ['ad-site', 'hub-data-explorer', 'ad-staff', 'ad-settings', 'ad-all']);
  // רשימת הו"ק: הנהלה ראשית וגם מתכנת (AH-03, 4.10.2026)
  assert.equal(ADM(PROG, ['/admin/nedarim-hok-list']).items[0].id, 'hub-nedarim-hok-list');
  // מערכת העיצוב (AH-02): מתכנת בלבד — הנהלה ראשית לא מקבלת אותה במאגר
  assert.equal(ADM(PROG, ['/design-system']).items[0].id, 'hub-design-system');
  assert.equal(ADM(HEAD, ['/design-system']).items[0].id, 'ad-staff');
  assert.equal(ADM(HEAD, ['/admin/nedarim-hok-list']).items[0].id, 'hub-nedarim-hok-list');
  // מנהלת סניף: אין /admin, אין הגדרות; רק דגמים/זיכויים (לפי ההרשאה), בלי כלי קטלוג גם אם הוזרקו בטעות
  const br = tab(buildMenuTree({ user: BRANCH, permissions: ALL_OPEN, settings: [], adminTools: hubTools(0), adminRecents: ['/refunds', '/admin/statistics', '/admin/settings'] }), 'admin');
  assert.deepEqual(ids(br.items), ['ad-refunds', 'ad-models', 'ad-nwd']); assert.equal(br.href, null); assert.equal(br.opensMenuOnly, true);
  assert.ok(!br.pool.some((x) => x.id.startsWith('hub-')), 'כלי קטלוג רק עם שער head');
  // עובדת בלי הרשאת זיכויים: אחרון /refunds נזרק
  assert.deepEqual(ids(tab(buildMenuTree({ user: STAFF, permissions: { ...ALL_OPEN, 'page:refunds': false }, settings: [], adminRecents: ['/refunds'] }), 'admin').items), ['ad-models', 'ad-nwd']);
  // אורח כשההתחברות חובה: אין לשונית בכלל, גם עם אחרונים
  assert.equal(tab(buildMenuTree({ user: null, settings: rows({ require_login: 'true' }), adminRecents: ['/admin/statistics'] }), 'admin'), undefined);
  // הנהלה עם page:refunds=false מפורש: אחרון /refunds נזרק
  assert.equal(tab(buildMenuTree({ user: HEAD, permissions: { ...ALL_OPEN, 'page:refunds': false }, settings: [], adminRecents: ['/refunds'] }), 'admin').items[0].id, 'ad-staff');
});
t('applyAdminRecents (בלקוח) = buildMenuTree עם אותם אחרונים; לא משנה את הקלט; בלי לשונית ניהול — אותו עץ', () => {
  const base = buildMenuTree({ user: PROG, permissions: ALL_OPEN, settings: [], adminTools: hubTools(2) });
  const snap = JSON.stringify(base);
  const rec = ['/admin/ai', '/dashboard/dresses', '/admin/labels'];
  const viaClient = applyAdminRecents(base, rec);
  const viaServer = buildMenuTree({ user: PROG, permissions: ALL_OPEN, settings: [], adminTools: hubTools(2), adminRecents: rec });
  assert.deepEqual(tab(viaClient, 'admin').items, tab(viaServer, 'admin').items);
  assert.equal(JSON.stringify(base), snap, 'הקלט לא השתנה');
  assert.deepEqual(applyAdminRecents(base, []).tabs.find((x) => x.id === 'admin').items, tab(base, 'admin').items);
  // (עובדת מחוברת תמיד מקבלת לשונית ניהול עם 'ימי אי-פעילות' (NW-I9), לכן אורח כשההתחברות חובה הוא העץ בלי לשונית ניהול)
  const noAdmin = buildMenuTree({ user: null, settings: rows({ require_login: 'true' }) });
  assert.equal(tab(noAdmin, 'admin'), undefined);
  assert.equal(applyAdminRecents(noAdmin, rec), noAdmin); assert.equal(applyAdminRecents(null, rec), null);
  assert.ok(isJsonSafe(viaServer));
});
t('שום יעד לא נעלם: כל מה שיצא מהשורות הקבועות (R13) הוא אריח במסך /admin לאותו משתמש (הנהלה / מתכנת, עם ובלי משלוחים)', () => {
  for (const roleId of [0, 2]) for (const deliveriesEnabled of [false, true]) {
    const settings = deliveriesEnabled ? rows({ enable_deliveries: 'true' }) : [];
    const tree = buildMenuTree({ user: roleId ? PROG : HEAD, permissions: ALL_OPEN, settings });
    const hub = new Set(selectHub(accessForRole(roleId), { deliveriesEnabled }).tools.map((x) => x.href));
    for (const it of tab(tree, 'admin').pool) assert.ok(hub.has(it.href), `${roleId}/${deliveriesEnabled}: ${it.label} (${it.href}) לא במסך /admin`);
  }
});
t('composeAdminItems: קלט חסר / זבל לא זורק', () => {
  assert.deepEqual(composeAdminItems(), []);
  assert.deepEqual(composeAdminItems({ pool: [null, {}], fixed: [null], recents: 'x' }), []);
  assert.deepEqual(ids(composeAdminItems({ pool: [], fixed: [{ id: 'ad-all', kind: 'link', href: '/admin' }] })), ['ad-all']);
});
t('המאגר: כלי קטלוג מוזרקים רק עם head, בלי כפילות href מול פריטי התפריט, בלי /admin; חיפוש בתפריט מוצא את כולם', () => {
  const tree = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [], adminTools: [...hubTools(0), { id: 'x', title: 'רע', href: '//evil.com' }, { id: 'y', title: '', href: '/a' }, { id: 'hub', title: 'מסך', href: '/admin' }] });
  const a = tab(tree, 'admin');
  const paths = a.pool.map((x) => x.href);
  assert.equal(new Set(paths).size, paths.length, 'href כפול במאגר');
  assert.ok(!paths.includes('/admin') && !paths.includes('/admin/settings') && !paths.includes('//evil.com'));
  assert.equal(a.pool.find((x) => x.href === '/dashboard').id, 'finance', 'פריט התפריט גובר על אריח הקטלוג');
  assert.equal(a.pool.find((x) => x.href === '/admin/permissions').id, 'ad-perms');
  const flat = flattenMenuTree(tree);
  for (const h of ['/admin/statistics', '/refunds', '/admin/backups', '/dashboard/dresses']) assert.equal(flat.find((x) => x.href === h)?.group, 'ניהול', h);
  assert.equal(new Set(flat.map((x) => x.id)).size, flat.length, 'כפילות בחיפוש');
});
t('findActive: "כל כלי הניהול" רק ב-/admin עצמו; כלי שאינו בפאנל עדיין מדגיש את הלשונית', () => {
  const tree = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [], adminTools: hubTools(0) });
  assert.deepEqual(findActive(tree, '/admin'), { tabId: 'admin', itemId: 'ad-all' });
  assert.deepEqual(findActive(tree, '/admin/statistics'), { tabId: 'admin', itemId: 'ad-stats' });
  assert.deepEqual(findActive(tree, '/admin/backups'), { tabId: 'admin', itemId: 'hub-backups' });
  assert.deepEqual(findActive(tree, '/admin/never-heard-of'), { tabId: 'admin', itemId: null });
  assert.deepEqual(findActive(tree, '/dashboard/dresses/7'), { tabId: 'admin', itemId: 'ad-models' });
  assert.deepEqual(findActive(tree, '/admin/settings'), { tabId: 'admin', itemId: 'ad-settings' });
});
t('matchAdminPoolItem: ההתאמה הארוכה ביותר; /admin וההגדרות לא נרשמים; נתיב שאינו כלי → null', () => {
  const tree = buildMenuTree({ user: PROG, permissions: ALL_OPEN, settings: [], adminTools: hubTools(2) });
  const m = (p) => (matchAdminPoolItem(tree, p) || {}).id || null;
  assert.equal(m('/admin/data-explorer/full-view'), 'hub-data-explorer-full');
  assert.equal(m('/admin/data-explorer'), 'hub-data-explorer');
  assert.equal(m('/admin/site-settings/api-keys'), 'hub-api-keys');
  assert.equal(m('/admin/site'), 'ad-site'); assert.equal(m('/admin/site-settings'), 'hub-site-settings');
  assert.equal(m('/dashboard/dresses/12'), 'ad-models'); assert.equal(m('/dashboard'), 'finance'); assert.equal(m('/employees/report'), 'ad-staff');
  assert.equal(m('/admin/statistics?x=1#y'), 'ad-stats');
  for (const p of ['/admin', '/admin/', '/admin/settings', '/admin/settings/help', '/orders', '/', '', null]) assert.equal(m(p), null, String(p));
  assert.equal(matchAdminPoolItem(null, '/admin/ai'), null);
  assert.equal(matchAdminPoolItem(buildMenuTree({ user: STAFF, permissions: ALL_CLOSED, settings: [] }), '/refunds'), null);
});
t('adminRecents: החדש ראשון, בלי כפילות, עד 8; נתיב לא תקין לא נרשם; זהות כשאין שינוי', () => {
  assert.equal(ADMIN_RECENTS_CAP, 8);
  let l = [];
  for (let i = 0; i < 12; i++) l = recordAdminVisit(l, `/admin/t${i}`, 1000 + i);
  assert.equal(l.length, 8); assert.equal(l[0].href, '/admin/t11'); assert.equal(l[7].href, '/admin/t4');
  const again = recordAdminVisit(l, '/admin/t6', 5000);
  assert.deepEqual(adminRecentHrefs(again).slice(0, 2), ['/admin/t6', '/admin/t11']); assert.equal(again.length, 8);
  assert.equal(recordAdminVisit(again, '/admin/t6', 6000), again, 'כבר ראשון');
  for (const bad of ['', '//evil.com', '/\\evil', 'https://x/y', '/a?b', '/a#b', '/a\tb', null, 5]) assert.equal(recordAdminVisit(again, bad), again, String(bad));
  assert.deepEqual(recordAdminVisit(null, '/refunds', 1), [{ href: '/refunds', ts: 1 }]);
});
t('adminRecents: סריאליזציה סלחנית; מפתח לכל עובד; אחסון חסום/זורק לא שובר; התנתקות מוחקת רק את מפתחות המודול', () => {
  const l = recordAdminVisit(recordAdminVisit([], '/refunds', 1), '/admin/ai', 2);
  assert.deepEqual(deserializeAdminRecents(serializeAdminRecents(l)), l);
  for (const bad of [null, '', '{', '[]', '{"v":2,"list":[]}', 'x'.repeat(9000)]) assert.deepEqual(deserializeAdminRecents(bad), []);
  assert.deepEqual(deserializeAdminRecents(JSON.stringify({ v: 1, list: [{ href: '/a', ts: 1 }, { href: '/a', ts: 2 }, { href: '//e' }, 7, { href: '/b' }] })), [{ href: '/a', ts: 1 }, { href: '/b', ts: 0 }]);
  assert.notEqual(adminRecentsKey('emp-a'), adminRecentsKey('emp-b'));
  assert.equal(adminRecentsKey(null), `${ADMIN_RECENTS_KEY_PREFIX}guest`); assert.equal(adminRecentsKey(7), `${ADMIN_RECENTS_KEY_PREFIX}7`);
  const m = new Map([['other', '1']]);
  const fake = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
  assert.equal(writeAdminRecents('emp-a', l, fake), true); assert.equal(writeAdminRecents('emp-b', [], fake), true);
  assert.deepEqual(readAdminRecents('emp-a', fake), l); assert.deepEqual(readAdminRecents('emp-b', fake), []); assert.deepEqual(readAdminRecents('emp-c', fake), []);
  assert.equal(clearAdminRecentsStorage(fake), 2); assert.deepEqual([...m.keys()], ['other']);
  const thrower = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); }, key: () => { throw new Error('x'); }, length: 3 };
  assert.deepEqual(readAdminRecents('a', thrower), []); assert.equal(writeAdminRecents('a', l, thrower), false); assert.equal(clearAdminRecentsStorage(thrower), 0);
  assert.deepEqual(readAdminRecents('a', null), []); assert.equal(writeAdminRecents('a', l, {}), false); assert.equal(clearAdminRecentsStorage({}), 0);
  assert.deepEqual(readAdminRecents('a'), [], 'ב-node אין localStorage');
});

t('חיווט: app/layout.js מזריק רק כלים מותרים (selectHub); המעטפת מרכיבה את הפאנל מהאחסון ומנקה בהתנתקות; המגירה משתמשת באותו עץ', () => {
  const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const layout = src('../app/layout.js');
  assert.ok(/adminTools: selectHub\(\s*accessForRole\(emp \? emp\.roleId : null, \{ logged: !!\(isAuthenticated && emp\), requireLogin \}\)/.test(layout), 'layout: adminTools');
  assert.ok(layout.includes("'nedarim_plus_enabled'"), 'layout: ההגדרה של נדרים פלוס נטענת');
  assert.ok(/\.value !== 'false', deliveriesEnabled: showDeliveries \},\s*\)\.tools/.test(layout), 'layout: כמו app/admin/page.js — רק "false" מפורש מכבה נדרים; משלוחים לפי enable_deliveries');
  const shell = src('../app/components/menu/MenuA5Shell.js');
  assert.ok(shell.includes('const { tree, clearOnLogout: clearAdminRecents, togglePin } = useAdminRecents(serverTree);'));
  assert.ok(/nav\.clearOnLogout\(\);\s*clearAdminRecents\(\);/.test(shell), 'ניקוי בהתנתקות');
  assert.ok(shell.includes('  menuTree: serverTree,'), 'העץ מהשרת לא בשימוש ישיר');
  const hook = src('../app/components/menu/useAdminRecents.js');
  assert.ok(/^'use client';/.test(hook));
  assert.ok(hook.includes('matchAdminPoolItem(tree, pathname)') && hook.includes('applyAdminRecents(tree, adminRecentHrefs(list), pins)'));
  assert.ok(!/localStorage/.test(hook.replace(/\/\/[^\n]*/g, '')), 'גישה לאחסון רק דרך lib/menu/adminRecents.js (עטוף ב-try)');
  const lib = src('../lib/menu/adminRecents.js');
  assert.ok(!/(^|[^.])localStorage\.(get|set|remove)Item/.test(lib), 'בלי גישה ישירה שלא דרך st');
});

// ---- תיקוני סקירה (4.10.2026): חיפוש לא מוצף, סימון "אחרון", רינדור, התנתקות, אייקון ----
import { menuRowMatchesTerm } from '../lib/menu/buildMenuTree.js';
import { sameRecents } from '../lib/menu/adminRecents.js';
import { TOOLS as TOOLS_FOR_ICON } from '../lib/adminHubCatalog.js';
t('חיפוש בתפריט: תת-מחרוזת של "ניהול" ("הו","יה","ול","ני") לא מציפה בכלי ניהול; כלי שהוסר נמצא בשמו; קבוצות של לשוניות אחרות עדיין מתאימות', () => {
  const tree = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: [], adminTools: hubTools(0) });
  const flat = flattenMenuTree(tree);
  const search = (term) => flat.filter((x) => x.kind === 'link' && x.href && x.group !== 'משתמש' && x.group !== 'התראות' && menuRowMatchesTerm(x, term));
  for (const term of ['הו', 'יה', 'ול', 'ני', 'ניה', 'יהודית']) {
    const adminHits = search(term).filter((x) => x.group === 'ניהול');
    assert.ok(adminHits.every((x) => String(x.label).includes(term)), `"${term}": שורת ניהול הותאמה לפי שם הקבוצה`);
  }
  assert.ok(search('הו').filter((x) => x.group === 'ניהול').length < 8, 'לא מציף');
  assert.ok(search('גיבוי').some((x) => x.href === '/admin/backups'), 'כלי שהוסר מהפאנל נמצא בשמו');
  assert.ok(search('סטטיסטיקה').some((x) => x.href === '/admin/statistics'));
  assert.ok(flat.some((x) => x.id === 'ad-all' && x.noGroupMatch) && flat.some((x) => x.group === 'ניהול' && x.noGroupMatch));
  assert.ok(!flat.filter((x) => x.group !== 'ניהול' && x.kind !== 'tab').some((x) => x.noGroupMatch), 'רק שורות ניהול מסומנות');
  const ord = flat.find((x) => x.kind === 'link' && x.group && x.group !== 'ניהול' && x.group !== 'משתמש' && x.group !== 'התראות');
  assert.ok(search(ord.group).some((x) => x.id === ord.id), 'חיפוש לפי שם לשונית אחרת עדיין מוצא את שורותיה');
  assert.equal(menuRowMatchesTerm(null, 'x'), false); assert.equal(menuRowMatchesTerm({ label: 'a', group: 'b' }, ' '), false);
  const panel = readFileSync(new URL('../app/components/menu/MenuSearchPanel.js', import.meta.url), 'utf8');
  assert.ok(panel.includes('menuRowMatchesTerm(x, term)') && !/String\(x\.group\)\.includes\(term\)/.test(panel));
  // 5.10.2026: הפונקציה הייתה בשימוש בלי import -> ReferenceError בכל הקלדה בחיפוש תפריט A5 והמסך נפל. חייבת להיות מיובאת.
  assert.match(panel, /import\s*\{[^}]*menuRowMatchesTerm[^}]*\}\s*from\s*'@\/lib\/menu\/buildMenuTree'/, 'menuRowMatchesTerm חייב להיות מיובא');
});
t('סימון "נפתח לאחרונה": הטולטיפ לא נחתך ב-tipOf גם ל-ad-models/ad-refunds/ad-deliveries, ויש סימון גלוי (אייקון + טקסט לקורא מסך)', () => {
  const parts = readFileSync(new URL('../app/components/menu/menuParts.js', import.meta.url), 'utf8');
  const start = parts.indexOf('export function tipOf');
  const fn = parts.slice(start, parts.indexOf('\n}', start) + 2).replace('export function tipOf', 'function tipOf');
  const HIDE_TIP_IDS = new Set(['ad-models', 'ad-refunds', 'ad-deliveries', 'sched']);
  const tipOf = new Function('HIDE_TIP_IDS', `${fn}; return tipOf;`)(HIDE_TIP_IDS);
  const tree = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ enable_deliveries: 'true' }), adminTools: hubTools(0) });
  const comp = applyAdminRecents(tree, ['/dashboard/dresses', '/refunds', '/deliveries']);
  const rec = tab(comp, 'admin').items.filter((x) => x.recent);
  assert.deepEqual(rec.map((x) => x.id), ['ad-models', 'ad-refunds', 'ad-deliveries']);
  for (const it of rec) assert.equal(tipOf(it), ADMIN_RECENT_TIP, it.id);
  assert.equal(tipOf({ id: 'ad-models', tip: 'הערת תכנון' }), undefined, 'ברירת מחדל: הערת תכנון עדיין מוסתרת');
  assert.ok(/item\.recent && !k/.test(parts) && parts.includes('sn-recent') && parts.includes('נפתח לאחרונה') && parts.includes('n="sn-history"'));
  assert.ok(SPRITE_SYMBOLS.some((x) => x[0] === 'sn-history'));
  assert.ok(readFileSync(new URL('../app/components/menu/menu.css', import.meta.url), 'utf8').includes('.sn-k.sn-recent'));
});
t('useAdminRecents: לא קורא ל-setList עם מערך זהה (אין רינדור מיותר בכל ניווט)', () => {
  const a = [{ href: '/refunds', ts: 5 }, { href: '/employees', ts: 3 }];
  assert.ok(sameRecents(a, a) && sameRecents(a, a.map((x) => ({ ...x }))) && sameRecents([], []));
  assert.ok(!sameRecents(a, [a[0]]) && !sameRecents(a, [a[1], a[0]]) && !sameRecents(a, [a[0], { href: '/employees', ts: 4 }]));
  assert.ok(!sameRecents(null, []) && !sameRecents([], undefined));
  const hook = readFileSync(new URL('../app/components/menu/useAdminRecents.js', import.meta.url), 'utf8');
  assert.ok(hook.includes('setList((prev) => (sameRecents(prev, next) ? prev : next))'));
});
t('התנתקות מ-UserMenu הישן מנקה גם את "אחרוני הניהול"', () => {
  const um = readFileSync(new URL('../app/components/UserMenu.js', import.meta.url), 'utf8');
  assert.ok(um.includes("import { clearAdminRecentsStorage } from '@/lib/menu/adminRecents';"));
  const i = um.indexOf("fetch('/api/logout'");
  assert.ok(i > 0 && um.slice(0, i).includes('clearAdminRecentsStorage();'), 'הניקוי לפני בקשת ההתנתקות');
});
t('אייקון משלוחים זהה באריח (מסך /admin) ובתפריט: truck', () => {
  const tile = TOOLS_FOR_ICON.find((x) => x.id === 'deliveries');
  const menu = flattenMenuTree(buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({ enable_deliveries: 'true' }) })).find((x) => x.id === 'ad-deliveries');
  assert.equal(menu.icon, 'truck'); assert.equal(menu.icon, tile.icon);
});
// ---------------------------------------------------------------------------------------------------------------
// נעיצה: סיכה צפה על שורה בפאנל "ניהול", נשמרת לכל עובד ב-DB (8.10.2026)
// ---------------------------------------------------------------------------------------------------------------
console.log('\nנעיצה בפאנל "ניהול" (סיכה צפה, לכל עובד)');
const PIN_POOL = [
  { id: 'ad-staff', kind: 'link', label: 'עובדים', href: '/employees' },
  { id: 'ad-perms', kind: 'link', label: 'הרשאות', href: '/admin/permissions' },
  { id: 'ad-pricelist', kind: 'link', label: 'מחירון', href: '/dashboard/pricelist' },
  { id: 'ad-models', kind: 'link', label: 'דגמים', href: '/dashboard/dresses' },
  { id: 'ad-refunds', kind: 'link', label: 'זיכויים', href: '/refunds' },
  { id: 'ad-stats', kind: 'link', label: 'סטטיסטיקה', href: '/admin/statistics' },
];
const PIN_FIXED = [
  { id: 'ad-settings', kind: 'link', label: 'הגדרות מערכת', href: '/admin/settings' },
  { id: 'ad-all', kind: 'link', label: 'כל כלי הניהול', href: '/admin' },
];
const linkIds = (arr) => arr.filter((x) => x.kind === 'link').map((x) => x.id);
t('נעוץ תקוע למעלה, לפני "אחרונים"; אחרונים ממלאים רק את מה שנשאר מ-3', () => {
  const items = composeAdminItems({ pool: PIN_POOL, fixed: PIN_FIXED, recents: ['/refunds', '/employees'], pins: ['/admin/statistics'] });
  assert.deepEqual(linkIds(items), ['ad-stats', 'ad-refunds', 'ad-staff', 'ad-settings', 'ad-all']);
  assert.equal(items[0].pinned, true); assert.equal(items[0].pinnable, true); assert.ok(!items[0].recent);
  assert.equal(items[1].recent, true); assert.ok(!items[1].pinned);
  assert.ok(items.filter((x) => x.kind === 'link').slice(-2).every((x) => !x.pinnable), 'שורות קבועות אינן ניתנות לנעיצה');
});
t('שלושה נעוצים ומעלה = בלי אחרונים; חמישה נעוצים = חמש שורות + קבועות; סדר הנעיצה נשמר', () => {
  const three = composeAdminItems({ pool: PIN_POOL, fixed: PIN_FIXED, recents: ['/refunds'], pins: ['/dashboard/dresses', '/employees', '/admin/statistics'] });
  assert.deepEqual(linkIds(three), ['ad-models', 'ad-staff', 'ad-stats', 'ad-settings', 'ad-all']);
  const order = PIN_POOL.slice(0, 5).map((x) => x.href).reverse();
  const five = composeAdminItems({ pool: PIN_POOL, fixed: PIN_FIXED, pins: order });
  assert.deepEqual(five.filter((x) => x.pinned).map((x) => x.href), order);
});
t('נעוץ שאינו במאגר (הרשאה בוטלה / כלי לא קיים) נזרק בלי לשבור; כפילות ונתיב לא תקין נזרקים', () => {
  const items = composeAdminItems({ pool: PIN_POOL, fixed: PIN_FIXED, pins: ['/admin/site', '/employees', '/employees', 'javascript:1', '//evil.com', null] });
  assert.deepEqual(items.filter((x) => x.pinned).map((x) => x.id), ['ad-staff']);
  assert.deepEqual(linkIds(composeAdminItems({ pool: PIN_POOL, fixed: PIN_FIXED, pins: 'x' })), linkIds(composeAdminItems({ pool: PIN_POOL, fixed: PIN_FIXED })));
});
t('בלי נעוצים: אותן שורות כמו קודם', () => {
  const a = composeAdminItems({ pool: PIN_POOL, fixed: PIN_FIXED, recents: ['/refunds'] });
  assert.deepEqual(linkIds(a), ['ad-refunds', 'ad-staff', 'ad-perms', 'ad-settings', 'ad-all']);
  assert.ok(a.every((x) => !x.pinned));
});
t('buildMenuTree: ctx.adminPins נכנס לפאנל ול-tab.pins; הרשאות לא מורחבות (נעוץ אסור לא מופיע)', () => {
  const tree = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({}), adminPins: ['/dashboard/dresses', '/admin/zzz'] });
  const adm = tab(tree, 'admin');
  assert.deepEqual(adm.pins, ['/dashboard/dresses', '/admin/zzz']);
  assert.equal(adm.items[0].id, 'ad-models'); assert.equal(adm.items[0].pinned, true);
  assert.ok(!adm.items.some((x) => x.href === '/admin/zzz'), 'נעוץ שאינו במאגר לא מוצג');
  const branch = tab(buildMenuTree({ user: BRANCH, permissions: ALL_OPEN, settings: rows({}), adminPins: ['/admin/permissions'] }), 'admin');
  assert.ok(!branch || !branch.items.some((x) => x.href === '/admin/permissions'), 'מנהלת סניף לא מקבלת כלי הנהלה דרך נעיצה');
});
t('applyAdminRecents(tree, recents, pins) = buildMenuTree עם אותן נעיצות', () => {
  const base = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({}) });
  const viaClient = applyAdminRecents(base, ['/refunds'], ['/admin/statistics']);
  const viaServer = buildMenuTree({ user: HEAD, permissions: ALL_OPEN, settings: rows({}), adminRecents: ['/refunds'], adminPins: ['/admin/statistics'] });
  assert.deepEqual(tab(viaClient, 'admin').items, tab(viaServer, 'admin').items);
  assert.deepEqual(tab(applyAdminRecents(base, [], []), 'admin').items, tab(base, 'admin').items);
});
t('toggleAdminPin / sanitizeAdminPins: נעיצה, שחרור, מכסה 5, נתיבים לא תקינים', () => {
  let r = toggleAdminPin([], '/employees'); assert.deepEqual(r, { pins: ['/employees'], changed: true, full: false });
  r = toggleAdminPin(r.pins, '/refunds'); assert.deepEqual(r.pins, ['/employees', '/refunds']);
  r = toggleAdminPin(r.pins, '/employees'); assert.deepEqual(r, { pins: ['/refunds'], changed: true, full: false });
  const five = ['/a', '/b', '/c', '/d', '/e'];
  assert.deepEqual(toggleAdminPin(five, '/f'), { pins: five, changed: false, full: true });
  assert.deepEqual(toggleAdminPin(five, '/c').pins, ['/a', '/b', '/d', '/e']);
  assert.equal(toggleAdminPin(['/a'], 'x?y').changed, false);
  assert.deepEqual(sanitizeAdminPins(['/a', '/a', '//x', 5, { href: '/b' }, '/c', '/d', '/e', '/f', '/g']), ['/a', '/b', '/c', '/d', '/e']);
  assert.deepEqual(sanitizeAdminPins(['/' + 'x'.repeat(100)]), [], 'נתיב ארוך נדחה (העוגייה החתומה מוגבלת)');
  assert.deepEqual(sanitizeAdminPins('nope'), []); assert.ok(samePins(['/a'], ['/a'])); assert.ok(!samePins(['/a', '/b'], ['/b', '/a']));
});
t('העדפות עובד: adminPins עובר sanitize/מיזוג, נשמר בעוגייה החתומה, מערך ריק משחרר הכול, ולא חוסם הגירת localStorage', () => {
  const s1 = sanitizeDesignPrefs({ palette: 'wine', adminPins: ['/employees', 'bad', '/employees'] });
  assert.deepEqual(s1.adminPins, ['/employees']);
  const merged = mergeDesignPrefs({ v: 1, palette: 'wine', adminPins: ['/employees'] }, { mode: 'dark' });
  assert.deepEqual(merged.adminPins, ['/employees'], 'עדכון שלא מזכיר נעיצות משאיר אותן');
  assert.deepEqual(mergeDesignPrefs(merged, { adminPins: ['/refunds'] }).adminPins, ['/refunds']);
  assert.ok(!('adminPins' in mergeDesignPrefs(merged, { adminPins: [] })), 'מערך ריק = שחרור כל הנעיצות');
  assert.ok(DESIGN_PREFS_COOKIE_FIELDS.includes('adminPins'));
  assert.deepEqual(pickCookiePrefs({ palette: 'wine', mode: 'dark', adminPins: ['/employees'] }), { palette: 'wine', adminPins: ['/employees'] });
  const sp = splitServerPrefs({ v: 1, adminPins: ['/employees'] });
  assert.equal(sp.hasPrefs, false); assert.ok(!('adminPins' in sp.prefs));
  assert.equal(readDesignPrefsFromCookie(signDesignPrefsCookie('k1', { adminPins: ['/employees'] }, 'secret'), 'k1', 'secret').adminPins[0], '/employees');
});
t('חיווט הנעיצה: layout מזריק מהעוגייה, ה-hook שומר ב-PUT /api/me/design-prefs עם החזרה אחורה בכשל, ה-UI בפאנל ובמגירה, localStorage לא נושא נעיצות', () => {
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.ok(layout.includes('adminPins: employeeDesignPrefs?.adminPins'));
  const hook = readFileSync(new URL('../app/components/menu/useAdminRecents.js', import.meta.url), 'utf8');
  assert.ok(hook.includes("fetch('/api/me/design-prefs'") && hook.includes("method: 'PUT'") && hook.includes('JSON.stringify({ adminPins: r.pins })'));
  assert.ok(hook.includes('saveChain') && hook.includes('setPins(before)'));
  const shell = readFileSync(new URL('../app/components/menu/MenuA5Shell.js', import.meta.url), 'utf8');
  assert.equal((shell.match(/onTogglePin=\{tab\.id === 'admin' \? onTogglePin : undefined\}/g) || []).length, 2, 'פאנל ריחוף + מגירת נייד');
  const parts = readFileSync(new URL('../app/components/menu/menuParts.js', import.meta.url), 'utf8');
  assert.ok(parts.includes('sn-pinrow') && parts.includes('aria-pressed') && parts.includes('it.pinnable'));
  const lp = readFileSync(new URL('../app/lib/designPrefs.js', import.meta.url), 'utf8');
  assert.ok(lp.includes('adminPins: _strippedPins'), 'readLocalPrefs/writeLocalPrefs מסירים adminPins');
  const css = readFileSync(new URL('../app/components/menu/menu.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.sn-pin{') && css.includes('.sn-pinrow.is-pinned .sn-pin{'));
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
