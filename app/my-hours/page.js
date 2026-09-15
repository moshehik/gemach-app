'use client';

import { useState, useEffect, useMemo } from 'react';

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

function formatHoursMinutes(totalMinutes) {
  const minutes = totalMinutes || 0;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// עמוד עצמאי לעובד לראות את שעות העבודה שלו-עצמו (חודש נוכחי וקודמים) - בלי גישה
// לפרטי שכר/עובדים אחרים, ר' /api/me/shifts.
export default function MyHoursPage() {
  const [shifts, setShifts] = useState(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch('/api/me/shifts')
      .then(res => {
        if (res.status === 401) {
          setNotLoggedIn(true);
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.success) setShifts(data.shifts);
      })
      .catch(() => {});
  }, []);

  const filteredShifts = useMemo(() => {
    if (!shifts) return [];
    return shifts.filter(shift => {
      const d = new Date(shift.date);
      return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
    });
  }, [shifts, filterMonth, filterYear]);

  const monthlyTotalMinutes = filteredShifts.reduce((sum, s) => sum + (s.totalMinutes || 0), 0);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const list = new Set([current]);
    (shifts || []).forEach(s => list.add(new Date(s.date).getFullYear()));
    return Array.from(list).sort((a, b) => b - a);
  }, [shifts]);

  if (notLoggedIn) {
    return <div className="empty-state">יש להתחבר כדי לצפות בשעות העבודה שלך.</div>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>שעות העבודה שלי</h1>
          <div className="page-desc">רשימת המשמרות שלך לפי חודש, כולל סה&quot;כ שעות</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select className="select" value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value, 10))}>
            {MONTH_NAMES.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
          </select>
          <select className="select" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value, 10))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div style={{ marginInlineStart: 'auto', fontWeight: 700 }}>
            סה&quot;כ החודש: {formatHoursMinutes(monthlyTotalMinutes)} שעות
          </div>
        </div>
      </div>

      {shifts === null ? (
        <div className="page-loading"><span className="spinner lg" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>כניסה</th>
                <th>יציאה</th>
                <th>סה&quot;כ שעות</th>
              </tr>
            </thead>
            <tbody>
              {filteredShifts.map(shift => (
                <tr key={shift.id}>
                  <td>{shift.hebrewDate || new Date(shift.date).toLocaleDateString('he-IL')}</td>
                  <td>{shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td>{shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td>{shift.totalMinutes ? formatHoursMinutes(shift.totalMinutes) : '-'}</td>
                </tr>
              ))}
              {filteredShifts.length === 0 && (
                <tr><td colSpan={4} className="empty-cell">אין משמרות בחודש זה</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
