'use client';

import dynamic from 'next/dynamic';

// הדף נטען בנפרד (כמו ProfileSwitch / StockCheckSwitch): קובץ ה-CSS של הפלטה (~450KB) וקוד הדף נטענים רק בכניסה ל-/admin.
// אין בחירה "ישן / חדש": אין מתג עיצוב למסך הניהול, והמסך החדש מחליף את הישן בתוך אזור התוכן של כל מעטפת (ישנה או A5).
const AdminHubPage = dynamic(() => import('./AdminHubPage'), { ssr: false });

export default function AdminHubSwitch({ tools, categories, userKey }) {
  return <AdminHubPage tools={tools} categories={categories} userKey={userKey} />;
}
