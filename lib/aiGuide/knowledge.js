// lib/aiGuide/knowledge.js - בונה את "הידע על האתר החדש" שעוזר ה-AI מקבל, מותאם למשתמשת (הרשאות, הגדרות הארגון, עץ התפריט האמיתי שלה).
// שרת בלבד (מייבא את buildMenuTree וקטלוגי שרת). הידע נגזר מהקוד: התפריט - מ-lib/menu/buildMenuTree.js (אותו עץ שהמשתמשת רואה),
// התוויות של כלי הניהול והדפים - מהקטלוגים; ידני נשאר רק "מה הדף עושה / משימות" ב-lib/aiGuide/areas/*.js, והבדיקה
// scripts/test_ai_site_guide.mjs נכשלת כשחסר רישום. ההפרדה מהישן: הרישום מתאר רק את הממשק החדש; מה שהוסר מהתפריט הישן נגזר מ-REMOVED_ITEMS.
//
// הפלט: טקסט לפרומפט + רשימת היעדים המותרים (השרת מאמת מולה כל תגית [[guide:ID]] שהמודל מחזיר).
import { PAGES, TASKS, TARGETS, getTarget } from './index.js';
import { checkAccess, isPageAllowed, isTargetAvailable } from './access.js';
import { REMOVED_ITEMS } from '../menu/buildMenuTree.js';
import { UI_SCREEN_REGISTRY, screenMatchesPath } from '../uiVariantScreens.js';
import { pageLabel } from '../menu/pageLabels.js';

export const MAX_TARGETS_IN_PROMPT = 70;

