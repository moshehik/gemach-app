// Shared client-side helpers for the per-user design preferences system.
//
// Storage layers (fastest first):
//   1. localStorage `gemachDesignPrefs` — instant, browser-wide. The only
//      persistence for guests; for logged-in employees it's just a warm mirror
//      (the no-FOUC bootstrap in app/layout.js ignores it when a session
//      cookie exists).
//   2. Cookies `designPrefs_<employeeId>` (palette/font/density/textScale/
//      customColors — what SSR needs before paint) and `theme_<employeeId>`
//      (display mode). Read server-side by RootLayout for first-paint attrs.
//   3. DB — Employee.themeColor, repurposed as a JSON blob (source of truth,
//      via GET/PUT /api/me/design-prefs). Includes everything the cookie has
//      PLUS mode and the savedPalettes list (kept out of the cookie to keep
//      request headers small). app/components/DesignPrefsSync.js pulls it on
//      load and pushes a one-time migration of legacy local-only prefs.
//
// Full prefs shape (DB + localStorage):
//   { v: 1, palette, font, mode, density, textScale,
//     customColors: { primary, accent, neutral },   // neutral '' = auto
//     savedPalettes: [{ id, name, primary, accent, neutral }] }

import { applyCustomPaletteStyle, DEFAULT_CUSTOM_COLORS } from './customPalette';

export const STORAGE_KEY = 'gemachDesignPrefs';

export const DESIGN_PREFS_EVENT = 'gemach-design-prefs-applied';

export function readLocalPrefs() {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

export function writeLocalPrefs(raw) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch (e) {}
}

// Writes the subset of prefs SSR needs before paint (mode has its own
// theme_<employeeId> cookie). No-ops for guests (no employeeId to scope by).
export function writeDesignPrefsCookie(employeeId, raw) {
  if (typeof document === 'undefined' || !employeeId) return;
  const payload = {
    palette: raw.palette,
    font: raw.font,
    density: raw.density,
    textScale: raw.textScale,
    customColors: raw.customColors,
  };
  try {
    document.cookie = `designPrefs_${employeeId}=${encodeURIComponent(JSON.stringify(payload))}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {}
}

export function writeThemeCookie(employeeId, mode) {
  if (typeof document === 'undefined' || !employeeId || !mode) return;
  try {
    document.cookie = `theme_${employeeId}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {}
}

export function applyAttr(attr, val, offVals) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!val || offVals.indexOf(val) !== -1) root.removeAttribute(attr);
  else root.setAttribute(attr, val);
}

export function applyMode(mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark' || mode === 'light' || mode === 'contrast') {
    root.setAttribute('data-theme', mode);
  } else if (mode === 'auto') {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
  // falsy mode: leave whatever SSR/bootstrap already applied
}

// Applies a full prefs object to the live document — same "off value = omit
// the attribute" convention as the SSR path and the bootstrap script.
export function applyPrefsToDom(prefs) {
  if (!prefs) return;
  applyAttr('data-palette', prefs.palette, ['wine']);
  applyAttr('data-font', prefs.font, ['default']);
  applyAttr('data-density', prefs.density, ['comfortable']);
  applyAttr('data-text-scale', prefs.textScale, ['normal']);
  if (prefs.palette === 'custom') {
    applyCustomPaletteStyle({ ...DEFAULT_CUSTOM_COLORS, ...(prefs.customColors || {}) });
  }
  applyMode(prefs.mode);
}

// Fire-and-forget partial update of the DB copy (server merges shallowly).
// Guests get a 401 back — harmless, swallowed.
export function pushPrefsToServer(partial) {
  if (typeof fetch === 'undefined') return Promise.resolve();
  return fetch('/api/me/design-prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  }).catch(() => {});
}
