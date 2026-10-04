// /board — "לוח חודשי". "ישן / חדש" (4.10.2026, lib/uiVariantScreens.js מסך 'board'): ההכרעה בשרת (getRequestUiVariant —
// עקיפה אישית > הגדרת ארגון ui_variant_board > ברירת מחדל לפי תפקיד: מתכנת חדש, כל השאר הלוח הישן; החלטת הבעלים F13).
// הישן: LegacyBoardPage.js (c944cb95:app/board/page.js כפי שהוא). VariantFrame מוסיף בישן את אייקון המעבר בפינה; בחדש האייקון
// בכותרת BoardPage.
// החדש: עיצוב מאושר תצוגות-עיצוב/סיימתי-לעבוד/לוח-חודשי.html + תשובות הבעלים (scratch/board-build/answers-board.json). הדף נטען
// בנפרד (dynamic) כדי שה-CSS הגדול של הפלטה לא ייכנס ל-bundle של שאר הדפים. הלוגיקה, ה-API וההחלטות: BoardPage.js (ההערה בראשו).
import BoardSwitch from '@/app/components/board/BoardSwitch';
import VariantFrame from '@/app/components/variant/VariantFrame';
import { getRequestUiVariant } from '@/app/lib/uiVariantServer';
import LegacyBoardPage from './LegacyBoardPage';

export default async function BoardRoute() {
  const variant = await getRequestUiVariant('board');
  return (
    <VariantFrame screen="board" variant={variant}>
      {variant === 'legacy' ? <LegacyBoardPage /> : <BoardSwitch />}
    </VariantFrame>
  );
}
