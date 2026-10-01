'use client';

// המתג "רשום לי התחלת עבודה אוטומטית בכניסה" בתפריט "הפרופיל שלי" (Q05/L16) ובדף הפרופיל - אותה הגדרה
// כמו במסך הכניסה (GET/PUT /api/me/auto-clock-in, נשמרת בהעדפות העובד). variant:
//   'legacy'  - שורה בתפריט המשתמש הישן (UserMenu.js, מחלקות .user-menu-item)
//   'a5'      - שורה בפאנל המשתמש של הסרגל החדש (MenuA5Shell, מחלקות .sn-link + המתג .sw של הפלטה)
//   'profile' - שורת תיבת סימון בדף הפרופיל (app/profile/page.js, .checkbox-row)
// העתק מקומי בדפדפן (gm-login-autoclock:<id>) מעודכן גם כאן, כדי שהמתג במסך הכניסה ישקף את הערך האחרון.

import { useEffect, useState } from 'react';

export const AUTO_CLOCK_LABEL = 'רשום לי התחלת עבודה אוטומטית בכניסה';
export const AUTO_CLOCK_HINT = 'אותה הגדרה כמו במסך הכניסה. אפשר לכבות בלי להתנתק.';
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

export default function AutoClockSwitch({ variant = 'legacy' }) {
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

  if (variant === 'profile') {
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

  if (variant === 'a5') {
    return (
      <label className="sn-link" role="menuitemcheckbox" aria-checked={checked ? 'true' : 'false'} style={{ cursor: disabled ? 'default' : 'pointer', alignItems: 'flex-start', gap: '10px' }} title={error || AUTO_CLOCK_HINT}>
        <span className="sw" style={{ marginTop: '2px' }}>
          <input type="checkbox" checked={checked} disabled={disabled} onChange={toggle} aria-label={AUTO_CLOCK_LABEL} />
          <i aria-hidden="true" />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'normal', minWidth: 0 }}>
          <span>{AUTO_CLOCK_LABEL}</span>
          <small style={{ fontSize: '12px', color: error ? 'var(--gm-red)' : 'var(--gm-ink3)', lineHeight: 1.35 }}>{error || AUTO_CLOCK_HINT}</small>
        </span>
      </label>
    );
  }

  // legacy: תפריט המשתמש הישן (UserMenu.js)
  return (
    <label
      className="user-menu-item"
      role="menuitemcheckbox"
      aria-checked={checked ? 'true' : 'false'}
      title={error || AUTO_CLOCK_HINT}
      style={{ cursor: disabled ? 'default' : 'pointer', alignItems: 'flex-start', gap: '10px', whiteSpace: 'normal' }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'relative', flex: 'none', width: '34px', height: '20px', borderRadius: '999px', marginTop: '2px',
          background: checked ? 'var(--primary-solid)' : 'var(--border-strong)', transition: 'background .2s',
        }}
      >
        {/* הכפתור הלבן כמחלקה (gm-autoclock-knob ב-login.css) ולא כ-style: design-overrides.css דורס רקע לבן inline */}
        <span className="gm-autoclock-knob" style={{ insetInlineStart: checked ? '16px' : '2px' }} />
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={toggle} aria-label={AUTO_CLOCK_LABEL} style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', margin: 0 }} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span>{AUTO_CLOCK_LABEL}</span>
        <small style={{ fontSize: '11px', color: error ? 'var(--danger)' : 'var(--text-3)', lineHeight: 1.35 }}>{error || AUTO_CLOCK_HINT}</small>
      </span>
    </label>
  );
}
