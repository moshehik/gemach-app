// app/components/schedule/print/pages/PP09.js — תבנית "צ׳ק ליסט הכנה" (דף 09). נתונים: lib/schedule/print/pages/PP-09.js.
// עיצוב: p09() בדפי-הדפסה-עיצוב.html - הערה "איך ממלאים", טבלה (תיבה לכל שמלה בכל עמודת שלב), "הוכן על ידי / נבדק על ידי".
import { Sheet, SheetTable, Note, Check, EmptyBody } from '../PrintShell';
import RowCode from './ppCode';
import './pp09.css';

const COLUMNS = [
  { key: 'orderId', label: 'הזמנה', nowrap: true, render: (r) => '#' + r.orderId },
  { key: 'name', label: 'לקוחה' },
  { key: 'dresses', label: 'שמלות', c: true, render: (r) => <b>{r.dresses}</b> },
  { key: 'check', label: 'בדיקה', c: true, render: (r) => <Checks n={r.dresses} /> },
  { key: 'iron', label: 'גיהוץ', c: true, render: (r) => <Checks n={r.dresses} /> },
  { key: 'pack', label: 'אריזה', c: true, render: (r) => <Checks n={r.dresses} /> },
  { key: 'repair', label: 'תיקון בוצע', c: true, render: (r) => (r.hasRepair ? <Checks n={r.dresses} /> : '—') },
  { key: 'code', label: 'סימון', c: true, bcc: true, render: (r) => <RowCode code={r.code} /> },
];

// הזמנה עם הרבה שמלות (יותר מ-5): התיבות עוברות לשורה שנייה (pp09.css) - עד 5 תיבות זהה בדיוק לעיצוב
function Checks({ n }) {
  return n > 5 ? <span className="pp09-many"><Check n={n} /></span> : <Check n={n} />;
}

export default function PP09({ meta, page }) {
  const d = page.data;
  if (d.empty) return <Sheet meta={meta} page={page}><EmptyBody /></Sheet>;
  return (
    <Sheet meta={meta} page={page}>
      <div className="pp09">
        <Note soft><b>איך ממלאים:</b> לכל שמלה בהזמנה יש תיבה בכל עמודה. מסמנים רק אחרי שהשלב בוצע. אם אין תיקון להזמנה, מופיע קו.</Note>
        <SheetTable columns={COLUMNS} rows={d.rows} />
        <div className="pp-signs"><div>הוכן על ידי</div><div>נבדק על ידי</div></div>
      </div>
    </Sheet>
  );
}
