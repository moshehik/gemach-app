// lib/ai/siteGuide.js - מענה על שאלות "איך עושים X / איפה Y / האם יש Z" בהקשר הממשק החדש בלבד, כולל "הצבעה" על אלמנטים באתר.
// נקרא מ-app/api/ai/route.js ומ-app/api/ai/statistics/route.js כשהמודל ביקש ACTION: SITE_GUIDE() (או HOWTO_GUIDE() הישן).
//
// התהליך: (1) loadGuideContext - מי המשתמשת, הרשאות, הגדרות ארגון, עץ התפריט שלה; (2) buildGuideBlock - מפת הממשק החדש, אינדקס דפים,
// משימות ויעדי הצבעה רלוונטיים לשאלה; (3) קריאה אחת למודל עם כללים נוקשים ("רק הממשק החדש, בלי להמציא"); (4) אימות בקוד של כל תגית
// [[guide:ID]] מול הרישום והרשאות המשתמשת (המודל לא יכול להחזיר URL או סלקטור חופשי) ונפילה לאב הקרוב כשיעד אינו זמין;
// (5) הערת ממשק דטרמיניסטית אם המשתמשת עדיין בתצוגה הישנה; (6) ניסיון חוזר אחד אם התשובה הזכירה בכל זאת "תפריט צד".
import { loadGuideContext } from '../aiGuide/serverContext';
import { buildGuideBlock, describeUserVariant } from '../aiGuide/knowledge';
import { getTarget } from '../aiGuide/index';
import { finalizeGuideTags } from '../aiGuide/resolve';
import { MAX_GUIDE_STEPS, deepLinkFor } from '../aiGuide/schema';
import { toggleLabelsFor } from '../pageVariantToggle';
import { buildSettingsGuideForNewUi } from '../aiGuide/settingsLocation';
import { appendSettingLocations } from '../aiGuide/settingsLocationText';
import { tokenize } from '../aiGuide/knowledge';

import { LEGACY_PHRASE_RE } from '../aiGuide/resolve';
export { LEGACY_PHRASE_RE };

