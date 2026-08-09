import AuditReportsPanel from './AuditReportsPanel';

const Section = ({ title, children, id }) => (
  <section id={id} style={{ marginBottom: '32px' }}>
    <h2>{title}</h2>
    {children}
  </section>
);

const CALLOUT_META = {
  info: { className: 'callout-info', icon: 'i-info' },
  warn: { className: 'callout-warning', icon: 'i-alert-tri' },
  danger: { className: 'callout-danger', icon: 'i-x-circle' },
  ok: { className: 'callout-success', icon: 'i-check-circle' }
};

const Callout = ({ tone = 'info', title, children }) => {
  const meta = CALLOUT_META[tone];
  return (
    <div className={`callout ${meta.className}`}>
      <svg className="icon"><use href={`#${meta.icon}`} /></svg>
      <span>
        {title && <strong style={{ display: 'block', color: 'var(--text)', marginBottom: '2px' }}>{title}</strong>}
        {children}
      </span>
    </div>
  );
};

const Code = ({ children }) => (
  <code>{children}</code>
);

const agents = [
  { slug: 'audit-bugs', label: 'באגים בקוד', desc: 'שגיאות לוגיות בקוד — חישובים, תנאים הפוכים, טיפול שגוי בתאריכים/סטטוסים.' },
  { slug: 'audit-code-quality', label: 'איכות קוד', desc: 'כפילויות, קוד מת, סטייה מהמוסכמות המתועדות ב-CLAUDE.md.' },
  { slug: 'audit-security', label: 'אבטחה', desc: 'נתיבי API בלי בדיקת הרשאה, הזרקות SQL, סודות חשופים בקוד.' },
  { slug: 'audit-orders', label: 'הזמנות פגומות', desc: 'תאריכים חסרים, אי-התאמות סטטוס/ברקוד, טיוטות תקועות — סריקת DB בפועל.' },
  { slug: 'audit-attendance', label: 'נוכחות וכניסות עובדים', desc: 'משמרות פתוחות/חופפות/כפולות סביב חצות — סריקת DB בפועל.' },
  { slug: 'audit-inventory', label: 'התראות מלאי', desc: 'Overbooking, פריטים תקועים, אי-עקביות סטטוס — סריקת DB בפועל.' },
  { slug: 'audit-payments', label: 'תשלומים והחזרים', desc: 'פערי חיוב, הפרות מדיניות זיכוי, legacyId כפולים — סריקת DB בפועל.' },
  { slug: 'audit-data-integrity', label: 'שלמות נתונים', desc: 'רשומות יתומות, מפתחות זרים שבורים, אי-עקביות soft-delete — חוצה מודלים.' },
  { slug: 'audit-performance', label: 'ביצועים ושאילתות', desc: 'קריאות DB בתוך טרנזקציות, דפוסי N+1, שאילתות כבדות מיותרות.' },
  { slug: 'audit-print-ui', label: 'תצוגת הדפסה וממשק', desc: 'חלונות popup עם משתני theme שבורים, כללי @media print חסרים, בעיות RTL.' },
  { slug: 'audit-backups-history', label: 'רישום היסטוריה וגיבויים', desc: 'AuditLog/PageVisitLog פעילים בפועל, וכל שכבות הגיבוי (Neon בענן + הדאמפ היומי המקומי) רצות בזמן.' },
];

export const metadata = { title: 'מערכת ביקורת (11 סוכנים)' };

