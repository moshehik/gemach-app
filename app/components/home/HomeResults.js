'use client';

// תוצאות החיפוש הכללי: רשימה מאוחדת אחת (לקוחות, הזמנות, פריטים) עם "עוד N", מתג שורות/טבלה,
// וייצוא/הדפסה/הורדה. בית 42 (card.res-one), 13 (vbar), 18/19/20 (hrow...), טבלה rtbl. החלטת הבעלים:
// ברירת המחדל = הרשימה המאוחדת (לא שלושה כרטיסים).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Ic, ViewSwitch, XlButtons, MoreButton, ResultsTable, Dash } from './HomeParts';
import { unifiedRows, tableRecords, TABLE_COLUMNS } from './homeLogic';

const LIMIT = 8;

function RowLine({ r }) {
  if (r.kind === 'לקוח') {
    return (
      <span className="ln">{r.phone ? <bdi dir="ltr">{r.phone}</bdi> : 'אין טלפון'} · {r.city || 'אין עיר'}</span>
    );
  }
  if (r.kind === 'הזמנה') {
    return (
      <span className="ln">
        הזמנה <bdi>#{r.orderId}</bdi> · {r.eventHeb || 'אין תאריך אירוע'} · <span className={`stx ${r.status.cls}`}><Ic id={r.status.icon} />{r.status.label}</span>
      </span>
    );
  }
  return (
    <span className="ln">ברקוד <bdi dir="ltr">{r.barcode}</bdi> · מידה <bdi>{r.size}</bdi></span>
  );
}

export default function HomeResults({ res, none, table, onTable, onExport, note }) {
  const [more, setMore] = useState(false);
  const rows = useMemo(() => (none ? [] : unifiedRows(res)), [res, none]);
  const records = useMemo(() => tableRecords(rows), [rows]);
  const shown = more ? rows : rows.slice(0, LIMIT);
  const trio = rows.length
    ? (
      <div className="aixl">
        <XlButtons onExcel={() => onExport('excel')} onPrint={() => onExport('print')} onPdf={() => onExport('pdf')} />
      </div>
    )
    : null;

  return (
    <div className="card res-one">
      <div className="card-h">
        <h2 id="rc-a">
          תוצאות <span className="faint">({rows.length})</span>
          <button type="button" className="tip" aria-label="עזרה" data-tip={'הסטטוס של הזמנה נלקח מהשדה שנשמר בהזמנה, ובדרך כלל הוא ריק ולכן מוצג "פעיל". הסכום הוא השדה הישן של ההזמנה.'}><Ic id="info" size="sm" /></button>
        </h2>
        {trio}
      </div>
      {rows.length > 0 && (
        <div className="vbar"><ViewSwitch table={table} onChange={onTable} /></div>
      )}
      {rows.length === 0 ? (
        <div className="empty"><Ic id="search" size="lg" /><div>אין תוצאות לחיפוש הזה</div>{note ? <div className="muted">{note}</div> : null}</div>
      ) : (
        <>
          {table ? (
            <ResultsTable
              columns={TABLE_COLUMNS}
              records={records}
              linkCol={1}
              rowLimit={more ? 0 : LIMIT}
              renderCell={(c, j) => {
                if (j === 0) return <span className="chip rtype">{c}</span>;
                if (j === 2 || j === 4) return c ? <bdi dir="ltr">{c}</bdi> : <Dash />;
                return c ? c : <Dash />;
              }}
            />
          ) : (
            <div className="list" aria-label="תוצאות החיפוש">
              {shown.map((r) => (
                <Link key={r.key} className="li rlink lrow" href={r.url}>
                  <div className="ic-b"><Ic id={r.icon} /><span className="rlbl">{r.kind}</span></div>
                  <div className="t"><b>{r.title}</b><RowLine r={r} /></div>
                  <Ic id="chev" size="sm" className="go" />
                </Link>
              ))}
            </div>
          )}
          {rows.length > LIMIT && <MoreButton open={more} extra={rows.length - LIMIT} onToggle={() => setMore((v) => !v)} />}
        </>
      )}
    </div>
  );
}
