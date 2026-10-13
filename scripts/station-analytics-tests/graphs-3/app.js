/* גרפים: שלושה כיווני עיצוב (A ענן / B זרימה / C מינימליזם) לארבעת הרכיבים: אריח סטטיסטיקה, משפך, עמודות מקובצות, קו מגמה.
   SVG / CSS בלבד, בלי ספריות ובלי רשת. נתוני דמה. הצירים מימין לשמאל (היום הראשון בטווח מימין). */
(function () {
  'use strict';
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DAYS = window.__DAYS;
  var STAGES = window.__STAGES; // [{key,label,parent,parentLabel}]

  /* ---------- נתוני דמה (14 ימים) ---------- */
  var registered = [3, 5, 2, 6, 4, 7, 5, 3, 8, 6, 4, 9, 7, 5];
  var opened = [2, 3, 1, 4, 3, 5, 3, 2, 5, 4, 3, 6, 4, 2];
  var approved = [1, 2, 1, 2, 2, 3, 2, 1, 3, 2, 2, 4, 3, 1];
  var visits = [38, 52, 31, 66, 49, 72, 58, 40, 81, 63, 47, 90, 74, 55];
  var rate = visits.map(function (v, i) { return i === 2 || i === 7 ? null : registered[i] / v; });
  var prior = [0.09, 0.08, 0.11, null, 0.1, 0.07, 0.12, 0.09, 0.08, null, 0.1, 0.11, 0.09, 0.1];
  var FUNNEL = { visits: 420, availability: 168, formStart: 74, registered: 41, verified: 28, opened: 29, approved: 21 };
  var mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
  var T = function (arr) { return { v: arr[13], y: arr[12], a: mean(arr.slice(6, 13)), spark: arr }; };
  var TILE = { visits: T(visits), registered: T(registered), opened: T(opened), rate: { v: 0.71, y: 0.56, a: 0.62, strict: 0.51 } };

  /* ---------- עזרים ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  var SVG = {}; 'svg g path rect circle line text defs linearGradient radialGradient stop filter feGaussianBlur feMerge feMergeNode polyline tspan clipPath'.split(' ').forEach(function (t) { SVG[t] = 1; });
  function h(tag, attrs) {
    var e = SVG[tag] ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (var k in attrs || {}) {
      var v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(function (x) { add(e, x); }); else e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); }
  var nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  var fmt = function (n) { return n == null ? '—' : nf.format(Math.round(n)); };
  var fmtAvg = function (n) { return Math.abs(n - Math.round(n)) < 1e-9 ? fmt(n) : nf1.format(n); };
  var pct = function (r) { if (r == null) return '—'; var p = r * 100; return (p < 10 && p > 0 ? nf1.format(p) : nf.format(p)) + '%'; };
  function niceScale(max, want) {
    want = want || 4; max = max > 0 ? max : 1;
    if (max <= want) { var m = Math.ceil(max); var t = []; for (var i = 0; i <= m; i++) t.push(i); return { max: m, ticks: t }; }
    var e0 = Math.floor(Math.log10(max)), step = Math.pow(10, e0 + 1);
    outer: for (var e = e0 - 2; e <= e0 + 1; e++) for (var q = 0; q < 3; q++) { var c = [1, 2, 5][q] * Math.pow(10, e); if (Math.ceil(max / c - 1e-9) <= want + 1) { step = c; break outer; } }
    var top = Math.ceil(max / step - 1e-9) * step, ticks = []; for (var v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { max: top, ticks: ticks };
  }
  /* עקומה חלקה מונוטונית (Fritsch-Carlson) דרך נקודות עם x עולה */
  function spline(p) {
    var n = p.length; if (n < 2) return '';
    var dx = [], m = [], t = [], i;
    for (i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; m[i] = (p[i + 1].y - p[i].y) / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
      var a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { var k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    var d = 'M' + p[0].x + ',' + p[0].y;
    for (i = 0; i < n - 1; i++) { var w = dx[i]; d += ' C' + (p[i].x + w / 3) + ',' + (p[i].y + t[i] * w / 3) + ' ' + (p[i + 1].x - w / 3) + ',' + (p[i + 1].y - t[i + 1] * w / 3) + ' ' + p[i + 1].x + ',' + p[i + 1].y; }
    return d;
  }
  function segments(pts) { var out = [], cur = []; pts.forEach(function (p) { if (p) cur.push(p); else { if (cur.length) out.push(cur); cur = []; } }); if (cur.length) out.push(cur); return out; }
  var uid = 0;
  var IC = {
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-4 3.6-6 8-6s8 2 8 6',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    cart: 'M3 4h2l2.4 10.2a1 1 0 001 .8h8.4a1 1 0 001-.8L19.5 8H6M9 20h.01M17 20h.01',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z'
  };
  var icon = function (n) { return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, h('path', { d: IC[n] })); };
  var arrow = function (dir) { return h('svg', { viewBox: '0 0 12 12', 'aria-hidden': 'true' }, h('path', { d: dir === 'up' ? 'M2 8l4-4 4 4' : dir === 'down' ? 'M2 4l4 4 4-4' : 'M2 6h8', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })); };
  function delta(cur, prev, kind) {
    var d = cur - prev, dir = Math.abs(d) < 1e-9 ? 'same' : d > 0 ? 'up' : 'down';
    var txt = dir === 'same' ? 'ללא שינוי' : kind === 'rate' ? nf1.format(Math.abs(d) * 100) + ' נק׳ אחוז' : fmtAvg(Math.abs(d));
    var word = dir === 'up' ? 'עלייה של ' : dir === 'down' ? 'ירידה של ' : '';
    return h('span', { class: 'chip ' + dir }, arrow(dir), h('span', { class: 'sr-only' }, word), txt);
  }

  /* ---------- טולטיפ ---------- */
  var tt = document.getElementById('tt');
  function place(x, y) {
    var w = tt.offsetWidth, hh = tt.offsetHeight, L = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)), Tp = y - hh - 14;
    if (Tp < 8) Tp = y + 20; tt.style.left = L + 'px'; tt.style.top = Tp + 'px';
  }
  function tip(node, get, cls) {
    function show(e) {
      var d = get(); tt.className = 'on ' + (cls || ''); tt.replaceChildren();
      tt.appendChild(h('div', { class: 'd' }, d.title));
      d.rows.forEach(function (r) { tt.appendChild(h('div', { class: 'r' }, h('i', { style: { background: r.color } }), h('b', {}, r.value), h('span', {}, r.label))); });
      if (e && e.clientX != null && e.type === 'mouseenter') place(e.clientX, e.clientY); else { var b = node.getBoundingClientRect(); place(b.left + b.width / 2, b.top); }
    }
    node.addEventListener('mouseenter', show); node.addEventListener('focus', show);
    node.addEventListener('mousemove', function (e) { place(e.clientX, e.clientY); });
    var hide = function () { tt.className = ''; };
    node.addEventListener('mouseleave', hide); node.addEventListener('blur', hide);
  }
  function mount(box, render) {
    var w = 0, tm;
    function run() { var nw = Math.floor(box.clientWidth); if (!nw || nw === w) return; w = nw; box.replaceChildren(); render(box, nw); }
    if (window.ResizeObserver) new ResizeObserver(function () { clearTimeout(tm); tm = setTimeout(run, 60); }).observe(box);
    run();
  }

  /* ---------- ספרקליין ---------- */
  function sparkline(w, hh, vals, o) {
    var id = 'sp' + (++uid), pad = o.pad == null ? 4 : o.pad, mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
    var pts = vals.map(function (v, i) { return { x: w - pad - i * ((w - 2 * pad) / (vals.length - 1)), y: hh - pad - ((v - mn) / (mx - mn || 1)) * (hh - 2 * pad - 4) - 2 }; }).reverse();
    var d = o.smooth ? spline(pts) : 'M' + pts.map(function (p) { return p.x + ',' + p.y; }).join(' L');
    var last = pts[pts.length - 1];
    var kids = [];
    if (o.area) {
      kids.push(h('defs', {}, h('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', 'stop-color': o.area, 'stop-opacity': 0.38 }), h('stop', { offset: '100%', 'stop-color': o.area, 'stop-opacity': 0 }))));
      kids.push(h('path', { d: d + ' L' + pts[pts.length - 1].x + ',' + hh + ' L' + pts[0].x + ',' + hh + ' Z', fill: 'url(#' + id + ')', class: 'fade' }));
    }
    kids.push(h('path', { d: d, fill: 'none', stroke: o.stroke, 'stroke-width': o.sw || 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, class: 'draw' }));
    kids.push(h('circle', { cx: last.x, cy: last.y, r: o.dot || 3.5, fill: o.stroke, stroke: o.ring || 'var(--surface)', 'stroke-width': 2 }));
    return h('svg', { width: '100%', height: hh, viewBox: '0 0 ' + w + ' ' + hh, preserveAspectRatio: 'none', 'aria-hidden': 'true', style: { direction: 'ltr' } }, kids);
  }

  /* ---------- אריחים ---------- */
  function sparkBox(cls, hh, vals, o) { var box = h('div', { class: cls }); setTimeout(function () { mount(box, function (b, w) { b.appendChild(sparkline(w, hh, vals, o)); }); }, 0); return box; }
  function countEl(tag, cls, val, dec, suffix) { return h(tag, { class: cls + ' num', 'data-count': val, 'data-dec': dec || 0, 'data-suf': suffix || '' }, (dec ? nf1.format(val) : fmt(val)) + (suffix || '')); }

  function ringSvg(opts) { // טבעת כפולה (A)
    var S = 132, c = S / 2, r1 = 54, r2 = 40, id = 'rg' + (++uid), C1 = 2 * Math.PI * r1, C2 = 2 * Math.PI * r2;
    return h('svg', { class: 'ring', width: S, height: S, viewBox: '0 0 ' + S + ' ' + S, role: 'img', 'aria-label': 'נפתחה הזמנה ' + pct(opts.a) + ', אושרה או שולמה ' + pct(opts.b) },
      h('defs', {},
        h('linearGradient', { id: id + 'a', x1: 0, y1: 0, x2: 1, y2: 1 }, h('stop', { offset: '0%', 'stop-color': 'var(--s2-hi)' }), h('stop', { offset: '100%', 'stop-color': 'var(--s2)' })),
        h('linearGradient', { id: id + 'b', x1: 0, y1: 0, x2: 1, y2: 1 }, h('stop', { offset: '0%', 'stop-color': 'var(--s1-hi)' }), h('stop', { offset: '100%', 'stop-color': 'var(--s1)' }))),
      h('circle', { cx: c, cy: c, r: r1, fill: 'none', stroke: 'var(--line-2)', 'stroke-width': 12 }),
      h('circle', { cx: c, cy: c, r: r2, fill: 'none', stroke: 'var(--line-2)', 'stroke-width': 12 }),
      h('circle', { cx: c, cy: c, r: r1, fill: 'none', stroke: 'url(#' + id + 'a)', 'stroke-width': 12, 'stroke-linecap': 'round', transform: 'rotate(-90 ' + c + ' ' + c + ') scale(1 1)', 'stroke-dasharray': C1, 'stroke-dashoffset': C1 * (1 - opts.a), style: { transition: RM ? 'none' : 'stroke-dashoffset 1.1s var(--ease)' }, 'data-ring': C1 * (1 - opts.a), 'data-c': C1 }),
      h('circle', { cx: c, cy: c, r: r2, fill: 'none', stroke: 'url(#' + id + 'b)', 'stroke-width': 12, 'stroke-linecap': 'round', transform: 'rotate(-90 ' + c + ' ' + c + ')', 'stroke-dasharray': C2, 'stroke-dashoffset': C2 * (1 - opts.b), style: { transition: RM ? 'none' : 'stroke-dashoffset 1.1s var(--ease) .15s' }, 'data-ring': C2 * (1 - opts.b), 'data-c': C2 }),
      h('text', { x: c, y: c + 8, 'text-anchor': 'middle', style: { fontSize: '25px', fontWeight: 600, fill: 'var(--ink)' }, 'data-count': opts.a * 100, 'data-dec': 0, 'data-suf': '%' }, pct(opts.a)));
  }
  function gaugeSvg(opts) { // חצי טבעת (B)
    var W = 220, Hh = 128, cx = W / 2, cy = 112, r = 88, id = 'gg' + (++uid), L = Math.PI * r;
    var arc = 'M' + (cx - r) + ',' + cy + ' A' + r + ',' + r + ' 0 0 1 ' + (cx + r) + ',' + cy;
    var r2 = 68, arc2 = 'M' + (cx - r2) + ',' + cy + ' A' + r2 + ',' + r2 + ' 0 0 1 ' + (cx + r2) + ',' + cy, L2 = Math.PI * r2;
    // כיוון קריאה בעברית: המילוי מתחיל מהצד הימני
    return h('svg', { class: 'gauge', width: '100%', viewBox: '0 0 ' + W + ' ' + Hh, style: { maxWidth: 260, direction: 'ltr' }, role: 'img', 'aria-label': 'נפתחה הזמנה ' + pct(opts.a) + ', אושרה או שולמה ' + pct(opts.b) },
      h('defs', {}, h('linearGradient', { id: id, x1: 1, y1: 0, x2: 0, y2: 0 }, h('stop', { offset: '0%', 'stop-color': '#e0c56e' }), h('stop', { offset: '100%', 'stop-color': '#7fb8e6' }))),
      h('path', { d: arc, fill: 'none', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 14, 'stroke-linecap': 'round', transform: 'translate(' + W + ',0) scale(-1,1)' }),
      h('path', { d: arc, fill: 'none', stroke: 'url(#' + id + ')', 'stroke-width': 14, 'stroke-linecap': 'round', transform: 'translate(' + W + ',0) scale(-1,1)', class: 'glow', 'stroke-dasharray': L, 'stroke-dashoffset': L * (1 - opts.a), 'data-ring': L * (1 - opts.a), 'data-c': L, style: { transition: RM ? 'none' : 'stroke-dashoffset 1.2s var(--ease)' } }),
      h('path', { d: arc2, fill: 'none', stroke: 'rgba(255,255,255,.1)', 'stroke-width': 6, 'stroke-linecap': 'round', transform: 'translate(' + W + ',0) scale(-1,1)' }),
      h('path', { d: arc2, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.85, 'stroke-width': 6, 'stroke-linecap': 'round', transform: 'translate(' + W + ',0) scale(-1,1)', 'stroke-dasharray': L2, 'stroke-dashoffset': L2 * (1 - opts.b), 'data-ring': L2 * (1 - opts.b), 'data-c': L2, style: { transition: RM ? 'none' : 'stroke-dashoffset 1.2s var(--ease) .15s' } }),
      h('text', { x: cx, y: cy - 14, 'text-anchor': 'middle', style: { fontSize: '34px', fontWeight: 600, fill: '#fff' }, 'data-count': opts.a * 100, 'data-dec': 0, 'data-suf': '%' }, pct(opts.a)),
      h('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', style: { fontSize: '12px', fill: '#b9c9de' } }, 'מילאו ← נפתחה הזמנה'));
  }

  function tileA(dir) {
    var out = [];
    [['eye', 'נכנסו לעמדה', TILE.visits, visits], ['user', 'מילאו פרטים', TILE.registered, registered]].forEach(function (d) {
      var t = d[2];
      out.push(h('div', { class: 'card tile rise', style: { '--i': out.length } },
        h('div', { class: 't-top' }, h('span', { class: 't-ic' }, icon(d[0])), d[1]),
        countEl('div', 't-num', t.v),
        h('div', { class: 't-row' }, delta(t.v, t.y), h('span', {}, 'מאתמול (' + fmt(t.y) + ')'), h('span', {}, 'ממוצע שבועי ' + fmtAvg(t.a))),
        sparkBox('spark', 64, d[3], { stroke: 'var(--s1)', area: 'var(--s1-hi)', smooth: true, sw: 2.4, dot: 4 })));
    });
    var r = TILE.rate;
    out.push(h('div', { class: 'card tile rise', style: { '--i': 2 } },
      h('div', { class: 't-top' }, h('span', { class: 't-ic' }, icon('spark')), 'המרה: מילאו ← נפתחה הזמנה'),
      h('div', { class: 'ring-wrap' }, ringSvg({ a: r.v, b: r.strict }),
        h('div', { class: 'ring-leg' },
          h('span', {}, h('i', { class: 'key k2' }), 'נפתחה הזמנה ', h('b', { class: 'num' }, pct(r.v))),
          h('span', {}, h('i', { class: 'key k1' }), 'אושרה או שולמה ', h('b', { class: 'num' }, pct(r.strict))),
          h('span', {}, delta(r.v, r.y, 'rate'), 'מאתמול'))),
      h('div', { class: 't-row' }, 'ממוצע שבועי ' + pct(r.a))));
    out.push(h('div', { class: 'card tile rise', style: { '--i': 3 } },
      h('div', { class: 't-top' }, h('span', { class: 't-ic' }, icon('eye')), 'נכנסו לעמדה (ערוץ חנות)'),
      h('div', { class: 't-num num', style: { color: 'var(--ink-3)' } }, '—'),
      h('div', { class: 't-row' }, 'כניסות נמדדות רק בקישור הכללי')));
    return out;
  }
  function tileB() {
    var out = [];
    [['eye', 'נכנסו לעמדה', TILE.visits], ['user', 'מילאו פרטים', TILE.registered]].forEach(function (d) {
      var t = d[2], mx = Math.max(t.v, t.y, t.a);
      function row(lab, val, color) { return [h('span', {}, lab), h('span', { class: 'tr' }, h('i', { style: { background: color }, 'data-w': (val / mx) * 100 + '%' })), h('b', { class: 'num' }, fmtAvg(val))]; }
      out.push(h('div', { class: 'card tile rise', style: { '--i': out.length } },
        h('div', { class: 't-top' }, icon(d[0]), d[1], h('span', { style: { marginInlineStart: 'auto' } }, delta(t.v, t.y))),
        countEl('div', 't-num', t.v),
        h('div', { class: 'cmp' }, row('היום', t.v, 'linear-gradient(90deg,#e0c56e,#fff)'), row('אתמול', t.y, 'rgba(143,188,236,.9)'), row('ממוצע שבועי', t.a, 'rgba(255,255,255,.45)'))));
    });
    var r = TILE.rate;
    out.push(h('div', { class: 'card tile rise', style: { '--i': 2 } },
      h('div', { class: 't-top' }, icon('spark'), 'המרה: מילאו ← נפתחה הזמנה', h('span', { style: { marginInlineStart: 'auto' } }, delta(r.v, r.y, 'rate'))),
      gaugeSvg({ a: r.v, b: r.strict }),
      h('div', { class: 'cmp', style: { gridTemplateColumns: '1fr auto' } }, h('span', {}, 'בהגדרה המחמירה (אושרה או שולמה)'), h('b', { class: 'num' }, pct(r.strict)), h('span', {}, 'ממוצע שבועי'), h('b', { class: 'num' }, pct(r.a)))));
    out.push(h('div', { class: 'card tile rise', style: { '--i': 3 } },
      h('div', { class: 't-top' }, icon('eye'), 'נכנסו לעמדה (ערוץ חנות)'),
      h('div', { class: 't-num num', style: { background: 'none', color: '#9fb3cc', '-webkit-text-fill-color': '#9fb3cc' } }, '—'),
      h('div', { class: 'cmp', style: { gridTemplateColumns: '1fr' } }, h('span', {}, 'כניסות נמדדות רק בקישור הכללי'))));
    return out;
  }
  function tileC() {
    var out = [];
    [['eye', 'נכנסו לעמדה', TILE.visits, visits], ['user', 'מילאו פרטים', TILE.registered, registered]].forEach(function (d) {
      var t = d[2], mx = Math.max(t.v, t.y, t.a) * 1.05;
      out.push(h('div', { class: 'card tile rise', style: { '--i': out.length } },
        h('div', { class: 't-top' }, icon(d[0]), d[1]),
        countEl('div', 't-num', t.v),
        h('div', { class: 'cmpbar', role: 'img', 'aria-label': 'היום ' + fmt(t.v) + ', אתמול ' + fmt(t.y) + ', ממוצע שבועי ' + fmtAvg(t.a) },
          h('i', { 'data-w': (t.v / mx) * 100 + '%' }), h('u', { style: { insetInlineStart: (t.y / mx) * 100 + '%' }, title: 'אתמול' }), h('u', { style: { insetInlineStart: (t.a / mx) * 100 + '%', opacity: 0.45 }, title: 'ממוצע שבועי' })),
        h('div', { class: 'cmplab' }, h('span', {}, 'אתמול ' + fmt(t.y) + ' ׀ ממוצע ' + fmtAvg(t.a)), h('span', { class: 'dl' }, (t.v >= t.y ? '+' : '−') + fmtAvg(Math.abs(t.v - t.y)))),
        sparkBox('spark', 34, d[3], { stroke: 'var(--ink-2)', sw: 1.5, dot: 3, smooth: false })));
    });
    var r = TILE.rate;
    function line(lab, val, g) { return h('div', { style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px', alignItems: 'center', fontSize: '13px', color: 'var(--ink-3)' } }, h('span', {}, lab), h('b', { class: 'num', style: { color: 'var(--ink)', fontWeight: 500 } }, pct(val)), h('div', { class: 'cmpbar', style: { gridColumn: '1/-1', margin: '2px 0 6px' } }, h('i', { 'data-w': val * 100 + '%', style: g ? { background: 'var(--s2)' } : null }))); }
    out.push(h('div', { class: 'card tile rise', style: { '--i': 2 } },
      h('div', { class: 't-top' }, icon('spark'), 'המרה: מילאו ← נפתחה הזמנה'),
      countEl('div', 't-num', r.v * 100, 0, '%'),
      line('נפתחה הזמנה', r.v, false), line('אושרה או שולמה (מחמיר)', r.strict, true),
      h('div', { class: 't-row' }, h('span', { class: 'dl' }, (r.v >= r.y ? '+' : '−') + nf1.format(Math.abs(r.v - r.y) * 100) + ' נק׳ אחוז'), 'מאתמול · ממוצע שבועי ' + pct(r.a))));
    out.push(h('div', { class: 'card tile rise', style: { '--i': 3 } },
      h('div', { class: 't-top' }, icon('eye'), 'נכנסו לעמדה (ערוץ חנות)'),
      h('div', { class: 't-num num', style: { color: 'var(--ink-3)' } }, '—'),
      h('div', { class: 't-row' }, 'כניסות נמדדות רק בקישור הכללי')));
    return out;
  }

  /* ---------- משפך ---------- */
  function funnelData() {
    return STAGES.map(function (s) {
      var c = FUNNEL[s.key], pc = s.parent ? FUNNEL[s.parent] : null;
      return { key: s.key, label: s.label, parent: s.parent, parentLabel: s.parentLabel, count: c, fromParent: pc ? c / pc : null, fromVisits: s.key === 'visits' ? null : c / FUNNEL.visits };
    });
  }
  function funnelTip(node, s, cls) {
    tip(node, function () {
      var rows = [{ label: s.label, value: fmt(s.count), color: 'var(--gold-300)' }];
      if (s.fromParent != null) rows.push({ label: 'מתוך ' + s.parentLabel, value: pct(s.fromParent), color: '#7fb8e6' });
      if (s.fromVisits != null) rows.push({ label: 'מהנכנסים', value: pct(s.fromVisits), color: '#bcc2c8' });
      return { title: s.label, rows: rows };
    }, cls);
  }
  function funnelA(box) {
    var F = funnelData(), ul = h('ol', { class: 'a-funnel', 'aria-label': 'משפך ההמרה' });
    F.forEach(function (s, i) {
      if (i > 0) ul.appendChild(h('li', { class: 'a-conv', 'aria-hidden': 'true' }, h('span', { class: 'chip' }, arrow('down'), pct(s.fromParent) + ' מ' + s.parentLabel)));
      var row = h('li', { class: 'a-fr rise', style: { '--i': i }, tabindex: 0 },
        h('div', { class: 'a-fh' }, h('b', {}, s.label), countEl('span', 'v', s.count)),
        h('div', { class: 'a-track' }, h('span', { class: 'a-bar' + (s.key === 'approved' || s.key === 'opened' ? ' g' : ''), 'data-w': Math.max(2.5, (s.count / FUNNEL.visits) * 100) + '%' })));
      funnelTip(row, s, ''); ul.appendChild(row);
    });
    box.appendChild(ul);
  }
  function funnelC(box) {
    var F = funnelData(), ul = h('ol', { class: 'c-funnel', 'aria-label': 'משפך ההמרה' });
    F.forEach(function (s, i) {
      var li = h('li', { class: 'c-fr rise', style: { '--i': i }, tabindex: 0 },
        h('span', { class: 'n' }, s.label),
        h('span', { class: 'tr' }, h('i', { class: s.key === 'approved' || s.key === 'opened' ? 'g' : '', 'data-w': Math.max(1.5, (s.count / FUNNEL.visits) * 100) + '%' })),
        countEl('span', 'v', s.count),
        s.fromParent != null ? h('span', { class: 'p' }, h('b', {}, pct(s.fromParent)), ' מתוך ' + s.parentLabel + (s.parent !== 'visits' ? ' · ' : ' · '), h('b', {}, pct(s.fromVisits)), ' מהנכנסים') : h('span', { class: 'p' }, 'נקודת הפתיחה'));
      funnelTip(li, s, 'c'); ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  function funnelB(box, W) {
    var F = funnelData(), n = F.length, row = 46, gap = 28, H = n * row + (n - 1) * gap + 8, labW = Math.min(150, W * 0.34), ribW = W - labW - 8, cx = ribW / 2, maxHalf = ribW * 0.47, id = 'fb' + (++uid);
    var hw = F.map(function (s) { return maxHalf * (0.17 + 0.83 * (s.count / FUNNEL.visits)); });
    var svg = h('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': 'משפך ההמרה', style: { direction: 'ltr' } });
    var COLS = ['#8fc3ee', '#8fc3ee', '#8fc3ee', '#6ea8de', '#6ea8de', '#ecd481', '#e0b94f'];
    var defs = h('defs', {});
    F.forEach(function (s2, i) { if (i < n - 1) defs.appendChild(h('linearGradient', { id: id + 'j' + i, x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', 'stop-color': COLS[i], 'stop-opacity': 0.5 }), h('stop', { offset: '100%', 'stop-color': COLS[i + 1], 'stop-opacity': 0.32 }))); });
    svg.appendChild(defs);
    F.forEach(function (s, i) {
      var y = 4 + i * (row + gap);
      if (i < n - 1) {
        var y2 = y + row, y3 = y2 + gap, a = hw[i], b = hw[i + 1], m = (y2 + y3) / 2;
        svg.appendChild(h('path', { d: 'M' + (cx - a) + ',' + y2 + ' C' + (cx - a) + ',' + m + ' ' + (cx - b) + ',' + m + ' ' + (cx - b) + ',' + y3 + ' L' + (cx + b) + ',' + y3 + ' C' + (cx + b) + ',' + m + ' ' + (cx + a) + ',' + m + ' ' + (cx + a) + ',' + y2 + ' Z', fill: 'url(#' + id + 'j' + i + ')', class: 'fade' }));
      }
    });
    F.forEach(function (s, i) {
      var y = 4 + i * (row + gap), a = hw[i];
      var g = h('g', { class: 'rise', style: { '--i': i } });
      g.appendChild(h('rect', { x: cx - a, y: y, width: a * 2, height: row, rx: 14, fill: COLS[i] }));
      g.appendChild(h('rect', { x: cx - a, y: y, width: a * 2, height: row / 2, rx: 14, fill: '#fff', opacity: 0.1 }));
      g.appendChild(h('text', { x: cx, y: y + row / 2 + 7, 'text-anchor': 'middle', style: { fontSize: '20px', fontWeight: 600, fill: i < 3 ? '#0a2242' : '#0a2242' }, class: 'num' }, fmt(s.count)));
      g.appendChild(h('text', { x: W - 4, y: y + row / 2 + 5, 'text-anchor': 'end', style: { fontSize: '14px', fill: '#e8eef6' } }, s.label));
      if (i > 0) {
        var ty = y - gap / 2, label = pct(s.fromParent), tw = 18 + label.length * 8;
        var tag = h('g', { class: 'fade' }, h('rect', { x: cx - tw / 2, y: ty - 11, width: tw, height: 22, rx: 11, fill: '#0a2242', stroke: 'rgba(224,197,110,.7)' }), h('text', { x: cx, y: ty + 4, 'text-anchor': 'middle', style: { fontSize: '12.5px', fontWeight: 600, fill: '#e0c56e' }, class: 'num' }, label));
        g.appendChild(tag);
      }
      var hit = h('rect', { class: 'hit', x: 0, y: y - 4, width: W, height: row + 8, tabindex: 0, role: 'img', 'aria-label': s.label + ' ' + fmt(s.count) + (s.fromParent != null ? ', ' + pct(s.fromParent) + ' מתוך ' + s.parentLabel : '') });
      funnelTip(hit, s, 'b'); g.appendChild(hit); svg.appendChild(g);
    });
    box.appendChild(svg);
  }

  /* ---------- עמודות מקובצות ---------- */
  var SER = [{ key: 'registered', label: 'מילאו פרטים', vals: registered, cls: 'g' }, { key: 'opened', label: 'נפתחה הזמנה', vals: opened, cls: 'b' }];
  function colsTip(hit, i, cls) {
    tip(hit, function () { return { title: DAYS[i].title, rows: [{ label: 'מילאו פרטים', value: fmt(registered[i]), color: 'var(--s2)' }, { label: 'נפתחה הזמנה', value: fmt(opened[i]), color: 'var(--s1)' }, { label: 'אושרה או שולמה', value: fmt(approved[i]), color: 'var(--ink-3)' }] }; }, cls);
  }
  function columns(box, W, dir) {
    var Hh = 250, P = { t: 22, b: 32, l: 8, r: 34 }, pw = W - P.l - P.r, ph = Hh - P.t - P.b, sc = niceScale(Math.max.apply(null, registered)), id = 'cl' + (++uid);
    var n = DAYS.length, band = pw / n, y = function (v) { return P.t + ph - (v / sc.max) * ph; };
    var svg = h('svg', { width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh, role: 'group', 'aria-label': 'מילאו פרטים ונפתחה להן הזמנה בכל יום', style: { direction: 'ltr' } });
    var defs = h('defs', {},
      h('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', 'stop-color': dir === 'b' ? '#e0c56e' : 'var(--s2-hi)' }), h('stop', { offset: '100%', 'stop-color': dir === 'b' ? '#b8912f' : 'var(--s2)' })),
      h('linearGradient', { id: id + 'b', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', 'stop-color': dir === 'b' ? '#8fbcec' : 'var(--s1-hi)' }), h('stop', { offset: '100%', 'stop-color': dir === 'b' ? '#3f7fc4' : 'var(--s1)' })),
      h('linearGradient', { id: id + 'h', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', 'stop-color': dir === 'b' ? '#fff' : 'var(--s1)', 'stop-opacity': 0.12 }), h('stop', { offset: '100%', 'stop-color': dir === 'b' ? '#fff' : 'var(--s1)', 'stop-opacity': 0 })));
    svg.appendChild(defs);
    sc.ticks.forEach(function (t) {
      svg.appendChild(h('line', { x1: P.l, x2: P.l + pw, y1: y(t), y2: y(t), stroke: dir === 'b' ? 'rgba(255,255,255,.14)' : 'var(--line)', 'stroke-width': dir === 'c' ? 1 : 1.2, 'stroke-dasharray': dir === 'a' ? '3 5' : dir === 'c' ? '' : '2 4', opacity: dir === 'c' ? 0.7 : 1 }));
      svg.appendChild(h('text', { x: P.l + pw + 8, y: y(t) + 4, 'text-anchor': 'start', class: 'num' }, fmt(t)));
    });
    var bw = dir === 'c' ? 5 : dir === 'a' ? Math.min(11, band * 0.3) : Math.min(10, band * 0.3), gap = dir === 'c' ? 3 : 3;
    DAYS.forEach(function (d, i) {
      var bx = P.l + pw - (i + 1) * band, gx = bx + (band - (bw * 2 + gap)) / 2;
      var g = h('g', {});
      if (dir === 'a' || dir === 'b') g.appendChild(h('rect', { x: bx + 1, y: P.t, width: band - 2, height: ph, rx: dir === 'a' ? 12 : 6, fill: 'url(#' + id + 'h)', opacity: 0, class: 'hv' }));
      SER.forEach(function (s, si) {
        var v = s.vals[i]; if (!v) return;
        var x = gx + (1 - si) * (bw + gap), top = y(v), hgt = P.t + ph - top, r = dir === 'c' ? 1.5 : bw / 2;
        var dd = 'M' + x + ',' + (P.t + ph) + ' V' + (top + r) + ' Q' + x + ',' + top + ' ' + (x + r) + ',' + top + ' H' + (x + bw - r) + ' Q' + (x + bw) + ',' + top + ' ' + (x + bw) + ',' + (top + r) + ' V' + (P.t + ph) + ' Z';
        g.appendChild(h('path', { d: dd, fill: dir === 'c' ? (s.cls === 'g' ? 'var(--s2)' : 'var(--s1)') : 'url(#' + id + s.cls + ')', class: 'gcol col ' + s.cls + (dir === 'b' ? ' ' + (s.cls === 'g' ? 'glow' : 'glow-s1') : ''), style: { '--i': i } }));
        if (dir === 'c') void hgt;
      });
      if (i % (W < 420 ? 3 : W < 640 ? 2 : 1) === 0) g.appendChild(h('text', { x: bx + band / 2, y: Hh - 12, 'text-anchor': 'middle', style: { fontSize: '11px' } }, i === n - 1 ? 'היום' : d.label));
      var hit = h('rect', { class: 'hit', x: bx, y: P.t, width: band, height: ph, tabindex: 0, role: 'img', 'aria-label': d.title + ': מילאו פרטים ' + registered[i] + ', נפתחה הזמנה ' + opened[i] + ', אושרה או שולמה ' + approved[i] });
      hit.addEventListener('mouseenter', function () { var hv = g.querySelector('.hv'); if (hv) hv.setAttribute('opacity', 1); });
      hit.addEventListener('mouseleave', function () { var hv = g.querySelector('.hv'); if (hv) hv.setAttribute('opacity', 0); });
      colsTip(hit, i, dir === 'c' ? 'c' : dir === 'b' ? 'b' : '');
      g.appendChild(hit); svg.appendChild(g);
    });
    // תווית ישירה לשיא בלבד (לא מספר על כל עמודה)
    var pk = registered.indexOf(Math.max.apply(null, registered)), px = P.l + pw - (pk + 1) * band + band / 2;
    svg.appendChild(h('text', { x: px, y: y(registered[pk]) - 8, 'text-anchor': 'middle', style: { fontSize: '12px', fontWeight: 600, fill: dir === 'b' ? '#fff' : 'var(--ink)' }, class: 'num' }, 'שיא ' + registered[pk]));
    svg.appendChild(h('line', { x1: P.l, x2: P.l + pw, y1: P.t + ph, y2: P.t + ph, stroke: dir === 'b' ? 'rgba(255,255,255,.3)' : 'var(--line)' }));
    box.appendChild(svg);
  }

  /* ---------- קו מגמה ---------- */
  function lineChart(box, W, dir) {
    var Hh = 250, P = { t: 24, b: 32, l: 12, r: 40 }, pw = W - P.l - P.r, ph = Hh - P.t - P.b, id = 'ln' + (++uid), n = DAYS.length;
    var mx = Math.max.apply(null, rate.concat(prior).filter(function (v) { return v != null; })) * 100, sc = niceScale(mx * 1.12), step = pw / (n - 1);
    var X = function (i) { return P.l + pw - i * step; }, Y = function (v) { return P.t + ph - (v * 100 / sc.max) * ph; };
    var pts = rate.map(function (v, i) { return v == null ? null : { x: X(i), y: Y(v), i: i, v: v }; });
    var svg = h('svg', { width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh, role: 'group', 'aria-label': 'אחוז מהנכנסים שמילאו פרטים, בכל יום', style: { direction: 'ltr' } });
    var strokeFill = dir === 'b' ? 'url(#' + id + 's)' : dir === 'a' ? 'url(#' + id + 's)' : 'var(--s1)';
    svg.appendChild(h('defs', {},
      h('linearGradient', { id: id + 'a', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', 'stop-color': dir === 'a' ? 'var(--s1-hi)' : '#7fb8e6', 'stop-opacity': dir === 'a' ? 0.5 : 0.3 }), h('stop', { offset: '100%', 'stop-color': dir === 'a' ? 'var(--s1-hi)' : '#7fb8e6', 'stop-opacity': 0 })),
      h('linearGradient', { id: id + 's', gradientUnits: 'userSpaceOnUse', x1: P.l + pw, y1: 0, x2: P.l, y2: 0 }, h('stop', { offset: '0%', 'stop-color': dir === 'b' ? '#7fb8e6' : 'var(--s1-lo)' }), h('stop', { offset: '100%', 'stop-color': dir === 'b' ? '#e0c56e' : 'var(--s1-hi)' }))));
    sc.ticks.forEach(function (t) {
      var yy = P.t + ph - (t / sc.max) * ph;
      svg.appendChild(h('line', { x1: P.l, x2: P.l + pw, y1: yy, y2: yy, stroke: dir === 'b' ? 'rgba(255,255,255,.14)' : 'var(--line)', 'stroke-width': 1, 'stroke-dasharray': dir === 'a' ? '3 5' : dir === 'b' ? '2 4' : '', opacity: dir === 'c' ? 0.7 : 1 }));
      svg.appendChild(h('text', { x: P.l + pw + 8, y: yy + 4, 'text-anchor': 'start', class: 'num' }, fmt(t) + '%'));
    });
    var segs = segments(pts);
    if (dir === 'c') { // תקופה קודמת (מקווקו)
      var pp = prior.map(function (v, i) { return v == null ? null : { x: X(i), y: Y(v) }; });
      segments(pp).forEach(function (s) { if (s.length > 1) svg.appendChild(h('path', { d: 'M' + s.map(function (p) { return p.x + ',' + p.y; }).join(' L'), fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 1.25, 'stroke-dasharray': '3 4', opacity: 0.7 })); });
    }
    segs.forEach(function (s) {
      if (s.length < 2) return;
      var asc = s.slice().reverse(), d = dir === 'c' ? 'M' + asc.map(function (p) { return p.x + ',' + p.y; }).join(' L') : spline(asc);
      if (dir === 'a' || dir === 'b') svg.appendChild(h('path', { d: d + ' L' + asc[asc.length - 1].x + ',' + (P.t + ph) + ' L' + asc[0].x + ',' + (P.t + ph) + ' Z', fill: 'url(#' + id + 'a)', class: 'fade' }));
      svg.appendChild(h('path', { d: d, fill: 'none', stroke: strokeFill, 'stroke-width': dir === 'c' ? 1.75 : 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, class: 'draw' + (dir === 'b' ? ' glow' : '') }));
    });
    // נקודת סיום (היום = הנקודה השמאלית ביותר) + תווית
    var lastIdx = n - 1, lp = pts[lastIdx];
    if (lp) {
      if (dir !== 'c') svg.appendChild(h('circle', { cx: lp.x, cy: lp.y, r: 6, fill: dir === 'b' ? '#e0c56e' : 'var(--s1)', opacity: 0.5, class: 'pulse' }));
      svg.appendChild(h('circle', { cx: lp.x, cy: lp.y, r: dir === 'c' ? 3.5 : 5, fill: dir === 'b' ? '#e0c56e' : dir === 'a' ? 'var(--s1)' : 'var(--s1)', stroke: dir === 'b' ? '#0f2c52' : 'var(--surface)', 'stroke-width': 2.5 }));
      svg.appendChild(h('text', { x: lp.x + 10, y: lp.y - 10, 'text-anchor': dir === 'c' ? 'start' : 'start', style: { fontSize: '12.5px', fontWeight: 600, fill: dir === 'b' ? '#fff' : 'var(--ink)' }, class: 'num' }, 'היום ' + pct(lp.v)));
    }
    if (dir === 'a') { // הדגשת השיא
      var best = pts.filter(Boolean).sort(function (a, b) { return b.v - a.v; })[0];
      svg.appendChild(h('g', { class: 'fade' }, h('rect', { x: best.x - 34, y: best.y - 34, width: 68, height: 22, rx: 11, fill: 'var(--surface)', stroke: 'var(--line)' }), h('text', { x: best.x, y: best.y - 19, 'text-anchor': 'middle', style: { fontSize: '12px', fontWeight: 600, fill: 'var(--ink)' }, class: 'num' }, 'שיא ' + pct(best.v))));
    }
    var cross = h('line', { y1: P.t, y2: P.t + ph, stroke: dir === 'b' ? 'rgba(255,255,255,.4)' : 'var(--ink-3)', 'stroke-dasharray': '3 4', opacity: 0 });
    var halo = h('circle', { r: 8, fill: 'none', stroke: dir === 'b' ? '#e0c56e' : 'var(--s1)', 'stroke-width': 2, opacity: 0 });
    svg.appendChild(cross); svg.appendChild(halo);
    DAYS.forEach(function (d, i) {
      if (i % (W < 420 ? 3 : W < 640 ? 2 : 1) === 0) svg.appendChild(h('text', { x: X(i), y: Hh - 12, 'text-anchor': 'middle', style: { fontSize: '11px' } }, i === n - 1 ? 'היום' : d.label));
      var hit = h('rect', { class: 'hit', x: X(i) - step / 2, y: P.t, width: step, height: ph, tabindex: 0, role: 'img', 'aria-label': d.title + ': ' + (rate[i] == null ? 'אין כניסות' : 'מילאו פרטים ' + pct(rate[i])) });
      hit.addEventListener('mouseenter', function () { cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('opacity', 1); if (pts[i]) { halo.setAttribute('cx', pts[i].x); halo.setAttribute('cy', pts[i].y); halo.setAttribute('opacity', 1); } });
      hit.addEventListener('mouseleave', function () { cross.setAttribute('opacity', 0); halo.setAttribute('opacity', 0); });
      tip(hit, function () { var rows = [{ label: 'מילאו פרטים מתוך הנכנסים', value: rate[i] == null ? 'אין כניסות' : pct(rate[i]), color: dir === 'b' ? '#e0c56e' : 'var(--s1)' }]; if (dir === 'c' && prior[i] != null) rows.push({ label: 'תקופה קודמת', value: pct(prior[i]), color: 'var(--ink-3)' }); return { title: d.title, rows: rows }; }, dir === 'c' ? 'c' : dir === 'b' ? 'b' : '');
      svg.appendChild(hit);
    });
    svg.appendChild(h('line', { x1: P.l, x2: P.l + pw, y1: P.t + ph, y2: P.t + ph, stroke: dir === 'b' ? 'rgba(255,255,255,.3)' : 'var(--line)' }));
    box.appendChild(svg);
  }

  /* ---------- כרטיסים עם מתג טבלה ---------- */
  function table(cols, rows, cap) { return h('div', { class: 'alt' }, h('table', {}, h('caption', { class: 'sr-only' }, cap), h('thead', {}, h('tr', {}, cols.map(function (c) { return h('th', { scope: 'col' }, c); }))), h('tbody', {}, rows.map(function (r) { return h('tr', {}, r.map(function (c) { return h('td', { class: 'num' }, c); })); })))); }
  function card(title, sub, vizNode, alt, legend) {
    var c = h('div', { class: 'card' });
    var btn = h('button', { type: 'button', class: 'tbtn', 'aria-pressed': 'false' }, 'טבלה');
    btn.addEventListener('click', function () { var on = c.classList.toggle('show-table'); btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'גרף' : 'טבלה'; });
    c.appendChild(h('div', { class: 'card-h' }, h('b', {}, title), sub ? h('small', {}, sub) : null, btn));
    if (legend) c.appendChild(h('ul', { class: 'legend', 'aria-label': 'מקרא' }, h('li', {}, h('i', { class: 'key k2' }), 'מילאו פרטים'), h('li', {}, h('i', { class: 'key k1' }), 'נפתחה הזמנה')));
    c.appendChild(h('div', { class: 'viz' }, vizNode)); c.appendChild(alt); return c;
  }
  var FUN_ALT = function () { var F = funnelData(); return table(['שלב', 'כמה', 'מתוך השלב הקודם', 'מהנכנסים'], F.map(function (s) { return [s.label, fmt(s.count), s.fromParent == null ? '—' : pct(s.fromParent) + ' מ' + s.parentLabel, s.fromVisits == null ? '—' : pct(s.fromVisits)]; }), 'משפך ההמרה'); };
  var COL_ALT = function () { return table(['יום', 'מילאו פרטים', 'נפתחה הזמנה', 'אושרה או שולמה'], DAYS.map(function (d, i) { return [d.title, registered[i], opened[i], approved[i]]; }).reverse(), 'נתונים יומיים'); };
  var LINE_ALT = function () { return table(['יום', 'אחוז שמילאו פרטים', 'תקופה קודמת'], DAYS.map(function (d, i) { return [d.title, rate[i] == null ? '—' : pct(rate[i]), prior[i] == null ? '—' : pct(prior[i])]; }).reverse(), 'אחוז מהנכנסים שמילאו פרטים'); };

  function buildDir(root, dir) {
    var tiles = h('div', { class: 'tiles' }, dir === 'a' ? tileA() : dir === 'b' ? tileB() : tileC());
    var fbox = h('div', { class: 'chart' }), cbox = h('div', { class: 'chart' }), lbox = h('div', { class: 'chart' });
    root.appendChild(tiles);
    var grid = h('div', { class: 'grid', style: { marginTop: '16px' } },
      card('משפך ההמרה', 'נתוני דמה · חלון המרה 14 ימים', fbox, FUN_ALT()),
      card('מילאו פרטים ונפתחה להן הזמנה בכל יום', 'נתוני דמה · 14 ימים · הציר מימין לשמאל', cbox, COL_ALT(), true),
      card('אחוז מהנכנסים שמילאו פרטים', dir === 'c' ? 'הקו המקווקו: התקופה הקודמת' : 'ימים 3 ו-8 בלי כניסות: רווח בקו', lbox, LINE_ALT()));
    root.appendChild(grid);
    mount(fbox, function (b, w) { if (dir === 'a') funnelA(b); else if (dir === 'c') funnelC(b); else funnelB(b, w); });
    mount(cbox, function (b, w) { columns(b, w, dir); });
    mount(lbox, function (b, w) { lineChart(b, w, dir); });
  }

  /* ---------- תנועה ---------- */
  function countUp(root) {
    root.querySelectorAll('[data-count]').forEach(function (e) {
      var to = parseFloat(e.getAttribute('data-count')), dec = +e.getAttribute('data-dec') || 0, suf = e.getAttribute('data-suf') || '';
      var f = function (v) { return (dec ? nf1.format(v) : fmt(v)) + suf; };
      if (e._cu) clearInterval(e._cu);
      if (RM) { e.textContent = f(to); return; }
      var t0 = Date.now(); e.textContent = f(0);
      e._cu = setInterval(function () { var k = Math.min(1, (Date.now() - t0) / 900), v = to * (1 - Math.pow(1 - k, 3)); e.textContent = f(v); if (k >= 1) { clearInterval(e._cu); e.textContent = f(to); } }, 30);
    });
  }
  function armWidths(root) {
    var els = root.querySelectorAll('[data-w]'), rings = root.querySelectorAll('[data-ring]');
    if (!RM) {
      els.forEach(function (e) { e.style.transition = 'none'; e.style.width = '0'; });
      rings.forEach(function (e) { e.style.transition = 'none'; e.setAttribute('stroke-dashoffset', e.getAttribute('data-c')); });
    }
    setTimeout(function () {
      els.forEach(function (e) { e.style.transition = ''; e.style.width = e.getAttribute('data-w'); });
      rings.forEach(function (e) { e.style.transition = ''; e.setAttribute('stroke-dashoffset', e.getAttribute('data-ring')); });
    }, RM ? 0 : 60);
  }
  function replay(sec) { sec.classList.remove('anim'); void sec.offsetWidth; sec.classList.add('anim'); armWidths(sec); countUp(sec); }

  /* ---------- אתחול ---------- */
  var secs = Array.prototype.slice.call(document.querySelectorAll('[data-dir]'));
  secs.forEach(function (s) { buildDir(s.querySelector('.dir-body'), s.getAttribute('data-dir')); });
  if (window.IntersectionObserver && !RM) {
    var seen = new Set();
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !seen.has(e.target)) { seen.add(e.target); replay(e.target); } }); }, { threshold: 0.12 });
    secs.forEach(function (s) { io.observe(s); });
  } else secs.forEach(function (s) { s.classList.add('anim'); armWidths(s); countUp(s); });
  document.getElementById('replay').addEventListener('click', function () { secs.forEach(replay); });

  var root = document.documentElement;
  function setTheme(t) { root.setAttribute('data-theme', t); document.querySelectorAll('[data-theme-btn]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-btn') === t)); }); }
  document.querySelectorAll('[data-theme-btn]').forEach(function (b) { b.addEventListener('click', function () { setTheme(b.getAttribute('data-theme-btn')); }); });
  setTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  /* בחירת כיוון */
  var NAMES = { a: 'כיוון A (ענן: גרדיאנטים רכים)', b: 'כיוון B (זרימה: סרטים על לוח נייבי)', c: 'כיוון C (מינימליזם)' };
  var chosen = document.getElementById('chosen'), msg = document.getElementById('chosen-msg');
  function choose(v, save) {
    chosen.classList.add('on'); msg.textContent = 'בחרתי ' + NAMES[v]; document.querySelectorAll('input[name=dir]').forEach(function (r) { r.checked = r.value === v; });
    if (save) { try { localStorage.setItem('graphs3-choice', v); } catch (e) { /* */ } }
  }
  document.querySelectorAll('input[name=dir]').forEach(function (r) { r.addEventListener('change', function () { choose(r.value, true); }); });
  try { var sv = localStorage.getItem('graphs3-choice'); if (sv && NAMES[sv]) choose(sv, false); } catch (e) { /* */ }
  document.getElementById('copy').addEventListener('click', function () {
    var txt = msg.textContent, done = function () { document.getElementById('copy').textContent = 'הועתק'; setTimeout(function () { document.getElementById('copy').textContent = 'העתקת הבחירה'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done); else { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* */ } ta.remove(); done(); }
  });
})();