const RULES = `You are the site guide of the Gemach dress-rental system. You answer ONLY about the NEW interface (top-bar design) described below.
RULES (strict):
1. Describe only what is written in the maps below. The old design (a right-hand "side menu"/"sidebar"/"תפריט צד") DOES NOT EXIST for you: never mention it, never give instructions based on it. If something exists only in the old design, say in one short sentence that it exists only in the old design (or was removed) and do not explain how to use it.
2. NEVER invent a page, button, tab, menu item, setting or location. If the thing is not in the maps, say honestly in Hebrew that you did not find such an option in the new interface (or that you are not sure), and suggest the search icon in the top bar or asking a manager. If the user asks "is there an option to ..." and the page details say it does not exist (CANNOT list) or it is absent, answer that it does not exist.
3. The maps are already filtered to what THIS user may open. If the user asks about something that exists in the system but is not in her maps, say that it is not available to her permissions / not enabled for this gemach - do not explain how to reach it.
3b. The GEMACH FEATURES line below is authoritative for this gemach. If the user asks about a feature that line says is NOT enabled (deliveries, multiple branches, alterations), say plainly that it is not enabled for this gemach (a manager can enable it in the system settings) and do NOT explain how to use it.
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

const SETTINGS_RULE = `8. SYSTEM SETTINGS (this user is a manager): for a question about a specific configuration setting (where it is, what it does, its value, how to change it) use ONLY the SYSTEM SETTINGS list. Refer to the setting by its Hebrew name and state its current value, and add the tag [[setting:KEY]] (exact key, maximum 3) at the end. Do NOT write where the setting is located and do not mention tabs or categories of the settings screen: the system appends the exact location line. If a setting is not in the list, say you did not find it. Something that has its own page or tool (for example the price list, permissions, statistics, email log) is NOT a setting - answer it from the page map and tasks.`;

/** בלוק ההגדרות לפרומפט (מנהלות): רק ההגדרות הרלוונטיות לשאלה, עם מיקום מהמסך החדש וערך נוכחי. */
function buildSettingsBlock(rows, question) {
  const catalog = buildSettingsGuideForNewUi(rows);
  const q = tokenize(question);
  const scored = catalog
    .map((e) => {
      const hay = tokenize(`${e.name} ${e.key.replace(/_/g, ' ')} ${e.description || ''} ${e.location || ''}`);
      let s = 0; for (const t of q) if (hay.has(t)) s += 1;
      const nameHay = tokenize(e.name); for (const t of q) if (nameHay.has(t)) s += 2;
      return { e, s };
    })
    .filter((x) => x.s > 0 && x.e.location)
    .sort((a, b) => b.s - a.s)
    .slice(0, 22);
  const lines = ['=== SYSTEM SETTINGS (most relevant to this question): key | name | location on the settings screen | current value | what it does ==='];
  for (const { e } of scored) lines.push(`${e.key} | ${e.name} | ${e.location} | ${String(e.currentValue ?? '').slice(0, 60)} | ${String(e.description || '').slice(0, 140)}`);
  if (!scored.length) lines.push('(no setting matched the words of the question)');
  return { catalog, text: lines.join('\n') };
}

function buildPrompt({ prompt, historyText, block, ctx, dateContext, extra = '', settingsText = '' }) {
  return `${RULES}${settingsText ? `\n${SETTINGS_RULE}` : ''}\n\n${userLine(ctx)}\n${dateContext || ''}\n\n${block.text}${settingsText ? `\n\n${settingsText}` : ''}\n\nChat history:\n${historyText || '(none)'}\n\nUser question: ${prompt}\n${extra}`;
}

function variantNote(ctx, routes) {
  const v = describeUserVariant(ctx, routes);
  const notes = [];
  if (v.shellOld) notes.push(`שימי לב: כרגע את/ה בתפריט הישן. ההוראות כאן מתייחסות לתפריט העליון החדש (אפשר לעבור אליו באייקון "${toggleLabelsFor('shell').toNew}" בסרגל העליון).`);
  for (const s of v.oldScreens.slice(0, 2)) notes.push(`שימי לב: במסך "${s.label}" את/ה כרגע בתצוגה הישנה. ההוראות מתייחסות לתצוגה החדשה (האייקון "${toggleLabelsFor(s.id).toNew}" מעביר אליה).`);
  return notes.join('\n');
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
export async function answerSiteQuestion({ prompt, historyText = '', who, generate, dateContext = '', settingsRows = null }) {
  const ctx = await loadGuideContext(who);
  const block = buildGuideBlock(ctx, { question: prompt, history: historyText.split('\n').slice(-4).join(' ') });
  const settings = settingsRows ? buildSettingsBlock(settingsRows, `${prompt} ${historyText.split('\n').slice(-2).join(' ')}`) : null;
  const settingsText = settings ? settings.text : '';
  let text = await generate(buildPrompt({ prompt, historyText, block, ctx, dateContext, settingsText }));
  let retried = false;
  if (LEGACY_PHRASE_RE.test(text)) {
    retried = true;
    text = await generate(buildPrompt({ prompt, historyText, block, ctx, dateContext, settingsText, extra: 'IMPORTANT: your previous draft mentioned a side menu/sidebar, which does not exist. Rewrite the answer using ONLY the top bar described above.' }));
  }
  // תגיות הגדרה [[setting:KEY]] (מנהלות): מאומתות מול הקטלוג, הופכות לשורת מיקום (בקוד) ולהצבעה על השורה במסך ההגדרות
  const settingKeys = [];
  if (settings) {
    for (const m of text.matchAll(/\[\[\s*setting\s*:\s*([A-Za-z0-9_]+)\s*\]\]/g)) {
      const entry = settings.catalog.find((c) => c.key === m[1]);
      if (entry && entry.location && !settingKeys.includes(entry.key)) settingKeys.push(entry.key);
    }
  }
  text = text.replace(/\[\[\s*setting\s*:[^\]]*\]\]/g, '');
  const fin = finalizeGuideTags(text, { allowedIds: block.allowedIds, ctx });
  const settingSteps = settingKeys.length ? finalizeGuideTags(settingKeys.slice(0, 3).map((k) => `[[guide:set.key-${k.toLowerCase().replace(/_/g, '-')}]]`).join(' '), { allowedIds: new Set(), ctx }).steps : [];
  fin.steps = [...fin.steps, ...settingSteps].slice(0, MAX_GUIDE_STEPS);
  // כל [[...]] שנשאר (תגית שבורה של המודל) לא יוצג
  fin.text = fin.text.replace(/\[\[[^\]]*\]\]/g, '').replace(/[ \t]+\n/g, '\n').trim();
  if (settingKeys.length) fin.text = appendSettingLocations(`${fin.text}\n${settingKeys.slice(0, 3).map((k) => `[OPEN_SETTING:${k}]`).join('\n')}`, settings.catalog);
  let response = fin.text.replace(/\*\*/g, '');
  const note = variantNote(ctx, fin.steps.map((s) => s.route));
  if (note) response = `${response}\n\n${note}`;
  const targets = fin.steps.map((s) => getTarget(s.id)).filter(Boolean);
  return {
    response,
    guide: fin.steps,
    guideHref: deepLinkFor(targets),
    meta: { retried, dropped: fin.dropped, stats: block.stats, legacyMention: LEGACY_PHRASE_RE.test(response) },
  };
}


/**
 * הצבעה על הגדרות (אחרי SETTINGS_GUIDE): מזהים דינמיים set.key-<מפתח> שנפתרים ב-lib/aiGuide/areas/admin.targets.js (resolveDynamic) ומאומתים מול
 * ההרשאות. מפתח שלא מוכר / לא מותר נזרק; התוצאה בצורה זהה ל-answerSiteQuestion (guide, guideHref).
 */
export async function pointAtSettings({ keys, who }) {
  const ids = (keys || []).filter((k) => /^[A-Za-z0-9_]+$/.test(k)).slice(0, MAX_GUIDE_STEPS).map((k) => `set.key-${k.toLowerCase().replace(/_/g, '-')}`);
  if (!ids.length) return { guide: [], guideHref: null };
  const ctx = await loadGuideContext(who);
  const fin = finalizeGuideTags(ids.map((id) => `[[guide:${id}]]`).join(' '), { allowedIds: new Set(), ctx });
  const targets = fin.steps.map((s) => getTarget(s.id)).filter(Boolean);
  return { guide: fin.steps, guideHref: deepLinkFor(targets) };
}
