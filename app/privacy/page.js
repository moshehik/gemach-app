// /privacy - מדיניות הפרטיות. עמוד ציבורי, בלי התחברות (הלקוחה רואה אותו מהעמדה או מקישור). הטקסט: ההגדרה privacy_policy_text, ובלעדיה
// ברירת המחדל (lib/privacyPolicyDefault.js, כתובה לפי חוק הגנת הפרטיות; טיוטה לבדיקת עו"ד - ר' docs/customer-consents.md). שם העסק ופרטי הקשר
// נלקחים מהגדרות כל גמ"ח (gmach_name / main_email / gmach_phone / gmach_address), לא מהקוד.
import '@/app/components/public-doc/public-doc.css';
import { loadConsentContext } from '@/lib/consentDocsLoad';
import { getHebrewDateString } from '@/lib/hebrewDate';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'מדיניות פרטיות' };

export default async function PrivacyPage() {
  let privacy;
  let name = '';
  try {
    const ctx = await loadConsentContext();
    privacy = ctx.privacy;
    name = String(ctx.map.get('gmach_name') || '').trim();
  } catch (error) {
    console.error('privacy page: settings unavailable', error);
  }
  if (!privacy) {
    return (
      <main className="pdoc" dir="rtl" lang="he"><div className="pdoc-wrap"><div className="pdoc-card"><p className="pdoc-empty">המדיניות אינה זמינה כרגע. נא לנסות שוב בעוד מספר דקות.</p></div></div></main>
    );
  }
  return (
    <main className="pdoc" dir="rtl" lang="he">
      <div className="pdoc-wrap">
        <header className="pdoc-head">
          {name ? <p className="pdoc-org">{name}</p> : null}
          <h1 className="pdoc-title">מדיניות פרטיות</h1>
        </header>
        <article className="pdoc-card">
          {privacy.blocks.map((b, i) => {
            if (b.type === 'h') return <h2 key={i}>{b.text}</h2>;
            if (b.type === 'ul') return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
            return <p key={i}>{b.text}</p>;
          })}
        </article>
        <p className="pdoc-meta">עודכן לאחרונה: {getHebrewDateString(new Date(`${privacy.updatedAt}T12:00:00Z`))}</p>
        <nav className="pdoc-links" aria-label="מסמכים נוספים"><a href="/terms">צפייה בתקנון</a></nav>
      </div>
    </main>
  );
}
