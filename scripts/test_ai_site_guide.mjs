// scripts/test_ai_site_guide.mjs - בדיקת הרישום של "מדריך האתר" של עוזר ה-AI. נכשלת (exit 1) כשנוספת route / פריט תפריט / כלי ניהול /
// קטגוריית הגדרות בלי יעד או דף ברישום, כשיעד מצביע על data-guide-id שלא קיים בקוד, או כשיש data-guide-id בקוד בלי יעד.
//
// הרצה (מתוך שורש הפרויקט):
//   node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/test_ai_site_guide.mjs [--area orders]
// (ה-register נדרש רק בגלל ה-alias `@/` שבו משתמשים קטלוגי ההגדרות; בלי DB, רשת או Gemini)
// --area <שם>: מציג רק כשלים של אזור אחד (menu|home|orders|people|admin) - לסוכן שעובד על אזור אחד בלבד. בלי הדגל: הכול.
// תיעוד ו"איך מוסיפים יעד חדש": docs/ai-site-guide.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const onlyArea = argv.includes('--area') ? argv[argv.indexOf('--area') + 1] : null;

const { TARGETS, TARGET_AREAS, DYNAMIC_ID_PATTERNS, TARGETS_BY_ID } = await import('../lib/aiGuide/index.js');
const { PAGES, TASKS, SKIPPED_ROUTES, AREAS } = await import('../lib/aiGuide/index.js');
const { validateTargetShape, GUIDE_ID_RE, routeMatches, ANY_ROUTE } = await import('../lib/aiGuide/schema.js');
const { MENU_DEFS } = await import('../lib/menu/buildMenuTree.js');
const { TOOLS: HUB_TOOLS } = await import('../lib/adminHubCatalog.js');
const { ROUTE_LABELS, pageLabel, hasPageLabel } = await import('../lib/menu/pageLabels.js');

let passed = 0;
let failed = 0;
const failures = [];
function check(name, area, fn) {
  try {
    const errs = fn();
    const list = Array.isArray(errs) ? errs : (errs ? [String(errs)] : []);
    if (list.length === 0) { passed++; return; }
    if (onlyArea && area && area !== onlyArea) return;
    failed++;
    failures.push({ name, errs: list });
  } catch (e) {
    failed++;
    failures.push({ name, errs: [`חריגה: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`] });
  }
}

// --- שיוך יעד לאזור (לסינון --area) ---
const areaOfTarget = Object.fromEntries(Object.entries(TARGET_AREAS).flatMap(([a, m]) => m.targets.map((t) => [t.id, a])));
// שיוך מוסכם של כל route לאזור (מי אחראי על רישום הדף): home = בית/חיפוש/לוז/לוח/מלאי/פרופיל ושאר דפי העובדת;
// orders = הזמנות/השכרות/תיקונים/זיכויים/משלוחים; people = לקוחות/דגמים/מחירון/עובדים; admin = /admin/*, /dashboard, /management/*
// ops = כלי הניהול התפעוליים (נדרים, גיבויים, מיילים, זיכויים-תיעוד, רשימות ניהול וכו'); admin = הגדרות/הרשאות/AI/סטטיסטיקה/היסטוריה/מסך הניהול
const OPS_ROUTES = new Set(["/admin/nedarim-hok-edit", "/admin/nedarim-hok-list", "/admin/nedarim-hok-search", "/admin/nedarim-hok-test", "/admin/nedarim-payments-recent", "/admin/backups", "/admin/bulk-email", "/admin/email-test", "/admin/inventory-alerts", "/admin/trusted-devices", "/admin/recalculations", "/admin/refund-planner", "/admin/refund-policy", "/admin/refund-simulator", "/admin/orders-list", "/admin/customers-list", "/admin/access-import", "/admin/setup-new-machine", "/admin/barcode-invalid", "/admin/audit-system", "/refund-questionnaire", "/refund-questionnaire/answers"]);
export function routeAreaOf(r) {
  if (OPS_ROUTES.has(r)) return "ops";
  if (r.startsWith("/admin") || r.startsWith("/management") || r === "/dashboard") return "admin";
  if (/^\/(orders|rentals|alterations|refunds|deliveries)(\/|$)/.test(r) || ["/print/alterations", "/print/delivery-bag", "/print/delivery-courier", "/print/order", "/print/order-history"].includes(r)) return "orders";
  if (/^\/(customers|employees)(\/|$)/.test(r) || r.startsWith("/dashboard/") || r === "/print/customer") return "people";
  return 'home';
}
const areaOfRoute = Object.fromEntries(Object.entries(AREAS).flatMap(([a, m]) => [...m.pages.map((p) => [p.route, a]), ...Object.keys(m.skip || {}).map((r) => [r, a])]));

