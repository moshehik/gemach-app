// pkCore.js - הליבה הטהורה (בלי DOM, בלי React, בלי alias) של דפי ההדפסה / ה-PDF המעוצבים. פורט של scratch/emp-models-build/print-kit.js:
//   shell(o, ctx)        גיליון A4 אחד (כותרת אחידה: שם הגמ"ח + תאריך עברי ולועזי, שורת כותרת, כותרת תחתונה "עמוד X מתוך Y")
//   table(id, cols)      אטומים של טבלה (שורה / כותרת קבוצה / שורת סיכום) שכותרת הטבלה שלה חוזרת בכל גיליון
//   paginate(atoms, ad)  מנוע העימוד: מחלק אטומים לגיליונות לפי מדידה אמיתית (ה-adapter), לא לפי ספירת שורות. הגיליון עצמו נבנה ב-adapter
//   filterLine(...)      השורה האחת שמתארת את החיפוש / הסינון הפעיל (ריקה כשאין)
//   bc / bcCell          ברקוד Code 39 כ-SVG (תמיד שחור)
// כללי העיצוב (בעיצוב המאושר): תאריכים בכותרת עבריים + לועזיים, תאריכים בנתונים עבריים בלבד (המתקשר מעביר hDateFull), בלי משתני CSS של ערכת הנושא.
// ctx = { gm: { name, addr, phone }, dateLine, greg, time, who } - נבנה פעם אחת בפתיחה (openPrintPreview.js); בבדיקות - ערכים קבועים.

export const MM = 96 / 25.4; // פיקסלים למילימטר (CSS)

