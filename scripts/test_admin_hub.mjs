// בדיקת חוזה סטטית ל"מסך ניהול ראשי" (/admin) בעיצוב החדש (4.10.2026): מוודאת שכל החלטה של הבעלים
// (scratch/admin-hub-build/answers-admin-cards.json — הועתקה לכאן כטבלה) מיושמת: כל נתיב "כן" מופיע כאריח, כל נתיב "לא / להסיר /
// לא להכניס" לא מופיע, מטריצת תפקידים לכל אריח, ברירת מחדל אריחים, חיפוש בלי מונה, 10 קטגוריות, ושהשערים בדפים עצמם קיימים.
// בלי DB, רשת ודפדפן. הרצה: node scripts/test_admin_hub.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// בדיקה חזותית מול העיצוב: scripts/admin-hub-audit (run.mjs = השוואת computed style, interact.mjs = התנהגות ותפקידים בדפדפן).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { CATEGORIES, TOOLS, GATE_ROLES, GATES, EXCLUDED_ROUTES, visibleToolIds, accessForRole, selectHub } from '../lib/adminHubCatalog.js';
import { VIEWS, DEFAULT_VIEW, normalizeView, viewStorageKey, groupTools, toolMatches, normSearch } from '../lib/adminHubView.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const exists = (p) => existsSync(new URL(p, import.meta.url));
const ROUTE = read('../app/admin/page.js');
const SWITCH = read('../app/components/admin-hub/AdminHubSwitch.js');
const PAGE = read('../app/components/admin-hub/AdminHubPage.js');
const CSS = read('../app/components/admin-hub/admin-hub.css');
const AUTH = read('../lib/auth.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const has = (src, re, msg) => assert.ok(re.test(src), msg);
const byHref = (h) => TOOLS.find((x) => x.href === h);

// תשובות הבעלים (answers-admin-cards.txt, 61 שורות). gate: מי רואה את האריח לפי ההערה.
const YES = {
  '/admin/settings': 'head', '/admin/site': 'dev', '/admin/permissions': 'head', '/dashboard/pricelist': 'head',
  '/admin/ai': 'head', '/admin/statistics': 'head', '/admin/ai-history': 'head', '/dashboard': 'head',
  '/admin/inventory-alerts': 'head', '/admin/recalculations': 'head', '/admin/departments': 'head', '/admin/refund-policy': 'head',
  '/admin/labels': 'dev', '/design-system': 'dev', '/admin/trusted-devices': 'head', '/admin/data-explorer': 'dev', '/admin/data-explorer/full-view': 'dev',
  '/admin/access-import': 'dev', '/admin/setup-new-machine': 'head', '/admin/data-history': 'head', '/admin/database': 'dev',
  '/admin/backups': 'head', '/admin/site-settings': 'dev', '/admin/site-settings/api-keys': 'dev', '/admin/site-settings/email-logs': 'dev',
  '/admin/email-test': 'head', '/management/history': 'head', '/admin/ai-restrictions': 'dev', '/admin/barcode-invalid': 'head',
  '/admin/bulk-email': 'head', '/admin/nedarim-hok-list': 'head', '/admin/nedarim-hok-search': 'head', '/admin/nedarim-hok-edit': 'head',
  '/admin/nedarim-payments-recent': 'head', '/admin/nedarim-hok-test': 'head',
  // 4.10.2026 (תפריט "ניהול" מקוצר): מה שיצא מהשורות הקבועות של התפריט חייב להיות במסך — "כל השאר בתוך דף הניהול"
  '/refunds': 'head', '/dashboard/dresses': 'head', '/employees': 'head', '/deliveries': 'head',
};
const NO = ['/api/customers/emails', '/admin/refund-planner', '/admin/audit-system', '/management/database',
  '/admin/refund-simulator', '/admin/settings/help'];
const CAT_NAMES = ['הגדרות ומיתוג', 'תמחור וחישובים', 'נדרים פלוס - הוראות קבע', 'תובנות ודוחות', 'בקרה ואבטחה', 'נתונים והיסטוריה', 'גיבוי ושחזור', 'מיילים', 'ייבוא והתקנה', 'עבודה שוטפת'];

t('הנתיב /admin דק: השרת מחשב את השערים עם checkPageAccess ומעביר רק את הכלים המותרים; הדף נטען ב-dynamic', () => {
  has(ROUTE, /checkPageAccess\(HEAD_MANAGEMENT_ROLES\)/, 'שער הנהלה');
  has(ROUTE, /checkPageAccess\(DEVELOPER_ONLY_ROLES\)/, 'שער מתכנת');
  assert.ok(!/headOnly/.test(ROUTE), 'אין עוד שער "רק מנהל ראשי" (AH-03: רשימת הו״ק פתוחה גם למתכנת)');
  has(ROUTE, /selectHub\(\{ head, dev \}, \{ nedarimEnabled: nedarim, deliveriesEnabled: deliveries \}\)/, 'selectHub על תוצאות השערים');
  has(ROUTE, /<AdminHubSwitch tools=\{tools\} categories=\{categories\}/, 'מעביר רק את הכלים והקטגוריות המותרים');
  has(SWITCH, /dynamic\(\(\) => import\('\.\/AdminHubPage'\), \{ ssr: false \}\)/, 'dynamic');
  assert.ok(!/components\.css/.test(ROUTE + SWITCH), 'ה-CSS של הפלטה נטען רק מתוך AdminHubPage');
  has(PAGE, /import '@\/design-system\/components\.css'/, 'AdminHubPage מייבא את הפלטה');
  assert.ok(!/EmailListCard|AdminHubA5Cards|list-card/.test(ROUTE + PAGE), 'שרידי המסך הישן');
  assert.ok(!exists('../app/admin/EmailListCard.js') && !exists('../app/components/menu/AdminHubA5Cards.js'), 'קבצי המסך הישן נמחקו');
});

t('מערכי התפקיד של השערים זהים ל-lib/auth.js (HEAD_MANAGEMENT_ROLES / DEVELOPER_ONLY_ROLES)', () => {
  assert.deepEqual([...GATE_ROLES.head], JSON.parse(/HEAD_MANAGEMENT_ROLES = (\[[^\]]*\])/.exec(AUTH)[1]));
  assert.deepEqual([...GATE_ROLES.dev], JSON.parse(/DEVELOPER_ONLY_ROLES = (\[[^\]]*\])/.exec(AUTH)[1]));
  assert.deepEqual(GATES, ['head', 'dev'], 'אין שער headOnly (AH-03)');
  for (const x of TOOLS) assert.ok(GATES.includes(x.gate), `${x.id}: שער לא מוכר ${x.gate}`);
});

