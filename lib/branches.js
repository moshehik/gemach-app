// lib/branches.js - ריבוי סניפים (docs/branches-plan.md): הגדרת הסניפים, היכולות שלהם (מדידה / איסוף / החזרה) והסניף הראשי.
// לוגיקה טהורה בלבד (בלי prisma / next / @/) - נבדקת ב-scripts/test_branches.mjs ושמישה גם בצד הלקוח.
//
// אחסון: SystemSetting בלבד, בלי טבלה.
//   multi_branch_enabled  'true' | 'false'   מתג ראשי. חסר / כל ערך אחר = כבוי = המערכת כמו לפני התכונה.
//   branches_config       JSON { v:1, branches:[{ id, name, isMain, measure, pickup, return, active }] }
//   branch_list           'שם1, שם2' - **משתקף** מ-branches_config בכל שמירה (סניפים פעילים), כדי שכל הקוד הקיים
//                         (טפסי הזמנה, לו"ז, רשימת הזמנות) ימשיך לעבוד בלי שינוי.
// ההזמנה שומרת את **שם** הסניף (Order.branch / pickupBranch) והפריט הפיזי את שמו ב-DressItem.branch - לכן אסור לשנות שם של
// סניף שכבר בשימוש (ה-API חוסם); משביתים (active:false) ומוסיפים חדש.

export const MULTI_BRANCH_KEY = 'multi_branch_enabled';
export const BRANCHES_CONFIG_KEY = 'branches_config';
export const BRANCH_LIST_KEY = 'branch_list';
export const BRANCH_CAPABILITIES = Object.freeze(['measure', 'pickup', 'return']);
export const CAPABILITY_LABEL = Object.freeze({ measure: 'מדידה', pickup: 'איסוף', return: 'החזרה' });
export const MAX_BRANCHES = 12;
export const MAX_BRANCH_NAME = 40;

// הגדרות ההתראות (כולן אופציונליות; ברירות המחדל כאן הן מה שקורה כששורה חסרה)
export const BRANCH_SETTING_KEYS = Object.freeze({
  bannerEnabled: 'branch_transfer_banner_enabled',
  bannerDays: 'branch_transfer_banner_days',
  bannerScope: 'branch_transfer_banner_scope',
  horizonDays: 'branch_transfer_horizon_days',
  returnAlert: 'branch_return_alert_enabled',
  // התראה בסריקת החזרה על פריט רזרבה שיצא באישור וחזר ("להחזיר לרזרבה") - לא תלויה בסניפים. ברירת מחדל כבוי
  reserveAlert: 'reserve_return_alert_enabled',
});
export const BANNER_SCOPES = Object.freeze(['transfer', 'return', 'both']);
export const DEFAULT_BANNER_DAYS = 3;
export const DEFAULT_HORIZON_DAYS = 14;

const toBool = (v) => v === true || v === 'true';
const clampInt = (v, fallback, min, max) => {
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** @param {Record<string,string>} map SystemSetting key -> value */
export function isMultiBranchEnabled(map) {
  return !!map && map[MULTI_BRANCH_KEY] === 'true';
}

/** 'א, ב ,ג' -> ['א','ב','ג'] (כמו branchListOf בטופס ההזמנה) */
export function parseBranchList(str) {
  return String(str || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function normalizeBranch(b, i) {
  const name = String((b && b.name) || '').trim();
  return {
    id: String((b && b.id) || '').trim() || `b${i + 1}`,
    name,
    isMain: toBool(b && b.isMain),
    measure: b && b.measure !== undefined ? toBool(b.measure) : true,
    pickup: b && b.pickup !== undefined ? toBool(b.pickup) : true,
    return: b && b.return !== undefined ? toBool(b.return) : true,
    active: b && b.active !== undefined ? toBool(b.active) : true,
  };
}

/**
 * קורא את branches_config (JSON). ללא קונפיגורציה תקינה - נגזר מ-branch_list (כל הסניפים פעילים עם כל היכולות, הראשון = ראשי),
 * כך שגם גמ"ח שרק הגדיר רשימה בטקסט יקבל התנהגות הגיונית.
 * @returns {{ branches: object[], derived: boolean }}
 */
export function parseBranchesConfig(raw, legacyList = '') {
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.branches) ? parsed.branches : null);
      if (list) {
        const branches = list.map(normalizeBranch).filter((b) => b.name);
        return { branches, derived: false };
      }
    } catch {
      // JSON שבור = כאילו לא הוגדר
    }
  }
  const names = parseBranchList(legacyList);
  return {
    branches: names.map((name, i) => ({ id: `b${i + 1}`, name, isMain: i === 0, measure: true, pickup: true, return: true, active: true })),
    derived: true,
  };
}

