'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HDate, gematriya, Sedra, Locale } from '@hebcal/core';
import { HEBREW_DAYS, getHebrewDateString } from '@/lib/hebrewDate';

const getMonthsForYear = (year) => {
  const isLeap = HDate.isLeapYear(year);
  return [
    { value: 7, label: 'תשרי' },
    { value: 8, label: 'חשוון' },
    { value: 9, label: 'כסלו' },
    { value: 10, label: 'טבת' },
    { value: 11, label: 'שבט' },
    { value: 12, label: isLeap ? "אדר א'" : 'אדר' },
    ...(isLeap ? [{ value: 13, label: "אדר ב'" }] : []),
    { value: 1, label: 'ניסן' },
    { value: 2, label: 'אייר' },
    { value: 3, label: 'סיוון' },
    { value: 4, label: 'תמוז' },
    { value: 5, label: 'אב' },
    { value: 6, label: 'אלול' },
  ];
};

// ISO מקומי (בלי toISOString שסוטה ל-UTC וזז יום אחורה בערב)
const toLocalISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const hdateToISO = (hd) => toLocalISO(hd.greg());

const nextHebMonth = (year, month) => {
  const days = HDate.daysInMonth(month, year);
  const next = new HDate(1, month, year).add(days, 'd');
  return { year: next.getFullYear(), month: next.getMonth() };
};

const prevHebMonth = (year, month) => {
  const prev = new HDate(1, month, year).subtract(1, 'd');
  return { year: prev.getFullYear(), month: prev.getMonth() };
};

