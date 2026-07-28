'use client';

import React, { useState, useEffect } from 'react';
import { HDate, gematriya } from '@hebcal/core';

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

export default function HebrewMonthYearPicker({ value, onChange, className, style }) {
  // value can be an object { month, year } or null
  const [hYear, setHYear] = useState('');
  const [hMonth, setHMonth] = useState('');

  useEffect(() => {
    if (value && value.year && value.month) {
      setHYear(value.year);
      setHMonth(value.month);
    } else if (!hYear || !hMonth) {
      const hd = new HDate();
      setHYear(hd.getFullYear());
      setHMonth(hd.getMonth());
    }
  }, [value]);

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    setHYear(newYear);
    
    // If current month is Adar II and new year is not leap, fallback to Adar
    let newMonth = hMonth;
    if (hMonth === 13 && !HDate.isLeapYear(newYear)) {
      newMonth = 12;
      setHMonth(12);
    }
    if (onChange) onChange({ month: newMonth, year: newYear });
  };

  const handleMonthChange = (e) => {
    const newMonth = parseInt(e.target.value);
    setHMonth(newMonth);
    if (onChange) onChange({ month: newMonth, year: hYear });
  };

  const currentYearOptions = [];
  const startYear = new HDate().getFullYear() - 10;
  for (let i = 0; i < 20; i++) {
    currentYearOptions.push(startYear + i);
  }

  const months = hYear ? getMonthsForYear(hYear) : [];

  return (
    <div className={`hebrew-month-year-picker ${className || ''}`} style={{ display: 'flex', gap: '0.5rem', ...style }}>
      <select 
        value={hMonth} 
        onChange={handleMonthChange}
        style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--card-bg)', outline: 'none' }}
      >
        {months.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      <select 
        value={hYear} 
        onChange={handleYearChange}
        style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--card-bg)', outline: 'none' }}
      >
        {currentYearOptions.map(y => (
          <option key={y} value={y}>{gematriya(y)}</option>
        ))}
      </select>
    </div>
  );
}
