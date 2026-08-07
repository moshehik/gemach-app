import Link from 'next/link';

const categories = [
  {
    title: 'תובנות ודוחות',
    description: 'סקירה, ניתוח וניהול חכם',
    dotColor: 'var(--info)',
    tint: 'var(--info-tint)',
    fg: 'var(--info)',
    items: [
      { href: '/admin/ai', icon: 'i-message', label: 'מערכת AI', subLabel: 'תובנות ודוחות מלל' },
      { href: '/admin/statistics', icon: 'i-activity', label: 'סטטיסטיקה', subLabel: 'דוחות שאילתות' },
      { href: '/admin/ai-history', icon: 'i-history', label: 'היסטוריית AI', subLabel: 'כלל שיחות העוזר' },
      { href: '/dashboard', icon: 'i-grid', label: 'דשבורד', subLabel: 'גרפים ומגמות' },
      { href: '/dashboard/pricelist', icon: 'i-file', label: 'מחירון', subLabel: 'צפייה והדפסה' },
    ]
  },
  {
    title: 'בקרה והתראות',
    description: 'איתור חריגות והגדרות מערכת',
    dotColor: 'var(--danger)',
    tint: 'var(--danger-tint)',
    fg: 'var(--danger)',
    items: [
      { href: '/admin/inventory-alerts', icon: 'i-alert-tri', label: 'התראות מלאי', subLabel: 'בדיקת Overbooking' },
      { href: '/admin/recalculations', icon: 'i-coin', label: 'חישובים', subLabel: 'פערי תשלומים' },
      { href: '/admin/settings', icon: 'i-settings', label: 'הגדרות', subLabel: 'תצורה ולוגו' },
      { href: '/admin/refund-policy', icon: 'i-receipt', label: 'מדיניות זיכויים', subLabel: 'תיעוד חוקי ביטול' },
      { href: '/admin/labels', icon: 'i-tag', label: 'שינוי שמות', subLabel: 'כיתובים וטקסטים' },
      { href: '/admin/trusted-devices', icon: 'i-shield', label: 'מחשבי מערכת מהימנים', subLabel: 'כניסה מהירה ב-4 ספרות' },
      { href: '/admin/audit-system', icon: 'i-check-circle', label: 'מערכת ביקורת (11 סוכנים)', subLabel: 'תיעוד סוכני הבדיקה האוטומטיים' },
    ]
  },
  {
    title: 'נתונים ומערכת',
    description: 'ניהול היסטוריה ומסד הנתונים',
    dotColor: 'var(--success)',
    tint: 'var(--success-tint)',
    fg: 'var(--success)',
    items: [
      { href: '/admin/data-explorer', icon: 'i-search', label: 'סייר נתונים', subLabel: 'שאילתות SQL' },
      { href: '/admin/access-import', icon: 'i-database', label: 'ייבוא מאקסס', subLabel: 'תיעוד תהליך הייבוא' },
      { href: '/admin/setup-new-machine', icon: 'i-download', label: 'התקנה על מחשב חדש', subLabel: 'סקריפט התקנה + תיעוד' },
      { href: '/admin/data-history', icon: 'i-history', label: 'היסטוריית נתונים', subLabel: 'תיעוד שינויים' },
      { href: '/management/database', icon: 'i-database', label: 'גיבוי נתונים', subLabel: 'החלפה מ-JSON' },
      { href: '/management/history', icon: 'i-activity', label: 'היסטוריית גלישה', subLabel: 'דפים ושגיאות' },
    ]
  }
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

      {categories.map((category, catIndex) => (
        <section key={catIndex} style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="dot-badge" aria-hidden="true" style={{ color: category.dotColor }}></span>
            <h2>{category.title}</h2>
          </div>
          <p className="page-desc" style={{ marginBottom: '16px' }}>{category.description}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {category.items.map((item, itemIndex) => (
              <Link className="list-card" href={item.href} key={itemIndex}>
                <div className="kpi-icon" style={{ background: category.tint, color: category.fg }}>
                  <svg className="icon"><use href={`#${item.icon}`} /></svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '14.5px', marginBottom: '2px' }}>{item.label}</h3>
                  <p className="page-desc" style={{ marginTop: 0 }}>{item.subLabel}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
