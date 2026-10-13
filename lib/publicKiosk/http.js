// lib/publicKiosk/http.js - עזרים משותפים לנתיבי /api/public-kiosk/*: תשובות JSON אחידות, מגבלת קצב, קריאת גוף בטוחה.
import { NextResponse } from 'next/server';
import { checkRate, clientIp } from '@/lib/publicKiosk/rateLimit';
import { MAX_BODY_BYTES } from '@/lib/publicKiosk/registrationInput';

const BASE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };

export function publicJson(data, status = 200, extraHeaders = {}) {
  return NextResponse.json(data, { status, headers: { ...BASE_HEADERS, 'Cache-Control': 'no-store', ...extraHeaders } });
}

/** null אם מותר להמשיך, אחרת תשובת 429 מוכנה. */
export function rateLimited(request, kind) {
  const r = checkRate(kind, clientIp(request.headers));
  if (r.ok) return null;
  return publicJson({ ok: false, code: 'rate_limited', error: 'יותר מדי בקשות. נסו שוב בעוד רגע.' }, 429, { 'Retry-After': String(r.retryAfterSec || 30) });
}

/** גוף JSON מוגבל בגודל. מחזיר { body } או { error: Response }. */
export async function readJsonBody(request) {
  const ct = String(request.headers.get('content-type') || '').toLowerCase();
  if (!ct.startsWith('application/json')) return { error: publicJson({ ok: false, code: 'bad_request', error: 'בקשה לא תקינה' }, 415) };
  const declared = parseInt(request.headers.get('content-length') || '0', 10);
  if (declared > MAX_BODY_BYTES) return { error: publicJson({ ok: false, code: 'too_large', error: 'הבקשה גדולה מדי' }, 413) };
  let text;
  try { text = await request.text(); } catch (e) { return { error: publicJson({ ok: false, code: 'bad_request', error: 'בקשה לא תקינה' }, 400) }; }
  if (text.length > MAX_BODY_BYTES) return { error: publicJson({ ok: false, code: 'too_large', error: 'הבקשה גדולה מדי' }, 413) };
  try { return { body: JSON.parse(text) }; } catch (e) { return { error: publicJson({ ok: false, code: 'bad_request', error: 'בקשה לא תקינה' }, 400) }; }
}
