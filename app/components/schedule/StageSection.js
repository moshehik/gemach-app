'use client';

import { memo, useMemo } from 'react';
import ScheduleIcon from './ScheduleIcon';
import StageRow, { StageTableRow } from './StageRow';
import { STAGE_META } from './scheduleMeta';

// מקטע שלב אחד: כותרת (אייקון זהב + שם + תגיות) מעל כרטיס עם פס התקדמות ושורות / טבלה.
// קריאה בלבד: אין "הכל בוצע", אין ייצוא/הדפסה (V1).
// שורות עם התראה ראשונות (כמו בעיצוב, visibleItems), אחריהן שאר השורות; הסדר של השרת נשמר בתוך כל קבוצה
// (מיון יציב). שורה שבוצעה (done=true) יורדת אחרונה.
function rankRow(stage, row) {
  if (row.alerts && row.alerts.length) return 0;
  if (!stage.infoOnly && row.done === true) return 2;
  return 1;
}

function StageSection({ stage, view, pickupHours }) {
  const meta = STAGE_META[stage.key] || STAGE_META.order;
  const { total, done, alerts } = stage.counts;
  const known = !stage.infoOnly && stage.doneSource;
  const rows = useMemo(() => stage.items.map((row, i) => ({ row, i, r: rankRow(stage, row) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.row), [stage]);
  const pct = known && total ? Math.round((100 * done) / total) : 0;
  return (
    <section className="lz-sec" id={'st-' + stage.key} data-k={stage.key} style={{ '--pc': 'var(' + meta.color + ')' }}>
      <div className="lz-hrow">
        <h2 className="adm-h">
          <span className="adm-hi"><ScheduleIcon name={meta.icon} /></span>
          {stage.label}
        </h2>
        <div className="lz-chips">
          {stage.infoOnly ? <span className="chip st-mid">{total} {stage.plural}</span> : null}
          {alerts ? <span className="chip st-bad"><ScheduleIcon name="alert" />{alerts} התראות</span> : null}
          {stage.shiftLabel ? <span className="chip st-today">{'משמרת ' + stage.shiftLabel}</span> : null}
          {stage.key === 'pick' && pickupHours ? <span className="chip st-today">{'שעות איסוף ' + pickupHours}</span> : null}
        </div>
      </div>
      <div className="card lz-st">
        {known ? <div className="pbar lz-pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={'בוצע ' + done + ' מתוך ' + total}><i style={{ width: pct + '%' }} /></div> : null}
        {view === 'table' ? (
          <div className="tblw">
            <table className="rtbl">
              <thead>
                <tr>
                  <th>הזמנה</th>
                  <th>לקוחה</th>
                  <th>פרטים</th>
                  <th>התראה</th>
                  {stage.infoOnly ? null : <th className="tc">ביצוע</th>}
                  <th className="tc"><span className="sr-only">כרטיס הזמנה</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => <StageTableRow key={row.orderId + ':' + stage.key} stage={stage} row={row} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="hres">
            <div className="hgrp">
              {rows.map((row) => <StageRow key={row.orderId + ':' + stage.key} stage={stage} row={row} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(StageSection);
