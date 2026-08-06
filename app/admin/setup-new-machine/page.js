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

const Th = ({ children }) => (
  <th style={{ textAlign: 'right', padding: '0.5rem' }}>{children}</th>
);
const Td = ({ children, bold }) => (
  <td style={{ padding: '0.6rem 0.5rem', fontWeight: bold ? 700 : 400 }}>{children}</td>
);
const Tr = ({ children, last }) => (
  <tr style={last ? undefined : { borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>{children}</tr>
);

export const metadata = { title: 'התקנה על מחשב חדש' };

export default function SetupNewMachinePage() {
  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2.5rem', paddingBottom: '4rem', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.4rem' }}>
          התקנה על מחשב חדש
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>
          איך מריצים את המערכת על מחשב נוסף (לא המחשב הראשי) — מה צריך להתקין, ומה עושה סקריפט ההתקנה האוטומטי.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          עודכן לאחרונה: 06.08.2026 · הסקריפט: <Code>scripts/setup/setup-new-machine.ps1</Code>
        </p>
      </div>

      <Section title="מה נדרש על המחשב החדש">
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem' }}>
          <li><strong>Node.js</strong> (גרסה 22.17 ומעלה, או 24 ומעלה) — זו הדרישה המרכזית להרצת השרת. מגיע איתו npm.</li>
          <li><strong>Python אינו נדרש</strong> להרצת האפליקציה עצמה. הוא נחוץ רק אם רוצים להריץ על המחשב הזה גם את סקריפטי הייבוא/מיגרציה הישנים שבשורש הפרויקט (<Code>dump.py</Code>, <Code>extract.py</Code> וכו&apos;) — אלה כלים נפרדים, לא חלק מהאפליקציה.</li>
          <li>אין צורך להתקין Postgres מקומי — המסד רץ בענן (Neon), מתחברים אליו דרך משתני סביבה.</li>
        </ul>
      </Section>

      <Section title="איך קוד האפליקציה מגיע למחשב">
        <p style={{ lineHeight: 1.8 }}>
          העתקה ידנית של כל תיקיית <Code>gemach-app/</Code> (USB, כונן רשת, או ZIP) — אין כרגע ריפו Git מרוחק
          שממנו אפשר לשכפל. חשוב להעתיק גם את <Code>.env</Code> ו-<Code>.env.local</Code> (ר&apos; בהמשך).
        </p>
      </Section>

      <Section title="הרצת סקריפט ההתקנה">
        <p style={{ lineHeight: 1.8, marginBottom: '0.75rem' }}>
          לאחר העתקת התיקייה, מריצים מתוך <Code>gemach-app/</Code>:
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
              <Th>פקודה</Th>
              <Th>מה קורה</Th>
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td bold><Code>powershell -ExecutionPolicy Bypass -File scripts\setup\setup-new-machine.ps1</Code></Td>
              <Td>מריץ את סקריפט ההתקנה המלא (ר&apos; שלבים למטה).</Td>
            </Tr>
            <Tr last>
              <Td bold>לחיצה כפולה על הקובץ + &quot;Run with PowerShell&quot;</Td>
              <Td>אותה תוצאה, בלי שורת פקודה.</Td>
            </Tr>
          </tbody>
        </table>

        <p style={{ lineHeight: 1.8, marginBottom: '0.5rem' }}><strong>שלבי הסקריפט:</strong></p>
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem', marginBottom: '1rem' }}>
          <li>בודק אם Node.js מותקן ובגרסה מתאימה. אם לא — מתקין אוטומטית דרך <Code>winget</Code> (או מנחה להתקנה ידנית מ-nodejs.org אם winget לא זמין).</li>
          <li>מריץ <Code>npm install</Code> בתיקיית האפליקציה.</li>
          <li>מריץ <Code>npx prisma generate</Code>.</li>
          <li>בודק שקובצי <Code>.env</Code> ו-<Code>.env.local</Code> קיימים, ומזהיר אם חסרים.</li>
        </ul>

        <Callout tone="danger" title="הסקריפט לא מכיל סודות">
          <Code>.env</Code> ו-<Code>.env.local</Code> מחזיקים connection strings למסד הנתונים ומפתחות API
          (<Code>GEMINI_API_KEYS</Code>, <Code>NEON_API_KEY</Code>) — הם <strong>לא</strong> נכתבים או
          נוצרים אוטומטית ע&quot;י הסקריפט. יש להעתיק אותם ידנית מהמחשב הראשי (ביחד עם שאר התיקייה), ולא
          לשתף אותם בערוצים לא מאובטחים.
        </Callout>
      </Section>

      <Section title="הרצת המערכת בפועל">
        <p style={{ lineHeight: 1.8 }}>
          אחרי שההתקנה הצליחה וקבצי הסביבה במקום:
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
              <Th>פקודה</Th>
              <Th>מה קורה</Th>
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td bold><Code>npm run dev</Code></Td>
              <Td>מרים שרת פיתוח מקומי בכתובת <Code>http://localhost:3000</Code>.</Td>
            </Tr>
            <Tr last>
              <Td bold><Code>npm run build</Code> ואז <Code>npm start</Code></Td>
              <Td>הרצה במצב production מקומי (build מלא, כולל <Code>prisma generate</Code>).</Td>
            </Tr>
          </tbody>
        </table>
      </Section>

      <Section title="יומן שינויים">
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem', fontSize: '0.92rem' }}>
          <li>06.08.2026 — נוצר סקריפט ההתקנה האוטומטי (<Code>scripts/setup/setup-new-machine.ps1</Code>) ודף תיעוד זה.</li>
        </ul>
      </Section>
    </div>
  );
}
