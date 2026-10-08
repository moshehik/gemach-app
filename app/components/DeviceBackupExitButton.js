'use client';

import { useState } from 'react';

// "חזרה לנתונים האמיתיים" בתוך באנר מצב הגיבוי של המחשב הזה (app/components/BackupModeBanner.js).
// מוחק את העוגייה (POST /api/admin/db-view) ואז טוען מחדש: מטמוני הלקוח (sessionStorage) שייכים למסד הקודם.
export default function DeviceBackupExitButton() {
  const [busy, setBusy] = useState(false);
  const exit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/db-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'real' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      try { window.sessionStorage.clear(); } catch { /* מצב פרטי */ }
      window.location.reload();
    } catch (e) {
      setBusy(false);
      window.alert('החזרה לנתונים האמיתיים נכשלה. נסו שוב.');
    }
  };
  return (
    <button type="button" className="backup-mode-banner-exit" onClick={exit} disabled={busy}>
      {busy ? 'חוזר…' : 'חזרה לנתונים האמיתיים'}
    </button>
  );
}
