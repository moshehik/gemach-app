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

export default function HebrewDatePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hYear, setHYear] = useState('');
  const [hMonth, setHMonth] = useState('');
  const [hDay, setHDay] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    try {
      const date = value ? new Date(value) : new Date();
      if (!isNaN(date.getTime())) {
        const hd = new HDate(date);
        setHYear(hd.getFullYear());
        setHMonth(hd.getMonth());
        setHDay(hd.getDate());
      }
    } catch (e) {
      console.error(e);
    }
  }, [value, isOpen]);

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
    if (!value) return 'בחר תאריך...';
    let dStr = getHebrewDateString(value);
    
    try {
      const d = new Date(value);
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
  }, [value]);

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
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }, [value]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', width: '100%', border: '1px solid #ccc', borderRadius: '8px', background: 'white' }}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            flex: 1,
            padding: '0.75rem',
            border: 'none',
            background: 'transparent',
            textAlign: 'right',
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{displayString}</span>
          <Calendar size={18} />
        </button>
        <div style={{ position: 'relative', borderRight: '1px solid #eee', width: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }}>
          <Globe size={18} style={{ color: '#555', pointerEvents: 'none' }} />
          <input 
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

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          width: '320px',
          direction: 'rtl'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <button type="button" onClick={() => {
                const prev = new HDate(1, hMonth, hYear).subtract(1, 'd');
                setHMonth(prev.getMonth());
                setHYear(prev.getFullYear());
            }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', cursor: 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '6px' }}><ChevronRight size={16} /> אחורה</button>
            
            <button type="button" onClick={() => {
                const hd = new HDate();
                setHYear(hd.getFullYear());
                setHMonth(hd.getMonth());
                setHDay(hd.getDate());
            }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', cursor: 'pointer', background: '#e6f2ff', border: '1px solid #b3d9ff', borderRadius: '6px', fontWeight: 'bold' }} title="חזור להיום"><Home size={16} /> היום</button>
            
            <button type="button" onClick={() => {
                const days = HDate.daysInMonth(hMonth, hYear);
                const next = new HDate(1, hMonth, hYear).add(days, 'd');
                setHMonth(next.getMonth());
                setHYear(next.getFullYear());
            }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', cursor: 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '6px' }}>קדימה <ChevronLeft size={16} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#555' }}>יום</label>
              <select 
                value={hDay} 
                onChange={e => setHDay(parseInt(e.target.value))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', background: '#fff' }}
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{HEBREW_DAYS[d]}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#555' }}>חודש</label>
              <select 
                value={hMonth} 
                onChange={e => {
                   const newMonth = parseInt(e.target.value);
                   setHMonth(newMonth);
                   if (hDay > HDate.daysInMonth(newMonth, hYear)) {
                      setHDay(HDate.daysInMonth(newMonth, hYear));
                   }
                }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', background: '#fff' }}
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#555' }}>שנה</label>
              <select 
                value={hYear} 
                onChange={e => {
                   const newYear = parseInt(e.target.value);
                   setHYear(newYear);
                   if (hMonth === 13 && !HDate.isLeapYear(newYear)) {
                      setHMonth(12); // Fallback to Adar if changing to non-leap year
                   }
                }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', background: '#fff' }}
              >
                {currentYearOptions.map(y => (
                  <option key={y} value={y}>{gematriya(y)}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.9rem', color: '#555' }}>
              <div>א'</div><div>ב'</div><div>ג'</div><div>ד'</div><div>ה'</div><div>ו'</div><div>ש'</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
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
                          onClick={() => setHDay(d)}
                          onDoubleClick={() => handleApply(d)}
                          style={{
                            padding: '4px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            background: d === hDay ? 'var(--primary-color)' : '#f9f9f9',
                            color: d === hDay ? 'white' : 'inherit',
                            fontWeight: d === hDay ? 'bold' : 'normal',
                            border: '1px solid #eee',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            minHeight: '40px'
                          }}
                        >
                          <div>{HEBREW_DAYS[d]}</div>
                          {isSaturday && parashaName && (
                             <div style={{ fontSize: '0.65rem', color: d === hDay ? '#f0f0f0' : '#888', lineHeight: '1.1' }}>
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
              type="button" 
              onClick={() => setIsOpen(false)}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #ccc', background: 'transparent', cursor: 'pointer' }}
            >
              <X size={16} /> ביטול
            </button>
            <button 
              type="button" 
              onClick={() => handleApply()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1.5rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', background: 'var(--primary-color)', color: 'white', border: 'none' }}
            >
              <Check size={16} /> אישור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
