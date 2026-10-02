// app/components/schedule/print/pages/PP01.js — תבנית "דוח הזמנות כללי" (דף 01): דף הייחוס ל"סיכום + טבלה".
// נתונים: lib/schedule/print/pages/PP-01.js build(). עיצוב: p01() בתצוגה (פס סיכומים: הזמנות, שמלות, סה״כ חיוב,
// שולם, יתרה; עמודות: הזמנה, לקוחה (+הערה), טלפון, תאריך אירוע (עברי + לועזי), שמלות, סוג, חיוב, שולם, יתרה;
// שורת סה״כ). בלי אישור, בלי חתימה, בלי ברקוד, בלי סניף.
import { Sheet, SheetTable, Stats, Money, Phone, EmptyBody } from '../PrintShell';
import { cnt } from '@/lib/schedule/print/format';

const COLUMNS = [
  { key: 'orderId', label: 'הזמנה', nowrap: true, render: (r) => '#' + r.orderId },
  { key: 'name', label: 'לקוחה', render: (r) => <>{r.name}{r.notes ? <small>הערה: {r.notes}</small> : null}</> },
  { key: 'phone', label: 'טלפון', render: (r) => <Phone value={r.phone} /> },
  { key: 'event', label: 'תאריך אירוע', render: (r) => <>{r.eventHebrew}{r.eventGreg ? <small>{r.eventGreg}</small> : null}</> },
  { key: 'dressCount', label: 'שמלות', c: true },
  { key: 'type', label: 'סוג' },
  { key: 'total', label: 'חיוב', c: true, render: (r) => <Money value={r.total} /> },
  { key: 'paid', label: 'שולם', c: true, render: (r) => <Money value={r.paid} /> },
  { key: 'balance', label: 'יתרה', c: true, render: (r) => (r.balance ? <b><Money value={r.balance} /></b> : r.balance === 0 ? 'שולם' : '') },
];

export default function PP01({ meta, page }) {
  const d = page.data;
  const t = d.totals;
  return (
    <Sheet meta={meta} page={page}>
      {d.empty ? <EmptyBody /> : (
        <>
          <Stats items={d.stats} />
          <SheetTable
            columns={COLUMNS}
            rows={d.rows}
            footer={(
              <tr className="tot">
                <td colSpan={4}>סה״כ {cnt(t.orders, 'הזמנה אחת', 'הזמנות')}</td>
                <td className="c">{t.dresses}</td>
                <td />
                <td className="c"><Money value={t.total} /></td>
                <td className="c"><Money value={t.paid} /></td>
                <td className="c"><Money value={t.balance} /></td>
              </tr>
            )}
          />
        </>
      )}
    </Sheet>
  );
}