// --- סריקת הקוד: routes ו-data-guide-id ---
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const rel0 = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const appFiles = walk(path.join(ROOT, 'app')).filter((f) => /\.(js|jsx)$/.test(f) &&!rel0(f).startsWith('app/components/guide/'));
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

const pageRoutes = appFiles
  .filter((f) => path.basename(f) === 'page.js' && !rel(f).startsWith('app/api/'))
  .map((f) => '/' + rel(f).replace(/^app\//, '').replace(/\/?page\.js$/, '').replace(/\[([^\]]+)\]/g, ':$1'))
  .map((r) => (r === '/' ? '/' : r.replace(/\/$/, '')))
  .sort();

const GUIDE_ATTR_RE = /data-guide-id=(?:"([^"]+)"|'([^']+)'|\{\s*"([^"]+)"\s*\}|\{\s*'([^']+)'\s*\}|\{\s*`([^`]+)`\s*\}|\{([^}"'`][^}]*)\})/g;
const literalIds = new Map(); // id -> [files]
const templateUses = []; // { file, expr }
for (const f of appFiles) {
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('data-guide-id')) continue;
  let m;
  GUIDE_ATTR_RE.lastIndex = 0;
  while ((m = GUIDE_ATTR_RE.exec(src))) {
    const lit = m[1] || m[2] || m[3] || m[4];
    const tpl = m[5];
    const expr = m[6];
    if (lit) { if (!literalIds.has(lit)) literalIds.set(lit, []); literalIds.get(lit).push(rel(f)); }
    else if (tpl && !tpl.includes('${')) { if (!literalIds.has(tpl)) literalIds.set(tpl, []); literalIds.get(tpl).push(rel(f)); }
    else templateUses.push({ file: rel(f), expr: tpl || expr });
  }
}
const allSrcCache = new Map();
const readSrc = (relPath) => { if (!allSrcCache.has(relPath)) allSrcCache.set(relPath, fs.existsSync(path.join(ROOT, relPath)) ? fs.readFileSync(path.join(ROOT, relPath), 'utf8') : null); return allSrcCache.get(relPath); };

// ============ בדיקות ============
check('צורת היעדים תקינה, מזהים ייחודיים', null, () => {
  const errs = [];
  const seen = new Set();
  for (const t of TARGETS) {
    if (seen.has(t.id)) errs.push(`מזהה כפול: ${t.id}`);
    seen.add(t.id);
    for (const e of validateTargetShape(t)) { if (!onlyArea || areaOfTarget[t.id] === onlyArea) errs.push(e); }
  }
  return errs;
});

for (const area of Object.keys(TARGET_AREAS)) {
  check(`אזור ${area}: מזהי היעדים מתחילים בקידומת מותרת`, area, () => {
    const errs = [];
    for (const t of TARGET_AREAS[area].targets) if (!GUIDE_ID_RE.test(t.id)) errs.push(`${t.id}: מזהה לא תקין`);
    return errs;
  });
}

check('parent / reveal מפנים ליעדים קיימים', null, () => {
  const errs = [];
  for (const t of TARGETS) {
    if (onlyArea && areaOfTarget[t.id] !== onlyArea) continue;
    if (t.parent && !TARGETS_BY_ID[t.parent]) errs.push(`${t.id}: parent לא קיים (${t.parent})`);
    if (t.parent === t.id) errs.push(`${t.id}: parent של עצמו`);
    for (const s of t.reveal || []) if (s.click && !TARGETS_BY_ID[s.click]) errs.push(`${t.id}: reveal.click לא קיים (${s.click})`);
  }
  return errs;
});

check('route של כל יעד הוא נתיב אמיתי של האתר (או *)', null, () => {
  const errs = [];
  const real = new Set(pageRoutes);
  for (const t of TARGETS) {
    if (onlyArea && areaOfTarget[t.id] !== onlyArea) continue;
    if (t.route === ANY_ROUTE) continue;
    if (!real.has(t.route)) errs.push(`${t.id}: route ${t.route} אינו page.js קיים`);
  }
  return errs;
});

check('כל data-guide-id בקוד רשום כיעד (בלי יתומים)', null, () => {
  const errs = [];
  for (const [id, files] of literalIds) {
    if (!TARGETS_BY_ID[id]) {
      const covered = DYNAMIC_ID_PATTERNS.some((d) => id.startsWith(d.prefix));
      if (!covered && (!onlyArea || true)) errs.push(`data-guide-id="${id}" (${files[0]}) ללא יעד ברישום`);
    }
  }
  for (const u of templateUses) {
    const ok = DYNAMIC_ID_PATTERNS.some((d) => d.file === u.file);
    if (!ok) errs.push(`data-guide-id דינמי (${u.expr.slice(0, 50)}) ב-${u.file} בלי הצהרת dynamic באזור`);
  }
  return errs;
});

check('כל יעד רשום מופיע בקוד כ-data-guide-id (או כתבנית דינמית מוצהרת)', null, () => {
  const errs = [];
  const dynById = (id) => DYNAMIC_ID_PATTERNS.find((d) => id.startsWith(d.prefix));
  for (const t of TARGETS) {
    if (onlyArea && areaOfTarget[t.id] !== onlyArea) continue;
    if (literalIds.has(t.id)) continue;
    const d = dynById(t.id);
    if (d) continue; // תבנית דינמית: האימות לפי הצהרת dynamic (בדיקה נפרדת)
    errs.push(`${t.id}: אין data-guide-id="${t.id}" בקוד`);
  }
  return errs;
});

check('הצהרות dynamic מצביעות לקובץ שמכיל את הקידומת כתבנית', null, () => {
  const errs = [];
  for (const d of DYNAMIC_ID_PATTERNS) {
    const src = readSrc(d.file);
    if (src === null) { errs.push(`dynamic ${d.prefix}: הקובץ ${d.file} לא קיים`); continue; }
    if (!src.includes('data-guide-id') || !src.includes(d.prefix)) errs.push(`dynamic ${d.prefix}: ${d.file} לא מכיל data-guide-id עם הקידומת`);
  }
  return errs;
});

// --- תפריט ---
check('כל פריט/לשונית ב-buildMenuTree (MENU_DEFS) יש לו יעד', 'menu', () => {
  const errs = [];
  const have = new Set(TARGETS.filter((t) => t.menuItem).map((t) => t.menuItem));
  for (const k of Object.keys(MENU_DEFS.items)) if (!have.has(k)) errs.push(`פריט תפריט "${k}" ללא יעד (lib/aiGuide/areas/menu.targets.js)`);
  for (const tb of MENU_DEFS.tabs) if (!have.has(`tab:${tb.id}`)) errs.push(`לשונית "${tb.id}" ללא יעד`);
  return errs;
});
check('menuItem בכל יעד קיים ב-MENU_DEFS', 'menu', () => {
  const errs = [];
  const tabIds = new Set(MENU_DEFS.tabs.map((x) => x.id));
  for (const t of TARGETS) {
    if (!t.menuItem) continue;
    const ok = t.menuItem.startsWith('tab:') ? tabIds.has(t.menuItem.slice(4)) : !!MENU_DEFS.items[t.menuItem];
    if (!ok) errs.push(`${t.id}: menuItem "${t.menuItem}" לא קיים בתפריט`);
  }
  return errs;
});
check('תווית יעד תפריט זהה לתווית בקוד התפריט', 'menu', () => {
  const errs = [];
  for (const t of TARGETS) {
    if (!t.menuItem) continue;
    const def = t.menuItem.startsWith('tab:') ? MENU_DEFS.tabs.find((x) => x.id === t.menuItem.slice(4)) : MENU_DEFS.items[t.menuItem];
    if (def && !String(t.label).includes(def.label) && !(t.id.endsWith('-more'))) errs.push(`${t.id}: label "${t.label}" שונה מ-"${def.label}" בתפריט`);
  }
  return errs;
});

// --- מסך הניהול ---
check('כל כלי ב-adminHubCatalog.TOOLS יש לו יעד hub.*', 'admin', () => {
  const errs = [];
  const have = new Set(TARGETS.filter((t) => t.hubTool).map((t) => t.hubTool));
  for (const tool of HUB_TOOLS) if (!have.has(tool.id)) errs.push(`כלי ניהול "${tool.id}" (${tool.title}) ללא יעד hub`);
  const ids = new Set(HUB_TOOLS.map((x) => x.id));
  for (const t of TARGETS) if (t.hubTool && !ids.has(t.hubTool)) errs.push(`${t.id}: hubTool "${t.hubTool}" לא קיים בקטלוג`);
  return errs;
});

// --- דפים ---
const pageByRoute = new Map(PAGES.map((p) => [p.route, p]));
check('כל page.js באתר רשום ב-PAGES או ב-skip עם סיבה', null, () => {
  const errs = [];
  for (const r of pageRoutes) {
    if (onlyArea && routeAreaOf(r) !== onlyArea) continue;
    if (!pageByRoute.has(r) && !SKIPPED_ROUTES[r]) errs.push(`route ${r}: אין רישום ב-lib/aiGuide/areas/*.js (pages או skip)`);
  }
  for (const [r, why] of Object.entries(SKIPPED_ROUTES)) {
    if (!pageRoutes.includes(r)) errs.push(`skip ${r}: אינו route קיים`);
    if (typeof why !== 'string' || why.trim().length < 6) errs.push(`skip ${r}: חסרה סיבה`);
    if (pageByRoute.has(r)) errs.push(`route ${r}: גם ב-PAGES וגם ב-skip`);
  }
  for (const p of PAGES) if (!pageRoutes.includes(p.route)) errs.push(`PAGES ${p.route}: אינו route קיים`);
  return errs;
});
check('שדות דף תקינים (title תואם pageLabel, ui, about, can)', null, () => {
  const errs = [];
  const UI = new Set(['new', 'both', 'same']);
  const dup = new Set();
  for (const p of PAGES) {
    if (onlyArea && areaOfRoute[p.route] !== onlyArea) continue;
    if (dup.has(p.route)) errs.push(`route כפול ${p.route}`); dup.add(p.route);
    if (typeof p.title !== 'string' || !/[א-ת]/.test(p.title)) errs.push(`${p.route}: title חסר`);
    else if (hasPageLabel(p.route) && pageLabel(p.route) !== p.title && !p.titleNote) errs.push(`${p.route}: title "${p.title}" שונה מ-pageLabel "${pageLabel(p.route)}" (הוסיפו titleNote אם בכוונה)`);
    if (!UI.has(p.ui)) errs.push(`${p.route}: ui חייב להיות new|both|same`);
    if (typeof p.about !== 'string' || p.about.trim().length < 12) errs.push(`${p.route}: about חסר`);
    if (!Array.isArray(p.can) || p.can.length === 0) errs.push(`${p.route}: can חסר (רשימת יכולות מאומתות)`);
    if (p.reach !== undefined && p.reach !== 'auto' && typeof p.reach !== 'string') errs.push(`${p.route}: reach לא תקין`);
    for (const id of p.targets || []) if (!TARGETS_BY_ID[id]) errs.push(`${p.route}: targets מצביע על יעד לא קיים ${id}`);
  }
  return errs;
});

// --- משימות ---
check('משימות "איך עושים" תקינות (מזהים, צעדים, יעדים, אסימוני {{label:..}})', null, () => {
  const errs = [];
  const seen = new Set();
  const TOKEN_RE = /\{\{\s*(label|path)\s*:\s*([a-z0-9.-]+)\s*\}\}/g;
  for (const t of TASKS) {
    const own = t.id;
    if (!/^task\.[a-z0-9-]+$/.test(own || '')) errs.push(`משימה: id לא תקין (${own})`);
    if (seen.has(own)) errs.push(`משימה כפולה ${own}`); seen.add(own);
    if (!t.title || !/[א-ת]/.test(t.title)) errs.push(`${own}: title חסר`);
    if (!Array.isArray(t.steps) || t.steps.length === 0 || t.steps.some((s) => typeof s !== 'string' || !s.trim())) errs.push(`${own}: steps חסר`);
    if (!Array.isArray(t.aliases) || t.aliases.length === 0) errs.push(`${own}: aliases חסר (ניסוחים שבהם שואלים)`);
    for (const id of t.points || []) if (!TARGETS_BY_ID[id]) errs.push(`${own}: points מצביע על יעד לא קיים ${id}`);
    for (const s of t.steps || []) {
      let m; TOKEN_RE.lastIndex = 0;
      while ((m = TOKEN_RE.exec(s))) if (!TARGETS_BY_ID[m[2]]) errs.push(`${own}: אסימון ${m[0]} מפנה ליעד לא קיים`);
    }
  }
  return errs;
});

// --- זרימת המדריך: הקשרים לדוגמה לכל סוג משתמשת (בלי DB) ---
const { buildMenuTree, deriveLegacyFlags, NAV_PAGE_KEYS, MENU_PAGE_KEYS } = await import('../lib/menu/buildMenuTree.js');
const { selectHub, accessForRole } = await import('../lib/adminHubCatalog.js');
const { buildGuideBlock, menuItemIdsOf, describeMenuTree, resolveTokens, indexMenuTree, tokenize } = await import('../lib/aiGuide/knowledge.js');
const { finalizeGuideTags, LEGACY_PHRASE_RE } = await import('../lib/aiGuide/resolve.js');
const { collectPermissionKeys, checkAccess } = await import('../lib/aiGuide/access.js');

const ALL_KEYS = [...new Set([...NAV_PAGE_KEYS, ...MENU_PAGE_KEYS, ...collectPermissionKeys({ pages: PAGES, targets: TARGETS, tasks: TASKS })])];
function makeCtx({ roleId, logged = true, settings = {}, openKeys = null, currentPath = '/' }) {
  const rows = Object.entries({ require_login: 'true', ...settings }).map(([key, value]) => ({ key, value }));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const head = roleId === 0 || roleId === 2;
  const perms = logged ? Object.fromEntries(ALL_KEYS.map((k) => [k, head ? true : (openKeys ? openKeys.includes(k) : false)])) : null;
  const flags = deriveLegacyFlags({ logged, roleId, permissions: perms, settings: rows });
  const adminTools = selectHub(accessForRole(roleId, { logged, requireLogin: true }), { nedarimEnabled: map.nedarim_plus_enabled !== 'false', deliveriesEnabled: !!flags.showDeliveries }).tools;
  const tree = buildMenuTree({ user: logged ? { id: 'u1', roleId } : null, roleId, permissions: perms, settings: rows, flags, homeA5: true, available: { 'order-stock': true }, adminTools });
  return { logged, roleId, head: !!flags.isHeadManagement, prog: logged && roleId === 2, perms: perms || {}, settings: map, tree, variants: { shell: 'a5' }, currentPath, menuItemIds: menuItemIdsOf(tree), hubToolIds: new Set(adminTools.map((t) => t.id)), rail: tree.rail };
}
const OPEN = ['page:orders', 'page:orders_new', 'page:rentals', 'page:customers', 'page:messages', 'page:schedule', 'page:alterations'];
const CTXS = {
  head: makeCtx({ roleId: 0 }),
  prog: makeCtx({ roleId: 2, settings: { enable_deliveries: 'true' } }),
  branch: makeCtx({ roleId: 1, openKeys: OPEN }),
  employee: makeCtx({ roleId: 4, openKeys: OPEN }),
};

check('הידע שנבנה לכל סוג משתמשת: בלי ביטויי ממשק ישן, בלי יעד לא רשום, ובלי דליפת ניהול לעובדת', null, () => {
  const errs = [];
  for (const [name, ctx] of Object.entries(CTXS)) {
    for (const q of ['איך פותחים הזמנה חדשה', 'איפה ההגדרות', 'האם אפשר לשלוח מייל ללקוחה', 'איפה רואים את הלוז של מחר']) {
      const b = buildGuideBlock(ctx, { question: q });
      if (LEGACY_PHRASE_RE.test(b.text)) errs.push(`${name}/"${q}": הטקסט שנבנה מכיל ביטוי של ממשק ישן: ${(b.text.match(LEGACY_PHRASE_RE) || [])[0]}`);
      for (const id of b.allowedIds) if (!TARGETS_BY_ID[id]) errs.push(`${name}: allowedIds מכיל יעד שלא ברישום ${id}`);
      for (const m of b.text.matchAll(/\[\[guide:([a-z0-9.-]+)\]\]/g)) if (!b.allowedIds.has(m[1])) errs.push(`${name}: בטקסט נשלח למודל יעד לא זמין ${m[1]}`);
      if (b.stats.chars > 60000) errs.push(`${name}/"${q}": הפרומפט גדול מדי (${b.stats.chars} תווים)`);
    }
  }
  const emp = buildGuideBlock(CTXS.employee, { question: 'איפה ההגדרות והרשאות' });
  const leaked = [...emp.allowedIds].filter((i) => /^(menu\.ad-(?!nwd)|hub\.)/.test(i));
  if (leaked.length) errs.push(`עובדת רגילה קיבלה יעדי ניהול: ${leaked.slice(0, 5).join(', ')}`);
  if (/הגדרות מערכת \|/.test(emp.text)) errs.push('עובדת רגילה: אינדקס הדפים מכיל את הגדרות המערכת');
  const prog = buildGuideBlock(CTXS.prog, { question: 'משלוחים' });
  if (!prog.allowedIds.has('menu.ad-deliveries')) errs.push('מתכנת עם משלוחים מופעלים: חסר menu.ad-deliveries');
  const head = buildGuideBlock(CTXS.head, { question: 'משלוחים' });
  if (head.allowedIds.has('menu.ad-deliveries')) errs.push('משלוחים כבויים בארגון אך menu.ad-deliveries הוצג');
  return errs;
});

check('פריטים מוסתרים: עובדת רגילה רואה ברשימת "קיים אך מוסתר" את לוח חודשי, ולא כלי ניהול', null, () => {
  const errs = [];
  const b = buildGuideBlock(CTXS.employee, { question: 'אין לי לוח חודשי' });
  const m = b.text.match(/HIDDEN FROM THIS USER[^\n]*\n([^\n]*)/);
  if (!m) return ['אין בלוק HIDDEN'];
  if (!m[1].includes('לוח חודשי')) errs.push('"לוח חודשי" לא ברשימת המוסתרים לעובדת בלי הרשאת לוח');
  if (/הרשאות|הגדרות מערכת|סטטיסטיקה|נדרים/.test(m[1])) errs.push('רשימת המוסתרים חושפת כלי ניהול: ' + m[1].slice(0, 120));
  return errs;
});

check('finalizeGuideTags: מזהה לא מוכר נזרק, כפילות מצטמצמת, URL/סלקטור חופשי לא עובר, הטקסט מנוקה', null, () => {
  const errs = [];
  const ctx = CTXS.head;
  const b = buildGuideBlock(ctx, { question: 'הזמנה חדשה' });
  const out = finalizeGuideTags('לחצי על הזמנה חדשה. [[guide:menu.order-new]] [[guide:bogus.id]] [[guide:menu.order-new]] [[guide:javascript:alert(1)]] [[guide:/orders/new]]', { allowedIds: b.allowedIds, ctx });
  if (out.steps.length !== 1 || out.steps[0].id !== 'menu.order-new') errs.push(`צעדים צפויים [menu.order-new], התקבל ${JSON.stringify(out.steps.map((s) => s.id))}`);
  if (/\[\[/.test(out.text)) errs.push('התגיות לא הוסרו מהטקסט');
  if (out.dropped.length < 2) errs.push(`צפוי לזרוק לפחות 2 מזהים לא חוקיים, נזרקו ${out.dropped.length}`);
  // יעד שאינו זמין לעובדת -> לא מחזירים (אין אב זמין)
  const emp = finalizeGuideTags('[[guide:menu.ad-settings]]', { allowedIds: buildGuideBlock(CTXS.employee, { question: 'הגדרות' }).allowedIds, ctx: CTXS.employee });
  if (emp.steps.length) errs.push(`עובדת רגילה קיבלה צעד ניהול: ${emp.steps[0].id}`);
  if (emp.dropped.length !== 1) errs.push('יעד לא מותר לעובדת היה צריך להיזרק');
  // מגבלת צעדים
  const many = finalizeGuideTags(TARGETS.filter((t) => t.route === '*').slice(0, 8).map((t) => `[[guide:${t.id}]]`).join(' '), { allowedIds: new Set(TARGETS.map((t) => t.id)), ctx });
  if (many.steps.length > 4) errs.push('יותר מ-4 צעדים');
  // אלמנט בתוך רשומה כשלא נמצאים בדף רשומה => נופל לאב או נזרק
  const ent = TARGETS.find((t) => t.entity);
  if (ent) {
    const r = finalizeGuideTags(`[[guide:${ent.id}]]`, { allowedIds: new Set(TARGETS.map((t) => t.id)), ctx: { ...ctx, currentPath: '/' } });
    if (r.steps.some((s) => s.id === ent.id)) errs.push(`יעד entity ${ent.id} הוחזר בלי שנמצאים בדף רשומה`);
    const r2 = finalizeGuideTags(`[[guide:${ent.id}]]`, { allowedIds: new Set(TARGETS.map((t) => t.id)), ctx: { ...ctx, currentPath: ent.route.replace(/:[a-zA-Z]+/g, '123') } });
    if (!r2.steps.some((s) => s.id === ent.id)) errs.push(`יעד entity ${ent.id} לא הוחזר בתוך דף רשומה`);
  }
  return errs;
});

check('דפים עם reach=auto: יש להם פריט בעץ התפריט של הנהלה (אחרת חובה reach מפורש)', null, () => {
  const errs = [];
  const idx = indexMenuTree(makeCtx({ roleId: 2, settings: { enable_deliveries: 'true', branches_enabled: 'true' } }).tree);
  for (const p of PAGES) {
    if (onlyArea && areaOfRoute[p.route] !== onlyArea) continue;
    if (p.reach && p.reach !== 'auto') continue;
    if (!idx.byPath.has(p.route) && !p.route.includes(':')) errs.push(`${p.route}: אין פריט תפריט לנתיב הזה - הוסיפו reach מפורש (טקסט) לדף`);
    if (p.route.includes(':') && (!p.reach || p.reach === 'auto')) errs.push(`${p.route}: דף דינמי חייב reach מפורש`);
  }
  return errs;
});

check('אסימוני {{label/path}} במשימות נפתרים לטקסט עברי לא ריק', null, () => {
  const errs = [];
  const ctx = CTXS.head;
  const mi = indexMenuTree(ctx.tree);
  for (const t of TASKS) {
    if (onlyArea && !(t.pages || []).some((r) => routeAreaOf(r) === onlyArea)) continue;
    for (const s of t.steps || []) {
      const out = resolveTokens(s, ctx, mi);
      if (/\{\{/.test(out) || /""|"\s+"/.test(out)) errs.push(`${t.id}: צעד עם אסימון לא פתור: ${out.slice(0, 80)}`);
      if (LEGACY_PHRASE_RE.test(out)) errs.push(`${t.id}: צעד מכיל ביטוי של ממשק ישן: ${out.slice(0, 80)}`);
    }
  }
  return errs;
});

check('טקסט הרישום (about/can/steps/where) לא מכיל ביטויי ממשק ישן', null, () => {
  const errs = [];
  const bad = (s) => typeof s === 'string' && LEGACY_PHRASE_RE.test(s);
  for (const p of PAGES) for (const f of [p.about, p.reach, p.notes, ...(p.can || []), ...(p.cannot || [])]) if (bad(f)) errs.push(`דף ${p.route}: "${String(f).slice(0, 60)}"`);
  for (const t of TASKS) for (const f of [t.title, t.notes, ...(t.steps || [])]) if (bad(f)) errs.push(`משימה ${t.id}: "${String(f).slice(0, 60)}"`);
  for (const t of TARGETS) for (const f of [t.where, t.hint, t.label, ...(t.aliases || [])]) if (bad(f)) errs.push(`יעד ${t.id}: "${String(f).slice(0, 60)}"`);
  return errs;
});

const __locErrs = await (async () => {
  const errs = [];
  const { locateSetting } = await import('../lib/aiGuide/settingsLocation.js');
  const { appendSettingLocations } = await import('../lib/aiGuide/settingsLocationText.js');
  const { describeUserVariant } = await import('../lib/aiGuide/knowledge.js');
  const loc = locateSetting({ key: 'hok_enabled', category: 'הוראת קבע' });
  if (!loc || !/לשונית "תשלומים"/.test(loc.text) || loc.path !== '/admin/settings') errs.push('מיקום hok_enabled שגוי: ' + JSON.stringify(loc));
  const catalog = [{ key: 'hok_enabled', name: 'הפעל הוראת קבע', location: loc && loc.text }];
  const out = appendSettingLocations('טקסט\n[OPEN_SETTING:hok_enabled]', catalog);
  if (!/מיקום "הפעל הוראת קבע": הגדרות מערכת/.test(out) || !/\[OPEN_SETTING:hok_enabled\]/.test(out)) errs.push('שורת מיקום לא נוספה: ' + out);
  const v = describeUserVariant({ variants: { shell: 'legacy', new_order: 'legacy' }, currentPath: '/' }, ['/orders/new']);
  if (!v.shellOld || !v.oldScreens.some((s) => s.id === 'new_order')) errs.push('תצוגה ישנה לא זוהתה: ' + JSON.stringify(v));
  const v2 = describeUserVariant({ variants: { shell: 'a5', home: 'a5', new_order: 'a5' }, currentPath: '/' }, ['/orders/new']);
  if (v2.shellOld || v2.oldScreens.length) errs.push('תצוגה חדשה סומנה כישנה');
  return errs;
})();
check('מיקום הגדרה במסך ההגדרות החדש נגזר מהמיפוי; שורת מיקום נוספת בקוד; תצוגה ישנה מזוהה', null, () => __locErrs);

check('tokenize: קידומות עבריות ומילות עצירה', null, () => {
  const t = tokenize('איך מדפיסים את התווית בהזמנה');
  const errs = [];
  if (!t.has('הזמנה') || !t.has('זמנה')) errs.push('הקידומת "ב" לא הוסרה');
  if (t.has('איך')) errs.push('מילת עצירה לא הוסרה');
  return errs;
});

// --- תוצאות ---
if (failures.length) {
  console.error(`\nנכשלו ${failures.length} בדיקות${onlyArea ? ` (אזור ${onlyArea})` : ''}:`);
  for (const f of failures) {
    console.error(`\n  FAIL - ${f.name}`);
    for (const e of f.errs.slice(0, 40)) console.error(`        ${e}`);
    if (f.errs.length > 40) console.error(`        ... ועוד ${f.errs.length - 40}`);
  }
}
console.log(`\nיעדים: ${TARGETS.length}, דפים: ${PAGES.length}, משימות: ${TASKS.length}, routes באתר: ${pageRoutes.length}; עברו ${passed}, נכשלו ${failed}`);
process.exit(failed ? 1 : 0);
