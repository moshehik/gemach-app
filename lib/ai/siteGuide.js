// lib/ai/siteGuide.js - מענה על שאלות "איך עושים X / איפה Y / האם יש Z" בהקשר הממשק החדש בלבד, כולל "הצבעה" על אלמנטים באתר.
// נקרא מ-app/api/ai/route.js ומ-app/api/ai/statistics/route.js כשהמודל ביקש ACTION: SITE_GUIDE() (או HOWTO_GUIDE() הישן).
//
// התהליך: (1) loadGuideContext - מי המשתמשת, הרשאות, הגדרות ארגון, עץ התפריט שלה; (2) buildGuideBlock - מפת הממשק החדש, אינדקס דפים,
// משימות ויעדי הצבעה רלוונטיים לשאלה; (3) קריאה אחת למודל עם כללים נוקשים ("רק הממשק החדש, בלי להמציא"); (4) אימות בקוד של כל תגית
// [[guide:ID]] מול הרישום והרשאות המשתמשת (המודל לא יכול להחזיר URL או סלקטור חופשי) ונפילה לאב הקרוב כשיעד אינו זמין;
// (5) הערת ממשק דטרמיניסטית אם המשתמשת עדיין בתצוגה הישנה; (6) ניסיון חוזר אחד אם התשובה הזכירה בכל זאת "תפריט צד".
import { loadGuideContext } from '../aiGuide/serverContext';
import { buildGuideBlock, describeUserVariant, whereOf, indexMenuTree } from '../aiGuide/knowledge';
import { getTarget, TARGETS } from '../aiGuide/index';
import { isTargetAvailable } from '../aiGuide/access';
import { GUIDE_TAG_RE, MAX_GUIDE_STEPS, deepLinkFor } from '../aiGuide/schema';
import { toggleLabelsFor } from '../pageVariantToggle';

export const LEGACY_PHRASE_RE = /(תפריט|סרגל|סיידבר|בר)\s*(ה)?צד(י)?\b|sidebar|side menu|side bar|הסרגל הצדדי|התפריט הצדדי/i;

const RULES = `You are the site guide of the Gemach dress-rental system. You answer ONLY about the NEW interface (top-bar design) described below.
RULES (strict):
1. Describe only what is written in the maps below. The old design (a right-hand "side menu"/"sidebar"/"תפריט צד") DOES NOT EXIST for you: never mention it, never give instructions based on it. If something exists only in the old design, say in one short sentence that it exists only in the old design (or was removed) and do not explain how to use it.
2. NEVER invent a page, button, tab, menu item, setting or location. If the thing is not in the maps, say honestly in Hebrew that you did not find such an option in the new interface (or that you are not sure), and suggest the search icon in the top bar or asking a manager. If the user asks "is there an option to ..." and the page details say it does not exist (CANNOT list) or it is absent, answer that it does not exist.
3. The maps are already filtered to what THIS user may open. If the user asks about something that exists in the system but is not in her maps, say that it is not available to her permissions / not enabled for this gemach - do not explain how to reach it.
4. Use the exact Hebrew names written in the maps. Write menu paths with an arrow like: הזמנה ← הזמנה חדשה (top-bar tab first). Prefer the verified TASKS steps when one matches.
5. Answer in Hebrew, short and practical: up to 6 short steps or 2-3 sentences. No markdown, no asterisks, no bullet symbols other than "1." numbering.
6. POINTING: at the very end of your answer add pointing tags, one per element, in the order of the steps (maximum ${MAX_GUIDE_STEPS}): [[guide:ID]]. Use ONLY ids from the POINTABLE ELEMENTS list, copied exactly. Point at the final place the user must reach (and, if useful, the menu item that leads there). If nothing in the list fits, add no tag. Never put a URL or a selector in the answer.
7. If an element is marked "only while viewing that record", you may point at it only if the user is currently on such a page (see CURRENT PAGE); otherwise explain in words and point at the list/search instead.`;

/** שורת ההקשר של המשתמשת בפרומפט (תפקיד, ארגון, דף נוכחי). */
function userLine(ctx) {
  const role = ctx.roleId === 2 ? 'programmer' : ctx.roleId === 0 ? 'head management' : ctx.roleId === 1 ? 'branch manager' : 'regular employee';
  const feats = [];
  if (ctx.settings.enable_deliveries === 'true') feats.push('deliveries ENABLED'); else feats.push('deliveries NOT enabled for this gemach (no deliveries pages/tabs)');
  if (ctx.settings.branches_enabled === 'true') feats.push('multiple branches enabled'); else feats.push('single branch (no branch selectors)');
  if (ctx.settings.enable_alterations === 'false') feats.push('alterations feature disabled');
  return `USER: ${role}. GEMACH FEATURES: ${feats.join('; ')}. CURRENT PAGE: ${ctx.currentPath || '/'}.`;
}

