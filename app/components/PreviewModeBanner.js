// Server component — pure env check, no client fetch needed. Rendered unconditionally
// from app/layout.js so nobody on a Vercel Preview deployment (a PR branch opened by
// the automatic fix-report agent, or a manual dev push) mistakes it for the live site.
// VERCEL_ENV is set automatically by Vercel. Preview deployments deliberately use the
// SAME database as production (see app/lib/prisma.js - no isVercelPreview branch) so a
// reporter can verify a fix against their own real records - only the code/URL is
// temporary here, the data is not. The wording below must stay honest about that: never
// say "test data" here, since anything typed/clicked on this link writes for real.
export default function PreviewModeBanner() {
  if (process.env.VERCEL_ENV !== 'preview') return null;

  return (
    <div className="preview-mode-banner" role="alert">
      <svg className="icon" style={{ width: '15px', height: '15px' }}><use href="#i-alert-tri" /></svg>
      גרסה זמנית לבדיקת תיקון — הקוד כאן זמני, אבל הנתונים הם הנתונים האמיתיים של הגמ״ח
    </div>
  );
}
