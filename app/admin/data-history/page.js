import HistoryViewer from '@/components/HistoryViewer';

export default function DataHistoryPage() {
  return (
    <div className="container animate-fade-in" style={{ paddingTop: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary-color)' }}>היסטוריית נתונים (Audit Log)</h1>
        <a href="/admin" style={{
          textDecoration: 'none',
          color: 'var(--text-muted)',
          padding: '0.5rem 1rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          background: 'var(--card-bg)'
        }}>
          חזרה לניהול
        </a>
      </div>
      
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.1rem' }}>
        כאן תוכל לראות את כל שינויי הנתונים שבוצעו במערכת, ברמת הלקוח, ההזמנה, ועוד.
      </p>

      <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <HistoryViewer />
      </div>
    </div>
  );
}
