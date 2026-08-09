import Link from 'next/link';

// Shared "no access" page body — Next.js special-file convention doesn't cover this case
// (that's only not-found.js), so it's a plain component rendered by the 3 role-guarded
// layouts (app/admin/layout.js, app/employees/layout.js, app/refunds/layout.js) in place
// of their previous redirect('/') on failed checkPageAccess().
// Built from scratch/design-v2/fragments/no-access.html — structure/classes copied as-is,
// icons swapped from the fragment's static ../assets/icons.svg reference to the real app's
// IconSprite (rendered once in app/layout.js, referenced here via #i-name), same pattern
// as app/not-found.js.
export default function NoAccessMessage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>אין הרשאת גישה</h1>
        </div>
      </div>

      <div className="card">
        <div className="empty-state" style={{ padding: '72px 24px' }}>
          <svg className="icon" style={{ width: 52, height: 52 }}>
            <use href="#i-lock" />
          </svg>
          <h2 style={{ color: 'var(--text-2)', fontSize: 17, fontWeight: 700, marginTop: 6 }}>
            אין לך הרשאה לצפות בעמוד זה
          </h2>
          <p>העמוד המבוקש מוגבל להרשאות מסוימות בלבד. אם לדעתך זו טעות, פנה/י למנהל המערכת.</p>
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
