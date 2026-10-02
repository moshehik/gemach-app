// app/components/schedule/print/pages/PP13.js — תבנית "דף איסוף מקומי" (דף 13). נתונים: lib/schedule/print/pages/PP-13.js build().
// עיצוב: p13() בתצוגה: שורת שעות קבלה + הערת אשראי, ואז טבלה: נאסף (תיבה), הזמנה, לקוחה, טלפון, אירוע, שמלות,
// יתרה לתשלום, סימון (ברקוד PCK-<הזמנה>). בלי עמודת סניף (החלטת הבעלים).
import { Sheet, SheetTable, Note, Money, Phone, Check, Flag, EmptyBody } from '../PrintShell';
import Code39 from '../Code39';
import './pp-table-theme-leaks.css';

const COLUMNS = [
  { key: 'done', label: 'נאסף', c: true, render: (r) => (r.done ? <Flag>נאסף</Flag> : <Check lg />) },
  { key: 'orderId', label: 'הזמנה', nowrap: true, render: (r) => '#' + r.orderId },
  { key: 'name', label: 'לקוחה', render: (r) => <b>{r.name}</b> },
  { key: 'phone', label: 'טלפון', render: (r) => <Phone value={r.phone} /> },
  { key: 'event', label: 'אירוע', render: (r) => r.eventHebrew },
  { key: 'dressCount', label: 'שמלות', c: true },
  { key: 'balance', label: 'יתרה לתשלום', c: true, render: (r) => (r.balance ? <b><Money value={r.balance} /></b> : r.balance === 0 ? 'שולם' : '') },
  { key: 'code', label: 'סימון', c: true, bcc: true, render: (r) => <Code39 code={r.code} height={6} unit={0.19} /> },
];

export default function PP13({ meta, page }) {
  const d = page.data;
  return (
    <Sheet meta={meta} page={page}>
      <Note>
        <b>{d.pickupLabel}</b> {d.dayLabel}{d.pickupHours ? <> · בשעות <b>{d.pickupHours}</b> <span>(שעות הקבלה הרגילות מההגדרות)</span></> : null}
      </Note>
      <Note soft>יש להצטייד בפרטי אשראי לפקדון בעת קבלת השמלות.</Note>
      {d.empty ? <EmptyBody /> : <SheetTable columns={COLUMNS} rows={d.rows} />}
    </Sheet>
  );
}
