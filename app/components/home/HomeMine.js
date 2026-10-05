'use client';

// "השינויים שלי" — תצוגת התוצאות המלאה (/?recent=mine; כפתור "הכל" בחלונית & ושורת התפריט "השינויים שלי").
// מוצגת בדיוק כמו תוצאות החיפוש הכללי (HomeResults): אותו כרטיס card.res-one, אותה כותרת "תוצאות (N)" עם Excel / הדפסה / PDF, אותו מתג שורות / טבלה,
// אותן שורות (li.rlink.lrow: אריח אייקון + תווית סוג + שם + שורת פרטים) ואותה טבלה (ResultsTable, מיון לכל עמודה) - בשני חלקים כקבוצות:
// "הזמנות חדשות שיצרתי" ו"שינויים שעשיתי", עד 20 בכל חלק (התקרה של השרת), החדש ראשון. עיצוב: תצוגות-עיצוב\השינויים-שלי.html.
// הנתונים: GET /api/me/recent-activity (עובדת רגילה: רק מה שהיא עשתה; הנהלה: שבבי בחירה בראש התצוגה לעבור לעובדת אחרת, MY-04 ב),
// המודל הטהור: lib/myRecentActivityView.js (buildMineModel, limit=null). לחיצה על שורה פותחת את כרטיס ההזמנה (MY-05).

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Ic, ViewSwitch, XlButtons, ResultsTable, Dash } from './HomeParts';
import { MineWho } from '../search/QuickPrefix';
import { buildMineModel, mineTableRecords, MINE_TEXT, MINE_TABLE_COLUMNS } from '@/lib/myRecentActivityView';

export default function HomeMine({ mine, onClose, table, onTable, onExport }) {
  const load = mine.load;
  useEffect(() => { load(); }, [load]);
  const m = useMemo(() => buildMineModel({ state: mine.state, data: mine.data }, { limit: null, whoName: mine.whoName }), [mine.state, mine.data, mine.whoName]);
  const ready = m.state === 'ok' && m.sections.length > 0;
  const head = (
    <div className="card-h">
      <h2 id="mine-h">
        השינויים שלי{mine.whoName ? <span className="mine-who-name"> · {mine.whoName}</span> : null}
        {ready ? <> <span className="faint">({m.total})</span></> : null}
      </h2>
      {ready ? (
        <div className="aixl">
          <XlButtons onExcel={() => onExport('excel')} onPrint={() => onExport('print')} onPdf={() => onExport('pdf')} />
        </div>
      ) : null}
      <button type="button" className="ibtn" aria-label="חזרה לחיפוש הכללי" data-tip="חזרה לחיפוש הכללי" onClick={onClose}><Ic id="x" size="sm" /></button>
    </div>
  );
  const who = <MineWho chips={mine.chips} setWho={mine.setWho} className="mine-who mine-who-bar" />;
  if (m.state === 'loading') {
    return <div className="card res-one recent mine-view">{head}{who}<div className="empty" role="status"><div className="big mine-big">{MINE_TEXT.loading}</div></div></div>;
  }
  if (m.state === 'error') {
    return (
      <div className="card res-one recent mine-view">
        {head}
        {who}
        <div className="empty" role="alert">
          <Ic id="alert" size="lg" />
          <div className="big mine-big">{MINE_TEXT.error}</div>
          <div className="muted">{MINE_TEXT.errorSub}</div>
          <div style={{ marginTop: 16 }}><button type="button" className="btn primary" onClick={mine.reload}><Ic id="refresh" size="sm" />נסי שוב</button></div>
        </div>
      </div>
    );
  }
  if (!m.sections.length) {
    return (
      <div className="card res-one recent mine-view">
        {head}
        {who}
        <div className="empty" role="status"><Ic id="file" size="lg" /><div className="big mine-big">{m.none}</div><div className="muted">{m.sub}</div></div>
      </div>
    );
  }
  return (
    <div className="card res-one recent mine-view">
      {head}
      {who}
      <div className="vbar"><ViewSwitch table={!!table} onChange={onTable} /></div>
      {m.sections.map((s) => (
        <div className="mine-sec" key={s.key}>
          <div className="mine-sec-h" role="presentation">{s.head}<b>{s.count}</b></div>
          {table ? (
            <ResultsTable
              columns={MINE_TABLE_COLUMNS}
              records={mineTableRecords(s.rows)}
              linkCol={1}
              renderCell={(c, j) => {
                if (j === 0) return <span className="chip rtype">{c}</span>;
                if (j === 2) return c ? <bdi dir="ltr">{c}</bdi> : <Dash />;
                return c ? c : <Dash />;
              }}
            />
          ) : (
            <div className="list" aria-label={s.head}>
              {s.rows.map((r) => (
                <Link key={r.key} className="li rlink lrow" href={r.url}>
                  <div className="ic-b"><Ic id={r.icon} /><span className="rlbl">{r.kind === 'created' ? 'חדשה' : 'שונתה'}</span></div>
                  <div className="t"><b>{r.title}</b><span className="ln">הזמנה <bdi>#{r.orderNumber}</bdi> · {r.detail}{r.when ? ' · ' + r.when : ''}</span></div>
                  <Ic id="chev" size="sm" className="go" />
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="mine-nt" role="note"><Ic id="lock" /><span>{m.note} עד 20 בכל חלק, החדש ראשון.</span></div>
    </div>
  );
}
