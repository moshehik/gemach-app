'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HDate, gematriya, Sedra, Locale } from '@hebcal/core';
import { HEBREW_DAYS, getHebrewMonthYear, getHebrewDateString, getHebrewMonthName, getHebrewYearString } from '@/lib/hebrewDate';
import { Calendar, Globe, ChevronRight, Home, ChevronLeft, X, Check, ArrowLeft } from 'lucide-react';

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
          let isSelected = false;
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
            
            if (panelType === 'from') {
              isSelected = tempStart === isoDate;
            } else {
              isSelected = tempEnd === isoDate;
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
              onMouseOver={(e) => {
                if (!isBoundary && !isInRange) {
                  e.currentTarget.style.background = "var(--element-bg, #f1f5f9)";
                }
              }}
              onMouseOut={(e) => {
                if (!isBoundary && !isInRange) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
              style={{
                padding: '4px',
                textAlign: 'center',
                cursor: 'pointer',
                borderRadius: "12px",
                background: isBoundary 
                  ? "var(--gradient-primary, linear-gradient(135deg, #a855f7 0%, #7c3aed 100%))" 
                  : (isInRange ? "rgba(168,85,247,0.12)" : "transparent"),
                color: isBoundary 
                  ? "white" 
                  : (isInRange ? "var(--primary-color, #a855f7)" : "var(--text-main, #0f172a)"),
                fontWeight: (isBoundary || isInRange) ? "bold" : "500",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "44px",
                transition: "all 0.15s ease",
                boxShadow: isBoundary ? "0 4px 10px rgba(168,85,247,0.3)" : "none"
              }}
            >
              <div style={{ fontSize: '0.95rem' }}>{HEBREW_DAYS[d]}</div>
              {isSaturday && parashaName && (
                <div style={{ fontSize: '0.62rem', color: isBoundary ? '#f0f0f0' : 'var(--text-muted, #64748b)', lineHeight: '1' }}>
                  {parashaName}
                </div>
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

    const handlePrevMonth = () => {
      const days = HDate.daysInMonth(month, year);
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
      <div style={{ flex: 1, minWidth: '290px', padding: '10px' }}>
        {title && (
          <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: 'var(--primary-color, #a855f7)', fontWeight: 'bold' }}>
            {title}
          </h4>
        )}
        
        {/* Navigation Month/Year */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center', gap: '4px' }}>
          <button 
            type="button" 
            onClick={handleNextMonth} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', cursor: 'pointer', background: "var(--element-bg, #f1f5f9)", border: "1px solid var(--border-main, #e2e8f0)", borderRadius: "8px", color: "var(--text-main, #0f172a)", transition: "all 0.2s" }}
            title="חודש הבא"
          >
            <ChevronRight size={18} />
          </button>

          <div style={{ display: 'flex', gap: '4px' }}>
            <select
              value={month}
              onChange={e => {
                const newMonth = parseInt(e.target.value);
                setCurrentPanel(p => ({ ...p, month: newMonth }));
              }}
              style={{ padding: '4px 6px', borderRadius: "8px", border: "1px solid var(--border-main, #e2e8f0)", background: "var(--card-bg, #ffffff)", color: "var(--text-main, #0f172a)", fontWeight: "bold", fontSize: "0.85rem", cursor: "pointer", outline: "none" }}
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
              style={{ padding: '4px 6px', borderRadius: "8px", border: "1px solid var(--border-main, #e2e8f0)", background: "var(--card-bg, #ffffff)", color: "var(--text-main, #0f172a)", fontWeight: "bold", fontSize: "0.85rem", cursor: "pointer", outline: "none" }}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{gematriya(y)} ({y})</option>
              ))}
            </select>
          </div>

          <button 
            type="button" 
            onClick={handlePrevMonth} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', cursor: 'pointer', background: "var(--element-bg, #f1f5f9)", border: "1px solid var(--border-main, #e2e8f0)", borderRadius: "8px", color: "var(--text-main, #0f172a)", transition: "all 0.2s" }}
            title="חודש קודם"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Days Header */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', 
          marginBottom: '8px', padding: '6px', 
          background: 'var(--element-bg, #f1f5f9)', 
          borderRadius: '10px', fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)',
          border: '1px solid var(--border-main, #e2e8f0)'
        }}>
          <div>א'</div>
          <div>ב'</div>
          <div>ג'</div>
          <div>ד'</div>
          <div>ה'</div>
          <div>ו'</div>
          <div style={{ color: 'var(--primary-color, #a855f7)' }}>ש'</div>
        </div>

        {/* Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
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
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          border: '1px solid var(--element-border, #cbd5e1)', 
          borderRadius: '8px', 
          background: 'var(--card-bg, #ffffff)', 
          overflow: 'hidden', 
          height: '45px', 
          width: '100%', 
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 2px rgba(168, 85, 247, 0.2)' : 'none',
          borderColor: isOpen ? 'var(--primary-color, #a855f7)' : 'var(--element-border, #cbd5e1)',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ flex: 1, padding: '0 10px', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>מתאריך:</span>
          <span style={{ fontSize: '0.88rem', color: tempStart ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {fromLabel}
          </span>
        </div>
        
        <div style={{ padding: '0 4px', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={14} />
        </div>

        <div style={{ flex: 1, padding: '0 10px', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', borderRight: '1px solid var(--element-border, #cbd5e1)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>עד תאריך:</span>
          <span style={{ fontSize: '0.88rem', color: tempEnd ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {toLabel}
          </span>
        </div>

        <div style={{ width: '44px', height: '100%', borderRight: '1px solid var(--element-border, #cbd5e1)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <Calendar size={18} style={{ color: 'var(--text-muted, #64748b)' }} />
        </div>
      </div>

      {/* Double Calendar Popup Overlay */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setIsOpen(false)}
        >
          <div 
            style={{
              width: '680px',
              maxWidth: '96vw',
              maxHeight: '92vh',
              background: "var(--card-bg, #ffffff)", 
              border: "1px solid var(--border-main, #e2e8f0)", 
              borderRadius: "20px", 
              padding: "20px", 
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", 
              zIndex: 100001,
              direction: "rtl", 
              display: 'flex',
              flexDirection: 'column',
              animation: "fadeIn 0.15s ease-out",
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-main, #e2e8f0)', paddingBottom: '12px', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main, #0f172a)', fontWeight: '800', fontSize: '1.2rem' }}>בחירת טווח תאריכים עברי</h3>
                {tempStart && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
                    טווח נבחר: <strong>{getHebrewLabel(tempStart)}</strong> עד <strong>{tempEnd ? getHebrewLabel(tempEnd) : 'אנא בחר...'}</strong>
                  </p>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => setIsOpen(false)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border-main, #e2e8f0)' }}>
              <span style={{ fontSize: '0.85rem', alignSelf: 'center', fontWeight: 'bold', color: 'var(--text-muted, #64748b)' }}>בחירה מהירה:</span>
              <button type="button" onClick={() => applyPreset(7)} style={{ padding: '6px 12px', background: 'var(--element-bg, #f1f5f9)', border: 'none', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text-main, #0f172a)' }}>שבוע (7 ימים)</button>
              <button type="button" onClick={() => applyPreset(14)} style={{ padding: '6px 12px', background: 'var(--element-bg, #f1f5f9)', border: 'none', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text-main, #0f172a)' }}>שבועיים (14 יום)</button>
              <button type="button" onClick={() => applyPreset(30)} style={{ padding: '6px 12px', background: 'var(--element-bg, #f1f5f9)', border: 'none', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text-main, #0f172a)' }}>חודש (30 יום)</button>
              <button type="button" onClick={() => applyPreset(90)} style={{ padding: '6px 12px', background: 'var(--element-bg, #f1f5f9)', border: 'none', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text-main, #0f172a)' }}>3 חודשים</button>
              <button 
                type="button" 
                onClick={() => {
                  const hd = new HDate();
                  setFromPanel({ year: hd.getFullYear(), month: hd.getMonth(), day: hd.getDate() });
                  const hdNext = new HDate().add(30, 'd');
                  setToPanel({ year: hdNext.getFullYear(), month: hdNext.getMonth(), day: hdNext.getDate() });
                }} 
                style={{ padding: '6px 12px', background: 'var(--primary-light, #f3e8ff)', border: 'none', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer', color: 'var(--primary-color, #a855f7)' }}
              >
                חודש נוכחי
              </button>
            </div>

            {/* Panels Container */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'row', 
              flexWrap: 'wrap', 
              gap: '12px',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              {renderPanel('from', fromPanel, setFromPanel, '')}
              
              {/* Divider in desktop */}
              <div style={{ width: '1px', background: 'var(--border-main, #e2e8f0)', alignSelf: 'stretch' }} className="calendar-divider-y" />
              
              {renderPanel('to', toPanel, setToPanel, '')}
            </div>

            {/* Footer actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-main, #e2e8f0)', paddingTop: '14px', marginTop: 'auto', gap: '8px' }}>
              <button 
                type="button" 
                onClick={handleClear} 
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--element-bg, #f1f5f9)', color: 'var(--text-main, #0f172a)', fontWeight: 'bold', fontSize: '0.88rem', cursor: 'pointer' }}
              >
                נקה בחירה
              </button>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)} 
                  style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--card-bg, #ffffff)', color: 'var(--text-main, #0f172a)', fontWeight: 'bold', fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  ביטול
                </button>
                <button 
                  type="button" 
                  onClick={handleApply}
                  disabled={!tempStart || !tempEnd}
                  style={{ 
                    padding: '8px 24px', 
                    borderRadius: '8px', 
                    fontWeight: 'bold', 
                    fontSize: '0.88rem', 
                    cursor: (!tempStart || !tempEnd) ? 'not-allowed' : 'pointer', 
                    background: (!tempStart || !tempEnd) ? '#cbd5e1' : 'var(--gradient-primary, linear-gradient(135deg, #a855f7 0%, #7c3aed 100%))', 
                    color: 'white', 
                    border: 'none', 
                    boxShadow: (!tempStart || !tempEnd) ? 'none' : '0 4px 12px rgba(168,85,247,0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  <Check size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '4px' }} />
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
