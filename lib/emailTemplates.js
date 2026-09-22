// תבניות המיילים של המערכת - מערכת עיצוב אחת (צבעונית, RTL) לכל 16 המיילים.
//
// מבנה: כל מייל = "כרטיס" אחד: כותרת צבעונית עם שם הגמ"ח, אזור תוכן לבן (אייקון + כותרת + תוכן),
// וכותפת. הצבע נקבע לפי סוג המייל (tone): בורדו=הודעות ללקוחות, אינדיגו=אימות, טורקיז=דוחות
// להנהלה, כתום=תקלות, סגול=הודעות פנימיות וסוכן, ירוק=זיכוי/משלוחים, אדום=איחור.
//
// כל העיצוב ב-inline style (וטבלאות לפריסה) כי Gmail/Outlook מסירים <html>/<body> ו-<style>
// לפעמים, ולא מכבדים CSS חיצוני. כיוון RTL מוטמע על כל בלוק (ר' RTL_INLINE_STYLE) מאותה סיבה.
// הגופן: Tahoma (עם Arial כגיבוי) בכל המייל, בלי תלות בפונטים חיצוניים.
//
// להוספת מייל חדש: השתמשו ב-renderGenericEmailHtml, או הוסיפו פונקציה חדשה שמרכיבה בלוקים
// (kvCard, callout, dataTable, ...) ומעבירה אותם ל-renderEmail. אין לכתוב HTML ידני באתר השליחה.

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// RTL - כל מייל במערכת הוא בעברית, ולכן כל טקסט חופשי חייב לצאת מיושר לימין ועם כיוון
// בסיס RTL, כך שסימני פיסוק (פסיק, נקודה, נקודתיים, מקף, סוגריים), רווחים ומספרים
// יתנהגו כמו בעברית (למשל נקודה בסוף שורה תופיע בצד שמאל ולא "תקפוץ" לתחילת המשפט).
// ---------------------------------------------------------------------------

export const RTL_INLINE_STYLE = 'direction:rtl;text-align:right;unicode-bidi:embed';

const RLE = '‫'; // Right-to-Left Embedding
const PDF = '‬'; // Pop Directional Formatting

// שורה ראשונה מהסוג "שלום להנהלת הגמ"ח" - ברכה מיותרת בגוף הודעות המערכת (ההודעות
// נשלחות לעובדים/ללקוחות/למתכנת, לא ל"הנהלה"). מוסרת רק אם היא השורה הראשונה.
const MANAGEMENT_GREETING_RE = /^\s*שלום\s+(?:רב\s+)?ל(?:כבוד\s+)?הנהלת\s+ה?גמ(?:["״]|'')?ח\s*[,:!.]?[ \t]*(?:\r?\n)+/;

export function stripManagementGreeting(text) {
  return String(text ?? '').replace(MANAGEMENT_GREETING_RE, '');
}

/**
 * גרסת טקסט-פשוט (שדה body / EmailLog / קליינטים ללא HTML) עם כיוון RTL: כל שורה עטופה
 * ב-RLE...PDF כדי שסימני הפיסוק והמספרים בשורה יסתדרו לפי כללי העברית.
 * שורות ריקות נשארות ריקות. בטוחה לקריאה חוזרת (לא עוטפת פעמיים).
 */
export function rtlPlainText(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => (line.trim() === '' || line.startsWith(RLE)) ? line : `${RLE}${line}${PDF}`)
    .join('\n');
}

// User-typed free text (message bodies, bug descriptions) isn't HTML - escape it and render
// every line as its own RTL block: right-aligned, with Hebrew punctuation/number rules.
// Blank lines become a fixed-height spacer.
export function textToHtml(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trim() === ''
      ? '<div style="height:10px;line-height:10px">&nbsp;</div>'
      : `<div dir="rtl" style="${RTL_INLINE_STYLE}">${escapeHtml(line)}</div>`)
    .join('');
}

// ---------------------------------------------------------------------------
// מערכת עיצוב: צבעים, גופנים, בלוקים
// ---------------------------------------------------------------------------

// גופן אחד לכל המייל (נבחר 2026-09-22): Tahoma - מותקן כמעט בכל מחשב ותיבת דואר, עברית ברורה.
const SANS = "Tahoma,Arial,sans-serif";

export const EMAIL_TONES = {
  plum:   { main: '#8a3457', dark: '#5e2039', light: '#fbeff4', soft: '#f1d3df' },
  indigo: { main: '#4257c9', dark: '#2c3a94', light: '#eef1fd', soft: '#d3daf6' },
  teal:   { main: '#0f8b84', dark: '#0a5f5a', light: '#e7f6f5', soft: '#c1e6e3' },
  amber:  { main: '#d9730d', dark: '#9a4f06', light: '#fff4e5', soft: '#f9d9ab' },
  violet: { main: '#7c4dcc', dark: '#52309a', light: '#f3eefc', soft: '#dac9f4' },
  green:  { main: '#2e8b57', dark: '#1d5e3a', light: '#e9f7ef', soft: '#c3e7d0' },
  red:    { main: '#c73e3e', dark: '#8e2424', light: '#fdecec', soft: '#f4c4c4' },
};

