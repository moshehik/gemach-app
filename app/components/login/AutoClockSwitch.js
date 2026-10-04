'use client';

// המתג "רשום לי התחלת עבודה אוטומטית בכניסה" בכרטיס הפרופיל של העובד בלבד (דף /profile, "הפרופיל שלי") - אותה
// הגדרה כמו במסך הכניסה (GET/PUT /api/me/auto-clock-in, נשמרת בהעדפות העובד). הבעלים (2.10.2026): לא בתפריט
// המשתמש הנפתח (הישן, הסרגל החדש, מגירת הנייד) - רק בתוך כרטיס הפרופיל. Q05 התפרש כדף הפרופיל.
// העתק מקומי בדפדפן (gm-login-autoclock:<id>) מעודכן גם כאן, כדי שהמתג במסך הכניסה ישקף את הערך האחרון.

import { useEffect, useState } from 'react';
import { useUiVariant } from '../UiVariantContext';

export const AUTO_CLOCK_LABEL = 'רשום לי התחלת עבודה אוטומטית בכניסה';
export const AUTO_CLOCK_MIRROR_PREFIX = 'gm-login-autoclock:';

export function writeAutoClockMirror(employeeId, enabled) {
  try {
    if (employeeId) localStorage.setItem(`${AUTO_CLOCK_MIRROR_PREFIX}${employeeId}`, enabled ? '1' : '0');
  } catch (e) { /* localStorage חסום - לא קריטי */ }
}

export function readAutoClockMirror(employeeId) {
  try {
    if (!employeeId) return null;
    const v = localStorage.getItem(`${AUTO_CLOCK_MIRROR_PREFIX}${employeeId}`);
    return v === '1' ? true : v === '0' ? false : null;
  } catch (e) {
    return null;
  }
}

export default function AutoClockSwitch() {
  // "ישן / חדש" (4.10.2026): הדף הישן /profile (app/profile/LegacyProfilePage.js, משוחזר כפי שהוא) מרנדר את הרכיב הזה - שם מוצג
  // המראה הקודם (תיבת סימון + שורת עזר, 7917382f^). ההתנהגות והשמירה זהות בשתי הגרסאות.
  const profileVariant = useUiVariant('profile');
  const [enabled, setEnabled] = useState(null); // null = טוען / לא מחובר
  const [employeeId, setEmployeeId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/me/auto-clock-in', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d && d.success) {
          setEnabled(!!d.enabled);
          setEmployeeId(d.employeeId || null);
        } else {
          setEnabled(false);
        }
      })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, []);

  const toggle = async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/me/auto-clock-in', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setEnabled(!next);
        setError(data.error || 'השמירה נכשלה');
      } else {
        writeAutoClockMirror(employeeId, !!data.enabled);
      }
    } catch (e) {
      setEnabled(!next);
      setError('שגיאת תקשורת');
    } finally {
      setSaving(false);
    }
  };

  const checked = enabled === true;
  const disabled = enabled === null || saving;

  // עיצוב הפרופיל החדש (תצוגות-עיצוב/פרופיל-עובד.html): מתג הפעלה/כיבוי של הפלטה (שדה 9, בורר 19) בשורת trow, בלי שורת עזר
  // (הבעלים 3.10.2026: כיתוב ההסבר מתחת למתג הוסר). ההתנהגות לא השתנתה - השמירה מיידית ב-PUT.
  // שורת הודעה מופיעה רק כשהשמירה נכשלה (לא כיתוב קבוע).
  if (profileVariant === 'legacy') {
    return (
      <div className="field" style={{ gridColumn: '1 / -1' }}>
        <div className="checkbox-row">
          <input type="checkbox" id="profile-autoClockIn" checked={checked} disabled={disabled} onChange={toggle} />
          <label htmlFor="profile-autoClockIn">{AUTO_CLOCK_LABEL}</label>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
          {error || 'נשמר מיד, בלי לחיצה על "שמירת פרטים". פועל בכל מחשב שבו נכנסים.'}
        </div>
      </div>
    );
  }

  return (
    <div className="pf-pref">
      <div className="trow">
        <label className="sw"><input type="checkbox" id="profile-autoClockIn" checked={checked} disabled={disabled} onChange={toggle} /><i /></label>
        <label htmlFor="profile-autoClockIn" className="pf-pl">{AUTO_CLOCK_LABEL}</label>
      </div>
      {error ? <div className="sm faint pf-hint" role="alert">{error}</div> : null}
    </div>
  );
}
