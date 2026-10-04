// /board — "לוח חודשי" בעיצוב החדש (עיצוב מאושר: תצוגות-עיצוב/סיימתי-לעבוד/לוח-חודשי.html, תשובות הבעלים 4.10.2026 -
// scratch/board-build/answers-board.json). הדף נטען בנפרד (dynamic) כדי שה-CSS הגדול של הפלטה לא ייכנס ל-bundle של שאר
// הדפים. הלוגיקה, ה-API וההחלטות: app/components/board/BoardPage.js (ההערה בראש הקובץ).
import BoardSwitch from '@/app/components/board/BoardSwitch';

export default function BoardRoute() {
  return <BoardSwitch />;
}
