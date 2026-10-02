'use client';

import { useEffect, useRef, useState } from 'react';
import ScheduleIcon, { CheckCircleIcon, ChecksIcon } from './ScheduleIcon';
import { MARK_TIPS, RETURN_STAGES, STAGE_META, subText } from './scheduleMeta';
import { ConfirmDialog, DetailRows, confirmEffect, doneTip } from './MarkDialogs';

// לחצני "בוצע" של הלו״ז. המראה = העיצוב המאושר (תצוגות-עיצוב/לוז-יומי.html, statusHTML שורות 1976-1978 ו-allBtn
// שורה 1996): btn tgl lz-mark (+ on), lz-retw עם "הוחזר לא תקין" שצף בריחוף (A4), שבב "תקין"/"לא תקין" (B17),
// ibtn lz-all עם וי כפול. ה-CSS ב-app/schedule/schedule.css. ההתנהגות = useStageMarks.js (עדכון אופטימי, API, טוסט).
//
// החוזה האחיד (אותו חוזה ב-StageRow.js / StageSection.js / ScheduleDay.js):
//   onMarkDone(stage, row, { done: boolean, outcome?: 'ok'|'not_ok' })   - נקרא אחרי אישור בחלון "בטוח?" (S03)
//   doneState = marks.doneState(stage, row) -> { available, canMark, done, doneVia, doneBy, doneAt, outcome, busy }
//   onMarkAll(stage)                                                     - אחרי אישור בחלון "בטוח?" (S04)
// מצבי הלחצן: אין מקור "בוצע" לשלב (stage.doneSource) ואין טבלת סימונים (doneState.available) - אין לחצן (אין מה לסמן,
// ואין מה להציג; החלטה D בסקירה). יש מקור אבל אין hook / אין הרשאה (canMark=false) / בקשה בדרך (busy) - הלחצן כבוי
// (disabled) באותו מראה בדיוק - לא נעלם ולא מוחלף בטקסט או בשבב (הבעלים דחה כיתובים ושבבים שלא בעיצוב).

// מגע (אין ריחוף): הקשה ראשונה על "בוצע" בשלבי ההחזרה פותחת את הזוג (lz-retw.open) ורק השנייה שואלת - כמו בעיצוב
// (שורות 2112-2135); הקשה מחוץ לזוג סוגרת אותו. pointerType של הלחיצה האחרונה, ובלעדיו (hover:none).
function isTouch(pt) {
  if (pt) return pt === 'touch' || pt === 'pen';
  try { return window.matchMedia('(hover:none)').matches; } catch { return false; }
}

