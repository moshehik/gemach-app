// Pure validation/merge logic for the per-employee design-prefs JSON stored
// in Employee.themeColor (see app/api/me/design-prefs/route.js). Kept
// framework-free (no imports) so it can be unit-tested with plain Node and
// reused anywhere.

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
  return out;
}

// Shallow merge of a sanitized partial update over existing stored prefs
// (customColors / savedPalettes are replaced wholesale when present in the
// update — the client always sends them complete).
export function mergeDesignPrefs(existing, update) {
  const base = sanitizeDesignPrefs(existing);
  const patch = sanitizeDesignPrefs(update);
  return { v: 1, ...base, ...patch };
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
