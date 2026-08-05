'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HDate, gematriya, Sedra, Locale } from '@hebcal/core';
import { HEBREW_DAYS, getHebrewMonthYear, getHebrewDateString } from '@/lib/hebrewDate';
import { Calendar, Globe, ChevronRight, Home, ChevronLeft, X, Check } from 'lucide-react';

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

  const gridSedra = React.useMemo(() => {
    try {
      if (isOpen && hYear && !isCompactMode) {
        return new Sedra(hYear, true);
      }
    } catch (e) {}
    return null;
  }, [isOpen, hYear, isCompactMode]);

  const safeNativeDate = React.useMemo(() => {
    if (!actualValue) return '';
    const d = new Date(actualValue);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }, [actualValue]);

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
          className={className}
          style={{
            border: "none",
            background: "transparent",
            padding: "4px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "6px",
            transition: "all 0.2s ease"
          }}
        >
          <Calendar size={20} style={{ color: 'var(--primary-color, #a855f7)' }} />
        </button>

        {isOpen && typeof document !== 'undefined' && createPortal(
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setIsOpen(false)}
          >
            <div
              style={{
                width: '320px',
                maxWidth: '92vw',
                background: "var(--card-bg)",
                border: "1px solid var(--border-main)",
                borderRadius: "16px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
                zIndex: 100001,
                direction: "rtl",
                overflow: "hidden",
                animation: "fadeIn 0.15s ease-out"
              }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: "var(--element-bg)", borderBottom: "1px solid var(--border-main)" }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Playfair Display', 'Heebo', serif", fontSize: '1.05rem', color: "var(--text-main)" }}>
                <Calendar size={18} style={{ color: 'var(--primary-color)' }} /> בחירת חודש ושנה
              </h3>
              <button
                data-agy-id="hebrew_date_picker_close_btn"
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', border: 'none', background: 'transparent', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
                title="סגור"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 18px' }}>
            {/* Year Selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '8px' }}>
              <button
                data-agy-id="hebrew_date_picker_prev_year_btn"
                type="button"
                onClick={() => {
                  const newYear = hYear - 1;
                  setHYear(newYear);
                  if (hMonth === 13 && !HDate.isLeapYear(newYear)) setHMonth(12);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', cursor: 'pointer', background: "var(--element-bg)", border: "1px solid var(--border-main)", borderRadius: "8px", color: "var(--text-main)", transition: "all 0.2s" }}
                title="שנה קודמת"
              >
                <ChevronRight size={18} />
              </button>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <select
                  data-agy-id="hebrew_date_picker_year_select"
                  value={hYear}
                  onChange={e => {
                     const newYear = parseInt(e.target.value);
                     setHYear(newYear);
                     if (hMonth === 13 && !HDate.isLeapYear(newYear)) setHMonth(12);
                  }}
                  style={{ padding: '4px 8px', borderRadius: "8px", border: "1px solid var(--border-main)", background: "var(--card-bg)", color: "var(--text-main)", fontWeight: "bold", fontSize: "0.95rem", cursor: "pointer", outline: "none" }}
                >
                  {currentYearOptions.map(y => (
                    <option key={y} value={y}>{gematriya(y)} ({y})</option>
                  ))}
                </select>
              </div>

              <button
                data-agy-id="hebrew_date_picker_next_year_btn"
                type="button"
                onClick={() => {
                  const newYear = hYear + 1;
                  setHYear(newYear);
                  if (hMonth === 13 && !HDate.isLeapYear(newYear)) setHMonth(12);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', cursor: 'pointer', background: "var(--element-bg)", border: "1px solid var(--border-main)", borderRadius: "8px", color: "var(--text-main)", transition: "all 0.2s" }}
                title="שנה הבאה"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                data-agy-id="hebrew_date_picker_today_btn"
                type="button"
                onClick={() => {
                  const hd = new HDate();
                  const curY = hd.getFullYear();
                  const curM = hd.getMonth();
                  setHYear(curY);
                  setHMonth(curM);
                  handleApplyMonthYear(curM, curY);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', cursor: 'pointer', background: "var(--primary-light)", border: "none", borderRadius: "8px", color: "var(--primary-color)", transition: "all 0.2s", fontWeight: 'bold', fontSize: '0.8rem' }}
                title="עבור לחודש הנוכחי"
              >
                <Home size={14} /> החודש
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
                    style={{
                      padding: '10px 4px',
                      borderRadius: '9px',
                      border: isSelected ? 'none' : '1px solid var(--border-main)',
                      background: isSelected ? 'var(--primary-color)' : 'var(--element-bg)',
                      color: isSelected ? '#1e293b' : 'var(--text-main)',
                      fontWeight: isSelected ? 'bold' : '600',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(212,175,55,0.4)' : 'none',
                      textAlign: 'center'
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            </div>

            {/* Action Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 18px', borderTop: '1px solid var(--border-main)', background: "var(--element-bg)" }}>
              <button
                data-agy-id="hebrew_date_picker_cancel_btn"
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 14px', borderRadius: "9px", border: "1px solid var(--border-main)", background: "var(--card-bg)", color: "var(--text-main)", fontWeight: "600", fontSize: '0.85rem', cursor: 'pointer' }}
              >
                <X size={14} /> ביטול
              </button>
              <button
                data-agy-id="hebrew_date_picker_apply_btn"
                type="button"
                onClick={() => handleApplyMonthYear()}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 18px', borderRadius: "9px", fontWeight: "bold", fontSize: '0.85rem', cursor: "pointer", background: "var(--primary-color)", color: "#1e293b", border: "none", boxShadow: "0 2px 8px rgba(212,175,55,0.4)" }}
              >
                <Check size={14} /> אישור
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
      <div className={className} style={{ display: "flex", width: "100%", border: "1px solid var(--element-border)", borderRadius: "8px", background: "var(--card-bg)", transition: "all 0.2s", overflow: "hidden", ...(style || {}) }}
           onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary-color)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(168, 85, 247, 0.2)"; }}
           onBlur={(e) => { e.currentTarget.style.borderColor = "var(--element-border)"; e.currentTarget.style.boxShadow = "none"; }}>
        <button
          data-agy-id="hebrew_date_picker_toggle_btn"
          type="button"
          onClick={toggleOpen}
          style={{
            flex: 1, padding: "0 0.75rem", height: "45px", border: "none", background: "transparent", textAlign: "right", fontSize: "0.95rem", color: "var(--text-main)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center"
          }}
        >
          <span>{displayString}</span>
          <Calendar size={18} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div className="gregorian-calendar-toggle" style={{ position: 'relative', borderRight: "1px solid var(--element-border)", width: "44px", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", transition: "all 0.2s" }}>
          <Globe size={16} style={{ color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input 
             data-agy-id="hebrew_date_picker_native_input"
             type="date"
             value={safeNativeDate}
             onChange={(e) => {
                 if (e.target.value) {
                     onChange(e.target.value);
                     setIsOpen(false);
                 }
             }}
             style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
             title="בחר תאריך לועזי"
          />
        </div>
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setIsOpen(false)}
          >
            <div style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border-main)",
              borderRadius: "16px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              width: "360px",
              maxWidth: "92vw",
              maxHeight: "80vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              direction: "rtl",
              zIndex: 100001,
              animation: "fadeIn 0.15s ease-out"
            }}
            onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: "var(--element-bg)", borderBottom: "1px solid var(--border-main)", flexShrink: 0 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Playfair Display', 'Heebo', serif", fontSize: '1.05rem', color: "var(--text-main)" }}>
                <Calendar size={18} style={{ color: 'var(--primary-color)' }} /> בחירת תאריך
              </h3>
              <button
                data-agy-id="hebrew_date_picker_close_btn"
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', border: 'none', background: 'transparent', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
                title="סגור"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '18px 20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
            <button data-agy-id="hebrew_date_picker_prev_month_btn" type="button" onClick={() => {
                const prev = new HDate(1, hMonth, hYear).subtract(1, 'd');
                setHMonth(prev.getMonth());
                setHYear(prev.getFullYear());
            }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', cursor: 'pointer', background: "var(--element-bg)", border: "none", borderRadius: "999px", color: "var(--text-main)", fontWeight: "600", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}><ChevronRight size={16} /> אחורה</button>
            
            <button data-agy-id="hebrew_date_picker_today_btn" type="button" onClick={() => {
                const hd = new HDate();
                setHYear(hd.getFullYear());
                setHMonth(hd.getMonth());
                setHDay(hd.getDate());
            }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', cursor: 'pointer', background: "var(--primary-light)", border: "none", borderRadius: "999px", color: "var(--primary-color)", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", fontWeight: 'bold' }} title="חזור להיום"><Home size={16} /> היום</button>
            
            <button data-agy-id="hebrew_date_picker_next_month_btn" type="button" onClick={() => {
                const days = HDate.daysInMonth(hMonth, hYear);
                const next = new HDate(1, hMonth, hYear).add(days, 'd');
                setHMonth(next.getMonth());
                setHYear(next.getFullYear());
            }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', cursor: 'pointer', background: "var(--element-bg)", border: "none", borderRadius: "999px", color: "var(--text-main)", fontWeight: "600", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>קדימה <ChevronLeft size={16} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>יום</label>
              <select 
                data-agy-id="hebrew_date_picker_day_select"
                value={hDay} 
                onChange={e => setHDay(parseInt(e.target.value))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: "12px", border: "1px solid var(--border-main)", background: "var(--card-bg)", color: "var(--text-main)", fontWeight: "500", transition: "all 0.2s", outline: "none" }}
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{HEBREW_DAYS[d]}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>חודש</label>
              <select 
                data-agy-id="hebrew_date_picker_month_select"
                value={hMonth} 
                onChange={e => {
                   const newMonth = parseInt(e.target.value);
                   setHMonth(newMonth);
                   if (hDay > HDate.daysInMonth(newMonth, hYear)) {
                      setHDay(HDate.daysInMonth(newMonth, hYear));
                   }
                }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: "12px", border: "1px solid var(--border-main)", background: "var(--card-bg)", color: "var(--text-main)", fontWeight: "500", transition: "all 0.2s", outline: "none" }}
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>שנה</label>
              <select 
                data-agy-id="hebrew_date_picker_year_select"
                value={hYear} 
                onChange={e => {
                   const newYear = parseInt(e.target.value);
                   setHYear(newYear);
                   if (hMonth === 13 && !HDate.isLeapYear(newYear)) {
                      setHMonth(12);
                   }
                }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: "12px", border: "1px solid var(--border-main)", background: "var(--card-bg)", color: "var(--text-main)", fontWeight: "500", transition: "all 0.2s", outline: "none" }}
              >
                {currentYearOptions.map(y => (
                  <option key={y} value={y}>{gematriya(y)}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', 
              marginBottom: '12px', padding: '8px', 
              background: 'var(--element-bg)', 
              borderRadius: '14px', fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-muted)',
              border: '1px solid var(--border-main)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02), 0 2px 6px rgba(0,0,0,0.02)'
            }}>
              <div style={{ background: 'var(--card-bg)', borderRadius: '8px', padding: '4px 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>א'</div>
              <div style={{ background: 'var(--card-bg)', borderRadius: '8px', padding: '4px 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>ב'</div>
              <div style={{ background: 'var(--card-bg)', borderRadius: '8px', padding: '4px 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>ג'</div>
              <div style={{ background: 'var(--card-bg)', borderRadius: '8px', padding: '4px 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>ד'</div>
              <div style={{ background: 'var(--card-bg)', borderRadius: '8px', padding: '4px 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>ה'</div>
              <div style={{ background: 'var(--card-bg)', borderRadius: '8px', padding: '4px 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>ו'</div>
              <div style={{ background: 'var(--primary-light)', borderRadius: '8px', padding: '4px 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', color: 'var(--primary-color)', fontWeight: '800' }}>ש'</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
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
                        try {
                           const hdDay = new HDate(d, hMonth, hYear);
                           if (hdDay.greg().getDay() === 6) {
                               isSaturday = true;
                               if (gridSedra) {
                                  const lookup = gridSedra.lookup(hdDay);
                                  parashaName = lookup && lookup.parsha ? lookup.parsha.map(p => Locale.gettext(p, 'he-x-NoNikud')).join('-') : '';
                               }
                           }
                        } catch(e) {}
                        return (
                        <div 
                          key={d} 
                          onClick={() => { setHDay(d); handleApplyFullDate(d); }}
                          onMouseOver={(e) => { if(d !== hDay) e.currentTarget.style.background = "var(--element-bg)"; }}
                          onMouseOut={(e) => { if(d !== hDay) e.currentTarget.style.background = "transparent"; }}
                          style={{
                            padding: '2px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            borderRadius: "12px", background: d === hDay ? "var(--primary-color)" : "transparent", color: d === hDay ? "#1e293b" : "var(--text-main)", fontWeight: d === hDay ? "bold" : "500", border: d === hDay ? "none" : "1px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", minHeight: "44px", transition: "all 0.2s", boxShadow: d === hDay ? "0 4px 10px rgba(212,175,55,0.4)" : "none"
                          }}
                        >
                          <div>{HEBREW_DAYS[d]}</div>
                          {isSaturday && parashaName && (
                             <div style={{ fontSize: '0.65rem', color: d === hDay ? 'rgba(30,41,59,0.75)' : 'var(--text-muted)', lineHeight: '1.1' }}>
                                {parashaName}
                             </div>
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
          </div>

          </div>

            {/* Action Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '14px 20px', borderTop: '1px solid var(--border-main)', background: "var(--element-bg)", flexShrink: 0 }}>
              <button
                data-agy-id="hebrew_date_picker_cancel_btn"
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1rem', borderRadius: "9px", border: "1px solid var(--border-main)", background: "var(--card-bg)", color: "var(--text-main)", fontWeight: "600", transition: "all 0.2s", cursor: 'pointer' }}
              >
                <X size={16} /> ביטול
              </button>
              <button
                data-agy-id="hebrew_date_picker_apply_btn"
                type="button"
                onClick={() => handleApplyFullDate()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1.5rem', borderRadius: "9px", fontWeight: "bold", cursor: "pointer", background: "var(--primary-color)", color: "#1e293b", border: "none", boxShadow: "0 4px 12px rgba(212,175,55,0.4)", transition: "all 0.2s" }}
              >
                <Check size={16} /> אישור
              </button>
            </div>
          </div>
          </div>,
        document.body
      )}
    </div>
  );
}