const T = (tone) => EMAIL_TONES[tone] || EMAIL_TONES.plum;
const esc = escapeHtml;

/** ₪1,250 - סכום בשקלים לתצוגה */
export function formatShekel(n) {
  const v = Number(n);
  if (!isFinite(v)) return '₪0';
  return `₪${v.toLocaleString('he-IL')}`;
}

/** פסקאות טקסט חופשי (שורה = בלוק RTL). */
function paragraphs(text) {
  return `<div style="font-size:15px;line-height:1.85;color:#3b3333;margin:0 0 18px 0">${textToHtml(stripManagementGreeting(text || ''))}</div>`;
}

/** כרטיס שורות "תווית: ערך" עם פס צבע בצד ימין. rows: [{label, value?, html?, strong?, ltr?}] */
function kvCard(rows, tone) {
  const t = T(tone);
  const list = (rows || []).filter(r => r && (r.html || (r.value !== undefined && r.value !== null && r.value !== '')));
  if (list.length === 0) return '';
  const trs = list.map((r, i) => {
    const last = i === list.length - 1;
    const bd = last ? '' : `border-bottom:1px solid ${t.soft};`;
    return `<tr>
      <td style="padding:11px 16px;width:34%;font-size:13px;font-weight:700;color:${t.dark};vertical-align:top;text-align:right;${bd}">${esc(r.label)}</td>
      <td${r.ltr ? ' dir="ltr"' : ' dir="rtl"'} style="padding:11px 16px;font-size:14.5px;color:#2b2424;vertical-align:top;text-align:right;${r.strong ? 'font-weight:700;' : ''}${bd}">${r.html !== undefined ? r.html : esc(r.value)}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:${t.light};border-radius:12px;border-right:5px solid ${t.main};margin:0 0 20px 0"><tbody>${trs}</tbody></table>`;
}

const CALLOUTS = {
  info:    { bg: '#eaf3ff', bd: '#b9d6fb', fg: '#1f4c8a', icon: 'ℹ️' },
  warning: { bg: '#fff6e0', bd: '#f3d78a', fg: '#7a5300', icon: '⚠️' },
  success: { bg: '#e9f7ef', bd: '#bfe3cd', fg: '#1d5e3a', icon: '✅' },
  danger:  { bg: '#fdecec', bd: '#f4c4c4', fg: '#8e2424', icon: '🚨' },
  neutral: { bg: '#f5f2ee', bd: '#e4ddd3', fg: '#5b5148', icon: '💡' },
};

/** תיבת הדגשה צבעונית. text = טקסט חופשי (יוסק), html = HTML מוכן. */
function callout({ kind = 'info', title = '', text = '', html }) {
  const c = CALLOUTS[kind] || CALLOUTS.info;
  return `<div dir="rtl" style="${RTL_INLINE_STYLE};background:${c.bg};border:1px solid ${c.bd};border-radius:12px;padding:14px 16px;margin:0 0 20px 0;color:${c.fg};font-size:14px;line-height:1.75">
    ${title ? `<div style="font-weight:800;margin-bottom:4px">${c.icon} ${esc(title)}</div>` : ''}
    ${html !== undefined ? html : textToHtml(text)}
  </div>`;
}

/** תיבת קוד/סיסמה גדולה (LTR) עם תווית. */
function codeBox(label, value, tone) {
  const t = T(tone);
  return `<div style="text-align:center;font-size:13px;font-weight:700;color:${t.dark};margin:0 0 8px 0">${esc(label)}</div>
  <div style="text-align:center;background:${t.light};border:2px dashed ${t.main};border-radius:14px;padding:20px 10px;margin:0 0 22px 0">
    <span dir="ltr" style="display:inline-block;font-family:'Courier New',Consolas,monospace;font-size:30px;font-weight:800;letter-spacing:5px;color:${t.dark}">${esc(value)}</span>
  </div>`;
}

/** כפתור קישור. */
function button(label, url, tone) {
  const t = T(tone);
  return `<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="margin:6px 0 24px 0"><tbody><tr>
    <td style="background:${t.main};border-radius:12px;text-align:center"><a href="${esc(url)}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:15px;font-weight:800;color:#ffffff;text-decoration:none">${esc(label)}</a></td>
  </tr></tbody></table>`;
}

/** רשימה ממוספרת בעיגולים. items: מחרוזות (טקסט). */
function numberedList(items, tone) {
  const t = T(tone);
  const rows = (items || []).map((it, i) => `<tr>
    <td style="width:34px;vertical-align:top;padding:5px 0"><div style="width:26px;height:26px;line-height:26px;border-radius:50%;background:${t.main};color:#fff;text-align:center;font-size:13px;font-weight:800">${i + 1}</div></td>
    <td dir="rtl" style="vertical-align:top;padding:5px 8px 5px 0;font-size:14.5px;line-height:1.7;color:#3b3333;text-align:right">${esc(it)}</td>
  </tr>`).join('');
  return `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0"><tbody>${rows}</tbody></table>`;
}

/** טבלת נתונים עם כותרת צבעונית. headers: [string]; rows: [[cell,...]] (תא = טקסט); ltrCols: אינדקסים של עמודות LTR (טלפון וכד'). */
function dataTable({ headers, rows, tone, ltrCols = [] }) {
  const t = T(tone);
  const th = headers.map(h => `<th style="background:${t.main};color:#fff;padding:11px 12px;text-align:right;font-size:13px;font-weight:800">${esc(h)}</th>`).join('');
  const trs = rows.map((r, i) => `<tr style="background:${i % 2 ? t.light : '#ffffff'}">${r.map((c, ci) => `<td${ltrCols.includes(ci) ? ' dir="ltr"' : ' dir="rtl"'} style="padding:10px 12px;font-size:14px;color:#2b2424;text-align:right;border-bottom:1px solid ${t.soft};${ltrCols.includes(ci) ? 'white-space:nowrap;' : ''}">${esc(c === '' || c == null ? '-' : c)}</td>`).join('')}</tr>`).join('');
  return `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;border:1px solid ${t.soft};border-radius:12px;overflow:hidden;margin:0 0 22px 0"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

/** אריחי מספרים גדולים בשורה. tiles: [{label, value}] */
function statTiles(tiles, tone) {
  const t = T(tone);
  const w = Math.floor(100 / tiles.length);
  const cells = tiles.map(s => `<td width="${w}%" style="padding:0 4px"><div style="background:${t.light};border:1px solid ${t.soft};border-radius:12px;padding:14px 8px;text-align:center"><div style="font-size:26px;font-weight:800;color:${t.dark};line-height:1.2">${esc(s.value)}</div><div style="font-size:12px;color:#6b6058;margin-top:4px">${esc(s.label)}</div></div></td>`).join('');
  return `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px 0"><tbody><tr>${cells}</tr></tbody></table>`;
}

function sectionTitle(text, tone) {
  const t = T(tone);
  return `<div dir="rtl" style="${RTL_INLINE_STYLE};font-size:16px;font-weight:800;color:${t.dark};margin:6px 0 10px 0">${esc(text)}</div>`;
}

const CARD_START = '<!--EMAIL_CARD_START-->';
const CARD_END = '<!--EMAIL_CARD_END-->';

/**
 * הפריסה הכללית של כל מיילי המערכת.
 * @param {object} o
 * @param {string} [o.tone] plum|indigo|teal|amber|violet|green|red
 * @param {string} [o.icon] אמוג'י בעיגול מעל הכותרת
 * @param {string} [o.kicker] תגית קטנה בכותרת הצבעונית (סוג המייל)
 * @param {string} o.title כותרת ראשית
 * @param {string} [o.lead] שורת פתיחה (טקסט חופשי)
 * @param {string} o.bodyHtml תוכן (בלוקים מוכנים)
 * @param {string} [o.gmachName] @param {string} [o.gmachAddress] @param {string} [o.gmachPhone]
 */
export function renderEmail({ tone = 'plum', icon = '✉️', kicker = '', title = '', lead = '', bodyHtml = '', gmachName = 'גמ"ח שמלות', gmachAddress = '', gmachPhone = '' }) {
  const t = T(tone);
  const footerContact = [gmachAddress, gmachPhone].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');
  const card = `${CARD_START}
<div dir="rtl" style="${RTL_INLINE_STYLE};background:#f3eee8;padding:26px 12px;font-family:${SANS}">
  <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;border-collapse:separate;border-spacing:0">
    <tbody>
      <tr><td dir="rtl" bgcolor="${t.main}" style="background:${t.main};background-image:linear-gradient(135deg,${t.main},${t.dark});border-radius:18px 18px 0 0;padding:24px 28px 26px 28px;text-align:right">
        <div style="font-size:12px;font-weight:700;color:#ffffff;opacity:.75;letter-spacing:.5px;margin-bottom:6px">בס"ד</div>
        <div style="font-size:28px;font-weight:700;color:#ffffff;line-height:1.25">${esc(gmachName)}</div>
        ${kicker ? `<div style="margin-top:12px"><span style="display:inline-block;background:rgba(255,255,255,0.20);color:#ffffff;font-size:12.5px;font-weight:700;padding:5px 14px;border-radius:20px">${esc(kicker)}</span></div>` : ''}
      </td></tr>
      <tr><td dir="rtl" style="background:#ffffff;padding:30px 28px 10px 28px;text-align:right">
        <div style="width:58px;height:58px;line-height:58px;border-radius:50%;background:${t.light};border:2px solid ${t.soft};text-align:center;font-size:29px;margin:0 0 16px 0">${icon}</div>
        ${title ? `<div dir="rtl" style="${RTL_INLINE_STYLE};font-size:24px;font-weight:800;color:${t.dark};line-height:1.35;margin:0 0 ${lead ? '10px' : '20px'} 0">${esc(title)}</div>` : ''}
        ${lead ? `<div dir="rtl" style="${RTL_INLINE_STYLE};font-size:15.5px;line-height:1.8;color:#5b5148;margin:0 0 22px 0">${esc(lead)}</div>` : ''}
        ${bodyHtml}
      </td></tr>
      <tr><td dir="rtl" style="background:#faf6f1;border-top:1px solid #efe7dd;border-radius:0 0 18px 18px;padding:18px 28px;text-align:center;font-size:12px;line-height:1.8;color:#8a7f76">
        <div style="font-weight:800;color:${t.dark};font-size:13px">${esc(gmachName)}</div>
        ${footerContact ? `<div>${footerContact}</div>` : ''}
        <div>הודעה זו נשלחה אוטומטית ממערכת ${esc(gmachName)}</div>
      </td></tr>
    </tbody>
  </table>
</div>
${CARD_END}`;
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3eee8">${card}</body></html>`;
}

/** מוציא מתוך מייל מלא (renderEmail) רק את "הכרטיס" - לשילוב בגלריה. */
export function extractEmailCard(html) {
  const a = html.indexOf(CARD_START);
  const b = html.indexOf(CARD_END);
  return a >= 0 && b > a ? html.slice(a + CARD_START.length, b) : html;
}

// ---------------------------------------------------------------------------
// התבניות - אחת לכל סוג מייל
// ---------------------------------------------------------------------------

/** איפוס סיסמה (עצמי / ע"י מנהל) - אינדיגו. */
export function renderPasswordResetEmailHtml({
  firstName,
  tempPassword,
  triggeredByManager = false,
  gmachName = 'גמ"ח שמלות',
  gmachPhone = ''
}) {
  const bodyHtml = `
    ${codeBox('הסיסמה הזמנית שלך', tempPassword, 'indigo')}
    ${sectionTitle('מה עושים עכשיו?', 'indigo')}
    ${numberedList(['נכנסים למערכת עם הסיסמה הזמנית שלמעלה.', 'בכניסה הראשונה תתבקשו לבחור סיסמה חדשה משלכם.', 'מתחילים לעבוד - והסיסמה הזמנית מפסיקה לעבוד.'], 'indigo')}
    ${callout({ kind: 'warning', title: 'לא ביקשתם איפוס?', text: `אפשר להתעלם מהודעה זו${gmachPhone ? ` או לפנות אלינו בטלפון ${gmachPhone}` : ' ולפנות למנהל המערכת'}.` })}
  `;
  return renderEmail({
    tone: 'indigo', icon: '🔑', kicker: 'איפוס סיסמה',
    title: `שלום ${firstName || ''}`.trim(),
    lead: triggeredByManager ? 'סיסמתך למערכת אופסה על ידי מנהל, ולהלן סיסמה זמנית לחיבור.' : 'קיבלנו בקשה לאיפוס הסיסמה שלך למערכת, ולהלן סיסמה זמנית לחיבור.',
    bodyHtml, gmachName, gmachPhone,
  });
}

/**
 * מייל כללי (טקסט חופשי): מייל חופשי ממנהל, הודעה המונית, וכל מייל שאין לו תבנית ייעודית.
 * @param {object} o
 * @param {string} [o.title] @param {string} o.bodyText טקסט חופשי (לא HTML)
 * @param {string} [o.subtitle] תגית בכותרת @param {string} [o.footnote] @param {{label,url}} [o.actionButton]
 * @param {string} [o.tone] @param {string} [o.icon] @param {string} [o.lead]
 */
export function renderGenericEmailHtml({
  title, bodyText, gmachName = 'גמ"ח שמלות', subtitle = '',
  actionButton = null, footnote = '',
  tone = 'plum', icon = '✉️', lead = '', gmachAddress = '', gmachPhone = ''
}) {
  const bodyHtml = `
    ${bodyText ? paragraphs(bodyText) : ''}
    ${footnote ? callout({ kind: 'neutral', text: footnote }) : ''}
    ${actionButton && actionButton.url ? button(actionButton.label || 'לחצו כאן', actionButton.url, tone) : ''}
  `;
  return renderEmail({ tone, icon, kicker: subtitle || 'הודעה', title: title || '', lead, bodyHtml, gmachName, gmachAddress, gmachPhone });
}

/** כרטיס הזמנה/השכרה - הגוף המלווה ל-PDF. בורדו. */
export function renderOrderCardEmailHtml({ orderId, printType = 'order', customerName = '', eventDate = '', gmachName = 'גמ"ח שמלות', gmachAddress = '', gmachPhone = '' }) {
  const isRental = printType === 'rental';
  const bodyHtml = `
    ${kvCard([
      { label: isRental ? 'מספר השכרה' : 'מספר הזמנה', value: `#${orderId}`, strong: true },
      { label: 'על שם', value: customerName },
      { label: 'תאריך האירוע', value: eventDate },
    ], 'plum')}
    ${callout({ kind: 'info', title: 'המסמך המלא מצורף', text: `כרטיס ${isRental ? 'ההשכרה' : 'ההזמנה'} המלא, כולל פירוט הפריטים, התיקונים והתשלומים, מצורף למייל כקובץ PDF.` })}
  `;
  return renderEmail({
    tone: 'plum', icon: '📄', kicker: isRental ? 'כרטיס השכרה' : 'כרטיס הזמנה',
    title: `${isRental ? 'דוח השכרה' : 'הזמנה'} #${orderId}`,
    lead: customerName ? `שלום ${customerName}, מצורף כרטיס ${isRental ? 'ההשכרה' : 'ההזמנה'} שלך.` : `מצורף כרטיס ${isRental ? 'ההשכרה' : 'ההזמנה'}.`,
    bodyHtml, gmachName, gmachAddress, gmachPhone,
  });
}

