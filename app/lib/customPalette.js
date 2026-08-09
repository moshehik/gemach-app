// Programmatic HSL-based derivation for the "custom" data-palette option on
// /display-settings — FULL-COVERAGE version: from up to 3 hex controls
// (primary, accent, optional neutral — the neutral defaults to a low-
// saturation tone derived from the primary) it derives the complete אריג
// variable set, light AND dark:
//   * the --primary-* / --accent-* families (same shape as before),
//   * all 10 neutrals (--bg, --surface family, --border family, --text
//     family, --text-on-primary),
//   * the four semantic tints (--success/-warning/-danger/-info-tint) re-based
//     so they sit correctly on the derived neutral (the semantic BASE colors
//     stay the theme's fixed hues),
//   * --shadow-rgb, the r,g,b triplet the --shadow-sm/md/lg definitions in
//     app/design-system.css are built from.
//
// IMPORTANT — SYNC INVARIANT: the no-FOUC bootstrap <script> in app/layout.js
// needs this exact same math to run as plain inline JS before any bundle
// loads, so it can't import this module — it carries a DUPLICATED, VERBATIM
// copy of the block between the __CUSTOM_PALETTE_MATH_START__ /
// __CUSTOM_PALETTE_MATH_END__ markers below. If you change anything inside
// the markers, paste the identical text into app/layout.js (same markers).
// scratch/test_custom_palette_sync.mjs verifies the two copies are identical
// and exercises the derivation — run it after any change here.
//
// The block deliberately uses only `var`, plain string concatenation (NO
// template literals — it is embedded inside a template literal in layout.js,
// so a backtick or ${ would break the file) and no imports/exports.

export const CUSTOM_PALETTE_STYLE_ID = 'custom-palette-style';

// neutral: '' = automatic (derived from the primary hue at low saturation).
export const DEFAULT_CUSTOM_COLORS = { primary: '#7C2E4D', accent: '#96661F', neutral: '' };

