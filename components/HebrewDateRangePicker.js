'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HDate, gematriya, Sedra, Locale } from '@hebcal/core';
import { HEBREW_DAYS, getHebrewMonthYear, getHebrewDateString, getHebrewMonthName, getHebrewYearString } from '@/lib/hebrewDate';

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

  // Local active panels month/year state
  const [fromPanel, setFromPanel] = useState({ year: '', month: '', day: 1 });
  const [toPanel, setToPanel] = useState({ year: '', month: '', day: 1 });

  // Local temporary selection values
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');

  const containerRef = useRef(null);

  // Initialize dates when open triggers or props change
  useEffect(() => {
    try {
      const today = new Date();
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      const parsedStart = (start && !isNaN(start.getTime())) ? start : today;
      const parsedEnd = (end && !isNaN(end.getTime())) ? end : null;

      const hdStart = new HDate(parsedStart);
      setFromPanel({
        year: hdStart.getFullYear(),
        month: hdStart.getMonth(),
        day: hdStart.getDate()
      });

      if (parsedEnd) {
        const hdEnd = new HDate(parsedEnd);
        if (hdEnd.getFullYear() === hdStart.getFullYear() && hdEnd.getMonth() === hdStart.getMonth()) {
          const daysInMonth = HDate.daysInMonth(hdStart.getMonth(), hdStart.getFullYear());
          const hdNext = new HDate(1, hdStart.getMonth(), hdStart.getFullYear()).add(daysInMonth + 1, 'd');
          setToPanel({
            year: hdNext.getFullYear(),
            month: hdNext.getMonth(),
            day: 1
          });
        } else {
          setToPanel({
            year: hdEnd.getFullYear(),
            month: hdEnd.getMonth(),
            day: hdEnd.getDate()
          });
        }
      } else {
        // Default to panel: next month
        const daysInMonth = HDate.daysInMonth(hdStart.getMonth(), hdStart.getFullYear());
        const hdNext = new HDate(1, hdStart.getMonth(), hdStart.getFullYear()).add(daysInMonth + 1, 'd');
        setToPanel({
          year: hdNext.getFullYear(),
          month: hdNext.getMonth(),
          day: 1
        });
      }

      setTempStart(startDate || '');
      setTempEnd(endDate || '');
    } catch (e) {
      console.error(e);
    }
  }, [startDate, endDate, isOpen]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  // Convert Date strings to Hebrew label
  const getHebrewLabel = (dateStr, fallback) => {
    if (!dateStr) return fallback;
    const dStr = getHebrewDateString(dateStr);
    return dStr || fallback;
  };

  // Format date to YYYY-MM-DD
  const formatISO = (hDate) => {
    const greg = hDate.greg();
    const year = greg.getFullYear();
    const month = String(greg.getMonth() + 1).padStart(2, '0');
    const day = String(greg.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Select day handler
  const handleSelectDay = (panelType, dayNumber, month, year) => {
    try {
      const hd = new HDate(dayNumber, month, year);
      const isoStr = formatISO(hd);

      if (!tempStart || (tempStart && tempEnd)) {
        // Start a new selection
        setTempStart(isoStr);
        setTempEnd('');
      } else {
        // tempStart is set, waiting for tempEnd
        if (new Date(isoStr) < new Date(tempStart)) {
          setTempEnd(tempStart);
          setTempStart(isoStr);
        } else {
          setTempEnd(isoStr);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Clear selections
  const handleClear = () => {
    setTempStart('');
    setTempEnd('');
  };

  // Preset ranges
  const applyPreset = (days) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const isoStart = start.toISOString().split('T')[0];
    const isoEnd = end.toISOString().split('T')[0];

    setTempStart(isoStart);
    setTempEnd(isoEnd);

    // Update active months
    const hdStart = new HDate(start);
    const hdEnd = new HDate(end);
    setFromPanel({ year: hdStart.getFullYear(), month: hdStart.getMonth(), day: hdStart.getDate() });
    setToPanel({ year: hdEnd.getFullYear(), month: hdEnd.getMonth(), day: hdEnd.getDate() });
  };

  const handleApply = () => {
    onChange(tempStart, tempEnd);
    setIsOpen(false);
  };

  // Date array rendering logic
  const renderCalendarDays = (panelType, currentPanel, setCurrentPanel) => {
    const { year, month } = currentPanel;
    if (!year || !month) return null;

    const daysInMonth = HDate.daysInMonth(month, year);
    const firstDayOfWeek = new HDate(1, month, year).greg().getDay();
    const blanks = Array.from({ length: firstDayOfWeek });
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    let gridSedra = null;
    try {
      gridSedra = new Sedra(year, true);
    } catch (e) {}

    return (
      <>
        {blanks.map((_, i) => <div key={`blank-${i}`} />)}
        {days.map(d => {
          let isSaturday = false;
          let parashaName = null;
          let isoDate = '';
          let isInRange = false;

          try {
            const hd = new HDate(d, month, year);
            isoDate = formatISO(hd);

            if (hd.greg().getDay() === 6) {
              isSaturday = true;
              if (gridSedra) {
                const lookup = gridSedra.lookup(hd);
                parashaName = lookup && lookup.parsha ? lookup.parsha.map(p => Locale.gettext(p, 'he-x-NoNikud')).join('-') : '';
              }
            }

            if (tempStart && tempEnd) {
              const currentMs = new Date(isoDate).getTime();
              const startMs = new Date(tempStart).getTime();
              const endMs = new Date(tempEnd).getTime();
              isInRange = currentMs > startMs && currentMs < endMs;
            }
          } catch(e) {}

          const isFromSelected = tempStart === isoDate;
          const isToSelected = tempEnd === isoDate;
          const isBoundary = isFromSelected || isToSelected;

          return (
            <div
              key={d}
              onClick={() => handleSelectDay(panelType, d, month, year)}
              className={`datepicker-day${isBoundary ? ' selected' : ''}${(!isBoundary && isInRange) ? ' in-range' : ''}`}
            >
              <span>{HEBREW_DAYS[d]}</span>
              {isSaturday && parashaName && (
                <span className="g-num">{parashaName}</span>
              )}
            </div>
          );
        })}
      </>
    );
  };

  const renderPanel = (panelType, currentPanel, setCurrentPanel, title) => {
    const { year, month } = currentPanel;
    if (!year || !month) return null;

    const startYear = year - 15;
    const yearOptions = [];
    for (let i = 0; i < 30; i++) {
      yearOptions.push(startYear + i);
    }
    const months = getMonthsForYear(year);
    const currentMonthLabel = months.find(m => m.value === month)?.label || '';

    const handlePrevMonth = () => {
      const prev = new HDate(1, month, year).subtract(1, 'd');
      setCurrentPanel({
        year: prev.getFullYear(),
        month: prev.getMonth(),
        day: 1
      });
    };

    const handleNextMonth = () => {
      const days = HDate.daysInMonth(month, year);
      const next = new HDate(1, month, year).add(days, 'd');
      setCurrentPanel({
        year: next.getFullYear(),
        month: next.getMonth(),
        day: 1
      });
    };

    return (
      <div className="card card-pad">
        {title && (
          <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: 'var(--primary-solid)', fontWeight: 'bold' }}>
            {title}
          </h4>
        )}

        {/* Navigation Month/Year */}
        <div className="datepicker-head" style={{ marginBottom: '10px' }}>
          <strong>{currentMonthLabel} {gematriya(year)}</strong>
          <div className="datepicker-nav">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="btn btn-ghost btn-icon-only btn-sm"
              title="חודש קודם"
            >
              <svg className="icon"><use href="#i-chevron-end" /></svg>
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="btn btn-ghost btn-icon-only btn-sm"
              title="חודש הבא"
            >
              <svg className="icon"><use href="#i-chevron-start" /></svg>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <select
            value={month}
            onChange={e => {
              const newMonth = parseInt(e.target.value);
              setCurrentPanel(p => ({ ...p, month: newMonth }));
            }}
            className="select"
            style={{ flex: 1, fontSize: '12.5px', padding: '6px 8px' }}
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          <select
            value={year}
            onChange={e => {
              const newYear = parseInt(e.target.value);
              setCurrentPanel(p => {
                let newMonth = p.month;
                if (newMonth === 13 && !HDate.isLeapYear(newYear)) {
                  newMonth = 12;
                }
                return { ...p, year: newYear, month: newMonth };
              });
            }}
            className="select"
            style={{ flex: 1, fontSize: '12.5px', padding: '6px 8px' }}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{gematriya(y)} ({y})</option>
            ))}
          </select>
        </div>

        {/* Days Header */}
        <div className="datepicker-weekdays">
          <div>א'</div>
          <div>ב'</div>
          <div>ג'</div>
          <div>ד'</div>
          <div>ה'</div>
          <div>ו'</div>
          <div style={{ color: 'var(--primary-solid)' }}>ש'</div>
        </div>

        {/* Days Grid */}
        <div className="datepicker-grid">
          {renderCalendarDays(panelType, currentPanel, setCurrentPanel)}
        </div>
      </div>
    );
  };

  const fromLabel = getHebrewLabel(tempStart, placeholderStart);
  const toLabel = getHebrewLabel(tempEnd, placeholderEnd);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...(style || {}) }} className={className}>
      {/* Trigger Bar */}
      <div
        onClick={toggleOpen}
        className={`date-range-trigger${isOpen ? ' open' : ''}`}
      >
        <div className="seg">
          <span className="seg-label">מתאריך:</span>
          <span className={`seg-value${tempStart ? '' : ' placeholder'}`}>{fromLabel}</span>
        </div>

        <span className="seg-arrow">
          <svg className="icon"><use href="#i-chevron-start" /></svg>
        </span>

        <div className="seg seg-end">
          <span className="seg-label">עד תאריך:</span>
          <span className={`seg-value${tempEnd ? '' : ' placeholder'}`}>{toLabel}</span>
        </div>

        <div className="trigger-icon">
          <svg className="icon"><use href="#i-calendar" /></svg>
        </div>
      </div>

      {/* Double Calendar Popup Overlay */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="modal animate-fade-in"
            style={{ width: '720px', maxWidth: '96vw', maxHeight: '92vh', margin: 0, overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-head">
              <div>
                <strong>
                  <svg className="icon"><use href="#i-calendar" /></svg>
                  בחירת טווח תאריכים עברי
                </strong>
                {tempStart && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-3)' }}>
                    טווח נבחר: <strong>{getHebrewLabel(tempStart)}</strong> עד <strong>{tempEnd ? getHebrewLabel(tempEnd) : 'אנא בחר...'}</strong>
                  </p>
                )}
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
              {/* Quick Presets */}
              <div className="pill-tabs" style={{ marginBottom: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', alignSelf: 'center', fontWeight: 'bold', color: 'var(--text-3)' }}>בחירה מהירה:</span>
                <button type="button" onClick={() => applyPreset(7)} className="pill-tab">שבוע (7 ימים)</button>
                <button type="button" onClick={() => applyPreset(14)} className="pill-tab">שבועיים (14 יום)</button>
                <button type="button" onClick={() => applyPreset(30)} className="pill-tab">חודש (30 יום)</button>
                <button type="button" onClick={() => applyPreset(90)} className="pill-tab">3 חודשים</button>
                <button
                  type="button"
                  onClick={() => {
                    const hd = new HDate();
                    setFromPanel({ year: hd.getFullYear(), month: hd.getMonth(), day: hd.getDate() });
                    const hdNext = new HDate().add(30, 'd');
                    setToPanel({ year: hdNext.getFullYear(), month: hdNext.getMonth(), day: hdNext.getDate() });
                  }}
                  className="pill-tab active"
                >
                  חודש נוכחי
                </button>
              </div>

              {/* Panels Container */}
              <div className="two-col" style={{ marginBottom: '4px' }}>
                {renderPanel('from', fromPanel, setFromPanel, '')}
                {renderPanel('to', toPanel, setToPanel, '')}
              </div>
            </div>

            {/* Footer actions */}
            <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={handleClear}
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