/** אישור יצירת הזמנה (אוטומטי) - בורדו. items: [{name, size?}] */
export function renderOrderConfirmationEmailHtml({ customerName = '', orderId, eventDate = '', pickupLine = '', returnLine = '', items = [], totalCharge = 0, totalPaid = 0, balance = 0, gmachName = 'גמ"ח שמלות', gmachAddress = '', gmachPhone = '' }) {
  const itemsHtml = items.length
    ? items.map(i => `<div dir="rtl" style="${RTL_INLINE_STYLE};padding:3px 0">👗 <strong>${esc(i.name)}</strong>${i.size ? ` <span style="color:#7a6f66">· מידה ${esc(i.size)}</span>` : ''}</div>`).join('')
    : '<span style="color:#7a6f66">ללא פירוט</span>';
  const balanceBox = balance > 0
    ? `<span style="color:#9a4f06;font-weight:800">${formatShekel(balance)}</span>`
    : '<span style="color:#1d5e3a;font-weight:800">שולם במלואו ✓</span>';
  const bodyHtml = `
    ${sectionTitle('פרטי ההזמנה', 'plum')}
    ${kvCard([
      { label: 'תאריך האירוע', value: eventDate, strong: true },
      { label: 'קבלת השמלות', value: pickupLine },
      { label: 'החזרת השמלות', value: returnLine },
      { label: 'פריטים', html: itemsHtml },
    ], 'plum')}
    ${sectionTitle('סיכום תשלום', 'plum')}
    ${kvCard([
      { label: 'סה"כ לחיוב', value: formatShekel(totalCharge) },
      { label: 'שולם', value: formatShekel(totalPaid) },
      { label: 'יתרה לתשלום', html: balanceBox },
    ], balance > 0 ? 'amber' : 'green')}
    ${gmachAddress || gmachPhone ? callout({ kind: 'info', title: 'איפה אנחנו', text: [gmachAddress ? `כתובת האיסוף: ${gmachAddress}` : '', gmachPhone ? `טלפון: ${gmachPhone}` : ''].filter(Boolean).join('\n') }) : ''}
    ${paragraphs('נשמח לראותך!')}
  `;
  return renderEmail({
    tone: 'plum', icon: '🎉', kicker: 'אישור הזמנה',
    title: `הזמנתך #${orderId} נקלטה בהצלחה`,
    lead: customerName ? `שלום ${customerName}, תודה שבחרת בנו. ריכזנו כאן את כל הפרטים.` : 'תודה שבחרת בנו. ריכזנו כאן את כל הפרטים.',
    bodyHtml, gmachName, gmachAddress, gmachPhone,
  });
}

