'use client';

// רכיבים קטנים משותפים של דף הבית החדש: אייקון, מתג שורות/טבלה, כפתורי ייצוא, טבלה עם מיון.
// כל הרכיבים מהפלטה (design-system/COMPONENTS.md): בורר 1/44 (vsw), לחצן 8/62/9/20/63/64 (xlbtn), טבלה (rtbl).

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { sortRecords } from './homeLogic';
import { MenuSprite } from '../menu/menuParts';
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';
import { useA5Shell } from '../menu/A5ShellContext';

// אייקון מה-sprite של הפלטה, בהפניה פנימית (#gmi-<שם>) ל-sprite שמוטמע בתוך הדף (ר' HomeSprite).
// לא הפניה חיצונית לקובץ sprite.svg: מסנני תוכן של אינטרנט מסונן (Netspark וכד') מחליפים את
// קובץ ה-SVG בריבוע לבן 2x2 והאייקונים נעלמים (אותה בעיה והסבר מלא ב-app/components/menu/menuParts.js).
export function Ic({ id, size, className }) {
  const cls = 'ic' + (size ? ' ' + size : '') + (className ? ' ' + className : '');
  return (
    <svg className={cls} aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${id}`} /></svg>
  );
}

// ה-sprite המוטמע חייב להיות בדף בדיוק פעם אחת. במעטפת החדשה (MenuA5Shell) הוא כבר שם; כשהמעטפת 'legacy'
// (דף הבית החדש עם תפריט ישן) או שה-layout נפל חזרה ל-AppShell (למשל מסך כניסה: menuTree=null) אין מי שמטמיע אותו,
// ולכן הדף מטמיע בעצמו. ההכרעה לפי ה-A5ShellContext שהמעטפת החדשה מספקת בפועל, לא לפי דגל, כדי שלא יהיה כפול ולא חסר.
export function HomeSprite() {
  return useA5Shell() ? null : <MenuSprite />;
}

// מתג תצוגה: שורות / טבלה (בית 13)
export function ViewSwitch({ table, onChange }) {
  return (
    <div className={`vsw${table ? ' t' : ''}`} role="group" aria-label="מצב תצוגה">
      <span className="vknob" aria-hidden="true" />
      <button type="button" className={`vopt${!table ? ' on' : ''}`} aria-pressed={!table} aria-label="מצב שורות" data-tip="מצב שורות" onClick={() => onChange(false)}><Ic id="rows" size="sm" /></button>
      <button type="button" className={`vopt${table ? ' on' : ''}`} aria-pressed={table} aria-label="מצב טבלה" data-tip="מצב טבלה" onClick={() => onChange(true)}><Ic id="table" size="sm" /></button>
    </div>
  );
}

// Excel / הדפסה / הורדה לתוצאות (לחצן 8/9/63). כשמועבר onPdf, לחצן ההורדה (63) הוא הורדת PDF של דף ההדפסה המעוצב
// (searchPdf.js) — אותו לחצן ואותו עיצוב, רק התווית והפעולה משתנות; בלי onPdf = הורדת קובץ (CSV) כמו קודם.
export function XlButtons({ onExcel, onPrint, onDownload, onPdf }) {
  return (
    <>
      <button type="button" className="xlbtn xlg" aria-label="ייצוא ל-Excel" data-tip="ייצוא לקובץ Excel" onClick={onExcel}>
        <svg className="xlic" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3" fill="#107C41" /><path d="M5 4.5l6 7M11 4.5l-6 7" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none" /></svg>
      </button>
      <button type="button" className="xlbtn xlp" aria-label="הדפסה" data-tip="הדפסת התוצאות" onClick={onPrint}>
        <PrintGlyph />
      </button>
      <button
        type="button"
        className="xlbtn xld"
        aria-label={onPdf ? 'הורדת PDF' : 'הורדה'}
        data-tip={onPdf ? 'הורדת התוצאות כקובץ PDF' : 'הורדת התוצאות כקובץ'}
        onClick={onPdf || onDownload}
      >
        <DownloadGlyph />
      </button>
    </>
  );
}

export function PrintGlyph() {
  return (
    <svg className="prtic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#1e63c4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path className="prt-top" d="M4.5 5.5V2h7v3.5" /><rect x="1.5" y="5.5" width="13" height="6" rx="1.6" /><g className="prt-sheet"><rect x="4.5" y="9" width="7" height="5.5" rx=".6" fill="#fff" /><path d="M6.3 11.2h3.4M6.3 12.9h2.2" strokeWidth="1" /></g></svg>
  );
}
export function DownloadGlyph() {
  return (
    <svg className="dlic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#a83d6c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><g className="dl-arrow"><path d="M8 2v7.5M5 6.8l3 3 3-3" /></g><path d="M2.5 11.5v1.2a1.3 1.3 0 0 0 1.3 1.3h8.4a1.3 1.3 0 0 0 1.3-1.3v-1.2" /></svg>
  );
}

// "עוד N" / "להציג פחות" (שורה מורחבת)
export function MoreButton({ open, extra, onToggle }) {
  return (
    <button type="button" className="lrow block" style={{ marginTop: 8 }} aria-expanded={open} onClick={onToggle}>
      <Ic id={open ? 'minus' : 'plus'} size="sm" />{open ? 'להציג פחות' : `עוד ${extra}`}
    </button>
  );
}

export const Dash = () => <span className="faint">—</span>;

// טבלת תוצאות (rtbl) עם חיצי מיון לכל עמודה. records: [{ url, cells, alert? }]; renderCell(value, colIndex, record) → צומת.
// הקישור בטבלה הוא בתא linkCol (בדרך כלל השם).
export function ResultsTable({ columns, records, linkCol, renderCell, rowLimit }) {
  const [sort, setSort] = useState(null); // { col, dir }
  const sig = columns.join('|');
  const [sigSeen, setSigSeen] = useState(sig);
  if (sig !== sigSeen) { setSigSeen(sig); setSort(null); } // מיון נשמר רק בין רינדורים של אותה טבלה
  const sorted = useMemo(() => {
    const plain = records.map((r) => ({ ...r, cells: r.cells.map((c) => (Array.isArray(c) ? c[0] : c)), __orig: r }));
    return (sort ? sortRecords(plain, sort.col, sort.dir) : plain).map((r) => r.__orig);
  }, [records, sort]);
  const shown = rowLimit ? sorted.slice(0, rowLimit) : sorted;
  const wrapRef = useRef(null);
  // טבלה רחבה מהחלון: מרחיבים את החלון (hero-in) במקום גלילה הצידה (כמו advFit בעיצוב)
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const shell = wrap && wrap.closest('.hero-in');
    if (!shell) return undefined;
    const fit = () => {
      shell.style.maxWidth = '';
      const need = wrap.scrollWidth - wrap.clientWidth;
      if (need > 0) shell.style.maxWidth = Math.min(document.documentElement.clientWidth - 32, shell.getBoundingClientRect().width + need + 4) + 'px';
    };
    fit();
    window.addEventListener('resize', fit);
    return () => { window.removeEventListener('resize', fit); shell.style.maxWidth = ''; };
  });
  const toggle = (col, dir) => setSort((cur) => (cur && cur.col === col && cur.dir === dir ? null : { col, dir }));
  return (
    <div className="tblw" ref={wrapRef}>
      <table className="rtbl">
        <thead>
          <tr>
            {columns.map((c, i) => {
              const on = sort && sort.col === i;
              return (
                <th key={c + i} className={`${i === 0 && c === 'סוג' ? 'tc ' : ''}${on ? 'sorted ' + (sort.dir === 1 ? 'asc' : 'desc') : ''}`.trim() || undefined}>
                  <span className="thw">
                    <span className="thl">{c}</span>
                    <span className="tsort">
                      <button type="button" className="tsb tu" data-tip="סדר מהגבוה לנמוך" aria-label={`מיון לפי ${c}: מהגבוה לנמוך`} onClick={() => toggle(i, -1)}><svg viewBox="0 0 10 7" aria-hidden="true"><path d="M5 .5L9.5 6.5H.5z" /></svg></button>
                      <button type="button" className="tsb td" data-tip="סדר מהנמוך לגבוה" aria-label={`מיון לפי ${c}: מהנמוך לגבוה`} onClick={() => toggle(i, 1)}><svg viewBox="0 0 10 7" aria-hidden="true"><path d="M5 6.5L9.5 .5H.5z" /></svg></button>
                    </span>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, ri) => (
            <tr key={ri} className={r.alert ? 'ralert' : undefined}>
              {r.cells.map((c, j) => {
                const content = renderCell ? renderCell(c, j, r) : c;
                return (
                  <td key={j} className={j === 0 && columns[0] === 'סוג' ? 'tc' : undefined}>
                    {j === linkCol && r.url
                      ? <Link className="trl" href={r.url}>{content}</Link>
                      : content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