t('כל נתיב שהבעלים סימן "כן" מופיע כאריח אחד בדיוק, עם השער לפי ההערה', () => {
  for (const [h, g] of Object.entries(YES)) {
    const n = TOOLS.filter((x) => x.href === h);
    assert.equal(n.length, 1, `${h}: ${n.length} אריחים`);
    assert.equal(n[0].gate, g, `${h}: שער ${n[0].gate} במקום ${g}`);
  }
  assert.equal(TOOLS.length, Object.keys(YES).length, 'אריח שלא ברשימת "כן": ' + TOOLS.filter((x) => !YES[x.href]).map((x) => x.href).join(', '));
  assert.equal(new Set(TOOLS.map((x) => x.id)).size, TOOLS.length, 'מזהה כפול');
});

t('כל נתיב "לא" / "להסיר" / "לא להכניס" לא מופיע במסך (לא כאריח ולא כקישור בקוד הדף)', () => {
  for (const h of NO) {
    assert.ok(!byHref(h), `${h} מופיע כאריח`);
    assert.ok(![`'${h}'`, `"${h}"`, `\`${h}\``].some((q) => PAGE.includes(q)), `${h} בקוד הדף`);
    assert.ok(EXCLUDED_ROUTES[h], `${h} חסר בתיעוד EXCLUDED_ROUTES`);
  }
  assert.ok(!/FullEmailListModal|customers\/emails/.test(PAGE), 'חלון רשימת המיילים');
  assert.ok(!exists('../components/FullEmailListModal.js') && !exists('../app/api/customers/emails/route.js'), 'חלון רשימת המיילים וה-API שלו (בלי שימוש) נמחקו');
  // אריח מחירון אחד (שני האריחים הישנים הובילו לאותו דף), התיאור מאחד את שני הכיתובים הקיימים
  assert.equal(TOOLS.filter((x) => x.href === '/dashboard/pricelist').length, 1);
  assert.match(byHref('/dashboard/pricelist').desc, /צפייה והדפסה/);
});

