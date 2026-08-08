'use client';

import React, { useState, useEffect } from 'react';
import HebrewDatePicker from '../../HebrewDatePicker';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { ChangesChips } from '../../modern/ChangesChips';
import { verifyPin } from './mocAuth';

// מיפוי מקומי (עיצוב "אריג" בלבד) מפעולת יומן ל-badge סמנטי — אותה קיבוץ סמנטי
// כמו ACTION_TONES (משותף), רק ממופה ל-classNames של מערכת העיצוב.
const ACTION_BADGE_CLASS = {
  CREATE: 'badge-success',
  DELETE: 'badge-danger',
  UPDATE: 'badge-primary',
  CANCEL_RENTAL: 'badge-danger',
  CANCEL_RETURN: 'badge-danger',
  CANCEL_SCAN: 'badge-danger',
  CANCEL_ITEM: 'badge-danger',
  CANCEL_OBLIGATION: 'badge-danger',
  CANCEL_PAYMENT: 'badge-danger',
  CANCEL_ORDER: 'badge-danger',
  CANCEL_CHANGES: 'badge-danger',
  RESTORE_ITEM: 'badge-success',
  RESTORE_OBLIGATION: 'badge-success',
  RESTORE_PAYMENT: 'badge-success',
  CONFIRM_RENTAL: 'badge-success',
  RETURN_RENTAL: 'badge-success',
  DEBT_APPROVED: 'badge-success',
  CANCEL_DEBT_APPROVAL: 'badge-danger'
};
const badgeClassFor = (action) => ACTION_BADGE_CLASS[action] || 'badge-neutral';

/**
 * טאב "מידע" בעיצוב "אריג" — כרטיס "בוצעה על ידי" (עם תאריך עברי ועריכת
 * תאריך ביצוע בהרשאת מתכנת) + היסטוריית שינויים כללית עם סינון.
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
      <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="avatar lg"><svg className="icon"><use href="#i-user" /></svg></div>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <span className="hint" style={{ color: 'var(--text-3)' }}>בוצעה על ידי</span>
          <div style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
            <span>{performedByName} · {dateLabel}</span>
            {isEditingOrderDate ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: '200px' }}>
                <HebrewDatePicker value={order.orderDate} onChange={handleOrderDateChange} />
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="ביטול עריכה" onClick={() => setIsEditingOrderDate(false)}>
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-icon-only btn-sm"
                title="שינוי תאריך ביצוע ההזמנה — לצורך בדיקות (מתכנת בלבד)"
                onClick={requestOrderDateEdit}
              >
                <svg className="icon"><use href="#i-edit" /></svg>
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-icon-only"
          title="עובדים פעילים בהזמנה"
          onClick={onShowEmployees}
        >
          <svg className="icon"><use href="#i-users" /></svg>
        </button>
      </div>

      {/* היסטוריית שינויים כללית */}
      <div className="toolbar">
        <h3 style={{ fontSize: '15px' }}>היסטוריית שינויים</h3>
        <span className="spacer" />
        <span className="hint" style={{ color: 'var(--text-3)' }}>{logs.length} תיעודי פעולות</span>
      </div>

      {/* חיפוש פשוט */}
      <form onSubmit={(e) => { e.preventDefault(); setFilterSearch(searchInput); }} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <div className="input-icon-wrap" style={{ flex: 1 }}>
          <svg className="icon"><use href="#i-search" /></svg>
          <input
            type="text"
            className="input"
            placeholder="חיפוש בהיסטוריה..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-sm">חפש</button>
        {filterSearch && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFilterSearch(''); setSearchInput(''); }}>
            <svg className="icon"><use href="#i-x" /></svg> נקה
          </button>
        )}
      </form>

      <div className="card">
        {loading ? (
          <div className="loading-inline" style={{ padding: '28px 0' }}>
            <span className="spinner lg" />
            טוען היסטוריית שינויים...
          </div>
        ) : error ? (
          <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '20px 0', fontWeight: 700 }}>
            שגיאה בטעינת היסטוריה: {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <svg className="icon"><use href="#i-history" /></svg>
            <p>לא נמצאו תיעודי היסטוריה או שינויים</p>
          </div>
        ) : (
          logs.map((log) => {
            const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
            const d = new Date(log.createdAt);
            return (
              <div key={log.id} className="select-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className={`badge ${badgeClassFor(log.action)}`}>{actionLabel}</span>
                  <strong style={{ fontSize: '13px', marginInlineStart: '6px' }}>
                    {log.employeeId ? (log.employeeName || 'עובד שנמחק') : 'מערכת'} ביצע/ה {actionLabel}
                  </strong>
                  <div className="hint" style={{ color: 'var(--text-3)', marginTop: '2px' }}>
                    {d.toLocaleDateString('he-IL')} ({getHebrewDateString(d)}) · {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <ChangesChips changesJson={log.changesJson} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
