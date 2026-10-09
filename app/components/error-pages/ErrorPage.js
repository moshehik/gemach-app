'use client';

// עמוד שגיאה בעיצוב האתר (A5): כרטיס זכוכית שקופה במרכז - מדליה מונפשת עם אייקון, המספר, כותרת, משפט קצר, ושני קישורים בלבד:
// "חזרה לדף הבית" ו"חזרה לדף הקודם". בלי מזהה תקלה / תאריך / שעה / פרטים טכניים (החלטת הבעלים 9.10.2026, לפי הסימולציה
// תצוגות-עיצוב/דפי-תקלות). משמש את app/not-found.js (404) ו-app/error.js (500).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '@/design-system/components.css';
import './error-pages.css';

export default function ErrorPage({ code, title, text, icon = 'alert-circle' }) {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };
  return (
    <div className="gm-ds gm-err home-bg" dir="rtl">
      <section className="e-card" role="alert" aria-labelledby="gm-err-t">
        <div className="e-medal" aria-hidden="true"><svg className="icon"><use href={`#i-${icon}`} /></svg></div>
        <div className="e-code" dir="ltr">{code}</div>
        <div className="e-orn" aria-hidden="true"><i /></div>
        <h1 id="gm-err-t">{title}</h1>
        <p className="e-sub">{text}</p>
        <div className="e-acts">
          <Link href="/" className="e-btn primary"><svg className="icon" aria-hidden="true"><use href="#i-home" /></svg>חזרה לדף הבית</Link>
          <button type="button" className="e-btn ghost" onClick={goBack}><svg className="icon" aria-hidden="true"><use href="#i-chevron-end" /></svg>חזרה לדף הקודם</button>
        </div>
      </section>
    </div>
  );
}
