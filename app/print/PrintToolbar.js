'use client';
// סרגל מסך בלבד לדפי ההדפסה (v3). מוסתר לגמרי בהדפסה וב-PDF (@media print) — מסמך ההדפסה
// עצמו נשאר ניטרלי (צבעים קשיחים, בלי tokens). לא נוגע ב-data-print-ready ולא בהדפסה האוטומטית.
// אזהרה: אין להכניס "sidebar" לשמות מחלקות כאן — דפי ההדפסה מסתירים [class*="sidebar"].
import V3Page from '@/app/v3/ui/V3Page';
import Btn from '@/app/v3/ui/Btn';

export default function PrintToolbar({ title = 'תצוגה מקדימה להדפסה', hint = 'חלון ההדפסה נפתח אוטומטית. אפשר גם להדפיס ידנית.' }) {
  return (
    <V3Page page={false} className="ptb-bar" data-print-hide="">
      <style>{`
        .ptb-bar {
          display: flex; align-items: center; gap: var(--v3-sp-3); flex-wrap: wrap;
          max-width: 960px; margin: var(--v3-sp-4) auto 0; padding: var(--v3-sp-3) var(--v3-sp-4);
          background: var(--v3-surface); border: 1px solid var(--v3-line-soft); border-radius: var(--v3-r-lg);
          font-family: var(--v3-font); font-size: var(--v3-fs-base); color: var(--v3-ink);
        }
        .ptb-text { display: flex; flex-direction: column; gap: 2px; margin-inline-end: auto; }
        .ptb-title { font-size: var(--v3-fs-lg); font-weight: 600; }
        .ptb-hint { font-size: var(--v3-fs-sm); color: var(--v3-ink-3); }
        @media print { .ptb-bar { display: none !important; } }
      `}</style>
      <div className="ptb-text">
        <span className="ptb-title">{title}</span>
        <span className="ptb-hint">{hint}</span>
      </div>
      <Btn variant="primary" icon="print" onClick={() => window.print()}>הדפסה</Btn>
      <Btn variant="quiet" icon="close" onClick={() => window.close()}>סגירה</Btn>
    </V3Page>
  );
}
