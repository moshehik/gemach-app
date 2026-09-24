/* ==== V3 SHELL RUNTIME — assembled from sketch/order-card-sketch-B.html (see SHELL-BLOCK.md for line refs). Edit only via tools/build-shell.cjs sources. ==== */
/* [G0] shell globals (glue, not in sketch): pages ASSIGN these (use `var`/function declarations, never let/const) */
var UI=window.UI||{}, logs=window.logs||[], HCATS=window.HCATS||[['all','הכל','list']], THUMBS=['var(--sky-100)','var(--gold-100)','var(--sky-200)'], WHO=window.WHO||'דנה אברהם';
var netDelta=function(){return 0}, dirty=function(){return false}, richHTML=function(){return ''};
var SK_NAV_CUR=window.SK_NAV_CUR||'רשימת הזמנות';
/* [S1] helpers — sketch L1925-1930, L1956 */
const $ = s => document.querySelector(s);
const ic = (n, c='') => `<svg class="ic ${c}"><use href="#i-${n}"/></svg>`;
const money = n => `<bdi dir="ltr">₪${Math.abs(n).toLocaleString('he-IL')}</bdi>`;
const smoney = n => `<bdi dir="ltr">${n<0?'−':'+'}₪${Math.abs(n).toLocaleString('he-IL')}</bdi>`;
const tip = t => `<button type="button" class="tip" data-tip="${t}" aria-label="עזרה">${ic('info','sm')}</button>`;
const clone = o => JSON.parse(JSON.stringify(o));
function plural(n,one,many,zero){ if(n===0&&zero!==undefined) return zero; return n===1?one:`${n} ${many}`; }
/* [S2] Hebrew day titles — sketch L2287-2291, L2569 */
const wdl=iso=>new Date(iso+'T12:00:00').toLocaleDateString('he-IL',{weekday:'long'});
const GDAY=['','א','ב','ג','ד','ה','ו','ז','ח','ט','י','יא','יב','יג','יד','טו','טז','יז','יח','יט','כ','כא','כב','כג','כד','כה','כו','כז','כח','כט','ל'];
function gershay(str){ return str.length>1? str.slice(0,-1)+'״'+str.slice(-1) : str+'׳'; }
function gemYear(n){ n=n%1000; const L=[[400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],[90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'נ'],[40,'מ'],[30,'ל'],[20,'כ'],[10,'י'],[9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],[5,'ה'],[4,'ד'],[3,'ג'],[2,'ב'],[1,'א']]; let o=''; for(const [v,c] of L){ while(n>=v){ if(n===15){o+='טו';n=0;break} if(n===16){o+='טז';n=0;break} o+=c;n-=v } } return gershay(o); }
function dayTitle(iso){ const d=new Date(iso+'T12:00:00'); const opt=o=>d.toLocaleDateString('he-IL-u-ca-hebrew',o); const day=parseInt(opt({day:'numeric'}),10), mon=opt({month:'long'}), yr=parseInt(opt({year:'numeric'}),10); return `${wdl(iso)} ${gershay(GDAY[day])} ${mon} ${gemYear(yr)}`; }
const greg=iso=>{const x=new Date(iso+'T12:00:00');return x.getDate()+'.'+(x.getMonth()+1)+'.'+x.getFullYear()};
/* [S3] history feed (hf-) — sketch L2292-2387 */
/* ---- hf-: history search + multi-select filter ---- */
const HF_MAP={sig:'sig',print:'print',mail:'mail',fix:'scissors'};
const HF_EXTRA=[['sig','חתימות','sig'],['print','הדפסות','print'],['mail','מיילים','mail'],['fix','תיקונים','scissors']];
const hfIn=(l,k)=>HF_MAP[k]?l.icon===HF_MAP[k]:l.cat===k;
function hfCats(){ return HCATS.filter(c=>c[0]!=='all').concat(HF_EXTRA.filter(([k])=>logs.some(l=>hfIn(l,k)))); }
function hfWords(){ return (UI.hq||'').trim().toLowerCase().split(/\s+/).filter(Boolean); }
function hfHay(l){ const d=l.ts.slice(0,10); return [l.text,l.sub||'',l.who,l.ts.slice(11),greg(d),...(l.det||[]).flat()].join(' ').toLowerCase(); }
function hfHit(l,w){ if(!w.length) return true; const h=hfHay(l); return w.every(x=>h.includes(x)); }
function hfHl(s,w){ if(!w.length||!s) return s; const re=new RegExp('('+w.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi'); return String(s).replace(re,'<mark class="hf-mk">$1</mark>'); }
function hfVisible(){ const sel=UI.hsel||[], w=hfWords(); return logs.filter(l=>(!sel.length||sel.some(k=>hfIn(l,k)))&&hfHit(l,w)).sort((a,b)=>a.ts<b.ts?1:a.ts>b.ts?-1:b.id-a.id); }
function hfRow(c){ const id=c.dataset.hv, on=c.getAttribute('aria-expanded')!=='true'; (UI.hopen||(UI.hopen={}))[id]=on; c.setAttribute('aria-expanded',on); c.classList.toggle('open',on); }
function hfFeed(){
  const open=UI.hopen||(UI.hopen={}), w=hfWords(), L=hfVisible();
  if(!L.length) return `<div class="hf-empty" role="status">${ic('search','lg')}<b>לא נמצאו רישומים</b><button type="button" data-hf-resetall>איפוס</button></div>`;
  let html='', lastDay='';
  L.forEach((l,i)=>{
    const day=l.ts.slice(0,10); if(day!==lastDay){ if(lastDay) html+='</div>'; html+=`<div class="hgrp"><div class="hday"><b>${dayTitle(day)}</b><small>${greg(day)}</small></div>`; lastDay=day; }
    const amt=l.amt?(l.kind==='pay'?`<span class="hamt pay" data-tip="תשלום">${money(l.amt)}</span>`:`<span class="hamt ${l.amt>0?'chg':'crd'}" data-tip="${l.amt>0?'חיוב':'זיכוי'}">${smoney(l.amt)}</span>`):'';
    const init=(l.who||'?').trim()[0];
    const row=(k,v)=>`<div class="hv-r"><small>${k}</small><b>${v}</b></div>`;
    const det=l.det||[], bf=det.find(x=>x[0]==='לפני'), af=det.find(x=>x[0]==='אחרי');
    let rows=`<div class="hv-r"><small>מבצע</small><b><span class="av">${init}</span>${hfHl(l.who,w)}</b></div>`+row('שעה',hfHl(l.ts.slice(11),w));
    if(l.sub) rows+=row('פרטים',hfHl(l.sub,w));
    if(bf&&af) rows+=row('שינוי',`<bdi>${hfHl(bf[1],w)}</bdi> ← <bdi>${hfHl(af[1],w)}</bdi>`);
    det.forEach(([a,b])=>{ if(bf&&af&&(a==='לפני'||a==='אחרי')) return; rows+=row(a,hfHl(b,w)); });
    const o=!!open[l.id]||(w.length&&!w.every(x=>l.text.toLowerCase().includes(x)));
    html+=`<article class="itm hfe${amt?'':' noamt'}${o?' open':''}${l.isNew?' enter':''}" role="button" tabindex="0" data-hv="${l.id}" aria-expanded="${!!o}" style="--i:${Math.min(i,12)}"><div class="top"><div class="thumb" style="background:${l.cat==='pay'?THUMBS[1]:THUMBS[0]}">${ic(l.icon||'clock')}</div><div class="info"><div class="model">${hfHl(l.text,w)}</div></div>${amt}<span class="ibtn chevb" aria-hidden="true">${ic('chev','sm')}</span></div><div class="det-wrap"><div class="det"><div class="det-in">${rows}</div></div></div></article>`;
  });
  return html+'</div>';
}
function hfCount(k){ const w=hfWords(); return logs.filter(l=>(k==='all'||hfIn(l,k))&&hfHit(l,w)).length; }
function hfSync(){
  const sel=UI.hsel||[], root=document.getElementById('hfBar'); if(!root) return;
  const feed=document.getElementById('hfeed'); if(feed) feed.innerHTML=hfFeed();
  root.querySelectorAll('[data-hf-o]').forEach(o=>{ const k=o.dataset.hfO; o.setAttribute('aria-selected',k==='all'?!sel.length:sel.includes(k)); o.querySelector('.hf-oc').textContent=hfCount(k); });
  const b=root.querySelector('.hf-bdg'), was=b.textContent; b.textContent=sel.length||''; b.classList.toggle('has',!!sel.length);
  if(was!==b.textContent&&sel.length){ b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  const names=Object.fromEntries(hfCats().map(c=>[c[0],c[1]]));
  const hc=root.querySelector('.hf-hc'); hc.textContent=sel.length?sel.length+' פעילים':'הכל';
  const pw=root.querySelector('.hf-pills'), want=sel.length&&sel.length<=3?sel:[];
  pw.querySelectorAll('.hf-pill:not(.out)').forEach(x=>{ if(!want.includes(x.dataset.hfPill)){ x.classList.add('out'); setTimeout(()=>x.remove(),200); } });
  want.forEach(k=>{ if(!pw.querySelector('.hf-pill[data-hf-pill="'+k+'"]:not(.out)')) pw.insertAdjacentHTML('beforeend',`<button type="button" class="hf-pill" data-hf-pill="${k}" aria-label="הסרת סינון ${names[k]}">${names[k]}${ic('x')}</button>`); });
  root.querySelector('.hf-cl').classList.toggle('on',!!(UI.hq||''));
  root.querySelector('.hf-sr').textContent=hfVisible().length+' רישומים';
}
function hfSetOpen(on,focus){
  const r=document.querySelector('.hf-sel'); if(!r) return; UI.hpo=on; r.classList.toggle('on',on);
  const t=r.querySelector('.hf-t'); t.setAttribute('aria-expanded',on);
  if(on&&focus){ const o=r.querySelector('.hf-o[aria-selected=true]')||r.querySelector('.hf-o'); setTimeout(()=>o&&o.focus(),30); }
}
function hfToggle(k){ if(k==='all') UI.hsel=[]; else { const s=UI.hsel||(UI.hsel=[]), i=s.indexOf(k); i<0?s.push(k):s.splice(i,1); } hfSync(); }
function pHistory(){
  const sel=UI.hsel||[], cats=[['all','הכל','list']].concat(hfCats());
  const opts=cats.map(([k,l,i],n)=>`<div class="hf-o" role="option" id="hfo-${k}" tabindex="-1" data-hf-o="${k}" style="--k:${n}" aria-selected="${k==='all'?!sel.length:sel.includes(k)}"><span class="hf-ck">${ic('check')}</span><span class="hf-oi">${ic(i)}</span><span class="hf-ol">${l}</span><span class="hf-oc">${hfCount(k)}</span></div>`).join('');
  return `<div class="card hist"><div class="card-h"><div class="ico gold">${ic('clock','lg')}</div><h2>היסטוריה <span class="faint">(${logs.length})</span></h2></div>
  <div class="hf-bar" id="hfBar">
    <div class="hf-s">${ic('search')}<input id="hfQ" type="search" autocomplete="off" placeholder="חיפוש בהיסטוריה" aria-label="חיפוש בהיסטוריה" value="${(UI.hq||'').replace(/"/g,'&quot;')}"><button type="button" class="hf-cl${UI.hq?' on':''}" data-hf-clear aria-label="ניקוי חיפוש">${ic('x')}</button></div>
    <div class="hf-sel${UI.hpo?' on':''}">
      <button type="button" class="hf-t" data-hf-trg aria-haspopup="listbox" aria-expanded="${!!UI.hpo}" aria-controls="hfList">${ic('sliders')}<span class="hf-lbl">סינון</span><span class="hf-bdg${sel.length?' has':''}">${sel.length||''}</span>${ic('chev','hf-chv')}</button>
      <div class="hf-scrim" data-hf-scrim></div>
      <div class="hf-p"><div class="hf-hd"><b>סינון</b><span class="hf-hc">${sel.length?sel.length+' פעילים':'הכל'}</span><button type="button" class="hf-rst" data-hf-reset>איפוס</button></div><div class="hf-l" id="hfList" role="listbox" aria-multiselectable="true" aria-label="סינון היסטוריה">${opts}</div><div class="hf-f"><button type="button" class="hf-done" data-hf-done>${ic('check')}<span>החל</span></button></div></div>
    </div>
    <div class="hf-pills">${sel.length&&sel.length<=3?sel.map(k=>{const c=cats.find(x=>x[0]===k);return c?`<button type="button" class="hf-pill" data-hf-pill="${k}" aria-label="הסרת סינון ${c[1]}">${c[1]}${ic('x')}</button>`:''}).join(''):''}</div>
    <span class="hf-sr" role="status" aria-live="polite"></span>
  </div>
  <div class="hfeed" id="hfeed">${hfFeed()}</div></div>`;
}
document.addEventListener('click',e=>{
  const t=e.target; if(!t.closest) return;
  const g=s=>t.closest(s);
  if(g('[data-hf-trg]')){ hfSetOpen(!UI.hpo,false); return; }
  const o=g('[data-hf-o]'); if(o){ hfToggle(o.dataset.hfO); return; }
  const p=g('[data-hf-pill]'); if(p){ hfToggle(p.dataset.hfPill); return; }
  if(g('[data-hf-reset]')){ UI.hsel=[]; hfSync(); return; }
  if(g('[data-hf-resetall]')){ UI.hsel=[]; UI.hq=''; const i=document.getElementById('hfQ'); if(i) i.value=''; hfSync(); return; }
  if(g('[data-hf-clear]')){ UI.hq=''; const i=document.getElementById('hfQ'); if(i){ i.value=''; i.focus(); } hfSync(); return; }
  if(g('[data-hf-done]')||g('[data-hf-scrim]')){ hfSetOpen(false); const tr=document.querySelector('.hf-t'); tr&&tr.focus(); return; }
  if(UI.hpo&&!g('.hf-sel')) hfSetOpen(false);
});
document.addEventListener('click',e=>{ const c=e.target.closest&&e.target.closest('.itm[data-hv]'); if(!c||e.target.closest('.det,a,input,select,textarea')) return; hfRow(c); });
document.addEventListener('keydown',e=>{ const c=e.target.classList&&e.target.classList.contains('hfe')&&e.target; if(c&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); hfRow(c); } });
document.addEventListener('input',e=>{ if(e.target.id==='hfQ'){ UI.hq=e.target.value; hfSync(); } });
document.addEventListener('keydown',e=>{
  const t=e.target; if(!t.closest) return;
  if(t.closest('.hf-t')&&['ArrowDown','ArrowUp'].includes(e.key)){ e.preventDefault(); hfSetOpen(true,true); return; }
  if(e.key==='Escape'&&UI.hpo&&document.querySelector('.hf-sel')){ e.preventDefault(); hfSetOpen(false); const tr=document.querySelector('.hf-t'); tr&&tr.focus(); return; }
  if(e.key==='Escape'&&t.id==='hfQ'&&t.value){ UI.hq=''; t.value=''; hfSync(); return; }
  const o=t.closest('[data-hf-o]'); if(!o) return;
  const all=[...document.querySelectorAll('.hf-o')], i=all.indexOf(o);
  if(e.key==='ArrowDown'){ e.preventDefault(); all[(i+1)%all.length].focus(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); all[(i-1+all.length)%all.length].focus(); }
  else if(e.key==='Home'){ e.preventDefault(); all[0].focus(); }
  else if(e.key==='End'){ e.preventDefault(); all[all.length-1].focus(); }
  else if(e.key===' '||e.key==='Enter'){ e.preventDefault(); hfToggle(o.dataset.hfO); const n=document.getElementById('hfo-'+o.dataset.hfO); n&&n.focus(); }
});

/* [S4] toast — sketch L2447-2456, L2820-2829 */
let toastT;
function toast(kind,big,small,btn){
  const t=$('#toast');
  const icn = kind==='charge'?'plus':kind==='credit'?'undo':'info';
  t.className=''; void t.offsetWidth;
  t.innerHTML=`<button type="button" class="tclose" data-tip="סגור" aria-label="סגירה">${ic('x','sm')}</button><div class="tb">${ic(icn,'lg')}</div><div><b>${big}</b><small>${small||''}</small></div>${btn?`<button class="tbtn" data-act="save">${ic('check','sm')}${btn}</button>`:''}`;
  t.dataset.kind=kind;
  t.className=kind+' on pulse';
  t.style.setProperty('--tdur',(kind==='info'?2600:6500)+'ms'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),kind==='info'?2600:6500);
}
/* ---------- toast dismissal ---------- */
function closeToast(remember){
  const t=$('#toast'); if(!t.classList.contains('on')) return;
  if(remember&&/^(charge|credit)$/.test(t.dataset.kind||'')) window.__tdis=netDelta();
  else if(remember&&t.dataset.kind==='info'&&dirty()) window.__tdis=netDelta();
  t.classList.add('out'); t.classList.remove('on'); clearTimeout(toastT);
  setTimeout(()=>{ t.classList.remove('out'); if(!t.classList.contains('on')) t.innerHTML=''; },270);
}
$('#toast').addEventListener('click',e=>{ closeToast(true); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#scrim').classList.contains('on')&&$('#toast').classList.contains('on')){ closeToast(true); } },true);
/* [S5] dialogs — sketch L2466-2467 */
function openDlg(html){ $('#dlg').className='dlg'; $('#dlg').innerHTML=html; $('#scrim').classList.add('on'); }
function closeDlg(){ $('#scrim').classList.remove('on'); }
/* [S6] tooltip + rich cards — sketch L2565-2568, L2614-2650 */
const tt=$('#tt');
/* ---------- rich detail cards (hover / focus / tap) ---------- */
const rt=document.createElement('div');rt.id='rt';rt.setAttribute('role','tooltip');document.body.appendChild(rt);
let rtEl=null, rtAnc=null;
function placeRich(el){
  rt.style.left='0';rt.style.top='0';
  if(el.closest&&el.closest('.tlx')){
    const r=el.getBoundingClientRect(),w=rt.offsetWidth,h=rt.offsetHeight,vw=document.documentElement.clientWidth,vh=innerHeight,gap=8;
    const cx=r.left+r.width/2; let x=Math.max(8,Math.min(vw-w-8,cx-w/2)), y=r.top-gap-h, side='t';
    if(y<8){ y=r.bottom+gap; side='b'; }
    y=Math.max(8,Math.min(vh-h-8,y));
    rt.style.left=x+'px';rt.style.top=y+'px';rt.dataset.side=side;
    const a=rt.querySelector('.ra'); if(a){ a.style.top=''; a.style.left=Math.max(14,Math.min(w-14,cx-x))+'px'; }
    return;
  }
  const r=el.getBoundingClientRect(),w=rt.offsetWidth,h=rt.offsetHeight,vw=document.documentElement.clientWidth,vh=innerHeight,g=12;
  let x,y,side;
  const wide=vw>=700;
  if(wide&&r.right+g+w<=vw-8){x=r.right+g;y=r.top+r.height/2-h/2;side='r'}
  else if(wide&&r.left-g-w>=8){x=r.left-g-w;y=r.top+r.height/2-h/2;side='l'}
  else{x=r.left+r.width/2-w/2;if(r.top-g-h>=8){y=r.top-g-h;side='t'}else{y=r.bottom+g;side='b'}}
  x=Math.max(8,Math.min(vw-w-8,x));y=Math.max(8,Math.min(vh-h-8,y));
  rt.style.left=x+'px';rt.style.top=y+'px';rt.dataset.side=side;
  const a=rt.querySelector('.ra');
  if(a){ if(side==='r'||side==='l'){a.style.top=Math.max(14,Math.min(h-14,r.top+r.height/2-y))+'px';a.style.left='';} else {a.style.left=Math.max(14,Math.min(w-14,r.left+r.width/2-x))+'px';a.style.top='';} }
}
function showRich(el){ const html=richHTML(el.dataset.rich); if(!html){ hideRich(); return; } rtEl=el; rtAnc=(el.classList&&el.classList.contains('tx'))?(el.querySelector('.dot')||el):el; rt.innerHTML=html+'<i class="ra"></i>'; placeRich(rtAnc); rt.classList.add('on'); }
function hideRich(){ rt.classList.remove('on'); rtEl=null; rtAnc=null; }
document.addEventListener('mouseover',e=>{const t=e.target.closest('[data-rich]'); if(t&&t!==rtEl) showRich(t);});
document.addEventListener('mouseout',e=>{const t=e.target.closest('[data-rich]'); if(t&&!(e.relatedTarget&&t.contains(e.relatedTarget))) hideRich();});
document.addEventListener('focusin',e=>{const t=e.target.closest('[data-rich]'); if(t) showRich(t);});
document.addEventListener('focusout',e=>{if(e.target.closest('[data-rich]')) hideRich();});
document.addEventListener('click',e=>{const t=e.target.closest('[data-rich]'); const touch=matchMedia('(hover:none)').matches; const inBtn=e.target.closest('button'); if(t&&touch&&(!inBtn||inBtn===t)){ if(rtEl!==t){ showRich(t); e.preventDefault(); e.stopPropagation(); } else if(!inBtn){ hideRich(); } } else if(!t) hideRich();},true);
const repRich=()=>{ if(rtAnc&&rt.classList.contains('on')){ if(!rtAnc.isConnected){hideRich();return} placeRich(rtAnc); } };window.addEventListener('scroll',repRich,true);window.addEventListener('resize',repRich);

function showTip(el){ tt.textContent=el.dataset.tip; tt.classList.add('on'); const r=el.getBoundingClientRect(), w=tt.offsetWidth, h=tt.offsetHeight;
  let x=r.left+r.width/2-w/2; x=Math.max(10,Math.min(innerWidth-w-10,x)); let y=r.top-h-10; if(y<8) y=r.bottom+10; tt.style.left=x+'px'; tt.style.top=y+'px'; }
document.addEventListener('mouseover',e=>{const t=e.target.closest('[data-tip]'); if(t) showTip(t);});
document.addEventListener('mouseout',e=>{if(e.target.closest('[data-tip]')) tt.classList.remove('on');});
document.addEventListener('focusin',e=>{const t=e.target.closest('[data-tip]'); if(t) showTip(t);});
document.addEventListener('focusout',e=>{if(e.target.closest('[data-tip]')) tt.classList.remove('on');});
/* [S7] every button: tooltip + icon hook — sketch L2764-2779 */
/* ---------- every button: custom tooltip + icon micro-animation hook ---------- */
const ICON_TIP={pencil:'עריכה',trash:'מחיקה',chev:'פרטים',print:'הדפסה',lock:'נעילה',back:'חזרה',x:'סגירה',swap:'החלפה',ext:'פתיחה',bk:'ביטול השינוי',plus:'הוספה',check:'אישור',undo:'ביטול',mail:'מייל',card:'תשלום',cart:'שינויים'};
function tipify(){
  document.querySelectorAll('button,[role=button]').forEach(b=>{
    const u=b.querySelector('use'), ico=u?(u.getAttribute('href')||'').replace('#i-',''):'';
    if(ico&&b.dataset.ico!==ico) b.dataset.ico=ico;
    if(b.dataset.tip||b.classList.contains('tip')) return;
    const txt=b.textContent.replace(/\s+/g,'').trim();
    if(txt) { if(b.hasAttribute('title')) b.removeAttribute('title'); return; }
    const label=b.getAttribute('aria-label')||b.getAttribute('title')||ICON_TIP[ico]||'';
    if(label){ b.dataset.tip=label; b.removeAttribute('title'); if(!b.hasAttribute('aria-label')) b.setAttribute('aria-label',label); }
  });
}
let _tf=0; new MutationObserver(()=>{ if(_tf) return; _tf=requestAnimationFrame(()=>{_tf=0;tipify();}); }).observe(document.body,{childList:true,subtree:true});
document.addEventListener('touchstart',e=>{const b=e.target.closest('button[data-tip]'); if(b){ showTip(b); setTimeout(()=>tt.classList.remove('on'),1400); }},{passive:true});
tipify();
/* [S8] frame shine — sketch L2943-2946 */
/* ---------- timeline frame shine: fallbacks + pausing ---------- */
if(!(window.CSS&&CSS.registerProperty)) document.documentElement.classList.add('no-prop');
(function(){ const st=document.getElementById('stepper'); if(!st) return; if('IntersectionObserver' in window){ new IntersectionObserver(es=>st.classList.toggle('offscr',!es[0].isIntersecting)).observe(st); } document.addEventListener('visibilitychange',()=>st.classList.toggle('hid',document.hidden)); })();
/* (sketch renderAll() call removed — pages render themselves) */
/* [S9] SITE TOP BAR — sketch L2948-3040 */
/* ===== SITE TOP BAR ===== */
(function(){
 const NAV=[
  {k:'home',label:'בית וחיפוש',icon:'home'},
  {k:'orders',label:'הזמנות',icon:'file',items:[
    {l:'הזמנה חדשה',i:'plus'},{l:'רשימת הזמנות',i:'file'},'-',
    {l:'השכרות',i:'truck'},{l:'החזרות',i:'check'},{l:'משלוחים',i:'box'},'-',
    {l:'זיכויים וחובות',i:'wallet'},{l:'תיקונים',i:'scissors'}]},
  {k:'inv',label:'מלאי',icon:'bag',items:[{l:'קטלוג דגמים',i:'bag'},{l:'מחירון',i:'tag'}]},
  {k:'people',label:'אנשים',icon:'users',items:[
    {l:'לקוחות',i:'users'},{l:'עובדים ונוכחות',i:'userck'},{l:'לוח חודשי',i:'cal'},{l:'עמדת לקוח',i:'eye'}]},
  {k:'admin',label:'ניהול',icon:'shield',items:[
    {l:'לוח ניהול',i:'shield'},'-',{l:'הגדרות מערכת',i:'gear'},{l:'ניהול אתר',i:'sliders'},{l:'הרשאות',i:'lock'},{l:'ניהול מחירון',i:'tag'}]},
  {k:'more',label:'עוד',icon:'menu',items:[
    {l:'הודעות',i:'msg'},{l:'שעון נוכחות',i:'clock'},{l:'השעות שלי',i:'clock'},{l:'עיצוב ותצוגה',i:'sun'}]}
 ];
 NAV.forEach(g=>(g.items||[]).forEach(x=>{ if(x!=='-'&&x.l===SK_NAV_CUR) x.cur=1; })); /* glue: page picks current item */
 const bar=document.getElementById('snav'); if(!bar) return;
 const nav=$('#snNav'), drawer=$('#snDrawer'), scrim=$('#snScrim'), burger=$('#snBurger');
 const li=n=>`<span class="sn-li">${ic(n)}</span>`;
 const linkH=(it,menu)=>it==='-'?'<div class="sn-sep"></div>':`<a class="sn-link" ${menu?'role="menuitem" ':''}href="#" data-sn-link${it.cur?' aria-current="page"':''}>${li(it.i)}${it.l}</a>`;
 nav.innerHTML=NAV.map(g=>{
  if(!g.items) return `<div class="sn-item"><a class="sn-tab" href="#" data-sn-link>${ic(g.icon)}${g.label}</a></div>`;
  const act=g.items.some(x=>x.cur), n=g.items.filter(x=>x!=='-').length;
  return `<div class="sn-item" data-sn="${g.k}"><button type="button" class="sn-tab${act?' active':''}" aria-haspopup="true" aria-expanded="false">${ic(g.icon)}${g.label}<svg class="ic sn-chev"><use href="#i-chev"/></svg></button>
  <div class="sn-panel" role="menu" aria-label="${g.label}">${g.items.map(x=>linkH(x,1)).join('')}</div></div>`}).join('');
 drawer.innerHTML=`<div class="sn-sbox sn-dsearch">${ic('search','sm')}<input type="search" id="snQm" placeholder="חיפוש עמוד…" autocomplete="off" aria-label="חיפוש עמוד"></div><div id="snResM"></div><div id="snAccs">`+NAV.map(g=>{
  if(!g.items) return `<a class="sn-acc" href="#" data-sn-link>${li(g.icon)}${g.label}</a>`;
  const act=g.items.some(x=>x.cur);
  return `<button type="button" class="sn-acc${act?' active':''}" aria-expanded="false">${li(g.icon)}${g.label}<svg class="ic sn-chev"><use href="#i-chev"/></svg></button><div class="sn-ab"><div>${g.items.map(x=>linkH(x,0)).join('')}</div></div>`}).join('')+
  `</div><div class="sn-dfoot"><span class="sn-av">ש</span><div><b>שרה כהן</b><small>במשמרת <bdi class="snShiftM">3:42</bdi></small></div></div>`;
 /* ---- open/close logic ---- */
 const items=()=>[...bar.querySelectorAll('.sn-nav .sn-item[data-sn],.sn-act .sn-item')];
 const tabsIt=()=>[...bar.querySelectorAll('.sn-nav .sn-item[data-sn]')];
 const trig=it=>it.querySelector(':scope>button');
 let timer=0,openIt=null;
 function close(it,ret){ if(!it) return; it.classList.remove('open'); delete it.dataset.pin; const t=trig(it); t&&t.setAttribute('aria-expanded','false'); if(openIt===it) openIt=null; if(ret&&t) t.focus(); }
 function closeAll(){ clearTimeout(timer); items().forEach(i=>close(i)); }
 function open(it,pin){
  clearTimeout(timer); if(openIt&&openIt!==it) close(openIt);
  it.classList.add('open'); if(pin) it.dataset.pin='1'; trig(it).setAttribute('aria-expanded','true'); openIt=it;
  const p=it.querySelector('.sn-panel'); p.style.translate='';
  const r=p.getBoundingClientRect(); let dx=0; if(r.left<8) dx=8-r.left; else if(r.right>innerWidth-8) dx=innerWidth-8-r.right; if(dx) p.style.translate=dx+'px 0';
  if(it.dataset.sn==='search') setTimeout(()=>$('#snQ').focus(),30);
 }
 items().forEach(it=>{
  const t=trig(it), hoverable=it.dataset.sn!=='search';
  it.addEventListener('pointerenter',e=>{ if(e.pointerType!=='mouse') return; clearTimeout(timer); if(hoverable&&!it.classList.contains('open')) open(it,false); });
  it.addEventListener('pointerleave',e=>{ if(e.pointerType!=='mouse'||it.dataset.pin||!hoverable) return; timer=setTimeout(()=>close(it),140); });
  t.addEventListener('click',()=>{ if(!it.classList.contains('open')) open(it,true); else if(!it.dataset.pin) it.dataset.pin='1'; else close(it); });
  it.addEventListener('keydown',e=>{
   const onT=e.target===t, ls=[...it.querySelectorAll('.sn-link')], i=ls.indexOf(document.activeElement);
   if(e.key==='ArrowDown'){ e.preventDefault(); if(onT){ open(it,true); ls[0]?.focus(); } else ls[(i+1)%ls.length]?.focus(); }
   else if(e.key==='ArrowUp'){ e.preventDefault(); if(onT){ open(it,true); ls[ls.length-1]?.focus(); } else ls[(i-1+ls.length)%ls.length]?.focus(); }
   else if(!onT&&e.key==='Home'){ e.preventDefault(); ls[0]?.focus(); } else if(!onT&&e.key==='End'){ e.preventDefault(); ls[ls.length-1]?.focus(); }
   else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ const tb=tabsIt(), idx=tb.indexOf(it); if(idx<0||e.target.tagName==='INPUT') return; e.preventDefault(); const nx=tb[(idx+(e.key==='ArrowLeft'?1:-1)+tb.length)%tb.length]; if(onT&&!openIt) trig(nx).focus(); else { open(nx,true); (onT?trig(nx):nx.querySelector('.sn-link'))?.focus(); } }
  });
 });
 document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(openIt) close(openIt,true); if(drawer.classList.contains('open')) setDrawer(false,true); } });
 document.addEventListener('pointerdown',e=>{ if(!e.target.closest('.snav')){ closeAll(); if(drawer.classList.contains('open')) setDrawer(false); } });
 bar.addEventListener('focusout',e=>{ if(openIt&&e.relatedTarget&&!e.relatedTarget.closest('.sn-item')) close(openIt); });
 /* choosing a page (concept only: marks it current, closes menus) */
 bar.addEventListener('click',e=>{
  const a=e.target.closest('[data-sn-link]'); if(!a) return; e.preventDefault();
  if(a.classList.contains('sn-link')&&!a.closest('.sn-act')&&!a.closest('.sn-search')){
   bar.querySelectorAll('[aria-current]').forEach(x=>x.removeAttribute('aria-current')); bar.querySelectorAll('.sn-tab.active,.sn-acc.active').forEach(x=>x.classList.remove('active'));
   const lab=a.textContent.trim(); bar.querySelectorAll('.sn-nav .sn-link,.sn-drawer .sn-link').forEach(x=>{ if(x.textContent.trim()===lab) x.setAttribute('aria-current','page'); });
   const g=a.closest('.sn-item,.sn-ab'); const tb=g&&(g.querySelector('.sn-tab')||g.previousElementSibling); tb&&tb.classList.add('active');
  } else if(a.classList.contains('sn-tab')||a.classList.contains('sn-acc')){ bar.querySelectorAll('.sn-tab.active,.sn-acc.active,[aria-current]').forEach(x=>{x.classList.remove('active');x.removeAttribute('aria-current')}); a.classList.add('active'); }
  closeAll(); if(drawer.classList.contains('open')) setDrawer(false);
 });
 /* ---- search ---- */
 const pages=[]; NAV.forEach(g=>{ if(!g.items) pages.push({l:g.label,i:g.icon,g:''}); else g.items.forEach(x=>{ if(x!=='-') pages.push({l:x.l,i:x.i,g:g.label}); }); });
 const recent=[{l:'הזמנה #53375 · שרה לוי',i:'file'},{l:'לקוח: רחל כהן',i:'user'},{l:'הזמנה #53311 · מרים אברהם',i:'file'}];
 function renderRes(q,box,menu){
  q=q.trim(); const src=q?pages.filter(p=>p.l.includes(q)||p.g.includes(q)):recent;
  box.innerHTML=(q?'':'<div class="sn-st">נפתחו לאחרונה</div>')+(src.length?src.map(p=>`<a class="sn-link" ${menu?'role="menuitem" ':''}href="#" data-sn-link>${li(p.i)}${p.l}</a>`).join(''):'<div class="sn-empty">לא נמצאו עמודים תואמים</div>');
 }
 $('#snQ').addEventListener('input',e=>renderRes(e.target.value,$('#snRes'),true)); renderRes('',$('#snRes'),true);
 $('#snQm').addEventListener('input',e=>{ renderRes(e.target.value,$('#snResM'),false); $('#snAccs').style.display=e.target.value.trim()?'none':''; });
 $('#snQ').addEventListener('keydown',e=>{ if(e.key==='ArrowDown'){ e.preventDefault(); e.stopPropagation(); $('#snRes .sn-link')?.focus(); } });
 /* ---- notifications ---- */
 $('#snMark').addEventListener('click',()=>{ bar.querySelectorAll('.sn-nt.new').forEach(n=>n.classList.remove('new')); $('#snBadge').hidden=true; $('#snBn').textContent='הכול נקרא'; });
 /* ---- shift clock ---- */
 const t0=Date.now()-(3*60+42)*60000;
 function tickShift(){ const m=Math.floor((Date.now()-t0)/60000), s=Math.floor(m/60)+':'+String(m%60).padStart(2,'0'); $('#snShift').textContent=s; document.querySelectorAll('.snShiftM').forEach(x=>x.textContent=s); }
 tickShift(); setInterval(tickShift,30000);
 /* ---- mobile drawer ---- */
 function setDrawer(on,ret){ drawer.classList.toggle('open',on); scrim.classList.toggle('on',on); burger.setAttribute('aria-expanded',on); burger.setAttribute('aria-label',on?'סגירת התפריט':'פתיחת התפריט'); document.body.style.overflow=on?'hidden':''; if(!on&&ret) burger.focus(); }
 burger.addEventListener('click',()=>{ closeAll(); setDrawer(!drawer.classList.contains('open')); });
 scrim.addEventListener('click',()=>setDrawer(false));
 drawer.addEventListener('click',e=>{ const b=e.target.closest('button.sn-acc'); if(!b) return; const on=b.getAttribute('aria-expanded')==='true'; drawer.querySelectorAll('.sn-acc[aria-expanded="true"]').forEach(x=>x.setAttribute('aria-expanded','false')); b.setAttribute('aria-expanded',String(!on)); });
 matchMedia('(min-width:768px)').addEventListener('change',e=>{ if(e.matches) setDrawer(false); });
})();
