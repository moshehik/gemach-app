'use client';

// תיבת מייל (/admin/mailbox): עטיפה דקה - כל המסך (בעיצוב הפלטה החדש, ערכת a5-list) ב-app/components/mailbox/. השער: app/admin/layout.js (הנהלה ראשית) + /api/admin/mailbox (fail-closed).
import MailboxA5 from '@/app/components/mailbox/MailboxA5';

export default function MailboxPage() {
  return <MailboxA5 />;
}
