'use client';

import React, { useState, useEffect } from 'react';
import { getHebrewDateString } from '../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../HistoryViewer';
import { ChangesChips } from '../modern/ChangesChips';

// שדות טכניים שאין טעם להציג בהיסטוריה (מזהים/חותמות עדכון)
const HIDDEN_FIELDS = ['id', 'employeeId', 'legacyId', 'updatedAt'];

// מיפוי מקומי (עיצוב "אריג" בלבד) מפעולת יומן ל-badge סמנטי — אותה קיבוץ סמנטי
// כמו ACTION_TONES ב-components/modern/ChangesChips.js (משותף, מחוץ לאשכול הזה),
// באותה תבנית כמו ModernCustomerHistoryTab.js.
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
 * שורות AuditLog שנכתבות ידנית מראוטי המשמרות (Shift מוחרג מתוסף היומן האוטומטי,
 * ראו app/lib/prisma.js) נכתבו בעבר כתמונת מצב מלאה עטופה תחת from/to - למשל
 * CREATE: {"to": {...כל שדות המשמרת...}}, UPDATE/DELETE: {"from": {...}, "to": {...}}.
 * זו צורה שונה לגמרי ממה שרכיב ה-ChangesChips (ומרבית שאר המערכת) מצפה לו: אובייקט
 * שטוח שהמפתחות בו הם שמות שדות בפועל (value פשוט, או {from,to} לכל שדה). זו הסיבה
 * ששורת "הוספת משמרת" לא הוצגה כמו שצריך - היא לא נעלמה, אבל הוצגה כצ'יפ מכוער
 * יחיד בשם "to" עם כל האובייקט כטקסט. הראוטים תוקנו לכתוב מעכשיו בפורמט הרגיל,
 * אבל רשומות ישנות עדיין קיימות ככה בבסיס הנתונים - כאן הן מנורמלות לתצוגה.
 */
function normalizeChangesForDisplay(changesJson, action) {
  let changes;
  try {
    changes = typeof changesJson === 'string' ? JSON.parse(changesJson) : changesJson;
  } catch (e) {
    return changesJson;
  }
  if (!changes || typeof changes !== 'object') return changes;

  const keys = Object.keys(changes);
  const toObj = changes.to && typeof changes.to === 'object' ? changes.to : null;
  const fromObj = changes.from && typeof changes.from === 'object' ? changes.from : null;
  const isLegacySnapshotShape = keys.length > 0 && keys.every(k => k === 'from' || k === 'to') && (toObj || fromObj);

  if (!isLegacySnapshotShape) return changes;

  const result = {};
  if (toObj && fromObj) {
    const allKeys = new Set([...Object.keys(fromObj), ...Object.keys(toObj)]);
    allKeys.forEach(key => {
      if (HIDDEN_FIELDS.includes(key)) return;
      const fv = fromObj[key];
      const tv = toObj[key];
      if (String(fv) === String(tv)) return;
      result[key] = { from: fv, to: tv };
    });
  } else if (toObj) {
    Object.keys(toObj).forEach(key => {
      if (HIDDEN_FIELDS.includes(key)) return;
      // ב"יצירה" אין טעם להציג דגלים בוליאניים במצב ברירת המחדל שלהם (למשל isDeleted: false)
      if (action === 'CREATE' && toObj[key] === false) return;
      result[key] = toObj[key];
    });
  }
  return result;
}

/**
 * טאב "היסטוריה" בעיצוב "אריג" עבור כרטיס עובד — אותה שיטת עיצוב כמו
 * ModernCustomerHistoryTab / טאב "מידע" בהזמנה, עם תמיכה בפורמט הישן שבו נכתבו
 * שורות ה-AuditLog של משמרות (ראו normalizeChangesForDisplay למעלה).
 */
export default function ModernEmployeeHistoryTab({ employeeId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/employees/${employeeId}/history`);
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();
        if (!cancelled) setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLogs();
    return () => { cancelled = true; };
  }, [employeeId]);

  const entityLabel = (entityType) => (entityType === 'Shift' ? 'משמרת' : entityType === 'Employee' ? 'עובד' : entityType);

  return (
    <div>
      <div className="toolbar">
        <div style={{ fontWeight: 800, fontSize: '14.5px' }}>היסטוריית שינויים</div>
        <span className="spacer" />
        <span className="hint" style={{ color: 'var(--text-3)' }}>{logs.length} תיעודי פעולות</span>
      </div>

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
            <p>אין תיעוד היסטוריה לעובד זה</p>
          </div>
        ) : (
          logs.map((log) => {
            const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
            const d = new Date(log.createdAt);
            const normalized = normalizeChangesForDisplay(log.changesJson, log.action);
            return (
              <div key={log.id} className="select-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className={`badge ${badgeClassFor(log.action)}`}>{actionLabel}</span>
                  <strong style={{ fontSize: '13px', marginInlineStart: '6px' }}>
                    {entityLabel(log.entityType)} · {log.employeeId ? (log.employeeName || 'עובד שנמחק') : 'מערכת'} ביצע/ה {actionLabel}
                  </strong>
                  <div className="hint" style={{ color: 'var(--text-3)', marginTop: '2px' }}>
                    {d.toLocaleDateString('he-IL')} ({getHebrewDateString(d)}) · {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <ChangesChips changesJson={JSON.stringify(normalized)} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
