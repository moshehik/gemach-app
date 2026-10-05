import { NextResponse } from 'next/server';
import { checkAuth } from '../../../lib/auth';
import { renderPdf } from '../../../lib/pdf';
import { canUsePrintSurface, PDF_HTML_PAGE_KEYS, printPathPageKeys } from '../../../lib/printAccess';

// Puppeteer spawns a real Chromium process - the Edge runtime can't do that, this route
// needs the Node.js runtime.
export const runtime = 'nodejs';
// A cold Chromium launch plus page render/PDF time can take several seconds on top of the
// platform default - give this route more headroom. (Note: Vercel's Hobby plan caps
// function duration regardless of this value; see the deploy-verification notes for what
// still needs confirming against this app's actual plan.)
export const maxDuration = 60;

// Only the app-relative paths listed in PRINT_PATH_PAGE_KEYS (lib/printAccess.js, resolved by
// printPathPageKeys) may be rendered via Puppeteer's page.goto() - keeps this route from doubling
// as an open same-origin rendering proxy for arbitrary internal pages. Every renderable path is
// also permission-gated - there is no way to allow a path without naming the page permission it needs.

// `html` mode is capped: the only caller (OrderPrintMenu) sends one order/rental report, a few
// hundred KB at most. Anything bigger is not a report and is not worth a Chromium render.
const MAX_HTML_LENGTH = 3 * 1024 * 1024;
// a failed render's technical reason is returned to the (authenticated) caller - cap it
const MAX_DETAIL_LENGTH = 1500;

// POST /api/pdf
// Body (JSON), exactly one of `html` / `path`:
//   { html: '<...>', filename?, landscape?, format? }
//     Renders a self-contained HTML string via page.setContent() - no auth/cookie concerns,
//     used when the caller already has fully server-rendered HTML (e.g. the order/rental
//     report built in app/api/orders/[id]/email/route.js). Needs one of PDF_HTML_PAGE_KEYS
//     (the order pages that contain the only caller). Because the markup is caller-supplied
//     and Chromium runs server-side, renderPdf locks this mode down: JavaScript is off and
//     every network request except inline data: and Google Fonts is blocked (lib/pdf.js).
//   { path: '/print/alterations?...', filename?, landscape?, format? }
//     Renders one of this app's own print pages via page.goto(), forwarding the caller's
//     `auth_token` cookie so an auth-gated page renders real data. `path` must be one of
//     PRINT_PATH_PAGE_KEYS (query string is passed through as-is) and the caller needs the same
//     page permission as that print page (PRINT_PATH_PAGE_KEYS).
// Response: raw `application/pdf` bytes. 401 = not logged in, 403 = logged in without the
// page permission.
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
  if (html !== undefined && html !== null && typeof html !== 'string') {
    return NextResponse.json({ error: 'html חייב להיות מחרוזת' }, { status: 400 });
  }
  if (pagePath !== undefined && pagePath !== null && typeof pagePath !== 'string') {
    return NextResponse.json({ error: 'path לא נתמך' }, { status: 400 });
  }
  if (html && html.length > MAX_HTML_LENGTH) {
    return NextResponse.json({ error: 'ה-html גדול מדי' }, { status: 413 });
  }

  let url;
  let cookieHeader;
  if (pagePath) {
    const pathname = pagePath.split('?')[0];
    const pathKeys = pathname.startsWith('/') ? printPathPageKeys(pathname) : null;
    if (!pathKeys) {
      return NextResponse.json({ error: 'path לא נתמך' }, { status: 400 });
    }
    // Same permission as opening that print page in a tab (its layout.js enforces the same keys
    // again when Chromium loads it with the forwarded cookie - this just fails fast with a 403).
    if (!(await canUsePrintSurface(pathKeys))) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }
    url = new URL(pagePath, request.nextUrl.origin).toString();
    cookieHeader = request.headers.get('cookie') || '';
  } else if (!(await canUsePrintSurface(PDF_HTML_PAGE_KEYS))) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
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
    // the print page itself reported that it has nothing to print (lib/pdf.js, data-print-error) - a clear
    // 422 with the page's own message, not a PDF that contains the error text
    if (err && err.printPageError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    // One structured line for Vercel runtime logs (search "[pdf] generation failed"), then the stack for the same entry.
    const stage = (err && err.pdfStage) || 'unknown';
    const message = String((err && err.message) || err);
    console.error('[pdf] generation failed', JSON.stringify({ stage, mode: html ? 'html' : 'path', htmlChars: html ? html.length : 0, message: message.slice(0, MAX_DETAIL_LENGTH) }));
    if (err && err.stack) console.error(err.stack);
    // detail is intentionally returned (the caller is authenticated and page-permission gated): the owner cannot read Vercel logs from
    // the app, and launch errors (Chromium binary / shared libraries / bundling) are otherwise invisible. Message + stage only - no stack;
    // for a launch failure lib/pdfServerless.js has already folded in the exit code / signal / missing libs / environment fingerprint.
    // `error` stays the first key so older clients that read only `error` keep working; app/lib/pdfClient.js appends a short `detail`.
    return NextResponse.json(
      { error: 'יצירת ה-PDF נכשלה', detail: message.slice(0, MAX_DETAIL_LENGTH), stage },
      { status: 500 }
    );
  }
}
