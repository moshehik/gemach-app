// app/components/schedule/print/pages/PP03.js — תבנית "דף תיקונים לביצוע" (דף 03), שתי גרסאות.
// נתונים: lib/schedule/print/pages/PP-03.js build(). עיצוב: p03() / p03b() בדפי-הדפסה-עיצוב.html.
//   גרסה א (לפי תאריך והזמנה): כותרת תאריך אירוע, בלוק לכל הזמנה (.pp-ob) עם טבלת פריטים, שורת סיכום (.pp-dsum).
//   גרסה ב (לפי דגם ומידה): הערה, טבלה אחת עם שורת קבוצה לכל דגם וברקוד פריט בכל שורה, שורת סיכום.
import { Sheet, SheetTable, GroupRow, Note, Check, Phone, EmptyBody } from '../PrintShell';
import Code39 from '../Code39';
import RowCode from './ppCode';
import './pp03.css';

const A_COLUMNS = [
  { key: 'model', label: 'דגם שמלה' },
  { key: 'size', label: 'מידה', c: true },
  { key: 'qty', label: 'כמות', c: true },
  { key: 'neck', label: 'תיקון צוואר' },
  { key: 'len', label: 'תיקון אורך' },
  { key: 'sleeve', label: 'תיקון שרוול' },
  { key: 'det', label: 'תיאור תיקון' },
  { key: 'done', label: 'בוצע', c: true },
];
const B_COLUMNS = [
  { key: 'done', label: 'בוצע', c: true },
  { key: 'size', label: 'מידה', c: true },
  { key: 'who', label: 'הזמנה · לקוחה' },
  { key: 'ev', label: 'אירוע' },
  { key: 'neck', label: 'צוואר' },
  { key: 'len', label: 'אורך' },
  { key: 'sleeve', label: 'שרוול' },
  { key: 'det', label: 'תיאור תיקון' },
  { key: 'code', label: 'סימון', c: true },
];

export default function PP03({ meta, page }) {
  const d = page.data;
  if (d.empty) return <Sheet meta={meta} page={page}><EmptyBody /></Sheet>;
  return (
    <Sheet meta={meta} page={page}>
      {d.version === 'b' ? <ByModel d={d} /> : <ByDate d={d} />}
    </Sheet>
  );
}

const cell = (c, content) => <td key={c.key} className={c.c ? 'c' : undefined}>{content}</td>;

function ByDate({ d }) {
  return (
    <div className="pp03a">
      {d.days.map((day) => (
        <section key={day.key} className="pp03-day">
          <div className="pp-dg">{day.label}<span>{day.greg}</span></div>
          {day.orders.map((o) => (
            <div className="pp-ob" key={o.orderId}>
              <div className="pp-ob-h">
                <b>{o.name}</b>
                <span>טלפון: <Phone value={o.phone} /></span>
                <span>הזמנה מס׳ {o.orderId}</span>
                <span className="sp"><Code39 code={o.code} height={6} unit={0.19} label={false} /></span>
              </div>
              {o.notes ? <div className="pp-ob-n">הערות: {o.notes}</div> : null}
              <SheetTable columns={A_COLUMNS} rows={[]}>
                {o.rows.map((r) => (
                  <tr key={r.code}>
                    {cell(A_COLUMNS[0], <b>{r.model}</b>)}
                    {cell(A_COLUMNS[1], r.size)}
                    {cell(A_COLUMNS[2], 1)}
                    {cell(A_COLUMNS[3], r.neck ? 'הצרה ' + r.neck : '')}
                    {cell(A_COLUMNS[4], r.len)}
                    {cell(A_COLUMNS[5], r.sleeve ? 'הארכה ' + r.sleeve : '')}
                    {cell(A_COLUMNS[6], r.det)}
                    {cell(A_COLUMNS[7], <Check />)}
                  </tr>
                ))}
              </SheetTable>
            </div>
          ))}
          <span className="pp-dsum">{day.tallyText}</span>
        </section>
      ))}
    </div>
  );
}

function ByModel({ d }) {
  return (
    <div className="pp03b">
      <Note soft><b>מקובץ לפי דגם ואחר כך לפי מידה.</b> כל השמלות מאותו דגם יחד, כדי לתפור אותן ברצף. בכל שורה: מי הלקוחה ומתי האירוע.</Note>
      <SheetTable columns={B_COLUMNS} rows={[]}>
        {d.groups.map((g) => (
          <GroupBlock key={g.key} g={g} />
        ))}
      </SheetTable>
      <span className="pp-dsum pp03-total">{d.tallyText}</span>
    </div>
  );
}

function GroupBlock({ g }) {
  return (
    <>
      <GroupRow span={B_COLUMNS.length} label={<>{g.label}{' '}</>} note={g.note} />
      {g.rows.map((r) => (
        <tr key={r.code}>
          <td className="c"><Check /></td>
          <td className="c"><b>{r.size}</b></td>
          <td className="nowrap">#{r.orderId}<small>{r.name}</small></td>
          <td className="nowrap">{r.eventShort}</td>
          <td>{r.neck ? 'הצרה ' + r.neck : ''}</td>
          <td>{r.len}</td>
          <td>{r.sleeve ? 'הארכה ' + r.sleeve : ''}</td>
          <td>{r.det}</td>
          <td className="bcc"><RowCode code={r.code} /></td>
        </tr>
      ))}
    </>
  );
}
