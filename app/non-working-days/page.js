// /non-working-days - הדף "ימי אי-פעילות" (עיצוב מאושר: תצוגות-עיצוב/סיימתי-לעבוד/ימי-אי-פעילות.html, רכיבי פלטה בלבד).
// דף חדש בלי גרסה ישנה, ולכן בלי מתג "ישן / חדש" (כמו /stock-check). נטען בנפרד (dynamic) כדי שקובץ ה-CSS של הפלטה
// (design-system/components.css) לא ייכנס ל-bundle של שאר הדפים. הלוגיקה המשותפת לשני הגמ"חים; הערכים - לכל גמ"ח ב-DB שלו.
import NonWorkingDaysSwitch from '@/app/components/nonWorkingDays/NonWorkingDaysSwitch';

export const metadata = { title: 'ימי אי-פעילות' };

export default function NonWorkingDaysRoute() {
  return <NonWorkingDaysSwitch />;
}
