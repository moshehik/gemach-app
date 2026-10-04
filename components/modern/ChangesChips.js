'use client';

import React from 'react';
import { getHebrewDateString } from '../../lib/hebrewDate';
import { FIELD_TRANSLATIONS } from '../HistoryViewer';
import { isVisibleChangeKey, labelChangeValue } from './changesDisplay';

const DANGER_TONE = { bg: 'var(--danger-tint)', color: 'var(--danger)' };
const SUCCESS_TONE = { bg: 'var(--success-tint)', color: 'var(--success)' };

export const ACTION_TONES = {
  CREATE: SUCCESS_TONE,
  DELETE: DANGER_TONE,
  UPDATE: { bg: 'var(--primary-tint)', color: 'var(--primary-solid)' },
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
  CANCEL_DEBT_APPROVAL: DANGER_TONE,
  // לו״ז יומי - סימון "בוצע" / ביטולו (lib/schedule/marks.js)
  ALTERATION_DONE: SUCCESS_TONE,
  ALTERATION_UNDONE: DANGER_TONE,
  SCHEDULE_STAGE_DONE: SUCCESS_TONE,
  SCHEDULE_STAGE_UNDONE: DANGER_TONE
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

// שורת שינויים של רשומת היסטוריה — צ'יפים בשפת העיצוב "אריג" (app/design-system.css).
// משותף בין טאבי ה"מידע/היסטוריה" של הזמנה, לקוח, דגם ועובד כדי שלא לשכפל את לוגיקת העיצוב.
export function ChangesChips({ changesJson }) {
  try {
    const changes = typeof changesJson === 'string' ? JSON.parse(changesJson) : changesJson;
    // raw UUIDs / technical keys are never shown; machine values get Hebrew labels (changesDisplay.js)
    const show = (key, val) => labelChangeValue(key, val) ?? formatValue(val);
    const keys = Object.keys(changes).filter(key => {
      const change = changes[key];
      if (!isVisibleChangeKey(key, change)) return false;
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
      return <div style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontStyle: 'italic', marginTop: '6px' }}>לא בוצעו שינויים מהותיים בשדות.</div>;
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
              <div key={key} style={{
                width: '100%', background: 'var(--surface-alt)', border: '1px solid var(--border)',
                borderRadius: '6px', padding: '6px 10px', fontSize: '0.82rem', color: 'var(--text-2)'
              }}>
                <strong style={{ color: 'var(--text-3)' }}>{label}: </strong>
                {isFromTo ? (
                  <>
                    {change.from && <span style={{ textDecoration: 'line-through', color: 'var(--danger)', marginLeft: '6px' }}>{show(key, change.from)}</span>}
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>{show(key, change.to)}</span>
                  </>
                ) : (
                  <span>{show(key, change)}</span>
                )}
              </div>
            );
          }

          return (
            <span key={key} className="chip">
              <strong style={{ color: 'var(--text-3)', fontWeight: 600 }}>{label}:</strong>
              {isFromTo ? (
                <>
                  {change.from !== null && change.from !== undefined && change.from !== '' && (
                    <span style={{ textDecoration: 'line-through', color: 'var(--danger)' }}>{show(key, change.from)}</span>
                  )}
                  <span style={{ color: 'var(--text-3)' }}>←</span>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>{show(key, change.to)}</span>
                </>
              ) : (
                <span style={{ fontWeight: 600 }}>{show(key, change)}</span>
              )}
            </span>
          );
        })}
      </div>
    );
  } catch (e) {
    return (
      <div dir="ltr" style={{
        background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '6px',
        padding: '6px 10px', fontSize: '0.82rem', color: 'var(--text-2)',
        fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap'
      }}>{String(changesJson)}</div>
    );
  }
}
