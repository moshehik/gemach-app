#!/usr/bin/env node
// tools/v3-lint/check-native-dialogs.mjs — CONSTITUTION §ח.1 #2: אין
// alert/confirm/prompt (הדפדפן) בקוד v3 חדש. חריג: overlays/legacyShim.js
// (Phase 5, לא קיים עדיין) הוא הצרכן היחיד המותר.
import { glob, read, report } from './lib.mjs';

// תופס `alert(`/`confirm(`/`prompt(` גולמיים (הפונקציות הגלובליות של הדפדפן, עם
// או בלי הקידומת `window.`) - **לא** תופס קריאת מתודה על אובייקט אחר כמו
// `layers.confirm(...)` (הבדיקה: מה שקדם מיד לשם הוא "window." או לא אות/דוט).
const RE = /(?<=window\.)(alert|confirm|prompt)\s*\(|(?<![.\w])(alert|confirm|prompt)\s*\(/g;
const files = [...glob('app/v3/**/*.js'), ...glob('app/v3-gallery/**/*.js')]
  .filter((f) => !f.endsWith('overlays/legacyShim.js'));

const findings = [];
for (const file of files) {
  const text = read(file);
  text.split('\n').forEach((line, i) => {
    if (/console\.(log|warn|error)/.test(line)) return;
    const re = new RegExp(RE);
    let m;
    while ((m = re.exec(line))) findings.push({ file, line: i + 1, text: `${m[0]} — השתמשו ב-useLayers().confirm/prompt` });
  });
}

report('no-native-alert-confirm-prompt', findings);
