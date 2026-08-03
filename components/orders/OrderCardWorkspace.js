'use client';

/**
 * פריסת "חלון אחד" לכרטיס ההזמנה — כל הנושאים זה לצד זה בגריד אחד,
 * במקום ערימה אנכית שדורשת גלילה בין נושא לנושא.
 *
 * הרכיבים עצמם (פרטים/פריטים/השכרות/תשלומים/היסטוריה) לא משתנים — העטיפה
 * מנטרלת את עיצוב הכרטיס הפנימי שלהם (רקע/מסגרת/צל/ריפוד) ומחליפה אותו
 * בעיצוב פאנל אחיד עם פס צבע לפי נושא.
 */
export default function OrderCardWorkspace({ sections }) {
  return (
    <div className="ocw-grid">
      <style>{`
        .ocw-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 1.1rem;
          align-items: start;
        }

        .ocw-panel {
          position: relative;
          background: var(--card-bg);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 18px;
          box-shadow: 0 6px 24px rgba(15, 23, 42, 0.05);
          overflow: hidden;
          min-width: 0;
          transition: box-shadow 0.25s ease, transform 0.25s ease;
        }
        .ocw-panel:hover {
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.09);
        }
        /* פס נושא עליון */
        .ocw-panel::before {
          content: '';
          position: absolute;
          top: 0; right: 0; left: 0;
          height: 3px;
          background: var(--ocw-accent);
        }
        /* ניטרול עיצוב הכרטיס של הרכיב הפנימי — הפאנל הוא הכרטיס עכשיו.
           גובה מוגבל + גלילה פנימית, כדי שנושא ארוך (למשל היסטוריה) לא ימתח
           את כל העמוד ויבטל את הרעיון של "הכל בחלון אחד".
           החלונות הקופצים בפנים הם position:fixed ולכן לא נחתכים ע"י הגלילה. */
        .ocw-panel > div {
          background: transparent !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          padding: 1.3rem 1.45rem !important;
          max-height: calc(100vh - 190px);
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .ocw-panel > div::-webkit-scrollbar { width: 8px; }
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
          /* קיזוז הריפוד של מיכל הגלילה, כדי שהכותרת תידבק בדיוק לקצה העליון
             ולא תשאיר רצועה שדרכה נראה התוכן הנגלל */
          top: -1.3rem;
          z-index: 5;
          background: var(--card-bg);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        /* כותרת קומפקטית בגוון הנושא (רק כותרת הפאנל, לא כותרות פנימיות) */
        .ocw-panel > div > div:first-child h2 {
          font-size: 1.15rem !important;
          color: var(--ocw-accent) !important;
        }

        .ocw-panel--details  { --ocw-accent: #3b82f6; }
        .ocw-panel--items    { --ocw-accent: #8b5cf6; }
        .ocw-panel--rentals  { --ocw-accent: #10b981; }
        .ocw-panel--payments { --ocw-accent: #f59e0b; }
        .ocw-panel--history  { --ocw-accent: #64748b; }

        /* מסכים בינוניים — שתי עמודות שוות, למעט טבלת הפריטים הרחבה */
        @media (max-width: 1250px) {
          .ocw-panel { grid-column: span 6 !important; }
          .ocw-panel--items { grid-column: span 12 !important; }
        }
        /* מסכים צרים — עמודה אחת */
        @media (max-width: 900px) {
          .ocw-panel { grid-column: span 12 !important; }
          .ocw-panel > div { padding: 1.1rem !important; }
          .ocw-panel--details  > div > div:first-child,
          .ocw-panel--items    > div > div:first-child,
          .ocw-panel--rentals  > div > div:first-child,
          .ocw-panel--payments > div > div:first-child { top: -1.1rem; }
        }
      `}</style>

      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className={`ocw-panel ocw-panel--${section.id} animate-fade-in`}
          style={{ gridColumn: `span ${section.span}` }}
        >
          {section.node}
        </section>
      ))}
    </div>
  );
}
