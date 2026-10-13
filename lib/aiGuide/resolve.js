// lib/aiGuide/resolve.js - אימות תגיות ההצבעה ([[guide:ID]]) שהמודל מחזיר. טהור (ללא DB/רשת): נבדק ב-scripts/test_ai_site_guide.mjs.
// עיקרון אבטחה: המודל אינו יכול להחזיר URL או סלקטור. רק מזהה שקיים ברישום וזמין למשתמשת הזו מתקבל; מזהה אחר נזרק, ויעד שאינו זמין / אינו
// רלוונטי עכשיו (למשל אלמנט בתוך רשומה כשהיא לא פתוחה) נופל ליעד האב הקרוב - לעולם לא נוצר קישור שבור.
import { getTarget } from './index.js';
import { GUIDE_TAG_RE, MAX_GUIDE_STEPS, routeMatches } from './schema.js';
import { isTargetAvailable } from './access.js';
import { whereOf, indexMenuTree } from './knowledge.js';

/** ביטויים שמעידים שהתשובה מתארת את הממשק הישן (תפריט צד). משמש לניסיון חוזר ולבדיקות. */
export const LEGACY_PHRASE_RE = /(תפריט|סרגל|סיידבר)\s*(ה)?צד(י)?(?![א-ת])|sidebar|side menu|side bar|הסרגל הצדדי|התפריט הצדדי/i;

/**
 * @param {string} text            תשובת המודל (עם תגיות)
 * @param {{ allowedIds:Set<string>, ctx:object }} p  allowedIds = היעדים שהוצגו למודל (זמינים למשתמשת); ctx = הקשר ההרשאות
 * @returns {{ text:string, steps:Array<{id,label,where,route,entity,hint}>, dropped:string[] }}
 */
export function finalizeGuideTags(text, { allowedIds, ctx }) {
  const src = String(text || '');
  const ids = [];
  const re = new RegExp(GUIDE_TAG_RE.source, 'gi');
  let m;
  while ((m = re.exec(src))) ids.push(m[1].toLowerCase());
  const cleaned = src.replace(new RegExp(GUIDE_TAG_RE.source, 'gi'), '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const steps = [];
  const dropped = [];
  const seen = new Set();
  const menuIndex = indexMenuTree(ctx && ctx.tree);
  // זמין = מותר למשתמשת הזו (הרשאות/הגדרות/תפריט). יעד שאינו מותר נזרק ולא נופל לאב (לא מפנים עובדת רגילה ללשונית "ניהול" בגלל הגדרה).
  const allowed = (t) => !!t && ((allowedIds && allowedIds.has(t.id)) || !!(t.dynamic && isTargetAvailable(t, ctx, null)));
  const onRecordPage = (t) => !t.entity || !!(ctx && ctx.currentPath && routeMatches(t.route, ctx.currentPath));
  for (const id of ids) {
    let t = getTarget(id);
    if (!t) { dropped.push(id); continue; }
    if (!allowed(t)) { dropped.push(id); continue; }
    // אלמנט בתוך רשומה כשהרשומה לא פתוחה: נופלים ליעד האב הקרוב (הרשימה/החיפוש) אם הוא מותר
    let guard = 0;
    while (t && !onRecordPage(t) && guard++ < 5) { t = t.parent ? getTarget(t.parent) : null; if (t && !allowed(t)) t = null; }
    if (!t) { dropped.push(id); continue; }
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    steps.push({ id: t.id, label: t.label, where: whereOf(t, ctx, menuIndex) || null, route: t.route, entity: !!t.entity, hint: t.hint || null });
    if (steps.length >= MAX_GUIDE_STEPS) break;
  }
  return { text: cleaned, steps, dropped };
}
