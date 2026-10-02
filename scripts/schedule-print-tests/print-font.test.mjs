// The Hebrew web font must reach the production page. An @import inside print.css is dropped in the built CSS
// chunk (Next merges print.css after the pages/pp*.css rules; an @import that is not first is ignored by the
// browser - found in a real `next build`, the harness never saw it because it links print.css on its own).
// So: no @import in any print stylesheet, and the print page loads the font through its own <style> element.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const proj = process.env.PROJ || process.cwd();
const read = (rel) => fs.readFileSync(path.join(proj, rel), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('print.css and pages/pp*.css contain no @import', () => {
  const files = ['app/components/schedule/print/print.css', ...fs.readdirSync(path.join(proj, 'app/components/schedule/print/pages')).filter((f) => /\.css$/i.test(f)).map((f) => 'app/components/schedule/print/pages/' + f)];
  for (const f of files) assert.ok(!/@import/i.test(stripComments(read(f))), `${f} must not @import (dropped in the production chunk)`);
});

test('the print page renders the font <style> from lib/schedule/print/font.js', async () => {
  const src = read('app/schedule/print/[page]/page.js');
  assert.match(src, /import \{ PRINT_FONT_CSS \} from '@\/lib\/schedule\/print\/font'/);
  assert.ok(src.includes('<' + 'style>{PRINT_FONT_CSS}</' + 'style>'), 'page renders the font style element');
  const { PRINT_FONT_CSS } = await import(pathToFileURL(path.join(proj, 'lib/schedule/print/font.js')).href);
  assert.match(PRINT_FONT_CSS, /^@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Noto\+Sans\+Hebrew/);
});
