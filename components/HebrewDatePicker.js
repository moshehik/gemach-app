'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HDate, gematriya, Sedra, Locale } from '@hebcal/core';
import { HEBREW_DAYS, getHebrewMonthYear, getHebrewDateString } from '@/lib/hebrewDate';

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

export default function HebrewDatePicker({
  value,
  selectedDate,
  onChange,
  className,
  style,
  iconOnly = false,
  monthYearOnly = false
}) {
  const actualValue = value || selectedDate;
  const isCompactMode = iconOnly || monthYearOnly;
  const [isOpen, setIsOpen] = useState(false);
  const [hYear, setHYear] = useState('');
  const [hMonth, setHMonth] = useState('');
  const [hDay, setHDay] = useState(1);
  const containerRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);

  const toggleOpen = () => {
    if (!isOpen && containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    try {
      const date = actualValue ? new Date(actualValue) : new Date();
      if (!isNaN(date.getTime())) {
        const hd = new HDate(date);
        setHYear(hd.getFullYear());
        setHMonth(hd.getMonth());
        setHDay(hd.getDate());
      } else {
        const hd = new HDate();
        setHYear(hd.getFullYear());
        setHMonth(hd.getMonth());
        setHDay(hd.getDate());
      }
    } catch (e) {
      console.error(e);
    }
  }, [actualValue, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const updateRect = () => {
        if (containerRef.current) {
          setDropdownRect(containerRef.current.getBoundingClientRect());
        }
      };
      updateRect();
      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);
      return () => {
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('resize', updateRect);
      };
    }
  }, [isOpen]);

  // Format string for trigger
  const displayString = React.useMemo(() => {
    if (!actualValue) return isCompactMode ? 'בחר חודש ושנה...' : 'בחר תאריך...';

    if (isCompactMode) {
      const mStr = getHebrewMonthYear(actualValue);
      return mStr || getHebrewDateString(actualValue) || 'בחר חודש ושנה...';
    }

    let dStr = getHebrewDateString(actualValue);
    try {
      const d = new Date(actualValue);
      if (!isNaN(d.getTime())) {
        const hd = new HDate(d);
        if (hd.greg().getDay() === 6) {
          const s = new Sedra(hd.getFullYear(), true);
          const lookup = s.lookup(hd);
          const parashaName = lookup && lookup.parsha ? lookup.parsha.map(p => Locale.gettext(p, 'he-x-NoNikud')).join('-') : '';
          if (parashaName) {
            dStr += ` - פרשת ${parashaName}`;
          }
        }
      }
    } catch (e) {}

    return dStr || 'בחר תאריך...';
  }, [actualValue, isCompactMode]);

  // Apply function for Compact Mode (Month/Year)
  const handleApplyMonthYear = (monthToApply, yearToApply) => {
    try {
      const targetMonth = monthToApply !== undefined ? monthToApply : hMonth;
      const targetYear = yearToApply !== undefined ? yearToApply : hYear;

      let validDay = hDay || 1;
      const daysInMonth = HDate.daysInMonth(targetMonth, targetYear);
      if (validDay > daysInMonth) {
        validDay = daysInMonth;
      }

      const hd = new HDate(validDay, targetMonth, targetYear);
      const greg = hd.greg();
      const year = greg.getFullYear();
      const monthStr = String(greg.getMonth() + 1).padStart(2, '0');
      const dayStr = String(greg.getDate()).padStart(2, '0');
      onChange(`${year}-${monthStr}-${dayStr}`);
      setIsOpen(false);
    } catch (e) {
      console.error('Invalid Hebrew date', e);
    }
  };

  // Apply function for Full Days Calendar Mode
  const handleApplyFullDate = (dayToApply) => {
    try {
      let validDay = typeof dayToApply === 'number' ? dayToApply : hDay;
      const daysInMonth = HDate.daysInMonth(hMonth, hYear);
      if (validDay > daysInMonth) {
        validDay = daysInMonth;
      }
      const hd = new HDate(validDay, hMonth, hYear);
      const greg = hd.greg();
      const year = greg.getFullYear();
      const monthStr = String(greg.getMonth() + 1).padStart(2, '0');
      const dayStr = String(greg.getDate()).padStart(2, '0');
      onChange(`${year}-${monthStr}-${dayStr}`);
      setIsOpen(false);
    } catch (e) {
      console.error('Invalid Hebrew date', e);
    }
  };

  const currentYearOptions = [];
  const currentHebYear = hYear || new HDate().getFullYear();
  const startYear = currentHebYear - 30;
  for (let i = 0; i < 60; i++) {
    currentYearOptions.push(startYear + i);
  }

  const months = hYear ? getMonthsForYear(hYear) : [];
  const daysInMonth = (hYear && hMonth) ? HDate.daysInMonth(hMonth, hYear) : 30;
  const currentMonthLabel = months.find(m => m.value === hMonth)?.label || '';

  const gridSedra = React.useMemo(() => {
    try {
      if (isOpen && hYear && !isCompactMode) {
        return new Sedra(hYear, true);
      }
    } catch (e) {}
    return null;
  }, [isOpen, hYear, isCompactMode]);

  const todayAbs = React.useMemo(() => {
    try { return new HDate().abs(); } catch (e) { return null; }
  }, [isOpen]);

  const goToPrevYear = () => {
    const newYear = hYear - 1;
    setHYear(newYear);
    if (hMonth === 13 && !HDate.isLeapYear(newYear)) setHMonth(12);
  };
  const goToNextYear = () => {
    const newYear = hYear + 1;
    setHYear(newYear);
    if (hMonth === 13 && !HDate.isLeapYear(newYear)) setHMonth(12);
  };
  const goToToday = () => {
    const hd = new HDate();
    const curY = hd.getFullYear();
    const curM = hd.getMonth();
    setHYear(curY);
    setHMonth(curM);
    setHDay(hd.getDate());
    return { curY, curM };
  };

  // -------------------------------------------------------------
  // RENDER COMPACT ICON-ONLY MODE (used on board page)
  // -------------------------------------------------------------
  if (isCompactMode) {
    return (
      <div
        data-agy-id="hebrew_date_picker_container"
        ref={containerRef}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: 'auto', zIndex: isOpen ? 99999 : 1, ...(style || {}) }}
      >
        <button
          data-agy-id="hebrew_date_picker_toggle_btn"
          type="button"
          onClick={toggleOpen}
          title={displayString}
          aria-label={displayString}
          className={`btn btn-ghost btn-icon-only${className ? ` ${className}` : ''}`}
        >
          <svg className="icon"><use href="#i-calendar" /></svg>
        </button>

        {isOpen && typeof document !== 'undefined' && createPortal(
          <div
            className="modal-backdrop"
            style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setIsOpen(false)}
          >
            <div
              className="modal animate-fade-in"
              style={{ width: '340px', maxWidth: '92vw', margin: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-calendar" /></svg>
                בחירת חודש ושנה
              </strong>
              <button
                data-agy-id="hebrew_date_picker_close_btn"
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-ghost btn-icon-only btn-sm"
                title="סגור"
              >
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            <div className="modal-body">
            {/* Year Selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '8px' }}>
              <button
                data-agy-id="hebrew_date_picker_prev_year_btn"
                type="button"
                onClick={goToPrevYear}
                className="btn btn-secondary btn-icon-only btn-sm"
                title="שנה קודמת"
              >
                <svg className="icon"><use href="#i-chevron-end" /></svg>
              </button>

              <select
                data-agy-id="hebrew_date_picker_year_select"
                className="select"
                value={hYear}
                onChange={e => {
                   const newYear = parseInt(e.target.value);
                   setHYear(newYear);
                   if (hMonth === 13 && !HDate.isLeapYear(newYear)) setHMonth(12);
                }}
                style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}
              >
                {currentYearOptions.map(y => (
                  <option key={y} value={y}>{gematriya(y)} ({y})</option>
                ))}
              </select>

              <button
                data-agy-id="hebrew_date_picker_next_year_btn"
                type="button"
                onClick={goToNextYear}
                className="btn btn-secondary btn-icon-only btn-sm"
                title="שנה הבאה"
              >
                <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>

              <button
                data-agy-id="hebrew_date_picker_today_btn"
                type="button"
                onClick={() => {
                  const { curM, curY } = goToToday();
                  handleApplyMonthYear(curM, curY);
                }}
                className="btn btn-primary btn-sm"
                title="עבור לחודש הנוכחי"
              >
                <svg className="icon"><use href="#i-home" /></svg> החודש
              </button>
            </div>

            {/* Month Selector Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {months.map(m => {
                const isSelected = hMonth === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => {
                      setHMonth(m.value);
                      handleApplyMonthYear(m.value, hYear);
                    }}
                    className={`pill-tab${isSelected ? ' active' : ''}`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            </div>

            {/* Action Footer */}
            <div className="modal-foot">
              <button
                data-agy-id="hebrew_date_picker_cancel_btn"
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-secondary"
              >
                <svg className="icon"><use href="#i-x" /></svg> ביטול
              </button>
              <button
                data-agy-id="hebrew_date_picker_apply_btn"
                type="button"
                onClick={() => handleApplyMonthYear()}
                className="btn btn-primary"
              >
                <svg className="icon"><use href="#i-check" /></svg> אישור
              </button>
            </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER STANDARD FULL DATE PICKER MODE (everywhere else in app)
  // -------------------------------------------------------------
  return (
    <div data-agy-id="hebrew_date_picker_container" ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 99999 : 1 }}>
      <div className={`date-trigger${className ? ` ${className}` : ''}`} style={style}>
        <svg className="icon lead-icon"><use href="#i-calendar" /></svg>
        <button
          data-agy-id="hebrew_date_picker_toggle_btn"
          type="button"
          onClick={toggleOpen}
          className="input"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'start', cursor: 'pointer' }}
        >
          <span>{displayString}</span>
        </button>
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
          <div
            className="modal-backdrop"
            style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setIsOpen(false)}
          >
            <div className="datepicker animate-fade-in" style={{ width: '320px', maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div className="datepicker-head">
              <strong>{currentMonthLabel} {hYear ? gematriya(hYear) : ''}</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <div className="datepicker-nav">
                  <button data-agy-id="hebrew_date_picker_prev_month_btn" type="button" onClick={() => {
                      const prev = new HDate(1, hMonth, hYear).subtract(1, 'd');
                      setHMonth(prev.getMonth());
                      setHYear(prev.getFullYear());
                  }} className="btn btn-ghost btn-icon-only btn-sm" title="חודש קודם">
                    <svg className="icon"><use href="#i-chevron-end" /></svg>
                  </button>
                  <button data-agy-id="hebrew_date_picker_today_btn" type="button" onClick={goToToday} className="btn btn-ghost btn-icon-only btn-sm" title="חזור להיום">
                    <svg className="icon"><use href="#i-home" /></svg>
                  </button>
                  <button data-agy-id="hebrew_date_picker_next_month_btn" type="button" onClick={() => {
                      const days = HDate.daysInMonth(hMonth, hYear);
                      const next = new HDate(1, hMonth, hYear).add(days, 'd');
                      setHMonth(next.getMonth());
                      setHYear(next.getFullYear());
                  }} className="btn btn-ghost btn-icon-only btn-sm" title="חודש הבא">
                    <svg className="icon"><use href="#i-chevron-start" /></svg>
                  </button>
                </div>
                <button
                  data-agy-id="hebrew_date_picker_close_btn"
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-ghost btn-icon-only btn-sm"
                  title="סגור"
                >
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              </div>
            </div>

          <div className="form-grid cols-3" style={{ gap: '8px', marginBottom: '12px' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>יום</label>
              <select
                data-agy-id="hebrew_date_picker_day_select"
                className="select"
                value={hDay}
                onChange={e => setHDay(parseInt(e.target.value))}
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{HEBREW_DAYS[d]}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ margin: 0 }}>
              <label>חודש</label>
              <select
                data-agy-id="hebrew_date_picker_month_select"
                className="select"
                value={hMonth}
                onChange={e => {
                   const newMonth = parseInt(e.target.value);
                   setHMonth(newMonth);
                   if (hDay > HDate.daysInMonth(newMonth, hYear)) {
                      setHDay(HDate.daysInMonth(newMonth, hYear));
                   }
                }}
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ margin: 0 }}>
              <label>שנה</label>
              <select
                data-agy-id="hebrew_date_picker_year_select"
                className="select"
                value={hYear}
                onChange={e => {
                   const newYear = parseInt(e.target.value);
                   setHYear(newYear);
                   if (hMonth === 13 && !HDate.isLeapYear(newYear)) {
                      setHMonth(12);
                   }
                }}
              >
                {currentYearOptions.map(y => (
                  <option key={y} value={y}>{gematriya(y)}</option>
                ))}
              </select>
            </div>
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
          <div className="datepicker-grid">
            {(() => {
              try {
                const firstDayOfWeek = new HDate(1, hMonth, hYear).greg().getDay();
                const blanks = Array.from({ length: firstDayOfWeek });
                const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                return (
                  <>
                    {blanks.map((_, i) => <div key={`blank-${i}`} />)}
                    {days.map(d => {
                      let isSaturday = false;
                      let parashaName = null;
                      let isToday = false;
                      try {
                         const hdDay = new HDate(d, hMonth, hYear);
                         isToday = todayAbs !== null && hdDay.abs() === todayAbs;
                         if (hdDay.greg().getDay() === 6) {
                             isSaturday = true;
                             if (gridSedra) {
                                const lookup = gridSedra.lookup(hdDay);
                                parashaName = lookup && lookup.parsha ? lookup.parsha.map(p => Locale.gettext(p, 'he-x-NoNikud')).join('-') : '';
                             }
                         }
                      } catch(e) {}
                      const isSelected = d === hDay;
                      return (
                      <div
                        key={d}
                        onClick={() => { setHDay(d); handleApplyFullDate(d); }}
                        className={`datepicker-day${isSelected ? ' selected' : ''}${isToday && !isSelected ? ' today' : ''}`}
                      >
                        <span>{HEBREW_DAYS[d]}</span>
                        {isSaturday && parashaName && (
                           <span className="g-num">{parashaName}</span>
                        )}
                      </div>
                    )})}
                  </>
                );
              } catch (e) {
                return null;
              }
            })()}
          </div>

            {/* Action Footer */}
            <div className="datepicker-foot">
              <button
                data-agy-id="hebrew_date_picker_cancel_btn"
                type="button"
                onClick={() => setIsOpen(false)}
              >
                ביטול
              </button>
              <button
                data-agy-id="hebrew_date_picker_apply_btn"
                type="button"
                onClick={() => handleApplyFullDate()}
              >
                אישור
              </button>
            </div>
          </div>
          </div>,
        document.body
      )}
    </div>
  );
}
