// יומן שליחת המיילים (/admin/site-settings/email-logs, מתכנת בלבד): עטיפה דקה שבוחרת בין הדף הישן (LegacyEmailLogsPage.js - הועבר 1:1 מהקובץ הזה)
// ליומן החדש (app/components/email-logs/*) לפי הדגל ui_variant_email_logs (useUiVariant('email_logs')). ברירת מחדל: מתכנת חדש, כל השאר ישן. השער: layout.js של הגדרות האתר + ה-API.
'use client';

import EmailLogsSwitch from '@/app/components/email-logs/EmailLogsSwitch';

export default function EmailLogsPage() {
  return <EmailLogsSwitch />;
}
