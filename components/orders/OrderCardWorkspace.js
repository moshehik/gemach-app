'use client';

import { useEffect, useRef } from 'react';

/**
 * פריסת "חלון אחד" לכרטיס ההזמנה — כל הנושאים זה לצד זה בגריד אחד,
 * במקום ערימה אנכית שדורשת גלילה בין נושא לנושא.
 *
 * הרכיבים עצמם (פרטים/פריטים/השכרות/תשלומים/היסטוריה) לא משתנים — העטיפה
 * מנטרלת את עיצוב הכרטיס הפנימי שלהם (רקע/מסגרת/צל/ריפוד), מחליפה אותו
 * בפאנל אחיד עם פס צבע לפי נושא, ודוחסת את הטיפוגרפיה והריווחים.
 */
export default function OrderCardWorkspace({ sections }) {
  const gridRef = useRef(null);

  // הגריד ממלא בדיוק את מה שנשאר מגובה החלון — בלי לנחש את גובה סרגל
  // הניווט או הכותרת (הם משתנים לפי מסך, מצב חוב ושבירת שורות).
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const update = () => {
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      if (el.dataset.ocwTop !== String(top)) {
        el.dataset.ocwTop = String(top);
        el.style.setProperty('--ocw-top', `${top}px`);
      }
    };

    update();
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (observer && el.parentElement) observer.observe(el.parentElement);

    return () => {
      window.removeEventListener('resize', update);
      if (observer) observer.disconnect();
    };
  }, []);

  return (
    <div className="ocw-grid" ref={gridRef}>
      <style>{`
        .ocw-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          /* שתי שורות שמתחלקות בגובה שנשאר במסך (‎--ocw-top נמדד בזמן ריצה).
             על מסך נמוך השורות לא יורדות מ-300px — עדיף שהעמוד יגלול מעט
             מאשר פאנלים בגובה שאי אפשר לעבוד בו. */
          grid-template-rows: repeat(2, minmax(300px, 1fr));
          gap: 0.7rem;
          height: calc(100vh - var(--ocw-top, 220px) - 20px);
        }

        .ocw-panel {
          position: relative;
          display: flex;
          flex-direction: column;
          background: var(--card-bg);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
          overflow: hidden;
          min-width: 0;
          min-height: 0;
          transition: box-shadow 0.25s ease;
        }
        .ocw-panel:hover { box-shadow: 0 8px 24px rgba(15, 23, 42, 0.09); }

        /* פס נושא עליון */
        .ocw-panel::before {
          content: '';
          position: absolute;
          top: 0; right: 0; left: 0;
          height: 3px;
          background: var(--ocw-accent);
          z-index: 6;
        }

        /* ניטרול עיצוב הכרטיס של הרכיב הפנימי — הפאנל הוא הכרטיס עכשיו,
           והתוכן גולל בתוכו. כל החלונות הקופצים כאן מרונדרים ל-document.body
           (createPortal) ולכן לא מושפעים מהגלילה הפנימית ולא מכללי הדחיסות. */
        .ocw-grid .ocw-panel > div {
          background: transparent !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          padding: 0.8rem 0.9rem !important;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .ocw-panel > div::-webkit-scrollbar { width: 7px; }
        .ocw-panel > div::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 8px;
        }
        .ocw-panel > div::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.55); }

        /* כותרת הנושא נשארת גלויה בזמן גלילה פנימית */
        .ocw-panel--details  > div > div:first-child,
        .ocw-panel--items    > div > div:first-child,
        .ocw-panel--rentals  > div > div:first-child,
        .ocw-panel--payments > div > div:first-child {
          position: sticky;
          /* קיזוז הריפוד של מיכל הגלילה, כדי שהכותרת תידבק לקצה העליון
             ולא תשאיר רצועה שדרכה נראה התוכן הנגלל */
          top: -0.8rem;
          z-index: 5;
          background: var(--card-bg);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        /* =========================================================
           דחיסות: הרכיבים בנויים עם עיצוב inline, ולכן ההקטנה נעשית
           כאן — סולם אחיד לכל גודל/ריווח שמופיע ב-style, בלי לגעת
           בקוד הרכיבים עצמם.
           ========================================================= */

        /* --- סולם טיפוגרפיה --- */
        .ocw-panel [style*="font-size: 1.5rem"] { font-size: 1rem !important; }
        .ocw-panel [style*="font-size: 1.4rem"] { font-size: 0.95rem !important; }
        .ocw-panel [style*="font-size: 1.3rem"] { font-size: 0.92rem !important; }
        .ocw-panel [style*="font-size: 1.2rem"] { font-size: 0.88rem !important; }
        .ocw-panel [style*="font-size: 1.1rem"] { font-size: 0.84rem !important; }
        .ocw-panel [style*="font-size: 1.05rem"] { font-size: 0.82rem !important; }
        .ocw-panel [style*="font-size: 1rem"] { font-size: 0.8rem !important; }
        .ocw-panel [style*="font-size: 0.95rem"] { font-size: 0.78rem !important; }
        .ocw-panel [style*="font-size: 0.9rem"] { font-size: 0.76rem !important; }
        .ocw-panel [style*="font-size: 0.85rem"] { font-size: 0.73rem !important; }

        .ocw-panel h2 { font-size: 0.95rem !important; }
        .ocw-panel h3 { font-size: 0.85rem !important; }
        .ocw-panel h4 { font-size: 0.8rem !important; }

        /* כותרת הפאנל בגוון הנושא */
        .ocw-panel > div > div:first-child h2 {
          font-size: 0.95rem !important;
          color: var(--ocw-accent) !important;
          letter-spacing: -0.01em;
        }

        /* --- טבלאות: שורות נמוכות וצפופות --- */
        .ocw-panel table { font-size: 0.76rem !important; }
        .ocw-panel :is(td, th) {
          padding: 0.25rem 0.4rem !important;
          font-size: 0.76rem !important;
          line-height: 1.25 !important;
        }
        .ocw-panel th { font-size: 0.7rem !important; letter-spacing: 0.01em; }

        /* --- שדות וכפתורים --- */
        .ocw-panel :is(input, select, textarea) {
          padding: 0.25rem 0.45rem !important;
          font-size: 0.78rem !important;
          border-radius: 7px !important;
        }
        .ocw-panel input[type="checkbox"] { padding: 0 !important; }
        .ocw-panel button {
          padding: 0.26rem 0.55rem !important;
          font-size: 0.76rem !important;
          border-radius: 7px !important;
        }
        .ocw-panel :is(button, td, th, h2, h3, h4) svg {
          width: 14px !important;
          height: 14px !important;
        }

        /* --- ריווחים פנימיים --- */
        .ocw-panel [style*="padding: 2.5rem"],
        .ocw-panel [style*="padding: 2rem"],
        .ocw-panel [style*="padding: 1.5rem"] { padding: 0.6rem !important; }
        .ocw-panel [style*="gap: 2rem"],
        .ocw-panel [style*="gap: 1.5rem"] { gap: 0.5rem !important; }
        .ocw-panel [style*="gap: 1rem"] { gap: 0.45rem !important; }
        .ocw-panel [style*="gap: 0.8rem"] { gap: 0.4rem !important; }
        .ocw-panel [style*="margin-bottom: 2rem"],
        .ocw-panel [style*="margin-bottom: 1.5rem"] { margin-bottom: 0.5rem !important; }
        .ocw-panel [style*="margin-top: 1.5rem"] { margin-top: 0.5rem !important; }
        .ocw-panel [style*="margin-bottom: 1rem"] { margin-bottom: 0.4rem !important; }

        .ocw-panel--details  { --ocw-accent: #3b82f6; }
        .ocw-panel--items    { --ocw-accent: #8b5cf6; }
        .ocw-panel--rentals  { --ocw-accent: #10b981; }
        .ocw-panel--payments { --ocw-accent: #f59e0b; }
        .ocw-panel--history  { --ocw-accent: #64748b; }

        /* מסכים בינוניים — שתי עמודות שוות (טבלת הפריטים ברוחב מלא).
           כאן כבר לא נכנס הכל למסך אחד, ולכן העמוד חוזר לגלילה רגילה
           והפאנלים מקבלים גובה נדיב יותר. */
        @media (max-width: 1450px) {
          .ocw-grid {
            height: auto;
            min-height: 0;
            grid-template-rows: none;
            /* dense: טבלת הפריטים תופסת שורה שלמה, והנושא שאחריה ממלא את
               החלל שנשאר לידה במקום להשאיר חור בפריסה */
            grid-auto-flow: row dense;
          }
          .ocw-panel { grid-column: span 6 !important; }
          .ocw-panel--items { grid-column: span 12 !important; }
          .ocw-grid .ocw-panel > div { flex: none; max-height: calc(100vh - 160px); }
        }
        /* מסכים צרים — עמודה אחת */
        @media (max-width: 900px) {
          .ocw-panel { grid-column: span 12 !important; }
        }
      `}</style>

      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          /* בלי animate-fade-in: האנימציה משאירה transform קבוע, וכל אלמנט
             position:fixed שאינו מרונדר ב-portal היה נכלא בתוך הפאנל */
          className={`ocw-panel ocw-panel--${section.id}`}
          style={{ gridColumn: `span ${section.span}` }}
        >
          {section.node}
        </section>
      ))}
    </div>
  );
}
