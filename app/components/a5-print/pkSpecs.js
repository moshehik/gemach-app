// pkSpecs.js - בוני המסמכים של דפי ההדפסה / ה-PDF (פונקציות טהורות: נתוני המסך + ctx -> מודל מסמך). נבדקים ב-scripts/test_a5_print_specs.mjs.
// הפורט של printList / cardSheets / itemAtoms / rentAtoms / labelSheets מ-scratch/emp-models-build/{employees,models,model-card}.js.
//
// כללי התוכן של הבעלים (הנכנסים לכל בונה): אין נתון כפול ואין נתון לא רלוונטי -
//   * רשימת עובדים: המחלקה היא שורת קבוצה (לא עמודה); הספירה מופיעה פעם אחת (שורת הכותרת); שורת הסינון רק כשיש סינון / חיפוש פעיל;
//     עמודת הסטטוס רק כשהרשימה מערבבת פעילים ולא פעילים. לא מודפס: "מחובר", דגל הסיסמה, מזהים, פעולות.
//   * קטלוג דגמים: ספירה פעם אחת; שורת סיכום רק בסוף ורק סכומים; אפס מוצג כ-"—"; עמודת סטטוס רק כשיש כמה סטטוסים. לא מודפס: אייקונים, מידות, עדכון אחרון.
//   * כרטיס דגם: שם פעם אחת (כותרת), הקוד פעם אחת (ברקוד בכותרת), מידות = שורות קבוצה, עמודת סטטוס רק אם יש פריט לא תקין, צ'יפ "זמינים" רק אם שונה
//     מהסה"כ, צ'יפים באפס לא מוצגים, השכרות 12 חודשים אחרונים, הערות. לא מודפס: יומן שינויים, תמונה, לשוניות, רייל, מצב עריכה, פריטים מחוקים.
//
// ctx (נבנה ב-openPrintPreview.js; בבדיקות - ערכים קבועים): { hDate(iso|key) -> "ט׳ תשרי תשפ״ז", time(iso) -> "HH:MM", todayKey }.
// מודל מסמך: { kind: 'flow', previewTitle, file, head: { title, sub, sum, chip?, barcode? }, atoms }  |  { kind: 'pages', previewTitle, file, pages: [shell-options] }
//          |  { empty: { title, text } } כשאין מה להדפיס (הקורא מציג טוסט).
import {
  bc, block, bcCell, escH, filterLine, heading, plural, table,
} from './pkCore.js';
import {
  ST_LABEL, addDays, bcFor, compareItems, counts, pad2, stOf,
} from '../../../lib/dressCardLogic.js';
import { modelDisplayName } from '../../../lib/modelDisplay.js';

// שם הדגם בהדפסות: שם אמיתי, אחרת מספר הדגם - לעולם לא "ללא שם" (lib/modelDisplay.js); שאר השדות של הדגם נשארים כמו שהם
const pkModel = (m) => (m ? { ...m, name: modelDisplayName({ name: m.name, barcodePrefix: m.code }, { fallback: '' }) || '—' } : m);
const num = (n) => `<span class="pk-num">${escH(n)}</span>`;
const ph = (v) => (v ? `<span class="pk-ph">${escH(v)}</span>` : '<span class="pk-dim">—</span>');
const dim = '<span class="pk-dim">—</span>';
const flt = (data, prefix) => filterLine(data.filters, data.state && data.state.sel, data.state && data.state.q, prefix, { ai: !!(data.state && data.state.ai) });

/* ---------------------------------------------------------------- רשימת עובדים */
/** סדר קבוצות המחלקות: במיון לפי מחלקה - כמו שהרשימה ממוינת; אחרת לפי roleId (הנהלה ראשית ראשונה) ואז בשם. */
export function deptOrder(rows, sortKey) {
  const seen = [];
  rows.forEach((e) => { if (!seen.includes(e.dept)) seen.push(e.dept); });
  if (sortKey === 'dept') return seen;
  const rank = new Map();
  rows.forEach((e) => {
    const r = Number.isFinite(e.roleId) ? e.roleId : 1e9;
    if (!rank.has(e.dept) || r < rank.get(e.dept)) rank.set(e.dept, r);
  });
  return seen.slice().sort((a, b) => (rank.get(a) - rank.get(b)) || a.localeCompare(b, 'he'));
}

