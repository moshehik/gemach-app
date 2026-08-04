'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Users, CalendarClock, X, Search } from 'lucide-react';
import HebrewDatePicker from '../../HebrewDatePicker';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { FIELD_TRANSLATIONS, ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { verifyPin } from './mocAuth';

const ACTION_TONES = {
  CREATE: { bg: 'var(--moc-success-bg)', color: '#166534' },
  DELETE: { bg: 'var(--moc-danger-bg)', color: 'var(--moc-danger-text)' },
  UPDATE: { bg: 'var(--moc-primary-light)', color: 'var(--moc-primary-dark)' }
};

const formatValue = (val) => {
  if (val === null || val === undefined || val === '') return '-';
  if (typeof val === 'boolean') return val ? 'כן' : 'לא';
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    try {
      const d = new Date(val);
      return `${d.toLocaleDateString('he-IL')} (${getHebrewDateString(d)})`;
    } catch (e) { return val; }
  }
  return String(val);
};

// שורת שינויים של רשומת היסטוריה — צ'יפים בשפת העיצוב המודרנית
const ChangesChips = ({ changesJson }) => {
  try {
    const changes = typeof changesJson === 'string' ? JSON.parse(changesJson) : changesJson;
    const keys = Object.keys(changes).filter(key => {
      const change = changes[key];
      if (change && typeof change === 'object' && ('from' in change || 'to' in change)) {
        const isEmptyFrom = change.from === null || change.from === undefined || change.from === '';
        const isEmptyTo = change.to === null || change.to === undefined || change.to === '';
        if (isEmptyFrom && isEmptyTo) return false;
        if (String(change.from) === String(change.to)) return false;
        return true;
      }
      return !(change === null || change === undefined || change === '');
    });

    if (keys.length === 0) {
      return <div className="moc-hint" style={{ fontStyle: 'italic', marginTop: '6px' }}>לא בוצעו שינויים מהותיים בשדות.</div>;
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
        {keys.map(key => {
          const label = FIELD_TRANSLATIONS[key] || key;
          const change = changes[key];
          const isFromTo = change && typeof change === 'object' && ('from' in change || 'to' in change);
          const isLongText = key === 'body' || key === 'notes' || key === 'orderNotes';

          if (isLongText) {
            return (
              <div key={key} className="moc-diff" style={{ width: '100%' }}>
                <strong style={{ color: 'var(--moc-text-muted)' }}>{label}: </strong>
                {isFromTo ? (
                  <>
                    {change.from && <span style={{ textDecoration: 'line-through', color: 'var(--moc-danger-text)', marginLeft: '6px' }}>{formatValue(change.from)}</span>}
                    <span style={{ color: '#166534', fontWeight: 600 }}>{formatValue(change.to)}</span>
                  </>
                ) : (
                  <span>{formatValue(change)}</span>
                )}
              </div>
            );
          }

          return (
            <span key={key} style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fff',
              border: '1px solid var(--moc-divider)', borderRadius: '16px', padding: '4px 10px', fontSize: '0.8rem'
            }}>
              <strong style={{ color: 'var(--moc-text-muted)', fontWeight: 600 }}>{label}:</strong>
              {isFromTo ? (
                <>
                  {change.from !== null && change.from !== undefined && change.from !== '' && (
                    <span style={{ textDecoration: 'line-through', color: 'var(--moc-danger-text)' }}>{formatValue(change.from)}</span>
                  )}
                  <span style={{ color: '#94a3b8' }}>←</span>
                  <span style={{ color: '#166534', fontWeight: 700 }}>{formatValue(change.to)}</span>
                </>
              ) : (
                <span style={{ fontWeight: 600 }}>{formatValue(change)}</span>
              )}
            </span>
          );
        })}
      </div>
    );
  } catch (e) {
    return <div className="moc-diff moc-mono" dir="ltr" style={{ whiteSpace: 'pre-wrap' }}>{String(changesJson)}</div>;
  }
};

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
