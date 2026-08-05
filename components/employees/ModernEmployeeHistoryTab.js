'use client';

import React, { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { getHebrewDateString } from '../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../HistoryViewer';
import { ChangesChips, ACTION_TONES } from '../modern/ChangesChips';

// שדות טכניים שאין טעם להציג בהיסטוריה (מזהים/חותמות עדכון)
const HIDDEN_FIELDS = ['id', 'employeeId', 'legacyId', 'updatedAt'];

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
 * טאב "היסטוריה" בעיצוב המודרני (moc) עבור כרטיס עובד - אותה שיטת עיצוב כמו
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
    <div className="moc-section-block">
      <div className="moc-table-toolbar">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><History size={18} /> היסטוריית שינויים</h3>
        <span className="moc-hint">{logs.length} תיעודי פעולות</span>
      </div>

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
          <div className="moc-empty-state">אין תיעוד היסטוריה לעובד זה</div>
        ) : (
          logs.map((log) => {
            const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
            const tone = ACTION_TONES[log.action] || ACTION_TONES.UPDATE;
            const d = new Date(log.createdAt);
            const normalized = normalizeChangesForDisplay(log.changesJson, log.action);
            return (
              <div key={log.id} className="moc-history-item">
                <div className="moc-history-dot" style={{ background: tone.color }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className="moc-action-tag" style={{ background: tone.bg, color: tone.color }}>{actionLabel}</span>
                  <strong style={{ fontSize: '0.92rem' }}>
                    {entityLabel(log.entityType)} · {log.employeeId ? `משתמש מערכת (קוד ${log.employeeId})` : 'מערכת'} ביצע/ה {actionLabel}
                  </strong>
                  <div className="moc-meta">
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
