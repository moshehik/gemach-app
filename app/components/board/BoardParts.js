'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import ScheduleIcon from '../schedule/ScheduleIcon';
import { STAGE_META } from '../schedule/scheduleMeta';
import {
  WEEKDAYS, cellAlert, dayStageRows, isOrderLate, jumpMonths, monthTitle, stageCountText,
} from './boardLogic';

// רכיבי התצוגה של הלוח החודשי - כולם רכיבי פלטה (design-system/COMPONENTS.md) ורכיבי הלו״ז (schedule.css), בשמות של
// העיצוב המאושר (תצוגות-עיצוב/סיימתי-לעבוד/לוח-חודשי.html). אין כאן קריאות API.

export const Ic = ScheduleIcon;
// כלל האיחור של הארגון (late_return_threshold_days + non_working_days_extra) - BoardPage מספק, כל רכיב שמסמן איחור קורא
export const LateContext = createContext({});
export const useLateCfg = () => useContext(LateContext);
const WD_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// ---------- מסנן השלבים (S01) ----------
// הרכיב של המסנן מחיפוש ההיסטוריה בכרטיס ההזמנה (היסטוריה 2/8/9/12/14 בפלטה, כרטיס-הזמנה.html #hfBar): לחצן "סינון" (hf-t)
// שפותח רשימה עם תיבות סימון, אייקון ומונה לכל שלב. החלטת הבעלים (5.10.2026): תיבת החיפוש הרגיל הוסרה מהלוח (לא קופצים
// לחודש ההזמנה) - נשאר רק המסנן; הוא מסתיר מונים בתאים.
export function BoardStageFilter({ stages, totals, selected, onToggle, onShowAll, filterDisabled }) {
  const [open, setOpen] = useState(false);
  const selRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (selRef.current && !selRef.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); selRef.current?.querySelector('.hf-t')?.focus(); } };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const pills = selected.length && selected.length <= 3 ? selected : [];
  const metaOf = (k) => STAGE_META[k] || STAGE_META.order;
  const stageOf = (k) => stages.find((s) => s.key === k);
  return (
    <div className="hf-bar bd-search" id="bdSearch">
      <div className={'hf-sel' + (open ? ' on' : '')} ref={selRef}>
        <button
          type="button"
          className="hf-t"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="bdStageList"
          disabled={filterDisabled}
          onClick={() => setOpen((v) => !v)}
        >
          <Ic name="sliders" />
          <span className="hf-lbl">סינון</span>
          <span className={'hf-bdg' + (selected.length ? ' has' : '')}>{selected.length || ''}</span>
          <Ic name="chev" className="hf-chv" />
        </button>
        <div className="hf-scrim" onClick={() => setOpen(false)} />
        <div className="hf-p">
          <div className="hf-all"><button type="button" className="hf-allb" onClick={onShowAll}>הצג הכל</button></div>
          <div className="hf-l" id="bdStageList" role="listbox" aria-multiselectable="true" aria-label="סינון לפי שלב">
            {stages.filter((s) => s.enabled).map((s, n) => {
              const on = selected.includes(s.key);
              return (
                <div
                  key={s.key}
                  className="hf-o"
                  role="option"
                  tabIndex={0}
                  aria-selected={on}
                  style={{ '--k': n }}
                  onClick={() => onToggle(s.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(s.key); } }}
                >
                  <span className="hf-ck"><Ic name="check" /></span>
                  <span className="hf-oi"><Ic name={metaOf(s.key).icon} /></span>
                  <span className="hf-ol">{s.label}</span>
                  <span className="hf-oc">{totals[s.key] || 0}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {pills.length ? (
        <div className="hf-pills">
          {pills.map((k) => {
            const st = stageOf(k);
            if (!st) return null;
            return (
              <button key={k} type="button" className="hf-pill" aria-label={'הסרת סינון ' + st.label} onClick={() => onToggle(k)}>
                <span className="hf-pi"><Ic name={metaOf(k).icon} className="sm" /></span>{st.label}<Ic name="x" />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ---------- כותרת החודש: הקודם / שם החודש (בורר חודשים) / הבא (MATCH-1, MATCH-2, E08, S07) ----------
// בורר החודשים = רכיב הלוח של הפלטה (.hc, לוח 1-6): 13 חודשים סביב החודש המוצג, החודש הנוכחי מסומן (today) והמוצג
// מודגש (on); החצים מזיזים את החלון ב-13 חודשים. בלי אייקון יומן ליד הכותרת (הבעלים, S07).
export function MonthHead({ date, today, onPrev, onNext, onPick }) {
  const [open, setOpen] = useState(false);
  const [win, setWin] = useState(0);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); wrapRef.current?.querySelector('.lz-jump')?.focus(); } };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); };
  }, [open]);
  const months = open ? jumpMonths(date, win) : [];
  const todayTitle = monthTitle(today);
  return (
    <div className="hc-h">
      <button type="button" className="hc-n" aria-label="החודש הקודם" data-tip="החודש הקודם" onClick={onPrev}><Ic name="chev" className="sm" /></button>
      <span className="lz-jw" ref={wrapRef}>
        <button
          type="button"
          className="hc-t lz-jump"
          id="mJump"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-tip="קפיצה לחודש"
          onClick={() => { setWin(0); setOpen((v) => !v); }}
        >
          {monthTitle(date)}<Ic name="chev" className="sm" />
        </button>
        {open ? (
          <div className="lz-pop bd-mp" role="dialog" aria-label="קפיצה לחודש">
            <div className="hc">
              <div className="hc-h">
                <button type="button" className="hc-n" aria-label="חודשים קודמים" data-tip="חודשים קודמים" onClick={() => setWin((w) => w - 1)}><Ic name="chev" className="sm" /></button>
                <span className="hc-t">קפיצה לחודש</span>
                <button type="button" className="hc-n hc-nn" aria-label="חודשים הבאים" data-tip="חודשים הבאים" onClick={() => setWin((w) => w + 1)}><Ic name="chev" className="sm" /></button>
              </div>
              <div className="hc-g bd-mpg">
                {months.map((m) => {
                  const parts = m.title.split(' ');
                  const year = parts.pop();
                  const isOn = m.title === monthTitle(date);
                  return (
                    <button
                      key={m.key}
                      type="button"
                      className={'hc-d bd-mpd' + (m.title === todayTitle ? ' today' : '') + (isOn ? ' on' : '')}
                      aria-pressed={isOn}
                      onClick={() => { setOpen(false); onPick(m.date); }}
                    >
                      <span>{parts.join(' ')}</span><small>{year}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </span>
      <button type="button" className="hc-n hc-nn" aria-label="החודש הבא" data-tip="החודש הבא" onClick={onNext}><Ic name="chev" className="sm" /></button>
    </div>
  );
}

// ניווט הקישור של יום (BD-O3): קישור אמיתי לדף הלו״ז (Enter / לחיצה אמצעית / Ctrl+לחיצה עובדים כמו בכל קישור);
// לחיצה רגילה = ניווט בצד הלקוח (router.push) בלי טעינת דף מלאה.
function goTo(e, cell, onOpenDay) {
  e.stopPropagation();
  if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  onOpenDay(cell);
}

// ---------- תא יום בגריד ----------
// כמו dayCell בעיצוב המאושר, ורק זה (BD-O4, הבעלים 4.10.2026: "רק הסמנים והמספרים, בלי הפירוט של האתר הישן"): אות היום
// (MATCH-4), שם החודש ביום הראשון, סימן התראה אחד (S10 + איחור החזרה E12, JDG-5), פרשה וחגים כטקסט פשוט (E10) ומוני
// השלבים באותו גוון (S02; מונה עם התראה בגוון ההתראה). בלי שורות הזמנה ובלי אייקון "תצוגה מורחבת". איחור החזרה = מסגרת
// אדומה לתא (GAP-4) + הסימן; ההזמנות נטענות רק כדי לחשב אותו. לחיצה על התא = מעבר ללו״ז היומי (S06). בלי תאריך לועזי (E11).
export function DayCell({ cell, orders, stageDay, stages, selected, onOpenDay }) {
  const rows = dayStageRows(stageDay, stages, selected);
  const stageAlerts = rows.reduce((a, r) => a + (r.alerts ? r.alerts : 0), 0);
  const lateCfg = useLateCfg();
  const lateCount = orders.filter((o) => isOrderLate(o, lateCfg)).length;
  const alert = cellAlert(stageAlerts, lateCount);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const label = cell.hebrewLong + (total ? ' · ' + total + ' פעולות' : '');
  const open = (e) => {
    if (e.target.closest && e.target.closest('button,a')) return;
    onOpenDay(cell);
  };
  const href = '/schedule?date=' + cell.key;
  return (
    <div
      className={'hc-d lz-day' + (cell.isShabbat ? ' sh' : '') + (cell.isToday ? ' today' : '') + (lateCount ? ' bd-latecell' : '')}
      role="listitem"
      data-d={cell.key}
      onClick={open}
    >
      <span className="lz-dh">
        {/* הקישור הסמנטי של התא (ממצא נגישות 3): רק כותרת היום. לחיצה בעכבר בכל שטח התא עושה אותו דבר (S06) */}
        <a
          className="bd-dlink"
          href={href}
          aria-label={label}
          onClick={(e) => goTo(e, cell, onOpenDay)}
        >
          <b>{cell.letter}</b>
          {cell.monthName ? <em>{cell.monthName}</em> : null}
        </a>
        {alert ? (
          <span className="bd-dhx">
            <span className="tabmk debt lz-al" role="img" aria-label={alert.tip} data-tip={alert.tip}><Ic name="alert" className="sm" /></span>
          </span>
        ) : null}
      </span>
      {cell.notes.length ? <span className="bd-notes">{cell.notes.join(' · ')}</span> : null}
      {rows.length ? <StageCounters rows={rows} className="lz-rows" /> : null}
    </div>
  );
}

// מוני השלבים (lz-pr של העיצוב): אייקון השלב + המספר; מונה עם התראה בגוון ההתראה. משמש את התא ואת תצוגת הרשימה.
function StageCounters({ rows, className }) {
  return (
    <span className={className}>
      {rows.map((r) => (
        <span key={r.stage.key} className={'lz-pr' + (r.alerts ? ' al' : '')} data-tip={stageCountText(r.stage, r.total) + (r.alerts ? ' · ' + r.alerts + ' עם התראה' : '')}>
          <Ic name={(STAGE_META[r.stage.key] || STAGE_META.order).icon} /><b>{r.total}</b>
        </span>
      ))}
    </span>
  );
}

// ---------- גריד החודש (MATCH-3: שורת ימי השבוע; S08: תאים ריקים בקצוות) ----------
export function MonthGrid({ weeks, head, ordersByDate, stagesDays, stages, selected, onOpenDay }) {
  return (
    <div className="hc lz-hc">
      {head}
      <div className="hc-w" aria-hidden="true">{WD_SHORT.map((x) => <span key={x}>{x}</span>)}</div>
      <div className="hc-g lz-g" role="list" aria-label="ימי החודש">
        {weeks.flat().map((cell, i) => (cell ? (
          <DayCell
            key={cell.key}
            cell={cell}
            orders={ordersByDate[cell.key] || []}
            stageDay={stagesDays ? stagesDays[cell.key] : null}
            stages={stages}
            selected={selected}
            onOpenDay={onOpenDay}
          />
        ) : <span key={'e' + i} className="hc-e bd-empty" aria-hidden="true" />))}
      </div>
    </div>
  );
}

// ---------- תצוגת רשימה (S03; בנייד אוטומטית) ----------
// החלטת הבעלים (5.10.2026, "לוח חודשי מעולה ומאושר" + שינוי אחד): בתצוגת השורות כל יום נראה ופועל כמו שורה בתוצאות החיפוש
// של דף הבית (HomeResults.js: card.res-one > .list > a.li.rlink.lrow, בדיוק אותה אנטומיה: לוחית ic-b כהה, .t עם b ו-.ln, חץ
// .go) והאייקונים עם המספרים בתוך השורה (אותם lz-pr של התא, בצד הסופי של השורה). כותרת השורה = היום העברי, שורת המשנה =
// פרשה / חג. כל השורה היא קישור ל-/schedule?date= (BD-O3). מוצגים רק ימים עם מונים (לפי המסנן) או עם סימן התראה.
export function DayList({ weeks, head, ordersByDate, stagesDays, stages, selected, onOpenDay }) {
  const lateCfg = useLateCfg();
  const days = weeks.flat().filter(Boolean).map((cell) => {
    const orders = ordersByDate[cell.key] || [];
    const rows = dayStageRows(stagesDays ? stagesDays[cell.key] : null, stages, selected);
    const late = orders.filter((o) => isOrderLate(o, lateCfg)).length;
    const alert = cellAlert(rows.reduce((a, r) => a + r.alerts, 0), late);
    return { cell, rows, alert, late };
  }).filter((d) => d.rows.length || d.alert);
  return (
    <div className="card items-card lz-lcard bd-lcard res-one">
      {head}
      {days.length ? (
        <div className="list bd-list" aria-label="ימי החודש">
          {days.map(({ cell, rows, alert, late }) => {
            const total = rows.reduce((a, r) => a + r.total, 0);
            return (
              <a
                key={cell.key}
                className={'li rlink lrow bd-lrow' + (cell.isToday ? ' bd-ltoday' : '') + (late ? ' bd-latecell' : '')}
                href={'/schedule?date=' + cell.key}
                aria-label={cell.hebrewLong + (total ? ' · ' + total + ' פעולות' : '')}
                data-d={cell.key}
                onClick={(e) => goTo(e, cell, onOpenDay)}
              >
                <div className="ic-b"><Ic name="cal" /><span className="rlbl">{cell.letter}</span></div>
                <div className="t">
                  <b>{cell.hebrewLong}</b>
                  {cell.notes.length ? <span className="ln">{cell.notes.join(' · ')}</span> : null}
                </div>
                {rows.length ? <StageCounters rows={rows} className="bd-lc" /> : null}
                {alert ? <span className="tabmk debt lz-al" role="img" aria-label={alert.tip} data-tip={alert.tip}><Ic name="alert" className="sm" /></span> : null}
                <Ic name="chev" className="go sm" />
              </a>
            );
          })}
        </div>
      ) : (
        <div className="empty" role="status"><Ic name="cal" className="lg" /><div>אין פעולות בחודש הזה</div></div>
      )}
    </div>
  );
}

export { WEEKDAYS };
