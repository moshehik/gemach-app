(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

/* ---------- copy ---------- */
function copyText(t){
  return new Promise(function(res){
    function fb(){var ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}document.body.removeChild(ta);res(ok)}
    try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){res(true)},fb)}else fb()}catch(e){fb()}
  });
}
function flash(el,cls,ms){el.classList.add(cls);setTimeout(function(){el.classList.remove(cls)},ms||1100)}

/* ---------- copy real HTML of a specimen ---------- */
document.addEventListener('click',function(e){
  var b=e.target.closest('.pl-cp');if(!b)return;
  var s=b.closest('.pl-s');var root=s&&$('[data-pl-root]',s);if(!root)return;
  var c=root.cloneNode(true);c.removeAttribute('data-pl-root');$$('[data-pl-root]',c).forEach(function(x){x.removeAttribute('data-pl-root')});
  copyText(c.outerHTML).then(function(ok){b.textContent=ok?'הועתק':'לא הועתק';b.classList.add('done');setTimeout(function(){b.textContent='העתק HTML';b.classList.remove('done')},1200)});
});

/* ---------- dark / light windows (body.dlg-dark in the real pages) ---------- */
var dk=$('#plDark');
function setDark(on){$$('.pl-skin').forEach(function(x){x.classList.toggle('dlg-dark',on)});if(dk){dk.setAttribute('aria-pressed',on);dk.lastChild.textContent='חלונות: '+(on?'כהה':'בהיר')}}
if(dk){dk.addEventListener('click',function(){setDark(dk.getAttribute('aria-pressed')!=='true')});setDark(true)}

/* ---------- generic behaviour of the real components ---------- */
function idx(el){return Array.prototype.indexOf.call(el.parentElement.children,el)}
document.addEventListener('click',function(e){
  var t=e.target;
  var pill=t.closest('.seg.pill button');
  if(pill){var seg=pill.parentElement;var bs=$$(':scope > button',seg);bs.forEach(function(b){b.classList.remove('on');b.setAttribute('aria-checked','false')});pill.classList.add('on');pill.setAttribute('aria-checked','true');seg.style.setProperty('--i',bs.indexOf(pill));return}
  var vo=t.closest('.vsw .vopt');
  if(vo){var vs=vo.closest('.vsw'),vb=$$('.vopt',vs);vb.forEach(function(b){b.classList.remove('on')});vo.classList.add('on');var k=vb.indexOf(vo);vs.classList.remove('t','c');if(k===1)vs.classList.add('t');if(k===2)vs.classList.add('c');return}
  var b=t.closest('button,.opt,label.opt,.tab');if(!b)return;
  if(b.matches('.advfl,.advpill[data-tog],.btn.tgl')){b.classList.toggle('on');return}
  var grp=b.closest('.tabs,.seg,.sizes,.methods,.cmode,.advpills,.advyn-r,.hf-pills,.opts');
  if(grp&&b.parentElement===grp||b.matches('.opt')&&b.parentElement){
    var sibs=$$(':scope > button, :scope > .opt',b.parentElement);
    if(sibs.length>1&&sibs.indexOf(b)>-1){sibs.forEach(function(x){x.classList.remove('on');if(x.hasAttribute('aria-pressed'))x.setAttribute('aria-pressed','false')});b.classList.add('on');if(b.classList.contains('cmode-b'))b.setAttribute('aria-pressed','true')}
  }
});
document.addEventListener('click',function(e){
  var o=e.target.closest('.hf-o');if(o){o.setAttribute('aria-selected',o.getAttribute('aria-selected')==='true'?'false':'true');return}
  var c=e.target.closest('.cb-o');if(c){$$('.cb-o',c.parentElement).forEach(function(x){x.classList.remove('sel')});c.classList.add('sel');return}
  var d=e.target.closest('.dpc');if(d){$$('.dpc',d.parentElement).forEach(function(x){x.classList.remove('on')});d.classList.add('on');return}
  var m=e.target.closest('.nb-more');if(m){var nb=m.closest('.nb');if(nb)nb.classList.toggle('open');return}
});