/** data = { rows (אחרי חיפוש + סינון + מיון), state, filters } */
export function employeesListDoc(data, ctx) {
  const L = data.rows || [];
  if (!L.length) return { empty: { title: 'אין עובדים להדפסה', text: 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים' } };
  const mixed = new Set(L.map((e) => !!e.active)).size > 1;
  const cols = [{ t: 'קוד', w: '14mm', nw: 1 }, { t: 'שם מלא', w: mixed ? '38mm' : '44mm' }, { t: 'טלפון', w: '28mm', nw: 1 }, { t: 'מייל', w: mixed ? '48mm' : '52mm' }, { t: 'כניסה אחרונה', w: '44mm' }];
  if (mixed) cols.push({ t: 'סטטוס', w: '14mm', nw: 1 });
  const T = table('emp', cols);
  const atoms = [];
  deptOrder(L, data.state && data.state.sort && data.state.sort.k).forEach((name) => {
    atoms.push(T.group(name));
    L.filter((e) => e.dept === name).forEach((e) => {
      const cells = [num(e.code), escH(e.full), ph(e.phone), ph(e.email), e.last ? `${escH(ctx.hDate(e.last))} · ${num(ctx.hm(e.last))}` : dim];
      if (mixed) cells.push(e.active ? 'פעיל' : 'לא פעיל');
      atoms.push(T.row(cells, name));
    });
  });
  return {
    kind: 'flow', previewTitle: 'הדפסת רשימת עובדים', file: 'רשימת עובדים',
    head: { title: 'רשימת עובדים', sub: flt(data, { dept: 'מחלקה' }), sum: plural(L.length, 'עובד אחד', 'עובדים') }, atoms,
  };
}

/* ---------------------------------------------------------------- קטלוג דגמים */
/** data = { rows (modelRow אחרי חיפוש + סינון + מיון), state, filters, statusText(row) } */
export function modelsListDoc(data, ctx) {
  const L = data.rows || [];
  if (!L.length) return { empty: { title: 'אין דגמים להדפסה', text: 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים' } };
  const st = data.statusText || ((m) => (m.deleted ? 'מחוק' : 'פעיל'));
  const mixed = new Set(L.map(st)).size > 1;
  const cols = [{ t: 'קוד', w: '15mm', nw: 1 }, { t: 'שם דגם', w: mixed ? '38mm' : '56mm' }, { t: 'תאריך כניסה', w: '34mm' },
    { t: 'פריטים', w: '15mm', c: 1 }, { t: 'לא בשימוש', w: '19mm', c: 1 }, { t: 'רזרבה', w: '15mm', c: 1 }, { t: 'בתיקון', w: '15mm', c: 1 }, { t: 'השכרות', w: '17mm', c: 1 }];
  if (mixed) cols.push({ t: 'סטטוס', w: '18mm', nw: 1 });
  const T = table('mdl', cols);
  const z = (n) => (n ? num(n) : dim);
  const atoms = L.map((m) => {
    const cells = [m.code == null ? dim : num(m.code), escH(m.name), m.entry ? escH(ctx.hDate(m.entry)) : dim, z(m.items), z(m.inactive), z(m.reserve), z(m.repair), z(m.rentals)];
    if (mixed) cells.push(escH(st(m)));
    return T.row(cells);
  });
  const sum = (f) => L.reduce((a, m) => a + f(m), 0);
  const tot = ['סה״כ', '', '', z(sum((m) => m.items)), z(sum((m) => m.inactive)), z(sum((m) => m.reserve)), z(sum((m) => m.repair)), z(sum((m) => m.rentals))];
  if (mixed) tot.push('');
  atoms.push(T.tot(tot));
  return {
    kind: 'flow', previewTitle: 'הדפסת קטלוג דגמים', file: 'קטלוג דגמים',
    head: { title: 'קטלוג דגמים', sub: flt(data), sum: plural(L.length, 'דגם אחד', 'דגמים') }, atoms,
  };
}

/* ---------------------------------------------------------------- כרטיס דגם: אטומי פריטים / השכרות */
const catLabel = (c) => (/^[A-Za-z0-9]{1,3}$/.test(String(c || '')) ? `קטגוריה ${c}` : String(c || ''));
const savedLive = (items) => (items || []).filter((i) => !i.del).sort(compareItems);

/** פריטים מקובצים לפי מידה. graphic = ברקוד גרפי (רשימת פריטים) או מספר בלבד (כרטיס). */
export function itemAtoms(list, graphic, prefix) {
  const anySt = list.some((i) => stOf(i) !== 'normal');
  const cols = [{ t: 'סידורי', w: '24mm', c: 1 }, { t: 'ברקוד', w: graphic ? '52mm' : '56mm', c: 1, bcc: graphic ? 1 : 0 }, { t: 'מיקום', w: anySt ? '60mm' : '106mm' }];
  if (anySt) cols.push({ t: 'סטטוס', w: '50mm' });
  const T = table('items', cols);
  const atoms = [];
  [...new Set(list.map((i) => i.size))].forEach((sz) => {
    const g = `מידה ${sz}`;
    atoms.push(T.group(g));
    list.filter((i) => i.size === sz).forEach((i) => {
      const st = stOf(i);
      const code = bcFor(i, prefix);
      const cells = [num(pad2(i.serial)), graphic ? bcCell(code) : `<span class="pk-ph">${escH(code)}</span>`, escH(i.loc) + (i.carton ? ` · קרטון ${num(i.carton)}` : '')];
      if (anySt) cells.push(st === 'normal' ? dim : escH(ST_LABEL[st]) + (st === 'unused' && i.why ? ` · ${escH(i.why)}` : ''));
      atoms.push(T.row(cells, g));
    });
  });
  return atoms;
}

export function rentAtoms(list, ctx) {
  const T = table('rent', [{ t: 'לקוחה', w: '42mm' }, { t: 'הזמנה', w: '22mm', nw: 1 }, { t: 'תאריך אירוע', w: '36mm' }, { t: 'לקיחה', w: '36mm' }, { t: 'החזרה', w: '50mm' }]);
  return list.map((r) => {
    const back = r.ret === 'out' ? (r.taken ? 'טרם הוחזר' : dim) : (r.retDate ? escH(ctx.hDate(r.retDate)) : dim) + (r.ret === 'bad' ? `<small>הוחזר עם בעיה${r.note ? `: ${escH(r.note)}` : ''}</small>` : '');
    return T.row([escH(r.cust), num(`#${r.order}`), r.event ? escH(ctx.hDate(r.event)) : dim, r.taken ? escH(ctx.hDate(r.taken)) : dim, back]);
  });
}

/** השכרות ב-12 החודשים האחרונים, החדשות ראשונות */
export function rentWindow(rentals, todayKey) {
  const from = addDays(todayKey, -365);
  return (rentals || []).filter((r) => r.event && r.event >= from).sort((a, b) => (a.event < b.event ? 1 : a.event > b.event ? -1 : 0));
}

/* ---------------------------------------------------------------- כרטיס דגם (A4 לאורך) */
/** data = { model, items (השמורים), rentals (כל ההשכרות), prefix } */
export function modelCardDoc(data, ctx) {
  const m = pkModel(data.model);
  const cn = counts(data.items || []);
  const live = savedLive(data.items);
  const rents = rentWindow(data.rentals, ctx.todayKey);
  const kv = (k, v) => `<div><small>${escH(k)}</small><b>${v}</b></div>`;
  let id = (m.cat ? kv('קטגוריית מחיר', escH(catLabel(m.cat))) : '') + (m.entry ? kv('תאריך כניסה למאגר', escH(ctx.hDate(m.entry))) : '') + kv('סטטוס', m.active ? 'פעיל' : 'לא פעיל');
  if (!m.active) {
    if (m.reason) id += kv('סיבת אי-פעילות', escH(m.reason));
    if (m.exit) id += kv('יציאה מהמאגר', escH(ctx.hDate(m.exit)));
  }
  const atoms = [block(`<div class="pk-kv">${id}</div>`)];
  if (String(m.notes || '').trim()) atoms.push(block(`<div class="pk-note"><b>הערות</b>${escH(m.notes)}</div>`));
  if (cn.n) {
    const chips = [[cn.n, 'פריטים']];
    if (cn.avail && cn.avail !== cn.n) chips.push([cn.avail, 'זמינים']);
    if (cn.unused) chips.push([cn.unused, 'לא בשימוש']);
    if (cn.reserve) chips.push([cn.reserve, 'ברזרבה']);
    if (cn.repair) chips.push([cn.repair, 'בתיקון']);
    atoms.push(block(`<div class="pk-stats">${chips.map((c) => `<div><b>${c[0]}</b> ${c[1]}</div>`).join('')}</div>`));
    atoms.push(heading('פריטים'), ...itemAtoms(live, false, data.prefix));
  } else atoms.push(block('<div class="pk-note">אין פריטים בדגם</div>'));
  if (rents.length) atoms.push(heading('השכרות ב-12 החודשים האחרונים'), ...rentAtoms(rents, ctx));
  return {
    kind: 'flow', previewTitle: `הדפסה: כרטיס דגם · ${m.name}`, file: `כרטיס דגם ${m.name}`,
    head: { chip: 'כרטיס דגם', title: m.name, barcode: m.code }, atoms,
  };
}

/** data = { model, items (השמורים), prefix, list? (השורות שבלשונית, בסדר המסך), state?, filters? } */
export function modelItemsDoc(data) {
  const m = pkModel(data.model);
  const byId = new Map((data.items || []).map((i) => [i.id, i]));
  const list = data.list ? data.list.map((i) => byId.get(i.id)).filter((x) => x && !x.del) : savedLive(data.items);
  if (!list.length) return { empty: { title: 'אין פריטים להדפסה', text: 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים' } };
  return {
    kind: 'flow', previewTitle: `הדפסה: רשימת פריטים · ${m.name}`, file: `רשימת פריטים ${m.name}`,
    head: { chip: 'רשימת פריטים ומיקומים', title: m.name, sub: data.list ? flt(data, { loc: 'מיקום' }) : '', sum: plural(list.length, 'פריט אחד', 'פריטים') },
    atoms: itemAtoms(list, true, data.prefix),
  };
}

/** data = { model, rentals (כולם), list? (השורות שבלשונית), state?, filters? } */
export function modelRentalsDoc(data, ctx) {
  const m = pkModel(data.model);
  const list = data.list ? data.list : rentWindow(data.rentals, ctx.todayKey);
  if (!list.length) return { empty: { title: 'אין השכרות להדפסה', text: data.list ? 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים' : 'לא היו השכרות ב-12 החודשים האחרונים' } };
  return {
    kind: 'flow', previewTitle: `הדפסה: רשימת השכרות · ${m.name}`, file: `השכרות ${m.name}`,
    head: { chip: 'השכרות', title: m.name, sub: data.list ? flt(data) : 'ב-12 החודשים האחרונים', sum: plural(list.length, 'השכרה אחת', 'השכרות') },
    atoms: rentAtoms(list, ctx),
  };
}

/** מדבקות ברקוד: 18 לגיליון (3 x 6), כותרת צרה, בלי עימוד מדוד */
export const LABELS_PER_SHEET = 18;
export function modelLabelsDoc(data) {
  const m = pkModel(data.model);
  const live = savedLive(data.items);
  if (!live.length) return { empty: { title: 'אין פריטים למדבקות', text: '' } };
  const pages = [];
  for (let i = 0; i < live.length; i += LABELS_PER_SHEET) {
    const c = live.slice(i, i + LABELS_PER_SHEET);
    pages.push({
      slim: true, chip: 'מדבקות ברקוד', title: m.name, sum: plural(live.length, 'מדבקה אחת', 'מדבקות'),
      body: `<div class="pk-lab-grid">${c.map((it) => {
        const code = bcFor(it, data.prefix);
        return `<div class="pk-lab"><div class="pk-lab-nm">${escH(m.name)}</div><div class="pk-lab-md">מידה <b>${escH(it.size)}</b></div><div class="pk-lab-bc">${bc(code, 10, 0.2)}<small>${escH(code)}</small></div></div>`;
      }).join('')}</div>`,
    });
  }
  return { kind: 'pages', previewTitle: `הדפסה: מדבקות ברקוד · ${m.name}`, file: `מדבקות ברקוד ${m.name}`, pages };
}

/* ---------------------------------------------------------------- דוח הזמנות / רשימת לקוחות (רשימות הניהול; הגיליון נבנה ב-ordersLogic / customersLogic - docs/a5-staff-models/print-specs.md) */
/** ₪1,234.5 (he-IL), מספר שלם בלי אגורות */
export const money = (n) => `₪${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('he-IL')}`;
const moneyCell = (n) => (n ? `<span class="pk-num">${escH(money(n))}</span>` : dim);
const sumHead = (n, one, many) => plural(n, one, many);

/** data = { sheet } מ-buildOrdersSheet: מקובץ לפי חודש האירוע העברי; סיכום פעם אחת בסוף (סכום, וחוב רק אם יש חוב); הספירה פעם אחת (בכותרת). */
export function ordersListDoc(data) {
  const sh = data.sheet;
  const groups = (sh && sh.groups) || [];
  if (!groups.some((g) => g.rows.length)) return { empty: { title: 'אין הזמנות להדפסה', text: 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים' } };
  const withDebt = !!sh.hasDebt;
  const cols = [{ t: 'מס׳ הזמנה', w: '24mm', c: 1, nw: 1 }, { t: 'לקוח', w: withDebt ? '60mm' : '86mm' }, { t: 'תאריך אירוע', w: '30mm' }, { t: 'פריטים', w: '18mm', c: 1 }, { t: 'סכום', w: '26mm', nw: 1 }];
  if (withDebt) cols.push({ t: 'חוב', w: '28mm', nw: 1 });
  const T = table('ord', cols);
  const atoms = [];
  groups.forEach((g) => {
    atoms.push(T.group(g.title));
    g.rows.forEach((r) => {
      const cells = [num(`#${r.orderId}`), escH(r.customer), r.day ? escH(r.day) : dim, r.items ? num(r.items) : dim, moneyCell(r.total)];
      if (withDebt) cells.push(moneyCell(r.balance));
      atoms.push(T.row(cells, g.title));
    });
  });
  const tot = ['סה״כ', '', '', '', moneyCell(sh.totals.total)];
  if (withDebt) tot.push(moneyCell(sh.totals.debt));
  atoms.push(T.tot(tot));
  return {
    kind: 'flow', previewTitle: 'הדפסת דוח הזמנות', file: 'דוח הזמנות',
    head: { title: sh.title || 'דוח הזמנות', sub: sh.subtitle || '', sum: sumHead(sh.totals.count, 'הזמנה אחת', 'הזמנות') }, atoms,
  };
}

/** data = { sheet } מ-buildCustomersSheet: בלי קבוצות; "הזמנות" ו"חוב" רק כשיש; סיכום החוב פעם אחת בסוף (רק כשיש חוב); הספירה בכותרת. */
export function customersListDoc(data) {
  const sh = data.sheet;
  const rows = (sh && sh.rows) || [];
  if (!rows.length) return { empty: { title: 'אין לקוחות להדפסה', text: 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים' } };
  const withOrders = !!sh.hasOrders;
  const withDebt = !!sh.hasDebt;
  const fixed = 18 + 28 + 28 + (withOrders ? 16 : 0) + (withDebt ? 24 : 0);
  const rest = 186 - fixed;
  const cols = [{ t: 'מס׳ לקוח', w: '18mm', c: 1, nw: 1 }, { t: 'שם', w: `${Math.round(rest * 0.45)}mm` }, { t: 'טלפון', w: '28mm', nw: 1 }, { t: 'מייל', w: `${Math.round(rest * 0.55)}mm` }, { t: 'עיר', w: '28mm' }];
  if (withOrders) cols.push({ t: 'הזמנות', w: '16mm', c: 1 });
  if (withDebt) cols.push({ t: 'חוב', w: '24mm', nw: 1 });
  const T = table('cus', cols);
  const atoms = rows.map((r) => {
    const cells = [r.number ? num(r.number) : dim, escH(r.name), ph(r.phone), ph(r.email), r.city ? escH(r.city) : dim];
    if (withOrders) cells.push(r.orders ? num(r.orders) : dim);
    if (withDebt) cells.push(moneyCell(r.debt));
    return T.row(cells);
  });
  if (withDebt) atoms.push(T.tot(['סה״כ', '', '', '', '', ...(withOrders ? [''] : []), moneyCell(sh.totals.debt)]));
  return {
    kind: 'flow', previewTitle: 'הדפסת רשימת לקוחות', file: 'רשימת לקוחות',
    head: { title: sh.title || 'רשימת לקוחות', sub: sh.subtitle || '', sum: sumHead(sh.totals.count, 'לקוח אחד', 'לקוחות') }, atoms,
  };
}
