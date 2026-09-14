import Link from 'next/link';

const cards = [
  {
    href: '/admin/settings',
    icon: 'i-settings',
    label: 'הגדרות מערכת',
    desc: 'תצורה, מיתוג, מדיניות תשלומים, ברקודים, הודעות, אוטומציה וסנכרון',
  },
  {
    href: '/admin/site',
    icon: 'i-grid',
    label: 'ניהול אתר',
    desc: 'דוחות ותובנות, בקרה והתראות, נתונים ומערכת',
  },
];

export default function AdminHubPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>מסך ניהול ראשי</h1>
          <p className="page-desc">מרכז שליטה ובקרה למנהלי המערכת. בחר את הכלי הרצוי מטה.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '700px' }}>
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="list-card"
            style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '28px', gap: '14px' }}
          >
            <div className="kpi-icon" style={{ width: '52px', height: '52px', background: 'var(--primary-tint)', color: 'var(--primary)' }}>
              <svg className="icon" style={{ width: '24px', height: '24px' }}><use href={`#${card.icon}`} /></svg>
            </div>
            <div>
              <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>{card.label}</h2>
              <p className="page-desc" style={{ marginTop: 0 }}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