// --- מילים ודירוג רלוונטיות (לקסיקלי, בלי מודל) ---------------------------------------------------------------------
const STOP = new Set(['איך', 'איפה', 'היכן', 'מאיפה', 'מה', 'מי', 'האם', 'יש', 'אפשר', 'ניתן', 'את', 'של', 'על', 'עם', 'אני', 'לי', 'זה', 'זאת', 'או', 'גם', 'לא', 'כן', 'אם', 'כל', 'אל', 'מן', 'לעשות', 'עושים', 'עושה', 'למצוא', 'נמצא', 'נמצאת', 'רוצה', 'צריכה', 'צריך', 'בבקשה', 'תגידי', 'תגיד', 'תראי', 'תראה']);
const PREFIXES = ['וש', 'שה', 'וה', 'וב', 'ול', 'ומ', 'וכ', 'ה', 'ו', 'ב', 'ל', 'מ', 'כ', 'ש'];
export function tokenize(text) {
  const out = new Set();
  const clean = String(text || '').replace(/[֑-ׇ]/g, '').replace(/["'׳״“”]/g, '').toLowerCase();
  for (const raw of clean.split(/[^א-תa-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue;
    out.add(raw);
    // עד שתי קידומות (ו+ב, ש+ה...): "בהזמנה" -> "הזמנה" -> "זמנה"
    let cur = raw;
    for (let i = 0; i < 2; i++) {
      const p = PREFIXES.find((x) => cur.startsWith(x) && cur.length - x.length >= 2);
      if (!p) break;
      cur = cur.slice(p.length);
      out.add(cur);
    }
  }
  return out;
}
function score(qTokens, texts, weight = 1) {
  let s = 0;
  const hay = tokenize(texts.join(' '));
  for (const t of qTokens) if (hay.has(t)) s += weight;
  return s;
}

// --- נתיבי תפריט ---------------------------------------------------------------------------------------------------
const pathOf = (href) => String(href || '').split(/[?#]/)[0] || '/';

/** מפה: מזהה פריט תפריט -> { tab, label, text } לפי העץ של המשתמשת (כולל המאגר של "ניהול", פאנל המשתמש והפעמון). */
export function indexMenuTree(tree) {
  const byId = new Map();
  const byPath = new Map(); // נתיב -> רשומה ראשונה (עדיפות ללשונית עצמה)
  const tabs = (tree && tree.tabs) || [];
  const put = (id, rec) => { if (!byId.has(id)) byId.set(id, rec); };
  for (const tab of tabs) {
    if (tab.soon) continue;
    put(`tab:${tab.id}`, { tabId: tab.id, label: tab.label, text: `לשונית "${tab.label}" בסרגל העליון`, href: tab.href });
    if (tab.href && !byPath.has(pathOf(tab.href))) byPath.set(pathOf(tab.href), { text: `לשונית "${tab.label}" בסרגל העליון`, label: tab.label });
    for (const it of tab.items || []) {
      if (it.kind !== 'link' && it.kind !== 'action') continue;
      const rec = { tabId: tab.id, label: it.label, text: `בסרגל העליון ← "${tab.label}" ← "${it.label}"`, href: it.href };
      put(it.id, rec);
      if (it.href && !byPath.has(pathOf(it.href))) byPath.set(pathOf(it.href), rec);
    }
    const allTools = (tree.tabs || []).some((t) => t.id === 'admin') && (tab.items || []).find((i) => i.id === 'ad-all');
    for (const it of tab.pool || []) {
      if (it.kind !== 'link') continue;
      const rec = { tabId: tab.id, label: it.label, text: allTools ? `בסרגל העליון ← "${tab.label}" ← "${allTools.label}" ← "${it.label}"` : `בלשונית "${tab.label}" של הסרגל העליון: "${it.label}"`, href: it.href, pool: true };
      put(it.id, rec);
      if (it.href && !byPath.has(pathOf(it.href))) byPath.set(pathOf(it.href), rec);
    }
  }
  for (const it of (tree && tree.user && tree.user.items) || []) {
    if (it.kind !== 'link' && it.kind !== 'action') continue;
    const rec = { tabId: 'user', label: it.label, text: `בסרגל העליון ← תפריט המשתמש (העיגול עם ראשי התיבות) ← "${it.label}"`, href: it.href };
    put(it.id, rec); if (it.href && !byPath.has(pathOf(it.href))) byPath.set(pathOf(it.href), rec);
  }
  for (const it of (tree && tree.rail && tree.rail.bell && tree.rail.bell.rows) || []) {
    if (it.kind !== 'link' && it.kind !== 'action') continue;
    const rec = { tabId: 'bell', label: it.label, text: `בסרגל העליון ← הפעמון ← "${it.label}"`, href: it.href };
    put(it.id, rec); if (it.href && !byPath.has(pathOf(it.href))) byPath.set(pathOf(it.href), rec);
  }
  return { byId, byPath };
}

/** מזהי פריטי התפריט הזמינים לפעולה (ל-isTargetAvailable.menuItemIds). */
export function menuItemIdsOf(tree) {
  return new Set(indexMenuTree(tree).byId.keys());
}

/** תיאור התפריט העליון כטקסט, ישירות מהעץ. */
export function describeMenuTree(tree) {
  const lines = [];
  const tabs = (tree && tree.tabs) || [];
  lines.push('TOP BAR (a horizontal bar at the top of every page, right-to-left). Tabs, from the right:');
  for (const tab of tabs) {
    if (tab.soon) { lines.push(`- "${tab.label}" - shown as "בקרוב" (not usable yet)`); continue; }
    const rows = (tab.items || []).filter((x) => x.kind === 'link' || x.kind === 'action' || x.kind === 'soon');
    const linkNote = tab.href ? `clicking the tab opens ${tab.href}` : 'the tab only opens its menu';
    const menu = rows.length ? ` Hover menu (also opens with the small arrow next to the tab): ${rows.map((r) => (r.kind === 'soon' ? `${r.label} (בקרוב - not usable yet)` : r.label)).join(' | ')}.` : '';
    const extra = Array.isArray(tab.pool) && tab.pool.length ? ' More admin tools live on the "כל כלי הניהול" screen (a card per tool).' : '';
    lines.push(`- "${tab.label}" (${linkNote}).${menu}${extra}`);
  }
  const rail = (tree && tree.rail) || {};
  const icons = [];
  if (rail.search && rail.search.show) icons.push('חיפוש (magnifier: searches menu pages/tools, shows recents and navigation history)');
  if (rail.errorReport && rail.errorReport.show) icons.push('דיווח על שגיאה (bug icon)');
  if (rail.oldSite && rail.oldSite.show) icons.push('האתר הישן (temporary icon that switches to the old design)');
  if (rail.bell && rail.bell.show) icons.push(`התראות (bell)${(rail.bell.rows || []).length ? `, menu: ${(rail.bell.rows || []).map((r) => r.label).join(' | ')}` : ''}`);
  if (rail.shiftClock && rail.shiftClock.show) icons.push('מצב עבודה (shift clock, shown while a shift is open)');
  lines.push(`ICONS on the left side of the top bar: ${icons.join('; ')}; and the user circle (initials) whose menu has: ${((tree && tree.user && tree.user.items) || []).filter((x) => x.kind !== 'separator').map((x) => x.label).join(' | ')}.`);
  lines.push('On a phone the same bar collapses into a three-lines button (תפריט) that opens a drawer with the same tabs as accordions.');
  return lines.join('\n');
}

/** מה שהוסר בכוונה מהממשק הישן (מקור: REMOVED_ITEMS) - כדי שהעוזר לא ינחה אליו ויסביר איפה זה עכשיו. */
export function describeRemovedItems() {
  const lines = [];
  for (const r of Object.values(REMOVED_ITEMS)) {
    lines.push(`- "${r.label}"${r.movedTo ? ` - moved to: ${r.movedTo}` : ' - no longer exists in the new interface'}`);
  }
  return lines.join('\n');
}

// --- יעדים זמינים -------------------------------------------------------------------------------------------------
export function whereOf(target, ctx, menuIndex) {
  if (!target) return '';
  if (target.menuItem && menuIndex) {
    const rec = menuIndex.byId.get(target.menuItem);
    if (rec) return rec.text;
  }
  if (target.hubTool && menuIndex) return target.where || `במסך הניהול (כל כלי הניהול), כרטיס "${target.label}"`;
  return target.where || '';
}

export function availableTargets(ctx, menuIndex) {
  const pagesByRoute = new Map(PAGES.map((p) => [p.route, p]));
  const out = [];
  for (const t of TARGETS) {
    if (!isTargetAvailable(t, ctx, pagesByRoute)) continue;
    // יעד תלוי-אב (reveal מתפריט שאינו זמין) לא מוצג
    out.push(t);
  }
  return out;
}

// --- אסימוני {{label:ID}} / {{path:ID}} ----------------------------------------------------------------------------
export function resolveTokens(text, ctx, menuIndex) {
  return String(text).replace(/\{\{\s*(label|path)\s*:\s*([a-z0-9.-]+)\s*\}\}/g, (all, kind, id) => {
    const t = getTarget(id);
    if (!t) return '';
    return kind === 'label' ? t.label : (whereOf(t, ctx, menuIndex) || t.label);
  });
}

function reachOf(page, menuIndex) {
  if (page.reach && page.reach !== 'auto') return page.reach;
  const rec = menuIndex.byPath.get(page.route);
  return rec ? rec.text : null;
}

// --- בניית הבלוק לפרומפט ------------------------------------------------------------------------------------------
/**
 * @param {object} ctx  הקשר ההרשאות (ר' access.js) + tree + variants + currentPath
 * @param {{ question?: string, history?: string }} opts
 * @returns {{ text: string, allowedIds: Set<string>, stats: object }}
 */
export function buildGuideBlock(ctx, { question = '', history = '' } = {}) {
  const menuIndex = indexMenuTree(ctx.tree);
  const c = { ...ctx, menuItemIds: new Set(menuIndex.byId.keys()) };
  const pagesAllowed = PAGES.filter((p) => isPageAllowed(p, c));
  const targets = availableTargets(c, menuIndex);
  const targetIds = new Set(targets.map((t) => t.id));
  const q = tokenize(`${question} ${history}`);

  // דירוג
  const taskCandidates = TASKS
    .filter((t) => checkAccess(t.access, c) && (t.pages || []).every((r) => { const p = PAGES.find((x) => x.route === r); return !p || isPageAllowed(p, c); }))
    .map((t) => ({ t, s: score(q, [t.title], 3) + score(q, t.aliases || [], 3) + score(q, (t.steps || []).slice(0, 8), 0.5) }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6);
  const pageCandidates = pagesAllowed
    .map((p) => ({ p, s: score(q, [p.title], 3) + score(q, p.aliases || [], 3) + score(q, [p.about, ...(p.can || []), ...(p.cannot || [])], 1) }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8);
  const targetScore = (t) => score(q, [t.label], 3) + score(q, t.aliases || [], 3) + score(q, [t.where || '', t.hint || ''], 0.5);

  const chosenTaskIds = new Set(taskCandidates.map((x) => x.t.id));
  const chosenRoutes = new Set([...pageCandidates.map((x) => x.p.route), ...taskCandidates.flatMap((x) => x.t.pages || [])]);
  if (ctx.currentPath) { const cp = pagesAllowed.find((p) => routeMatchesLoose(p.route, ctx.currentPath)); if (cp) chosenRoutes.add(cp.route); }

  const detailPages = pagesAllowed.filter((p) => chosenRoutes.has(p.route)).slice(0, 12);
  const relevantTargetIds = new Set();
  for (const x of taskCandidates) for (const id of x.t.points || []) relevantTargetIds.add(id);
  for (const p of detailPages) for (const id of p.targets || []) relevantTargetIds.add(id);
  for (const t of targets) if (t.route !== '*' && chosenRoutes.has(t.route)) relevantTargetIds.add(t.id);
  const scoredTargets = targets.map((t) => ({ t, s: targetScore(t) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 18);
  for (const x of scoredTargets) relevantTargetIds.add(x.t.id);
  // יעדי הצביעה: כל יעדי התפריט/הסרגל (קצרים) + הרלוונטיים
  const listed = targets.filter((t) => (t.route === '*' && (t.id.startsWith('menu.') || t.id.startsWith('rail.'))) || relevantTargetIds.has(t.id)).slice(0, MAX_TARGETS_IN_PROMPT + 60);

  const lines = [];
  lines.push('=== NEW INTERFACE MAP (the ONLY interface you may describe) ===');
  lines.push(describeMenuTree(ctx.tree));
  lines.push('');
  lines.push('Items that existed in the OLD design and were REMOVED from the new top bar (do NOT instruct the user to use them; say briefly they no longer exist / where they moved):');
  lines.push(describeRemovedItems());
  lines.push('');
  lines.push('=== PAGE INDEX (every page this user can open in the new interface: title | route | how to reach it) ===');
  for (const p of pagesAllowed) {
    const reach = reachOf(p, menuIndex);
    lines.push(`- ${p.title} | ${p.route} | ${reach || 'no top-bar entry'}`);
  }
  if (detailPages.length) {
    lines.push('');
    lines.push('=== PAGE DETAILS (most relevant to this question) ===');
    for (const p of detailPages) {
      lines.push(`# ${p.title} (${p.route})${p.ui === 'both' ? ' - new design' : ''}`);
      lines.push(`about: ${p.about}`);
      const reach = reachOf(p, menuIndex);
      if (reach) lines.push(`reach: ${reach}`);
      lines.push(`can: ${(p.can || []).join('; ')}`);
      if (p.cannot && p.cannot.length) lines.push(`CANNOT / does not exist: ${p.cannot.join('; ')}`);
      if (p.notes) lines.push(`note: ${p.notes}`);
    }
  }
  if (taskCandidates.length) {
    lines.push('');
    lines.push('=== TASKS (verified step-by-step instructions for the new interface; prefer these) ===');
    for (const { t } of taskCandidates) {
      lines.push(`# ${t.title}`);
      (t.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${resolveTokens(s, c, menuIndex)}`));
      if (t.notes) lines.push(`note: ${t.notes}`);
      if (t.points && t.points.length) lines.push(`point at: ${t.points.filter((id) => targetIds.has(id)).map((id) => `[[guide:${id}]]`).join(' ')}`);
    }
  }
  lines.push('');
  lines.push('=== POINTABLE ELEMENTS (id | name (aliases) | where). Only these ids may appear in [[guide:ID]] tags ===');
  for (const t of listed) {
    const al = (t.aliases || []).slice(0, 3).join(', ');
    lines.push(`${t.id} | ${t.label}${al ? ` (${al})` : ''} | ${whereOf(t, c, menuIndex)}${t.entity ? ' | only while viewing that record' : ''}`);
  }
  const text = lines.join('\n');
  return {
    text,
    allowedIds: targetIds,
    stats: { pages: pagesAllowed.length, detailPages: detailPages.length, tasks: taskCandidates.length, targets: listed.length, chars: text.length },
  };
}

function routeMatchesLoose(pattern, pathname) {
  const clean = (s) => String(s || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const p = clean(pathname).split('/');
  const q = clean(pattern).split('/');
  return p.length === q.length && q.every((seg, i) => seg.startsWith(':') ? p[i].length > 0 : seg === p[i]);
}

/** הערת ממשק: באיזו תצוגה המשתמשת נמצאת עכשיו (ישן/חדש), מהדגלים ש-lib/uiVariant.js הכריע. */
export function describeUserVariant(ctx) {
  const v = ctx.variants || {};
  const shellOld = v.shell !== 'a5';
  const screen = ctx.currentPath ? UI_SCREEN_REGISTRY.find((s) => s.id !== 'shell' && screenMatchesPath(s, ctx.currentPath)) : null;
  const pageOld = !!(screen && screen.legacyExists && screen.newExists && v[screen.id] !== 'a5');
  return { shellOld, pageOld, pageLabel: ctx.currentPath ? pageLabel(ctx.currentPath) : null, screenLabel: screen ? screen.label : null, screenId: screen ? screen.id : null };
}
