// /stock-check — דף "בדיקת מלאי" (עיצוב מאושר: תצוגות-עיצוב/סיימתי-לעבוד/בדיקת-מלאי.html, רכיבי פלטה בלבד).
// דף חדש בלי גרסה ישנה, ולכן אין כאן מתג "ישן / A5": הדף נטען בנפרד (dynamic) כדי שקובץ ה-CSS הגדול של
// הפלטה (design-system/components.css) לא ייכנס ל-bundle של שאר הדפים.
import StockCheckSwitch from '@/app/components/stock/StockCheckSwitch';

export const metadata = { title: 'בדיקת מלאי' };

export default function StockCheckRoute() {
  return <StockCheckSwitch />;
}
