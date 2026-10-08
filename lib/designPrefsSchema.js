// Pure validation/merge logic for the per-employee design-prefs JSON stored
// in Employee.themeColor (see app/api/me/design-prefs/route.js). Kept
// framework-free (no Next/prisma imports) so it can be unit-tested with plain
// Node and reused anywhere.

import { sanitizeUiVariants, UI_SCREENS } from './uiVariant.js';
import { sanitizeAdminPins } from './menu/adminRecents.js';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MODES = ['light', 'dark', 'contrast', 'auto'];
const DENSITIES = ['comfortable', 'compact'];
const TEXT_SCALES = ['small', 'normal', 'large', 'xlarge'];
const KEY_RE = /^[a-z0-9-]{1,32}$/; // palette / font keys
const MAX_SAVED_PALETTES = 24;
const MAX_NAME_LEN = 40;

function cleanHex(v, fallback) {
  return (typeof v === 'string' && HEX_RE.test(v)) ? v : fallback;
}

function cleanCustomColors(v) {
  if (!v || typeof v !== 'object') return undefined;
  const out = {
    primary: cleanHex(v.primary, '#7C2E4D'),
    accent: cleanHex(v.accent, '#96661F'),
    neutral: cleanHex(v.neutral, ''), // '' = auto (derived from primary)
  };
  return out;
}

function cleanSavedPalettes(v) {
  if (!Array.isArray(v)) return undefined;
  const out = [];
  for (const item of v.slice(0, MAX_SAVED_PALETTES)) {
    if (!item || typeof item !== 'object') continue;
    const primary = cleanHex(item.primary, null);
    const accent = cleanHex(item.accent, null);
    if (!primary || !accent) continue;
    const id = (typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(item.id))
      ? item.id
      : Math.random().toString(36).slice(2, 10);
    const name = (typeof item.name === 'string' && item.name.trim())
      ? item.name.trim().slice(0, MAX_NAME_LEN)
      : 'פלטה ללא שם';
    out.push({ id, name, primary, accent, neutral: cleanHex(item.neutral, '') });
  }
  return out;
}

// Returns a sanitized COPY containing only recognized, valid fields from
// `input` (unknown/invalid fields are dropped, not errors).
export function sanitizeDesignPrefs(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  if (typeof input.palette === 'string' && KEY_RE.test(input.palette)) out.palette = input.palette;
  if (typeof input.font === 'string' && KEY_RE.test(input.font)) out.font = input.font;
  if (MODES.includes(input.mode)) out.mode = input.mode;
  if (DENSITIES.includes(input.density)) out.density = input.density;
  if (TEXT_SCALES.includes(input.textScale)) out.textScale = input.textScale;
  const cc = cleanCustomColors(input.customColors);
  if (cc) out.customColors = cc;
  const sp = cleanSavedPalettes(input.savedPalettes);
  if (sp) out.savedPalettes = sp;
  // עקיפות "ישן / A5" פר-מסך (lib/uiVariant.js) — רק מסכים וערכים מוכרים.
  const uv = sanitizeUiVariants(input.uiVariants);
  if (uv) out.uiVariants = uv;
  // "רשום לי התחלת עבודה אוטומטית בכניסה" (דף הכניסה החדש, החלטה Q01: בהעדפות הקיימות של העובד).
  // נכתב רק דרך lib/autoClockPref.js (PUT /api/me/auto-clock-in ולוגין) - PUT /api/me/design-prefs מסיר אותו מהגוף.
  if (typeof input.autoClockIn === 'boolean') out.autoClockIn = input.autoClockIn;
  // כלי ניהול נעוצים בפאנל "ניהול" של התפריט (lib/menu/adminRecents.js, 8.10.2026) - נתיבים נקיים בלבד, עד 5. מערך ריק = אין נעיצות.
  if (Array.isArray(input.adminPins)) {
    const pins = sanitizeAdminPins(input.adminPins);
    if (pins.length) out.adminPins = pins;
  }
  return out;
}

// Shallow merge of a sanitized partial update over existing stored prefs
// (customColors / savedPalettes are replaced wholesale when present in the
// update — the client always sends them complete).
export function mergeDesignPrefs(existing, update) {
  const base = sanitizeDesignPrefs(existing);
  const patch = sanitizeDesignPrefs(update);
  const next = { v: 1, ...base, ...patch };
  // adminPins: מערך ריק בעדכון = שחרור כל הנעיצות (sanitize משמיט מערך ריק, ולכן הוא לא היה דורס את הקיים).
  if (update && typeof update === 'object' && Array.isArray(update.adminPins) && patch.adminPins === undefined) delete next.adminPins;
  return next;
}

// Parses the raw Employee.themeColor column. Legacy values
// ('standard'/'dark'/'vibrant'/'pastel'/null) are NOT design prefs — they
// were written by a dead UI toggle — and read as "no stored prefs".
export function parseStoredDesignPrefs(raw) {
  if (typeof raw !== 'string' || raw[0] !== '{') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) return null;
    return sanitizeDesignPrefs(parsed);
  } catch (e) {
    return null;
  }
}

