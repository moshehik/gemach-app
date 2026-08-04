const Section = ({ title, children, id }) => (
  <section id={id} style={{ marginBottom: '2.5rem' }}>
    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.9rem', borderBottom: '2px solid var(--border-color, #e2e8f0)', paddingBottom: '0.5rem' }}>
      {title}
    </h2>
    {children}
  </section>
);

const Callout = ({ tone = 'info', title, children }) => {
  const tones = {
    info: { bg: '#eff6ff15', border: '#3b82f6', text: '#3b82f6' },
    warn: { bg: '#f59e0b15', border: '#f59e0b', text: '#b45309' },
    danger: { bg: '#ef444415', border: '#ef4444', text: '#b91c1c' },
    ok: { bg: '#10b98115', border: '#10b981', text: '#047857' }
  };
  const t = tones[tone];
  return (
    <div style={{ background: t.bg, borderRight: `4px solid ${t.border}`, borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
      {title && <div style={{ fontWeight: 800, color: t.text, marginBottom: '0.35rem' }}>{title}</div>}
      <div style={{ color: 'var(--foreground)', lineHeight: 1.7, fontSize: '0.95rem' }}>{children}</div>
    </div>
  );
};

const Code = ({ children }) => (
  <code style={{ background: 'var(--element-bg, #f1f5f9)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.88em', direction: 'ltr', display: 'inline-block' }}>
    {children}
  </code>
);

export const metadata = { title: 'מדיניות זיכויים וביטולים' };

export default function RefundPolicyPage() {
  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2.5rem', paddingBottom: '4rem', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.4rem' }}>
          מדיניות זיכויים וביטולים
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>
          תיעוד מלא של מה שהמערכת בפועל מחשבת כשמבטלים פריט מהזמנה — כדי שהצוות והמתכנת יהיו מסונכרנים
          על אותה מדיניות.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          עודכן לאחרונה: 04.08.2026 · המקור הטכני: <Code>lib/pricingEngine.js</Code> (פונקציית <Code>computeOrderObligations</Code>)
        </p>
      </div>

      <Section title="הרעיון הבסיסי">
        <p style={{ lineHeight: 1.8 }}>
          הזיכוי מחושב <strong>בנפרד לכל פריט</strong>, ברגע שהפריט מבוטל/נמחק מהזמנה (ולא לפי סך ההזמנה כולה).
          לכל פריט שמבוטל יש שלוש שורות תנועה בכרטיס ההזמנה: חיוב מקורי, זיכוי מלא בגין הביטול, ולאחר מכן חיוב חדש
          של "דמי ביטול" שמשקף כמה בפועל נשאר לשלם. כל ההגדרות הרלוונטיות נמצאות תחת{' '}
          <a href="/admin/settings" style={{ color: 'var(--primary-color)', fontWeight: 700 }}>הגדרות מערכת → קטגוריית &quot;תשלומים&quot;</a>.
        </p>
      </Section>

      <Section title="שלושת חלונות הזמן">
        <p style={{ lineHeight: 1.8, marginBottom: '1rem' }}>
          הכלל נקבע לפי שני תאריכים בלבד: <strong>תאריך ביצוע ההזמנה</strong> (מתי ההזמנה נוצרה בפועל — לא תאריך
          האירוע) ו<strong>תאריך האירוע</strong>. לתאריך ביצוע ההזמנה יש עריכה ידנית המוגבלת למתכנת בלבד (למטרות
          בדיקה), כי שינוי שלו משפיע ישירות על חישוב הזיכוי.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>חלון</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>מתי</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>מה מוחזר</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>1. החזר מלא</td>
              <td style={{ padding: '0.6rem 0.5rem' }}>עד <Code>REFUND_DAYS_FROM_ORDER</Code> ימים <em>מתאריך ביצוע ההזמנה</em></td>
              <td style={{ padding: '0.6rem 0.5rem' }}>100% משווי הפריט (ללא תיקונים — ר&apos;&nbsp;למטה)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>2. אזור אמצעי</td>
              <td style={{ padding: '0.6rem 0.5rem' }}>בין שני החלונות</td>
              <td style={{ padding: '0.6rem 0.5rem' }}>
                אם לקטגוריית המחיר מוגדר <strong>פיקדון</strong> (שדה &quot;פיקדון&quot; במחירון) — מוחזר סכום קבוע זה בש&quot;ח.
                אחרת מוחזר לפי <Code>REFUND_PERCENTAGE</Code> אחוזים משווי הפריט.
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>3. ללא החזר</td>
              <td style={{ padding: '0.6rem 0.5rem' }}>פחות מ-<Code>NO_REFUND_DAYS_BEFORE_EVENT</Code> ימים <em>לפני תאריך האירוע</em></td>
              <td style={{ padding: '0.6rem 0.5rem' }}>0% — כל שווי הפריט נזקף כדמי ביטול</td>
            </tr>
          </tbody>
        </table>
        <Callout tone="info" title="סדר עדיפות">
          קרבה לאירוע תמיד גוברת. אם ההזמנה עצמה נוצרה פחות מ-<Code>NO_REFUND_DAYS_BEFORE_EVENT</Code> ימים לפני
          האירוע, אין החזר מלא גם אם הביטול קרה מיד לאחר ביצוע ההזמנה.
        </Callout>
      </Section>

      <Section title="עלויות תיקונים (צוואר / שרוול / אורך)">
        <p style={{ lineHeight: 1.8 }}>
          כלל קבוע, ללא קשר לחלון הזמן: אם <Code>REFUND_REPAIRS</Code> כבוי (ברירת המחדל) — עלות תיקונים{' '}
          <strong>לעולם לא מוחזרת</strong>. היא נזקפת כדמי ביטול גם אם הפריט עצמו זוכה במלואו בחלון ההחזר המלא.
        </p>
      </Section>

      <Section title="זיכוי דמי ביטול על פריט חלופי באותה הזמנה">
        <p style={{ lineHeight: 1.8, marginBottom: '0.75rem' }}>
          אם באותה הזמנה מבוטל פריט וגם נוסף פריט אחר (חדש, לא זה שבוטל), דמי הביטול שהיו אמורים ללכת לאיבוד
          מנוצלים כזיכוי על הפריט החדש — במקום לרדת לטמיון — בתנאי ששניהם מתקיימים:
        </p>
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem' }}>
          <li>הפריט החדש נוסף <strong>אחרי</strong> מועד הביטול בפועל.</li>
          <li>הביטול עדיין בתוך <Code>CANCELLATION_CREDIT_MINUTES</Code> דקות (ברירת מחדל: 15) מרגע השמירה בפועל של
            הביטול — לא מרגע הסימון על המסך. לכן עריכה ארוכה שנשמרת רק בסוף עדיין נחשבת תקינה.</li>
        </ul>
        <p style={{ lineHeight: 1.8, marginTop: '0.75rem' }}>
          אם אין פריט חלופי זמין (או שנגמרה ה&quot;קיבולת&quot; שלו) — דמי הביטול נגבים כרגיל.
          בכרטיס ההזמנה זה מופיע כשורת &quot;דמי ביטול ותיקונים&quot; (מלאה) ולצידה שורת &quot;זיכוי דמי ביטול
          (מומש על פריט חדש)&quot; שלילית שמראה את הניצול בפועל. <strong>רק החלק שיוחס לשווי השמלה
          (<Code>C</Code>) ניתן לניצול כך — עלות תיקונים לעולם לא, גם אם יש פריט חלופי זמין (ר&apos; סעיף קודם).</strong>
        </p>
      </Section>

      <Section title="ביטול מיידי — פריט שנוסף ובוטל תוך זמן קצר">
        <p style={{ lineHeight: 1.8 }}>
          אם פריט <strong>נוסף וגם בוטל</strong> — שניהם, מהוספה ועד מחיקה — בתוך חלון <Code>CANCELLATION_CREDIT_MINUTES</Code> דקות
          (ברירת מחדל: 15), הוא נחשב כאילו מעולם לא נוסף להזמנה: אין חיוב מקורי, אין זיכוי ואין דמי ביטול כלל,
          ללא קשר לשלושת חלונות הזמן הרגילים למעלה. זה שונה מ&quot;זיכוי על פריט חלופי&quot; (הסעיף הקודם) —
          שם מדובר בשני פריטים שונים (אחד בוטל, אחר נוסף במקומו); כאן מדובר <strong>באותו פריט עצמו</strong>
          שנוסף ובוטל מהר מדי כדי להיחשב שימוש אמיתי.
        </p>
      </Section>

      <Section title="יומן שינויים">
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem', fontSize: '0.92rem' }}>
          <li>04.08.2026 — <Code>REFUND_PERCENTAGE</Code> שונה מ-100% ל-50%, אחרי שהזמנה 26121 קיבלה בטעות החזר
            מלא באזור האמצעי (כי לא היה פיקדון מוגדר לקטגוריה, וה-100% הכללי היה שקול להחזר מלא).</li>
          <li>
            04.08.2026 — <strong>תוקן:</strong> מנגנון הזיכוי-על-פריט-חלופי היה מחזיר גם עלויות תיקונים
            (<Code>feeAmount = C + itemLost</Code> נוצל במלואו כזיכוי, במקום רק <Code>C</Code>). נצפה בהזמנה
            26122 — פריט עם תיקון צוואר (₪15) קיבל זיכוי מלא של ₪60 כולל התיקון. תוקן כך ש-<Code>itemLost</Code> תמיד
            נשאר חיוב קבוע ללקוח.
          </li>
          <li>
            04.08.2026 — <strong>נוסף:</strong> כלל &quot;ביטול מיידי&quot; (ר&apos; סעיף למעלה) — פריט שנוסף
            ובוטל תוך <Code>CANCELLATION_CREDIT_MINUTES</Code> דקות מבוטל לגמרי ללא שום חיוב. לפני התיקון הזה,
            גם ביטול מהיר של פריט עבר דרך שלושת החלונות הרגילים ולרוב לא זיכה במלואו.
          </li>
        </ul>
      </Section>
    </div>
  );
}
