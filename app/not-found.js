import Link from 'next/link';

// Global 404 page — Next.js special-file convention (app/not-found.js).
// Rendered inside AppShell automatically via app/layout.js.
// Built from scratch/design-v2/fragments/not-found.html (design-v2 spec) —
// structure/classes copied as-is, icons swapped from the fragment's static
// ../assets/icons.svg reference to the real app's IconSprite (rendered once
// in app/layout.js, referenced here via #i-name, same as every other page).
export default function NotFound() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>הדף לא נמצא</h1>
        </div>
      </div>

      <div className="card">
        <div className="empty-state" style={{ padding: '72px 24px' }}>
          <svg className="icon" style={{ width: 52, height: 52 }}>
            <use href="#i-alert-circle" />
          </svg>
          <h2 style={{ color: 'var(--text-2)', fontSize: 17, fontWeight: 700, marginTop: 6 }}>
            404 — הדף שחיפשת לא קיים
          </h2>
          <p>ייתכן שהקישור שגוי, שהעמוד הוסר, או שהכתובת השתנתה. אפשר לחזור לדף הבית ולנסות משם.</p>
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
