'use client';

import React from 'react';
import { HDate, HebrewCalendar } from '@hebcal/core';
import { HEBREW_DAYS, getHebrewYearString, getHebrewMonthName } from '@/lib/hebrewDate';

export function CapacityCalendar({ fromDate, toDate, occupiedOrders }) {
  // Generate calendar months between fromDate and toDate
  const start = new HDate(new Date(fromDate));
  const end = new HDate(new Date(toDate));

  // We'll just display the month of fromDate for simplicity, or all months in range.
  // Let's generate a list of months to show
  const months = [];
  let curr = new HDate(1, start.getMonth(), start.getFullYear());
  while (curr.abs() <= end.abs() || (curr.getMonth() === end.getMonth() && curr.getFullYear() === end.getFullYear())) {
    months.push(new HDate(1, curr.getMonth(), curr.getFullYear()));
    if (curr.getMonth() === 13) {
      curr = new HDate(1, 1, curr.getFullYear() + 1); // Not quite right for Hebcal leap logic, but Hebcal has a better way
    } else {
      // Better way to add one month in Hebcal:
    }
    // Safer month iteration:
    const gregStart = curr.greg();
    gregStart.setDate(gregStart.getDate() + 30);
    curr = new HDate(gregStart);
    curr = new HDate(1, curr.getMonth(), curr.getFullYear());
  }

  // Deduplicate months
  const uniqueMonths = [];
  months.forEach(m => {
    if (!uniqueMonths.find(x => x.getMonth() === m.getMonth() && x.getFullYear() === m.getFullYear())) {
      uniqueMonths.push(m);
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {uniqueMonths.map((month, idx) => (
        <HebrewMonth
          key={idx}
          month={month}
          occupiedOrders={occupiedOrders}
          fromDate={new Date(fromDate)}
          toDate={new Date(toDate)}
        />
      ))}
    </div>
  );
}

function HebrewMonth({ month, occupiedOrders, fromDate, toDate }) {
  const hMonthNum = month.getMonth();
  const hYear = month.getFullYear();
  const isLeap = month.isLeapYear();
  const hMonthName = getHebrewMonthName(hMonthNum, isLeap);
  const hYearString = getHebrewYearString(hYear);
  const daysInMonth = HDate.daysInMonth(hMonthNum, hYear);

  // Get all events for this Hebrew year, including sedrot (parashot)
  const allEvents = React.useMemo(() => {
    try {
      return HebrewCalendar.calendar({
        year: hYear,
        isHebrewYear: true,
        il: true,
        sedrot: true
      });
    } catch (e) {
      return [];
    }
  }, [hYear]);

  // Create grid
  const days = [];
  // Find day of week of 1st day (0 = Sun, 6 = Sat)
  const firstDay = month.greg().getDay();

  // padding
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const hd = new HDate(i, month.getMonth(), hYear);
    days.push(hd);
  }

  const isDayOccupied = (hd) => {
    const greg = hd.greg();
    // Reset time for fair comparison
    greg.setHours(0,0,0,0);

    // Calculate total quantity for this day
    let total = 0;
    occupiedOrders.forEach(order => {
      const start = new Date(order.eventDate);
      start.setHours(0,0,0,0);
      const end = order.returnDate ? new Date(order.returnDate) : new Date(order.eventDate);
      end.setHours(0,0,0,0);

      if (greg >= start && greg <= end) {
        total += order.quantity;
      }
    });
    return total;
  };

  const isDayInRange = (hd) => {
    const greg = hd.greg();
    greg.setHours(0,0,0,0);
    const s = new Date(fromDate); s.setHours(0,0,0,0);
    const e = new Date(toDate); e.setHours(0,0,0,0);
    return greg >= s && greg <= e;
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ backgroundColor: '#f8fafc', padding: '1rem', textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0' }}>
        {hMonthName} {hYearString}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: '#e2e8f0' }}>
        {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(d => (
          <div key={d} style={{ padding: '0.5rem', textAlign: 'center', backgroundColor: 'var(--card-bg)', fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b' }}>
            {d}
          </div>
        ))}
        {days.map((hd, i) => {
          if (!hd) return <div key={`empty-${i}`} style={{ backgroundColor: '#f8fafc' }} />;

          const inRange = isDayInRange(hd);
          const occQty = isDayOccupied(hd);
          const gregDay = hd.greg().getDate();
          const hebrewDay = HEBREW_DAYS[hd.getDate()];

          let holidays = [];
          try {
            const dayEvents = allEvents.filter(e => e.getDate().abs() === hd.abs());
            holidays = dayEvents.filter(e => {
              const flags = e.getFlags();
              if (flags & 8192) return false;
              return (flags & 1) || (flags & 524288) || (flags & 2097152) || (flags & 16384) || (flags & 256) || (flags & 1024);
            }).map(e => e.render('he'));
          } catch (e) {}

          return (
            <div key={i} style={{
              backgroundColor: inRange ? (occQty > 0 ? '#fee2e2' : '#f0fdf4') : 'var(--card-bg)',
              padding: '0.5rem',
              minHeight: '80px',
              display: 'flex',
              flexDirection: 'column',
              opacity: inRange ? 1 : 0.5,
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' }}>{hebrewDay}</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{gregDay}</span>
              </div>
              {holidays.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#0369a1', marginTop: '2px', lineHeight: '1.1' }}>
                  {holidays.join(', ')}
                </div>
              )}
              {occQty > 0 && (
                <div style={{ marginTop: 'auto', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>
                  {occQty} תפוס
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
