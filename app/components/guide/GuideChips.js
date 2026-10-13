'use client';

// GuideChips - כפתור "הצג לי" מתחת לתשובת עוזר ה-AI שהחזירה `guide` (lib/ai/siteGuide.js). לחיצה מפעילה את GuideProvider (window.gmGuide.show)
// שמנווט לדף ומדגיש את האלמנט; אם ה-Provider לא נטען (דף ללא מעטפת) - נופל לקישור העומק `guideHref`.
// משותף לכל המקומות שמציגים תשובות /api/ai: הווידג'ט הצף, חיפוש דף הבית, /admin/ai.
import { useRouter } from 'next/navigation';

export default function GuideChips({ guide, guideHref, compact = false }) {
  const router = useRouter();
  const steps = Array.isArray(guide) ? guide.filter((s) => s && typeof s.id === 'string') : [];
  if (!steps.length) return null;
  const ids = steps.map((s) => s.id);
  const label = steps.length > 1 ? `הצג לי (${steps.length} שלבים)` : `הצג לי: ${steps[0].label}`;
  const show = () => {
    if (typeof window !== 'undefined' && window.gmGuide && window.gmGuide.show(ids)) return;
    if (guideHref) router.push(guideHref);
  };
  return (
    <div className="gm-guide-chips" style={{ marginTop: compact ? 6 : 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <button
        type="button"
        onClick={show}
        data-guide-chip=""
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999,
          border: '1.5px solid var(--gm-gold-d, #9a7a1f)', background: 'var(--gm-gbtn, linear-gradient(135deg, #d9b84a 0%, #b8912f 100%))',
          color: 'var(--gm-navy-900, #0a2242)', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
        aria-label={steps.length > 1 ? `הצג לי בדף: ${steps.map((s) => s.label).join(', ')}` : `הצג לי בדף: ${steps[0].label}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
        {label}
      </button>
    </div>
  );
}
