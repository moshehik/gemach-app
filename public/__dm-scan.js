window.__scan = (opts={}) => {
  const P = (c)=>{ const m=c.match(/rgba?\(([^)]+)\)/); if(!m) return null; const a=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r:a[0],g:a[1],b:a[2],a:a[3]===undefined?1:a[3]}; };
  const lum=(c)=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
  const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const over=(top,bot)=>{const a=top.a+bot.a*(1-top.a);return a===0?{r:0,g:0,b:0,a:0}:{r:(top.r*top.a+bot.r*bot.a*(1-top.a))/a,g:(top.g*top.a+bot.g*bot.a*(1-top.a))/a,b:(top.b*top.a+bot.b*bot.a*(1-top.a))/a,a}};
  const root = opts.root||document.body;
  const canvasBg = P(getComputedStyle(document.body).backgroundColor)||{r:27,g:23,b:20,a:1};
  const bgOf=(el)=>{ let chain=[]; let e=el; let grad=false; while(e&&e.nodeType===1){const cs=getComputedStyle(e); if(cs.backgroundImage&&cs.backgroundImage!=='none'&&/gradient/.test(cs.backgroundImage)) {grad=true;} const c=P(cs.backgroundColor); if(c&&c.a>0){chain.push(c); if(c.a>=1) break;} e=e.parentElement;} let acc={r:27,g:23,b:20,a:1}; for(let i=chain.length-1;i>=0;i--) acc=over(chain[i],acc); return {c:acc,grad}; };
  const out=[]; const seen=new Set();
  const all=root.querySelectorAll('*');
  for(const el of all){
    if(['SCRIPT','STYLE','NOSCRIPT','path','use','g','circle','rect','line','polyline'].includes(el.tagName)) continue;
    const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) continue;
    const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0) continue;
    let own=''; for(const n of el.childNodes) if(n.nodeType===3) own+=n.textContent; own=own.trim();
    if(el.tagName==='svg' && !own) own='[icon]'; const isInput=/INPUT|TEXTAREA|SELECT/.test(el.tagName);
    if(!own && !isInput) continue;
    const fg=P(cs.color); if(!fg) continue;
    const {c:bg,grad}=bgOf(el);
    let fgc=over(fg,bg);
    let ratio=cr(fgc,bg);
    if(grad){ let e2=el, gi=null; while(e2){const bi=getComputedStyle(e2).backgroundImage; if(bi&&/gradient/.test(bi)){gi=bi;break;} e2=e2.parentElement;} if(gi){ const stops=[...gi.matchAll(/rgba?\([^)]+\)/g)].map(m=>P(m[0])).filter(c=>c&&c.a>0.5); if(stops.length){ ratio=Math.min(...stops.map(c=>cr(fgc,c))); bg.r=stops[0].r;bg.g=stops[0].g;bg.b=stops[0].b; } } }
    const key=el.tagName+'.'+(el.className&&el.className.baseVal===undefined?String(el.className).split(' ').slice(0,3).join('.'):'')+'|'+Math.round(ratio*10);
    const light = lum(bg)>0.55;
    if(ratio<(opts.min||3.2) || (opts.light && light)){ if(seen.has(key)) continue; seen.add(key); out.push({k:key.split('|')[0], t:(own||el.value||'').slice(0,24), fg:cs.color, bg:`rgb(${bg.r|0},${bg.g|0},${bg.b|0})`, r:+ratio.toFixed(2), grad}); }
  }
  return out;
};
