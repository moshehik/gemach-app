import Link from 'next/link';

export default function AdminHubPage() {
  return (
    <div className="container animate-fade-in" style={{ paddingTop: '3rem' }}>
      <h1 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>מסך ניהול ראשי</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', fontSize: '1.2rem' }}>
        ברוך הבא למרכז השליטה והבקרה. בחר את המערכת הרצויה:
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem'
      }}>

        {/* AI Assistant Card */}
        <Link href="/admin/ai" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>מערכת AI מתקדמת</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              התחבר לג'מיני כדי לשאול שאלות, להפיק דוחות מילוליים, ולקבל תובנות מהירות על בסיס נתוני המערכת.
            </p>
          </div>
        </Link>

        {/* Inventory Alerts Card */}
        <Link href="/admin/inventory-alerts" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>התראות ובדיקות מלאי</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              סריקה כוללת של ההזמנות העתידיות ואיתור חריגות (Overbooking) במלאי שמצריכות טיפול.
            </p>
          </div>
        </Link>

        {/* Statistics Card */}
        <Link href="/admin/statistics" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #065f46, #10b981)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>דוחות וסטטיסטיקה</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              גישה ישירה לשאילתות המתקדמות: דוח יומי, עובדים בו-זמנית, וסיכום רכישות לפי הזמנה.
            </p>
          </div>
        </Link>

        {/* General Dashboard Card */}
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #475569, #94a3b8)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>דשבורד בסיסי</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              סיכום הכנסות, טרנדים, וגרפים כלליים (הדשבורד המקורי).
            </p>
          </div>
        </Link>

        {/* Settings Card */}
        <Link href="/admin/settings" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #7c2d12, #f59e0b)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>הגדרות מערכת</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              ניהול הגדרות כלליות של המערכת, כולל הגדרות הופעה ולוגו.
            </p>
          </div>
        </Link>

        {/* Database Management Card */}
        <Link href="/admin/database" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #0f172a, #334155)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>ניהול מסד נתונים</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              העלאת קובץ אקסס חדש, גיבוי הנתונים הקיימים, וסנכרון מלא של המערכת.
            </p>
          </div>
        </Link>

        {/* Pricelist Card */}
        <Link href="/dashboard/pricelist" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #5b21b6, #a855f7)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>מחירון הגמ"ח</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              צפייה וניהול מחירי ההשכרה והמכירה עבור הדגמים השונים, עם אפשרות הדפסה כ-PDF.
            </p>
          </div>
        </Link>

        {/* Data History Card */}
        <Link href="/admin/data-history" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>היסטוריית נתונים</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              מעקב מפורט אחר כל שינויי הנתונים במערכת (יצירה, עדכון, מחיקה).
            </p>
          </div>
        </Link>

        {/* Page Visits History Card */}
        <Link href="/management/history" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #b91c1c, #f87171)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>היסטוריית גלישה</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              מעקב אחר דפים שמשתמשים ועובדים צפו בהם במערכת ושגיאות טעינה.
            </p>
          </div>
        </Link>

        {/* Calculations and Alerts Card */}
        <Link href="/admin/recalculations" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #c2410c, #fb923c)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>חישובים והתראות</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              סריקת מערכת לאיתור פערים בתשלומים עקב שינויי מדיניות והחלתם על הזמנות קיימות בצורה גורפת.
            </p>
          </div>
        </Link>

        {/* Data Explorer Card */}
        <Link href="/admin/data-explorer" style={{ textDecoration: 'none' }}>
          <div className="dress-card" style={{
            padding: '2.5rem',
            background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.3s',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>סייר נתונים ושאילתות</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              צפייה בטבלאות המערכת, הורדת נתונים, והרצת שאילתות SQL מותאמות אישית.
            </p>
          </div>
        </Link>

      </div>
    </div>
  );
}
