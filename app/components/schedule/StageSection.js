'use client';

import { memo, useMemo } from 'react';
import ScheduleIcon from './ScheduleIcon';
import StageRow, { StageTableRow } from './StageRow';
import { MarkAllButton } from './MarkControls';
import { STAGE_META } from './scheduleMeta';

// מקטע שלב אחד: כותרת (אייקון זהב + שם + תגיות) מעל כרטיס עם פס התקדמות ושורות / טבלה.
// אין ייצוא/הדפסה (V1). סימון "בוצע": דרך הפרופ marks (תוצאת useStageMarks.js) - לחצן בשורה ו"הכל בוצע"
// בכותרת; בלי marks (או כשהטבלה חסרה) המקטע לקריאה בלבד.
// שורות עם התראה ראשונות (כמו בעיצוב, visibleItems), אחריהן שאר השורות; הסדר של השרת נשמר בתוך כל קבוצה
// (מיון יציב). שורה שבוצעה (done=true) יורדת אחרונה.
function rankRow(stage, row) {
  if (row.alerts && row.alerts.length) return 0;
  if (!stage.infoOnly && row.done === true) return 2;
  return 1;
}

function StageSection({ stage, view, pickupHours, marks }) {
  const meta = STAGE_META[stage.key] || STAGE_META.order;
  const { total, done, alerts } = stage.counts;
  const marking = !!(marks && marks.available);
  const known = !stage.infoOnly && (stage.doneSource || marking);
  const doneStateOf = (row) => (marking ? marks.doneState(stage, row) : null);
  const onMarkDone = marking ? marks.onMarkDone : null;
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
        {marking ? (
          <MarkAllButton stage={stage} pending={stage.counts.pending} canMarkAll={marks.canMarkAll} busy={marks.isBusy(stage.key, 'all')} onMarkAll={marks.onMarkAll} />
        ) : null}
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
                {rows.map((row) => <StageTableRow key={row.orderId + ':' + stage.key} stage={stage} row={row} doneState={doneStateOf(row)} onMarkDone={onMarkDone} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="hres">
            <div className="hgrp">
              {rows.map((row) => <StageRow key={row.orderId + ':' + stage.key} stage={stage} row={row} doneState={doneStateOf(row)} onMarkDone={onMarkDone} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(StageSection);
