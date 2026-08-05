import { NextResponse } from 'next/server';
import { checkAuth } from '../../../lib/auth';
import { renderPdf } from '../../../lib/pdf';

// Puppeteer spawns a real Chromium process - the Edge runtime can't do that, this route
// needs the Node.js runtime.
export const runtime = 'nodejs';
// A cold Chromium launch plus page render/PDF time can take several seconds on top of the
// platform default - give this route more headroom. (Note: Vercel's Hobby plan caps
// function duration regardless of this value; see the deploy-verification notes for what
// still needs confirming against this app's actual plan.)
export const maxDuration = 60;

// Only these app-relative paths may be rendered via Puppeteer's page.goto() - keeps this
// route from doubling as an open same-origin rendering proxy for arbitrary internal pages.
const ALLOWED_URL_PATHS = new Set(['/print/order', '/print/alterations']);

// POST /api/pdf
// Body (JSON), exactly one of `html` / `path`:
//   { html: '<...>', filename?, landscape?, format? }
//     Renders a self-contained HTML string via page.setContent() - no auth/cookie concerns,
//     used when the caller already has fully server-rendered HTML (e.g. the order/rental
//     report built in app/api/orders/[id]/email/route.js).
//   { path: '/print/alterations?...', filename?, landscape?, format? }
//     Renders one of this app's own print pages via page.goto(), forwarding the caller's
//     `auth_token` cookie so an auth-gated page renders real data. `path` must be one of
//     ALLOWED_URL_PATHS (query string is passed through as-is).
// Response: raw `application/pdf` bytes.
export async function POST(request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'גוף הבקשה אינו JSON תקין' }, { status: 400 });
  }

  const { html, path: pagePath, filename, landscape, format } = body || {};

  if (!html && !pagePath) {
    return NextResponse.json({ error: 'יש לספק html או path' }, { status: 400 });
  }
  if (html && pagePath) {
    return NextResponse.json({ error: 'יש לספק html או path, לא את שניהם' }, { status: 400 });
  }

  let url;
  let cookieHeader;
  if (pagePath) {
    const pathname = pagePath.split('?')[0];
    if (!pathname.startsWith('/') || !ALLOWED_URL_PATHS.has(pathname)) {
      return NextResponse.json({ error: 'path לא נתמך' }, { status: 400 });
    }
    url = new URL(pagePath, request.nextUrl.origin).toString();
    cookieHeader = request.headers.get('cookie') || '';
  }

  try {
    const pdfBuffer = await renderPdf({
      html,
      url,
      cookieHeader,
      landscape: !!landscape,
      format: format || 'A4',
    });

    const HEBREW_RANGE_START = '֐';
    const HEBREW_RANGE_END = '׿';
    const safeNameChars = new RegExp(`[^\\w\\-. ${HEBREW_RANGE_START}-${HEBREW_RANGE_END}]`, 'g');
    const safeName = (filename || 'document').replace(safeNameChars, '').trim() || 'document';
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('PDF generation failed:', err);
    return NextResponse.json({ error: 'יצירת ה-PDF נכשלה' }, { status: 500 });
  }
}
