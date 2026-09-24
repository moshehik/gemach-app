/* [S10] ICON-ANIM — sketch L3226-3261 */
/* ICON-ANIM START */
(()=>{
 const RM=matchMedia('(min-width:99999px)').matches;
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
 if(matchMedia('(min-width:99999px)').matches)return;
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