/* ---------- live tooltip (the real #tt look, driven by data-tip like the pages do) ---------- */
var tw=document.createElement('div');tw.className='pg-b';tw.style.cssText='display:block;min-height:0;height:0;background:none;position:static;overflow:visible';
var tt=document.createElement('div');tt.className='pl-tt';tw.appendChild(tt);document.body.appendChild(tw);
document.addEventListener('mouseover',function(e){
  var t=e.target.closest('[data-tip]');
  if(!t||t.closest('.pl-tipc'))return;
  tt.textContent=t.getAttribute('data-tip');tt.classList.add('on');
  var r=t.getBoundingClientRect(),w=tt.offsetWidth,h=tt.offsetHeight;
  var l=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2));var top=r.top-h-10;if(top<8)top=r.bottom+10;
  tt.style.left=l+'px';tt.style.top=top+'px';
});
document.addEventListener('mouseout',function(e){if(e.target.closest&&e.target.closest('[data-tip]'))tt.classList.remove('on')});
document.addEventListener('scroll',function(){tt.classList.remove('on')},{passive:true});

/* ---------- icons ---------- */
var igrid=$('#iconGrid');
if(igrid){
  igrid.addEventListener('click',function(e){
    var b=e.target.closest('.pl-icon');if(!b)return;
    var code='<svg class="ic"><use href="#i-'+b.dataset.id+'"/></svg>';
    copyText(code).then(function(){flash(b,'done')});
  });
  $('#isz').addEventListener('input',function(e){igrid.parentElement.style.setProperty('--isz',e.target.value+'px');$('#iszo').textContent=e.target.value});
  $('#isw').addEventListener('input',function(e){igrid.parentElement.style.setProperty('--isw',e.target.value);$('#iswo').textContent=e.target.value});
}

/* ---------- colours: resolve every token live ---------- */
function rgb2hex(c){var m=c.match(/rgba?\(([^)]+)\)/);if(!m)return c;var p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);if(p.length<3)return c;var h='#'+p.slice(0,3).map(function(v){return ('0'+Math.round(v).toString(16)).slice(-2)}).join('');return p.length>3&&p[3]<1?h+' · '+Math.round(p[3]*100)+'%':h}
$$('.pl-sw').forEach(function(s){
  var i=$('.c i',s),cs=getComputedStyle(i),v=cs.backgroundImage!=='none'?'גרדיאנט':rgb2hex(cs.backgroundColor);
  var sm=$('small',s);if(sm)sm.textContent=v;
  s.addEventListener('click',function(){copyText(s.dataset.copy).then(function(){flash(s,'done',900)})});
});

/* ---------- animations: click to replay ---------- */
$$('.pl-an .stg').forEach(function(st){
  function play(){var t=$('[data-anim]',st);if(!t)return;var a=t.getAttribute('data-anim');t.style.animation='none';void t.offsetWidth;t.style.animation=a}
  st.addEventListener('click',play);st.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();play()}});
  var t=$('[data-anim]',st);if(t)t.style.animation=t.getAttribute('data-anim');
});

/* ---------- search by number / class / text ---------- */
var q=$('#plq'),resEl=$('#plres');
var items=$$('.pl-s,.pl-icon,.pl-an,.pl-tipc,.pl-sw');
function norm(s){return (s||'').toLowerCase().replace(/\s+/g,' ').trim()}
function run(){
  var v=norm(q.value),n=0;
  if(!v){items.forEach(function(x){x.classList.remove('hide')});$$('.pl-sec').forEach(function(s){s.classList.remove('hide')});resEl.textContent='';return}
  var m=v.match(/^(\D+?)\s*(\d+)$/),exact=m?(m[1].trim()+' '+m[2]):null;
  items.forEach(function(x){
    var k=x.getAttribute('data-key')||'';var ok=exact?(k.indexOf('|'+exact+'|')>-1):(k.indexOf(v)>-1);
    x.classList.toggle('hide',!ok);if(ok)n++;
  });
  resEl.textContent='נמצאו '+n;
  var first=$('.pl-s:not(.hide),.pl-icon:not(.hide),.pl-an:not(.hide),.pl-tipc:not(.hide)');
  if(n===1&&first){first.scrollIntoView({block:'center',behavior:'smooth'});first.classList.add('hit');setTimeout(function(){first.classList.remove('hit')},1800)}
}
if(q){q.addEventListener('input',run)}

/* ---------- scroll spy + stats ---------- */
var links=$$('.pl-toc a'),secs=$$('.pl-sec');
function spy(){var y=window.scrollY+140,cur=secs[0];secs.forEach(function(s){if(s.offsetTop<=y)cur=s});links.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+cur.id)})}
window.addEventListener('scroll',spy,{passive:true});window.addEventListener('resize',spy);spy();
})();
