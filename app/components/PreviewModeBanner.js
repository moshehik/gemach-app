// Server component — pure env check, no client fetch needed. Rendered unconditionally
// from app/layout.js so nobody on a Vercel Preview deployment (a PR branch opened by
// the automatic fix-report agent, or a manual dev push) mistakes it for the live site.
// VERCEL_ENV is set automatically by Vercel; see app/lib/prisma.js for how the same
// flag routes preview traffic to the TEST database instead of prod.
export default function PreviewModeBanner() {
  if (process.env.VERCEL_ENV !== 'preview') return null;

  return (
    <div className="preview-mode-banner" role="alert">
      <svg className="icon" style={{ width: '15px', height: '15px' }}><use href="#i-alert-tri" /></svg>
      גרסה זמנית לבדיקה — לא הגרסה החיה, הנתונים כאן הם נתוני בדיקה בלבד
    </div>
  );
}
