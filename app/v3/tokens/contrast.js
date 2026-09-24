// app/v3/tokens/contrast.js — בדיקת ניגודיות AA (CONSTITUTION §ב.3, §ח-14).
// פלטה כללית אחת קבועה (navy/sky/gold, D-8) - אין palettes/, אין deriveDark.
// שימוש: הגלריה מריצה checkPair על כל זוג ink/surface בפועל ומציגה יחס+פס/נכשל.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  const int = parseInt(n, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function relLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** contrastRatio('#0a2242','#dcedfa') -> מספר (WCAG). */
export function contrastRatio(hexA, hexB) {
  const la = relLuminance(hexToRgb(hexA));
  const lb = relLuminance(hexToRgb(hexB));
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/** AA: 4.5:1 טקסט רגיל, 3:1 טקסט גדול (>=18px/700 או >=24px)/רכיבי UI. */
export function passesAA(hexInk, hexSurface, { large = false } = {}) {
  const ratio = contrastRatio(hexInk, hexSurface);
  return { ratio: Math.round(ratio * 100) / 100, min: large ? 3 : 4.5, pass: ratio >= (large ? 3 : 4.5) };
}

// הזוגות הנבדקים בפועל בגלריה (CONSTITUTION §ה.5/§ב.2) - ink-on-surface,
// on-dark על navy, accent-ink על gold. ערכי L0/L1 בפועל (primitives.css/semantic.css) -
// כפולים ידנית כאן כי אין build-time CSS var resolution בסקריפט Node פשוט.
export const AA_PAIRS = [
  { name: 'ink / bg', ink: '#0a2242', bg: '#dcedfa' },
  { name: 'ink-2 / surface', ink: '#2f4a6b', bg: '#ffffff' },
  { name: 'ink-3 / surface-2', ink: '#4d6787', bg: '#f3f9fe' },
  { name: 'on-dark / navy (topbar)', ink: '#ffffff', bg: '#0f2c52' },
  { name: 'on-dark-2 / navy-900', ink: '#c9daee', bg: '#0a2242' },
  { name: 'accent-ink / gold (button)', ink: '#1a1200', bg: '#c9a227', large: true },
  { name: 'ov-ink / ov-surface dark (dialog)', ink: '#ffffff', bg: '#0d2a4f' },
  { name: 'danger-ink / rose-100', ink: '#a83d6c', bg: '#ffece5' },
];
