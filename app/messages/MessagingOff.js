import Link from 'next/link';

// מוצג במקום /messages כשמערכת ההודעות הפנימית כבויה בהגדרות (hide_internal_messaging). אותו מבנה כמו app/components/NoAccessMessage.js.
export default function MessagingOff() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>הודעות פנימיות</h1>
        </div>
      </div>

      <div className="card">
        <div className="empty-state" style={{ padding: '72px 24px' }}>
          <svg className="icon" style={{ width: 52, height: 52 }}>
            <use href="#i-message" />
          </svg>
          <h2 style={{ color: 'var(--text-2)', fontSize: 17, fontWeight: 700, marginTop: 6 }}>
            מערכת ההודעות הפנימית כבויה
          </h2>
          <p>ההודעות בין עובדים כבויות בהגדרות האתר, ולכן העמוד הזה אינו זמין.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 18 }}>
            <svg className="icon">
              <use href="#i-home" />
            </svg>
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    </>
  );
}
