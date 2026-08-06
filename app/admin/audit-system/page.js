import AuditReportsPanel from './AuditReportsPanel';

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
    <div className="container animate-fade-in" style={{ paddingTop: '2.5rem', paddingBottom: '4rem', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.4rem' }}>
          מערכת ביקורת אוטומטית (11 סוכנים)
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>
          תיעוד למערכת שסורקת גם את קוד המקור וגם את הנתונים בפועל, ומאתרת באגים, בעיות אבטחה,
          הזמנות פגומות, חריגות נוכחות ומלאי ועוד — לפני שהן הופכות לתקלה אצל משתמש.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          עודכן לאחרונה: 06.08.2026 · המקור הטכני: <Code>.claude/agents/audit-*.md</Code> ו-
          <Code>.claude/commands/audit-system.md</Code>
        </p>
      </div>

      <AuditReportsPanel />

      <Section title="מה זה בפועל">
        <p style={{ lineHeight: 1.8 }}>
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
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>#</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>תחום</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>מה הוא בודק</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a, i) => (
              <tr key={a.slug} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{a.label}</td>
                <td style={{ padding: '0.6rem 0.5rem', lineHeight: 1.6 }}>{a.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Callout tone="info" title="שמות הסוכנים">
          כל תחום הוא קובץ עצמאי תחת <Code>.claude/agents/&lt;slug&gt;.md</Code> (העמודה &quot;תחום&quot;
          למעלה תואמת ל-slug בלי הקידומת <Code>audit-</Code>, למשל &quot;הזמנות פגומות&quot; = <Code>audit-orders</Code>).
        </Callout>
      </Section>

      <Section title="איך מפעילים">
        <p style={{ lineHeight: 1.8, marginBottom: '0.75rem' }}>
          מתוך סשן Claude Code שספריית העבודה שלו היא בתוך <Code>gemach-app/</Code> (או worktree שלו):
        </p>
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem' }}>
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
        <p style={{ lineHeight: 1.8 }}>
          כל הרצה נשמרת כרשומה בטבלת <Code>AuditReport</Code> בבסיס הנתונים של האפליקציה (לא קובץ) —
          ומופיעה מיד ב&quot;דוחות אחרונים&quot; למעלה, בתצוגה מתקפלת עם כל הממצאים לפי תחום וחומרה.
          ההכנסה עצמה מתבצעת דרך <Code>scripts/insert_audit_report.js</Code> (הכתיבה היחידה בכל
          המערכת — כל שאר הסוכנים קריאה בלבד), ומכבדת את מצב ה-PROD/TEST הפעיל כרגע. הרצה חלקית
          (עם ארגומנטים) שומרת דוח שמכיל רק את התחומים שנבחרו.
        </p>
      </Section>

      <Section title="יומן שינויים">
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem', fontSize: '0.92rem' }}>
          <li>06.08.2026 — נוצרה המערכת: 10 קובצי agent, פקודת <Code>/audit-system</Code>, ועמוד תיעוד זה.</li>
          <li>06.08.2026 — נוסף סוכן 11: <Code>audit-backups-history</Code> (רישום היסטוריה + בדיקת גיבויים בענן ומקומית).</li>
          <li>06.08.2026 — הדוחות עברו מקובץ Markdown (<Code>audit-reports/</Code>) לרשומות בטבלת <Code>AuditReport</Code>, עם תצוגה מתקפלת בעמוד זה (&quot;דוחות אחרונים&quot;).</li>
        </ul>
      </Section>
    </div>
  );
}