/** תזכורת איסוף (יום לפני) - כתום. */
export function renderPickupReminderEmailHtml({ customerName = '', orderId, eventDate = '', items = [], gmachName = 'גמ"ח שמלות', gmachAddress = '', gmachPhone = '' }) {
  const bodyHtml = `
    <div dir="rtl" style="text-align:center;background:${T('amber').light};border:2px solid ${T('amber').soft};border-radius:16px;padding:20px 12px;margin:0 0 22px 0">
      <div style="font-size:13px;font-weight:700;color:${T('amber').dark}">האירוע שלך מחר</div>
      <div style="font-size:26px;font-weight:800;color:${T('amber').dark};margin-top:4px">${esc(eventDate)}</div>
    </div>
    ${kvCard([
      { label: 'מספר הזמנה', value: `#${orderId}`, strong: true },
      { label: 'פריטים', value: items.join(', ') },
      { label: 'כתובת', value: gmachAddress },
      { label: 'טלפון', value: gmachPhone, ltr: true },
    ], 'amber')}
    ${paragraphs('נשמח לראותכם!')}
  `;
  return renderEmail({
    tone: 'amber', icon: '⏰', kicker: 'תזכורת איסוף',
    title: `מחר איסוף ההזמנה #${orderId}`,
    lead: customerName ? `שלום ${customerName}, רצינו להזכיר לכם:` : 'רצינו להזכיר לכם:',
    bodyHtml, gmachName, gmachAddress, gmachPhone,
  });
}

