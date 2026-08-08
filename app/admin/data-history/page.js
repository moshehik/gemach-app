import Link from 'next/link';
import HistoryViewer from '@/components/HistoryViewer';

export default function DataHistoryPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>היסטוריית נתונים (Audit Log)</h1>
          <p className="page-desc">כאן תוכל לראות את כל שינויי הנתונים שבוצעו במערכת, ברמת הלקוח, ההזמנה, ועוד.</p>
        </div>
        <div className="page-actions">
          <Link href="/admin" className="btn btn-secondary">
            <svg className="icon"><use href="#i-arrow-end" /></svg>
            חזרה לניהול
          </Link>
        </div>
      </div>

      <div className="card card-pad">
        <HistoryViewer data-element-name="רכיב_page_1" />
      </div>
    </>
  );
}
