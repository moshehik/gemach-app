'use client';

import { useState, useEffect } from 'react';
import { invalidateSettings } from '@/app/lib/pageCache';
import { validateNumericSetting } from '@/app/lib/settingsValidation';
import { toDisplayValue } from '@/lib/settingsMetadata';

// פאנל עריכה מהיר להגדרה בודדת - נפתח מכפתור [OPEN_SETTING:key] שעוזר ה-AI
// (app/api/ai/route.js, ACTION: SETTINGS_GUIDE) מוסיף לתשובתו כשהוא מזהה שמדובר
// בשאלה על הגדרת מערכת. המטרה: לא לשלוח את המשתמש למסך "הגדרות מערכת" המלא כדי
// למצוא איפה ההגדרה נמצאת - להראות אותה ולאפשר לשנות אותה כאן, במקום.
//
// טוען את הקטלוג המלא מ-GET /api/settings/guide (אותה נקודת קצה ואותו מקור-אמת
// יחיד - lib/settingsMetadata.js - שמשמש גם את עמוד ההגדרות המלא), ושומר דרך
// אותו POST /api/settings עם אותו נפילה-לאחור לאישור הנהלה ראשית/מתכנת בסיסמה
// (window.customAuthPrompt) שכבר קיים בעמוד ההגדרות המלא - "אישור מנהל לשנות
// אותה" הוא בדיוק אותה הרשאה שכבר אוכפת POST /api/settings/route.js, לא הרשאה
// נפרדת שהומצאה כאן.
//
// שדות מורכבים (מחלקות/שדות-חובה/סודות/חותמת-זמן) מוצגים לקריאה בלבד עם קישור
// לעמוד ההגדרות המלא - אין להם כאן בורר ייעודי (זה קיים רק ב-SettingsClient.js),
// ועדיף תצוגה-בלבד נכונה על פני עריכה גולמית שעלולה לשבש ערך JSON/רשימה.
const READ_ONLY_FIELD_TYPES = ['department', 'mandatoryFields', 'fieldGroups', 'secret', 'timestamp'];

export default function SettingQuickPanel({ settingKey, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entry, setEntry] = useState(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaveMessage(null);

    fetch('/api/settings/guide')
      .then(res => {
        if (!res.ok) throw new Error(res.status === 401 ? 'אין הרשאה לצפות בהגדרות מערכת.' : 'שגיאה בטעינת ההגדרה.');
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        const found = (data.settings || []).find(s => s.key === settingKey);
        if (!found) {
          setError('לא נמצאה הגדרה עם המפתח הזה.');
        } else {
          setEntry(found);
          setValue(found.currentValue || '');
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'שגיאה בטעינת ההגדרה.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [settingKey]);

  const isReadOnly = entry && READ_ONLY_FIELD_TYPES.includes(entry.fieldType);
  const numberError = entry && entry.fieldType === 'number' ? validateNumericSetting(entry.key, value) : null;

  const fullSettingsUrl = entry
    ? `${entry.pagePath}?tab=${encodeURIComponent(entry.category)}&highlight=${encodeURIComponent(entry.key)}`
    : '/admin/settings';

  const handleSave = async () => {
    if (!entry || isReadOnly) return;
    if (numberError) {
      setSaveMessage({ type: 'error', text: numberError });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    // "value" כאן הוא ערך התצוגה (הפוך למפתחות hide_* - ר' toDisplayValue) - צריך
    // להפוך אותו בחזרה לערך הגולמי הנשמר ב-DB לפני השליחה. הפונקציה סימטרית, אז
    // אותה קריאה בדיוק ממירה גם raw→display וגם display→raw.
    const rawValueToSave = toDisplayValue(entry.key, value);
    const payload = [{ key: entry.key, value: rawValueToSave, name: entry.name }];

    try {
      let res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      });

      // אותו נפילה-לאחור בדיוק כמו SettingsClient.js: אם אין קוקי הרשאה מספיק,
      // נדרש אישור הנהלה ראשית/מתכנת נקודתי בסיסמה לפני שהשמירה בפועל מתבצעת.
      if (res.status === 401) {
        const authResult = await window.customAuthPrompt(
          `שינוי ההגדרה "${entry.name}" דורש אישור הנהלה ראשית/מתכנת. אנא בחר מנהל והזן סיסמה:`,
          'הנהלה ראשית'
        );
        if (!authResult || !authResult.pin) {
          setSaving(false);
          setSaveMessage({ type: 'error', text: 'השמירה בוטלה: נדרש אישור הנהלה ראשית/מתכנת.' });
          return;
        }
        res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payload, employeeId: authResult.employeeId, pin: authResult.pin })
        });
      }

      if (!res.ok) throw new Error('שגיאה בשמירת ההגדרה');

      invalidateSettings();
      setEntry(prev => (prev ? { ...prev, currentValue: value } : prev));
      setSaveMessage({ type: 'success', text: 'ההגדרה נשמרה בהצלחה.' });
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message || 'שגיאה בשמירת ההגדרה.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100001, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div className="modal" style={{ maxWidth: 480, width: '92%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>
            <svg className="icon"><use href="#i-settings" /></svg>
            {entry ? entry.name : 'הגדרת מערכת'}
          </strong>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={onClose}>
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-3)' }}>
              <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              טוען הגדרה...
            </div>
          )}

          {!loading && error && (
            <div className="hint" style={{ color: 'var(--danger)' }}>{error}</div>
          )}

          {!loading && entry && (
            <>
              <span className="badge badge-info" style={{ alignSelf: 'flex-start' }}>{entry.location}</span>

              {entry.description && (
                <p className="hint" style={{ margin: 0, color: 'var(--text-3)', lineHeight: 1.5 }}>{entry.description}</p>
              )}

              {entry.fieldType === 'boolean' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="hint" style={{ color: 'var(--text-3)' }}>{value === 'true' ? 'פעיל' : 'כבוי'}</span>
                  <button
                    type="button"
                    className={value === 'true' ? 'switch on' : 'switch'}
                    onClick={() => setValue(value === 'true' ? 'false' : 'true')}
                  />
                </div>
              ) : entry.fieldType === 'select' ? (
                <select className="select" value={value} onChange={(e) => setValue(e.target.value)}>
                  {(entry.options || []).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : entry.fieldType === 'multiline' ? (
                <textarea
                  className="textarea"
                  style={{ minHeight: '100px' }}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              ) : entry.fieldType === 'number' ? (
                <div>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100%', borderColor: numberError ? 'var(--danger)' : undefined }}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                  {numberError && <p style={{ margin: '4px 0 0', color: 'var(--danger)', fontSize: '11.5px', fontWeight: 600 }}>{numberError}</p>}
                </div>
              ) : isReadOnly ? (
                <div>
                  <input type="text" className="input" style={{ width: '100%' }} value={value} disabled readOnly />
                  <p className="hint" style={{ margin: '6px 0 0', color: 'var(--text-3)' }}>
                    הגדרה זו כוללת בורר ייעודי (או שהיא סודית/לקריאה בלבד) - לעריכה יש לפתוח את עמוד ההגדרות המלא למטה.
                  </p>
                </div>
              ) : (
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}

              {saveMessage && (
                <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: saveMessage.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
                  {saveMessage.text}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <a href={fullSettingsUrl} className="hint" style={{ color: 'var(--primary-solid)' }}>
                  פתח בעמוד ההגדרות המלא ←
                </a>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>סגור</button>
                  {!isReadOnly && (
                    <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                      {saving ? 'שומר...' : 'שמור שינוי'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
