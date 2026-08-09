const Badge = ({ children }) => (
  <span className="badge badge-neutral">{children}</span>
);

export const metadata = { title: 'מדיניות זיכויים וביטולים' };

export default function RefundPolicyPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>מדיניות זיכויים וביטולים</h1>
          <p className="page-desc">תיעוד מלא של מה שהמערכת בפועל מחשבת כשמבטלים פריט מהזמנה — כדי שהצוות והמתכנת יהיו מסונכרנים על אותה מדיניות.</p>
        </div>
      </div>

      <div className="content-page">
        <div className="content-updated">
          עודכן לאחרונה: 04.08.2026 · המקור הטכני: <Badge>lib/pricingEngine.js</Badge> (פונקציית <Badge>computeOrderObligations</Badge>)
        </div>

        <div className="content-toc">
          <h4>בעמוד זה</h4>
          <a href="#arp-basic">הרעיון הבסיסי</a>
          <a href="#arp-windows">שלושת חלונות הזמן</a>
          <a href="#arp-repairs">עלויות תיקונים (צוואר / שרוול / אורך)</a>
          <a href="#arp-replacement">זיכוי דמי ביטול על פריט חלופי באותה הזמנה</a>
          <a href="#arp-immediate">ביטול מיידי — פריט שנוסף ובוטל תוך זמן קצר</a>
          <a href="#arp-changelog">יומן שינויים</a>
        </div>

        <h2 id="arp-basic">הרעיון הבסיסי</h2>
        <p>
          הזיכוי מחושב <strong>בנפרד לכל פריט</strong>, ברגע שהפריט מבוטל/נמחק מהזמנה (ולא לפי סך ההזמנה כולה).
          לכל פריט שמבוטל יש שלוש שורות תנועה בכרטיס ההזמנה: חיוב מקורי, זיכוי מלא בגין הביטול, ולאחר מכן חיוב חדש
          של &quot;דמי ביטול&quot; שמשקף כמה בפועל נשאר לשלם. כל ההגדרות הרלוונטיות נמצאות תחת{' '}
          <a href="/admin/settings" style={{ color: 'var(--primary-solid)', fontWeight: 700 }}>הגדרות מערכת → קטגוריית &quot;תשלומים&quot;</a>.
        </p>

        <h2 id="arp-windows">שלושת חלונות הזמן</h2>
        <p>
          הכלל נקבע לפי שני תאריכים בלבד: <strong>תאריך ביצוע ההזמנה</strong> (מתי ההזמנה נוצרה בפועל — לא תאריך
          האירוע) ו<strong>תאריך האירוע</strong>. לתאריך ביצוע ההזמנה יש עריכה ידנית המוגבלת למתכנת בלבד (למטרות
          בדיקה), כי שינוי שלו משפיע ישירות על חישוב הזיכוי.
        </p>

        <div className="table-wrap" style={{ marginBottom: '14px' }}>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>חלון</th>
                  <th>מתי</th>
                  <th>מה מוחזר</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell-primary">1. החזר מלא</td>
                  <td>עד <Badge>REFUND_DAYS_FROM_ORDER</Badge> ימים <em>מתאריך ביצוע ההזמנה</em></td>
                  <td>100% משווי הפריט (ללא תיקונים — ר&apos;&nbsp;למטה)</td>
                </tr>
                <tr>
                  <td className="cell-primary">2. אזור אמצעי</td>
                  <td>בין שני החלונות</td>
                  <td>
                    אם לקטגוריית המחיר מוגדר <strong>פיקדון</strong> (שדה &quot;פיקדון&quot; במחירון) — מוחזר סכום קבוע זה בש&quot;ח.
                    אחרת מוחזר לפי <Badge>REFUND_PERCENTAGE</Badge> אחוזים משווי הפריט.
                  </td>
                </tr>
                <tr>
                  <td className="cell-primary">3. ללא החזר</td>
                  <td>פחות מ-<Badge>NO_REFUND_DAYS_BEFORE_EVENT</Badge> ימים <em>לפני תאריך האירוע</em></td>
                  <td>0% — כל שווי הפריט נזקף כדמי ביטול</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="callout callout-info">
          <svg className="icon"><use href="#i-info" /></svg>
          <span>
            <strong>סדר עדיפות:</strong> קרבה לאירוע תמיד גוברת. אם ההזמנה עצמה נוצרה פחות מ-<Badge>NO_REFUND_DAYS_BEFORE_EVENT</Badge> ימים לפני
            האירוע, אין החזר מלא גם אם הביטול קרה מיד לאחר ביצוע ההזמנה.
          </span>
        </div>

        <h2 id="arp-repairs">עלויות תיקונים (צוואר / שרוול / אורך)</h2>
        <p>
          כלל קבוע, ללא קשר לחלון הזמן: אם <Badge>REFUND_REPAIRS</Badge> כבוי (ברירת המחדל) — עלות תיקונים{' '}
          <strong>לעולם לא מוחזרת</strong>. היא נזקפת כדמי ביטול גם אם הפריט עצמו זוכה במלואו בחלון ההחזר המלא.
        </p>

        <h2 id="arp-replacement">זיכוי דמי ביטול על פריט חלופי באותה הזמנה</h2>
        <p>
          אם באותה הזמנה מבוטל פריט וגם נוסף פריט אחר (חדש, לא זה שבוטל), דמי הביטול שהיו אמורים ללכת לאיבוד
          מנוצלים כזיכוי על הפריט החדש — במקום לרדת לטמיון — בתנאי ששניהם מתקיימים:
        </p>
        <ul>
          <li>הפריט החדש נוסף <strong>אחרי</strong> מועד הביטול בפועל.</li>
          <li>הביטול עדיין בתוך <Badge>CANCELLATION_CREDIT_MINUTES</Badge> דקות (ברירת מחדל: 15) מרגע השמירה בפועל של
            הביטול — לא מרגע הסימון על המסך. לכן עריכה ארוכה שנשמרת רק בסוף עדיין נחשבת תקינה.</li>
        </ul>
        <p>
          אם אין פריט חלופי זמין (או שנגמרה ה&quot;קיבולת&quot; שלו) — דמי הביטול נגבים כרגיל.
          בכרטיס ההזמנה זה מופיע כשורת &quot;דמי ביטול ותיקונים&quot; (מלאה) ולצידה שורת &quot;זיכוי דמי ביטול
          (מומש על פריט חדש)&quot; שלילית שמראה את הניצול בפועל. <strong>רק החלק שיוחס לשווי השמלה
          (<Badge>C</Badge>) ניתן לניצול כך — עלות תיקונים לעולם לא, גם אם יש פריט חלופי זמין (ר&apos; סעיף קודם).</strong>
        </p>

        <h2 id="arp-immediate">ביטול מיידי — פריט שנוסף ובוטל תוך זמן קצר</h2>
        <p>
          אם פריט <strong>נוסף וגם בוטל</strong> — שניהם, מהוספה ועד מחיקה — בתוך חלון <Badge>CANCELLATION_CREDIT_MINUTES</Badge> דקות
          (ברירת מחדל: 15), הוא נחשב כאילו מעולם לא נוסף להזמנה: אין חיוב מקורי, אין זיכוי ואין דמי ביטול כלל,
          ללא קשר לשלושת חלונות הזמן הרגילים למעלה. זה שונה מ&quot;זיכוי על פריט חלופי&quot; (הסעיף הקודם) —
          שם מדובר בשני פריטים שונים (אחד בוטל, אחר נוסף במקומו); כאן מדובר <strong>באותו פריט עצמו</strong>
          שנוסף ובוטל מהר מדי כדי להיחשב שימוש אמיתי.
        </p>

        <h2 id="arp-changelog">יומן שינויים</h2>
        <ul>
          <li>04.08.2026 — <Badge>REFUND_PERCENTAGE</Badge> שונה מ-100% ל-50%, אחרי שהזמנה 26121 קיבלה בטעות החזר
            מלא באזור האמצעי (כי לא היה פיקדון מוגדר לקטגוריה, וה-100% הכללי היה שקול להחזר מלא).</li>
          <li>
            04.08.2026 — <strong>תוקן:</strong> מנגנון הזיכוי-על-פריט-חלופי היה מחזיר גם עלויות תיקונים
            (<Badge>feeAmount = C + itemLost</Badge> נוצל במלואו כזיכוי, במקום רק <Badge>C</Badge>). נצפה בהזמנה
            26122 — פריט עם תיקון צוואר (₪15) קיבל זיכוי מלא של ₪60 כולל התיקון. תוקן כך ש-<Badge>itemLost</Badge> תמיד
            נשאר חיוב קבוע ללקוח.
          </li>
          <li>
            04.08.2026 — <strong>נוסף:</strong> כלל &quot;ביטול מיידי&quot; (ר&apos; סעיף למעלה) — פריט שנוסף
            ובוטל תוך <Badge>CANCELLATION_CREDIT_MINUTES</Badge> דקות מבוטל לגמרי ללא שום חיוב. לפני התיקון הזה,
            גם ביטול מהיר של פריט עבר דרך שלושת החלונות הרגילים ולרוב לא זיכה במלואו.
          </li>
        </ul>
      </div>
    </>
  );
}
