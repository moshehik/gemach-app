'use client';

import { memo, useMemo } from 'react';
import ScheduleIcon from './ScheduleIcon';
import StageRow, { StageTableRow } from './StageRow';
import { MarkAllButton } from './MarkControls';
import { SectionTools } from './ScheduleToolbarSlots';
import { STAGE_META, stageLabel } from './scheduleMeta';

// מקטע שלב אחד - כמו cardHTML בעיצוב (לוז-יומי.html, שורות 1990-1998): כותרת (אייקון זהב + שם), לחצן "הכל בוצע"
// (וי כפול, לחצן 34/54/72), שבבים ("N התראות", משמרת; שבב "שעות איסוף" הוסר 7.10.2026), כלי הדפסה/הורדה/XL בקצה השמאלי; מתחת כרטיס עם פס התקדמות
// ושורות / טבלה. שורות עם התראה ראשונות (visibleItems בעיצוב), אחריהן לביצוע, ובסוף מה שבוצע; הסדר של השרת נשמר
// בתוך כל קבוצה.
//
// החוזה האחיד של סימון "בוצע":
//   marks - האובייקט של useStageMarks.js ({ available, canMark, canMarkAll, isBusy, doneState, onMarkDone, onMarkAll }) או
//   null. המקטע מחשב לכל שורה doneState = marks.doneState(stage, row) ומעביר אותו + marks.onMarkDone ל-StageRow
//   (onMarkDone(stage, row, { done, outcome })). "הכל בוצע" - marks.onMarkAll(stage) אחרי חלון "בטוח?" (MarkControls.js).
//   known = יש מקור "בוצע" לשלב (stage.doneSource) או טבלת סימונים (marks.available): בלעדיו אין פס התקדמות, אין
//   לחצן "בוצע" ואין "הכל בוצע" (אין מה לסמן ואין מה להציג - החלטה D בסקירה).
//   canMarkAll=false (JDG-04: עובדת) מסתיר את "הכל בוצע"; marks.canMarkAll (הרשאה מהשרת) גובר.
//   onExport / onDownload / onPrint / canExport - חריצי האשף (ר' ScheduleToolbarSlots.js).
function rankRow(stage, row, known) {
  if (row.alerts && row.alerts.length) return 0;
  if (known && row.done === true) return 2;
  return 1;
}

function StageSection({ stage, view, marks, canMarkAll = true, dayLabel, onExport, onDownload, onPrint, canExport = true }) {
  const meta = STAGE_META[stage.key] || STAGE_META.order;
  const { total } = stage.counts;
  const marking = !!(marks && marks.available);
  const known = !stage.infoOnly && !!(stage.doneSource || marking);
  const doneStateOf = (row) => (marking ? marks.doneState(stage, row) : null);
  const onMarkDone = marking ? marks.onMarkDone : null;
  const rows = useMemo(() => stage.items.map((row, i) => ({ row, i, r: rankRow(stage, row, known) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.row), [stage, known]);
  const done = known ? rows.filter((row) => row.done === true).length : 0;
  const pct = known && total ? Math.round((100 * done) / total) : 0;
  const pending = known ? rows.filter((row) => row.done !== true) : [];
  const showAll = known && pending.length > 0 && canMarkAll && (!marking || marks.canMarkAll);
  // שבב "N התראות" (החלטת הבעלים 4.10.2026, SCH-CHIP-ALERTS = א'; עיצוב cardHTML שורה 1992): מספר השורות עם התראה
  // במקטע - נספר מהשורות המוצגות, כך שהוא מתעדכן יחד איתן אחרי סימון "בוצע". "N אירועים" לא חוזר (SCH-CHIP-EVENTS = ב').
  const alertRows = rows.filter((row) => row.alerts && row.alerts.length).length;
  return (
    <section className="lz-sec" id={'st-' + stage.key} data-k={stage.key} style={{ '--pc': 'var(' + meta.color + ')' }}>
      <div className="lz-hrow">
        <h2 className="adm-h">
          <span className="adm-hi"><ScheduleIcon name={meta.icon} /></span>
          {stageLabel(stage)}
        </h2>
        {showAll ? (
          <MarkAllButton stage={stage} pending={pending} busy={marking && marks.isBusy(stage.key, 'all')} onMarkAll={marking ? marks.onMarkAll : null} dayLabel={dayLabel} />
        ) : null}
        <div className="lz-chips">
          {alertRows ? <span className="chip st-bad"><ScheduleIcon name="alert" />{alertRows} התראות</span> : null}
          {stage.shiftLabel ? <span className="chip st-today">{'משמרת ' + stage.shiftLabel}</span> : null}
        </div>
        <SectionTools stageKey={stage.key} onExport={onExport} onDownload={onDownload} onPrint={onPrint} canExport={canExport} />
      </div>
      <div className="card lz-st">
        {known ? (
          <div className="pbar lz-pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={'בוצע ' + done + ' מתוך ' + total}><i style={{ width: pct + '%' }} /></div>
        ) : null}
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
                {rows.map((row) => <StageTableRow key={row.orderId + ':' + stage.key} stage={stage} row={row} onMarkDone={onMarkDone} doneState={doneStateOf(row)} dayLabel={dayLabel} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="hres">
            <div className="hgrp">
              {rows.map((row) => <StageRow key={row.orderId + ':' + stage.key} stage={stage} row={row} onMarkDone={onMarkDone} doneState={doneStateOf(row)} dayLabel={dayLabel} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(StageSection);
