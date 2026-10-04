// אבחון: אילו כללי CSS קובעים מאפיין של אלמנט, בעיצוב (demo) או בדף האמיתי (real). דרך CDP (CSS.getMatchedStylesForNode).
// שימוש: node why.mjs demo|real "<query של הדף האמיתי>" "<סקריפט הכנה (JS) או ->" "<selector>" "<prop1,prop2>"
import { serve, launch, sleep, PORT, DEMO } from './lib.mjs';
const [which, qs, prepJs, sel, propsArg] = process.argv.slice(2);
const props = propsArg.split(',');
let s;
if (which === 'real') s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
await p.goto(which === 'demo' ? DEMO : `http://127.0.0.1:${PORT}/${qs}`, { waitUntil: 'load' });
await sleep(1300);
if (prepJs && prepJs !== '-') { await p.evaluate(prepJs); await sleep(800); }
const c = await p.target().createCDPSession();
await c.send('DOM.enable'); await c.send('CSS.enable');
const { root } = await c.send('DOM.getDocument', { depth: -1 });
const { nodeId } = await c.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
if (!nodeId) { console.log('no node', sel); process.exit(0); }
const m = await c.send('CSS.getMatchedStylesForNode', { nodeId });
const comp = await c.send('CSS.getComputedStyleForNode', { nodeId });
for (const pr of props) {
  console.log('###', pr, '=', (comp.computedStyle.find((x) => x.name === pr) || {}).value);
  for (const r of m.matchedCSSRules.slice().reverse()) {
    const hit = r.rule.style.cssProperties.filter((x) => x.name === pr || x.name.startsWith(pr + '-') || pr.startsWith(x.name));
    if (hit.length) console.log('   ', r.rule.selectorList.text.slice(0, 160), '=>', hit.map((h) => h.name + ':' + h.value + (h.important ? ' !' : '')).join('; '));
  }
}
await b.close(); if (s) s.close();
process.exit(0);
