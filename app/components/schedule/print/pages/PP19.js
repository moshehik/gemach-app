// app/components/schedule/print/pages/PP19.js — תבנית "רשימת איסוף מלקוחות לפי עיר" (דף 19). נתונים: lib/schedule/print/pages/PP-19.js build().
// עיצוב: routePage('19','return') בתצוגה: הערת מסלול, ואז טבלה מקובצת לפי עיר (שורת קבוצה לכל עיר): נאסף (תיבה),
// עצירה (מספר רץ), שם (+ הזמנה #), רחוב ומספר, טלפונים, שמלות, הערה (קו לכתיבה), סימון (ברקוד DBK-<הזמנה>).
import { Sheet, SheetTable, GroupRow, Note, Phone, Check, Flag, EmptyBody } from '../PrintShell';
import Code39 from '../Code39';
import { cnt } from '@/lib/schedule/print/format';
import './pp-table-theme-leaks.css';
import './pp19.css';

const COLUMNS = [
  { key: 'done', label: 'נאסף', c: true, render: (r) => (r.done ? <Flag>נאסף</Flag> : <Check lg />) },
  { key: 'stop', label: 'עצירה', c: true, render: (r) => <b>{r.stop}</b> },
  { key: 'name', label: 'שם', render: (r) => <><b>{r.name}</b><small>הזמנה #{r.orderId}</small></> },
  { key: 'street', label: 'רחוב ומספר', render: (r) => (r.street ? r.street : <Flag>חסרה כתובת</Flag>) },
  { key: 'phones', label: 'טלפונים', render: (r) => <><Phone value={r.phone} />{r.phone2 ? <small><Phone value={r.phone2} /></small> : null}</> },
  { key: 'dressCount', label: 'שמלות', c: true },
  { key: 'note', label: 'הערה', render: (r) => <>{r.notes ? <small>{r.notes}</small> : null}<span className="pp-ul pp19-note" /></> },
  { key: 'code', label: 'סימון', c: true, bcc: true, render: (r) => <Code39 code={r.code} height={6} unit={0.19} /> },
];

export default function PP19({ meta, page }) {
  const d = page.data;
  return (
    <Sheet meta={meta} page={page}>
      <Note soft><b>מסלול איסוף מלקוחות</b> מקובץ לפי עיר. בכל איסוף מוודאים שמספר השמלות תואם לרשימה.</Note>
      {d.empty ? <EmptyBody /> : (
        <SheetTable columns={COLUMNS} rows={[]}>
          {d.groups.map((g) => (
            <GroupBlock key={g.city} group={g} />
          ))}
        </SheetTable>
      )}
    </Sheet>
  );
}

function GroupBlock({ group }) {
  return (
    <>
      <GroupRow span={COLUMNS.length} label={group.city} note={`${cnt(group.rows.length, 'עצירה אחת', 'עצירות')} · ${cnt(group.dresses, 'שמלה אחת', 'שמלות')}`} />
      {group.rows.map((r) => (
        <tr key={r.orderId}>
          {COLUMNS.map((c) => (
            <td key={c.key} className={[c.c ? 'c' : '', c.nowrap ? 'nowrap' : '', c.bcc ? 'bcc' : ''].filter(Boolean).join(' ') || undefined}>
              {c.render ? c.render(r) : r[c.key]}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
