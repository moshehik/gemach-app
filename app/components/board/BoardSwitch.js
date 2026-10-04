'use client';

import dynamic from 'next/dynamic';

// הדף נטען בנפרד (כמו ProfileSwitch / StockCheckSwitch): קובץ ה-CSS של הפלטה (~450KB), schedule.css וקוד הדף נטענים רק
// בכניסה ל-/board. אין כאן בחירה "ישן / A5": הלוח החדש מחליף את הישן ומתארח בתוך אזור התוכן של כל מעטפת.
const BoardPage = dynamic(() => import('./BoardPage'), { ssr: false });

export default function BoardSwitch() {
  return <BoardPage />;
}
