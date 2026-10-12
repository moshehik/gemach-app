'use client';

// כיוון החצים (RTL, כמו בשאר האתר: דפדוף עמודים / חודשים / ימים): הקודם = arrr (מצביע ימינה), הבא = arrl (מצביע שמאלה).
// KioskCalendar - לוח האירוע של עמדת הלקוח בעיצוב המאושר (עמדת-לקוח.html: .caldock): חודש עברי אחד עם חצי חודש קודם / הבא,
// שמות חגים ופרשות בתאי הלוח (S07), הצללת שבת / חג, וכפתור "היום". מעל הלוח - שלוש רשימות היום / חודש / שנה (R17 - יכולת קיימת בעמדה).
// הלוגיקה (hebcal) זהה ללוח הישן; המצב (תאריך נבחר) מוחזק אצל הקורא: selectedDate = Date | null, onSelect(Date).

import { useEffect, useMemo, useState } from 'react';
import { HDate, gematriya } from '@hebcal/core';
import { HEBREW_DAYS } from '@/lib/hebrewDate';
import { getMonthsForYear, buildMonthCells, holidayLabel, parshaLabelForSaturday, gershayim } from './kioskLogic';
import { KIcon } from './KioskParts';

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const WEEKDAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

function monthLabelOf(month, year) {
  return getMonthsForYear(year).find((m) => m.value === month)?.label || '';
}

export default function KioskCalendar({ selectedDate, onSelect, showSelects = true }) {
  const selHd = useMemo(() => {
    try {
      if (!selectedDate) return null;
      const d = new Date(selectedDate);
      return Number.isNaN(d.getTime()) ? null : new HDate(d);
    } catch (e) { return null; }
  }, [selectedDate]);
  const todayHd = useMemo(() => new HDate(), []);
  const todayAbs = todayHd.abs();

  const [viewYear, setViewYear] = useState(() => (selHd || todayHd).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (selHd || todayHd).getMonth());

  // כשהבחירה משתנה מבחוץ (למשל דרך ה-AI) הלוח קופץ לחודש של התאריך
  useEffect(() => {
    if (!selHd) return;
    setViewYear(selHd.getFullYear());
    setViewMonth(selHd.getMonth());
  }, [selHd]);

  const dim = HDate.daysInMonth(viewMonth, viewYear);
  const cells = useMemo(() => buildMonthCells(viewMonth, viewYear), [viewMonth, viewYear]);
  const selAbs = selHd ? selHd.abs() : null;

  const applyHdate = (hd) => {
    const g = hd.greg();
    g.setHours(0, 0, 0, 0);
    onSelect(g);
  };
  const changeSelection = (day, month, year) => {
    let mm = month;
    if (mm === 13 && !HDate.isLeapYear(year)) mm = 12;
    const d = HDate.daysInMonth(mm, year);
    applyHdate(new HDate(Math.min(day, d), mm, year));
  };
  const prevMonth = () => {
    const p = new HDate(1, viewMonth, viewYear).subtract(1, 'd');
    setViewMonth(p.getMonth());
    setViewYear(p.getFullYear());
  };
  const nextMonth = () => {
    const n = new HDate(1, viewMonth, viewYear).add(dim, 'd');
    setViewMonth(n.getMonth());
    setViewYear(n.getFullYear());
  };
  const goToday = () => {
    setViewMonth(todayHd.getMonth());
    setViewYear(todayHd.getFullYear());
    applyHdate(new HDate());
  };

  const yearOptions = useMemo(() => {
    const cur = new HDate().getFullYear();
    return Array.from({ length: 32 }, (_, i) => cur - 1 + i);
  }, []);
  const sel = selHd || todayHd; // ברירת המחדל של הרשימות כשעוד לא נבחר תאריך: היום (בלי לסמן אותו כנבחר)

  // שורות של 7 עם קו מפריד בין שבוע לשבוע (.dpg-divider של הדגימה)
  const weekRows = [];
  for (let i = 0; i < cells.length; i += 7) weekRows.push(cells.slice(i, i + 7));

  return (
    <>
      {showSelects && (
        <div className="ks-selects">
          <div className="ks-sel">
            <label htmlFor="ks-cal-day">יום</label>
            <select id="ks-cal-day" className="inp" data-agy-id="kiosk_cal_day_select" value={sel.getDate()}
              onChange={(e) => changeSelection(parseInt(e.target.value, 10), sel.getMonth(), sel.getFullYear())}>
              {Array.from({ length: HDate.daysInMonth(sel.getMonth(), sel.getFullYear()) }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{HEBREW_DAYS[d]}</option>
              ))}
            </select>
          </div>
          <div className="ks-sel">
            <label htmlFor="ks-cal-month">חודש</label>
            <select id="ks-cal-month" className="inp" data-agy-id="kiosk_cal_month_select" value={sel.getMonth()}
              onChange={(e) => changeSelection(sel.getDate(), parseInt(e.target.value, 10), sel.getFullYear())}>
              {getMonthsForYear(sel.getFullYear()).map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </div>
          <div className="ks-sel">
            <label htmlFor="ks-cal-year">שנה</label>
            <select id="ks-cal-year" className="inp" data-agy-id="kiosk_cal_year_select" value={sel.getFullYear()}
              onChange={(e) => changeSelection(sel.getDate(), sel.getMonth(), parseInt(e.target.value, 10))}>
              {yearOptions.map((y) => (<option key={y} value={y}>{gematriya(y)}</option>))}
            </select>
          </div>
        </div>
      )}

      <div className="caldock" id="cal1">
        <div className="dph">
          <button type="button" className="dpn" data-calnav="-1" aria-label="החודש הקודם" onClick={prevMonth}><KIcon id="arrr" size="sm" /></button>
          <b className="dpt" aria-live="polite">{monthLabelOf(viewMonth, viewYear)} {gematriya(viewYear)}</b>
          <button type="button" className="dpn" data-calnav="1" aria-label="החודש הבא" onClick={nextMonth}><KIcon id="arrl" size="sm" /></button>
        </div>
        <div className="dpw" aria-hidden="true">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="dpg" role="grid">
          {weekRows.map((row, wi) => (
            <WeekRow key={wi} row={row} divider={wi < weekRows.length - 1} selAbs={selAbs} todayAbs={todayAbs} onPick={applyHdate} />
          ))}
        </div>
        <div className="dpf">
          <button type="button" className="dpq" data-agy-id="kiosk_cal_clear_btn" data-caltoday="" onClick={goToday}><KIcon id="cal" size="sm" />היום</button>
        </div>
      </div>
    </>
  );
}

