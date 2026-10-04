'use client';

// "השינויים שלי" — תצוגת התוצאות המלאה (/?recent=mine; שורת התפריט "השינויים שלי" וגם "הצג הכל" בחלונית &).
// אותו כרטיס "אחרונים" של העיצוב (card.res-one.recent) בשני חלקים: "הזמנות חדשות שיצרתי" ו"שינויים שעשיתי", עד 20 בכל חלק.
// עיצוב מאושר: תצוגות-עיצוב\השינויים-שלי.html. הנתונים: GET /api/me/recent-activity (רק מה שהעובדת המחוברת עשתה בעצמה),
// המודל הטהור: lib/myRecentActivityView.js (buildMineModel, limit=null).

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Ic } from './HomeParts';
import { buildMineModel, MINE_TEXT } from '@/lib/myRecentActivityView';

export default function HomeMine({ mine, onClose }) {
  const load = mine.load;
  useEffect(() => { load(); }, [load]);
  const m = useMemo(() => buildMineModel({ state: mine.state, data: mine.data }, { limit: null }), [mine.state, mine.data]);
  const head = (
    <div className="card-h">
      <h2 id="mine-h">השינויים שלי</h2>
      <button type="button" className="ibtn" aria-label="חזרה לחיפוש הכללי" data-tip="חזרה לחיפוש הכללי" onClick={onClose}><Ic id="x" size="sm" /></button>
    </div>
  );
  if (m.state === 'loading') {
    return <div className="card res-one recent mine-view">{head}<div className="empty" role="status"><div className="big mine-big">{MINE_TEXT.loading}</div></div></div>;
  }
  if (m.state === 'error') {
    return (
      <div className="card res-one recent mine-view">
        {head}
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
        <div className="empty" role="status"><Ic id="file" size="lg" /><div className="big mine-big">{MINE_TEXT.empty}</div><div className="muted">{MINE_TEXT.emptySub}</div></div>
      </div>
    );
  }
  return (
    <div className="card res-one recent mine-view">
      {head}
      {m.sections.map((s) => (
        <div className="mine-sec" key={s.key}>
          <div className="mine-sec-h" role="presentation">{s.head}<b>{s.count}</b></div>
          <div className="list" aria-label={s.head}>
            {s.rows.map((r) => (
              <Link key={r.key} className="li rlink lrow" href={r.url}>
                <div className="ic-b"><Ic id={r.icon} /><span className="rlbl">{r.kind === 'created' ? 'חדשה' : 'שונתה'}</span></div>
                <div className="t"><b>{r.title}</b><span className="ln">הזמנה <bdi>#{r.orderNumber}</bdi> · {r.detail}{r.when ? ' · ' + r.when : ''}</span></div>
                <Ic id="chev" size="sm" className="go" />
              </Link>
            ))}
          </div>
        </div>
      ))}
      <div className="mine-nt" role="note"><Ic id="lock" /><span>{MINE_TEXT.note} עד 20 בכל חלק, החדש ראשון.</span></div>
    </div>
  );
}
