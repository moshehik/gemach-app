// app/components/schedule/print/pages/PP07.js — תבנית "דף הכנה" (דף 07). נתונים: lib/schedule/print/pages/PP-07.js build().
// עיצוב: p07() (גרסה א: דף מרוכז - קבוצות "משלוחים (הלוך)" / "איסוף עצמי", עמודות: הוכנה, הזמנה, לקוחה, אירוע,
// שמלות ותיקונים, סימון) ו-p07b() (גרסה ב: גיליון לכל הזמנה - ברקוד הכותרת הוא PRP-<הזמנה>, "שלבי הכנה", חתימות).
// בלי שדה "יעד" (החלטת הבעלים PP-07). גרסה ב משתמשת במנגנון "הזמנה בכל עמוד" של התשתית: <Sheet> לכל הזמנה עם
// code/codeNote ו-sheetIndex/sheetCount (במסך; בהדפסה המספור "עמוד X מתוך Y" מגיע מ-@page).
import { Sheet, SheetTable, GroupRow, Phone, Check, Note, EmptyBody } from '../PrintShell';
import Code39 from '../Code39';
import { cnt } from '@/lib/schedule/print/format';
import './pp07.css';

const dressesText = (n) => cnt(n, 'שמלה אחת', 'שמלות');

const COLUMNS_A = [
  { key: 'done', label: 'הוכנה', c: true, render: () => <Check /> },
  { key: 'orderId', label: 'הזמנה', nowrap: true, render: (r) => '#' + r.orderId },
  { key: 'name', label: 'לקוחה', render: (r) => <>{r.name}<small><Phone value={r.phone} /></small></> },
  { key: 'event', label: 'אירוע', nowrap: true, render: (r) => r.eventShort },
  {
    key: 'dresses',
    label: 'שמלות ותיקונים',
    render: (r) => (
      <>
        {r.dresses.map((d) => (
          <div key={d.n}>
            <div><b>{d.model}</b>{d.size ? <> · מ׳ {d.size}</> : null}</div>
            {d.repair ? <small>תיקון: {d.repair}</small> : null}
          </div>
        ))}
        {r.notes ? <small>הערה: {r.notes}</small> : null}
      </>
    ),
  },
  { key: 'code', label: 'סימון', c: true, bcc: true, render: (r) => <Code39 code={r.code} height={6} unit={0.19} /> },
];

function VersionA({ meta, page }) {
  const d = page.data;
  return (
    <Sheet meta={meta} page={page}>
      {d.empty ? <EmptyBody /> : (
        <SheetTable columns={COLUMNS_A} rows={[]}>
          {d.groups.map((g) => (
            <GroupSet key={g.key} group={g} rows={d.rows.filter((r) => r.isDelivery === (g.key === 'delivery'))} />
          ))}
        </SheetTable>
      )}
    </Sheet>
  );
}

function GroupSet({ group, rows }) {
  return (
    <>
      <GroupRow span={COLUMNS_A.length} label={group.label} note={`${cnt(rows.length, 'הזמנה אחת', 'הזמנות')} · ${dressesText(group.dresses)}`} />
      {rows.map((r) => (
        <tr key={r.orderId}>
          {COLUMNS_A.map((c) => (
            <td key={c.key} className={[c.c ? 'c' : '', c.nowrap ? 'nowrap' : '', c.bcc ? 'bcc' : ''].filter(Boolean).join(' ') || undefined}>{c.render(r)}</td>
          ))}
        </tr>
      ))}
    </>
  );
}

const DRESS_COLUMNS = [
  { key: 'done', label: 'הוכנה', c: true, render: () => <Check lg /> },
  { key: 'n', label: 'שמלה', c: true, render: (d, r) => `${d.n} מתוך ${r.dresses.length}` },
  { key: 'model', label: 'דגם', render: (d) => <b>{d.model}</b> },
  { key: 'size', label: 'מידה', c: true, render: (d) => <b>{d.size}</b> },
  { key: 'repair', label: 'תיקון', render: (d) => (d.repair ? <>{d.repair}{d.details ? <small>{d.details}</small> : null}</> : '—') },
];

function STEPS(r) {
  const n = r.dressCount || 1;
  return [{
    key: 'steps',
    inspect: <Check n={n} />,
    iron: <Check n={n} />,
    pack: <Check n={n} />,
    repair: r.hasRepair ? <Check n={n} /> : '—',
  }];
}
const STEP_COLUMNS = [
  { key: 'inspect', label: 'בדיקה', c: true, render: (s) => s.inspect },
  { key: 'iron', label: 'גיהוץ', c: true, render: (s) => s.iron },
  { key: 'pack', label: 'אריזה', c: true, render: (s) => s.pack },
  { key: 'repair', label: 'תיקון בוצע', c: true, render: (s) => s.repair },
];

function OrderSheet({ meta, page, order: r, index, count }) {
  return (
    <Sheet
      meta={meta}
      page={page}
      title={`דף הכנה · הזמנה #${r.orderId}`}
      sub="הזמנה אחת בכל עמוד"
      sum={dressesText(r.dressCount)}
      code={r.code}
      codeNote="סימון ההזמנה כמוכנה"
      sheetIndex={index}
      sheetCount={count}
    >
      {/* בלי div עוטף: כרום לא מפצל ל-2 עמודים הזמנה ארוכה כשכל הגוף עטוף ב-div אחד (שאר הפריטים נחתכים) - ר' pp07.css */}
      <span className="pp-p7-mark" />
      <Note>
        <b>{r.name}</b>
        <span>טלפון: <Phone value={r.phone} /></span>
        <span>אירוע: {r.eventFull}</span>
        <span>{r.type}</span>
      </Note>
      <DressTable r={r} />
      {r.notes ? <div className="pp-note pp-p7-notes"><b>הערה להזמנה:</b> {r.notes}</div> : null}
      <div className="pp-ob pp-p7-steps">
        <div className="pp-ob-h"><b>שלבי הכנה</b><span>מסמנים אחרי שהשלב בוצע</span></div>
        <SheetTable columns={STEP_COLUMNS} rows={STEPS(r)} />
      </div>
      <div className="pp-signs pp-p7-signs"><div>הוכן על ידי</div><div>נבדק על ידי</div></div>
    </Sheet>
  );
}

function DressTable({ r }) {
  // SheetTable מעביר רק את השורה ל-render; כאן צריך גם את ההזמנה (מספר השמלות) - לכן עוטפים כל שמלה
  const rows = r.dresses.map((d) => ({ ...d, _order: r }));
  const cols = DRESS_COLUMNS.map((c) => ({ ...c, render: (row) => c.render(row, row._order) }));
  return <SheetTable columns={cols} rows={rows} />;
}

export default function PP07({ meta, page }) {
  const d = page.data;
  if (page.version !== 'b') return <VersionA meta={meta} page={page} />;
  if (d.empty) return <Sheet meta={meta} page={page}><EmptyBody /></Sheet>;
  return (
    <>
      {d.rows.map((o, i) => (
        <OrderSheet key={o.orderId} meta={meta} page={page} order={o} index={i + 1} count={d.rows.length} />
      ))}
    </>
  );
}
