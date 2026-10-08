import DeviceBackupExitButton from './DeviceBackupExitButton';

// Server component — no interactivity needed for the blink, it is pure CSS. Rendered unconditionally
// from app/layout.js (even on the login screen) whenever the database this request talks to is the
// backup one, so nobody mistakes backup/test data for the real thing. Two sources:
//  - `active`: the site-wide SystemSetting 'web_backup_mode' flag (everyone is on backup);
//  - `device`: only THIS computer is on backup (signed cookie, lib/deviceDbView.js) - other computers
//    keep the real data, so the banner says so and offers a way back.
// See app/lib/prisma.js for how the flag / cookie are read.
export default function BackupModeBanner({ active, device }) {
  if (!active && !device) return null;

  return (
    <div className="backup-mode-banner" role="alert">
      <svg className="icon" style={{ width: '15px', height: '15px' }}><use href="#i-alert-tri" /></svg>
      {device
        ? 'המחשב הזה במצב גיבוי — הנתונים כאן אינם האמיתיים (במחשבים האחרים מוצגים הנתונים האמיתיים)'
        : 'המערכת פועלת כרגע במצב גיבוי (Test) — הנתונים המוצגים והנשמרים כאן אינם הנתונים האמיתיים'}
      {device ? <DeviceBackupExitButton /> : null}
    </div>
  );
}
