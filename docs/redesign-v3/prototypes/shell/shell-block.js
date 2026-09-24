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

/* [S10] ICON-ANIM — sketch L3226-3261 */
/* ICON-ANIM START */
(()=>{
 const RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const COVERED=new Set('check card print plus x trash undo bk back chev truck pencil scissors lock swap ext mail bag cart'.split(' ')); // hover already handled by existing [data-ico] rules when parent button carries data-ico
 const DRAW=new Set('check x plus minus chev arrl arrr arrlr'.split(' '));
 const SKIP_IN='.cl.enter,.success,#toast .tb,.dhero.fresh,.stat.fresh,.tx.fresh,.dbadge,.big-ck'; // existing draw/pop entrances
 const SKIP_H='.gl,.cl-i,.cart-t';
 const idOf=s=>{const u=s.querySelector('use');return u?(u.getAttribute('href')||u.getAttribute('xlink:href')||'').replace('#i-',''):''};
 function prep(s){
  if(s.__ia!==undefined)return s.__ia; const id=idOf(s); s.__ia=id; if(!id)return id;
  s.classList.add('ia-'+id);
  const p=s.parentElement;
  if(!s.closest(SKIP_H)&&!(id==='cart'&&p&&p.dataset&&p.dataset.ico==='cart')){ s.classList.add('ia-h'); if(p&&p.dataset&&COVERED.has(p.dataset.ico)) s.classList.add('ia-ov'); }
  return id;
 }
 let first=true,last=0,pending=new Set(),raf=0;
 function flush(){
  raf=0; const list=[...pending]; pending.clear();
  const now=performance.now();
  const cap=first?1e9:(now-last<250?0:14); first=false;
  let n=0;
  for(const s of list){
   if(!s.isConnected)continue; const id=prep(s); if(!id)continue;
   if(RM||n>=cap||s.closest(SKIP_IN)||s.classList.contains('ia-in'))continue;
   s.classList.add('ia-in'); if(DRAW.has(id))s.classList.add('ia-dr'); n++; setTimeout(()=>{ if(s.getClientRects().length)s.classList.remove('ia-in','ia-dr') },800);
  }
  if(n)last=now;
 }
 function scan(root){ if(root.nodeType!==1)return; if(root.matches&&root.matches('svg.ic'))pending.add(root); root.querySelectorAll&&root.querySelectorAll('svg.ic').forEach(s=>pending.add(s)); }
 document.addEventListener('animationend',e=>{const s=e.target; if(s.classList&&s.classList.contains('ia-in')&&(e.animationName==='ia-in'||e.animationName==='ia-draw'))s.classList.remove('ia-in','ia-dr')});
 const schedule=()=>{ if(!raf)raf=setTimeout(flush,30) };
 new MutationObserver(ms=>{ let any=false; for(const m of ms)for(const n of m.addedNodes){scan(n);any=true} if(any)schedule() }).observe(document.body,{childList:true,subtree:true});
 window.__iaPrep=prep; window.__iaDRAW=DRAW;
 scan(document.body); schedule();
})();
/* ICON-ANIM END */
/* [S11] DLG-MODERN JS — sketch L3513-3562 */
/* DLG-MODERN JS START */
(()=>{
  const KEY='dlgTheme'; let dark=true;
  try{ if(localStorage.getItem(KEY)==='light') dark=false; }catch(e){}
  function apply(){ document.body.classList.toggle('dlg-dark',dark); const b=document.getElementById('dlgThemeBtn'); if(b){ b.setAttribute('aria-pressed',String(dark)); b.textContent='חלונות: '+(dark?'כהה':'בהיר'); } }
  apply();
  document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('#dlgThemeBtn'); if(!b) return; dark=!dark; try{ localStorage.setItem(KEY,dark?'dark':'light'); }catch(_){} apply(); });
  /* demo menu: opens every floating window directly */
  const wait=ms=>new Promise(r=>setTimeout(r,ms)), $q=s=>document.querySelector(s);
  const fire=a=>{ const b=document.createElement('button'); b.dataset.act=a; b.hidden=true; document.body.append(b); b.click(); b.remove(); };
  const reset=async()=>{ closeDlg(); $q('#scrim2').classList.remove('on'); try{ if(typeof MAIL!=='undefined'&&MAIL) mailClose(); }catch(e){} fire('reset'); await wait(120); };
  const DEMOS=[
   ['אישור מנהל',async()=>{ await reset(); askManagerApproval('הדגמת אישור מנהל').then(v=>toast('info',v?'אושר על ידי '+(v.name||'מנהל'):'האישור בוטל','')); }],
   ['מייל מהיר',async()=>{ await reset(); const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('מייל מהיר')&&!x.closest('#demoMenu')); b&&b.click(); }],
   ['סיכום יציאה',async()=>{ await reset(); fire('sim-add'); await wait(250); fire('exit'); }],
   ['ביטול שינויים',async()=>{ await reset(); fire('sim-add'); await wait(250); fire('discard'); }],
   ['תשלום',async()=>{ await reset(); fire('sim-add'); await wait(250); fire('exit'); await wait(250); fire('do-save'); }],
   ['זיכוי',async()=>{ await reset(); fire('sim-rm'); await wait(250); fire('exit'); await wait(250); fire('do-save'); }],
   ['נשמר',async()=>{ await reset(); fire('sim-add'); await wait(250); fire('exit'); await wait(250); fire('do-save'); await wait(250); fire('confirm-pay'); }],
   ['מחיקת הזמנה',async()=>{ await reset(); fire('delete'); }]
  ];
  const mm=$q('#demoMenu'), mbtn=$q('#demoMenuBtn');
  if(mm&&mbtn){
    DEMOS.forEach(([t,f])=>{ const b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitem'); b.textContent=t; b.addEventListener('click',()=>{ mm.hidden=true; mbtn.setAttribute('aria-expanded','false'); f(); }); mm.append(b); });
    const shut=()=>{ mm.hidden=true; mbtn.setAttribute('aria-expanded','false'); };
    mbtn.addEventListener('click',e=>{ e.stopPropagation(); if(!mm.hidden){ shut(); return; } const r=mbtn.getBoundingClientRect(); mm.hidden=false; const w=mm.offsetWidth; mm.style.top=(r.bottom+6)+'px'; mm.style.left=Math.max(8,Math.min(innerWidth-w-8,r.right-w))+'px'; mbtn.setAttribute('aria-expanded','true'); mm.querySelector('button').focus(); });
    document.addEventListener('click',e=>{ if(!mm.contains(e.target)) shut(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!mm.hidden){ shut(); mbtn.focus(); } });
  }
  document.addEventListener('mousedown',e=>{ const w=e.target.closest&&e.target.closest('#dlg .amtin'); if(w&&e.target.tagName!=='INPUT'){ e.preventDefault(); const i=w.querySelector('input'); i&&i.focus(); } });
  const ICON={'confirm-pay':'card','confirm-pay-only':'card','confirm-credit':'undo','discard-close':'trash'};
  function decorate(d){
    if(!d||d.classList.contains('mailwin')||d.classList.contains('apprwin')) return;
    const h=d.querySelector(':scope > h2'); if(!h) return;
    if(!d.hasAttribute('aria-labelledby')){ if(!h.id) h.id=d.id+'-t'; d.setAttribute('aria-labelledby',h.id); }
    if(d.querySelector('.dbadge,.big-ck,.ashield,.mico')) return;
    const p=d.querySelector('.btn.primary,.btn.green'); const u=p&&p.querySelector('use');
    const href=(p&&ICON[p.dataset.act])?'#i-'+ICON[p.dataset.act]:(u?u.getAttribute('href'):'#i-info');
    const b=document.createElement('div'); b.className='dbadge'; b.setAttribute('aria-hidden','true');
    b.innerHTML='<svg class="ic"><use href="'+href+'"/></svg>'; const act=p&&p.dataset.act; b.dataset.k=act==='confirm-credit'?'coin':act==='do-save'?'write':/trash/.test(href)?'lid':/card/.test(href)?'tilt':/check/.test(href)?'breathe':'float'; d.insertBefore(b,d.firstChild);
  }
  const T0={}; ['scrim','scrim2'].forEach(id=>{ const sc=document.getElementById(id); if(!sc) return; T0[id]=performance.now(); let was=sc.classList.contains('on'); new MutationObserver(()=>{ const on=sc.classList.contains('on'); if(on&&!was) T0[id]=performance.now(); was=on; }).observe(sc,{attributes:true,attributeFilter:['class']}); });
  /* keep hero idle loops on one continuous clock while the window stays open (re-renders never reset the phase) */
  function sync(d){ const t0=T0[d.parentElement.id]||0, now=performance.now();
    d.querySelectorAll('.dbadge,.big-ck,.ashield,.mico').forEach(h=>{ h.style.setProperty('--rph',(-((now-t0)%2400))+'ms'); });
    d.querySelectorAll('.ashield svg.ic').forEach(s=>{ s.style.animationDelay=(-((now-t0)%3400))+'ms'; });
    d.querySelectorAll('.mico svg.ic,#m-send svg.ic').forEach(s=>{ s.style.animationDelay=(-((now-t0)%2800))+'ms'; }); }
  ['dlg','dlg2'].forEach(id=>{ const d=document.getElementById(id); if(!d) return; new MutationObserver(()=>{ decorate(d); sync(d); }).observe(d,{childList:true}); });
})();
/* DLG-MODERN JS END */
/* [S12] ICON-ANIM-2 — sketch L3599-3631 */
/* ICON-ANIM-2 START */
(()=>{
 if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 const $=s=>document.querySelector(s);
 const SKIP='#toast .tb svg,.dbadge svg,.big-ck svg,.cl.enter svg';
 const href=s=>{const u=s&&s.querySelector('use');return u?(u.getAttribute('href')||''):''};
 function burst(el){ if(!el)return; setTimeout(()=>{const r=el.getBoundingClientRect(); if(!r.width)return; const b=document.createElement('span'); b.className='ia-burst'; b.style.cssText='left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px'; document.body.append(b); setTimeout(()=>b.remove(),800)},260) }
 function replay(root){
  if(!root||!root.querySelectorAll)return; const now=performance.now(); if(root.__ir&&now-root.__ir<250)return; root.__ir=now;
  const P=window.__iaPrep; if(!P)return;
  const list=[...root.querySelectorAll('svg.ic')].filter(s=>!s.matches(SKIP)).slice(0,30);
  list.forEach(s=>s.classList.remove('ia-in','ia-dr')); void root.offsetWidth;
  list.forEach((s,i)=>{const id=P(s); if(!id)return; s.style.setProperty('--ia-dl',(i*40)+'ms'); s.classList.add('ia-in'); if(window.__iaDRAW.has(id)||s.closest('.ashield,.mico'))s.classList.add('ia-dr'); setTimeout(()=>{ if(s.getClientRects().length)s.classList.remove('ia-in','ia-dr') },i*40+900)});
  root.querySelectorAll('.ashield,.mico,.dbadge,.big-ck').forEach(b=>{ if(!b.classList.contains('dbadge')&&!b.classList.contains('big-ck')){ b.classList.remove('ia-bg'); void b.offsetWidth; b.classList.add('ia-bg'); setTimeout(()=>b.classList.remove('ia-bg'),900) } burst(b) });
 }
 function celebrate(svg,ring){ if(!svg)return; svg.classList.remove('ia-in','ia-dr'); void svg.getBoundingClientRect(); svg.style.setProperty('--ia-dl','0s'); svg.classList.add('ia-in','ia-dr'); setTimeout(()=>svg.classList.remove('ia-in','ia-dr'),900); burst(ring||svg.parentElement) }
 function err(){ const s=$('#dlg2 .ashield svg.ic'); if(!s)return; s.classList.remove('ia-err'); void s.getBoundingClientRect(); s.classList.add('ia-err'); setTimeout(()=>s.classList.remove('ia-err'),700) }
 const isOpen=t=>t.classList.contains('on')||t.classList.contains('open')||t.getAttribute('aria-expanded')==='true';
 new MutationObserver(ms=>{ for(const m of ms){ const t=m.target; if(t.nodeType!==1)continue;
   if(m.attributeName==='hidden'){ if(t.id==='appr-mgr'&&!t.hidden){ setTimeout(()=>{celebrate(t.querySelector('svg.ic')||$('#dlg2 .ashield svg.ic'),$('#dlg2 .ashield'))},60); } continue }
   if(m.attributeName==='class'&&t.classList.contains('acodes')&&t.classList.contains('shake'))err();
   if(m.attributeName==='class'&&t.classList.contains('ac')){ const g=t.classList.contains('good'); if(g&&!t.__good&&t.dataset.i==='3')burst($('#dlg2 .ashield')); t.__good=g; }
   const o=isOpen(t); if(o&&!t.__io){ t.__io=1; const c=(t.hasAttribute('aria-expanded')&&t.tagName!=='DIV')?t.parentElement:t; setTimeout(()=>replay(c),40); } else if(!o)t.__io=0;
 }}).observe(document.body,{attributes:true,attributeFilter:['class','aria-expanded','hidden'],subtree:true});
 ['dlg','dlg2'].forEach(id=>{const d=document.getElementById(id); if(!d)return; new MutationObserver(()=>{
   d.querySelectorAll('.cb.open').forEach(e=>{ if(!e.__r){ e.__r=1; setTimeout(()=>replay(e),40) } });
   const sb=d.querySelector('#m-send svg.ic'); const done=/#i-check/.test(href(sb));
   if(done&&!d.__sent){ d.__sent=1; celebrate(sb,sb); } else if(!done)d.__sent=0;
   const msg=d.querySelector('#appr-msg svg.ic'); if(msg&&!msg.__e){ msg.__e=1; if(/lock/.test(href(msg)))err(); }
 }).observe(d,{childList:true,subtree:true}); });
 document.querySelectorAll('.scrim.on,.sn-item.open,.hf-sel.on').forEach(replay);
})();
/* ICON-ANIM-2 END */
/* [S13] nb- notice bar — sketch L3634-3702 */
/* nb-: notification banners (demo) */
(()=>{
const area=document.getElementById('nbArea'), btn=document.getElementById('nbDemoBtn'), menu=document.getElementById('nbMenu');
if(!area) return; /* glue: demo button/menu optional */
const KINDS={info:['info','status'],warning:['alert','status'],success:['check','status'],alert:['bell','alert']};
const DEMO={
 info:{title:'עודכן מלאי',detail:'דגם 4512 חזר מהניקיון וזמין להשכרה',rows:[['dress','דגם 4512, מידה 38 חזר מהניקיון'],['clock','עודכן היום בשעה 09:12']]},
 warning:{title:'חסר ת״ז ללקוח',detail:'נדרש להשלמת ההזמנה לפני איסוף השמלות',rows:[['user','חסרה תעודת זהות ללקוחה מרים אברמוביץ'],['cal',()=>'האירוע: '+dayTitle('2026-10-08')],['phone','אפשר להשלים בטלפון: 050-555-0142']],go:1},
 success:{title:'ההזמנה נשמרה',detail:'כל השינויים נקלטו במערכת',rows:[['check','3 פריטים עודכנו'],['clock','נשמר היום בשעה 10:35']]},
 alert:{title:'תשלום ממתין',detail:()=>'יתרה לתשלום ₪150 · האירוע בעוד '+plural(14,'יום','ימים'),rows:[['card','יתרה לתשלום: ₪150'],['cal',()=>'האירוע: '+dayTitle('2026-10-08')]],go:1}
};
const ORDER=['info','warning','success','alert']; let seq=0, all=true, nextK=0;
const v=x=>typeof x==='function'?x():x;
const live=()=>[...area.querySelectorAll('.nb-w:not(.out)')];
function sync(){
  const L=live(), n=L.length; if(n<=1) all=true;
  area.classList.toggle('multi',n>1); area.classList.toggle('col',n>1&&!all);
  area.querySelectorAll('.nb-chip').forEach(c=>{ c.firstElementChild.textContent='+'+(n-1); c.setAttribute('aria-label',plural(n-1,'התראה נוספת','התראות נוספות')); c.setAttribute('aria-expanded',all); });
  const add=menu&&menu.querySelector('[data-nb=add]'); if(add){ add.disabled=n>=3; add.querySelector('span').textContent=n>=3?'הוסף התראה נוספת (מקסימום 3)':'הוסף התראה נוספת'; }
}
function add(kind){
  if(live().length>=3) return false; const d=DEMO[kind], k=KINDS[kind], id='nb'+(++seq);
  const rows=d.rows.map(([i,t])=>`<div class="nb-r"><i>${ic(i)}</i><span>${v(t)}</span></div>`).join('');
  const w=document.createElement('div'); w.className='nb-w in';
  w.innerHTML=`<section class="nb nb-${kind}" role="${k[1]}" aria-live="${k[1]==='alert'?'assertive':'polite'}" aria-labelledby="${id}t">
    <div class="nb-main"><div class="nb-head"><span class="nb-ic" aria-hidden="true">${ic(k[0])}</span>
      <div class="nb-msg"><b id="${id}t">${d.title}</b><span>${v(d.detail)}</span></div><button type="button" class="nb-x" aria-label="סגור" data-tip="סגור">${ic('x')}</button></div>
      <div class="nb-acts"><button type="button" class="nb-more" aria-expanded="false" aria-controls="${id}b"><span>פרטים נוספים</span>${ic('chev')}</button><button type="button" class="nb-chip" aria-expanded="true"><span></span>${ic('chev')}</button></div>
    </div>
    <div class="nb-bw"><div class="nb-body" id="${id}b"><div class="nb-bi">${rows}${d.go?`<button type="button" class="nb-go">עבור להזמנה</button>`:''}</div></div></div>
</section>`;
  area.appendChild(w); all=true; sync();
  w.addEventListener('animationend',e=>{ if(e.target===w) w.classList.remove('in'); }); setTimeout(()=>w.classList.remove('in'),450);
  return true;
}
function dismiss(w){
  if(!w||w.classList.contains('out')) return; const had=w.contains(document.activeElement);
  w.classList.add('out'); sync();
  if(had){ const nx=live()[0]; (nx?nx.querySelector('.nb-x'):btn).focus(); }
  setTimeout(()=>{ w.remove(); sync(); },300);
}
window.nbAdd=(kind,data)=>{ if(data) DEMO[kind]=data; return add(kind); }; /* glue: page API */
window.nbDismissAll=()=>live().forEach(dismiss);
if(!btn||!menu){ /* glue: without the demo menu still wire close / more / chip */
 document.addEventListener('click',e=>{ const t=e.target.closest?e.target:null; if(!t) return; const g=s=>t.closest(s);
  const x=g('.nb-x'); if(x){ dismiss(x.closest('.nb-w')); return; }
  const m=g('.nb-more'); if(m){ const b=m.closest('.nb'), on=!b.classList.contains('open'); b.classList.toggle('open',on); m.setAttribute('aria-expanded',on); m.firstElementChild.textContent=on?'פחות פרטים':'פרטים נוספים'; return; }
  if(g('.nb-chip')){ all=!all; sync(); } });
 document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const b=e.target.closest&&e.target.closest('.nb-w'); if(b){ e.preventDefault(); dismiss(b); } } });
 return; }
