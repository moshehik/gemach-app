// lib/aiGuide/schema.js - החוזה של "מדריך האתר" של עוזר ה-AI: יעדי הצבעה (targets), תגיות בתשובה וקישורי עומק.
//
// מודול טהור (ESM, בלי React/Next/prisma/`@/`): נטען גם בשרת, גם בדפדפן (GuideProvider) וגם ב-node לבדיקות
// (scripts/test_ai_site_guide.mjs). אל תייבאו לכאן מודול שרת (קטלוג ניהול, buildMenuTree וכו') - הצד הזה מגיע ללקוח.
//
// רקע (12.10.2026, נושא 10 ברשימת התיקונים): העוזר ענה "איך עושים X" לפי קטלוג ידני ישן (lib/howToGuide.js) שתיאר "תפריט צד" שאינו
// קיים בממשק החדש. עכשיו: יעד = מזהה יציב + שם + מילים נרדפות + נתיב + data-guide-id על האלמנט עצמו + "איך חושפים אותו".
// ה-AI לעולם לא מחזיר URL או סלקטור חופשי: רק מזהה מהרישום, והוא מאומת בשרת (resolve.js) ושוב בלקוח (GuideProvider).
// תיעוד: docs/ai-site-guide.md ("איך מוסיפים יעד חדש").

/** שם פרמטר הכתובת של קישור עומק: /orders/new?gm_guide=no.step-customer,no.step-items */
export const GUIDE_PARAM = 'gm_guide';
/** מקסימום יעדים ברצף אחד ("צעד 1/3") */
export const MAX_GUIDE_STEPS = 4;
/** תגית בטקסט התשובה של המודל: [[guide:menu.order-new]] (אפשר כמה, לפי הסדר) */
export const GUIDE_TAG_RE = /\[\[\s*guide\s*:\s*([^\]\s]+)\s*\]\]/gi;
/** מזהה תקין: אזור.שם (אותיות קטנות, ספרות, מקף; נקודה מפרידה בין הרמות) */
export const GUIDE_ID_RE = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/;
/** נתיב לדף שאינו קיים בפועל בתור יעד "בכל דף" */
export const ANY_ROUTE = '*';

/**
 * @typedef {Object} GuideTarget
 * @property {string} id            מזהה יציב (GUIDE_ID_RE). זהה ל-data-guide-id על האלמנט.
 * @property {string} label         השם כפי שמופיע בממשק (עברית)
 * @property {string[]} [aliases]   מילים נרדפות שהעובדת עשויה להשתמש בהן (להתאמה בשאלה; נכנס לפרומפט)
 * @property {string} route         נתיב הדף שבו האלמנט נמצא: '/orders/new' | תבנית '/orders/:id' | '*' (רכיב מעטפת בכל דף)
 * @property {string} [query]       פרמטרי כתובת שחושפים את המצב הנכון ("adv=1" -> /?adv=1)
 * @property {Array<{menu?:string, click?:string, wait?:number}>} [reveal]
 *     איך חושפים: {menu:'admin'} פותח את תפריט הלשונית (דסקטופ: לוחץ על החץ; נייד: פותח מגירה ואקורדיון), {click:'<guide-id>'} לוחץ על
 *     אלמנט אחר (לשונית, כפתור פותח חלונית), {wait:ms}. מבוצע לפי הסדר, רק אם האלמנט עדיין לא גלוי.
 * @property {string} [where]       איפה זה, במילים ("בסרגל העליון ← הזמנה ← הזמנה חדשה"). בפריטי תפריט נגזר מעץ התפריט האמיתי.
 * @property {string} [hint]        משפט קצר בבועת ההדגשה (ברירת מחדל: label)
 * @property {string} [parent]      יעד מקור לנפילה אם האלמנט לא נמצא (למשל הלשונית שמכילה אותו)
 * @property {'button'|'tab'|'menu'|'field'|'section'|'link'|'icon'|'toggle'|'list'} [kind]
 * @property {boolean} [entity]     האלמנט קיים רק בתוך רשומה ספציפית (route עם :id): אפשר להדגיש רק כשכבר נמצאים בדף כזה
 * @property {string} [menuItem]    מפתח ב-ITEM_DEFS/TABS של lib/menu/buildMenuTree.js - הזמינות נקבעת לפי נוכחות בעץ התפריט של המשתמשת
 * @property {string} [hubTool]     מזהה כלי ב-lib/adminHubCatalog.js TOOLS - הזמינות לפי הכלים המותרים למשתמשת
 * @property {{gate?:'head'|'prog', pageKey?:string, setting?:[string,string]}} [access]
 *     תנאי נראות נוסף על האלמנט (לא על הדף - הדף נשפט לפי PAGE_GUIDE): gate head = הנהלה ראשית/מתכנת, prog = מתכנת,
 *     pageKey = הרשאת page:... או feature:..., setting = [מפתח, ערך] שחייב להתקיים בהגדרות הארגון (למשל ['enable_deliveries','true'])
 */

