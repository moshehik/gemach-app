#!/usr/bin/env node
// tools/v3-lint/check-hex.mjs — CONSTITUTION §ח.1 #1: אין hex/rgb/hsl מחוץ ל-tokens.
// סורק CSS ו-JS תחת app/v3/** ו-app/v3-gallery/** (חוץ מ-tokens/** עצמו,
// שם ההגדרות חיות; ו-icons/svg symbols, שם path geometry לא צבע).
import { glob, read, report } from './lib.mjs';

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_RE = /\brgba?\(/;

const cssFiles = glob('app/v3/**/*.css', { exclude: ['app/v3/tokens/**'] })
  .filter((f) => !f.startsWith('app/v3/tokens/'));
const jsFiles = [
  ...glob('app/v3/**/*.js'),
  ...glob('app/v3-gallery/**/*.js'),
].filter((f) => !f.startsWith('app/v3/tokens/') && !f.endsWith('IconSpriteV3.js'));

const findings = [];
for (const file of [...cssFiles, ...jsFiles]) {
  const text = read(file);
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (/^\s*\/\/|^\s*\*/.test(line)) return; // תגובה שלמה בשורה
    const hexMatches = line.match(HEX_RE) || [];
    hexMatches.forEach((m) => findings.push({ file, line: i + 1, text: `hex ${m}` }));
    if (RGB_RE.test(line) && !line.includes('color-mix')) findings.push({ file, line: i + 1, text: 'rgb()/rgba() קשיח' });
  });
}

report('no-hex-outside-tokens', findings);