function buildPrompt({ prompt, historyText, block, ctx, dateContext, extra = '' }) {
  return `${RULES}\n\n${userLine(ctx)}\n${dateContext || ''}\n\n${block.text}\n\nChat history:\n${historyText || '(none)'}\n\nUser question: ${prompt}\n${extra}`;
}

/**
 * מאמת את תגיות ההצבעה: מסיר אותן מהטקסט ומחזיר רשימת צעדים תקפה בלבד.
 * @returns {{ text: string, steps: Array, dropped: string[] }}
 */
export function finalizeGuideTags(text, { allowedIds, ctx, pagesAllowedByRoute }) {
  const ids = [];
  let m;
  const re = new RegExp(GUIDE_TAG_RE.source, 'gi');
  while ((m = re.exec(String(text || '')))) ids.push(m[1].toLowerCase());
  const cleaned = String(text || '').replace(new RegExp(GUIDE_TAG_RE.source, 'gi'), '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const steps = [];
  const dropped = [];
  const seen = new Set();
  const menuIndex = indexMenuTree(ctx.tree);
  const onRecordPage = (t) => !t.entity || (ctx.currentPath && routeMatches(t.route, ctx.currentPath));
  for (const id of ids) {
    let t = getTarget(id);
    if (!t) { dropped.push(id); continue; }
    // יעד שאינו זמין / אינו רלוונטי כרגע: נופלים לאב הקרוב ביותר שזמין (אין קישורים שבורים)
    const okTarget = (x) => x && (allowedIds.has(x.id) || (x.id.startsWith('set.key-') && isTargetAvailable(x, ctx, pagesAllowedByRoute))) && onRecordPage(x);
    let guard = 0;
    while (t && !okTarget(t) && guard++ < 5) t = t.parent ? getTarget(t.parent) : null;
    if (!t) { dropped.push(id); continue; }
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    steps.push({ id: t.id, label: t.label, where: whereOf(t, ctx, menuIndex) || null, route: t.route, entity: !!t.entity, hint: t.hint || null });
    if (steps.length >= MAX_GUIDE_STEPS) break;
  }
  return { text: cleaned, steps, dropped };
}

function routeMatches(pattern, pathname) {
  const clean = (s) => String(s || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const p = clean(pathname).split('/');
  const q = clean(pattern).split('/');
  return pattern === '*' || (p.length === q.length && q.every((seg, i) => (seg.startsWith(':') ? p[i].length > 0 : seg === p[i])));
}

function variantNote(ctx) {
  const v = describeUserVariant(ctx);
  if (v.shellOld) return `שימי לב: כרגע את/ה בתפריט הישן. ההוראות כאן מתייחסות לתפריט העליון החדש (אפשר לעבור אליו באייקון "${toggleLabelsFor('shell').toNew}" בסרגל העליון).`;
  if (v.pageOld && v.screenLabel) return `שימי לב: במסך "${v.screenLabel}" את/ה כרגע בתצוגה הישנה. ההוראות מתייחסות לתצוגה החדשה (האייקון "${toggleLabelsFor(describeScreenId(ctx)).toNew}" מעביר אליה).`;
  return '';
}
function describeScreenId(ctx) {
  const v = describeUserVariant(ctx);
  return v.screenId || 'shell';
}

/**
 * הנקודה הראשית.
 * @param {object} p
 * @param {string} p.prompt
 * @param {string} p.historyText
 * @param {{employeeId, roleId, cookieStore, currentPath}} p.who
 * @param {(prompt:string)=>Promise<string>} p.generate  קריאה למודל
 * @param {string} [p.dateContext]
 * @returns {Promise<{ response: string, guide: Array, guideHref: string|null, meta: object }>}
 */
export async function answerSiteQuestion({ prompt, historyText = '', who, generate, dateContext = '' }) {
  const ctx = await loadGuideContext(who);
  const block = buildGuideBlock(ctx, { question: prompt, history: historyText.split('\n').slice(-4).join(' ') });
  const pagesByRoute = null;
  let text = await generate(buildPrompt({ prompt, historyText, block, ctx, dateContext }));
  let retried = false;
  if (LEGACY_PHRASE_RE.test(text)) {
    retried = true;
    text = await generate(buildPrompt({ prompt, historyText, block, ctx, dateContext, extra: 'IMPORTANT: your previous draft mentioned a side menu/sidebar, which does not exist. Rewrite the answer using ONLY the top bar described above.' }));
  }
  const fin = finalizeGuideTags(text, { allowedIds: block.allowedIds, ctx, pagesAllowedByRoute: pagesByRoute });
  let response = fin.text.replace(/\*\*/g, '');
  const note = variantNote(ctx);
  if (note) response = `${response}\n\n${note}`;
  const targets = fin.steps.map((s) => getTarget(s.id)).filter(Boolean);
  return {
    response,
    guide: fin.steps,
    guideHref: deepLinkFor(targets),
    meta: { retried, dropped: fin.dropped, stats: block.stats, legacyMention: LEGACY_PHRASE_RE.test(response) },
  };
}

export { TARGETS };
