// app/components/schedule/print/pages/PP15.js — תבנית "רשימת אירועים" (דף 15): דף הייחוס לטבלה פשוטה.
// נתונים: lib/schedule/print/pages/PP-15.js build(). עיצוב: p15() בתצוגה (עמודות: הזמנה, לקוחה, טלפון, עיר,
// שמלות, קבלה, חזרה, הערות להזמנה; שורת קבוצה לכל תאריך אירוע; בלי ברקוד, בלי סניף).
import { Sheet, SheetTable, GroupRow, Stats, Phone, EmptyBody } from '../PrintShell';
import { cnt } from '@/lib/schedule/print/format';

const COLUMNS = [
  { key: 'orderId', label: 'הזמנה', nowrap: true, render: (r) => '#' + r.orderId },
  { key: 'name', label: 'לקוחה', render: (r) => <b>{r.name}</b> },
  { key: 'phone', label: 'טלפון', render: (r) => <Phone value={r.phone} /> },
  { key: 'city', label: 'עיר' },
  { key: 'dressCount', label: 'שמלות', c: true },
  { key: 'receive', label: 'קבלה' },
  { key: 'ret', label: 'חזרה' },
  { key: 'notes', label: 'הערות להזמנה' },
];

export default function PP15({ meta, page }) {
  const d = page.data;
  return (
    <Sheet meta={meta} page={page}>
      {d.empty ? <EmptyBody /> : (
        <>
          <Stats items={d.stats} />
          <SheetTable columns={COLUMNS} rows={[]}>
            {d.groups.map((g) => (
              <GroupRowSet key={g.key} group={g} />
            ))}
          </SheetTable>
        </>
      )}
    </Sheet>
  );
}

function GroupRowSet({ group }) {
  return (
    <>
      <GroupRow span={COLUMNS.length} label={group.label} note={`${cnt(group.rows.length, 'אירוע אחד', 'אירועים')} · ${cnt(group.dresses, 'שמלה אחת', 'שמלות')}`} />
      {group.rows.map((r) => (
        <tr key={r.orderId}>
          {COLUMNS.map((c) => (
            <td key={c.key} className={[c.c ? 'c' : '', c.nowrap ? 'nowrap' : ''].filter(Boolean).join(' ') || undefined}>
              {c.render ? c.render(r) : r[c.key]}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
