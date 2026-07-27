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
  const [popupPos, setPopupPos] = useState({ vertical: 'bottom', horizontal: 'right' });
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
      <div className={className} style={{ display: "flex", width: "100%", border: "2px solid transparent", borderRadius: "16px", background: "var(--card-bg)", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", transition: "all 0.3s", overflow: "hidden", ...(style || {}) }}
           onFocus={(e) => { e.currentTarget.style.borderColor = "#a855f7"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(168, 85, 247, 0.15)"; }}
           onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.05)"; }}>
        <button
          data-agy-id="hebrew_date_picker_toggle_btn"          type="button"
          onClick={() => {
            if (!isOpen && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const spaceAbove = rect.top;
              const vertical = (spaceBelow < 430 && spaceAbove > spaceBelow) ? 'top' : 'bottom';
              
              // In RTL, right:0 extends to the left, so we need space on the left side of the right edge
              const horizontal = (rect.right < 360 && (window.innerWidth - rect.left) >= 360) ? 'left' : 'right';
              
              setPopupPos({ vertical, horizontal });
            }
            setIsOpen(!isOpen);
          }}
          style={{
            flex: 1, padding: "16px 20px", border: "none", background: "transparent", textAlign: "right", fontSize: "1.1rem", fontWeight: "600", color: "var(--text-main)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s"
          }}
        >
          <span>{displayString}</span>
          <Calendar size={18} />
        </button>
        <div className="gregorian-calendar-toggle" style={{ position: 'relative', borderRight: "1px solid var(--border-main)", width: "60px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--element-bg)", borderTopLeftRadius: "16px", borderBottomLeftRadius: "16px", transition: "all 0.2s" }}>
          <Globe size={18} style={{ color: 'var(--text-muted)', pointerEvents: 'none' }} />
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
        <div style={{
          position: 'absolute',
          ...(popupPos.vertical === 'top' ? { bottom: '100%', marginBottom: '0.5rem' } : { top: '100%', marginTop: '0.5rem' }),
          ...(popupPos.horizontal === 'left' ? { left: 0 } : { right: 0 }),
          background: "var(--card-bg)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid var(--border-main)", borderRadius: "24px", padding: "20px", boxShadow: "0 20px 40px rgba(0,0,0,0.12)", zIndex: 99999, width: "360px", direction: "rtl", animation: "fadeIn 0.2s ease-out"
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-main)', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <div>א'</div><div>ב'</div><div>ג'</div><div>ד'</div><div>ה'</div><div>ו'</div><div>ש'</div>
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
      )}
    </div>
  );
}
