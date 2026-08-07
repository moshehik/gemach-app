export const metadata = { title: 'ייבוא נתונים מאקסס' };

export default function AccessImportPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>ייבוא נתונים מאקסס</h1>
          <div className="page-desc">
            תיעוד מלא של כלי הייבוא הקבוע מקובץ האקסס הישן — מה הוא עושה, איך מריצים אותו בבטחה,
            ומה בודקים אחרי כל הרצה.
          </div>
        </div>
      </div>

      <div className="hint" style={{ color: 'var(--text-3)', marginBottom: '20px' }}>
        עודכן לאחרונה: 06.08.2026 · המקור הטכני: <code>scripts/import_from_access.js</code> (התיעוד המלא בהערת הכותרת של הקובץ)
      </div>

      <section style={{ marginBottom: '24px' }}>
        <h2>מה הכלי עושה</h2>
        <div className="card card-pad">
          <p>
            הבעלים ממשיך לעדכן את קובץ האקסס המקורי במקביל למערכת החיה. הכלי{' '}
            <code>scripts/import_from_access.js</code> הוא כלי <strong>קבוע ורב-פעמי</strong> שמסנכרן את
            הנתונים מהאקסס אל מסד הנתונים של המערכת (PROD) — מריצים אותו מחדש בכל פעם שיש נתונים חדשים באקסס.
          </p>
          <ul>
            <li>זהו <strong>טעינה מלאה עם עדכון-על-קיים (upsert)</strong> — לעולם לא מחיקה-והכנסה-מחדש, ולעולם לא נמחק כלום מהמסד.</li>
            <li>אין באקסס תאריך-עדכון לכל שורה, ולכן אין דרך אמינה לייבא רק שינויים — כל הרצה קוראת את הטבלאות הרלוונטיות במלואן ומעדכנת.</li>
            <li>קובץ האקסס נפתח <strong>לקריאה בלבד</strong> — הכלי לעולם לא כותב אליו.</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>איך מריצים</h2>
        <div className="card card-pad">
          <p>מריצים מתיקיית האפליקציה (<code>gemach-app/</code>) בשורת הפקודה:</p>
          <div className="table-wrap" style={{ marginBottom: '16px' }}>
            <table className="data">
              <thead>
                <tr><th>פקודה</th><th>מה קורה</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell-primary"><code>node scripts/import_from_access.js</code></td>
                  <td>הרצת ניסיון (Dry Run) — ברירת המחדל. מדווח כמה שורות ייווצרו/יתעדכנו בכל טבלה, <strong>בלי לכתוב כלום</strong>. תמיד מתחילים כאן.</td>
                </tr>
                <tr>
                  <td className="cell-primary"><code>node scripts/import_from_access.js --write</code></td>
                  <td>כתיבה אמיתית ל-PROD. מריצים רק אחרי שהרצת הניסיון נראית הגיונית.</td>
                </tr>
                <tr>
                  <td className="cell-primary"><code>--limit=500</code></td>
                  <td>מגביל את מספר השורות לכל טבלה (לבדיקות). אפשר לשלב עם <code>--tail</code> כדי לדגום את סוף הטבלה (השורות החדשות) במקום את תחילתה.</td>
                </tr>
                <tr>
                  <td className="cell-primary"><code>--db-path=&quot;C:\...\file.accdb&quot;</code></td>
                  <td>מצביע על קובץ אקסס אחר מברירת המחדל (למשל עותק בדיקה).</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="callout callout-info" style={{ marginBottom: '10px' }}>
            <svg className="icon"><use href="#i-info" /></svg>
            <div>
              <strong>דרישות סביבה</strong><br />
              ההרצה דורשת את מנהל ההתקן Microsoft ACE OLEDB (מותקן במחשב של הגמ&quot;ח), ואת המשתנה{' '}
              <code>PROD_DATABASE_URL</code> בקובץ <code>.env</code> בשורש הפרויקט. הכלי מתחבר ישירות ל-PROD —
              לא דרך מתג ה-prod/test של האפליקציה.
            </div>
          </div>
          <div className="callout callout-warning">
            <svg className="icon"><use href="#i-alert-tri" /></svg>
            <div>
              <strong>לפני כל הרצה עם --write</strong><br />
              לוודא שקובץ האקסס שמור וסגור מעריכה פעילה (הכלי מדפיס את זמן העדכון האחרון של הקובץ בתחילת ההרצה —
              לוודא שהוא טרי), ושיש גיבוי לילה תקין של המסד (ר&apos; מסך גיבויים).
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>אילו טבלאות מיובאות ולפי איזה מפתח</h2>
        <div className="card card-pad">
          <p>
            ההתאמה בין שורה באקסס לשורה במסד נעשית לפי <strong>מפתח קבוע לכל טבלה</strong>. זה קריטי:
            הזמנות מזוהות לפי מספר ההזמנה (<code>orderId</code>) — <strong>לא</strong> לפי{' '}
            <code>legacyId</code> (שבטבלת ההזמנות הוא ערך ישן ולא אמין).
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>טבלה במערכת</th><th>טבלה באקסס</th><th>מפתח התאמה</th><th>אופן העדכון</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell-primary">לקוחות (Customer)</td>
                  <td>לקוחות</td>
                  <td><code>legacyId</code> ↔ קוד_לקוח</td>
                  <td>יצירה + עדכון</td>
                </tr>
                <tr>
                  <td className="cell-primary">עובדים (Employee)</td>
                  <td>עובדים</td>
                  <td><code>legacyId</code> ↔ קוד_עובד</td>
                  <td>יצירה + עדכון (סיסמה — ר&apos; למטה)</td>
                </tr>
                <tr>
                  <td className="cell-primary">דגמי שמלות (DressModel)</td>
                  <td>שמלות_דגמים</td>
                  <td><code>legacyId</code> ↔ קוד_שמלה</td>
                  <td>יצירה + עדכון</td>
                </tr>
                <tr>
                  <td className="cell-primary">פריטי שמלות (DressItem)</td>
                  <td>שמלות_נתונים</td>
                  <td><code>legacyId</code> ↔ קוד</td>
                  <td>יצירה + עדכון</td>
                </tr>
                <tr>
                  <td className="cell-primary">הזמנות (Order)</td>
                  <td>הזמנות</td>
                  <td><code>orderId</code> ↔ קוד_הזמנה</td>
                  <td>יצירה + עדכון (גם כותרות של הזמנות קיימות)</td>
                </tr>
                <tr>
                  <td className="cell-primary">פריטי הזמנה / תשלומים / חיובים<br />(OrderItem / Payment / PaymentObligation)</td>
                  <td>הזמנות_פרטים / הזמנות_תשלום_ביצוע / הזמנות_תשלום</td>
                  <td><code>legacyId</code> ↔ קוד_פריט / קוד</td>
                  <td><strong>הכנסה בלבד, ורק להזמנות חדשות</strong> (ר&apos; מגבלה ידועה למטה)</td>
                </tr>
                <tr>
                  <td className="cell-primary">נוכחות עובדים (Shift)</td>
                  <td>עובדים_נוכחות</td>
                  <td><code>legacyId</code> ↔ קוד</td>
                  <td>יצירה + עדכון (שדות מאקסס בלבד — ר&apos; פירוט למטה)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>מה הכלי לעולם לא נוגע בו</h2>
        <div className="card card-pad">
          <ul>
            <li><strong>שום מחיקה.</strong> שורות שנמחקו באקסס מסומנות במסד כ&quot;מחוק&quot; (<code>isDeleted</code>) אם קיימת עמודה כזו — אבל שום דבר לא נמחק פיזית.</li>
            <li><strong>שדות שקיימים רק באפליקציה</strong> (ואין להם עמודה באקסס) לא נדרסים: פרטי בנק של לקוח, צבע ותמונת פרופיל של עובד, תמונת דגם (<code>imageUrl</code>) ועוד.</li>
            <li><strong>סיסמת עובד</strong> נקבעת מהאקסס רק כשעובד נוצר לראשונה — לעולם לא נדרסת לעובד קיים (ייתכן שהוחלפה באפליקציה).</li>
            <li><strong>טבלאות שאינן ברשימה למעלה</strong> — זיכויים (Refund), מחירונים, הגדרות מערכת וכו&apos; — לא נגועות כלל.</li>
            <li>
              <strong>שדות תשלום מחושבים של משמרת קיימת (Shift).</strong> עבור משמרת שכבר קיימת במסד,
              הכלי מרענן רק את השדות שמקורם באקסס (שעת כניסה/יציאה, תאריך עברי, תאריך המשמרת) —{' '}
              <strong>לעולם לא</strong> את <code>totalMinutes</code>/<code>hourlyWageSnapshot</code>/
              <code>travelExpensesSnapshot</code>/<code>totalCalculated</code>. אלה מחושבים רק פעם אחת,
              כשהמשמרת נוצרת לראשונה — כדי שהרצה חוזרת לא &quot;תסחוף&quot; משמרת היסטורית לפי השכר{' '}
              <em>הנוכחי</em> של העובד אם השכר השתנה בינתיים.
            </li>
            <li><strong>קובץ האקסס עצמו</strong> — נפתח לקריאה בלבד.</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>דגש חשוב: משמרות היסטוריות בלי סה&quot;כ דקות מחושב</h2>
        <div className="card card-pad">
          <div className="callout callout-warning">
            <svg className="icon"><use href="#i-alert-tri" /></svg>
            <div>
              <strong>נמצא ותוקן 06.08.2026</strong><br />
              כל המשמרות שהועברו מאקסס (ר&apos; סעיף &quot;נוכחות עובדים&quot; למעלה) נשמרו במסד עם שעות
              כניסה/יציאה אבל <strong>בלי</strong> <code>totalMinutes</code>/<code>totalCalculated</code> מחושבים
              — כך שהן הוצגו כ&quot;---&quot; בדוחות הנוכחות. הסיבה: התיקון מ-05.08.2026 שגרם לחישוב אוטומטי
              (<code>lib/shiftCalc.js</code>) חל רק על משמרות שנוצרות/נערכות מעכשיו והלאה; סקריפט ה-backfill
              החד-פעמי שנכתב אז (<code>scripts/fix_employee_shifts.js</code>) לא הורץ בפועל עד 06.08.2026.
              תוקן: הורץ מול PROD והשלים חישוב ל-12,657 משמרות היסטוריות (כולן, ללא יוצא מן הכלל שנותר).
              כלי הייבוא (ר&apos; &quot;נוכחות עובדים&quot; למעלה) מחשב סה&quot;כ דקות/תשלום רק למשמרת חדשה
              שהוא עצמו יוצר — אם אי-פעם תתגלה עוד קבוצת משמרות קיימות בלי חישוב, יש להריץ שוב את אותו סקריפט
              (<code>scripts/fix_employee_shifts.js</code>).
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>מגבלה ידועה: תשלומים ופריטים של הזמנות קיימות</h2>
        <div className="card card-pad">
          <div className="callout callout-warning" style={{ marginBottom: '14px' }}>
            <svg className="icon"><use href="#i-alert-tri" /></svg>
            <div>
              <strong>החשוב ביותר להבין</strong><br />
              שורות של פריטי הזמנה, תשלומים וחיובים מוכנסות <strong>רק להזמנות שחדשות למסד באותה הרצה</strong>.
              אם באקסס נוסף תשלום או פריט להזמנה שכבר קיימת במסד — הכלי <strong>לא</strong> יקלוט אותו אוטומטית.
            </div>
          </div>
          <p>
            הסיבה: בהעברה המקורית מאקסס למערכת, שלוש הטבלאות האלה קיבלו מספרי <code>legacyId</code>{' '}
            <strong>מומצאים</strong> (רצים סדרתית, ללא קשר למספרי האקסס האמיתיים). אין דרך בטוחה להתאים שורה
            קיימת כזו לשורת האקסס המקורית שלה, ולכן הכנסה עיוורת עלולה לרשום תשלום פעמיים.
          </p>
          <ul>
            <li>ב-05.08.2026 כל שורות ה-<code>legacyId</code> המומצאות (41,740 שורות תשלום) מוספרו מחדש{' '}
              <strong>לערכים שליליים</strong>, כך שמספרי אקסס אמיתיים (חיוביים) יכולים להיכנס בלי התנגשות.</li>
            <li>מאותו תאריך, כל שורה שהכלי מכניס נושאת את מספר האקסס האמיתי — ולכן הרצות חוזרות מזהות כפילויות ומדלגות עליהן אוטומטית.</li>
            <li>הפער ההיסטורי הושלם בשני מהלכים מבוקרים (05.08.2026): השלמת תשלומים ל-2,035 הזמנות שהיו ללא
              תשלומים כלל, והתאמה פרטנית להזמנות שכבר היו להן תשלומים. מקרים שלא ניתן היה להתאים בוודאות תועדו
              לבדיקה ידנית ולא הוכנסו.</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>דגשים ומלכודות ידועות</h2>
        <div className="card card-pad">
          <ul>
            <li>
              <strong>סטטוס סל של פריטים מיובאים:</strong> כל פריט הזמנה מיובא נשמר עם{' '}
              <code>cartStatus=&apos;confirmed&apos;</code>. בלי זה, ברירת המחדל (&apos;pending&apos;) גרמה
              להזמנות היסטוריות להציג תג &quot;⏳ פג תוקף&quot; שגוי במסך ההזמנות. תוקן בקוד ב-05.08.2026 — לא להסיר.
            </li>
            <li>
              <strong>שיוך פריט הזמנה לשמלה פיזית</strong> (<code>dressItemId</code>) <strong>לא</strong> נקבע
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
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2>מה בודקים אחרי כל הרצה</h2>
        <div className="card card-pad">
          <ul>
            <li><strong>טבלת הסיכום בסוף הפלט</strong> — מספרי create/update/written לכל טבלה סבירים ביחס למה שבאמת השתנה באקסס.</li>
            <li>
              <strong>אזהרות <code>SKIPPED via DO NOTHING</code></strong> — מספר גדול בטבלת תשלומים/פריטים
              בהרצה ראשונה הוא דגל אדום (התנגשות מספרים). בהרצה חוזרת של אותם נתונים זה צפוי ותקין.
            </li>
            <li><strong>שורות <code>FAILED</code></strong> — אם מופיעות, הפירוט המלא מודפס בסוף ההרצה. לחקור לפני הרצה נוספת.</li>
            <li><strong>רשימת תאריכים שלא פוענחו</strong> — אם הרשימה ארוכה מהרגיל, ייתכן פורמט תאריך חדש באקסס שדורש טיפול.</li>
            <li><strong>בדיקה מדגמית במערכת</strong> — לפתוח הזמנה חדשה שיובאה ולוודא: לקוח משויך, פריטים, תשלומים וסכומים נכונים, ושאין תג &quot;פג תוקף&quot; שגוי.</li>
            <li>
              <strong>מסך &quot;חישובים&quot;</strong> (<a href="/admin/recalculations" style={{ color: 'var(--primary-solid)', fontWeight: 700 }}>פערי תשלומים</a>) —
              לוודא שלא נוצרו פערים חדשים בין חיובים לתשלומים.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h2>יומן שינויים</h2>
        <div className="card card-pad">
          <ul style={{ fontSize: '13px' }}>
            <li>05.08.2026 — הכלי הקבוע נוצר, כולל כל אמצעי הבטיחות המתועדים כאן.</li>
            <li>05.08.2026 — <strong>תוקן:</strong> מספור ה-<code>legacyId</code> המומצא של תשלומים ישנים הוסב
              לערכים שליליים; הושלמו 3,640 תשלומים ל-2,035 הזמנות שיובאו ללא תשלומים.</li>
            <li>05.08.2026 — <strong>תוקן:</strong> פריטי הזמנה מיובאים מקבלים <code>cartStatus=&apos;confirmed&apos;</code> (ביטול תג &quot;פג תוקף&quot; שגוי).</li>
            <li>05.08.2026 — הושלמה התאמה פרטנית של תשלומים חסרים להזמנות שכבר היו להן תשלומים; מקרים לא-ודאיים תועדו לבדיקה ידנית ולא הוכנסו.</li>
            <li>06.08.2026 — <strong>תוקן:</strong> הורץ סקריפט ה-backfill ההיסטורי שחיכה מ-05.08.2026 (<code>scripts/fix_employee_shifts.js</code>) — השלים <code>totalMinutes</code>/<code>totalCalculated</code> ל-12,657 משמרות שהועברו מאקסס (אומת: 0 משמרות נותרו בלי חישוב).</li>
            <li>06.08.2026 — <strong>נוסף:</strong> נוכחות עובדים (Shift, <code>עובדים_נוכחות</code>) הצטרפה לרשימת הטבלאות המיובאות — ר&apos; פירוט בטבלה ובסעיף &quot;מה הכלי לעולם לא נוגע בו&quot; למעלה.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