t('כל אריח מוביל לדף קיים באפליקציה', () => {
  for (const x of TOOLS) {
    const f = `../app${x.href}/page.js`;
    // AH-02: /design-system הוא route handler (הפניה לדף הסטטי), לא page.js
    assert.ok(exists(f) || (x.href === '/design-system' && exists('../app/design-system/route.js') && exists('../public/design-system/index.html')), `${x.href}: אין ${f}`);
  }
});

t('9 קטגוריות בשמות של העיצוב + "עבודה שוטפת" בסוף (4.10); "זיכויים" מוזגה ל"תמחור וחישובים"; "הרשאות" ראשון ב"הגדרות ומיתוג"', () => {
  assert.equal(CATEGORIES.length, 10);
  assert.equal(byHref('/refunds').cat, 'pricing', 'זיכויים וחובות — בקטגוריה שהבעלים מיזג אליה את "זיכויים"');
  assert.deepEqual(TOOLS.filter((x) => x.cat === 'daily').map((x) => x.href), ['/dashboard/dresses', '/employees', '/deliveries']);
  assert.deepEqual(CATEGORIES.map((c) => c.title), CAT_NAMES);
  for (const c of CATEGORIES) assert.ok(TOOLS.some((x) => x.cat === c.id), `קטגוריה ריקה ${c.title}`);
  for (const x of TOOLS) assert.ok(CATEGORIES.some((c) => c.id === x.cat), `${x.id}: קטגוריה לא קיימת`);
  assert.equal(byHref('/admin/refund-policy').cat, 'pricing');
  assert.equal(TOOLS.filter((x) => x.cat === 'settings')[0].href, '/admin/permissions');
  assert.ok(CATEGORIES.every((c) => c.tag && c.icon), 'לכל קטגוריה תגית ואייקון');
  assert.deepEqual(TOOLS.filter((x) => x.cat === 'nedarim').map((x) => x.href), ['/admin/nedarim-hok-list', '/admin/nedarim-hok-search', '/admin/nedarim-hok-edit', '/admin/nedarim-payments-recent', '/admin/nedarim-hok-test']);
});

t('מטריצת תפקידים: הנהלה ראשית / מתכנת / מנהלת סניף / עובדת / אורח (פתוח וסגור)', () => {
  const head = visibleToolIds(accessForRole(0));
  const prog = visibleToolIds(accessForRole(2));
  // בלי הגדרות הארגון: אריח עם needs (משלוחים) מוסתר — כשל-סגור
  const ids = (g) => TOOLS.filter((x) => g.includes(x.gate) && !x.needs).map((x) => x.id);
  assert.deepEqual(head, ids(['head']), 'הנהלה ראשית');
  assert.deepEqual(prog, ids(['head', 'dev']), 'מתכנת');
  assert.ok(head.includes('nedarim-hok-list') && prog.includes('nedarim-hok-list'), 'רשימת הו״ק: הנהלה ראשית וגם מתכנת (AH-03)');
  assert.ok(prog.includes('design-system') && !head.includes('design-system'), 'מערכת העיצוב: רק מתכנת (AH-02)');
  for (const id of ['site', 'site-settings', 'api-keys', 'labels', 'ai-restrictions', 'data-explorer', 'data-explorer-full', 'database', 'email-logs', 'access-import']) {
    assert.ok(prog.includes(id) && !head.includes(id), `${id}: רק מתכנת`);
  }
  assert.deepEqual(visibleToolIds(accessForRole(1)), [], 'מנהלת סניף (ממילא נחסמת ב-app/admin/layout.js)');
  assert.deepEqual(visibleToolIds(accessForRole(5)), [], 'עובדת');
  assert.deepEqual(visibleToolIds(accessForRole(null, { logged: false, requireLogin: true })), [], 'אורח כשההתחברות חובה');
  assert.equal(visibleToolIds(accessForRole(null, { logged: false, requireLogin: false }), { deliveriesEnabled: true }).length, TOOLS.length, 'אורח במצב פתוח = כמו checkPageAccess (עובר כל שער)');
  assert.deepEqual(visibleToolIds(null), [], 'בלי מידע — כלום');
});

