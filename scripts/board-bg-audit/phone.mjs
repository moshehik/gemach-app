// שלב הטלפון של הלוח החודשי (החלטת הבעלים 5.10.2026, "ותקן לטלפון"): הלוח האמיתי (API מדומה מ-entry.jsx) ברוחב 375 / 390 / 320 עם
// הצהרות מפורשות - בלי גלילה אופקית, התאריך העברי בשורה אחת (גם במחרוזת הארוכה ביותר שיש בשנה), המונים בשורה השנייה בתוך
// השורה בלי גלישה / חיתוך, אזורי מגע >=44px, לוחית היום מוקטנת, RTL (לוחית בימין, חץ בשמאל, המונה הראשון בימין), מסגרת
// האיחור האדומה ומסגרת היום הזהובה על השורה, כותרת הדף / שורת החיפוש / סרגל / ניווט חודשים / חלונית הסינון, ותצוגת הלוח (גריד).
// שימוש: node scripts/board-bg-audit/phone.mjs [רוחב,רוחב,...] [תיקיית צילומים]   (אחרי build.mjs). יוצא 1 בכישלון.
import { serve, launch, sleep, PORT } from './lib.mjs';
const widths = (process.argv[2] || '375,390,320').split(',').map(Number);
const shots = process.argv[3] || '';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const s = await serve();
const b = await launch(); const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
const WORST = 'יום חמישי · יח אדר א\' תשפ"ז'; // המחרוזת הארוכה ביותר של כותרת שורה בשנה (נמדדה על 14 חודשים)
const click = async (sel) => { await p.$eval(sel, (e) => e.scrollIntoView({ block: 'center' })); await sleep(120); await p.click(sel); await sleep(350); };
const shot = async (w, name) => { if (shots) { await sleep(300); await p.screenshot({ path: `${shots}/ph-${w}-${name}.png`, fullPage: true }); } };
// כלי מדידה בדף: אין אלמנט נראה שחורג מהמסך (למעט שכבות סגורות / מחוץ למסך בכוונה)
const overflow = () => p.evaluate(() => {
  const iw = document.documentElement.clientWidth;
  const bad = [...document.querySelectorAll('#root *')].filter((e) => {
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || e.closest('.hf-p,.hf-scrim,.pl-tt,.vknob')) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.right > iw + 0.5 || r.left < -0.5);
  });
  return { sw: document.documentElement.scrollWidth, bsw: document.body.scrollWidth, iw, bad: bad.slice(0, 5).map((e) => e.tagName + '.' + String(e.className).slice(0, 30)) };
});
const noOverflow = async (label) => { const o = await overflow(); ok(o.sw <= o.iw && o.bsw <= o.iw && !o.bad.length, label + ': בלי גלילה אופקית ובלי אלמנט שחורג (scrollWidth ' + o.sw + ' / ' + o.iw + (o.bad.length ? ', חורגים: ' + o.bad.join(',') : '') + ')'); };

