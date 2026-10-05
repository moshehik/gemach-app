'use client';

import dynamic from 'next/dynamic';

// הלוח החדש נטען בנפרד (כמו ProfileSwitch): ה-CSS הגדול של הפלטה (~450KB), schedule.css וקוד הדף החדש לא נכנסים ל-bundle של
// שאר הדפים. הבחירה "ישן / חדש" נעשית בשרת (app/board/page.js, getRequestUiVariant('board')): הישן = app/board/LegacyBoardPage.js.
const BoardPage = dynamic(() => import('./BoardPage'), { ssr: false });

export default function BoardSwitch() {
  return <BoardPage />;
}
