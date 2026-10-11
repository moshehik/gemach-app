'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyEmailLogsPage from '@/app/admin/site-settings/email-logs/LegacyEmailLogsPage';

// יומן שליחת המיילים (/admin/site-settings/email-logs): 'legacy' (ברירת מחדל לכולם חוץ מהמתכנת) = הדף הקודם כפי שהוא (LegacyEmailLogsPage.js = page.js של main 15dc7a0d,
// בייט-בבייט, עם אייקון המעבר לחדש בפינה - VariantFrame); 'a5' = היומן החדש על ערכת הרשימות. החדש נטען בנפרד (dynamic, בלי SSR): קובץ ה-CSS של הפלטה (~460KB)
// לא נטען כשהדגל 'legacy'. ההכרעה: useUiVariant('email_logs') - אותם קלטים כמו בשרת (app/layout.js). השער (מתכנת בלבד) נשאר ב-app/admin/site-settings/layout.js וב-API.
const EmailLogsA5 = dynamic(() => import('./EmailLogsA5'), { ssr: false });

export default function EmailLogsSwitch() {
  const variant = useUiVariant('email_logs');
  if (variant !== 'a5') return <VariantFrame screen="email_logs" variant="legacy"><LegacyEmailLogsPage /></VariantFrame>;
  return <VariantFrame screen="email_logs" variant="a5"><EmailLogsA5 /></VariantFrame>;
}
