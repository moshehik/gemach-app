// שלד טעינה (J08, החלטת הבעלים): פסים אפורים מהבהבים במקום ספינר. מבנה מהעיצוב (לוז-יומי.html, שורה 2530):
// פס התקדמות + שלוש שורות (אייקון, שתי שורות טקסט, לחצן).
export default function ScheduleSkeleton() {
  return (
    <div className="card lz-st lz-sk" role="status" aria-busy="true" aria-label="הנתונים נטענים">
      <span className="sr-only">טוען את הלו״ז של היום...</span>
      <div className="skel sk-bar" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="li lrow">
          <span className="skel sk-ic" />
          <div className="t"><span className="skel sk-a" /><span className="skel sk-b" /></div>
          <span className="skel sk-btn" />
        </div>
      ))}
    </div>
  );
}