function place(){ const r=btn.getBoundingClientRect(), vw=document.documentElement.clientWidth; const w=240; menu.style.top=(r.bottom+8)+'px'; menu.style.left=Math.max(8,Math.min(vw-w-8,r.right-w))+'px'; }
function setMenu(on,focus){ if(on){ menu.hidden=false; place(); void menu.offsetWidth; menu.classList.add('on'); if(focus) (menu.querySelector('.nb-mi:not([disabled])')||menu).focus(); } else { menu.classList.remove('on'); setTimeout(()=>{ if(!menu.classList.contains('on')) menu.hidden=true; },170); } btn.setAttribute('aria-expanded',on); }
menu.innerHTML=[['info','info','הודעת מידע'],['warning','alert','אזהרה: חסר ת״ז'],['success','check','הצלחה'],['alert','bell','התראה דחופה']].map(([k,i,t])=>`<button type="button" class="nb-mi" role="menuitem" data-nb="${k}">${ic(i)}<span>${t}</span></button>`).join('')+
 `<button type="button" class="nb-mi sep" role="menuitem" data-nb="add">${ic('plus')}<span>הוסף התראה נוספת</span></button><button type="button" class="nb-mi" role="menuitem" data-nb="clear">${ic('x')}<span>סגור הכל</span></button>`;