for (const w of widths) {
  console.log('\n--- ' + w + 'px ---');
  await p.setViewport({ width: w, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' }); await sleep(1600);
  ok(await p.evaluate(() => !!document.querySelector('.bd-lcard') && !document.querySelector('.lz-hc .hc-g.lz-g')), w + ': בטלפון הלוח עובר אוטומטית לתצוגת רשימה');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.bd-app')).direction === 'rtl' && !!document.querySelector('[dir=rtl]')), w + ': RTL');
  await noOverflow(w + ' רשימה');
  await shot(w, '01-list');

  // ---- שורות הרשימה ----
  const rows = await p.evaluate((WORST) => {
    const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
    const rowEls = [...document.querySelectorAll('.bd-lrow')];
    return rowEls.map((row) => {
      const title = row.querySelector('.t b'); const lh = parseFloat(getComputedStyle(title).lineHeight);
      const lc = row.querySelector('.bd-lc'); const tile = row.querySelector('.ic-b'); const go = row.querySelector('.go'); const t = row.querySelector('.t');
      return {
        d: row.getAttribute('data-d'), row: R(row), tile: R(tile), t: R(t), go: R(go), lc: lc ? R(lc) : null,
        lines: Math.round(title.getBoundingClientRect().height / lh), titleClip: title.scrollWidth > title.clientWidth + 1,
        prs: lc ? [...lc.querySelectorAll('.lz-pr')].map(R) : [], lcClip: lc ? lc.scrollWidth > lc.clientWidth + 1 : false, rowClip: row.scrollWidth > row.clientWidth + 1,
        fs: getComputedStyle(title).fontSize,
      };
    });
  }, WORST);
  ok(rows.length > 5, w + ': יש שורות ברשימה (' + rows.length + ')');
  ok(rows.every((r) => r.lines === 1 && !r.titleClip), w + ': התאריך העברי בשורה אחת בכל השורות (גופן ' + rows[0].fs + ')');
  // המחרוזת הארוכה ביותר + שורת משנה ארוכה (פרשה/חג) - הזרקה לשורה הראשונה
  const worst = await p.evaluate((WORST) => {
    const row = document.querySelector('.bd-lrow'); const b = row.querySelector('.t b'); const old = b.textContent; b.textContent = WORST;
    const lh = parseFloat(getComputedStyle(b).lineHeight);
    const o = { lines: Math.round(b.getBoundingClientRect().height / lh), clip: b.scrollWidth > b.clientWidth + 1, w: b.scrollWidth, avail: b.clientWidth };
    b.textContent = old; return o;
  }, WORST);
  ok(worst.lines === 1 && !worst.clip, w + ': גם התאריך הארוך ביותר ("' + WORST + '") בשורה אחת (' + worst.w + '/' + worst.avail + 'px)');
  const tileMax = rows.every((r) => r.tile.w <= 56 && r.tile.h <= 44);
  ok(tileMax, w + ': לוחית היום מוקטנת (' + Math.round(rows[0].tile.w) + 'x' + Math.round(rows[0].tile.h) + ' במקום 75x48)');
  ok(rows.every((r) => r.row.h >= 44 && r.rowClip === false), w + ': כל שורה >=44px גובה ובלי חיתוך (מינימום ' + Math.round(Math.min(...rows.map((r) => r.row.h))) + 'px)');
  const withLc = rows.filter((r) => r.lc);
  ok(withLc.length > 5 && withLc.every((r) => r.lc.t >= r.t.t + 10 && r.lc.t >= r.tile.b - 1 && r.lc.b <= r.row.b + 0.5), w + ': המונים בשורה שנייה בתוך השורה, מתחת לכותרת');
  ok(withLc.every((r) => !r.lcClip && r.prs.every((q) => q.l >= r.row.l - 0.5 && q.r <= r.row.r + 0.5 && q.b <= r.row.b + 0.5 && q.t >= r.row.t)), w + ': כל המונים בתוך גבולות השורה - בלי גלישה ובלי חיתוך');
  ok(withLc.every((r) => r.prs.length && Math.abs(r.prs[0].r - (r.row.r - 10)) < 3), w + ': RTL - המונה הראשון בצד הימני של השורה');
  ok(rows.every((r) => r.tile.l > r.t.r - 1 && r.go.r < r.t.l + 1 && r.tile.r <= r.row.r + 0.5 && r.go.l >= r.row.l - 0.5), w + ': RTL - לוחית בימין, כותרת באמצע, חץ בשמאל');
  // מסגרות: איחור (אדום) והיום (זהב) - נבדקות על שורה אמיתית, והיום גם בהזרקה (כי ביום מסוים אין לו מונים במדומה)
  const frames = await p.evaluate(() => {
    const col = (v) => { const e = document.createElement('i'); e.style.color = 'var(' + v + ')'; document.querySelector('.bd-app').appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    const red = col('--red'), gold = col('--gold');
    const late = document.querySelector('.bd-lrow.bd-latecell');
    const row = [...document.querySelectorAll('.bd-lrow:not(.bd-latecell)')][1];
    const both = row.cloneNode(true); both.classList.add('bd-latecell', 'bd-ltoday'); row.parentNode.appendChild(both);
    const today = row.cloneNode(true); today.classList.add('bd-ltoday'); row.parentNode.appendChild(today);
    const bs = (e) => getComputedStyle(e).boxShadow; const out = { red, gold, late: late ? bs(late) : null, both: bs(both), today: bs(today), alMark: late ? !!late.querySelector('.lz-al') : false, lateInside: null };
    const r = both.getBoundingClientRect(); out.bothFits = r.right <= document.documentElement.clientWidth + 0.5 && r.left >= -0.5;
    both.remove(); today.remove(); return out;
  });
  ok(!!frames.late && frames.late.includes(frames.red) && frames.alMark, w + ': שורת איחור - מסגרת אדומה + סימן התראה');
  ok(frames.today.includes(frames.gold) && !frames.today.includes(frames.red), w + ': שורת היום - מסגרת זהב');
  ok(frames.both.includes(frames.red) && frames.both.includes(frames.gold) && frames.bothFits, w + ': היום + איחור - אדום בחוץ וזהב בפנים, בלי גלישה');

  // ---- כותרת הדף, חיפוש, סרגל, ניווט חודשים ----
  const top = await p.evaluate(() => {
    const R = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
    const hs = R('.hf-s'); const input = document.querySelector('#bdQ');
    return { ttl: R('.topbar'), pg: R('.pg-ttl'), hs, hft: R('.hf-t'), input: R('#bdQ'), bar: R('#mBar'), vsw: R('#mvsw'), opts: [...document.querySelectorAll('#mvsw .vopt')].map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; }), head: R('.bd-lcard > .hc-h'), prev: R('.bd-lcard .hc-h > .hc-n'), next: R('.bd-lcard .hc-h > .hc-nn'), jump: R('.bd-lcard .lz-jump'), pgClip: document.querySelector('.pg-ttl').scrollWidth > document.querySelector('.pg-ttl').clientWidth + 1, ph: input.getAttribute('placeholder'), inputClip: input.scrollWidth > input.clientWidth + 1, today: !!document.querySelector('#mToday') };
  });
  ok(top.ttl && top.ttl.r <= w && top.ttl.l >= 0 && !top.pgClip, w + ': כותרת הדף בתוך המסך');
  ok(top.hs.w >= w - 40 && top.hs.h >= 44 && top.hft.h >= 44 && top.hft.w >= 44 && top.hft.r <= top.hs.r + 0.5 && top.hft.l >= top.hs.l - 0.5, w + ': שורת החיפוש ולחצן הסינון בתוך השורה, >=44px (' + Math.round(top.hs.w) + 'x' + Math.round(top.hs.h) + ', לחצן ' + Math.round(top.hft.w) + 'x' + Math.round(top.hft.h) + ')');
  ok(top.opts.length === 2 && top.opts.every((o) => o.h >= 44 && o.w >= 44) && top.vsw.r <= w && top.vsw.h >= 44, w + ': מתג התצוגה >=44px (כל לחצן ' + Math.round(top.opts[0].w) + 'x' + Math.round(top.opts[0].h) + ')');
  ok(top.head.r <= w && top.prev.w >= 44 && top.prev.h >= 44 && top.next.w >= 44 && top.next.h >= 44 && top.jump.h >= 44, w + ': ניווט חודשים - חצים ושם החודש >=44px');
  ok(top.prev.l > top.jump.r - 1 && top.next.r < top.jump.l + 1 && top.prev.l >= top.head.l && top.next.r <= top.head.r, w + ': RTL - "הקודם" בימין, "הבא" בשמאל, שם החודש ביניהם בלי חפיפה');
  ok(top.today === false, w + ': בחודש הנוכחי "החודש הנוכחי" מוסתר');
  // חודש אחר: "החודש הנוכחי" מופיע, >=44px, בלי גלישה
  await click('.bd-lcard .hc-h > .hc-nn');
  const tb = await p.evaluate(() => { const e = document.querySelector('#mToday'); if (!e) return null; const r = e.getBoundingClientRect(); const v = document.querySelector('#mvsw').getBoundingClientRect(); const bar = document.querySelector('#mBar').getBoundingClientRect(); return { h: r.height, w: r.width, l: r.left, r: r.right, vl: v.left, vr: v.right, bl: bar.left, br: bar.right, clip: e.scrollWidth > e.clientWidth + 1 }; });
  ok(!!tb && tb.h >= 44 && tb.r <= w && tb.l >= 0 && !tb.clip && (tb.l >= tb.vr - 1 || tb.r <= tb.vl + 1), w + ': בחודש אחר "החודש הנוכחי" מוצג, >=44px, לא חופף למתג' + (tb ? ' (' + Math.round(tb.w) + 'x' + Math.round(tb.h) + ')' : ''));
  await noOverflow(w + ' חודש הבא');
  await shot(w, '02-next-month');
  await click('#mToday'); await sleep(300);
  ok(!(await p.$('#mToday')), w + ': "החודש הנוכחי" מחזיר לחודש הנוכחי ונעלם');

  // ---- בורר החודשים ----
  await click('.bd-lcard .lz-jump');
  const mp = await p.evaluate(() => { const e = document.querySelector('.bd-mp'); if (!e) return null; const r = e.getBoundingClientRect(); const ds = [...e.querySelectorAll('.bd-mpd')].map((x) => x.getBoundingClientRect()); return { l: r.left, r: r.right, t: r.top, b: r.bottom, n: ds.length, minH: Math.min(...ds.map((x) => x.height)), inside: ds.every((x) => x.left >= r.left - 0.5 && x.right <= r.right + 0.5), ih: innerHeight }; });
  ok(!!mp && mp.n === 13 && mp.l >= 0 && mp.r <= w && mp.minH >= 44 && mp.inside, w + ': בורר החודשים בתוך המסך, 13 חודשים, כל תא >=44px' + (mp ? ' (' + JSON.stringify(mp) + ')' : ''));
  await shot(w, '03-month-picker');
  await p.keyboard.press('Escape'); await sleep(250);

  // ---- חלונית הסינון (גיליון תחתון בטלפון) ----
  await click('#bdSearch .hf-t');
  const fp = await p.evaluate(() => {
    const e = document.querySelector('#bdSearch .hf-p'); const r = e.getBoundingClientRect();
    const os = [...e.querySelectorAll('.hf-o')].map((x) => x.getBoundingClientRect()); const all = e.querySelector('.hf-allb').getBoundingClientRect();
    const l = e.querySelector('.hf-l');
    return { l: r.left, r: r.right, t: r.top, b: r.bottom, ih: innerHeight, n: os.length, minH: Math.min(...os.map((x) => x.height)), inside: os.every((x) => x.left >= r.left - 0.5 && x.right <= r.right + 0.5), allH: all.height, scroll: l.scrollHeight > l.clientHeight, vis: getComputedStyle(e).visibility };
  });
  ok(fp.vis === 'visible' && fp.l >= 0 && fp.r <= w && fp.b <= fp.ih + 0.5 && fp.t >= 0 && fp.n >= 6 && fp.inside, w + ': חלונית הסינון = גיליון תחתון בתוך המסך (' + Math.round(fp.r - fp.l) + 'px, ' + fp.n + ' אפשרויות)');
  ok(fp.minH >= 44 && fp.allH >= 44, w + ': אפשרויות הסינון ו"הצג הכל" >=44px (מינימום ' + Math.round(fp.minH) + ')');
  await shot(w, '04-filter-open');
  await click('#bdSearch .hf-o:nth-child(2)'); await click('#bdSearch .hf-o:nth-child(3)');
  await p.keyboard.press('Escape'); await p.mouse.click(Math.floor(w / 2), 30); await sleep(350);
  const pills = await p.evaluate(() => { const ps = [...document.querySelectorAll('#bdSearch .hf-pill')].map((e) => e.getBoundingClientRect()); const bar = document.querySelector('#bdSearch').getBoundingClientRect(); return { n: ps.length, minH: Math.min(...ps.map((x) => x.height)), inside: ps.every((x) => x.right <= innerWidth + 0.5 && x.left >= -0.5 && x.right <= bar.right + 0.5) }; });
  ok(pills.n >= 1 && pills.minH >= 44 && pills.inside, w + ': תגיות הסינון שנבחרו >=44px ובתוך המסך (' + pills.n + ')');
  await noOverflow(w + ' עם סינון');
  await shot(w, '05-filtered');
  await click('#bdSearch .hf-t'); await click('#bdSearch .hf-allb'); await p.keyboard.press('Escape'); await p.mouse.click(Math.floor(w / 2), 30); await sleep(300);

  // ---- שורת חיפוש עם טקסט: לחצן הניקוי ----
  await p.type('#bdQ', 'כהן'); await sleep(250);
  const cl = await p.evaluate(() => { const e = document.querySelector('#bdSearch .hf-cl'); const r = e.getBoundingClientRect(); const s = document.querySelector('#bdSearch .hf-s').getBoundingClientRect(); const i = document.querySelector('#bdQ').getBoundingClientRect(); return { w: r.width, h: r.height, inside: r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom, iw: i.width }; });
  ok(cl.w >= 44 && cl.h >= 44 && cl.inside && cl.iw > 80, w + ': לחצן ניקוי החיפוש >=44px בתוך השורה, ונשאר שדה (' + Math.round(cl.iw) + 'px)');
  await p.evaluate(() => document.querySelector('#bdSearch .hf-cl').click()); await sleep(300);

  // ---- תצוגת הלוח (גריד) בטלפון ----
  await click('#mvsw .vopt:nth-child(2)');
  await noOverflow(w + ' גריד');
  const gr = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('.lz-day')]; const iw = document.documentElement.clientWidth;
    const bad = cells.filter((c) => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll('*')].some((x) => { const q = x.getBoundingClientRect(); return q.width && (q.right > r.right + 0.5 || q.left < r.left - 0.5 || q.bottom > r.bottom + 0.5); }); });
    const c0 = cells[3].getBoundingClientRect(); const lt = document.querySelector('.lz-day .lz-dh b');
    const pr = [...document.querySelectorAll('.lz-day .lz-pr')].map((e) => ({ clip: e.scrollWidth > e.clientWidth + 1, w: e.getBoundingClientRect().width, fs: parseFloat(getComputedStyle(e).fontSize) }));
    const sh = getComputedStyle(document.querySelector('.lz-day.bd-latecell') || cells[0]).boxShadow;
    return { n: cells.length, cw: c0.width, ch: c0.height, bad: bad.length, ltFs: parseFloat(getComputedStyle(lt).fontSize), prClip: pr.filter((x) => x.clip).length, prMinW: Math.min(...pr.map((x) => x.w)), prFs: Math.min(...pr.map((x) => x.fs)), late: sh, hc: document.querySelector('.lz-hc').getBoundingClientRect().right <= iw + 0.5, hint: !!document.querySelector('.lz-day .lz-pr') };
  });
  ok(gr.n >= 28 && gr.hc && gr.bad === 0, w + ': גריד - כל תא נשאר בתוך גבולותיו, בלי גלישה (' + gr.n + ' תאים, ' + Math.round(gr.cw) + 'x' + Math.round(gr.ch) + ')');
  ok(gr.prClip === 0 && gr.prFs >= 11 && gr.ltFs >= 14, w + ': גריד - המונים והאותיות קריאים בלי חיתוך (מונה ' + Math.round(gr.prMinW) + 'px, גופן ' + gr.prFs + ', אות ' + gr.ltFs + ')');
  ok(/rgb/.test(gr.late), w + ': גריד - מסגרת תא (איחור/היום) קיימת');
  await shot(w, '06-grid');
  await click('#mvsw .vopt:nth-child(3)');
}
ok(errs.length === 0, 'אין שגיאות קונסול / pageerror' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close(); s.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