export default function AuditSystemDocsPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>מערכת ביקורת אוטומטית (11 סוכנים)</h1>
          <p className="page-desc">
            תיעוד למערכת שסורקת גם את קוד המקור וגם את הנתונים בפועל, ומאתרת באגים, בעיות אבטחה,
            הזמנות פגומות, חריגות נוכחות ומלאי ועוד — לפני שהן הופכות לתקלה אצל משתמש.
          </p>
          <p className="page-desc">
            עודכן לאחרונה: 06.08.2026 · המקור הטכני: <Code>.claude/agents/audit-*.md</Code> ו-
            <Code>.claude/commands/audit-system.md</Code>
          </p>
        </div>
      </div>

      <AuditReportsPanel />

      <Section title="מה זה בפועל">
        <p className="page-desc">
          זהו <strong>כלי פיתוח</strong>, לא כפתור בממשק — הוא רץ מתוך Claude Code (לא דורש שהמשתמש
          יריץ אותו בעצמו). מפעילים אותו בפקודה <Code>/audit-system</Code>, והיא מפעילה 11 סוכנים
          קבועים במקביל, כל אחד אחראי על תחום אחד. חמישה מהם קוראים <strong>קוד</strong> בלבד
          (באגים, איכות קוד, אבטחה, ביצועים, הדפסה/ממשק), וששה סורקים <strong>נתונים/מערכת
          בפועל</strong> לקריאה בלבד — בסיס הנתונים, קבצי לוג מקומיים ומשימות מתוזמנות. אף אחד
          מה-11 הסוכנים לא כותב נתונים; הפקודה עצמה מבצעת בסוף כתיבה יחידה ומבוקרת — שמירת
          סיכום ההרצה כרשומת <Code>AuditReport</Code> (ר&apos; &quot;הדוח שמופק&quot; למטה).
        </p>
      </Section>

      <Section title="11 תחומי הביקורת">
        <div className="table-wrap" style={{ marginBottom: '16px' }}>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>תחום</th>
                  <th>מה הוא בודק</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a, i) => (
                  <tr key={a.slug}>
                    <td className="cell-muted">{i + 1}</td>
                    <td className="cell-primary">{a.label}</td>
                    <td>{a.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Callout tone="info" title="שמות הסוכנים">
          כל תחום הוא קובץ עצמאי תחת <Code>.claude/agents/&lt;slug&gt;.md</Code> (העמודה &quot;תחום&quot;
          למעלה תואמת ל-slug בלי הקידומת <Code>audit-</Code>, למשל &quot;הזמנות פגומות&quot; = <Code>audit-orders</Code>).
        </Callout>
      </Section>

      <Section title="איך מפעילים">
        <p className="page-desc" style={{ marginBottom: '0.75rem' }}>
          מתוך סשן Claude Code שספריית העבודה שלו היא בתוך <Code>gemach-app/</Code> (או worktree שלו):
        </p>
        <ul className="page-desc" style={{ paddingInlineStart: '20px', marginBottom: '16px' }}>
          <li><Code>/audit-system</Code> — מריץ את כל 11 הסוכנים.</li>
          <li><Code>/audit-system orders,inventory</Code> — מריץ רק תחומים נבחרים (רשימה מופרדת בפסיקים).</li>
        </ul>
        <Callout tone="warn" title="למה לא כפתור בממשק">
          חלק מהסוכנים כותבים ומריצים סקריפט Node חד-פעמי מול בסיס הנתונים (באותו דפוס כמו
          סקריפטים קיימים תחת <Code>scripts/</Code>) — זה כלי אבחון למפתח, לא פעולה שמשתמש קצה
          אמור להפעיל מהדפדפן.
        </Callout>
      </Section>

      <Section title="הדוח שמופק">
        <p className="page-desc">
          כל הרצה נשמרת כרשומה בטבלת <Code>AuditReport</Code> בבסיס הנתונים של האפליקציה (לא קובץ) —
          ומופיעה מיד ב&quot;דוחות אחרונים&quot; למעלה, בתצוגה מתקפלת עם כל הממצאים לפי תחום וחומרה.
          ההכנסה עצמה מתבצעת דרך <Code>scripts/insert_audit_report.js</Code> (הכתיבה היחידה בכל
          המערכת — כל שאר הסוכנים קריאה בלבד), ומכבדת את מצב ה-PROD/TEST הפעיל כרגע. הרצה חלקית
          (עם ארגומנטים) שומרת דוח שמכיל רק את התחומים שנבחרו.
        </p>
      </Section>

      <Section title="יומן שינויים">
        <ul className="page-desc" style={{ paddingInlineStart: '20px', fontSize: '0.92rem' }}>
          <li>06.08.2026 — נוצרה המערכת: 10 קובצי agent, פקודת <Code>/audit-system</Code>, ועמוד תיעוד זה.</li>
          <li>06.08.2026 — נוסף סוכן 11: <Code>audit-backups-history</Code> (רישום היסטוריה + בדיקת גיבויים בענן ומקומית).</li>
          <li>06.08.2026 — הדוחות עברו מקובץ Markdown (<Code>audit-reports/</Code>) לרשומות בטבלת <Code>AuditReport</Code>, עם תצוגה מתקפלת בעמוד זה (&quot;דוחות אחרונים&quot;).</li>
        </ul>
      </Section>
    </>
  );
}
