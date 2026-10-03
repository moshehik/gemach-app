'use client';

import dynamic from 'next/dynamic';

// הדף נטען בנפרד (כמו StockCheckSwitch / HomeSwitch): קובץ ה-CSS של הפלטה (~450KB) וקוד הדף נטענים רק בכניסה ל-/profile.
// אין כאן בחירה "ישן / A5": הדף החדש מתארח בתוך אזור התוכן של כל מעטפת (ישנה או A5), כמו /stock-check.
const ProfilePage = dynamic(() => import('./ProfilePage'), { ssr: false });

export default function ProfileSwitch() {
  return <ProfilePage />;
}
