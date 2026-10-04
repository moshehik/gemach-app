'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';

// /board מאחורי המתג "ישן / חדש" (BD-O1, תשובות הבעלים 4.10.2026): ברירת המחדל לכולם = הלוח הישן, זהה בייט-לבייט לדף שהיה
// ב-main (app/board/LegacyBoardPage.js). הלוח החדש (BoardPage) מוצג רק כשהדגל 'a5' של המסך 'board' דלוק (עקיפה אישית,
// או ui_variant_board של הארגון). שני הדפים נטענים בנפרד (dynamic): ה-CSS הגדול של הפלטה (~450KB), schedule.css וקוד
// הדף החדש לא נטענים בכלל כשהדגל 'legacy'.
const BoardPage = dynamic(() => import('./BoardPage'), { ssr: false });
const LegacyBoardPage = dynamic(() => import('@/app/board/LegacyBoardPage'), { ssr: false });

export default function BoardSwitch() {
  const variant = useUiVariant('board');
  return variant === 'a5' ? <BoardPage /> : <LegacyBoardPage />;
}
