// מרכז הודעות (/messages): עטיפה דקה שבוחרת בין הדף הישן (LegacyMessagesPage.js - הועבר 1:1 מהקובץ הזה) למרכז ההודעות החדש
// (app/components/messages/MessagesA5.js) לפי הדגל ui_variant_messages. השער (הרשאת page:messages + כיבוי ההודעות הפנימיות) נשאר ב-app/messages/layout.js.
import MessagesSwitch from '@/app/components/messages/MessagesSwitch';

export default function MessagesPage() {
  return <MessagesSwitch />;
}
