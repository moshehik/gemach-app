// app/components/schedule/print/PrintShell.js — המעטפת המשותפת של דפי ההדפסה של הלו״ז.
//
// מקור העיצוב: shell() ב-תצוגות-עיצוב/דפי-הדפסה-עיצוב.html (כותרת: בס״ד, שם הגמ״ח, כתובת וטלפון, תאריך עברי
// ולועזי, ברקוד "כל הדף"; פס כותרת: תג השלב, שם הדף, שורת משנה, סיכום; תחתית: "הופק מהמערכת · תאריך · שעה ·
// מי הדפיס/ה" + "עמוד X מתוך Y"). ההבדל מהתצוגה: שם היה גיליון בגובה קבוע; כאן הגיליון זורם על כמה עמודים -
// הכותרת והתחתית חוזרות בכל עמוד דרך thead/tfoot של טבלת המעטפת, ומספור העמודים מגיע מ-@page (print.css).
//
// רכיבים:
//   <PrintDocument payload status>   .pp-root + .pp-paper; מרנדר Sheet לכל דף במטען (או הודעת מצב)
//   <Sheet meta page sheetIndex of>   גיליון אחד (כותרת/פס/גוף/תחתית). ילדים = גוף הדף.
//   <SheetTable>, <Stats>, <Money>, <Phone>, <Check>, <Flag>, <Line>  חלקי גוף שחוזרים בכל הדפים (כמו בעיצוב).
// הדפים עצמם: app/components/schedule/print/pages/PPxx.js (מפת templates.js).
import Code39 from './Code39';
import { money as fmtMoney } from '@/lib/schedule/print/format';
import { getTemplate } from './templates';

export function PrintDocument({ payload, status = null, preview = false }) {
  return (
    <div className={'pp-root' + (preview ? ' pp-preview' : '')} dir="rtl" lang="he" data-tone="bw">
      <div className="pp-paper">
        {status ? <div className={'pp-status ' + (status.kind || 'info')} role={status.kind === 'err' ? 'alert' : 'status'}>{status.text}</div> : null}
        {payload ? payload.pages.map((page) => <PageSheets key={page.key} meta={payload.meta} page={page} />) : null}
      </div>
    </div>
  );
}

function PageSheets({ meta, page }) {
  if (page.notBuilt) {
    return (
      <Sheet meta={meta} page={page} title={page.def.label} sub="הדף רשום באשף ועדיין לא נבנה" nobc>
        <p className="pp-empty">הדף &quot;{page.def.label}&quot; עדיין בבנייה.</p>
      </Sheet>
    );
  }
  // המפה סטטית (templates.js) - הקומפוננטה לא נוצרת ברינדור, רק נבחרת לפי המפתח
  const template = getTemplate(page.key);
  if (!template) {
    return (
      <Sheet meta={meta} page={page} title={page.def.label} sub="חסרה תבנית לדף" nobc>
        <p className="pp-empty">חסרה תבנית הדפסה לדף {page.key}.</p>
      </Sheet>
    );
  }
  return template({ meta, page });
}

/**
 * גיליון אחד. props:
 *   meta, page              מהמטען (page.def.chip = תג השלב; page.def.barcode; page.pageCode)
 *   title / sub / sum       פס הכותרת (ברירת מחדל מ-page.data)
 *   code / codeNote         ברקוד הכותרת (ברירת מחדל: page.pageCode = ALL-…; דף "הזמנה בכל עמוד" מעביר DOT-40113)
 *   nobc                    בלי ברקוד (דפי מידע 01/02/15 - נגזר אוטומטית מ-page.def.barcode === null)
 *   slim                    כותרת צרה (מדבקות)
 *   sheetIndex / sheetCount מספור ידני "עמוד X מתוך Y" במסך כשדף מורכב מכמה גיליונות (07ב, 12); בהדפסה המספור
 *                           מגיע מ-@page ולכן הטקסט כאן מוסתר ב-print.css
 */
