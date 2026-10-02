// app/components/schedule/print/pages/PP02.js — תבנית "סיכום יתרות לגבייה" (דף 02). נתונים: lib/schedule/print/pages/PP-02.js build().
// עיצוב: p02() בתצוגה (פס סיכומים; עמודות: הזמנה, לקוחה, טלפון, תאריך אירוע, ימים לאירוע, חיוב, שולם, יתרה לגבייה,
// הערת גבייה (קו לכתיבה), נגבה (תיבה); שורת סה״כ גדולה בסוף; סכום הלגבייה בפס הכותרת). בלי ברקוד ובלי חתימה (לידיעה בלבד).
import { Sheet, SheetTable, Stats, Money, Phone, Check, EmptyBody } from '../PrintShell';
import './pp-table-theme-leaks.css';
import './pp02.css';

function daysCell(r) {
  const n = r.daysToEvent;
  if (n === null || n === undefined) return '';
  const t = n < 0 ? 'עבר' : n === 0 ? 'היום' : String(n);
  return n <= 3 ? <b>{t}</b> : t;
}

const COLUMNS = [
  { key: 'orderId', label: 'הזמנה', nowrap: true, render: (r) => '#' + r.orderId },
  { key: 'name', label: 'לקוחה' },
  { key: 'phone', label: 'טלפון', render: (r) => <Phone value={r.phone} /> },
  { key: 'event', label: 'תאריך אירוע', render: (r) => r.eventHebrew },
  { key: 'days', label: 'ימים לאירוע', c: true, render: daysCell },
  { key: 'total', label: 'חיוב', c: true, render: (r) => <Money value={r.total} /> },
  { key: 'paid', label: 'שולם', c: true, render: (r) => <Money value={r.paid} /> },
  { key: 'balance', label: 'יתרה לגבייה', c: true, render: (r) => <b><Money value={r.balance} /></b> },
  { key: 'collectNote', label: 'הערת גבייה', render: () => <span className="pp-ul w pp02-note" /> },
  { key: 'collected', label: 'נגבה', c: true, render: () => <Check /> },
];

export default function PP02({ meta, page }) {
  const d = page.data;
  return (
    <Sheet meta={meta} page={page} sum={<><Money value={d.totals.balance} /><small>סה״כ לגבייה</small></>}>
      {d.empty ? <EmptyBody /> : (
        <>
          <Stats items={d.stats} />
          <SheetTable columns={COLUMNS} rows={d.rows} />
          <div className="pp-bigtot"><span>{d.totalLabel}</span><b><Money value={d.totals.balance} /></b></div>
        </>
      )}
    </Sheet>
  );
}
