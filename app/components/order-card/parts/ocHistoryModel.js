// ocHistoryModel.js — לוגיקה טהורה של לשונית ההיסטוריה (W6): סינון קטגוריות + ספירות, חיפוש, מיון הטבלה, שורות הייצוא,
// תוויות יום יחסיות. בלי React ובלי fetch - משותף ללשונית (parts/OcHistoryFeed.js, parts/OcHistoryTable.js), לדף ההדפסה
// (app/print/order-history) ולבדיקות (scripts/order-card-tests/history.*.test.mjs). מבוסס על הדגימה המאושרת
// (כרטיס-הזמנה.html: HCATS, HF_MAP/HF_EXTRA, hfVisible, hfRowData, HT_COLS). תאריכים: עבריים בלבד - הרשומות מגיעות
// מהשרת עם dateHe / weekdayHe / time (lib/history/orderHistory.js); ts/day משמשים למיון בלבד ולעולם לא מוצגים.

// [id, תווית, אייקון] - הקטגוריות של הדגימה (HCATS בלי 'all')
export const HISTORY_CATEGORIES = [['items', 'פריטים', 'dress'], ['pay', 'תשלומים', 'card'], ['del', 'משלוח', 'truck'], ['dates', 'תאריכים', 'cal'], ['docs', 'מסמכים', 'file']];
// סלי סינון נוספים לפי אייקון השורה (HF_EXTRA) - מוצגים רק כשיש שורה כזו
export const HISTORY_EXTRAS = [['sig', 'חתימות', 'sig'], ['print', 'הדפסות', 'print'], ['mail', 'מיילים', 'mail'], ['fix', 'תיקונים', 'scissors']];
const EXTRA_ICON = { sig: 'sig', print: 'print', mail: 'mail', fix: 'scissors' };
// תווית הקטגוריה בשורת הפיד (catL בדגימה)
export const ROW_CATEGORY_LABEL = { items: 'פריט', pay: 'תשלום', del: 'משלוח', dates: 'תאריך', docs: 'מסמך' };
const CATEGORY_NAME = Object.fromEntries(HISTORY_CATEGORIES.map((c) => [c[0], c[1]]));

export const inCategory = (e, k) => (EXTRA_ICON[k] ? e.icon === EXTRA_ICON[k] : e.cat === k);

/** הקטגוריות לתפריט הסינון: חמש הקבועות + הסלים הנוספים שיש להם שורות */
export function filterCategories(entries) {
  return HISTORY_CATEGORIES.concat(HISTORY_EXTRAS.filter(([k]) => (entries || []).some((e) => inCategory(e, k))));
}

export function searchWords(q) {
  return String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 12);
}
// כל הטקסט הגלוי של שורה (כמו hfHay בדגימה, בלי תאריך לועזי: התאריך העברי והיום בשבוע)
export function haystack(e) {
  return [e.text, e.sub || '', e.who || '', e.dateHe || '', e.weekdayHe || '', e.time || '', CATEGORY_NAME[e.cat] || '', ...(e.det || []).flat()]
    .join(' ').toLowerCase();
}
export const matchesWords = (e, words) => !words.length || words.every((w) => haystack(e).includes(w));

/** השורות הגלויות: לפחות קטגוריה אחת שנבחרה (ריק = הכל) + כל מילות החיפוש; החדש למעלה */
export function visibleEntries(entries, { selected = [], q = '' } = {}) {
  const words = searchWords(q);
  return (entries || [])
    .filter((e) => (!selected.length || selected.some((k) => inCategory(e, k))) && matchesWords(e, words))
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
}

/** ספירה לכל קטגוריה (ו-'all') בתוך תוצאות החיפוש - כמו hfCount בדגימה */
export function categoryCount(entries, k, q = '') {
  const words = searchWords(q);
  return (entries || []).filter((e) => (k === 'all' || inCategory(e, k)) && matchesWords(e, words)).length;
}

/** "כז תשרי" מתוך 'כז תשרי תשפ"ז' (התאריך העברי בלי השנה - hDateShort בדגימה) */
export function shortHebrew(dateHe) {
  const p = String(dateHe || '').trim().split(/\s+/);
  return p.length > 2 ? p.slice(0, -1).join(' ') : p.join(' ');
}