menu.setAttribute('role','menu'); menu.setAttribute('aria-label','הדגמות התראה'); menu.className='nb-menu'; menu.hidden=true;
document.addEventListener('click',e=>{
  const t=e.target.closest?e.target:null; if(!t) return; const g=s=>t.closest(s);
  if(g('#nbDemoBtn')){ setMenu(menu.hidden||!menu.classList.contains('on'),false); return; }
  const mi=g('.nb-mi'); if(mi&&menu.contains(mi)){ const k=mi.dataset.nb;
    if(k==='clear'){ live().forEach(dismiss); } else if(k==='add'){ add(ORDER[nextK++%4]); } else { add(k); }
    if(k!=='add'){ setMenu(false); } sync(); return; }
  if(!g('#nbMenu')&&menu.classList.contains('on')) setMenu(false);
  const x=g('.nb-x'); if(x){ dismiss(x.closest('.nb-w')); return; }
  const m=g('.nb-more'); if(m){ const b=m.closest('.nb'), on=!b.classList.contains('open'); b.classList.toggle('open',on); m.setAttribute('aria-expanded',on); m.firstElementChild.textContent=on?'פחות פרטים':'פרטים נוספים'; return; }
  const c=g('.nb-chip'); if(c){ all=!all; sync(); return; }
  if(g('.nb-go')){ const tb=document.querySelector('[data-tab=details]'); tb&&tb.click(); scrollTo({top:0,behavior:'smooth'}); }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(menu.classList.contains('on')){ setMenu(false); btn.focus(); return; }
    const b=e.target.closest&&e.target.closest('.nb-w'); if(b){ e.preventDefault(); dismiss(b); }
    return; }
  if(menu.classList.contains('on')&&(e.key==='ArrowDown'||e.key==='ArrowUp')&&menu.contains(e.target)){ e.preventDefault(); const it=[...menu.querySelectorAll('.nb-mi:not([disabled])')], i=it.indexOf(document.activeElement); it[(i+(e.key==='ArrowDown'?1:-1)+it.length)%it.length].focus(); }
  if(e.key==='ArrowDown'&&e.target===btn){ e.preventDefault(); setMenu(true,true); }
});
addEventListener('resize',()=>{ if(menu.classList.contains('on')) place(); });
})();
/* [S14] nf- bell notifications — sketch L3704-3813 */
/* nf-: notification centre (bell panel + mobile drawer), session-only */
(()=>{
const bellItem=document.querySelector('.sn-item[data-sn=bell]'); if(!bellItem) return;
const panel=bellItem.querySelector('.sn-panel'), bellBtn=bellItem.querySelector('.sn-ib'), badge=document.getElementById('snBadge');
const drawer=document.getElementById('snDrawer'), burger=document.getElementById('snBurger');
const ORDER_NO='53375', MAX=20, SHOW=5;
const NF={list:[],seq:0,all:false};
const pad=n=>String(n).padStart(2,'0');
const isoOf=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const full=ts=>{ const d=new Date(ts); return dayTitle(isoOf(d))+' · '+pad(d.getHours())+':'+pad(d.getMinutes()); };
function rel(ts){ const s=Math.max(0,(Date.now()-ts)/1000); if(s<45) return 'הרגע'; const m=Math.round(s/60); if(m<60) return 'לפני '+plural(m,'דקה','דקות'); const h=Math.round(m/60); if(h<24) return 'לפני '+plural(h,'שעה','שעות'); const d=Math.round(h/24); return d===1?'אתמול':'לפני '+plural(d,'יום','ימים'); }
const MONEY=new Set(['cash','card','bank','cheque','undo','wallet']);
const rowHTML=e=>`<div class="nf-row${e.unread?' unread':''}" role="menuitem" tabindex="-1" data-nf="${e.id}"><span class="nf-ic${MONEY.has(e.icon)?' m':''}">${ic(e.icon)}</span><div class="nf-b"><b>${e.title}</b>${e.sub?`<small>${e.sub}</small>`:''}<small class="nf-t"><time data-ts="${e.ts}" data-tip="${full(e.ts)}">${rel(e.ts)}</time> · ${e.who}</small></div><div class="nf-a"><button type="button" class="nf-go" data-nf-go aria-label="כניסה להזמנה" data-tip="כניסה להזמנה">${ic('ext')}</button><button type="button" class="nf-x" data-nf-x aria-label="הסרת ההתראה" data-tip="הסרה">${ic('x')}</button></div></div>`;
const shell=()=>`<div class="nf-w"><div class="sn-ph"><strong>התראות</strong><span class="nf-cnt"></span></div><div class="nf-tools"><button type="button" data-nf-all>סמן הכל כנקרא</button><button type="button" data-nf-clear>ניקוי</button></div><div class="nf-list" role="group" aria-label="רשימת התראות"></div><div class="nf-empty" hidden>${ic('bell')}<span>אין התראות חדשות</span></div><button type="button" class="nf-more" data-nf-more hidden></button></div>`;
panel.innerHTML=shell();
const accHTML=`<button type="button" class="sn-acc" id="ntAcc" aria-expanded="false"><span class="sn-li">${ic('bell')}</span>התראות<span class="nf-chip" hidden></span>${ic('chev','sn-chev')}</button><div class="sn-ab"><div>${shell()}</div></div>`;
const accs=document.getElementById('snAccs'); if(accs) accs.insertAdjacentHTML('beforebegin',accHTML);
if(burger&&badge) burger.insertAdjacentHTML('beforeend','<span class="sn-badge" id="snBadgeM" hidden></span>');
const boxes=()=>[...document.querySelectorAll('.nf-w')];
function sync(){
  const un=NF.list.filter(e=>e.unread).length, tot=NF.list.length, txt=un>99?'99+':String(un);
  [badge,document.getElementById('snBadgeM')].forEach(b=>{ if(b){ b.hidden=!un; b.textContent=txt; } });
  const chip=document.querySelector('#ntAcc .nf-chip'); if(chip){ chip.hidden=!un; chip.textContent=txt; }
  boxes().forEach(w=>{
    w.querySelector('.nf-cnt').textContent=un?`${un} ${un===1?'חדשה':'חדשות'}`:(tot?'הכול נקרא':'');
    w.querySelector('.nf-tools').hidden=!tot; w.querySelector('.nf-list').hidden=!tot; w.querySelector('.nf-empty').hidden=!!tot;
    w.querySelector('[data-nf-all]').disabled=!un;
    const mb=w.querySelector('.nf-more'); mb.hidden=tot<=SHOW; mb.textContent=NF.all?'הצג פחות':'הצג עוד '+Math.max(0,tot-SHOW);
    w.querySelector('.nf-list').classList.toggle('all',NF.all);
  });
  bellBtn.setAttribute('aria-label',un?`התראות · ${un} ${un===1?'חדשה':'חדשות'}`:'התראות');
}
function markRead(id){ NF.list.forEach(e=>{ if((id==null||e.id===id)&&e.unread){ e.unread=false; document.querySelectorAll(`.nf-row[data-nf="${e.id}"]`).forEach(r=>r.classList.remove('unread')); } }); sync(); }
function push(o){
  const e=Object.assign({id:++NF.seq,ts:Date.now(),who:WHO,unread:true},o); NF.list.unshift(e);
  const dropped=NF.list.splice(MAX); dropped.forEach(d=>document.querySelectorAll(`.nf-row[data-nf="${d.id}"]`).forEach(r=>r.remove()));
  boxes().forEach(w=>{ const l=w.querySelector('.nf-list'); l.insertAdjacentHTML('afterbegin',rowHTML(e).replace('class="nf-row','class="nf-row nf-new')); const r=l.firstElementChild; setTimeout(()=>r.classList.remove('nf-new'),800); });
  sync();
  bellBtn.classList.remove('nf-ring'); void bellBtn.offsetWidth; bellBtn.classList.add('nf-ring'); setTimeout(()=>bellBtn.classList.remove('nf-ring'),1000);
  if(badge){ badge.classList.remove('nf-pop'); void badge.offsetWidth; badge.classList.add('nf-pop'); }
  return e;
}
function remove(id){ NF.list=NF.list.filter(e=>e.id!==id); document.querySelectorAll(`.nf-row[data-nf="${id}"]`).forEach(r=>{ r.style.height=r.offsetHeight+'px'; void r.offsetWidth; r.classList.add('out'); setTimeout(()=>{ r.remove(); sync(); },280); }); sync(); }
function go(id){
  markRead(id);
  bellItem.classList.remove('open'); bellBtn.setAttribute('aria-expanded','false');
  if(drawer&&drawer.classList.contains('open')&&burger) burger.click();
  scrollTo({top:0,behavior:'smooth'});
  const cards=[...document.querySelectorAll('.card,.itm,.dhero,.creditile')]; cards.forEach(c=>c.classList.add('shine-on')); setTimeout(()=>cards.forEach(c=>c.classList.remove('shine-on')),1800);
  toast('info',`נכנסת להזמנה #${ORDER_NO}`,'','');
}
document.addEventListener('click',e=>{
  const t=e.target; if(!t.closest) return; const g=s=>t.closest(s), row=g('.nf-row');
  if(g('[data-nf-x]')){ e.stopPropagation(); remove(+row.dataset.nf); return; }
  if(g('[data-nf-all]')){ e.stopPropagation(); markRead(); return; }
  if(g('[data-nf-clear]')){ e.stopPropagation(); const ids=NF.list.map(x=>x.id); ids.forEach(remove); return; }
  if(g('[data-nf-more]')){ e.stopPropagation(); NF.all=!NF.all; sync(); return; }
  if(row){ e.stopPropagation(); go(+row.dataset.nf); return; }
  if(g('#ntAcc')) setTimeout(()=>{ if(document.getElementById('ntAcc').getAttribute('aria-expanded')==='true') markRead(); },900);
},true);
document.addEventListener('keydown',e=>{ const row=e.target.classList&&e.target.classList.contains('nf-row')&&e.target; if(!row) return;
  if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(+row.dataset.nf); }
  else if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); remove(+row.dataset.nf); }
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); const rs=[...row.parentElement.querySelectorAll('.nf-row:not(.out)')].filter(r=>r.offsetParent), i=rs.indexOf(row), n=rs[i+(e.key==='ArrowDown'?1:-1)]; n&&n.focus(); } });
new MutationObserver(()=>{ if(bellItem.classList.contains('open')&&NF.list.some(e=>e.unread)) setTimeout(()=>{ if(bellItem.classList.contains('open')) markRead(); },1000); }).observe(bellItem,{attributes:true,attributeFilter:['class']});
setInterval(()=>document.querySelectorAll('.nf-t time').forEach(t=>{ t.textContent=rel(+t.dataset.ts); }),30000);

/* ---- seed (the three earlier demo notifications) ---- */
const now=Date.now();
[[3*3600e3,'scissors','תיקון הושלם - שמלה 214','',false],[3600e3,'wallet','נרשם זיכוי חדש להזמנה #53311','',false],[12*60e3,'truck','השכרה של שרה לוי חוזרת מחר','','']].forEach(([ago,icon,title,sub],i)=>{ const e={id:++NF.seq,ts:now-ago,who:'שרה כהן',unread:true,icon,title,sub}; NF.list.unshift(e); });
boxes().forEach(w=>{ w.querySelector('.nf-list').innerHTML=NF.list.map(rowHTML).join(''); });
sync();

/* ---- public + wiring ---- */
window.nfPush=push;
/* (sketch order-card wiring of commit/addLog/approval removed — pages call nfPush directly) */
})();
