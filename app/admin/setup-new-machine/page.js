export const metadata = { title: 'התקנה על מחשב חדש' };

export default function SetupNewMachinePage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1><svg className="icon"><use href="#i-download" /></svg> התקנה על מחשב חדש</h1>
          <p className="page-desc">איך מריצים את המערכת על מחשב נוסף (לא המחשב הראשי) — מה צריך להתקין, ומה עושה סקריפט ההתקנה האוטומטי.</p>
        </div>
      </div>

      <div className="content-page" style={{ margin: 0 }}>
        <div className="content-updated">עודכן לאחרונה: 06.08.2026 · הסקריפט: <code dir="ltr">scripts/setup/setup-new-machine.ps1</code></div>

        <h2>מה נדרש על המחשב החדש</h2>
        <ul>
          <li><strong>Node.js</strong> (גרסה 22.17 ומעלה, או 24 ומעלה) — זו הדרישה המרכזית להרצת השרת. מגיע איתו npm.</li>
          <li><strong>Python אינו נדרש</strong> להרצת האפליקציה עצמה. הוא נחוץ רק אם רוצים להריץ על המחשב הזה גם את סקריפטי הייבוא/מיגרציה הישנים שבשורש הפרויקט (<code dir="ltr">dump.py</code>, <code dir="ltr">extract.py</code> וכו&apos;) — אלה כלים נפרדים, לא חלק מהאפליקציה.</li>
          <li>אין צורך להתקין Postgres מקומי — המסד רץ בענן (Neon), מתחברים אליו דרך משתני סביבה.</li>
        </ul>

        <h2>איך קוד האפליקציה מגיע למחשב</h2>
        <p>
          העתקה ידנית של כל תיקיית <code dir="ltr">gemach-app/</code> (USB, כונן רשת, או ZIP) — אין כרגע ריפו Git מרוחק
          שממנו אפשר לשכפל. חשוב להעתיק גם את <code dir="ltr">.env</code> ו-<code dir="ltr">.env.local</code> (ר&apos; בהמשך).
        </p>

        <h2>הרצת סקריפט ההתקנה</h2>
        <p>לאחר העתקת התיקייה, מריצים מתוך <code dir="ltr">gemach-app/</code>:</p>

        <div className="table-wrap" style={{ marginBottom: '16px' }}>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>פקודה</th>
                  <th>מה קורה</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell-primary"><code dir="ltr">powershell -ExecutionPolicy Bypass -File scripts\setup\setup-new-machine.ps1</code></td>
                  <td>מריץ את סקריפט ההתקנה המלא (ר&apos; שלבים למטה).</td>
                </tr>
                <tr>
                  <td className="cell-primary">לחיצה כפולה על הקובץ + &quot;Run with PowerShell&quot;</td>
                  <td>אותה תוצאה, בלי שורת פקודה.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p><strong>שלבי הסקריפט:</strong></p>
        <ul>
          <li>בודק אם Node.js מותקן ובגרסה מתאימה. אם לא — מתקין אוטומטית דרך <code dir="ltr">winget</code> (או מנחה להתקנה ידנית מ-nodejs.org אם winget לא זמין).</li>
          <li>מריץ <code dir="ltr">npm install</code> בתיקיית האפליקציה.</li>
          <li>מריץ <code dir="ltr">npx prisma generate</code>.</li>
          <li>בודק שקובצי <code dir="ltr">.env</code> ו-<code dir="ltr">.env.local</code> קיימים, ומזהיר אם חסרים.</li>
        </ul>

        <div className="callout callout-danger">
          <svg className="icon"><use href="#i-alert-circle" /></svg>
          <div>
            <strong>הסקריפט לא מכיל סודות</strong><br />
            <code dir="ltr">.env</code> ו-<code dir="ltr">.env.local</code> מחזיקים connection strings למסד הנתונים ומפתחות API
            (<code dir="ltr">GEMINI_API_KEYS</code>, <code dir="ltr">NEON_API_KEY</code>) — הם <strong>לא</strong> נכתבים או
            נוצרים אוטומטית ע&quot;י הסקריפט. יש להעתיק אותם ידנית מהמחשב הראשי (ביחד עם שאר התיקייה), ולא
            לשתף אותם בערוצים לא מאובטחים.
          </div>
        </div>

        <h2>הרצת המערכת בפועל</h2>
        <p>אחרי שההתקנה הצליחה וקבצי הסביבה במקום:</p>

        <div className="table-wrap">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>פקודה</th>
                  <th>מה קורה</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell-primary"><code dir="ltr">npm run dev</code></td>
                  <td>מרים שרת פיתוח מקומי בכתובת <code dir="ltr">http://localhost:3000</code>.</td>
                </tr>
                <tr>
                  <td className="cell-primary"><code dir="ltr">npm run build</code> ואז <code dir="ltr">npm start</code></td>
                  <td>הרצה במצב production מקומי (build מלא, כולל <code dir="ltr">prisma generate</code>).</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <h2>יומן שינויים</h2>
        <ul>
          <li>06.08.2026 — נוצר סקריפט ההתקנה האוטומטי (<code dir="ltr">scripts/setup/setup-new-machine.ps1</code>) ודף תיעוד זה.</li>
        </ul>
      </div>
    </>
  );
}