export function Sheet({ meta, page, title, sub, sum, code, codeNote, nobc, slim, children, sheetIndex, sheetCount }) {
  const data = (page && page.data) || {};
  const def = (page && page.def) || {};
  const noBarcode = nobc || !def.barcode;
  const bcCode = code || (page && page.pageCode) || null;
  const bcNote = codeNote || (def.info ? 'זיהוי הדף בלבד' : 'סימון כל הדף כבוצע');
  const bc = !noBarcode && bcCode ? <Code39 code={bcCode} height={slim || def.slim ? 6.5 : 8.5} unit={0.2} note={bcNote} /> : null;
  const foot = `הופק מהמערכת · ${meta.producedKey ? meta.producedKey.split('-').reverse().join('/') : meta.dateGreg} · ${meta.producedTime || ''}${meta.printedBy ? ' · הדפיס/ה: ' + meta.printedBy : ''}`;
  return (
    <table className={'pp-sheet' + (slim || def.slim ? ' slim' : '')} data-pid={def.key} data-bc="head" {...(noBarcode ? { 'data-nobc': '1' } : {})}>
      <thead>
        <tr><td>
          <header className="pp-head">
            <div className="pp-id">
              <div className="pp-bsd">בס״ד</div>
              <b>{meta.gmach.name}</b>
              <span>{[meta.gmach.address, meta.gmach.phone].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="pp-meta">
              <div className="pp-date">{meta.dateHebrew}<small>{meta.dateGreg}</small></div>
              {bc}
            </div>
          </header>
          <div className="pp-tb">
            <span className="pp-chip">{def.chip}</span>
            <h1>{title || data.title || def.label}</h1>
            <p>{sub !== undefined ? sub : data.sub}</p>
            <div className="pp-sum">{sum !== undefined ? sum : data.sum}</div>
          </div>
        </td></tr>
      </thead>
      <tfoot>
        <tr><td>
          <footer className="pp-foot">
            <span>{foot}</span>
            {sheetCount ? <span className="pp-pn">עמוד {sheetIndex} מתוך {sheetCount}</span> : <span className="pp-pn" aria-hidden="true" />}
          </footer>
        </td></tr>
      </tfoot>
      <tbody>
        <tr><td>
          <main className="pp-body">{children}</main>
        </td></tr>
      </tbody>
    </table>
  );
}

/** טבלת גוף (class="pp-t"). columns: [{ key, label, c?:boolean, render?(row) }] ; rows ; groupRows אופציונלי */
export function SheetTable({ columns, rows, footer = null, children }) {
  return (
    <table className="pp-t">
      <thead>
        <tr>{columns.map((c) => <th key={c.key} className={c.c ? 'c' : undefined}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {children || rows.map((r, i) => (
          <tr key={r.key ?? r.orderId ?? i}>
            {columns.map((c) => <td key={c.key} className={cellClass(c)}>{c.render ? c.render(r) : r[c.key]}</td>)}
          </tr>
        ))}
        {footer}
      </tbody>
    </table>
  );
}
function cellClass(c) {
  return [c.c ? 'c' : '', c.nowrap ? 'nowrap' : '', c.bcc ? 'bcc' : ''].filter(Boolean).join(' ') || undefined;
}

/** שורת קבוצה בתוך SheetTable: <GroupRow span={8}>יום רביעי… <span>12 אירועים</span></GroupRow> */
export function GroupRow({ span, label, note }) {
  return <tr className="g"><td colSpan={span}>{label}{note ? <span>{note}</span> : null}</td></tr>;
}

/** פס הסיכומים מעל הטבלה: [{ label, value } | { label, money }] */
export function Stats({ items }) {
  return (
    <div className="pp-stats">
      {items.map((it, i) => (
        <div key={i}>
          {it.label}{it.money !== undefined ? <> <b><Money value={it.money} /></b></> : it.value !== null && it.value !== undefined ? <> <b>{it.value}</b></> : null}
        </div>
      ))}
    </div>
  );
}

export function Money({ value }) {
  if (value === null || value === undefined || value === '') return null;
  return <span className="pp-num">{fmtMoney(value)}</span>;
}
export function Phone({ value }) {
  return value ? <span className="pp-ph">{value}</span> : <>-</>;
}
export function Check({ lg = false, n = 1 }) {
  if (n <= 1) return <i className={'pp-ck' + (lg ? ' lg' : '')} />;
  return <span className="pp-cks">{Array.from({ length: n }, (_, i) => <i key={i} className={'pp-ck' + (lg ? ' lg' : '')} />)}</span>;
}
export function Flag({ children, filled = false }) {
  return <span className={'pp-fl' + (filled ? ' f' : '')}>{children}</span>;
}
export function Line({ size = '' }) {
  return <span className={'pp-ul' + (size ? ' ' + size : '')} />;
}
export function Note({ soft = false, children }) {
  return <div className={'pp-note' + (soft ? ' soft' : '')}>{children}</div>;
}
export function EmptyBody() {
  return <p className="pp-empty">אין פריטים בדף זה</p>;
}
