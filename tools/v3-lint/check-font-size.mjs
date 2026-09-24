#!/usr/bin/env node
// tools/v3-lint/check-font-size.mjs — CONSTITUTION §ח.1 #4: אין font-size קשיח.
// CSS: font-size חייב var(--v3-fs-*) או inherit. JS: fontSize: מספרי/'..px' אסור.
import { glob, read, report } from './lib.mjs';

const CSS_DECL_RE = /font-size\s*:\s*([^;]+);/g;
const JS_BAD_RE = /fontSize\s*:\s*['"]?\d/g;

function isAllowedCssValue(v) {
  const val = v.trim();
  return /^var\(--v3-fs-[\w-]+\)$/.test(val) || val === 'inherit';
}

const cssFiles = glob('app/v3/**/*.css').filter((f) => !f.startsWith('app/v3/tokens/'));
const jsFiles = [...glob('app/v3/**/*.js'), ...glob('app/v3-gallery/**/*.js')];

const findings = [];
for (const file of cssFiles) {
  read(file).split('\n').forEach((line, i) => {
    const re = new RegExp(CSS_DECL_RE);
    let m;
    while ((m = re.exec(line))) {
      if (!isAllowedCssValue(m[1])) findings.push({ file, line: i + 1, text: `font-size: ${m[1].trim()};` });
    }
  });
}
for (const file of jsFiles) {
  read(file).split('\n').forEach((line, i) => {
    const re = new RegExp(JS_BAD_RE);
    let m; while ((m = re.exec(line))) findings.push({ file, line: i + 1, text: m[0].trim() });
  });
}

report('no-hardcoded-font-size', findings);