// --- "האתר הישן": העקיפה היחידה שעובד רשאי לכתוב לעצמו -------------------------------------------
// PUT /api/me/design-prefs מוחק uiVariants בכוונה (עובד לא מדליק לעצמו מסך A5). POST /api/me/ui-variant/shell
// הוא החריג המבוקר היחיד, בכיוון אחד בלבד: value='legacy' (חזרה לתפריט הישן) או null (ביטול העקיפה האישית
// של המעטפת → חוזרים להגדרת הארגון). 'a5' וכל ערך אחר נדחים כאן, לא רק ב-route. מ-2026-10-01 יש גם מסלול להנהלה
// ראשית / מתכנת (buildUiVariantOverride עם allowA5:true, דרך lib/uiVariantSelfSwitch.js) — ההחלטה לפי תפקיד בשרת. שאר המסכים (home,
// order_card, customer_card) ושאר ההעדפות נשמרים כפי שהם. אותה בנייה כמו buildUserThemeColor בסקריפט
// scripts/set-ui-variant.js (מפתח uiVariants ריק מוסר לגמרי).
export const SHELL_OVERRIDE_ALLOWED_VALUES = Object.freeze(['legacy', null]);

// הגרסה הכללית (2026-10-01, "מעבר עצמאי" להנהלה ראשית / מתכנת): עקיפה אישית של מסך אחד (shell / home / ...).
// allowA5=false (ברירת מחדל, כל מי שאינו הנהלה): רק 'legacy' / null — בדיוק הכלל הקודם. allowA5=true: גם 'a5'.
// ההחלטה אם allowA5 מותר נעשית בשרת לפי תפקיד העובד ב-DB (lib/uiVariantSelfSwitch.js), לא כאן ולא לפי הגוף.
export function buildUiVariantOverride(existingRaw, screen, value, { allowA5 = false } = {}) {
  if (typeof screen !== 'string' || !UI_SCREENS.includes(screen)) {
    return { ok: false, error: 'מסך לא מוכר' };
  }
  const valueOk = value === 'legacy' || value === null || (allowA5 === true && value === 'a5');
  if (!valueOk) {
    return {
      ok: false,
      error: allowA5 === true
        ? "ערך לא תקין: מותר רק 'legacy' (ישן), 'a5' (חדש) או null (ביטול העקיפה האישית)"
        : "ערך לא תקין: מותר רק 'legacy' (חזרה לתפריט הישן) או null (ביטול העקיפה האישית)",
    };
  }
  const existing = parseStoredDesignPrefs(existingRaw) || {};
  const previous = existing.uiVariants ? existing.uiVariants[screen] : undefined;
  const nextVariants = { ...(existing.uiVariants || {}) };
  if (value === null) delete nextVariants[screen];
  else nextVariants[screen] = value;

  let next = mergeDesignPrefs(existing, { uiVariants: nextVariants });
  if (Object.keys(nextVariants).length === 0) {
    const { uiVariants: _removed, ...rest } = sanitizeDesignPrefs(existing);
    next = { v: 1, ...rest };
  }
  const prev = previous === undefined ? null : previous;
  return { ok: true, previous: prev, next, serialized: JSON.stringify(next), changed: prev !== value };
}

export function buildLegacyShellOverride(existingRaw, value) {
  if (value !== 'legacy' && value !== null) {
    return { ok: false, error: "ערך לא תקין: מותר רק 'legacy' (חזרה לתפריט הישן) או null (ביטול העקיפה האישית)" };
  }
  return buildUiVariantOverride(existingRaw, 'shell', value, { allowA5: false });
}

// מפצל את ה-`prefs` שמחזיר GET /api/me/design-prefs ל-{ uiVariants, prefs, hasPrefs }.
// `hasPrefs` הוא true רק כשיש העדפות עיצוב "אמיתיות" (פלטה / מצב / גודל טקסט וכו'). בלוב שמכיל אך ורק
// `uiVariants` (עקיפת "ישן / A5" שהבעלים קבע עם scripts/set-ui-variant.js) אין העדפות של העובד, ולכן
// הוא לא אמור לחסום את ההגירה החד-פעמית מ-localStorage ל-DB (DesignPrefsSync).
export function splitServerPrefs(prefs) {
  if (!prefs || typeof prefs !== 'object') return { uiVariants: null, prefs: {}, hasPrefs: false };
  // adminPins (נעיצות תפריט "ניהול") הן כמו uiVariants: לא "העדפת עיצוב" - לא חוסמות הגירה מ-localStorage ולא נכתבות אליו (localStorage משותף לכל העובדים בדפדפן).
  const { uiVariants, adminPins: _adminPins, ...rest } = prefs;
  return {
    uiVariants: uiVariants && typeof uiVariants === 'object' ? uiVariants : null,
    prefs: rest,
    hasPrefs: Object.keys(rest).some((k) => k !== 'v'),
  };
}
