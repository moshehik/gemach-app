// app/components/schedule/print/pages/PP11.js — תבנית "רשימת שליח לפי עיר" (דף 11). נתונים: lib/schedule/print/pages/PP-11.js.
// עיצוב: routePage() בתצוגה - הערה רכה, טבלה: נמסר (תיבה), עצירה, שם (+ "הזמנה #"), רחוב ומספר, טלפונים, שמלות, הערה (קו
// למילוי), סימון (ברקוד DOT-<הזמנה>); שורת קבוצה לכל עיר עם מספר העצירות והשמלות. `RouteSheet` משותף (PP-19: איסוף).
import { Sheet, SheetTable, GroupRow, Phone, Flag, Check, Note, EmptyBody } from '../PrintShell';
import Code39 from '../Code39';
import { cnt } from '@/lib/schedule/print/format';
import './pp11.css';

const dressesText = (n) => cnt(n, 'שמלה אחת', 'שמלות');

function columns(out) {
  return [
    { key: 'done', label: out ? 'נמסר' : 'נאסף', c: true, render: () => <Check lg /> },
    { key: 'stop', label: 'עצירה', c: true, render: (r) => <b>{r.stop}</b> },
    { key: 'name', label: 'שם', render: (r) => <><b>{r.name}</b><small>הזמנה #{r.orderId}</small></> },
    { key: 'street', label: 'רחוב ומספר', render: (r) => (r.street ? r.street : <Flag>חסרה כתובת</Flag>) },
    { key: 'phones', label: 'טלפונים', render: (r) => <><Phone value={r.phone1} />{r.phone2 ? <small><Phone value={r.phone2} /></small> : null}</> },
    { key: 'dressCount', label: 'שמלות', c: true },
    { key: 'remark', label: 'הערה', render: () => <span className="pp-ul pp-p11-rm" /> },
    { key: 'code', label: 'סימון', c: true, bcc: true, render: (r) => <Code39 code={r.code} height={6} unit={0.19} /> },
  ];
}

export function RouteSheet({ meta, page, out = true }) {
  const d = page.data;
  const cols = columns(out);
  return (
    <Sheet meta={meta} page={page}>
      {d.empty ? <EmptyBody /> : (
        <>
          <Note soft>
            <b>{out ? 'מסלול משלוח הלוך' : 'מסלול איסוף מלקוחות'}</b>{' '}
            {out ? 'מקובץ לפי עיר. מסמנים ׳נמסר׳ בכל עצירה.' : 'מקובץ לפי עיר. בכל איסוף מוודאים שמספר השמלות תואם לרשימה.'}
          </Note>
          <SheetTable columns={cols} rows={[]}>
            {d.groups.map((g) => (
              <CityRows key={g.key} group={g} cols={cols} />
            ))}
          </SheetTable>
        </>
      )}
    </Sheet>
  );
}

function CityRows({ group, cols }) {
  return (
    <>
      <GroupRow span={cols.length} label={group.city} note={`${cnt(group.rows.length, 'עצירה אחת', 'עצירות')} · ${dressesText(group.dresses)}`} />
      {group.rows.map((r) => (
        <tr key={r.orderId}>
          {cols.map((c) => (
            <td key={c.key} className={[c.c ? 'c' : '', c.bcc ? 'bcc' : ''].filter(Boolean).join(' ') || undefined}>
              {c.render ? c.render(r) : r[c.key]}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function PP11({ meta, page }) {
  return RouteSheet({ meta, page, out: true });
}
