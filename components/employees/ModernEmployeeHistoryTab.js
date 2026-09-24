'use client';

import React, { useState, useEffect } from 'react';
import { getHebrewDateString } from '../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../HistoryViewer';
import { ChangesChips } from '../modern/ChangesChips';
import { Card, Tag, Badge, Banner, Empty, Icon } from '@/app/v3/ui/components';

// שדות טכניים שאין טעם להציג בהיסטוריה (מזהים/חותמות עדכון)
const HIDDEN_FIELDS = ['id', 'employeeId', 'legacyId', 'updatedAt'];

// מיפוי מקומי (תצוגה בלבד) מפעולת יומן לוריאנט של Tag ב-v3 — אותה קיבוץ סמנטי
// כמו ACTION_TONES ב-components/modern/ChangesChips.js (משותף, מחוץ לאשכול הזה):
// done = הצלחה/שחזור, attn = מחיקה/ביטול, soft = ניטרלי.
const ACTION_BADGE_CLASS = {
  CREATE: 'done',
  DELETE: 'attn',
  UPDATE: 'soft',
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
const badgeClassFor = (action) => ACTION_BADGE_CLASS[action] || 'soft';

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
    <Card icon="history" title="היסטוריית שינויים" actions={<Badge variant="neutral"><bdi>{logs.length}</bdi></Badge>}>
      {loading ? (
        <div className="v3-empty" role="status">
          <Icon name="loader" size="xl" loop />
          <span>טוענים את ההיסטוריה...</span>
        </div>
      ) : error ? (
        <Banner kind="alert" title="לא הצלחנו לטעון את ההיסטוריה" text={error} />
      ) : logs.length === 0 ? (
        <Empty icon="history" text="עדיין אין שינויים מתועדים לעובד הזה." />
      ) : (
        <div className="v3-rows">
          {logs.map((log) => {
            const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
            const d = new Date(log.createdAt);
            const normalized = normalizeChangesForDisplay(log.changesJson, log.action);
            return (
              <div key={log.id} className="v3-row">
                <div className="v3-row__body">
                  <div>
                    <Tag variant={badgeClassFor(log.action)}>{actionLabel}</Tag>
                  </div>
                  <b>{log.employeeId ? (log.employeeName || 'עובד שנמחק') : 'מערכת'} · {entityLabel(log.entityType)}</b>
                  <div className="v3-faint">
                    <bdi>{d.toLocaleDateString('he-IL')}</bdi> ({getHebrewDateString(d)}) · <bdi>{d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</bdi>
                  </div>
                  <ChangesChips changesJson={JSON.stringify(normalized)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
