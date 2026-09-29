// Proves every <style> block of the integrated page equals the original prototype's (CRLF-normalised),
// allowing only the hero image url swap (base64 data-URI -> /a5/hero.jpg).
const fs = require('fs');
const rd = f => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
const A = rd(process.argv[2]), B = rd(process.argv[3]);
const blocks = s => [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[0]);
const a = blocks(A), b = blocks(B);
console.log('style blocks original:', a.length, 'current:', b.length);
let bad = 0;
a.forEach((x, i) => {
  if (b[i] === x) { console.log('block', i, 'IDENTICAL (' + x.length + ' chars)'); return; }
  const norm = t => t.replace(/url\(data:image\/jpeg;base64,[^)]*\)/, 'url(HERO)').replace(/url\(\/a5\/hero\.jpg\)/, 'url(HERO)');
  if (b[i] && norm(x) === norm(b[i])) { console.log('block', i, 'IDENTICAL except the hero image url (extracted to /a5/hero.jpg)'); return; }
  bad++; console.log('block', i, 'DIFFERS');
});
console.log(bad === 0 && a.length === b.length ? 'RESULT: NO CSS DIFFERENCES' : 'RESULT: DIFFERENCES FOUND');
process.exit(bad === 0 && a.length === b.length ? 0 : 1);
