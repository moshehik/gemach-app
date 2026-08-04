'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Users, CalendarClock, X, Search } from 'lucide-react';
import HebrewDatePicker from '../../HebrewDatePicker';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { ChangesChips, ACTION_TONES } from '../../modern/ChangesChips';
import { verifyPin } from './mocAuth';

/**
 * טאב "מידע" בעיצוב המודרני — כרטיס "בוצעה על ידי" (עם תאריך עברי ועריכת
 * תאריך ביצוע בהרשאת מתכנת) + היסטוריית שינויים כללית בעיצוב מודרני עם סינון.
 */
export default function ModernInfoTab({ order, createdDate, onShowEmployees, onOrderDateSave }) {
  const [isEditingOrderDate, setIsEditingOrderDate] = useState(false);

  // היסטוריה כללית
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams();
        query.append('entityType', 'Order');
        if (order?.orderId) query.append('entityId', order.orderId);
        if (filterSearch) query.append('search', filterSearch);

        const res = await fetch(`/api/audit?${query.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();
        if (!cancelled) setLogs(data.logs || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLogs();
    return () => { cancelled = true; };
  }, [order?.orderId, filterSearch]);

  // עריכת תאריך ההזמנה משפיעה על חישובי זיכוי בביטול — מוגבלת למתכנת בלבד
  const requestOrderDateEdit = async () => {
    const ok = await verifyPin('עריכת תאריך ביצוע ההזמנה משפיעה על חישובי זיכוי בביטול ומוגבלת למתכנת. אנא בחר משתמש והזן סיסמה:', 'מתכנת');
    if (!ok) return;
    setIsEditingOrderDate(true);
  };

  const handleOrderDateChange = (date) => {
    setIsEditingOrderDate(false);
    onOrderDateSave(date);
  };

  const performedByName = order.employee
    ? `${order.employee.firstName || ''} ${order.employee.lastName || ''}`.trim()
    : 'לא ידוע';

  const dateLabel = createdDate
    ? `${new Date(createdDate).toLocaleDateString('he-IL')} (${getHebrewDateString(createdDate)}) · ${new Date(createdDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : 'לא ידוע';

  return (
    <>
      {/* בוצעה על ידי */}
      <div className="moc-card-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="moc-avatar-chip lg"><Calendar size={20} /></div>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <span className="moc-field-label" style={{ marginBottom: '3px' }}>בוצעה על ידי</span>
          <div className="moc-field-value" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span>{performedByName} · {dateLabel}</span>
            {isEditingOrderDate ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: '200px' }}>
                <HebrewDatePicker value={order.orderDate} onChange={handleOrderDateChange} />
                <button className="moc-icon-btn-plain" title="ביטול עריכה" onClick={() => setIsEditingOrderDate(false)}>
                  <X size={15} />
                </button>
              </span>
            ) : (
              <button
                className="moc-icon-btn-plain"
                title="שינוי תאריך ביצוע ההזמנה — לצורך בדיקות (מתכנת בלבד)"
                onClick={requestOrderDateEdit}
              >
                <CalendarClock size={17} />
              </button>
            )}
          </div>
        </div>
        <button
          className="moc-btn moc-btn-outline moc-btn-icon"
          style={{ width: '40px', height: '40px' }}
          title="עובדים פעילים בהזמנה"
          onClick={onShowEmployees}
        >
          <Users size={19} />
        </button>
      </div>

      {/* היסטוריית שינויים כללית */}
      <div className="moc-section-block">
        <div className="moc-table-toolbar">
          <h3>היסטוריית שינויים</h3>
          <span className="moc-hint">{logs.length} תיעודי פעולות</span>
        </div>

        {/* חיפוש פשוט */}
        <form onSubmit={(e) => { e.preventDefault(); setFilterSearch(searchInput); }} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="חיפוש בהיסטוריה..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ paddingLeft: '32px' }}
            />
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--moc-text-muted)' }} />
          </div>
          <button type="submit" className="moc-btn moc-btn-gold moc-btn-sm">חפש</button>
          {filterSearch && (
            <button type="button" className="moc-btn moc-btn-outline moc-btn-sm" onClick={() => { setFilterSearch(''); setSearchInput(''); }}>
              <X size={13} /> נקה
            </button>
          )}
        </form>

        <div className="moc-card-panel">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <span className="moc-spinner lg" style={{ margin: '0 auto' }} />
              <p className="moc-hint" style={{ marginTop: '12px' }}>טוען היסטוריית שינויים...</p>
            </div>
          ) : error ? (
            <div style={{ color: 'var(--moc-danger-text)', textAlign: 'center', padding: '20px 0', fontWeight: 700 }}>
              שגיאה בטעינת היסטוריה: {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="moc-empty-state">לא נמצאו תיעודי היסטוריה או שינויים</div>
          ) : (
            logs.map((log) => {
              const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
              const tone = ACTION_TONES[log.action] || ACTION_TONES.UPDATE;
              const d = new Date(log.createdAt);
              return (
                <div key={log.id} className="moc-history-item">
                  <div className="moc-history-dot" style={{ background: tone.color }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span className="moc-action-tag" style={{ background: tone.bg, color: tone.color }}>{actionLabel}</span>
                    <strong style={{ fontSize: '0.92rem' }}>
                      {log.employeeId ? `משתמש מערכת (קוד ${log.employeeId})` : 'מערכת'} ביצע/ה {actionLabel}
                    </strong>
                    <div className="moc-meta">
                      {d.toLocaleDateString('he-IL')} ({getHebrewDateString(d)}) · {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <ChangesChips changesJson={log.changesJson} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