/** @param {Record<string,string>} map */
export function branchConfigFromSettings(map) {
  const m = map || {};
  return parseBranchesConfig(m[BRANCHES_CONFIG_KEY], m[BRANCH_LIST_KEY]);
}

export const activeBranches = (cfg) => (cfg && cfg.branches ? cfg.branches : []).filter((b) => b.active);

/** הסניף הראשי: הפעיל המסומן, ואם אין - הפעיל הראשון. null כשאין סניפים */
export function mainBranch(cfg) {
  const act = activeBranches(cfg);
  return act.find((b) => b.isMain) || act[0] || null;
}

/** סניפים פעילים עם יכולת מסוימת ('measure' | 'pickup' | 'return') */
export const branchesWith = (cfg, cap) => activeBranches(cfg).filter((b) => b[cap]);

export const findBranchByName = (cfg, name) => {
  const n = String(name || '').trim();
  if (!n) return null;
  return (cfg && cfg.branches ? cfg.branches : []).find((b) => b.name === n) || null;
};

/** הסניף שההזמנה "צריכה" שיהיה בו הפריט: איסוף אם נקבע, אחרת סניף הביצוע (כמו לו"ז ו-dressLocationAlerts) */
export const orderTargetBranch = (order) => (order && (order.pickupBranch || order.branch)) || null;

/** סניף נוכחי אפקטיבי של פריט: הרשום, ואם אין - הסניף הראשי (החלטה פתוחה #1 ב-docs/branches-plan.md) */
export function effectiveUnitBranch(unitBranch, cfg) {
  const b = String(unitBranch || '').trim();
  if (b) return b;
  const main = mainBranch(cfg);
  return main ? main.name : null;
}

/** branch_list המשתקף: שמות הסניפים הפעילים, הראשי ראשון */
export function branchListString(cfg) {
  const act = activeBranches(cfg);
  const main = mainBranch(cfg);
  const ordered = main ? [main, ...act.filter((b) => b !== main)] : act;
  return ordered.map((b) => b.name).join(', ');
}

/**
 * ולידציה ונירמול של קלט מסך הניהול. idGen() מחזיר מזהה חדש (מוזרק - הפונקציה נשארת דטרמיניסטית לבדיקות).
 * @returns {{ ok: boolean, branches?: object[], errors: string[] }}
 */
