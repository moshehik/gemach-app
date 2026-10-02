// app/components/schedule/print/pages/PP16.js — תבנית "דף קבלת החזרות" (דף 16). נתונים: lib/schedule/print/pages/PP-16.js build().
// עיצוב: p16() בתצוגה - הנחיה בראש הדף; קבוצות "מחזירות היום" / "באיחור"; בלוק לכל משפחה (תיבת "התקבל", שם משפחה,
// הזמנה, טלפון, [דגל איחור], ברקוד MRT-<הזמנה>), שורת כתובת + כמות פריטים, וטבלת פריטים: פריט (k מתוך n), דגם, מידה,
// "מצב הפריט" (תיבות תקין / לא תקין) ו"אם לא תקין: מה הבעיה" (שורה לכתיבה). בלי כסף, בלי סניף.
import { Fragment } from 'react';
import { Sheet, Phone, Check, Flag, Line, Note, EmptyBody } from '../PrintShell';
import Code39 from '../Code39';
import { lateText } from '@/lib/schedule/print/pages/PP-16';
import './pp16.css';

export default function PP16({ meta, page }) {
  const d = page.data;
  return (
    <Sheet meta={meta} page={page}>
      {d.empty ? <EmptyBody /> : (
        <>
          <Note>
            <b>החזרה עד השעה {d.returnHour}</b> <span>(שעת ההחזרה הרגילה מההגדרות)</span>
            <span>לכל פריט מסמנים ׳תקין׳ או ׳לא תקין׳. כשלא תקין כותבים מה הבעיה.</span>
          </Note>
          {d.sections.map((s) => (
            <Fragment key={s.key}>
              <div className="pp-dg">{s.label} <span>{s.note}</span></div>
              {s.blocks.map((b) => <Family key={b.orderId} b={b} />)}
            </Fragment>
          ))}
        </>
      )}
    </Sheet>
  );
}

function Family({ b }) {
  return (
    <div className="pp-ob">
      <div className="pp-ob-h">
        <span className="pp-ck lg" aria-label="התקבל" title="התקבל" />
        <b>{b.name}</b>
        <span>הזמנה #{b.orderId}</span>
        <span><Phone value={b.phone} /></span>
        {b.lateDays ? <Flag filled={b.lateSevere}>{lateText(b.lateDays)}</Flag> : null}
        <span className="sp pp-mrt-bc"><Code39 code={b.code} height={5} unit={0.17} label={false} /><small>{b.code}</small></span>
      </div>
      <div className="pp-ob-n">
        כתובת: {b.addressMissing ? <><Flag>חסרה כתובת</Flag> {b.city}</> : `${b.street}, ${b.city}`} · {b.itemCount === 1 ? 'פריט אחד' : `${b.itemCount} פריטים`}
      </div>
      <table className="pp-t">
        <thead>
          <tr>
            <th className="c">פריט</th><th>דגם</th><th className="c">מידה</th><th className="c">מצב הפריט</th><th>אם לא תקין: מה הבעיה</th>
          </tr>
        </thead>
        <tbody>
          {b.items.map((it) => (
            <tr key={it.n}>
              <td className="c">{it.n} מתוך {it.of}</td>
              <td><b>{it.model}</b>{it.state ? <small className="pp-st">{it.state}</small> : null}</td>
              <td className="c">{it.size}</td>
              <td className="c nowrap">
                <span className="pp-nw"><Check /> תקין</span> &nbsp; <span className="pp-nw"><Check /> לא תקין</span>
              </td>
              <td className="pp-prob"><Line size="w" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
