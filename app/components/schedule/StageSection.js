'use client';

import { memo, useMemo } from 'react';
import ScheduleIcon, { ChecksIcon } from './ScheduleIcon';
import StageRow, { StageTableRow } from './StageRow';
import { SectionTools } from './ScheduleToolbarSlots';
import { STAGE_META, MARK_TIPS } from './scheduleMeta';

// מקטע שלב אחד - כמו cardHTML בעיצוב (לוז-יומי.html, שורות 1990-1998): כותרת (אייקון זהב + שם), לחצן "הכל בוצע"
// (וי כפול, לחצן 34/54/72), שבבים (משמרת, שעות איסוף), כלי הדפסה/הורדה/XL בקצה השמאלי; מתחת כרטיס עם פס התקדמות
// (לא בשלבי המידע) ושורות / טבלה.
// שורות עם התראה ראשונות (visibleItems בעיצוב), אחריהן לביצוע, ובסוף מה שבוצע; הסדר של השרת נשמר בתוך כל קבוצה.
//
// חוזה לסוכנים האחרים (props בלבד, בלי לשנות markup):
//   onMarkAll(stage)  - "הכל בוצע" (S04; החלון "בטוח?" של הסוכן). בלי handler הלחצן כבוי. canMarkAll=false מסתיר (JDG-04: עובדת).
//   onMarkDone / marks - עוברים לשורות (ר' StageRow.js). marks: { [orderId]: doneState } לסימון אופטימי.
//   onExport / onDownload / onPrint / canExport - חריצי האשף (ר' ScheduleToolbarSlots.js).
function rankRow(stage, row, marks) {
  if (row.alerts && row.alerts.length) return 0;
  const st = marks && marks[row.orderId];
  const done = st && st.done !== undefined ? st.done : row.done === true;
  if (!stage.infoOnly && done) return 2;
  return 1;
}

function StageSection({ stage, view, pickupHours, onMarkDone, onMarkAll, marks, canMarkAll = true, onExport, onDownload, onPrint, canExport = true }) {
  const meta = STAGE_META[stage.key] || STAGE_META.order;
  const { total } = stage.counts;
  const rows = useMemo(() => stage.items.map((row, i) => ({ row, i, r: rankRow(stage, row, marks) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.row), [stage, marks]);
  const done = rows.filter((row) => { const st = marks && marks[row.orderId]; return st && st.done !== undefined ? st.done : row.done === true; }).length;
  const pct = !stage.infoOnly && total ? Math.round((100 * done) / total) : 0;
  const open = total - done;
  return (
    <section className="lz-sec" id={'st-' + stage.key} data-k={stage.key} style={{ '--pc': 'var(' + meta.color + ')' }}>
      <div className="lz-hrow">
        <h2 className="adm-h">
          <span className="adm-hi"><ScheduleIcon name={meta.icon} /></span>
          {stage.label}
        </h2>
        {!stage.infoOnly && open > 0 && canMarkAll ? (
          <button type="button" className="ibtn lz-all" aria-label={MARK_TIPS.all} data-tip={MARK_TIPS.all} disabled={!onMarkAll} onClick={onMarkAll ? () => onMarkAll(stage) : undefined}>
            <ChecksIcon />
          </button>
        ) : null}
        <div className="lz-chips">
          {stage.shiftLabel ? <span className="chip st-today">{'משמרת ' + stage.shiftLabel}</span> : null}
          {stage.key === 'pick' && pickupHours ? <span className="chip st-today">{'שעות איסוף ' + pickupHours}</span> : null}
        </div>
        <SectionTools stageKey={stage.key} onExport={onExport} onDownload={onDownload} onPrint={onPrint} canExport={canExport} />
      </div>
      <div className="card lz-st">
        {stage.infoOnly ? null : (
          <div className="pbar lz-pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={'בוצע ' + done + ' מתוך ' + total}><i style={{ width: pct + '%' }} /></div>
        )}
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
                {rows.map((row) => <StageTableRow key={row.orderId + ':' + stage.key} stage={stage} row={row} onMarkDone={onMarkDone} doneState={marks && marks[row.orderId]} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="hres">
            <div className="hgrp">
              {rows.map((row) => <StageRow key={row.orderId + ':' + stage.key} stage={stage} row={row} onMarkDone={onMarkDone} doneState={marks && marks[row.orderId]} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(StageSection);
