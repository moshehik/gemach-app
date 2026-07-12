import Link from 'next/link';
import { 
  Bot, 
  BarChart3, 
  LayoutDashboard, 
  FileText, 
  AlertTriangle, 
  Calculator, 
  Settings, 
  DatabaseBackup, 
  History, 
  Search, 
  Activity 
} from 'lucide-react';

const categories = [
  {
    title: 'תובנות ודוחות',
    description: 'סקירה, ניתוח וניהול חכם',
    color: '#3b82f6', // blue
    colorVars: { '--cat-color': '#3b82f6', '--cat-bg': '#3b82f615' },
    items: [
      { href: '/admin/ai', icon: Bot, label: 'מערכת AI', subLabel: 'תובנות ודוחות מלל' },
      { href: '/admin/statistics', icon: BarChart3, label: 'סטטיסטיקה', subLabel: 'דוחות שאילתות' },
      { href: '/dashboard', icon: LayoutDashboard, label: 'דשבורד', subLabel: 'גרפים ומגמות' },
      { href: '/dashboard/pricelist', icon: FileText, label: 'מחירון', subLabel: 'צפייה והדפסה' },
    ]
  },
  {
    title: 'בקרה והתראות',
    description: 'איתור חריגות והגדרות מערכת',
    color: '#ef4444', // red
    colorVars: { '--cat-color': '#ef4444', '--cat-bg': '#ef444415' },
    items: [
      { href: '/admin/inventory-alerts', icon: AlertTriangle, label: 'התראות מלאי', subLabel: 'בדיקת Overbooking' },
      { href: '/admin/recalculations', icon: Calculator, label: 'חישובים', subLabel: 'פערי תשלומים' },
      { href: '/admin/settings', icon: Settings, label: 'הגדרות', subLabel: 'תצורה ולוגו' },
      { href: '/admin/labels', icon: Settings, label: 'שינוי שמות', subLabel: 'כיתובים וטקסטים' },
    ]
  },
  {
    title: 'נתונים ומערכת',
    description: 'ניהול היסטוריה ומסד הנתונים',
    color: '#10b981', // green
    colorVars: { '--cat-color': '#10b981', '--cat-bg': '#10b98115' },
    items: [
      { href: '/admin/data-explorer', icon: Search, label: 'סייר נתונים', subLabel: 'שאילתות SQL' },
      { href: '/admin/data-history', icon: History, label: 'היסטוריית נתונים', subLabel: 'תיעוד שינויים' },
      { href: '/management/database', icon: DatabaseBackup, label: 'גיבוי נתונים', subLabel: 'החלפה מ-JSON' },
      { href: '/management/history', icon: Activity, label: 'היסטוריית גלישה', subLabel: 'דפים ושגיאות' },
    ]
  }
];

export default function AdminHubPage() {
  return (
    <div className="container animate-fade-in" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
      
      <style dangerouslySetInnerHTML={{__html: `
        .admin-card {
          padding: 1.5rem;
          background-color: var(--card-bg, #ffffff);
          border-radius: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 1.25rem;
          cursor: pointer;
          height: 100%;
        }
        
        @media (prefers-color-scheme: dark) {
          .admin-card {
            background-color: var(--background, #1e293b);
            border-color: #334155;
          }
        }
        
        .admin-card:hover {
          border-color: var(--cat-color);
          box-shadow: 0 10px 25px -5px var(--cat-color);
          transform: translateY(-4px);
        }
        
        .admin-card-icon {
          background-color: var(--cat-bg);
          color: var(--cat-color);
          padding: 1rem;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        
        .admin-card:hover .admin-card-icon {
          background-color: var(--cat-color);
          color: #ffffff;
        }
        
        .admin-card-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--foreground, #1e293b);
          margin-bottom: 0.2rem;
          transition: color 0.2s;
        }
        
        @media (prefers-color-scheme: dark) {
          .admin-card-title {
            color: #f8fafc;
          }
        }
        
        .admin-card:hover .admin-card-title {
          color: var(--cat-color);
        }
        
        .admin-card-subtitle {
          font-size: 0.85rem;
          color: var(--text-muted, #64748b);
          margin: 0;
          line-height: 1.2;
        }
      `}} />

      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '0.5rem' }}>
          מסך ניהול ראשי
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          מרכז שליטה ובקרה למנהלי המערכת. בחר את הכלי הרצוי מטה.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
        {categories.map((category, catIndex) => (
          <section key={catIndex}>
            <div style={{ marginBottom: '1.5rem', borderBottom: `2px solid ${category.color}33`, paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--foreground)' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  backgroundColor: category.color,
                  marginLeft: '10px'
                }}></span>
                {category.title}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem', paddingRight: '22px' }}>
                {category.description}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1.5rem'
            }}>
              {category.items.map((item, itemIndex) => {
                const Icon = item.icon;
                
                return (
                  <Link href={item.href} key={itemIndex} style={{ textDecoration: 'none' }}>
                    <div className="admin-card" style={category.colorVars}>
                      <div className="admin-card-icon">
                        <Icon size={28} strokeWidth={2} />
                      </div>
                      
                      <div>
                        <h3 className="admin-card-title">
                          {item.label}
                        </h3>
                        <p className="admin-card-subtitle">
                          {item.subLabel}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
