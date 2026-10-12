import prisma from '../../lib/prisma';
import { loadConsentContext } from '@/lib/consentDocsLoad';
import { currentTermsFile, TERMS_ALLOWED_TYPES, sniffTermsType, hashBytes } from '@/lib/consentDocsServer';
import { admitPublic, clientIpFromHeaders } from '@/lib/publicRateLimit';

// GET /api/public-terms - קובץ התקנון שבתוקף לצפייה (inline), ללא התחברות (לקוחה בעמדה / בקישור). מזרים אך ורק את הקובץ ש-terms_file_id
// מצביע עליו (שהועלה דרך /api/admin/terms-file) - לעולם לא מזהה מהבקשה, ולכן אי אפשר להגיע דרכו לשום Attachment אחר.
// הקובץ מאומת בכל טעינה: סוג מותר (PDF / PNG / JPEG) שתואם את תוכנו, ו-sha256 של התוכן שווה למה שנרשם בהעלאה (אחרת 404 - לא מגישים
// משהו שהוחלף). כותרות: nosniff, CSP שמונע סקריפטים / משאבים, X-Frame-Options SAMEORIGIN (רק האתר עצמו מטמיע), ETag + 304, rate limit לכל IP.
export const dynamic = 'force-dynamic';

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'; frame-ancestors 'self'",
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
};
const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY, ...extra } });

export async function GET(request) {
  const gate = admitPublic(`terms:${clientIpFromHeaders(request.headers)}`);
  if (!gate.ok) return json(429, { error: 'Too many requests' }, { 'Retry-After': String(gate.retryAfterSec) });
  try {
    const { map } = await loadConsentContext();
    const file = currentTermsFile(map);
    if (!file) return json(404, { error: 'No terms file' });

    const etag = `"${file.sha256}"`;
    if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'public, max-age=300, must-revalidate', ...SECURITY } });

    const row = await prisma.attachment.findUnique({ where: { id: file.id }, select: { data: true, contentType: true } });
    if (!row || !row.data) return json(404, { error: 'No terms file' });
    const buf = Buffer.from(row.data);
    // אימות בכל הגשה (sha256 של עד 4MB = כמה מילי-שניות; בקשות חוזרות נענות ב-304 בלי DB): קובץ שהוחלף / שונה ב-DB לא יוגש
    const sniffed = sniffTermsType(buf);
    if (!TERMS_ALLOWED_TYPES[row.contentType] || sniffed !== row.contentType || row.contentType !== file.type || hashBytes(buf) !== file.sha256) {
      console.error('public-terms: configured terms file failed verification (type/hash mismatch) - not served');
      return json(404, { error: 'No terms file' });
    }

    const download = new URL(request.url).searchParams.get('download') === '1';
    const asciiName = `terms.${TERMS_ALLOWED_TYPES[file.type]}`;
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': file.type,
        'Content-Length': String(buf.length),
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        ETag: etag,
        'Cache-Control': 'public, max-age=300, must-revalidate',
        ...SECURITY,
      },
    });
  } catch (error) {
    console.error('public-terms failed:', error);
    return json(500, { error: 'Failed' });
  }
}
