'use client';

// תוצאות החיפוש המתקדם: כרטיס res-one.advp עם סיכום הסינונים, עריכה/עדכון/ניקוי, מתג שורות/טבלה,
// ייצוא/הדפסה/הורדה, "עוד N" והתראות שורה (adot). התצוגה בשורות כמו החיפוש הכללי.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Ic, ViewSwitch, XlButtons, MoreButton, ResultsTable, Dash } from './HomeParts';
import { ADV_TAG, cellParts, looksLikePhoneOrMail } from './homeAdvConfig';

const LIMIT = 8;

function AvCell({ c }) {
  const [t, cls] = cellParts(c);
  if (!t) return <Dash />;
  if (cls) return <span className={`chip ${cls}`}>{t}</span>;
  if (looksLikePhoneOrMail(t)) return <bdi dir="ltr">{t}</bdi>;
  return t;
}

function Joined({ cells }) {
  return cells.map((c, i) => <span key={i}>{i ? ' · ' : ''}<AvCell c={c} /></span>);
}

const nameOf = (r) => {
  const n = Array.isArray(r[0]) ? r[0][0] : r[0];
  return n || '';
};

export default function HomeAdvResults({ data, focus, summary, table, onTable, onEdit, onReopenClear, onClose, onExport }) {
  const [more, setMore] = useState(false);
  const [tag, icon] = ADV_TAG[focus] || ['רשומה', 'file'];
  const alerts = useMemo(() => new Set(data.al || []), [data.al]);
  const rows = data.rows;
  const shown = more ? rows : rows.slice(0, LIMIT);

  const info = useMemo(() => rows.map((r, i) => {
    const chip = r.slice(1).find((c) => Array.isArray(c));
    return { r, i, chip };
  }), [rows]);
  const hasStatus = info.some((x) => x.chip);
  const records = useMemo(() => info.map(({ r, i, chip }) => {
    const details = r.slice(1).filter((c) => c !== chip);
    const nm = (data.namesRev && data.namesRev[i]) || nameOf(r);
    return {
      url: data.links && data.links[i],
      alert: alerts.has(i),
      details,
      chip,
      cells: [nm, details.map((c) => (Array.isArray(c) ? c[0] : c)).join(' · '), chip ? chip[0] : ''],
    };
  }), [info, data.namesRev, data.links, alerts]);
  const columns = ['שם', 'פרטים', ...(hasStatus ? ['סטטוס'] : [])];

  const sumText = summary.text + (data.truncated ? ' · מוצגות 200 הראשונות' : '');
  return (
    <div className="card res-one advp">
      <div className="card-h">
        <button type="button" className="ibtn" aria-label="סגירת התוצאות" data-tip="סגירה" onClick={onClose}><Ic id="x" size="sm" /></button>
        <button type="button" className="ibtn" data-act="adv-edit" aria-label="חזרה לעריכת החיפוש" data-tip="חזרה" onClick={onEdit}><Ic id="back" size="sm" /></button>
        <button type="button" className="ibtn" data-act="adv-update" aria-label="עדכן חיפוש" onClick={onEdit}><Ic id="sliders" size="sm" /><span>עדכן חיפוש</span></button>
        <button type="button" className="ibtn" data-act="adv-reopen-clear" aria-label="נקה" data-tip="נקה" onClick={onReopenClear}><Ic id="eraser" size="sm" /><span>נקה</span></button>
      </div>
      <div className="advsum">
        <b id="rc-a">תוצאות חיפוש מתקדם {summary.label} <bdi>({rows.length})</bdi></b>
        <span>{sumText}</span>
      </div>
      {rows.length > 0 && (
        <div className="xlrow xlrow2">
          <ViewSwitch table={table} onChange={onTable} />
          <div className="aixl"><XlButtons onExcel={() => onExport('excel')} onPrint={() => onExport('print')} onDownload={() => onExport('download')} /></div>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="empty"><Ic id="search" size="lg" /><div>אין תוצאות לחיפוש הזה</div></div>
      ) : (
        <>
          {table ? (
            <ResultsTable
              columns={columns}
              records={records}
              linkCol={0}
              rowLimit={more ? 0 : LIMIT}
              renderCell={(c, j, rec) => {
                if (j === 0) return <>{c || <span className="faint">ללא שם</span>}{rec.alert && <span className="adot" data-tip="יש התראה" />}</>;
                if (j === 1) return rec.details.length ? <Joined cells={rec.details} /> : <Dash />;
                return rec.chip ? <AvCell c={rec.chip} /> : <Dash />;
              }}
            />
          ) : (
            <div className="list" aria-label="תוצאות החיפוש">
              {shown.map((r, i) => {
                const al = alerts.has(i);
                const url = data.links && data.links[i];
                const inner = (
                  <>
                    <div className="ic-b"><Ic id={icon} /><span className="rlbl">{tag}</span></div>
                    <div className="t">
                      <b>{nameOf(r) || <span className="faint">ללא שם</span>}{al && <span className="adot" data-tip="יש התראה" />}</b>
                      <span className="ln"><Joined cells={r.slice(1)} /></span>
                    </div>
                    <Ic id="chev" size="sm" className="go" />
                  </>
                );
                const cls = `li rlink lrow${al ? ' ralert' : ''}`;
                return url ? <Link key={i} className={cls} href={url}>{inner}</Link> : <div key={i} className={cls}>{inner}</div>;
              })}
            </div>
          )}
          {rows.length > LIMIT && <MoreButton open={more} extra={rows.length - LIMIT} onToggle={() => setMore((v) => !v)} />}
        </>
      )}
    </div>
  );
}
