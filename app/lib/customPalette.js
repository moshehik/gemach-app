// Programmatic HSL-based derivation for the "custom" data-palette option on
// /display-settings — lets a user pick just a primary + accent color and get
// the full --primary/--primary-hover/--primary-solid/--primary-tint/
// --primary-tint-2 set (+ the --accent family), light AND dark, in the same
// shape every hand-picked preset in app/design-system.css's "PALETTE
// PRESETS" block uses.
//
// IMPORTANT: the no-FOUC bootstrap <script> in app/layout.js needs this exact
// same math to run as plain inline JS before any bundle loads, so it can't
// import this module — it carries its own duplicated copy (search that file
// for "customPaletteCssText"). Keep both in sync if you ever tune the
// derivation formula.

export const CUSTOM_PALETTE_STYLE_ID = 'custom-palette-style';

export const DEFAULT_CUSTOM_COLORS = { primary: '#7C2E4D', accent: '#96661F' };

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const clean = m ? m[1] : DEFAULT_CUSTOM_COLORS.primary.slice(1);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d) + (g < b ? 6 : 0); break;
      case g: h = ((b - r) / d) + 2; break;
      default: h = ((r - g) / d) + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs((2 * light) - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - (c / 2);
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) { r = c; g = x; b = 0; }
  else if (hue < 120) { r = x; g = c; b = 0; }
  else if (hue < 180) { r = 0; g = c; b = x; }
  else if (hue < 240) { r = 0; g = x; b = c; }
  else if (hue < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v) => clamp(Math.round((v + m) * 255), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Derives the full light+dark variable set from just a primary + accent hex.
// Shape follows the hand-picked presets: hover = darker & a touch more
// saturated; tint/tint-2 = lightened toward the surface, less saturated;
// dark mode = a pastel primary/accent (readable as text on a dark bg), a
// mid-dark "solid" (for filled buttons), and near-black tints (for sunken
// backgrounds).
export function buildCustomPaletteVars(primaryHex, accentHex) {
  const p = hexToHsl(primaryHex);
  const a = hexToHsl(accentHex);
  return {
    light: {
      primary: hslToHex(p.h, p.s, p.l),
      primaryHover: hslToHex(p.h, clamp(p.s + 4, 0, 95), clamp(p.l - 8, 6, 94)),
      primarySolid: hslToHex(p.h, p.s, p.l),
      primaryTint: hslToHex(p.h, clamp(p.s * 0.5, 12, 34), 93),
      primaryTint2: hslToHex(p.h, clamp(p.s * 0.6, 16, 40), 83),
      accent: hslToHex(a.h, a.s, a.l),
      accentSolid: hslToHex(a.h, a.s, a.l),
      accentTint: hslToHex(a.h, clamp(a.s * 0.5, 12, 34), 91),
    },
    dark: {
      primary: hslToHex(p.h, clamp(p.s * 0.7, 30, 72), clamp(p.l + 38, 60, 82)),
      primaryHover: hslToHex(p.h, clamp(p.s * 0.65, 26, 66), clamp(p.l + 48, 70, 88)),
      primarySolid: hslToHex(p.h, clamp(p.s * 0.85, 35, 82), clamp((p.l * 0.85) + 10, 30, 52)),
      primaryTint: hslToHex(p.h, clamp(p.s * 0.55, 18, 52), clamp((p.l * 0.22) + 6, 11, 24)),
      primaryTint2: hslToHex(p.h, clamp(p.s * 0.6, 20, 55), clamp((p.l * 0.3) + 7, 15, 30)),
      accent: hslToHex(a.h, clamp(a.s * 0.65, 28, 68), clamp(a.l + 36, 58, 80)),
      accentSolid: hslToHex(a.h, clamp(a.s * 0.8, 32, 78), clamp((a.l * 0.85) + 9, 28, 48)),
      accentTint: hslToHex(a.h, clamp(a.s * 0.55, 18, 50), clamp((a.l * 0.24) + 6, 11, 24)),
    },
  };
}

export function customPaletteCssText(vars) {
  const { light, dark } = vars;
  return (
    `:root[data-palette="custom"]{`
    + `--primary:${light.primary};--primary-hover:${light.primaryHover};--primary-solid:${light.primarySolid};`
    + `--primary-tint:${light.primaryTint};--primary-tint-2:${light.primaryTint2};`
    + `--accent:${light.accent};--accent-solid:${light.accentSolid};--accent-tint:${light.accentTint};`
    + `}`
    + `:root[data-palette="custom"][data-theme="dark"]{`
    + `--primary:${dark.primary};--primary-hover:${dark.primaryHover};--primary-solid:${dark.primarySolid};`
    + `--primary-tint:${dark.primaryTint};--primary-tint-2:${dark.primaryTint2};`
    + `--accent:${dark.accent};--accent-solid:${dark.accentSolid};--accent-tint:${dark.accentTint};`
    + `}`
  );
}

// Creates (or updates) the <style> tag carrying the derived custom-palette
// CSS. This is a real stylesheet rule scoped to [data-palette="custom"] —
// NOT an inline style= override on <html> — so it composes with data-theme
// switching exactly like the hand-picked presets in design-system.css do
// (an inline style attribute would always win over the ...[data-theme="dark"]
// selector and never let dark mode's variant apply).
export function applyCustomPaletteStyle(colors) {
  if (typeof document === 'undefined') return;
  const primary = (colors && colors.primary) || DEFAULT_CUSTOM_COLORS.primary;
  const accent = (colors && colors.accent) || DEFAULT_CUSTOM_COLORS.accent;
  const css = customPaletteCssText(buildCustomPaletteVars(primary, accent));
  let styleEl = document.getElementById(CUSTOM_PALETTE_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = CUSTOM_PALETTE_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}
