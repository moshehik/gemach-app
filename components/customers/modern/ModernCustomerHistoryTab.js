'use client';

import React, { useState, useEffect } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { ChangesChips } from '../../modern/ChangesChips';
import { Card, Btn, Chip, Empty, Icon } from '@/app/v3/ui/components';

// מיפוי מקומי (עיצוב v3 בלבד) מפעולת יומן לוריאנט צ'יפ — אותה קבוצה סמנטית
// כמו ACTION_TONES ב-components/modern/ChangesChips.js (משותף, מחוץ לאשכול הזה).
const ACTION_CHIP_VARIANT = {
  CREATE: 'done',
  DELETE: 'attn',
  UPDATE: 'info',
  CANCEL_RENTAL: 'attn',
  CANCEL_RETURN: 'attn',
  CANCEL_SCAN: 'attn',
  CANCEL_ITEM: 'attn',
  CANCEL_OBLIGATION: 'attn',
  CANCEL_PAYMENT: 'attn',
  CANCEL_ORDER: 'attn',
  CANCEL_CHANGES: 'attn',
  RESTORE_ITEM: 'done',
  RESTORE_OBLIGATION: 'done',
  RESTORE_PAYMENT: 'done',
  CONFIRM_RENTAL: 'done',
  RETURN_RENTAL: 'done',
  DEBT_APPROVED: 'done',
  CANCEL_DEBT_APPROVAL: 'attn'
};
const chipVariantFor = (action) => ACTION_CHIP_VARIANT[action];

/**
 * לשונית "היסטוריה" בכרטיס לקוח — רשומות בשורות נפרדות, בסגנון היסטוריית כרטיס ההזמנה,
 * ללא פאנל "בוצע על ידי" שאין לו מקבילה אצל לקוח.
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
    <Card icon="history" title="היסטוריית שינויים" tip="כל שינוי בפרטי הלקוח נרשם כאן, עם שם העובד והשעה.">
      <div className="v3-stack">
        <form
          className="v3-filter-bar"
          role="search"
          onSubmit={(e) => { e.preventDefault(); setFilterSearch(searchInput); }}
        >
          <div className="v3-search">
            <Icon name="search" />
            <input type="text" placeholder="חיפוש בהיסטוריה" aria-label="חיפוש בהיסטוריה" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          </div>
          <Btn type="submit">חיפוש</Btn>
          {filterSearch && (
            <Btn variant="quiet" icon="x" onClick={() => { setFilterSearch(''); setSearchInput(''); }}>
              ניקוי
            </Btn>
          )}
        </form>

        {!loading && !error && <span className="v3-faint"><bdi>{logs.length}</bdi> רשומות</span>}

        {loading ? (
          <div className="v3-empty" role="status">
            <Icon name="loader" size="xl" loop />
            <span>טוענים היסטוריה...</span>
          </div>
        ) : error ? (
          <Empty icon="alert-circle" title="לא הצלחנו לטעון את ההיסטוריה" text={`פרטים: ${error}`} />
        ) : logs.length === 0 ? (
          <Empty icon="history" title="אין עדיין רשומות היסטוריה" />
        ) : (
          <div className="v3-list">
            {logs.map((log) => {
              const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
              const d = new Date(log.createdAt);
              return (
                <div key={log.id} className="v3-li">
                  <div className="v3-li__ic"><Icon name="history" /></div>
                  <div className="v3-li__body">
                    <Chip variant={chipVariantFor(log.action)}>{actionLabel}</Chip>
                    <span className="v3-li__title">
                      {log.employeeId ? (log.employeeName || 'עובד שנמחק') : 'מערכת'} ביצע/ה {actionLabel}
                    </span>
                    <span className="v3-li__sub">
                      <bdi>{d.toLocaleDateString('he-IL')}</bdi> ({getHebrewDateString(d)}) · <bdi>{d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</bdi>
                    </span>
                    <ChangesChips changesJson={log.changesJson} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
