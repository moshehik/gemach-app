// app/components/schedule/print/pages/PP10.js — תבנית "דף משלוח הלוך (למשלוחן)" (דף 10); גם הבסיס של PP18 (חזור).
// נתונים: lib/schedule/print/pages/PP-10.js build(). עיצוב: courierPage() בתצוגה - טבלה אחת, שורת קבוצה לכל תאריך אירוע
// ("משלוח הלוך אירועים … (משלוח יוצא …)" + מספר המשלוחים), עמודות: הזמנה, שם מלא, כתובת, טלפון 1, טלפון 2, שמלות, סימון
// (ברקוד DOT-<הזמנה>). כתובת בלי רחוב: תג "חסרה כתובת" + העיר.
import { Sheet, SheetTable, GroupRow, Phone, Flag, EmptyBody } from '../PrintShell';
import Code39 from '../Code39';
import { cnt } from '@/lib/schedule/print/format';
import './pp10.css';

export function Address({ row }) {
  if (row.street) return <>{[row.street, row.city].filter(Boolean).join(', ')}</>;
  return <><Flag>חסרה כתובת</Flag>{row.city ? ' ' + row.city : null}</>;
}

const COLUMNS = [
  { key: 'orderId', label: 'הזמנה', nowrap: true, render: (r) => '#' + r.orderId },
  { key: 'name', label: 'שם מלא', render: (r) => <b>{r.name}</b> },
  { key: 'address', label: 'כתובת', render: (r) => <Address row={r} /> },
  { key: 'phone1', label: 'טלפון 1', render: (r) => <Phone value={r.phone1} /> },
  { key: 'phone2', label: 'טלפון 2', render: (r) => <Phone value={r.phone2} /> },
  { key: 'dressCount', label: 'שמלות', c: true },
  { key: 'code', label: 'סימון', c: true, bcc: true, render: (r) => <Code39 code={r.code} height={6} unit={0.19} /> },
];

/** גיליון משלוחן משותף: out=true הלוך (משלוחים), אחרת חזור (איסופים) */
export function CourierSheet({ meta, page, out = true }) {
  const d = page.data;
  const noun = out ? ['משלוח אחד', 'משלוחים'] : ['איסוף אחד', 'איסופים'];
  return (
    <Sheet meta={meta} page={page}>
      {d.empty ? <EmptyBody /> : (
        <SheetTable columns={COLUMNS} rows={[]}>
          {d.groups.map((g) => (
            <GroupSet key={g.key} group={g} noun={noun} />
          ))}
        </SheetTable>
      )}
    </Sheet>
  );
}

function GroupSet({ group, noun }) {
  return (
    <>
      <GroupRow span={COLUMNS.length} label={group.title} note={cnt(group.rows.length, noun[0], noun[1])} />
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

export default function PP10({ meta, page }) {
  return CourierSheet({ meta, page, out: true });
}
