// app/components/schedule/print/pages/ppStickers.js — עזר משותף לדפי המדבקות (04 מדבקות תיקון, 08 מדבקות שמלה).
//
// מדבקות אינן טבלה: רשת 3 עמודות על 6 שורות (60x39.6 מ"מ, מחלקות .pp-lab-grid / .pp-lab ב-print.css, כמו בעיצוב).
// עמוד מדבקות = גיליון (Sheet) אחד של המעטפת: כותרת צרה (registry slim:true) + 18 מדבקות + תחתית. בכוונה כל 18 מדבקות
// הן גיליון נפרד ולא רשת אחת ארוכה שהדפדפן חותך: כרום לא יודע לחתוך רשת שבתוך תא הגיליון (השורה האחרונה נופלת בהדפסה),
// ושורה של מדבקות גם לא אמורה להיחתך. גיליונות נפרדים עוברים עמוד בעזרת הכלל הקיים .pp-sheet+.pp-sheet של print.css.
//
// הערה: העטיפה היא <section> ולא <div> בכוונה - globals.css מגדיר `div:has(> table){max-height:75vh;overflow-y:auto}` לכל div שהילד הישיר
// שלו הוא טבלה, וזה חותך את הדף בהדפסה (השורה האחרונה של המדבקות נופלת). בכל תבנית: אין <div> שהילד הישיר שלו הוא <table>.
//
// העטיפה .pp-sticker-sheet מצמידה לגיליון את הדף הנקוב `pp-sticker` של המעטפת (print.css, @page pp-sticker: שוליים 8/9 מ"מ כמו
// הגיליון בעיצוב במקום 10/12) - כך 6 שורות x 39.6 מ"מ נכנסות בעמוד; מעבר העמוד בין גיליונות (רגיל/מדבקות בכל שילוב) גם הוא שם.
import { Sheet, EmptyBody } from '../PrintShell';
import { chunk } from '@/lib/schedule/print/repairItems';

/** מרנדר את גיליונות המדבקות. render(label) מחזיר את אלמנט המדבקה (עם key). */
export function StickerSheets({ meta, page, render }) {
  const d = page.data;
  if (d.empty) {
    return <section className="pp-sticker-sheet"><Sheet meta={meta} page={page}><EmptyBody /></Sheet></section>;
  }
  const groups = chunk(d.labels, d.perPage);
  return groups.map((group, gi) => (
    <section className="pp-sticker-sheet" key={gi}>
      <Sheet meta={meta} page={page} sheetIndex={gi + 1} sheetCount={groups.length}>
        <div className="pp-lab-grid">{group.map(render)}</div>
      </Sheet>
    </section>
  ));
}
