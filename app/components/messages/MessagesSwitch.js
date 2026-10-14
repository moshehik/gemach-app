'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyMessagesPage from '@/app/messages/LegacyMessagesPage';

// מרכז הודעות (/messages): 'legacy' (ברירת מחדל לכולם חוץ מהמתכנת) = הדף הקודם כפי שהוא (LegacyMessagesPage.js = page.js של main d0bc85d9, בייט-בבייט,
// עם אייקון המעבר לחדש בפינה - VariantFrame); 'a5' = המרכז החדש (MessagesA5). החדש נטען בנפרד (dynamic, בלי SSR): קובץ ה-CSS של הפלטה (~460KB) לא נטען כשהדגל 'legacy'.
// ההכרעה: useUiVariant('messages'). השער נשאר ב-app/messages/layout.js.
const MessagesA5 = dynamic(() => import('./MessagesA5'), { ssr: false });

export default function MessagesSwitch() {
  const variant = useUiVariant('messages');
  if (variant !== 'a5') return <VariantFrame screen="messages" variant="legacy"><LegacyMessagesPage /></VariantFrame>;
  return <VariantFrame screen="messages" variant="a5"><MessagesA5 /></VariantFrame>;
}