export default function HebrewDateRangePicker({
  startDate,
  endDate,
  onChange,
  className,
  style,
  placeholderStart = 'מתאריך...',
  placeholderEnd = 'עד תאריך...'
}) {
  const [isOpen, setIsOpen] = useState(false);

  // חודש הבסיס: הפאנל הראשון מציג אותו, השני תמיד את החודש העוקב
  const [base, setBase] = useState({ year: '', month: '' });

  // בחירה זמנית — נכתבת החוצה רק ב"אישור"
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');
  const [hoverIso, setHoverIso] = useState('');

  const containerRef = useRef(null);

  // אתחול בפתיחה: מתמקמים על חודש תאריך ההתחלה (או היום)
  useEffect(() => {
    if (!isOpen) return;
    try {
      const start = startDate ? new Date(startDate) : null;
      const parsedStart = (start && !isNaN(start.getTime())) ? start : new Date();
      const hd = new HDate(parsedStart);
      setBase({ year: hd.getFullYear(), month: hd.getMonth() });
      // נרמול לתאריך-בלבד: ב-orders/new הערכים מגיעים עם שעה (2026-01-01T10:00)
      // וההשוואות וההדגשה בגריד עובדות על מחרוזות YYYY-MM-DD
      setTempStart((startDate || '').split('T')[0]);
      setTempEnd((endDate || '').split('T')[0]);
      setHoverIso('');
    } catch (e) {
      console.error(e);
    }
  }, [isOpen, startDate, endDate]);

  // סגירה ב-Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const getHebrewLabel = (dateStr, fallback = '') => {
    if (!dateStr) return fallback;
    return getHebrewDateString(dateStr) || fallback;
  };

  const handleSelectDay = (isoStr) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(isoStr);
      setTempEnd('');
    } else if (isoStr < tempStart) {
      // בחר תאריך מוקדם מההתחלה — מתהפכים
      setTempEnd(tempStart);
      setTempStart(isoStr);
    } else {
      setTempEnd(isoStr);
    }
  };

  const handleClear = () => {
    setTempStart('');
    setTempEnd('');
    setHoverIso('');
  };

  const applyPreset = (days) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    setTempStart(toLocalISO(start));
    setTempEnd(toLocalISO(end));
    const hd = new HDate(start);
    setBase({ year: hd.getFullYear(), month: hd.getMonth() });
  };

  const goToToday = () => {
    const hd = new HDate();
    setBase({ year: hd.getFullYear(), month: hd.getMonth() });
  };

  const handleApply = () => {
    onChange(tempStart, tempEnd);
    setIsOpen(false);
  };

  const secondPanel = useMemo(() => {
    if (!base.year || !base.month) return null;
    return nextHebMonth(base.year, base.month);
  }, [base]);

  // Sedra לשתי השנים המוצגות (ייתכן שהפאנלים חוצים שנה)
  const sedras = useMemo(() => {
    const map = {};
    if (base.year) {
      try { map[base.year] = new Sedra(base.year, true); } catch (e) {}
      if (secondPanel && !map[secondPanel.year]) {
        try { map[secondPanel.year] = new Sedra(secondPanel.year, true); } catch (e) {}
      }
    }
    return map;
  }, [base.year, secondPanel]);

  const todayAbs = useMemo(() => {
    try { return new HDate().abs(); } catch (e) { return null; }
  }, [isOpen]);

  // טווח התצוגה: הטווח שנבחר, או תצוגה מקדימה לפי ריחוף כשנבחרה רק התחלה
  const previewRange = useMemo(() => {
    if (tempStart && tempEnd) return { from: tempStart, to: tempEnd };
    if (tempStart && hoverIso) {
      return hoverIso < tempStart
        ? { from: hoverIso, to: tempStart }
        : { from: tempStart, to: hoverIso };
    }
    return null;
  }, [tempStart, tempEnd, hoverIso]);

  const daysCount = useMemo(() => {
    if (!tempStart || !tempEnd) return 0;
    const ms = new Date(tempEnd) - new Date(tempStart);
    return Math.round(ms / 86400000) + 1;
  }, [tempStart, tempEnd]);

  const yearOptions = useMemo(() => {
    const currentHebYear = base.year || new HDate().getFullYear();
    const opts = [];
    for (let y = currentHebYear - 30; y < currentHebYear + 30; y++) opts.push(y);
    return opts;
  }, [base.year]);

  const renderPanel = ({ year, month }) => {
    const daysInMonth = HDate.daysInMonth(month, year);
    const firstDayOfWeek = new HDate(1, month, year).greg().getDay();
    const blanks = Array.from({ length: firstDayOfWeek });
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const months = getMonthsForYear(year);
    const monthLabel = months.find(m => m.value === month)?.label || '';
    const sedra = sedras[year] || null;

    return (
      <div className="datepicker range-panel">
        <div className="datepicker-head" style={{ justifyContent: 'center' }}>
          <strong>{monthLabel} {gematriya(year)}</strong>
        </div>

        <div className="datepicker-weekdays">
          <div>א'</div>
          <div>ב'</div>
          <div>ג'</div>
          <div>ד'</div>
          <div>ה'</div>
          <div>ו'</div>
          <div style={{ color: 'var(--primary-solid)' }}>ש'</div>
        </div>

        <div className="datepicker-grid" onMouseLeave={() => setHoverIso('')}>
          {blanks.map((_, i) => <div key={`blank-${i}`} />)}
          {days.map(d => {
            let isSaturday = false;
            let parashaName = null;
            let isoDate = '';
            let isToday = false;

            try {
              const hd = new HDate(d, month, year);
              isoDate = hdateToISO(hd);
              isToday = todayAbs !== null && hd.abs() === todayAbs;
              if (hd.greg().getDay() === 6) {
                isSaturday = true;
                if (sedra) {
                  const lookup = sedra.lookup(hd);
                  parashaName = lookup && lookup.parsha ? lookup.parsha.map(p => Locale.gettext(p, 'he-x-NoNikud')).join('-') : '';
                }
              }
            } catch (e) {}

            const isBoundary = isoDate && (isoDate === tempStart || isoDate === tempEnd);
            const isInRange = !isBoundary && previewRange
              && isoDate > previewRange.from && isoDate < previewRange.to;

            return (
              <div
                key={d}
                onClick={() => isoDate && handleSelectDay(isoDate)}
                onMouseEnter={() => setHoverIso(isoDate)}
                className={`datepicker-day${isBoundary ? ' selected' : ''}${isInRange ? ' in-range' : ''}${isToday && !isBoundary ? ' today' : ''}`}
              >
                <span>{HEBREW_DAYS[d]}</span>
                {isSaturday && parashaName && (
                  <span className="g-num" title={parashaName}>{parashaName}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const fromLabel = getHebrewLabel(startDate, placeholderStart);
  const toLabel = getHebrewLabel(endDate, placeholderEnd);
  const baseMonths = base.year ? getMonthsForYear(base.year) : [];

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...(style || {}) }} className={className}>
      {/* פס הטריגר */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`date-range-trigger${isOpen ? ' open' : ''}`}
      >
        <div className="seg">
          <span className="seg-label">מתאריך:</span>
          <span className={`seg-value${startDate ? '' : ' placeholder'}`}>{fromLabel}</span>
        </div>

        <span className="seg-arrow">
          <svg className="icon"><use href="#i-chevron-start" /></svg>
        </span>

        <div className="seg seg-end">
          <span className="seg-label">עד תאריך:</span>
          <span className={`seg-value${endDate ? '' : ' placeholder'}`}>{toLabel}</span>
        </div>

        <div className="trigger-icon">
          <svg className="icon"><use href="#i-calendar" /></svg>
        </div>
      </div>

      {/* חלונית הלוח הכפול */}
      {isOpen && base.year && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="modal range-cal-modal animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* כותרת */}
            <div className="modal-head">
              <div>
                <strong>
                  <svg className="icon"><use href="#i-calendar" /></svg>
                  בחירת טווח תאריכים
                </strong>
                <p className="range-cal-summary">
                  {tempStart ? (
                    <>
                      <strong>{getHebrewLabel(tempStart)}</strong>
                      {' ← '}
                      {tempEnd
                        ? <><strong>{getHebrewLabel(tempEnd)}</strong> <span className="range-cal-count">({daysCount} ימים)</span></>
                        : 'בחרו תאריך סיום...'}
                    </>
                  ) : 'בחרו תאריך התחלה בלוח'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-ghost btn-icon-only btn-sm"
                title="סגור"
              >
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            <div className="modal-body">
              {/* בחירה מהירה */}
              <div className="pill-tabs range-cal-presets">
                <span className="range-cal-presets-label">בחירה מהירה:</span>
                <button type="button" onClick={() => applyPreset(7)} className="pill-tab">שבוע</button>
                <button type="button" onClick={() => applyPreset(14)} className="pill-tab">שבועיים</button>
                <button type="button" onClick={() => applyPreset(30)} className="pill-tab">חודש</button>
                <button type="button" onClick={() => applyPreset(90)} className="pill-tab">3 חודשים</button>
              </div>

              {/* ניווט משותף לשני החודשים */}
              <div className="range-cal-controls">
                <button
                  type="button"
                  onClick={() => setBase(b => prevHebMonth(b.year, b.month))}
                  className="btn btn-secondary btn-icon-only btn-sm"
                  title="חודש קודם"
                >
                  <svg className="icon"><use href="#i-chevron-end" /></svg>
                </button>

                <select
                  value={base.month}
                  onChange={e => setBase(b => ({ ...b, month: parseInt(e.target.value) }))}
                  className="select"
                >
                  {baseMonths.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>

                <select
                  value={base.year}
                  onChange={e => {
                    const newYear = parseInt(e.target.value);
                    setBase(b => {
                      let newMonth = b.month;
                      if (newMonth === 13 && !HDate.isLeapYear(newYear)) newMonth = 12;
                      return { year: newYear, month: newMonth };
                    });
                  }}
                  className="select"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{gematriya(y)}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={goToToday}
                  className="btn btn-secondary btn-icon-only btn-sm"
                  title="חזרה להיום"
                >
                  <svg className="icon"><use href="#i-home" /></svg>
                </button>

                <button
                  type="button"
                  onClick={() => setBase(b => nextHebMonth(b.year, b.month))}
                  className="btn btn-secondary btn-icon-only btn-sm"
                  title="חודש הבא"
                >
                  <svg className="icon"><use href="#i-chevron-start" /></svg>
                </button>
              </div>

              {/* שני חודשים עוקבים */}
              <div className="range-cal-panels">
                {renderPanel(base)}
                {secondPanel && renderPanel(secondPanel)}
              </div>
            </div>

            {/* כפתורי פעולה — תמיד גלויים, לא נגללים */}
            <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={handleClear}
                disabled={!tempStart && !tempEnd}
                className="btn btn-secondary"
              >
                נקה בחירה
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-secondary"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!tempStart || !tempEnd}
                  className="btn btn-primary"
                >
                  <svg className="icon"><use href="#i-check" /></svg>
                  אישור בחירה
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