t('מה שנשלח לדפדפן: רק הכלים המותרים, בלי שדה השער, ורק הקטגוריות שיש בהן כלי', () => {
  const head = selectHub(accessForRole(0));
  assert.deepEqual(head.tools.map((x) => x.id), visibleToolIds(accessForRole(0)));
  assert.ok(head.tools.every((x) => !('gate' in x)), 'שדה gate נשלח');
  assert.ok(!head.tools.some((x) => TOOLS.find((y) => y.id === x.id).gate === 'dev'), 'כלי מתכנת נשלח להנהלה');
  assert.equal(head.categories.length, 10);
  assert.ok(head.tools.every((x) => !('pageKey' in x) && !('needs' in x)), 'שדות פנימיים נשלחו');
  assert.deepEqual(selectHub(accessForRole(1)), { tools: [], categories: [] });
});

t('משלוחים: האריח רק כש-enable_deliveries === "true" (כמו התפריט); בלי ההגדרה / כל ערך אחר — מוסתר', () => {
  assert.ok(!visibleToolIds(accessForRole(0)).includes('deliveries'));
  assert.ok(!visibleToolIds(accessForRole(0), { deliveriesEnabled: 'true' }).includes('deliveries'), 'רק true בוליאני');
  assert.ok(visibleToolIds(accessForRole(0), { deliveriesEnabled: true }).includes('deliveries'));
  assert.ok(!visibleToolIds(accessForRole(1), { deliveriesEnabled: true }).includes('deliveries'), 'מנהלת סניף — אין /admin');
  has(ROUTE, /getCachedSetting\('enable_deliveries'\)/, 'קריאת ההגדרה בשרת');
  has(ROUTE, /return !!\(s && s\.value === 'true'\)/, 'רק "true" מפורש מדליק');
  has(ROUTE, /selectHub\(\{ head, dev \}, \{ nedarimEnabled: nedarim, deliveriesEnabled: deliveries \}\)/);
});

t('nedarim_plus_enabled === "false" מסתיר את קטגוריית נדרים פלוס (בשרת); כל ערך אחר — מוצגת', () => {
  const off = selectHub(accessForRole(0), { nedarimEnabled: false });
  assert.ok(!off.tools.some((x) => x.cat === 'nedarim') && !off.categories.some((c) => c.id === 'nedarim'));
  assert.equal(off.categories.length, 9);
  assert.ok(selectHub(accessForRole(0), {}).tools.some((x) => x.cat === 'nedarim'), 'ברירת מחדל: מוצגת');
  has(ROUTE, /getCachedSetting\('nedarim_plus_enabled'\)/, 'קריאת ההגדרה בשרת');
  has(ROUTE, /return !\(s && s\.value === 'false'\)/, 'רק "false" מפורש מכבה (כמו app/orders/new/page.js)');
});

