'use client';

import React, { useState, useEffect, useRef } from 'react';
import { HDate, gematriya, Sedra, Locale } from '@hebcal/core';
import { HEBREW_DAYS, getHebrewDateString } from '@/lib/hebrewDate';
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

export default function HebrewDatePicker({ value, selectedDate, onChange, className, style }) {
  const actualValue = value || selectedDate;
  const [isOpen, setIsOpen] = useState(false);
  const [hYear, setHYear] = useState('');
  const [hMonth, setHMonth] = useState('');
  const [hDay, setHDay] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    try {
      const date = actualValue ? new Date(actualValue) : new Date();
      if (!isNaN(date.getTime())) {
        const hd = new HDate(date);
        setHYear(hd.getFullYear());
        setHMonth(hd.getMonth());
        setHDay(hd.getDate());
      }
    } catch (e) {
      console.error(e);
    }
  }, [actualValue, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApply = (dayToApply) => {
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

  const displayString = React.useMemo(() => {
    if (!actualValue) return 'בחר תאריך...';
    let dStr = getHebrewDateString(value);
    
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
    } catch(e) {}

    return dStr || 'בחר תאריך...';
  }, [actualValue]);

  const currentYearOptions = [];
  const startYear = new HDate().getFullYear() - 50;
  for (let i = 0; i < 100; i++) {
    currentYearOptions.push(startYear + i);
  }

  const months = hYear ? getMonthsForYear(hYear) : [];
  const daysInMonth = (hYear && hMonth) ? HDate.daysInMonth(hMonth, hYear) : 30;

  const gridSedra = React.useMemo(() => {
    try {
      if (isOpen && hYear) {
         return new Sedra(hYear, true);
      }
    } catch(e) {}
    return null;
  }, [isOpen, hYear]);

  // Safe parsed date for native input
  const safeNativeDate = React.useMemo(() => {
    if (!actualValue) return '';
    const d = new Date(actualValue);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }, [actualValue]);

  return (
    <div data-agy-id="hebrew_date_picker_container" ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 99999 : 1 }}>
      <div className={className} style={{ display: "flex", width: "100%", border: "1px solid var(--element-border)", borderRadius: "8px", background: "var(--card-bg)", transition: "all 0.2s", overflow: "hidden", ...(style || {}) }}
           onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary-color)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(168, 85, 247, 0.2)"; }}
           onBlur={(e) => { e.currentTarget.style.borderColor = "var(--element-border)"; e.currentTarget.style.boxShadow = "none"; }}>
        <button
          data-agy-id="hebrew_date_picker_toggle_btn"          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
          }}
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
             data-agy-id="hebrew_date_picker_native_input"             type="date"
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

      {isOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            animation: 'fadeIn 0.2s ease-out'
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div style={{
            background: "var(--card-bg)", 
            border: "1px solid var(--border-main)", 
            borderRadius: "24px", 
            padding: "24px", 
            boxShadow: "0 24px 48px rgba(0,0,0,0.2)", 
            width: "360px",
            maxWidth: "92vw",
            maxHeight: "90vh",
            overflowY: "auto",
            direction: "rtl", 
            animation: "fadeIn 0.2s ease-out"
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
            <button data-agy-id="hebrew_date_picker_next_month_btn" type="button" onClick={() => {
                const days = HDate.daysInMonth(hMonth, hYear);
                const next = new HDate(1, hMonth, hYear).add(days, 'd');
                setHMonth(next.getMonth());
                setHYear(next.getFullYear());
            }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', cursor: 'pointer', background: "var(--element-bg)", border: "none", borderRadius: "999px", color: "var(--text-main)", fontWeight: "600", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}><ChevronRight size={16} /> קדימה</button>
            
            <button data-agy-id="hebrew_date_picker_today_btn" type="button" onClick={() => {
                const hd = new HDate();
                setHYear(hd.getFullYear());
                setHMonth(hd.getMonth());
                setHDay(hd.getDate());
            }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', cursor: 'pointer', background: "var(--primary-light)", border: "none", borderRadius: "999px", color: "var(--primary-color)", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", fontWeight: 'bold' }} title="חזור להיום"><Home size={16} /> היום</button>
            
            <button data-agy-id="hebrew_date_picker_prev_month_btn" type="button" onClick={() => {
                const prev = new HDate(1, hMonth, hYear).subtract(1, 'd');
                setHMonth(prev.getMonth());
                setHYear(prev.getFullYear());
            }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', cursor: 'pointer', background: "var(--element-bg)", border: "none", borderRadius: "999px", color: "var(--text-main)", fontWeight: "600", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>אחורה <ChevronLeft size={16} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>יום</label>
              <select 
                data-agy-id="hebrew_date_picker_day_select"                value={hDay} 
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
                data-agy-id="hebrew_date_picker_month_select"                value={hMonth} 
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
                data-agy-id="hebrew_date_picker_year_select"                value={hYear} 
                onChange={e => {
                   const newYear = parseInt(e.target.value);
                   setHYear(newYear);
                   if (hMonth === 13 && !HDate.isLeapYear(newYear)) {
                      setHMonth(12); // Fallback to Adar if changing to non-leap year
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
                          onClick={() => { setHDay(d); handleApply(d); }}
                          onMouseOver={(e) => { if(d !== hDay) e.currentTarget.style.background = "var(--element-bg)"; }}
                          onMouseOut={(e) => { if(d !== hDay) e.currentTarget.style.background = "transparent"; }}
                          style={{
                            padding: '2px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            borderRadius: "12px", background: d === hDay ? "var(--gradient-primary)" : "transparent", color: d === hDay ? "white" : "var(--text-main)", fontWeight: d === hDay ? "bold" : "500", border: d === hDay ? "none" : "1px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", minHeight: "44px", transition: "all 0.2s", boxShadow: d === hDay ? "0 4px 10px rgba(168,85,247,0.3)" : "none"
                          }}
                        >
                          <div>{HEBREW_DAYS[d]}</div>
                          {isSaturday && parashaName && (
                             <div style={{ fontSize: '0.65rem', color: d === hDay ? '#f0f0f0' : 'var(--text-muted)', lineHeight: '1.1' }}>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button 
              data-agy-id="hebrew_date_picker_cancel_btn"              type="button" 
              onClick={() => setIsOpen(false)}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1rem', borderRadius: "999px", border: "1px solid var(--border-main)", background: "var(--element-bg)", color: "var(--text-main)", fontWeight: "600", transition: "all 0.2s", cursor: 'pointer' }}
            >
              <X size={16} /> ביטול
            </button>
            <button 
              data-agy-id="hebrew_date_picker_apply_btn"              type="button" 
              onClick={() => handleApply()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1.5rem', borderRadius: "999px", fontWeight: "bold", cursor: "pointer", background: "var(--gradient-primary)", color: "white", border: "none", boxShadow: "0 4px 12px rgba(168,85,247,0.3)", transition: "all 0.2s" }}
            >
              <Check size={16} /> אישור
            </button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