function WeekRow({ row, divider, selAbs, todayAbs, onPick }) {
  const padded = [...row];
  while (padded.length < 7) padded.push(null);
  return (
    <>
      {padded.map((hd, i) => {
        if (!hd) return <span key={i} className="dpe" />;
        const abs = hd.abs();
        const dow = hd.getDay();
        const hol = holidayLabel(hd);
        const par = parshaLabelForSaturday(hd);
        const shabbatOrChag = dow === 6 || !!hol;
        const label = `${WEEKDAY_NAMES[dow]} ${HEBREW_DAYS[hd.getDate()]} ${monthLabelOf(hd.getMonth(), hd.getFullYear())} ${gematriya(hd.getFullYear())}${hol ? ` · ${hol}` : ''}${par ? ` · פרשת ${par}` : ''}`;
        const isSel = abs === selAbs;
        return (
          <button key={i} type="button"
            className={`dpc${isSel ? ' on' : ''}${abs === todayAbs ? ' today' : ''}${shabbatOrChag ? ' sh' : ''}`}
            aria-label={label} aria-pressed={isSel} onClick={() => onPick(hd)}>
            <span>{gershayim(HEBREW_DAYS[hd.getDate()])}</span>
            {hol ? <small className="dpc-hol">{hol}</small> : null}
            {par ? <small className="dpc-par">{par}</small> : null}
          </button>
        );
      })}
      {divider ? <div className="dpg-divider" /> : null}
    </>
  );
}
