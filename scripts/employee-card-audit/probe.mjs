// מאתר איזה כלל CSS קובע מאפיין על אלמנט בדף האמיתי (CDP). שימוש: node probe.mjs "<scn>" "<click1;click2>" "<selector>" "<property>"
// לדוגמה: node probe.mjs "" "#ecSend" "#m-sub" border-top-left-radius
import { serve, launch, sleep, PORT } from './lib.mjs';
const [scn = '', clicks = '', selector, prop] = process.argv.slice(2);
const s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: Number(process.env.W || 1280), height: 900 });
await p.goto(`http://127.0.0.1:${PORT}/${scn ? `?scn=${scn}` : ''}`, { waitUntil: 'load' });
await sleep(1500);
for (const c of clicks.split(';').filter(Boolean)) { await p.click(c); await sleep(500); }
const cdp = await p.createCDPSession();
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const { root } = await cdp.send('DOM.getDocument');
const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
const hits = [];
for (const r of m.matchedCSSRules) {
  const decl = r.rule.style.cssProperties.filter((d) => d.name === prop || d.name.startsWith(`${prop}-`) || (d.name === 'border-radius' && /radius/.test(prop)));
  if (decl.length) hits.push(`${r.rule.selectorList.text}  {${decl.map((d) => `${d.name}:${d.value}${d.important ? '!important' : ''}`).join(';')}}  [${r.rule.origin} ${(r.rule.styleSheetId || '').slice(0, 4)}]`);
}
console.log(hits.join('\n'));
const cs = await p.$eval(selector, (el, pr) => getComputedStyle(el)[pr], prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
console.log('computed:', cs);
await b.close(); s.close(); process.exit(0);
