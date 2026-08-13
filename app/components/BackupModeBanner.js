// Server component — no interactivity needed, the blink is pure CSS. Rendered
// unconditionally from app/layout.js (even on the login screen) whenever the
// SystemSetting 'web_backup_mode' flag is on, so nobody using the live site
// mistakes backup/test data for the real thing. See app/lib/prisma.js for how
// the flag is read/written.
export default function BackupModeBanner({ active }) {
  if (!active) return null;

  return (
    <div className="backup-mode-banner" role="alert">
      <svg className="icon" style={{ width: '15px', height: '15px' }}><use href="#i-alert-tri" /></svg>
      המערכת פועלת כרגע במצב גיבוי (Test) — הנתונים המוצגים והנשמרים כאן אינם הנתונים האמיתיים
    </div>
  );
}