export function sanitizeBranchesInput(input, { idGen } = {}) {
  const errors = [];
  if (!Array.isArray(input)) return { ok: false, errors: ['רשימת הסניפים חסרה'] };
  if (input.length > MAX_BRANCHES) errors.push(`אפשר עד ${MAX_BRANCHES} סניפים`);
  const seenNames = new Set();
  const seenIds = new Set();
  const out = [];
  input.forEach((raw, i) => {
    const name = String((raw && raw.name) || '').trim().replace(/\s+/g, ' ');
    if (!name) { errors.push(`לסניף ${i + 1} אין שם`); return; }
    if (name.length > MAX_BRANCH_NAME) errors.push(`שם הסניף "${name.slice(0, 12)}..." ארוך מדי (עד ${MAX_BRANCH_NAME} תווים)`);
    if (/[,\n\r"<>]/.test(name)) errors.push(`בשם הסניף "${name}" יש תו אסור (פסיק, מרכאות כפולות או סימני <>)`);
    const key = name.toLowerCase();
    if (seenNames.has(key)) errors.push(`השם "${name}" מופיע פעמיים`);
    seenNames.add(key);
    let id = String((raw && raw.id) || '').trim();
    if (!id || seenIds.has(id)) id = idGen ? idGen(i) : `b${i + 1}`;
    seenIds.add(id);
    const b = normalizeBranch({ ...raw, id, name }, i);
    out.push(b);
  });
  const active = out.filter((b) => b.active);
  if (active.length > 0) {
    const mains = active.filter((b) => b.isMain);
    if (mains.length === 0) errors.push('יש לסמן סניף ראשי אחד');
    if (mains.length > 1) errors.push('אפשר לסמן רק סניף ראשי אחד');
  }
  // סניף מושבת לא יכול להיות ראשי
  for (const b of out) if (!b.active) b.isMain = false;
  return errors.length ? { ok: false, errors } : { ok: true, branches: out, errors: [] };
}

/** מה לכתוב ל-SystemSetting בשמירה: branches_config + branch_list המשתקף */
export function settingsFromBranches(branches) {
  const cfg = { branches };
  return {
    [BRANCHES_CONFIG_KEY]: JSON.stringify({ v: 1, branches }),
    [BRANCH_LIST_KEY]: branchListString(cfg),
  };
}

/** שינויי שם: מחזיר [{id, from, to}] לסניפים קיימים ששמם שונה (השרת חוסם אם השם הישן בשימוש) */
export function renamedBranches(prevBranches, nextBranches) {
  const prev = new Map((prevBranches || []).map((b) => [b.id, b]));
  const out = [];
  for (const b of nextBranches || []) {
    const p = prev.get(b.id);
    if (p && p.name !== b.name) out.push({ id: b.id, from: p.name, to: b.name });
  }
  return out;
}

/** ההגדרות המפורשות של ההתראות, עם ברירות מחדל */
export function resolveBranchNoticeSettings(map) {
  const m = map || {};
  const enabled = isMultiBranchEnabled(m);
  const scopeRaw = m[BRANCH_SETTING_KEYS.bannerScope];
  return {
    enabled,
    bannerEnabled: enabled && m[BRANCH_SETTING_KEYS.bannerEnabled] === 'true',
    bannerDays: clampInt(m[BRANCH_SETTING_KEYS.bannerDays], DEFAULT_BANNER_DAYS, 0, 60),
    bannerScope: BANNER_SCOPES.includes(scopeRaw) ? scopeRaw : 'both',
    horizonDays: clampInt(m[BRANCH_SETTING_KEYS.horizonDays], DEFAULT_HORIZON_DAYS, 1, 60),
    // התראת סריקת החזרה: דלוקה כברירת מחדל כשהריבוי דלוק, אלא אם כבו אותה במפורש
    returnAlert: enabled && m[BRANCH_SETTING_KEYS.returnAlert] !== 'false',
    reserveAlert: m[BRANCH_SETTING_KEYS.reserveAlert] === 'true',
  };
}

/** "הסניף של המחשב הזה" - ברירת המחדל לסריקות והזמנות. נשמר ב-localStorage (בדפדפן בלבד) */
export const MY_BRANCH_STORAGE_KEY = 'gemach_my_branch';
// אותו ערך גם בעוגייה (לא רגישה, נכתבת מהדפדפן) - כדי שהשרת (POST /api/returns/scan) ידע באיזה סניף נסרקה ההחזרה בלי לשנות את בקשת הסריקה
export const MY_BRANCH_COOKIE = 'gm_my_branch';
export const LEGACY_LAST_ORDER_BRANCH_KEY = 'gemach_last_order_branch';

/** בחירת סניף ברירת מחדל לפי הערך השמור (אם עדיין פעיל), אחרת הראשי */
export function pickDefaultBranch(cfg, stored) {
  const s = String(stored || '').trim();
  const act = activeBranches(cfg);
  if (s && act.some((b) => b.name === s)) return s;
  const main = mainBranch(cfg);
  return main ? main.name : '';
}
