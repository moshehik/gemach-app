'use client';

import dynamic from 'next/dynamic';

// הדף נטען בנפרד (כמו ProfileSwitch / StockCheckSwitch): קובץ ה-CSS של הפלטה (~450KB) וקוד הדף נטענים רק בכניסה ל-/admin.
// המסך החדש מתארח בתוך אזור התוכן של כל מעטפת (ישנה או A5). הבחירה "ישן / חדש" (4.10.2026) נעשית בשרת ב-app/admin/page.js.
const AdminHubPage = dynamic(() => import('./AdminHubPage'), { ssr: false });

export default function AdminHubSwitch({ tools, categories, userKey }) {
  return <AdminHubPage tools={tools} categories={categories} userKey={userKey} />;
}
