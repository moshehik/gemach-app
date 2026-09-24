#!/usr/bin/env node
// tools/v3-lint/check-arrows.mjs — CONSTITUTION §ח.1 #5 / §ה.5: חצים רק דרך
// <Icon name="...">, ורק בשמות סמנטיים (next/prev/back/forward/undo/redo...),
// לא בשמות גיאומטריים גולמיים (chevron-start/chevron-end/arrow-start/arrow-end)
// ולא כתווי טקסט (←→‹›«») ב-JSX. את המיפוי היחיד מגדיר app/v3/icons/aliases.js -
// זה בדיוק למה שני הקבצים האלה (aliases.js, IconSpriteV3.js) מוחרגים.
import { glob, read, report } from './lib.mjs';

const RAW_NAME_RE = /name=["'](chevron-start|chevron-end|arrow-start|arrow-end)["']/g;
const TEXT_ARROW_RE = /[←→‹›«»]/g;

const files = [...glob('app/v3/**/*.js'), ...glob('app/v3-gallery/**/*.js')]
  .filter((f) => !f.endsWith('icons/aliases.js') && !f.endsWith('IconSpriteV3.js') && !f.endsWith('IconSprite.js'));

const findings = [];
for (const file of files) {
  const text = read(file);
  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return; // תגובת קוד, לא JSX/מחרוזת
    const re1 = new RegExp(RAW_NAME_RE);
    let m;
    while ((m = re1.exec(line))) findings.push({ file, line: i + 1, text: `Icon name="${m[1]}" גולמי — השתמשו בשם סמנטי (next/prev/back/forward/undo/redo)` });
    const re2 = new RegExp(TEXT_ARROW_RE);
    while ((m = re2.exec(line))) {
      if (line.includes('<Range') || line.includes('Range ')) continue; // חריג מתועד: <Range> להצגת "מ ← עד"
      findings.push({ file, line: i + 1, text: `תו חץ '${m[0]}' כטקסט JSX — השתמשו ב-<Icon>` });
    }
  });
}

report('arrows-only-via-icon-semantic-names', findings);