/** תזכורת החזרה באיחור - אדום. message = הטקסט שהוגדר בהגדרות (late_return_email_text). */
export function renderLateReturnEmailHtml({ customerName = '', orderId, returnDate = '', message = '', gmachName = 'גמ"ח שמלות', gmachAddress = '', gmachPhone = '' }) {
  const bodyHtml = `
    ${callout({ kind: 'danger', title: 'ההחזרה טרם בוצעה', text: message })}
    ${kvCard([
      { label: 'מספר הזמנה', value: `#${orderId}`, strong: true },
      { label: 'תאריך החזרה', value: returnDate },
    ], 'red')}
    ${paragraphs('אם השמלות כבר הוחזרו, אפשר להתעלם מהודעה זו. לכל שאלה - אנחנו כאן.')}
  `;
  return renderEmail({
    tone: 'red', icon: '⚠️', kicker: 'תזכורת החזרה',
    title: `החזרה באיחור - הזמנה #${orderId}`,
    lead: customerName ? `שלום ${customerName},` : '',
    bodyHtml, gmachName, gmachAddress, gmachPhone,
  });
}

/** אישור ביצוע זיכוי - ירוק. */
export function renderRefundExecutedEmailHtml({ customerName = '', amount = 0, orderId = null, bankName = '', bankBranch = '', gmachName = 'גמ"ח שמלות', gmachPhone = '' }) {
  const bodyHtml = `
    <div dir="rtl" style="text-align:center;background:${T('green').light};border:2px solid ${T('green').soft};border-radius:16px;padding:22px 12px;margin:0 0 22px 0">
      <div style="font-size:13px;font-weight:700;color:${T('green').dark}">סכום הזיכוי</div>
      <div style="font-size:34px;font-weight:800;color:${T('green').dark};margin-top:2px">${formatShekel(amount)}</div>
    </div>
    ${kvCard([
      { label: 'מספר הזמנה', value: orderId ? `#${orderId}` : '' },
      { label: 'בנק', value: bankName },
      { label: 'סניף', value: bankBranch },
    ], 'green')}
    ${callout({ kind: 'success', text: 'הזיכוי יועבר לחשבון הבנק שנמסר לנו. הזמן עד שהסכום מופיע בחשבון תלוי בבנק שלכם.' })}
  `;
  return renderEmail({
    tone: 'green', icon: '💸', kicker: 'אישור זיכוי',
    title: 'הזיכוי בוצע',
    lead: customerName ? `שלום ${customerName}, בוצע עבורך זיכוי.` : 'בוצע עבורך זיכוי.',
    bodyHtml, gmachName, gmachPhone,
  });
}

/** דוח יומי למנהל - טורקיז. orders: [{orderId, customerName, eventDate, itemsCount}] */
export function renderDailyReportEmailHtml({ dateHebrew = '', orders = [], gmachName = 'גמ"ח שמלות' }) {
  const items = orders.reduce((s, o) => s + (Number(o.itemsCount) || 0), 0);
  const bodyHtml = `
    ${statTiles([{ label: 'הזמנות היום', value: orders.length }, { label: 'פריטים', value: items }], 'teal')}
    ${orders.length ? dataTable({
      headers: ['הזמנה', 'לקוח/ה', 'תאריך אירוע', 'פריטים'],
      rows: orders.map(o => [`#${o.orderId}`, o.customerName, o.eventDate, o.itemsCount]),
      tone: 'teal',
    }) : callout({ kind: 'neutral', text: 'לא נקלטו הזמנות חדשות היום.' })}
  `;
  return renderEmail({
    tone: 'teal', icon: '📊', kicker: 'דוח יומי',
    title: `דוח יומי - ${dateHebrew}`,
    lead: 'סיכום ההזמנות שנקלטו במערכת היום.',
    bodyHtml, gmachName,
  });
}

/** דוח ברקודים שהוקלדו ידנית - טורקיז. items: [{orderId, barcode, description}] */
export function renderManualBarcodesEmailHtml({ dateHebrew = '', items = [], gmachName = 'גמ"ח שמלות' }) {
  const bodyHtml = `
    ${statTiles([{ label: 'ברקודים ידניים', value: items.length }], 'teal')}
    ${dataTable({ headers: ['הזמנה', 'ברקוד', 'פריט'], rows: items.map(i => [`#${i.orderId}`, i.barcode, i.description]), tone: 'teal', ltrCols: [1] })}
    ${callout({ kind: 'info', text: 'ברקוד שהוקלד ידנית לא נסרק - כדאי לוודא שהפריט שנרשם בהזמנה הוא הפריט שנמסר בפועל.' })}
  `;
  return renderEmail({
    tone: 'teal', icon: '🏷️', kicker: 'דוח ברקודים',
    title: 'ברקודים שהוקלדו ידנית',
    lead: `הפריטים שנרשמו ללא סריקה ב-${dateHebrew}.`,
    bodyHtml, gmachName,
  });
}

/** הודעה פנימית בין עובדים (מסך ההודעות) - סגול. */
export function renderInternalMessageEmailHtml({ title = 'הודעה חדשה', bodyText = '', senderName = '', gmachName = 'גמ"ח שמלות' }) {
  const bodyHtml = `
    ${senderName ? kvCard([{ label: 'מאת', value: senderName, strong: true }], 'violet') : ''}
    <div style="background:${T('violet').light};border:1px solid ${T('violet').soft};border-radius:14px;padding:18px 18px 2px 18px;margin:0 0 20px 0">${paragraphs(bodyText)}</div>
    ${callout({ kind: 'neutral', text: 'ההודעה המלאה זמינה גם במסך ההודעות במערכת.' })}
  `;
  return renderEmail({ tone: 'violet', icon: '💬', kicker: 'הודעה פנימית', title, bodyHtml, gmachName });
}

/** דיווח תקלה חדש (למתכנת) - כתום. בלי בלוק ה-AI_DATA שנשאר רק בגוף הטקסטואלי. */
export function renderErrorReportEmailHtml({ employeeName, time, title, url, userText, lastButtons = [], gmachName = 'גמ"ח שמלות' }) {
  const bodyHtml = `
    ${kvCard([
      { label: 'מדווח/ת', value: employeeName, strong: true },
      { label: 'זמן', value: time },
      { label: 'חלון/דף', value: title },
      { label: 'כתובת', value: url, ltr: true },
    ], 'amber')}
    ${sectionTitle('5 הפעולות האחרונות', 'amber')}
    ${lastButtons && lastButtons.length ? numberedList(lastButtons, 'amber') : callout({ kind: 'neutral', text: 'אין פעולות מתועדות' })}
    ${sectionTitle('תיאור מהמשתמש', 'amber')}
    <div style="background:${T('amber').light};border:1px solid ${T('amber').soft};border-radius:14px;padding:16px 18px 2px 18px;margin:0 0 20px 0">${paragraphs(userText || '')}</div>
  `;
  return renderEmail({ tone: 'amber', icon: '🐞', kicker: 'דיווח תקלה - לטיפול AI', title: 'דיווח תקלה חדש', bodyHtml, gmachName });
}

/** שרשור תגובות (ErrorReportReply) כרשימת "בועות" - כל פריט: {authorLabel, text, isBot}. */
function threadTranscript(replies, tone) {
  const list = (replies || []).filter(r => r && r.text);
  if (list.length === 0) return '';
  const t = T(tone);
  const items = list.map(r => `
    <div style="background:${r.isBot ? '#f5f2ee' : '#ffffff'};border:1px solid ${t.soft};border-radius:12px;padding:12px 16px;margin:0 0 10px 0">
      <div dir="rtl" style="${RTL_INLINE_STYLE};font-size:12.5px;font-weight:800;color:${t.dark};margin-bottom:4px">${esc(r.authorLabel)}${r.isBot ? ' 🤖' : ''}</div>
      <div dir="rtl" style="${RTL_INLINE_STYLE};font-size:14px;line-height:1.7;color:#3b3333">${textToHtml(r.text)}</div>
    </div>`).join('');
  return `${sectionTitle('שרשור התגובות עד כה', tone)}${items}`;
}

/** התבקש מענה אנושי בדיווח תקלה - אדום. replies (אופציונלי): [{authorLabel, text, isBot}] - שרשור התגובות המלא עד לרגע הבקשה. */
export function renderHumanRequestedEmailHtml({ reporterName = '', pageTitle = '', description = '', replies = [], gmachName = 'גמ"ח שמלות' }) {
  const bodyHtml = `
    ${kvCard([{ label: 'מדווח/ת', value: reporterName, strong: true }, { label: 'חלון/דף', value: pageTitle }], 'red')}
    ${sectionTitle('תיאור התקלה המקורי', 'red')}
    <div style="background:${T('red').light};border:1px solid ${T('red').soft};border-radius:14px;padding:16px 18px 2px 18px;margin:0 0 20px 0">${paragraphs(description)}</div>
    ${threadTranscript(replies, 'red')}
    ${callout({ kind: 'warning', title: 'הסוכן האוטומטי ידלג על הדיווח הזה', text: 'יש לענות בעצמכם בשרשור הדיווח.' })}
  `;
  return renderEmail({ tone: 'red', icon: '🙋', kicker: 'נדרש מענה אנושי', title: 'התבקש מענה אנושי', lead: `${reporterName} ביקש/ה מענה ישיר במקום המענה האוטומטי.`, bodyHtml, gmachName });
}

/** סיכום שינויי קוד הממתינים לאישור (סוכן אוטומטי) - סגול. prs: [{number,title,branch,created,excerpt,url}] */
export function renderAgentDigestEmailHtml({ prs = [], gmachName = 'גמ"ח שמלות' }) {
  const cards = prs.map(pr => `
    <div style="border:1px solid ${T('violet').soft};border-right:5px solid ${T('violet').main};border-radius:12px;background:#ffffff;padding:14px 16px;margin:0 0 12px 0">
      <div dir="rtl" style="${RTL_INLINE_STYLE};font-size:15px;font-weight:800;color:${T('violet').dark}">#${esc(pr.number)} · ${esc(pr.title)}</div>
      <div dir="rtl" style="${RTL_INLINE_STYLE};font-size:12.5px;color:#7a6f66;margin:4px 0 6px 0">נפתח: ${esc(pr.created)} · ענף: <span dir="ltr">${esc(pr.branch)}</span></div>
      ${pr.excerpt ? `<div dir="rtl" style="${RTL_INLINE_STYLE};font-size:13.5px;color:#4a4141;line-height:1.7;margin-bottom:8px">${esc(pr.excerpt)}</div>` : ''}
      <a href="${esc(pr.url)}" style="font-size:13px;font-weight:800;color:${T('violet').main};text-decoration:none">לפתיחה ב-GitHub ←</a>
    </div>`).join('');
  const bodyHtml = `
    ${statTiles([{ label: 'ממתינים לאישור', value: prs.length }], 'violet')}
    ${cards}
    ${callout({ kind: 'info', title: 'איך ממזגים?', text: 'נכנסים ל-PR הרלוונטי ב-GitHub ולוחצים Merge. הריפו משותף לשני הגמחים, כך שמיזוג PR אחד מעלה את התיקון לשניהם (Vercel פורס אוטומטית מ-main).' })}
  `;
  return renderEmail({ tone: 'violet', icon: '🤖', kicker: 'עדכון סוכן אוטומטי', title: `${prs.length} שינויי קוד ממתינים לאישור שלך`, lead: 'הסוכן האוטומטי הכין תיקונים (משני הגמחים) שממתינים למיזוג ידני.', bodyHtml, gmachName });
}

/** נתוני משלוחים למשלוחן - ירוק. groups: [{title, rows:[{customerName,address,customerPhone,customerPhone2}]}] */
export function renderCourierDeliveryEmailHtml({ groups, gmachName = 'גמ"ח שמלות' }) {
  const total = (groups || []).reduce((s, g) => s + (g.rows || []).length, 0);
  const sections = (groups || []).map(group => `
    ${sectionTitle(`🚚 ${group.title}`, 'green')}
    ${dataTable({
      headers: ['שם מלא', 'כתובת', 'טלפון 1', 'טלפון 2'],
      rows: (group.rows || []).map(r => [r.customerName, r.address, r.customerPhone, r.customerPhone2]),
      tone: 'green', ltrCols: [2, 3],
    })}`).join('');
  const bodyHtml = `
    ${statTiles([{ label: 'משלוחים', value: total }, { label: 'קבוצות', value: (groups || []).length }], 'green')}
    ${sections || callout({ kind: 'neutral', text: 'אין משלוחים בטווח/כיוון שנבחר.' })}
  `;
  return renderEmail({ tone: 'green', icon: '🚚', kicker: 'נתוני משלוחים', title: 'נתוני משלוחים למשלוחן', lead: 'רשימת הכתובות והטלפונים לחלוקה.', bodyHtml, gmachName });
}

// ---------------------------------------------------------------------------
// גלריה - כל המיילים במייל אחד (למסך /admin/email-test ולשליחת הדוגמאות)
// ---------------------------------------------------------------------------

/**
 * מאחד מיילים מלאים לדף אחד: כותרת, תוכן עניינים, ואז כל מייל בכרטיס משלו עם כותרת הסבר.
 * כדי לחסוך משקל (Gmail חותך מיילים מעל ~100KB) מחליף מחרוזות style שחוזרות הרבה פעמים בשמות
 * class ומגדיר אותן פעם אחת ב-<style>.
 * @param {Array<{name:string, subject:string, note?:string, html:string}>} entries
 */
export function renderEmailGallery(entries, { title = 'כל מיילי המערכת - דוגמאות' } = {}) {
  const t = T('plum');
  const toc = entries.map((e, i) => `<div dir="rtl" style="${RTL_INLINE_STYLE};padding:3px 0;font-size:14px;color:#3b3333"><span style="display:inline-block;min-width:26px;font-weight:800;color:${t.main}">${i + 1}.</span>${esc(e.name)}</div>`).join('');
  const sections = entries.map((e, i) => `
    <div dir="rtl" style="${RTL_INLINE_STYLE};max-width:600px;margin:26px auto 0 auto;padding:0 12px">
      <div style="background:#2b2424;color:#ffffff;border-radius:12px;padding:12px 16px">
        <div style="font-size:15px;font-weight:800"><span style="color:#f1b6cb">${i + 1}/${entries.length}</span> · ${esc(e.name)}</div>
        <div style="font-size:12.5px;opacity:.85;margin-top:3px">נושא: ${esc(e.subject)}</div>
        ${e.note ? `<div style="font-size:12px;opacity:.7;margin-top:2px">${esc(e.note)}</div>` : ''}
      </div>
    </div>
    ${extractEmailCard(e.html)}`).join('');
  const cover = `
    <div dir="rtl" style="${RTL_INLINE_STYLE};background:#f3eee8;padding:26px 12px 0 12px;font-family:${SANS}">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;border-top:8px solid ${t.main};padding:26px 28px">
        <div style="font-size:26px;font-weight:800;color:${t.dark};margin-bottom:6px">${esc(title)}</div>
        <div style="font-size:14.5px;line-height:1.8;color:#5b5148;margin-bottom:14px">${entries.length} מיילים לדוגמה, כפי שיוצאים מהמערכת - עם נתוני דמה (והזמנה אמיתית אחת בצרופות). מתחת לכל כותרת שחורה מופיע המייל עצמו.</div>
        ${toc}
      </div>
    </div>`;
  const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3eee8">${cover}${sections}<div style="height:30px"></div></body></html>`;
  return compressRepeatedStyles(html);
}

function compressRepeatedStyles(html) {
  const counts = new Map();
  for (const m of html.matchAll(/ style="([^"]{60,})"/g)) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  const repeated = [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] * b[0].length - a[1] * a[0].length);
  let css = '';
  let out = html;
  repeated.forEach(([style], i) => {
    const cls = `c${i}`;
    css += `.${cls}{${style}}`;
    out = out.split(` style="${style}"`).join(` class="${cls}"`);
  });
  return css ? out.replace('<head>', `<head><style>${css}</style>`) : out;
}
