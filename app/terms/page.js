// /terms - התקנון לצפייה. עמוד ציבורי, בלי התחברות: מציג מוטמע את הקובץ שהועלה בהגדרות (GET /api/public-terms - PDF או תמונה), עם קישור
// להורדה ולפתיחה בלשונית נפרדת. בלי קובץ מוגדר - הודעה ברורה (לא טקסט מומצא).
import '@/app/components/public-doc/public-doc.css';
import { loadConsentContext } from '@/lib/consentDocsLoad';
import { getHebrewDateString } from '@/lib/hebrewDate';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'תקנון' };

export default async function TermsPage() {
  let docs = null;
  let name = '';
  try {
    const ctx = await loadConsentContext();
    docs = ctx.docs;
    name = String(ctx.map.get('gmach_name') || '').trim();
  } catch (error) {
    console.error('terms page: settings unavailable', error);
  }
  const hasFile = !!(docs && docs.hasTermsFile);
  const isImage = hasFile && docs.termsType !== 'application/pdf';
  const src = hasFile ? `/api/public-terms?v=${encodeURIComponent((docs.termsVersion || '').slice(0, 12))}` : null;
  return (
    <main className="pdoc" dir="rtl" lang="he">
      <div className="pdoc-wrap">
        <header className="pdoc-head">
          {name ? <p className="pdoc-org">{name}</p> : null}
          <h1 className="pdoc-title">תקנון</h1>
        </header>
        <section className="pdoc-card" aria-label="תקנון">
          {!hasFile ? (
            <p className="pdoc-empty">התקנון אינו זמין לצפייה כאן כרגע. ניתן לבקש לעיין בו בחנות.</p>
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- התקנון כתמונה: מוגש מהנתיב הציבורי, בלי עיבוד
            <img className="pdoc-img" src={src} alt="התקנון" />
          ) : (
            <iframe className="pdoc-frame" src={src} title="התקנון" />
          )}
        </section>
        {hasFile ? (
          <>
            <nav className="pdoc-links" aria-label="פעולות על התקנון">
              <a href="/api/public-terms" target="_blank" rel="noopener noreferrer">פתיחה בלשונית חדשה</a>
              <a href="/api/public-terms?download=1">הורדת הקובץ</a>
              <a href="/privacy">מדיניות פרטיות</a>
            </nav>
            {docs.termsUploadedAt ? <p className="pdoc-meta">גרסה מתאריך: {getHebrewDateString(new Date(docs.termsUploadedAt))}</p> : null}
          </>
        ) : (
          <nav className="pdoc-links" aria-label="מסמכים נוספים"><a href="/privacy">מדיניות פרטיות</a></nav>
        )}
      </div>
    </main>
  );
}