/** "היום" / "מחר" / "אתמול" / "יום ה' כז תשרי" - יום ישראלי מול היום הישראלי (שני מפתחות YYYY-MM-DD) */
export function relativeDayLabel(dayKey, todayKey, labels) {
  if (dayKey && todayKey) {
    const d = Math.round((Date.UTC(...ymd(dayKey)) - Date.UTC(...ymd(todayKey))) / 864e5);
    if (d === 0) return 'היום';
    if (d === 1) return 'מחר';
    if (d === -1) return 'אתמול';
  }
  if (!labels) return '';
  return [labels.wdFull || labels.wd, labels.heShort || shortHebrew(labels.he)].filter(Boolean).join(' ');
}
function ymd(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return [y, m - 1, d];
}

// ---------- טבלה (HT_COLS / hfRowData בדגימה) ----------
export const TABLE_COLUMNS = [['act', 'פעולה'], ['date', 'תאריך'], ['prev', 'קודם'], ['new', 'חדש'], ['who', 'עובד מבצע']];
export function tableRow(e) {
  const det = e.det || [];
  const bf = det.find((x) => x[0] === 'לפני');
  const af = det.find((x) => x[0] === 'אחרי');
  return { act: e.text, date: e.ts, prev: bf ? bf[1] : '—', new: af ? af[1] : (e.sub || '—'), who: e.who || '' };
}
/** מיון יציב לפי עמודה; dir 1 = עולה, -1 = יורד. ברירת מחדל: תאריך יורד */
export function sortTableRows(entries, sort = { col: 'date', dir: -1 }) {
  const col = TABLE_COLUMNS.some((c) => c[0] === sort.col) ? sort.col : 'date';
  const dir = sort.dir === 1 ? 1 : -1;
  return entries.map((e, i) => ({ e, r: tableRow(e), i }))
    .sort((a, b) => { const x = a.r[col], y = b.r[col]; return ((x < y ? -1 : x > y ? 1 : 0) * dir) || (a.i - b.i); })
    .map((x) => x.e);
}

// ---------- ייצוא (PLAN §C.4: פעולה · תאריך עברי · שעה · קודם · חדש · עובד מבצע · קטגוריה · סכום; בלי תאריך לועזי) ----------
export const EXPORT_COLUMNS = ['פעולה', 'תאריך', 'שעה', 'קודם', 'חדש', 'עובד מבצע', 'קטגוריה', 'סכום', 'פרטים'];
export function exportRow(e) {
  const r = tableRow(e);
  const extra = (e.det || []).filter(([k]) => k !== 'לפני' && k !== 'אחרי').map(([k, v]) => `${k}: ${v}`).join(' · ');
  return {
    'פעולה': e.text,
    'תאריך': [e.weekdayHe, e.dateHe].filter(Boolean).join(' '),
    'שעה': e.dateOnly ? '' : (e.time || ''),
    'קודם': r.prev === '—' ? '' : r.prev,
    'חדש': r.new === '—' ? '' : r.new,
    'עובד מבצע': e.who || '',
    'קטגוריה': CATEGORY_NAME[e.cat] || '',
    'סכום': typeof e.amt === 'number' ? e.amt : '',
    'פרטים': extra,
  };
}
export const exportRows = (entries) => (entries || []).map(exportRow);

/** הכתובת של דף ההדפסה / ה-PDF של ההיסטוריה לאותו סינון וחיפוש שעל המסך */
export function historyPrintPath(orderId, { selected = [], q = '', pdf = false } = {}) {
  const p = new URLSearchParams();
  p.set('orderId', String(orderId));
  if (selected.length) p.set('category', selected.join(','));
  if (String(q || '').trim()) p.set('q', String(q).trim().slice(0, 200));
  if (pdf) p.set('downloadPdf', '1');
  return `/print/order-history?${p.toString()}`;
}

export const historyFileBase = (orderId) => `היסטוריית הזמנה ${orderId}`;