export const escH = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Code 39 (SVG טהור, מידות במ"מ, שחור תמיד) ---------- */
const C39 = {
  0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw', 5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
};
export function bc(text, h, u) {
  const unit = u || 0.2;
  const s = `*${String(text).toUpperCase()}*`;
  let x = 0;
  let r = '';
  for (let i = 0; i < s.length; i++) {
    const p = C39[s[i]];
    if (!p) continue;
    for (let j = 0; j < 9; j++) {
      const w = (p[j] === 'w' ? 3 : 1) * unit;
      if (j % 2 === 0) r += `<rect x="${x.toFixed(3)}" y="0" width="${w.toFixed(3)}" height="${h}"/>`;
      x += w;
    }
    x += unit;
  }
  const W = +(x - unit).toFixed(3);
  return `<svg class="pk-bars" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}mm" height="${h}mm" fill="#000" shape-rendering="crispEdges" role="img" aria-label="ברקוד ${escH(text)}">${r}</svg>`;
}
/** ברקוד עם המספר מתחתיו, לתא בטבלה */
export const bcCell = (code) => `${bc(code, 6, 0.19)}<small>${escH(code)}</small>`;

/* ---------- גיליון אחד ---------- */
/** o = { title, sub?, sum?, chip?, barcode?, slim?, body?, pn?, tone? }; ctx = ראו למעלה. __N__ מוחלף ב-fixN אחרי שסופר מספר הגיליונות. */
export function shell(o, ctx) {
  const gm = (ctx && ctx.gm) || {};
  const code = o.barcode;
  const b = code ? `<div class="pk-bc">${bc(code, o.slim ? 6.5 : 8.5, 0.2)}<small>${escH(code)}</small></div>` : '';
  const addr = [gm.addr, gm.phone].filter(Boolean).map(escH).join(' · ');
  const who = ctx && ctx.who ? ` · הדפיסה: ${escH(ctx.who)}` : '';
  return `<section class="pk-sheet${o.slim ? ' slim' : ''}" data-tone="${o.tone || 'bw'}">`
    + `<div class="pk-head"><div class="pk-id"><div class="pk-bsd">בס״ד</div><b>${escH(gm.name || '')}</b>${addr ? `<span>${addr}</span>` : ''}</div>`
    + `<div class="pk-meta"><div class="pk-date">${escH((ctx && ctx.dateLine) || '')}<small>${escH((ctx && ctx.greg) || '')}</small></div>${b}</div></div>`
    + `<div class="pk-tb">${o.chip ? `<span class="pk-chip">${escH(o.chip)}</span>` : ''}<div class="pk-h1">${escH(o.title)}</div>`
    + `${o.sub ? `<div class="pk-sub">${escH(o.sub)}</div>` : ''}${o.sum ? `<div class="pk-sum">${o.sum}</div>` : ''}</div>`
    + `<div class="pk-body">${o.body || ''}</div>`
    + `<div class="pk-foot"><span>הופק מהמערכת · ${escH((ctx && ctx.time) || '')}${who}</span><span class="pk-pn">עמוד ${o.pn || 1} מתוך __N__</span></div></section>`;
}
/** מחליף __N__ במספר הגיליונות בכל הגיליונות */
export const fixN = (arr) => arr.map((h) => h.replace(/__N__/g, arr.length));

/* ---------- אטומי טבלה ---------- */
export function table(id, cols) {
  const n = cols.length;
  const thead = `<tr>${cols.map((c) => `<th class="${c.c ? 'pk-c' : ''}">${c.t}</th>`).join('')}</tr>`;
  const colg = cols.map((c) => `<col style="width:${c.w}">`).join('');
  const td = (c, v) => `<td class="${((c.c ? 'pk-c ' : '') + (c.bcc ? 'pk-bcc ' : '') + (c.nw ? 'pk-nw' : '')).trim()}">${v}</td>`;
  const base = { table: id, thead, cols: colg };
  const grow = (label) => `<tr class="pk-g"><td colspan="${n}">${escH(label)}</td></tr>`;
  return {
    group: (label) => Object.assign({ kind: 'group', kwn: true, html: grow(label) }, base),
    row: (cells, grp) => Object.assign({ kind: 'row', html: `<tr>${cells.map((v, i) => td(cols[i], v)).join('')}</tr>` }, grp ? { grpCont: grow(`${grp} (המשך)`) } : {}, base),
    tot: (cells) => Object.assign({ kind: 'tot', kwp: true, html: `<tr class="pk-tot">${cells.map((v, i) => td(cols[i], v)).join('')}</tr>` }, base),
  };
}
export const block = (html, kwn) => ({ kind: 'block', html, kwn: !!kwn });
export const heading = (t) => block(`<div class="pk-dg">${escH(t)}</div>`, true);

/* ---------- עימוד לפי פריסה אמיתית ----------
   adapter = {
     newPage(n)                 מתחיל גיליון ריק מספר n (1..)
     put(atom, prevHandle|null) מוסיף את האטום לגיליון הנוכחי; prevHandle = הידית של האטום הקודם כשהוא באותה טבלה (ממשיכים אותה); מחזיר ידית
     remove(handle)             מסיר אטום שהוכנס (ומסיר טבלה שהתרוקנה)
     fits()                     האם האטום האחרון שהוכנס נכנס בגוף הגיליון
     finalize()                 תמונת מצב של הגיליון הנוכחי (מחרוזת HTML) -> מוחזרת ברשימה
   }
   כללים: כותרת קבוצה לא נשארת אחרונה בגיליון (kwn); שורת סיכום לא נשארת לבדה (kwp: נגררת איתה שורה לפחות); קבוצה שממשיכה בגיליון חדש
   מקבלת שוב את כותרתה עם "(המשך)"; כותרת הטבלה חוזרת בכל גיליון (נוצרת מחדש בכל גיליון); אטום ראשון בגיליון תמיד מתקבל (גם אם גדול מהגיליון). */
export function paginate(atoms, adapter) {
  const out = [];
  let placed = [];
  let N = 0;
  let started = false;
  const newPage = () => { N++; adapter.newPage(N); placed = []; started = true; };
  const finalize = () => { out.push(adapter.finalize()); };
  const lastTable = () => { const e = placed[placed.length - 1]; return e && e.a.table ? e : null; };
  function put(a) {
    const lt = a.table ? lastTable() : null;
    const handle = adapter.put(a, lt && lt.a.table === a.table ? lt.handle : null);
    placed.push({ a, handle });
  }
  function unput() { const e = placed.pop(); adapter.remove(e.handle); return e.a; }
  function emit(a, force) {
    // קבוצה שממשיכה בגיליון חדש מקבלת את הכותרת שלה שוב, מסומנת "(המשך)"
    if (a.table && a.kind === 'row' && a.grpCont) {
      const lt = lastTable();
      if (!(lt && lt.a.table === a.table)) emit(Object.assign({}, a, { kind: 'group', kwn: true, html: a.grpCont, grpCont: null }), true);
    }
    put(a);
    if (force || placed.length < 2 || adapter.fits()) return;
    unput();
    const carry = [];
    const popKwn = () => { while (placed.length && placed[placed.length - 1].a.kwn) carry.unshift(unput()); };
    popKwn();
    if (a.kwp && placed.length) { carry.unshift(unput()); popKwn(); }
    if (!placed.length) { carry.concat([a]).forEach((x) => put(x)); return; } // אין שום דבר אחר בגיליון: מקבלים כמו שהוא
    finalize();
    newPage();
    carry.forEach((x) => emit(x, true));
    emit(a);
  }
  atoms.forEach((a) => { if (!started) newPage(); emit(a); });
  if (started && placed.length) finalize();
  return out;
}

/* ---------- שורת החיפוש / הסינון (אחת, ריקה כשאין) ----------
   filters = [{ key, label, options:[{k,l}] }], sel = { [key]: [k...] }, q = טקסט חיפוש, prefix = { [key]: 'מחלקה' } לקבוצות שמקבלות תווית.
   opts.ai = חיפוש חכם (ה-q הוא הבקשה). */
export function filterLine(filters, sel, q, prefix, opts) {
  const pre = prefix || {};
  const parts = [];
  (filters || []).forEach((f) => {
    const s = (sel && sel[f.key]) || [];
    if (!s.length) return;
    const labels = s.map((k) => (f.options.find((o) => o.k === k) || {}).l).filter(Boolean);
    if (labels.length) parts.push((pre[f.key] ? `${pre[f.key]}: ` : '') + labels.join(' / '));
  });
  const text = q && String(q).trim();
  if (text) parts.push(`${opts && opts.ai ? 'חיפוש חכם' : 'חיפוש'}: ״${text}״`);
  return parts.join(' · ');
}

/** "עובד אחד" / "5 עובדים" (נשאר כאן כדי שה-core לא יתלה בשום קובץ אחר) */
export function plural(n, one, many, zero) {
  if (n === 0 && zero !== undefined) return zero;
  return n === 1 ? one : `${n} ${many}`;
}

/** הגיליונות של מסמך מסוג 'pages' (מדבקות): כל עמוד כבר נבנה כגוף מלא */
export function pagesToSheets(pages, ctx) {
  return fixN(pages.map((p, k) => shell(Object.assign({}, p, { pn: k + 1 }), ctx)));
}
