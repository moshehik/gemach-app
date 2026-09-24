/* ==== V3 TABLES LAYER (JS) — the ONE table-screen renderer (TABLES-PATTERN.md). Identical in every list prototype.
   Uses only shell API + shell components: .card, .hf-bar/.hf-s/.hf-cl/.hf-t/.hf-bdg/.hf-pills/.hf-pill (the sketch's
   history filter bar), .seg, .tbl, .itm.hfe inside .hfeed (the sketch's expandable rows), .tag, .stx, .menu, .btn, .ibtn.
   Page API:  TP.frame(label) → markup of the one table card (slots #tpBar #tpViews #tpPills #tpList)
              TP.mount(spec)   → once;   TP.render(state) → rows/states;   TP.bar(o) / TP.views(…) / TP.pills(…) → controls ==== */
var TP=(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const num=n=>`<bdi dir="ltr">${Number(n).toLocaleString('he-IL')}</bdi>`;
  let spec=null, root=null, cardEl=null, st=null, menuEl=null, menuFor=null;

  /* ---------- the one table card ---------- */
  function frame(label){
    return `<section class="card tp-card" id="tpCard" aria-label="${esc(label)}"><div class="tp-prog" aria-hidden="true"></div>
      <div class="hf-bar" id="tpBar"></div><div class="tp-views" id="tpViews"></div><div class="hf-pills tp-pills" id="tpPills" role="group" aria-label="סינון פעיל"></div>
      <div id="tpList"></div></section>`;
  }
  /* ---------- search row = the sketch's history filter bar ---------- */
  function bar(o){
    const v=o.value||'', ai=!!o.ai;
    $('#tpBar').innerHTML=`<form class="tp-sform${ai?' tp-ai':''}" id="tpForm" role="search" novalidate>
      <div class="hf-s">${ic(ai?'sun':'search')}<input id="tpQ" type="search" autocomplete="off" enterkeyhint="search" value="${esc(v)}" placeholder="${esc(ai?o.aiPlaceholder:o.placeholder)}" aria-label="${ai?'חיפוש חכם':esc(o.label)}"><button type="button" class="hf-cl${v?' on':''}" data-tp-bar="clear" aria-label="ניקוי החיפוש">${ic('x')}</button></div>
      <button type="submit" class="btn">${ic(ai?'sun':'search','sm')}${ai?'חיפוש חכם':'חיפוש'}</button></form>
      <button type="button" class="hf-t" data-tp-bar="adv" aria-label="${o.filters?`סינון מתקדם (${o.filters} פעילים)`:'סינון מתקדם'}">${ic('sliders')}<span class="hf-lbl">סינון</span><span class="hf-bdg${o.filters?' has':''}">${o.filters||''}</span></button>
      ${o.aiOn?`<button type="button" class="ibtn" data-tp-bar="ai" aria-pressed="${ai}" aria-label="${ai?'חזרה לחיפוש רגיל':'חיפוש חכם'}">${ic(ai?'search':'sun')}</button><button type="button" class="ibtn" data-tp-bar="stats" aria-label="${esc(o.statsLabel||'שאלות סטטיסטיקה')}">${ic('list')}</button>`:''}`;
  }
  /* ---------- views = the sketch's segmented control; count only on the active view, as text ---------- */
  function views(list,cur,count){
    const el=$('#tpViews'); if(!list||!list.length){ el.innerHTML=''; return; }
    el.innerHTML=`<div class="seg" role="group" aria-label="תצוגות">${list.map(v=>`<button type="button" class="${v.key===cur?'on':''}" aria-pressed="${v.key===cur}" data-view="${v.key}"${v.tip?` data-tip="${esc(v.tip)}"`:''}>${v.icon?ic(v.icon):''}${v.label}${v.key===cur&&count!=null?` <span class="tcount">(${Number(count).toLocaleString('he-IL')})</span>`:''}</button>`).join('')}</div>`;
  }
  /* ---------- active filters = the sketch's .hf-pill (removable); a default window = text + button ---------- */
  function pills(items,clearAct){
    const act=items.filter(f=>!f.def), def=items.filter(f=>f.def);
    $('#tpPills').innerHTML=def.map(f=>`<span class="tp-def">${f.label}</span><button type="button" class="btn ghost sm" data-fs-act="${f.act}">${f.actLabel}</button>`).join('')
      +act.map(f=>`<button type="button" class="hf-pill" data-fs-rm="${f.key}" aria-label="הסרת ${esc(f.label.replace(/<[^>]+>/g,''))}">${f.label}${ic('x')}</button>`).join('')
      +(act.length>1?`<button type="button" class="btn ghost sm" data-fs-act="${clearAct}">ניקוי הכול</button>`:'');
  }

  /* ---------- table ---------- */
  function sortHead(c){
    const k=c.sort; if(!k) return `<th scope="col" class="p${c.prio||1}${c.num?' num':''}">${c.label}</th>`;
    const on=st.sort&&st.sort.key===k, dir=on?(st.sort.dir==='asc'?'ascending':'descending'):'none';
    const off=st.sortOff?` disabled data-tip="${esc(st.sortOff)}"`:'';
    return `<th scope="col" class="tp-th p${c.prio||1}${c.num?' num':''}" aria-sort="${dir}"><button type="button" class="tp-sort" data-tp-sort="${k}"${off}>${c.label}${ic('chev')}</button></th>`;
  }
  function kv(r){
    const pairs=spec.expand(r)||[];
    const xa=((spec.xacts&&spec.xacts(r))||[]).concat(((spec.menu&&spec.menu(r))||[]).map(a=>({...a,xm:1})));   /* menu items also live here: on cards and below 1024 */
    return `<div class="tp-kv">${pairs.map(([l,v,w])=>`<div class="f${w?' wide':''}"><small>${l}</small><b>${v==null||v===''?'<span class="tp-nil">—</span>':v}</b></div>`).join('')}${xa.length?`<div class="tp-xa">${xa.map(a=>`<button type="button" class="btn sm${a.primary?' primary':''}${a.xm?' tp-xm':''}" data-tp-act="${a.act}" data-id="${esc(spec.id(r))}">${ic(a.icon,'sm')}${a.label}</button>`).join('')}</div>`:''}</div>`;
  }
  function more(r){
    const m=(spec.menu&&spec.menu(r))||[];
    return m.length?`<button type="button" class="ibtn" data-tp-more="${esc(spec.id(r))}" aria-haspopup="menu" aria-expanded="false" aria-label="פעולות נוספות">${ic('menu','sm')}</button>`:'';
  }
  function row(r,i,ncol){
    const id=esc(spec.id(r)), open=st.open===spec.id(r), edge=spec.edge&&spec.edge(r);
    const cells=spec.cols.map(c=>`<td class="p${c.prio||1}${c.num?' num':''}">${c.cell(r)}</td>`).join('');
    return `<tr class="tp-row${open?' open':''}${st.fresh?' enter':''}" data-id="${id}"${edge?` data-edge="${edge}"`:''} style="--i:${Math.min(i,12)}">${cells}<td class="tp-act"><div class="tp-acts">${more(r)}<button type="button" class="ibtn chevb" data-tp-x="${id}" aria-expanded="${open}" aria-controls="tpx-${id}" aria-label="פרטים">${ic('chev','sm')}</button></div></td></tr>`+
      `<tr class="tp-x${open?' open':''}" id="tpx-${id}"><td colspan="${ncol}"><div class="tp-xw"><div class="tp-xi">${kv(r)}</div></div></td></tr>`;
  }
  function card(r,i){
    const id=esc(spec.id(r)), open=st.open===spec.id(r), edge=spec.edge&&spec.edge(r), c=spec.card(r);
    const lines=(c.lines||[]).map(([l,v])=>`<span class="tp-cl"><small>${l}</small>${v}</span>`).join('');
    return `<li><article class="itm hfe noamt${open?' open':''}" data-id="${id}"${edge?` data-edge="${edge}"`:''} style="--i:${Math.min(i,12)}"><div class="top" data-tp-open="${id}"><div class="thumb" style="background:${THUMBS[0]}">${ic(spec.icon)}</div><div class="info"><span class="tp-ct">${c.title}</span>${lines}${c.status?`<span class="tp-cst">${c.status}</span>`:''}</div><button type="button" class="ibtn chevb" data-tp-x="${id}" aria-expanded="${open}" aria-controls="tpc-${id}" aria-label="פרטים">${ic('chev','sm')}</button></div><div class="det-wrap"><div class="det" id="tpc-${id}"><div class="det-in">${kv(r)}</div></div></div></article></li>`;
  }
  function skeleton(){
    const w=['s','l','m','m','s','s']; let h='';
    for(let i=0;i<6;i++) h+=`<tr aria-hidden="true">${spec.cols.map((c,j)=>`<td class="p${c.prio||1}"><span class="tp-sk ${w[(i+j)%6]}"></span></td>`).join('')}<td class="tp-act"></td></tr>`;
    return h;
  }
  function note(n){
    if(!n) return '';
    return `<div class="tp-note${n.kind==='err'?' err':''}" role="${n.kind==='err'?'alert':'status'}">${ic(n.icon||'info')}<div><b>${n.title}</b>${n.text?`<span>${n.text}</span>`:''}</div>${n.action?`<button type="button" class="btn ${n.kind==='err'?'primary':'ghost'} sm tp-nact" data-tp-act="${n.action.act}">${n.action.icon?ic(n.action.icon,'sm'):''}${n.action.label}</button>`:''}</div>`;
  }
  function empty(e){
    return `<div class="tp-empty" role="status"><div class="thumb">${ic(e.icon||'search','lg')}</div><b>${e.title}</b>${e.text?`<p>${e.text}</p>`:''}${e.action?`<button type="button" class="btn${e.action.primary?' primary':''}" data-tp-act="${e.action.act}">${e.action.icon?ic(e.action.icon,'sm'):''}${e.action.label}</button>`:''}</div>`;
  }
  function foot(){
    const n=st.rows.length, from=n?(st.page-1)*st.size+1:0, to=n?from+n-1:0;
    const rng=st.total!=null?`מוצגות ${num(from)}–${num(to)} מתוך ${num(st.total)}`:`מוצגות ${num(n)} שורות`;
    const so=spec.sortOptions||[];
    const sortSel=so.length?`<label class="tp-sortsel">מיון<select class="inp" data-tp-sortsel${st.sortOff?' disabled':''}>${so.map(([k,d,l])=>`<option value="${k}:${d}"${st.sort&&st.sort.key===k&&st.sort.dir===d?' selected':''}>${l}</option>`).join('')}</select></label>`:'';
    const busy=st.phase==='loading';
    const pager=st.noPaging?`<span>${st.noPaging}</span>`:st.pages>1?`<div class="tp-pager"><button type="button" class="btn ghost sm" data-tp-pg="${st.page-1}"${st.page<=1||busy?' disabled':''}>${ic('arrr','sm')}הקודם</button><span class="tp-pg"><label for="tpPage">עמוד</label><input id="tpPage" class="inp" type="number" inputmode="numeric" min="1" max="${st.pages}" value="${st.page}"${busy?' disabled':''}> מתוך ${num(st.pages)}</span><button type="button" class="btn ghost sm" data-tp-pg="${st.page+1}"${st.page>=st.pages||busy?' disabled':''}>הבא${ic('arrl','sm')}</button></div>`:'';
    return `<div class="tp-foot"><span aria-live="polite">${rng}</span>${sortSel}${pager}</div>`;
  }
  function render(state){
    st=Object.assign({size:50,page:1,pages:1},state);
    const ncol=spec.cols.length+1, loading=st.phase==='loading'&&!st.rows.length, showEmpty=!loading&&!st.rows.length&&st.empty;
    cardEl.setAttribute('aria-busy',String(st.phase==='loading')); cardEl.classList.remove('slow');
    const head=`<thead><tr>${spec.cols.map(sortHead).join('')}<th scope="col" class="tp-act"><span class="tp-sr">פעולות</span></th></tr></thead>`;
    root.innerHTML=`${note(st.note)}${showEmpty?empty(st.empty):`<div class="tbl-wrap tp-tbl-wrap"><table class="tbl tp-tbl"><caption class="tp-sr">${spec.caption}</caption>${head}<tbody>${loading?skeleton():st.rows.map((r,i)=>row(r,i,ncol)).join('')}</tbody></table></div>
      <ul class="tp-cards hfeed" aria-label="${esc(spec.caption)}">${loading?'<li><span class="tp-sk l"></span></li><li><span class="tp-sk m"></span></li><li><span class="tp-sk l"></span></li>':st.rows.map(card).join('')}</ul>`}${showEmpty||loading?'':foot()}`;
  }
  function slow(){ cardEl&&cardEl.classList.add('slow'); }
  function toggle(id){
    const was=st.open===id; st.open=was?null:id;
    root.querySelectorAll('.tp-row,.tp-x,.tp-cards .itm').forEach(e=>{ e.classList.toggle('open',!was&&(e.dataset.id===id||e.id==='tpx-'+id)); });
    root.querySelectorAll('[data-tp-x]').forEach(b=>b.setAttribute('aria-expanded',String(!was&&b.dataset.tpX===id)));
  }
  /* row "more" menu — the sketch .menu, rendered at body level so the table's scroll box never clips it */
  function closeMenu(focus){ if(!menuEl||!menuFor) return; menuEl.classList.remove('open'); const b=root.querySelector(`[data-tp-more="${menuFor}"]`); if(b){ b.setAttribute('aria-expanded','false'); if(focus) b.focus(); } menuFor=null; }
  function openMenu(btn){
    const id=btn.dataset.tpMore, r=spec.find(id); if(!r) return;
    if(!menuEl){ menuEl=document.createElement('div'); menuEl.className='menu tp-menu'; menuEl.setAttribute('role','menu'); document.body.appendChild(menuEl); }
    menuEl.innerHTML=spec.menu(r).map(a=>`<button type="button" role="menuitem" data-tp-act="${a.act}" data-id="${esc(id)}">${ic(a.icon)}${a.label}</button>`).join('');
    menuEl.classList.add('open'); menuFor=id; btn.setAttribute('aria-expanded','true');
    const b=btn.getBoundingClientRect(), w=menuEl.offsetWidth, h=menuEl.offsetHeight; let y=b.bottom+6; if(y+h>innerHeight-8) y=Math.max(8,b.top-h-6);
    menuEl.style.position='fixed'; menuEl.style.top=y+'px'; menuEl.style.left=Math.max(8,Math.min(innerWidth-w-8,b.left))+'px'; menuEl.style.insetInlineEnd='auto';
    const f=menuEl.querySelector('button'); f&&f.focus();
  }
  function mount(s){
    spec=s; cardEl=$('#tpCard'); root=$('#tpList'); root.classList.add('tp-root');
    cardEl.addEventListener('click',e=>{
      const t=e.target;
      const so=t.closest('[data-tp-sort]'); if(so){ spec.onSort(so.dataset.tpSort); return; }
      const x=t.closest('[data-tp-x]'); if(x){ e.stopPropagation(); toggle(x.dataset.tpX); return; }
      const mo=t.closest('[data-tp-more]'); if(mo){ e.stopPropagation(); menuFor===mo.dataset.tpMore?closeMenu():(closeMenu(),openMenu(mo)); return; }
      const pg=t.closest('[data-tp-pg]'); if(pg){ spec.onPage(+pg.dataset.tpPg); return; }
      const a=t.closest('[data-tp-act]'); if(a){ spec.onAct(a.dataset.tpAct,a.dataset.id?spec.find(a.dataset.id):null,a); return; }
      const fr=t.closest('[data-fs-rm]'); if(fr){ spec.onFilterRemove(fr.dataset.fsRm); return; }
      const fa=t.closest('[data-fs-act]'); if(fa){ spec.onAct(fa.dataset.fsAct); return; }
      const v=t.closest('[data-view]'); if(v){ spec.onView(v.dataset.view); return; }
      const bb=t.closest('[data-tp-bar]'); if(bb){ spec.onBar(bb.dataset.tpBar); return; }
      const ln=t.closest('a[data-tp-link]'); if(ln){ e.preventDefault(); spec.onOpen(spec.find(ln.dataset.tpLink)); return; }
      if(t.closest('a,button,input,select,.det')) return;
      const tr=t.closest('.tp-row,[data-tp-open]'); if(tr){ spec.onOpen(spec.find(tr.dataset.id||tr.dataset.tpOpen)); }
    });
    cardEl.addEventListener('submit',e=>{ if(e.target.id==='tpForm'){ e.preventDefault(); spec.onSearch($('#tpQ').value.trim()); } });
    cardEl.addEventListener('input',e=>{ if(e.target.id==='tpQ'){ spec.onType&&spec.onType(e.target.value); const c=cardEl.querySelector('.hf-cl'); c&&c.classList.toggle('on',!!e.target.value); } });
    cardEl.addEventListener('change',e=>{
      if(e.target.id==='tpPage'){ const v=parseInt(e.target.value,10); if(v>=1&&v<=st.pages) spec.onPage(v); else e.target.value=st.page; }
      if(e.target.matches('[data-tp-sortsel]')){ const [k,d]=e.target.value.split(':'); spec.onSort(k,d); }
    });
    cardEl.addEventListener('keydown',e=>{ if(e.key==='Escape'&&st&&st.open&&!document.querySelector('#scrim.on')){ const id=st.open; toggle(id); const b=[...root.querySelectorAll(`[data-tp-x="${id}"]`)].find(x=>x.offsetParent); b&&b.focus(); } });
    document.addEventListener('click',e=>{ if(!menuEl||!menuFor) return; const a=e.target.closest('.tp-menu [data-tp-act]'); if(a){ closeMenu(); spec.onAct(a.dataset.tpAct,spec.find(a.dataset.id),a); return; } if(!menuEl.contains(e.target)&&!e.target.closest('[data-tp-more]')) closeMenu(); });
    document.addEventListener('keydown',e=>{
      if(!menuEl||!menuFor) return;
      const it=[...menuEl.querySelectorAll('button')], i=it.indexOf(document.activeElement);
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      else if(e.key==='ArrowDown'){ e.preventDefault(); it[(i+1)%it.length].focus(); } else if(e.key==='ArrowUp'){ e.preventDefault(); it[(i-1+it.length)%it.length].focus(); }
      else if(e.key==='Home'){ e.preventDefault(); it[0].focus(); } else if(e.key==='End'){ e.preventDefault(); it[it.length-1].focus(); } else if(e.key==='Tab') closeMenu();
    },true);
    window.addEventListener('scroll',()=>closeMenu(),true); window.addEventListener('resize',()=>closeMenu());
  }
  /* header "עוד" menu (sketch .tools .menu) — below 768 the icon tools move into it */
  function headMenu(items){
    return `<button type="button" class="ibtn tp-more" data-tp-hm aria-haspopup="menu" aria-expanded="false" aria-controls="tpHm" aria-label="כלים נוספים">${ic('menu')}</button><div class="menu" id="tpHm" role="menu">${items.map(a=>`<button type="button" role="menuitem" data-head-act="${a.act}">${ic(a.icon)}${a.label}</button>`).join('')}</div>`;
  }
  document.addEventListener('click',e=>{
    const m=document.getElementById('tpHm'); if(!m) return; const t=document.querySelector('[data-tp-hm]');
    const b=e.target.closest('[data-tp-hm]');
    if(b){ const on=!m.classList.contains('open'); m.classList.toggle('open',on); b.setAttribute('aria-expanded',String(on)); if(on){ const f=m.querySelector('button'); f&&f.focus(); } return; }
    if(m.classList.contains('open')&&(!m.contains(e.target)||e.target.closest('[data-head-act]'))){ m.classList.remove('open'); t&&t.setAttribute('aria-expanded','false'); }
  });
  document.addEventListener('keydown',e=>{ const m=document.getElementById('tpHm'); if(!m||!m.classList.contains('open')) return; const it=[...m.querySelectorAll('button')], i=it.indexOf(document.activeElement);
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); m.classList.remove('open'); const t=document.querySelector('[data-tp-hm]'); if(t){ t.setAttribute('aria-expanded','false'); t.focus(); } }
    else if(e.key==='ArrowDown'){ e.preventDefault(); it[(i+1)%it.length].focus(); } else if(e.key==='ArrowUp'){ e.preventDefault(); it[(i-1+it.length)%it.length].focus(); } },true);
  return {frame,bar,views,pills,mount,render,slow,toggle,headMenu,esc,num,get state(){return st}};
})();
