#!/usr/bin/env node
// tools/v3-lint/check-media.mjs — CONSTITUTION §ח.1 #11 / §ב.6 (D-15): כל
// min/max-width ב-@media תחת app/v3/** חייב להיות אחד מ-BREAKPOINTS.
import { glob, read, report } from './lib.mjs';
import { BREAKPOINTS } from '../../app/v3/tokens/breakpoints.js';

const ALLOWED = new Set(Object.values(BREAKPOINTS));
const MEDIA_WIDTH_RE = /@media[^{]*\b(?:min|max)-width\s*:\s*(\d+)px/g;

const files = glob('app/v3/**/*.css');
const findings = [];
for (const file of files) {
  const text = read(file);
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    let m;
    const re = new RegExp(MEDIA_WIDTH_RE);
    while ((m = re.exec(line))) {
      const px = Number(m[1]);
      if (!ALLOWED.has(px)) findings.push({ file, line: i + 1, text: `${px}px אינו בסט הרשמי (${[...ALLOWED].join('/')})` });
    }
  });
}

report('media-breakpoints-single-set', findings);