const VALID_KINDS = new Set(['button', 'tab', 'menu', 'field', 'section', 'link', 'icon', 'toggle', 'list']);

/** בדיקת תקינות של יעד בודד. מחזירה מערך שגיאות (ריק = תקין). */
export function validateTargetShape(t) {
  const errs = [];
  if (!t || typeof t !== 'object') return ['יעד אינו אובייקט'];
  if (typeof t.id !== 'string' || !GUIDE_ID_RE.test(t.id)) errs.push(`מזהה לא תקין: ${t.id}`);
  if (typeof t.label !== 'string' || !/[א-ת]/.test(t.label)) errs.push(`${t.id}: label חייב להיות בעברית`);
  if (typeof t.route !== 'string' || !(t.route === ANY_ROUTE || t.route.startsWith('/'))) errs.push(`${t.id}: route חייב להתחיל ב-/ או להיות *`);
  if (t.route && /\s|\?|#/.test(t.route)) errs.push(`${t.id}: route בלי רווחים/query (השתמשו ב-query)`);
  if (t.query !== undefined && (typeof t.query !== 'string' || t.query.startsWith('?'))) errs.push(`${t.id}: query בלי '?' בתחילתו`);
  if (t.aliases !== undefined && !(Array.isArray(t.aliases) && t.aliases.every((a) => typeof a === 'string' && a.trim()))) errs.push(`${t.id}: aliases חייב להיות מערך מחרוזות`);
  if (t.kind !== undefined && !VALID_KINDS.has(t.kind)) errs.push(`${t.id}: kind לא מוכר (${t.kind})`);
  if (t.reveal !== undefined) {
    if (!Array.isArray(t.reveal)) errs.push(`${t.id}: reveal חייב להיות מערך`);
    else for (const s of t.reveal) {
      const keys = s && typeof s === 'object' ? Object.keys(s) : [];
      if (keys.length !== 1 || !['menu', 'click', 'wait'].includes(keys[0])) errs.push(`${t.id}: צעד reveal לא תקין ${JSON.stringify(s)}`);
      else if (keys[0] === 'wait' && !(Number.isFinite(s.wait) && s.wait >= 0 && s.wait <= 3000)) errs.push(`${t.id}: wait עד 3000ms`);
      else if (keys[0] !== 'wait' && typeof s[keys[0]] !== 'string') errs.push(`${t.id}: reveal.${keys[0]} חייב להיות מחרוזת`);
    }
  }
  if (t.entity && !/:/.test(String(t.route))) errs.push(`${t.id}: entity דורש route עם :param`);
  if (!t.menuItem && !t.hubTool && !t.where) errs.push(`${t.id}: חסר where (או menuItem/hubTool שמהם נגזר המיקום)`);
  if (t.access !== undefined) {
    const a = t.access;
    if (!a || typeof a !== 'object') errs.push(`${t.id}: access לא תקין`);
    else {
      if (a.gate !== undefined && !['head', 'prog'].includes(a.gate)) errs.push(`${t.id}: access.gate לא מוכר`);
      if (a.setting !== undefined && !(Array.isArray(a.setting) && a.setting.length === 2 && a.setting.every((x) => typeof x === 'string'))) errs.push(`${t.id}: access.setting חייב להיות [key, value]`);
    }
  }
  return errs;
}

/** האם נתיב נוכחי מתאים לנתיב/תבנית של יעד ('/orders/:id' מתאים ל-'/orders/123' אבל לא ל-'/orders/new' אם new הוא נתיב קבוע אחר). */
export function routeMatches(pattern, pathname) {
  if (pattern === ANY_ROUTE) return true;
  const clean = (s) => String(s || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const p = clean(pathname).split('/');
  const q = clean(pattern).split('/');
  if (p.length !== q.length) return false;
  return q.every((seg, i) => (seg.startsWith(':') ? p[i].length > 0 : seg === p[i]));
}

/** כתובת קישור עומק ליעדים: /route?<query>&gm_guide=a,b - ליעד '*' (או כשאין נתיב קבוע) מחזיר null (מדגישים בדף הנוכחי). */
export function deepLinkFor(targets) {
  const first = Array.isArray(targets) ? targets[0] : targets;
  const list = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
  if (!first || !list.length) return null;
  if (first.route === ANY_ROUTE || /:/.test(first.route)) return null;
  const qs = [first.query, `${GUIDE_PARAM}=${list.map((t) => t.id).join(',')}`].filter(Boolean).join('&');
  return `${first.route}?${qs}`;
}

/** מפרק ערך פרמטר gm_guide לרשימת מזהים תקינים (בלי כפילויות, עד MAX_GUIDE_STEPS). לא בודק קיום ברישום. */
export function parseGuideParam(value) {
  const out = [];
  for (const raw of String(value || '').split(',')) {
    const id = raw.trim().toLowerCase();
    if (GUIDE_ID_RE.test(id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_GUIDE_STEPS) break;
  }
  return out;
}
