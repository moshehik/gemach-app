'use client';

import React, { useState, useEffect } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { ChangesChips } from '../../modern/ChangesChips';

// מיפוי מקומי (עיצוב "אריג" בלבד) מפעולת יומן ל-badge סמנטי — אותה קיבוץ סמנטי
// כמו ACTION_TONES ב-components/modern/ChangesChips.js (משותף, מחוץ לאשכול הזה),
// ראו גם ModernDressInfoTab.js שמשתמש באותה תבנית.
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
 * טאב "היסטוריה" עבור כרטיס לקוח — אותה שיטת עיצוב כמו טאב "מידע" בכרטיס
 * ההזמנה, ללא פאנל "בוצע על ידי" שאין לו מקבילה אצל לקוח.
 */
export default function ModernCustomerHistoryTab({ customerId }) {
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
        query.append('entityType', 'Customer');
        if (customerId) query.append('entityId', customerId);
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
  }, [customerId, filterSearch]);

  return (
    <div>
      <div className="toolbar">
        <div style={{ fontWeight: 800, fontSize: '14.5px' }}>היסטוריית שינויים</div>
        <span className="spacer" />
        <span className="hint" style={{ color: 'var(--text-3)' }}>{logs.length} תיעודי פעולות</span>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setFilterSearch(searchInput); }} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div className="input-icon-wrap" style={{ flex: 1 }}>
          <svg className="icon"><use href="#i-search" /></svg>
          <input type="text" className="input" placeholder="חיפוש בהיסטוריה..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-secondary">חפש</button>
        {filterSearch && (
          <button type="button" className="btn btn-ghost" onClick={() => { setFilterSearch(''); setSearchInput(''); }}>
            <svg className="icon"><use href="#i-x" /></svg>
            נקה
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
    </div>
  );
}