// גרף הייבוא של כל קובץ 'use client' של המסך (כמו scripts/schedule-print-tests/client-imports.test.mjs): אסור שיגיע לקטלוג
// (lib/adminHubCatalog.js — כלי מתכנת ושערים) או למודול צד-שרת.
t('קוד הלקוח לא מייבא (גם לא בעקיפין) את הקטלוג או מודול צד-שרת', () => {
  const root = new URL('../', import.meta.url);
  const src = (rel) => readFileSync(new URL(rel, root), 'utf8');
  const isFile = (rel) => { try { return statSync(new URL(rel, root)).isFile(); } catch { return false; } };
  const specs = (code) => {
    const c = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
    const out = new Set(); const re = /(?:^|[;\s])(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|(?:^|[;\s])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm;
    let m; while ((m = re.exec(c))) out.add(m[1] || m[2] || m[3]); return [...out];
  };
  const resolve = (from, spec) => {
    let base;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) { const parts = from.split('/'); parts.pop(); for (const seg of spec.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); } base = parts.join('/'); }
    else return null;
    return [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}/index.js`].find(isFile);
  };
  const FORBIDDEN_FILES = ['lib/adminHubCatalog.js', 'lib/auth.js', 'lib/authTokens.js', 'lib/settingsCache.js', 'app/lib/prisma.js', 'lib/prisma.js', 'lib/permissions.js'];
  const FORBIDDEN_SPECS = [/^next\/headers$/, /^@prisma\/client/, /^server-only$/, /^node:/];
  // + המעטפת החדשה: פאנל "ניהול" המקוצר מקבל מהשרת רק את הכלים המותרים (app/layout.js), לעולם לא את הקטלוג
  const entries = ['app/components/admin-hub/AdminHubSwitch.js', 'app/components/admin-hub/AdminHubPage.js', 'app/components/menu/MenuA5Shell.js', 'app/components/menu/useAdminRecents.js'];
  for (const e of entries) assert.ok(/^\s*'use client'/.test(src(e)), `${e} אמור להיות 'use client'`);
  const problems = [];
  for (const entry of entries) {
    const seen = new Set([entry]); const stack = [[entry, [entry]]];
    while (stack.length) {
      const [file, chain] = stack.pop();
      for (const sp of specs(src(file))) {
        if (FORBIDDEN_SPECS.some((re) => re.test(sp))) { problems.push(`${chain.join(' -> ')} -> ${sp}`); continue; }
        const rel = resolve(file, sp);
        if (!rel) continue;
        if (FORBIDDEN_FILES.includes(rel)) { problems.push(`${chain.join(' -> ')} -> ${rel}`); continue; }
        if (!seen.has(rel)) { seen.add(rel); stack.push([rel, [...chain, rel]]); }
      }
    }
    if (entry.endsWith('AdminHubSwitch.js')) assert.ok(seen.has('lib/adminHubView.js'), 'הגרף הגיע לעזרים הטהורים (בדיקת שפיות של הסורק)');
  }
  assert.deepEqual(problems, []);
  // והעזרים הטהורים לא מחזיקים שום נתון על כלים / שערים
  const view = src('lib/adminHubView.js').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/\/admin\/|gate|roleId|GATE_ROLES|TOOLS/.test(view), 'נתוני קטלוג ב-lib/adminHubView.js');
});

t('השערים בדפים עצמם: כל אריח "מתכנת בלבד" מוביל לדף עם שער DEVELOPER_ONLY_ROLES; /admin/site מעביר ל-/admin', () => {
  const layoutsFor = (href) => {
    const parts = href.split('/').filter(Boolean);
    const out = [];
    for (let i = parts.length; i >= 1; i--) { const f = `../app/${parts.slice(0, i).join('/')}/layout.js`; if (exists(f)) out.push(read(f)); }
    return out;
  };
  // AH-02: /design-system הוא קובץ סטטי ציבורי (public/design-system) שלא השתנה בכוונה — רק האריח למתכנת, לא הדף; לכן פטור משער-דף
  for (const x of TOOLS.filter((y) => y.gate === 'dev' && y.href !== '/design-system')) {
    assert.ok(layoutsFor(x.href).some((src) => /checkPageAccess\(DEVELOPER_ONLY_ROLES\)/.test(src)), `${x.href}: הדף לא בשער מתכנת`);
  }
  // /dashboard: השער בתוך page.js עצמו (layout משותף היה חוסם גם את /dashboard/dresses)
  for (const x of TOOLS) {
    const srcs = [...layoutsFor(x.href), ...(x.href === '/dashboard' ? [read('../app/dashboard/page.js')] : [])];
    // דף בשער הרשאות (PageGate page:*): הנהלה ראשית / מתכנת תמיד עוברים (ALWAYS_ALLOWED_ROLE_IDS = שער head), אז האריח בשער head מדויק
    if (x.pageKey) { assert.equal(x.gate, 'head'); assert.ok(srcs.some((src) => src.includes(`<PageGate pageKey="${x.pageKey}">`)), `${x.href}: אין PageGate ${x.pageKey}`); continue; }
    assert.ok(srcs.some((src) => /checkPageAccess\((HEAD_MANAGEMENT_ROLES|DEVELOPER_ONLY_ROLES)\)/.test(src)), `${x.href}: הדף בלי שער הנהלה`);
  }
  assert.deepEqual(JSON.parse(/ALWAYS_ALLOWED_ROLE_IDS = (\[[^\]]*\])/.exec(read('../lib/permissionsMetadata.js'))[1]), [...GATE_ROLES.head], 'הנהלה עוברת כל page:*');
  const site = read('../app/admin/site/layout.js');
  has(site, /checkPageAccess\(DEVELOPER_ONLY_ROLES\)/, '/admin/site: שער מתכנת');
  has(site, /redirect\('\/admin'\)/, '/admin/site: מי שאינו מתכנת מועבר למסך החדש');
});

t('תצוגות: שורות / טבלה / אריחים, ברירת מחדל אריחים, הבחירה נשמרת לכל משתמש ב-localStorage עם try/catch', () => {
  assert.deepEqual([...VIEWS], ['rows', 'table', 'tiles']);
  assert.equal(DEFAULT_VIEW, 'tiles');
  assert.equal(normalizeView(null), 'tiles'); assert.equal(normalizeView('bogus'), 'tiles'); assert.equal(normalizeView('rows'), 'rows');
  assert.notEqual(viewStorageKey('emp-a'), viewStorageKey('emp-b'));
  assert.equal(viewStorageKey(null), viewStorageKey(undefined));
  has(PAGE, /useState\(\(\) => readView\(storageKey\)\)/, 'מצב התחלתי מהאחסון');
  has(PAGE, /try \{\s*const v = window\.localStorage\.getItem\(key\)/, 'קריאה עטופה ב-try');
  has(PAGE, /try \{ window\.localStorage\.setItem\(storageKey, v\); \} catch/, 'כתיבה עטופה ב-try');
  has(PAGE, /className=\{`vsw v3\$\{view === 'table' \? ' t' : ''\}\$\{view === 'tiles' \? ' c' : ''\}`\}/, 'מתג תלת-מצבי של הפלטה');
  has(ROUTE, /userKey=\{me \? me\.id : null\}/, 'מפתח לכל משתמש');
});

t('חיפוש בלי מונה: שדה .hf-s מסנן לפי כותרת, תיאור או שם קטגוריה; קטגוריה בלי תוצאות נעלמת', () => {
  assert.ok(!/hres-n|adm-cnt|admCount|כלי ניהול <|\{groups\.reduce|tools\.length\}/.test(PAGE), 'מונה חזר');
  has(PAGE, /placeholder="חיפוש כלי ניהול"/, 'שדה החיפוש');
  const all = selectHub(accessForRole(2));
  const g = (q) => groupTools(all.tools, all.categories, q);
  assert.deepEqual(g('גיבוי').map((x) => x.category.id), ['backup']);
  assert.deepEqual(g('נדרים פלוס').flatMap((x) => x.tools).length, 5, 'שם קטגוריה מחזיר את כל הקטגוריה (מתכנת: כולל רשימת הו״ק, AH-03)');
  assert.deepEqual(g('overbooking').flatMap((x) => x.tools.map((y) => y.id)), ['inventory-alerts'], 'בלי תלות ברישיות');
  assert.deepEqual(g('zzzz'), []);
  assert.equal(groupTools([all.tools[0]], all.categories, '').length, 1, 'רק הכלים שהועברו');
  assert.ok(toolMatches(byHref('/admin/permissions'), '  '), 'חיפוש ריק = הכל');
  // גרשיים: ״ = " ו-׳ = ' (גם מירכאות מעוגלות)
  assert.equal(normSearch('הו"ק'), normSearch('הו״ק'));
  assert.equal(normSearch("ת'ז"), normSearch('ת׳ז'));
  assert.equal(normSearch('“הו”ק'), normSearch('"הו"ק'));
  assert.deepEqual(g('הו"ק').flatMap((x) => x.tools.map((y) => y.id)), ['nedarim-hok-search', 'nedarim-hok-edit']);
  assert.ok(toolMatches({ title: 'בדיקה', desc: 'ת׳ז' }, "ת'ז"), 'גרש עברי מול גרש רגיל');
  has(PAGE, /לא נמצאו כלים התואמים לחיפוש/, 'מצב ריק');
});

t('תגית קטגוריה בכל שורה (תצוגת שורות), כותרת קטגוריה בטבלה ובאריחים — כמו בעיצוב', () => {
  has(PAGE, /<span className="rlbl">\{category\.tag\}<\/span>/, 'תגית בכל שורה');
  has(PAGE, /<h2 className="adm-h"><span className="adm-hi">/, 'כותרת קטגוריה');
  has(PAGE, /<th>כלי<\/th><th>תיאור<\/th>/, 'עמודות הטבלה');
  has(PAGE, /className="creditile adm-tile"/, 'אריח');
});

t('בלי חלונות דפדפן ובלי console; אייקונים מה-sprite המוטמע; שורש .gm-ds.gm-adm.home-bg בלי gm-home', () => {
  assert.ok(!/window\.(alert|confirm|prompt)|\b(alert|confirm)\(/.test(PAGE), 'alert/confirm');
  assert.ok(!/console\./.test(PAGE + ROUTE), 'console');
  has(PAGE, /className="gm-ds gm-adm home-bg"/, 'שורש');
  assert.ok(!/gm-home/.test(PAGE), 'gm-home בשורש');
  assert.ok(!/sprite\.svg/.test(PAGE), 'sprite חיצוני');
  has(PAGE, /<HomeSprite \/>/, 'sprite מוטמע');
  assert.ok(!/style=\{\{/.test(PAGE), 'סגנון inline');
});

t('אייקונים: כל אייקון של כלי/קטגוריה קיים ב-sprite של הפלטה', () => {
  const sprite = read('../design-system/sprite.svg');
  for (const id of new Set([...TOOLS.map((x) => x.icon), ...CATEGORIES.map((c) => c.icon), 'search', 'x', 'arrl', 'rows', 'table', 'box'])) {
    assert.ok(sprite.includes(`id="i-${id}"`), `אייקון ${id} לא בפלטה`);
  }
});

t('נגישות: טקסט נסתר בעמודת המעבר, טבעת מיקוד לאריח, ובלי סמן "לחיץ" על שורת טבלה שאינה לחיצה', () => {
  has(PAGE, /<th className="tc"><span className="hf-sr">מעבר לכלי<\/span><\/th>/, 'th ריק בלי טקסט נסתר');
  has(CSS, /\.gm-ds\.gm-adm \.adm-tile:focus-visible\{outline:3px solid var\(--gm-gold\)/, 'טבעת מיקוד לאריח');
  assert.ok(!/tr:has\(\.trl\)\{cursor:pointer/.test(CSS), 'cursor:pointer על שורה שלמה בלי שהשורה לחיצה');
});

t('admin-hub.css: כל כלל בהיקף .gm-ds.gm-adm (חוץ מביטול ריפוד המעטפת)', () => {
  const sels = CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0].trim()).filter((s) => s && !s.startsWith('@'));
  // פיצול לפי פסיקים ברמה העליונה בלבד (לא בתוך :is(...) / :where(...))
  const split = (sel) => { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
  const bad = sels.flatMap(split).map((s) => s.trim()).filter((s) => s && !/^\.gm-ds\.gm-adm(\s|$|:)/.test(s) && s !== '.app-shell .main .content:has(> .gm-ds.gm-adm)');
  assert.deepEqual(bad, []);
});

console.log(`\n${passed} passed`);
if (process.exitCode) process.exit(1);
