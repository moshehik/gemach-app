'use client';

import React from 'react';
import { getHebrewDateString } from '../../lib/hebrewDate';
import { FIELD_TRANSLATIONS } from '../HistoryViewer';

const DANGER_TONE = { bg: 'var(--moc-danger-bg)', color: 'var(--moc-danger-text)' };
const SUCCESS_TONE = { bg: 'var(--moc-success-bg)', color: '#166534' };

export const ACTION_TONES = {
  CREATE: SUCCESS_TONE,
  DELETE: DANGER_TONE,
  UPDATE: { bg: 'var(--moc-primary-light)', color: 'var(--moc-primary-dark)' },
  // כל פעולות הביטול נצבעות באדום כדי שיבלטו בציר ההיסטוריה
  CANCEL_RENTAL: DANGER_TONE,
  CANCEL_RETURN: DANGER_TONE,
  CANCEL_SCAN: DANGER_TONE,
  CANCEL_ITEM: DANGER_TONE,
  CANCEL_OBLIGATION: DANGER_TONE,
  CANCEL_PAYMENT: DANGER_TONE,
  CANCEL_ORDER: DANGER_TONE,
  CANCEL_CHANGES: DANGER_TONE,
  RESTORE_ITEM: SUCCESS_TONE,
  RESTORE_OBLIGATION: SUCCESS_TONE,
  RESTORE_PAYMENT: SUCCESS_TONE,
  CONFIRM_RENTAL: SUCCESS_TONE,
  RETURN_RENTAL: SUCCESS_TONE,
  DEBT_APPROVED: SUCCESS_TONE,
  CANCEL_DEBT_APPROVAL: DANGER_TONE
};

export const formatValue = (val) => {
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

// שורת שינויים של רשומת היסטוריה — צ'יפים בשפת העיצוב המודרנית (moc).
// משותף בין טאבי ה"מידע/היסטוריה" של הזמנה ולקוח כדי שלא לשכפל את לוגיקת העיצוב.
export function ChangesChips({ changesJson }) {
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
          const isLongText = key === 'body' || key === 'notes' || key === 'orderNotes' || key === 'officeNotes';

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
}