export function MarkButton({ stage, row, doneState, onMarkDone, dayLabel }) {
  const [ask, setAsk] = useState(null); // { done, outcome }
  const [pairOpen, setPairOpen] = useState(false);
  const lastPT = useRef('');
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!pairOpen) return undefined;
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setPairOpen(false); };
    document.addEventListener('click', close, true);
    return () => document.removeEventListener('click', close, true);
  }, [pairOpen]);
  if (!stage || stage.infoOnly) return null;
  const available = !!(doneState && doneState.available);
  if (!stage.doneSource && !available) return null;
  const done = doneState && doneState.done !== undefined && doneState.done !== null ? doneState.done === true : row.done === true;
  const cond = row.returnCondition;
  const rk = !!RETURN_STAGES[stage.key];
  const live = !!(onMarkDone && available && doneState.canMark);
  const busy = !!(doneState && doneState.busy);
  const disabled = !live || busy;
  const meta = STAGE_META[stage.key] || STAGE_META.order;
  const stageInfo = { key: stage.key, label: stage.label, icon: meta.icon };

  const confirm = (next, outcome) => () => { if (live) setAsk({ done: next, outcome }); };
  const run = () => {
    const a = ask;
    setAsk(null);
    setPairOpen(false);
    if (a && onMarkDone) onMarkDone(stage, row, a);
  };
  const name = (row.customer && row.customer.name) || '';
  const dialog = ask ? (
    <ConfirmDialog
      open
      icon={ask.done ? (ask.outcome === 'not_ok' ? 'alert' : 'check') : 'undo'}
      heading={ask.done
        ? (ask.outcome === 'not_ok' ? 'בטוח שהשמלה הוחזרה לא תקינה?' : 'בטוח שהשלב "' + stage.label + '" בוצע' + (rk ? ' (הוחזר תקין)' : '') + '?')
        : 'לבטל את סימון הביצוע?'}
      sub={'הזמנה #' + row.orderId + (name ? ' · ' + name : '')}
      effect={confirmEffect(stage.key, ask)}
      body={<DetailRows stage={stageInfo} row={row} dayLabel={dayLabel} />}
      yes={ask.done ? (ask.outcome === 'not_ok' ? 'כן, סמן כלא תקין' : 'כן, סמן כבוצע') : 'כן, בטל סימון'}
      onYes={run}
      onNo={() => setAsk(null)}
    />
  ) : null;

  if (done) {
    return (
      <>
        {rk && cond ? (cond === 'ok' ? <span className="chip green lz-rc">תקין</span> : <span className="chip rose lz-rc">לא תקין</span>) : null}
        <button type="button" className="btn tgl lz-mark on" aria-pressed="true" data-tip={doneTip(doneState)} disabled={disabled} aria-busy={busy || undefined} onClick={confirm(false)}>
          <ScheduleIcon name="check" className="sm evck" />בוצע
        </button>
        {dialog}
      </>
    );
  }
  const onMark = confirm(true, rk ? 'ok' : undefined);
  const markBtn = (
    <button
      type="button" className="btn tgl lz-mark" aria-pressed="false" data-tip={rk ? MARK_TIPS.markReturn : MARK_TIPS.mark} disabled={disabled} aria-busy={busy || undefined}
      onPointerDown={(e) => { lastPT.current = e.pointerType || ''; }}
      onClick={() => { if (rk && !pairOpen && isTouch(lastPT.current)) { setPairOpen(true); return; } onMark(); }}
    >
      <CheckCircleIcon className="sm" />בוצע
    </button>
  );
  if (!rk) return <>{markBtn}{dialog}</>;
  return (
    <>
      <span className={'lz-retw' + (pairOpen ? ' open' : '')} ref={wrapRef}>
        <button type="button" className="btn tgl lz-mark lz-bad" aria-pressed="false" data-tip={MARK_TIPS.markBad} disabled={disabled} aria-busy={busy || undefined} onClick={confirm(true, 'not_ok')}>
          <ScheduleIcon name="alert" className="sm" />הוחזר לא תקין
        </button>
        {markBtn}
      </span>
      {dialog}
    </>
  );
}

// "הכל בוצע" (לחצן 34/54/72 עם וי כפול, J09) בכותרת המקטע. בלי handler (אין hook) - כבוי באותו מראה.
// החלון (confirmAll בעיצוב, שורה 2021): כותרת, "N פריטים ב<יום> יסומנו כבוצעו", עד 5 שורות + "ועוד N פריטים".
export function MarkAllButton({ stage, pending, busy, onMarkAll, dayLabel }) {
  const [ask, setAsk] = useState(false);
  if (!stage || stage.infoOnly) return null;
  const meta = STAGE_META[stage.key] || STAGE_META.order;
  const rows = pending || [];
  const n = rows.length;
  const live = !!onMarkAll && n > 0;
  return (
    <>
      <button type="button" className="ibtn lz-all" aria-label={MARK_TIPS.all} data-tip={MARK_TIPS.all} disabled={!live || busy} aria-busy={busy || undefined} onClick={live ? () => setAsk(true) : undefined}>
        <ChecksIcon />
      </button>
      <ConfirmDialog
        open={ask}
        icon="check"
        heading={'בטוח שכל "' + stage.label + '" בוצע?'}
        sub={n + ' פריטים' + (dayLabel ? ' ב' + dayLabel : '') + ' יסומנו כבוצעו'}
        effect={confirmEffect(stage.key, { done: true, outcome: 'ok', all: true })}
        body={(
          <div className="lz-det">
            {rows.slice(0, 5).map((r) => (
              <div className="li" key={r.orderId}>
                <div className="ic-b"><ScheduleIcon name={meta.icon} /></div>
                <div className="t"><b>{(r.customer && r.customer.name) || 'לא ידוע'} <bdi>#{r.orderId}</bdi></b><small>{subText(stage.key, r)}</small></div>
              </div>
            ))}
            {n > 5 ? <div className="lz-more">ועוד {n - 5} פריטים</div> : null}
          </div>
        )}
        yes="כן, סמן הכל כבוצע"
        onYes={() => { setAsk(false); if (onMarkAll) onMarkAll(stage); }}
        onNo={() => setAsk(false)}
      />
    </>
  );
}
