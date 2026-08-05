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

export const metadata = { title: 'ייבוא נתונים מאקסס' };

export default function AccessImportPage() {
  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2.5rem', paddingBottom: '4rem', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.4rem' }}>
          ייבוא נתונים מאקסס
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>
          תיעוד מלא של כלי הייבוא הקבוע מקובץ האקסס הישן — מה הוא עושה, איך מריצים אותו בבטחה,
          ומה בודקים אחרי כל הרצה.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          עודכן לאחרונה: 05.08.2026 · המקור הטכני: <Code>scripts/import_from_access.js</Code> (התיעוד המלא בהערת הכותרת של הקובץ)
        </p>
      </div>

      <Section title="מה הכלי עושה">
        <p style={{ lineHeight: 1.8, marginBottom: '0.75rem' }}>
          הבעלים ממשיך לעדכן את קובץ האקסס המקורי במקביל למערכת החיה. הכלי{' '}
          <Code>scripts/import_from_access.js</Code> הוא כלי <strong>קבוע ורב-פעמי</strong> שמסנכרן את
          הנתונים מהאקסס אל מסד הנתונים של המערכת (PROD) — מריצים אותו מחדש בכל פעם שיש נתונים חדשים באקסס.
        </p>
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem' }}>
          <li>זהו <strong>טעינה מלאה עם עדכון-על-קיים (upsert)</strong> — לעולם לא מחיקה-והכנסה-מחדש, ולעולם לא נמחק כלום מהמסד.</li>
          <li>אין באקסס תאריך-עדכון לכל שורה, ולכן אין דרך אמינה לייבא רק שינויים — כל הרצה קוראת את הטבלאות הרלוונטיות במלואן ומעדכנת.</li>
          <li>קובץ האקסס נפתח <strong>לקריאה בלבד</strong> — הכלי לעולם לא כותב אליו.</li>
        </ul>
      </Section>

      <Section title="איך מריצים">
        <p style={{ lineHeight: 1.8, marginBottom: '0.75rem' }}>
          מריצים מתיקיית האפליקציה (<Code>gemach-app/</Code>) בשורת הפקודה:
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
              <Td bold><Code>node scripts/import_from_access.js</Code></Td>
              <Td>הרצת ניסיון (Dry Run) — ברירת המחדל. מדווח כמה שורות ייווצרו/יתעדכנו בכל טבלה, <strong>בלי לכתוב כלום</strong>. תמיד מתחילים כאן.</Td>
            </Tr>
            <Tr>
              <Td bold><Code>node scripts/import_from_access.js --write</Code></Td>
              <Td>כתיבה אמיתית ל-PROD. מריצים רק אחרי שהרצת הניסיון נראית הגיונית.</Td>
            </Tr>
            <Tr>
              <Td bold><Code>--limit=500</Code></Td>
              <Td>מגביל את מספר השורות לכל טבלה (לבדיקות). אפשר לשלב עם <Code>--tail</Code> כדי לדגום את סוף הטבלה (השורות החדשות) במקום את תחילתה.</Td>
            </Tr>
            <Tr last>
              <Td bold><Code>--db-path=&quot;C:\...\file.accdb&quot;</Code></Td>
              <Td>מצביע על קובץ אקסס אחר מברירת המחדל (למשל עותק בדיקה).</Td>
            </Tr>
          </tbody>
        </table>
        <Callout tone="info" title="דרישות סביבה">
          ההרצה דורשת את מנהל ההתקן Microsoft ACE OLEDB (מותקן במחשב של הגמ&quot;ח), ואת המשתנה{' '}
          <Code>PROD_DATABASE_URL</Code> בקובץ <Code>.env</Code> בשורש הפרויקט. הכלי מתחבר ישירות ל-PROD —
          לא דרך מתג ה-prod/test של האפליקציה.
        </Callout>
        <Callout tone="warn" title="לפני כל הרצה עם --write">
          לוודא שקובץ האקסס שמור וסגור מעריכה פעילה (הכלי מדפיס את זמן העדכון האחרון של הקובץ בתחילת ההרצה —
          לוודא שהוא טרי), ושיש גיבוי לילה תקין של המסד (ר&apos; מסך גיבויים).
        </Callout>
      </Section>

      <Section title="אילו טבלאות מיובאות ולפי איזה מפתח">
        <p style={{ lineHeight: 1.8, marginBottom: '1rem' }}>
          ההתאמה בין שורה באקסס לשורה במסד נעשית לפי <strong>מפתח קבוע לכל טבלה</strong>. זה קריטי:
          הזמנות מזוהות לפי מספר ההזמנה (<Code>orderId</Code>) — <strong>לא</strong> לפי{' '}
          <Code>legacyId</Code> (שבטבלת ההזמנות הוא ערך ישן ולא אמין).
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
              <Th>טבלה במערכת</Th>
              <Th>טבלה באקסס</Th>
              <Th>מפתח התאמה</Th>
              <Th>אופן העדכון</Th>
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td bold>לקוחות (Customer)</Td>
              <Td>לקוחות</Td>
              <Td><Code>legacyId</Code> ↔ קוד_לקוח</Td>
              <Td>יצירה + עדכון</Td>
            </Tr>
            <Tr>
              <Td bold>עובדים (Employee)</Td>
              <Td>עובדים</Td>
              <Td><Code>legacyId</Code> ↔ קוד_עובד</Td>
              <Td>יצירה + עדכון (סיסמה — ר&apos; למטה)</Td>
            </Tr>
            <Tr>
              <Td bold>דגמי שמלות (DressModel)</Td>
              <Td>שמלות_דגמים</Td>
              <Td><Code>legacyId</Code> ↔ קוד_שמלה</Td>
              <Td>יצירה + עדכון</Td>
            </Tr>
            <Tr>
              <Td bold>פריטי שמלות (DressItem)</Td>
              <Td>שמלות_נתונים</Td>
              <Td><Code>legacyId</Code> ↔ קוד</Td>
              <Td>יצירה + עדכון</Td>
            </Tr>
            <Tr>
              <Td bold>הזמנות (Order)</Td>
              <Td>הזמנות</Td>
              <Td><Code>orderId</Code> ↔ קוד_הזמנה</Td>
              <Td>יצירה + עדכון (גם כותרות של הזמנות קיימות)</Td>
            </Tr>
            <Tr last>
              <Td bold>פריטי הזמנה / תשלומים / חיובים<br />(OrderItem / Payment / PaymentObligation)</Td>
              <Td>הזמנות_פרטים / הזמנות_תשלום_ביצוע / הזמנות_תשלום</Td>
              <Td><Code>legacyId</Code> ↔ קוד_פריט / קוד</Td>
              <Td><strong>הכנסה בלבד, ורק להזמנות חדשות</strong> (ר&apos; מגבלה ידועה למטה)</Td>
            </Tr>
          </tbody>
        </table>
      </Section>

      <Section title="מה הכלי לעולם לא נוגע בו">
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem' }}>
          <li><strong>שום מחיקה.</strong> שורות שנמחקו באקסס מסומנות במסד כ&quot;מחוק&quot; (<Code>isDeleted</Code>) אם קיימת עמודה כזו — אבל שום דבר לא נמחק פיזית.</li>
          <li><strong>שדות שקיימים רק באפליקציה</strong> (ואין להם עמודה באקסס) לא נדרסים: פרטי בנק של לקוח, צבע ותמונת פרופיל של עובד, תמונת דגם (<Code>imageUrl</Code>) ועוד.</li>
          <li><strong>סיסמת עובד</strong> נקבעת מהאקסס רק כשעובד נוצר לראשונה — לעולם לא נדרסת לעובד קיים (ייתכן שהוחלפה באפליקציה).</li>
          <li><strong>טבלאות שאינן ברשימה למעלה</strong> — זיכויים (Refund), מחירונים, הגדרות מערכת וכו&apos; — לא נגועות כלל.</li>
          <li><strong>קובץ האקסס עצמו</strong> — נפתח לקריאה בלבד.</li>
        </ul>
      </Section>

      <Section title="מגבלה ידועה: תשלומים ופריטים של הזמנות קיימות">
        <Callout tone="warn" title="החשוב ביותר להבין">
          שורות של פריטי הזמנה, תשלומים וחיובים מוכנסות <strong>רק להזמנות שחדשות למסד באותה הרצה</strong>.
          אם באקסס נוסף תשלום או פריט להזמנה שכבר קיימת במסד — הכלי <strong>לא</strong> יקלוט אותו אוטומטית.
        </Callout>
        <p style={{ lineHeight: 1.8, marginBottom: '0.75rem' }}>
          הסיבה: בהעברה המקורית מאקסס למערכת, שלוש הטבלאות האלה קיבלו מספרי <Code>legacyId</Code>{' '}
          <strong>מומצאים</strong> (רצים סדרתית, ללא קשר למספרי האקסס האמיתיים). אין דרך בטוחה להתאים שורה
          קיימת כזו לשורת האקסס המקורית שלה, ולכן הכנסה עיוורת עלולה לרשום תשלום פעמיים.
        </p>
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem' }}>
          <li>ב-05.08.2026 כל שורות ה-<Code>legacyId</Code> המומצאות (41,740 שורות תשלום) מוספרו מחדש{' '}
            <strong>לערכים שליליים</strong>, כך שמספרי אקסס אמיתיים (חיוביים) יכולים להיכנס בלי התנגשות.</li>
          <li>מאותו תאריך, כל שורה שהכלי מכניס נושאת את מספר האקסס האמיתי — ולכן הרצות חוזרות מזהות כפילויות ומדלגות עליהן אוטומטית.</li>
          <li>הפער ההיסטורי הושלם בשני מהלכים מבוקרים (05.08.2026): השלמת תשלומים ל-2,035 הזמנות שהיו ללא
            תשלומים כלל, והתאמה פרטנית להזמנות שכבר היו להן תשלומים. מקרים שלא ניתן היה להתאים בוודאות תועדו
            לבדיקה ידנית ולא הוכנסו.</li>
        </ul>
      </Section>

      <Section title="דגשים ומלכודות ידועות">
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem' }}>
          <li>
            <strong>סטטוס סל של פריטים מיובאים:</strong> כל פריט הזמנה מיובא נשמר עם{' '}
            <Code>cartStatus=&apos;confirmed&apos;</Code>. בלי זה, ברירת המחדל (&apos;pending&apos;) גרמה
            להזמנות היסטוריות להציג תג &quot;⏳ פג תוקף&quot; שגוי במסך ההזמנות. תוקן בקוד ב-05.08.2026 — לא להסיר.
          </li>
          <li>
            <strong>שיוך פריט הזמנה לשמלה פיזית</strong> (<Code>dressItemId</Code>) <strong>לא</strong> נקבע
            בייבוא — באקסס אין קישור ישיר, רק ברקוד/קידומת/מידה, בדיוק כמו במערכת. שיוך פיזי נעשה בתהליך
            התאמה נפרד.
          </li>
          <li>
            <strong>תאריכים עבריים:</strong> עמודות טקסט עם תאריך עברי (&quot;ו כסלו תשפג&quot;) מפוענחות
            אוטומטית, כולל איותים חלופיים (סיון/חשון). תאריך שלא פוענח <strong>לא</strong> מנוחש — הוא נשאר
            ריק ומדווח בסוף ההרצה ברשימת &quot;Unparsed date strings&quot;.
          </li>
          <li>
            <strong>תאריכים ריקים באקסס</strong> מגיעים לפעמים כ-01/01/1970 או 30/12/1899 — הכלי מזהה אותם
            כערכי-דמה ושומר ריק.
          </li>
          <li>
            <strong>התנגשות שמות דגמים:</strong> אם שם דגם באקסס מתנגש עם שם של דגם אחר שכבר קיים במסד, נשמר
            השם הקיים במסד (מדווח בסיכום ההרצה) — לא נדרס שם של דגם אחר.
          </li>
        </ul>
      </Section>

      <Section title="מה בודקים אחרי כל הרצה">
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem' }}>
          <li><strong>טבלת הסיכום בסוף הפלט</strong> — מספרי create/update/written לכל טבלה סבירים ביחס למה שבאמת השתנה באקסס.</li>
          <li>
            <strong>אזהרות <Code>SKIPPED via DO NOTHING</Code></strong> — מספר גדול בטבלת תשלומים/פריטים
            בהרצה ראשונה הוא דגל אדום (התנגשות מספרים). בהרצה חוזרת של אותם נתונים זה צפוי ותקין.
          </li>
          <li><strong>שורות <Code>FAILED</Code></strong> — אם מופיעות, הפירוט המלא מודפס בסוף ההרצה. לחקור לפני הרצה נוספת.</li>
          <li><strong>רשימת תאריכים שלא פוענחו</strong> — אם הרשימה ארוכה מהרגיל, ייתכן פורמט תאריך חדש באקסס שדורש טיפול.</li>
          <li><strong>בדיקה מדגמית במערכת</strong> — לפתוח הזמנה חדשה שיובאה ולוודא: לקוח משויך, פריטים, תשלומים וסכומים נכונים, ושאין תג &quot;פג תוקף&quot; שגוי.</li>
          <li>
            <strong>מסך &quot;חישובים&quot;</strong> (<a href="/admin/recalculations" style={{ color: 'var(--primary-color)', fontWeight: 700 }}>פערי תשלומים</a>) —
            לוודא שלא נוצרו פערים חדשים בין חיובים לתשלומים.
          </li>
        </ul>
      </Section>

      <Section title="יומן שינויים">
        <ul style={{ lineHeight: 1.9, paddingRight: '1.2rem', fontSize: '0.92rem' }}>
          <li>05.08.2026 — הכלי הקבוע נוצר, כולל כל אמצעי הבטיחות המתועדים כאן.</li>
          <li>05.08.2026 — <strong>תוקן:</strong> מספור ה-<Code>legacyId</Code> המומצא של תשלומים ישנים הוסב
            לערכים שליליים; הושלמו 3,640 תשלומים ל-2,035 הזמנות שיובאו ללא תשלומים.</li>
          <li>05.08.2026 — <strong>תוקן:</strong> פריטי הזמנה מיובאים מקבלים <Code>cartStatus=&apos;confirmed&apos;</Code> (ביטול תג &quot;פג תוקף&quot; שגוי).</li>
          <li>05.08.2026 — הושלמה התאמה פרטנית של תשלומים חסרים להזמנות שכבר היו להן תשלומים; מקרים לא-ודאיים תועדו לבדיקה ידנית ולא הוכנסו.</li>
        </ul>
      </Section>
    </div>
  );
}