/* __CUSTOM_PALETTE_MATH_START__ */
var CP_SEM_ANCHORS = { success: '#3F6A4E', warning: '#8F5E22', danger: '#A6423A', info: '#3E6E8C' };
function cpClamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function cpHexToHsl(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  var clean = m ? m[1] : '7c2e4d';
  var r = parseInt(clean.slice(0, 2), 16) / 255;
  var g = parseInt(clean.slice(2, 4), 16) / 255;
  var b = parseInt(clean.slice(4, 6), 16) / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h = 0, s = 0, l = (max + min) / 2, d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d) + (g < b ? 6 : 0);
    else if (max === g) h = ((b - r) / d) + 2;
    else h = ((r - g) / d) + 4;
    h *= 60;
  }
  return { h: h, s: s * 100, l: l * 100 };
}
function cpHslToHex(h, s, l) {
  var hue = ((h % 360) + 360) % 360;
  var sat = cpClamp(s, 0, 100) / 100;
  var light = cpClamp(l, 0, 100) / 100;
  var c = (1 - Math.abs((2 * light) - 1)) * sat;
  var x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  var m = light - (c / 2);
  var r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; b = 0; }
  else if (hue < 120) { r = x; g = c; b = 0; }
  else if (hue < 180) { r = 0; g = c; b = x; }
  else if (hue < 240) { r = 0; g = x; b = c; }
  else if (hue < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  function toHex(v) {
    var n = cpClamp(Math.round((v + m) * 255), 0, 255).toString(16);
    return n.length === 1 ? '0' + n : n;
  }
  return '#' + toHex(r) + toHex(g) + toHex(b);
}
function cpHexToRgbTriplet(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  var c = m ? m[1] : '000000';
  return parseInt(c.slice(0, 2), 16) + ',' + parseInt(c.slice(2, 4), 16) + ',' + parseInt(c.slice(4, 6), 16);
}
function cpBuildVars(primaryHex, accentHex, neutralHex) {
  var p = cpHexToHsl(primaryHex);
  var a = cpHexToHsl(accentHex);
  var nSrc = /^#?[0-9a-f]{6}$/i.test(neutralHex || '') ? cpHexToHsl(neutralHex) : { h: p.h, s: cpClamp(p.s * 0.25, 8, 40) };
  var n = { h: nSrc.h, s: cpClamp(nSrc.s, 0, 60) };
  var sem = {};
  for (var k in CP_SEM_ANCHORS) sem[k] = cpHexToHsl(CP_SEM_ANCHORS[k]);
  function lightTint(x) { return cpHslToHex(x.h, cpClamp((x.s * 0.55) + (n.s * 0.15), 18, 62), 92); }
  function darkTint(x) { return cpHslToHex(x.h, cpClamp(x.s * 0.5, 16, 42), 15.5); }
  var textOnPrimary = cpHslToHex(n.h, cpClamp(n.s * 1.1, 10, 100), 97.5);
  return {
    light: {
      primary: cpHslToHex(p.h, p.s, p.l),
      primaryHover: cpHslToHex(p.h, cpClamp(p.s + 4, 0, 95), cpClamp(p.l - 8, 6, 94)),
      primarySolid: cpHslToHex(p.h, p.s, p.l),
      primaryTint: cpHslToHex(p.h, cpClamp(p.s * 0.5, 12, 34), 93),
      primaryTint2: cpHslToHex(p.h, cpClamp(p.s * 0.6, 16, 40), 83),
      accent: cpHslToHex(a.h, a.s, a.l),
      accentSolid: cpHslToHex(a.h, a.s, a.l),
      accentTint: cpHslToHex(a.h, cpClamp(a.s * 0.5, 12, 34), 91),
      bg: cpHslToHex(n.h, n.s, 96.5),
      surface: cpHslToHex(n.h, n.s, 100),
      surfaceAlt: cpHslToHex(n.h, cpClamp(n.s * 0.9, 0, 55), 93),
      surfaceSunken: cpHslToHex(n.h, cpClamp(n.s * 0.82, 0, 50), 90.3),
      border: cpHslToHex(n.h, cpClamp(n.s * 0.76, 0, 45), 84.7),
      borderStrong: cpHslToHex(n.h, cpClamp(n.s * 0.75, 0, 42), 77.3),
      text: cpHslToHex(n.h, cpClamp(n.s * 0.3, 4, 18), 14.5),
      text2: cpHslToHex(n.h, cpClamp(n.s * 0.27, 4, 16), 37.8),
      text3: cpHslToHex(n.h, cpClamp(n.s * 0.25, 4, 15), 43),
      textOnPrimary: textOnPrimary,
      successTint: lightTint(sem.success),
      warningTint: lightTint(sem.warning),
      dangerTint: lightTint(sem.danger),
      infoTint: lightTint(sem.info),
      shadowRgb: cpHexToRgbTriplet(cpHslToHex(n.h, cpClamp(n.s * 0.55, 8, 40), 17))
    },
    dark: {
      primary: cpHslToHex(p.h, cpClamp(p.s * 0.7, 30, 72), cpClamp(p.l + 38, 60, 82)),
      primaryHover: cpHslToHex(p.h, cpClamp(p.s * 0.65, 26, 66), cpClamp(p.l + 48, 70, 88)),
      primarySolid: cpHslToHex(p.h, cpClamp(p.s * 0.85, 35, 82), cpClamp((p.l * 0.85) + 10, 30, 52)),
      primaryTint: cpHslToHex(p.h, cpClamp(p.s * 0.55, 18, 52), cpClamp((p.l * 0.22) + 6, 11, 24)),
      primaryTint2: cpHslToHex(p.h, cpClamp(p.s * 0.6, 20, 55), cpClamp((p.l * 0.3) + 7, 15, 30)),
      accent: cpHslToHex(a.h, cpClamp(a.s * 0.65, 28, 68), cpClamp(a.l + 36, 58, 80)),
      accentSolid: cpHslToHex(a.h, cpClamp(a.s * 0.8, 32, 78), cpClamp((a.l * 0.85) + 9, 28, 48)),
      accentTint: cpHslToHex(a.h, cpClamp(a.s * 0.55, 18, 50), cpClamp((a.l * 0.24) + 6, 11, 24)),
      bg: cpHslToHex(n.h, cpClamp(n.s * 0.34, 4, 22), 9.2),
      surface: cpHslToHex(n.h, cpClamp(n.s * 0.33, 4, 22), 12.4),
      surfaceAlt: cpHslToHex(n.h, cpClamp(n.s * 0.36, 4, 24), 15),
      surfaceSunken: cpHslToHex(n.h, cpClamp(n.s * 0.37, 4, 24), 8.4),
      border: cpHslToHex(n.h, cpClamp(n.s * 0.4, 5, 26), 20),
      borderStrong: cpHslToHex(n.h, cpClamp(n.s * 0.44, 5, 28), 24.3),
      text: cpHslToHex(n.h, cpClamp(n.s * 0.86, 8, 50), 91.5),
      text2: cpHslToHex(n.h, cpClamp(n.s * 0.4, 6, 28), 71),
      text3: cpHslToHex(n.h, cpClamp(n.s * 0.25, 4, 18), 55.5),
      textOnPrimary: textOnPrimary,
      successTint: darkTint(sem.success),
      warningTint: darkTint(sem.warning),
      dangerTint: darkTint(sem.danger),
      infoTint: darkTint(sem.info),
      shadowRgb: '0,0,0'
    }
  };
}
function cpCssBlock(side) {
  return '--bg:' + side.bg + ';--surface:' + side.surface + ';--surface-alt:' + side.surfaceAlt
    + ';--surface-sunken:' + side.surfaceSunken + ';--border:' + side.border
    + ';--border-strong:' + side.borderStrong + ';--text:' + side.text + ';--text-2:' + side.text2
    + ';--text-3:' + side.text3 + ';--text-on-primary:' + side.textOnPrimary
    + ';--primary:' + side.primary + ';--primary-hover:' + side.primaryHover
    + ';--primary-solid:' + side.primarySolid + ';--primary-tint:' + side.primaryTint
    + ';--primary-tint-2:' + side.primaryTint2 + ';--accent:' + side.accent
    + ';--accent-solid:' + side.accentSolid + ';--accent-tint:' + side.accentTint
    + ';--success-tint:' + side.successTint + ';--warning-tint:' + side.warningTint
    + ';--danger-tint:' + side.dangerTint + ';--info-tint:' + side.infoTint
    + ';--shadow-rgb:' + side.shadowRgb + ';';
}
function cpCssText(vars) {
  // Light block carries :not([data-theme="contrast"]) so the high-contrast
  // accessibility mode (design-system.css) always wins over a custom palette
  // regardless of stylesheet order. The dark block needs no guard —
  // data-theme can't be "dark" and "contrast" at once — and, being later in
  // this same sheet at equal specificity (0,3,0), it beats the light block
  // whenever data-theme="dark".
  return ':root[data-palette="custom"]:not([data-theme="contrast"]){' + cpCssBlock(vars.light) + '}'
    + ':root[data-palette="custom"][data-theme="dark"]{' + cpCssBlock(vars.dark) + '}';
}
/* __CUSTOM_PALETTE_MATH_END__ */

export const hexToHsl = cpHexToHsl;
export const hslToHex = cpHslToHex;

// Derives the full light+dark variable set from primary + accent (+ optional
// neutral) hex values. Shape follows the hand-picked presets; see the header
// comment for what is derived vs. what stays fixed.
export function buildCustomPaletteVars(primaryHex, accentHex, neutralHex) {
  return cpBuildVars(primaryHex, accentHex, neutralHex);
}

export function customPaletteCssText(vars) {
  return cpCssText(vars);
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
  const neutral = (colors && colors.neutral) || '';
  const css = customPaletteCssText(buildCustomPaletteVars(primary, accent, neutral));
  let styleEl = document.getElementById(CUSTOM_PALETTE_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = CUSTOM_PALETTE_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}
