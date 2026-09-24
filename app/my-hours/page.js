'use client';

import { useState, useEffect, useMemo } from 'react';
import { V3Page, Card, Field, Row, Tip, Empty, Table } from '@/app/v3/ui/components';

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
    return (
      <V3Page>
        <Empty icon="lock" title="צריך להתחבר" text="כדי לראות את המשמרות שלך, היכנסו למערכת." />
      </V3Page>
    );
  }

  const columns = [
    { key: 'date', header: 'תאריך', render: (shift) => <bdi>{shift.hebrewDate || new Date(shift.date).toLocaleDateString('he-IL')}</bdi> },
    { key: 'entry', header: 'כניסה', render: (shift) => <bdi>{shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</bdi> },
    { key: 'exit', header: 'יציאה', render: (shift) => <bdi>{shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</bdi> },
    { key: 'total', header: 'שעות', num: true, render: (shift) => <bdi>{shift.totalMinutes ? formatHoursMinutes(shift.totalMinutes) : '-'}</bdi> },
  ];

  return (
    <V3Page>
      <div className="v3-stack">
        <div className="v3-pagehead">
          <div className="v3-pagehead__title">
            <h1 className="v3-h1">השעות שלי</h1>
            <Tip>המשמרות שלך בלבד, לפי חודש, עם סיכום שעות חודשי.</Tip>
          </div>
        </div>

        <Card icon="calendar" title="בחירת חודש">
          <div className="v3-stack">
            <Field as="select" label="חודש" value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value, 10))}>
              {MONTH_NAMES.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
            </Field>
            <Field as="select" label="שנה" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value, 10))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </Field>
            <Row icon="clock" label="סך השעות בחודש">
              <span className="v3-big"><bdi>{formatHoursMinutes(monthlyTotalMinutes)}</bdi></span>
            </Row>
          </div>
        </Card>

        {shifts === null ? (
          <div className="v3-empty" role="status"><span className="v3-spin" aria-hidden="true" /><span className="v3-sr">טוען</span></div>
        ) : filteredShifts.length === 0 ? (
          <Empty icon="calendar" title="אין משמרות בחודש הזה" />
        ) : (
          <Card>
            <Table columns={columns} rows={filteredShifts} rowKey="id" caption="משמרות החודש" />
          </Card>
        )}
      </div>
    </V3Page>
  );
}
