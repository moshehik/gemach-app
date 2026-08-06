'use client';

import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { ChangesChips, ACTION_TONES } from '../../modern/ChangesChips';

/**
 * טאב "היסטוריה" בעיצוב המודרני עבור כרטיס לקוח — אותה שיטת עיצוב
 * כמו טאב "מידע" בכרטיס ההזמנה (ModernInfoTab), ללא פאנל "בוצע על ידי"
 * שאין לו מקבילה אצל לקוח.
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
    <div className="moc-section-block">
      <div className="moc-table-toolbar">
        <h3>היסטוריית שינויים</h3>
        <span className="moc-hint">{logs.length} תיעודי פעולות</span>
      </div>

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
                    {log.employeeId ? (log.employeeName || 'עובד שנמחק') : 'מערכת'} ביצע/ה {actionLabel}
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
  );
}
