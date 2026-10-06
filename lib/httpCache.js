// כותרות מטמון דפדפן לקריאות GET של נתוני ייחוס (CPU phase 1B, 2026-10-06): labels, settings, pricelists (+categories), inventory/models.
//
// Cache-Control: private, max-age=60, stale-while-revalidate=300 + ETag חלש (גיבוב של גוף התשובה) עם 304 על If-None-Match:
//  - private + Vary: Cookie: רק מטמון הדפדפן של אותו משתמש (התשובה של /api/settings תלויה בהתחברות - הערות ימי אי-הפעילות מוסרות מאורח), בלי CDN/פרוקסי משותף.
//  - max-age חוסך את הקריאה כולה בטעינה חוזרת / בקריאות fetch גולמיות (בלי אפשרות cache); ה-ETag חוסך את הגוף כשנשאלת שוב אחרי שפג.
//  - המטמון המשותף של האפליקציה (lib/apiCache.js, fetchSharedJson) קורא עם cache:'no-store' ולכן אף פעם לא רואה כאן נתון ישן אחרי כתיבה;
//    מסכי עריכה שקוראים fetch גולמי משתמשים ב-cache:'no-store' או 'reload' (ר' docs/cpu-phase1b-slim-2026-10-06.md).
// ?fresh=1 (מסכי עריכת הגדרות) מחזיר no-store.

import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

export const REFERENCE_CACHE_CONTROL = 'private, max-age=60, stale-while-revalidate=300';
export const NO_STORE = 'no-store';

export function weakEtag(text) {
  return `W/"${createHash('sha1').update(text).digest('base64url').slice(0, 27)}"`;
}

// If-None-Match יכול להכיל כמה ערכים או *; השוואה חלשה (בלי קידומת W/)
function etagMatches(header, etag) {
  if (!header) return false;
  const norm = (s) => s.trim().replace(/^W\//, '');
  const mine = norm(etag);
  return header.split(',').some((v) => v.trim() === '*' || norm(v) === mine);
}

/**
 * תשובת JSON עם כותרות מטמון + ETag, או 304 כשה-ETag תואם. request יכול להיות undefined (קריאה ישירה בבדיקות).
 * options: { cacheControl = REFERENCE_CACHE_CONTROL, status = 200 }
 */
export function cachedJson(request, body, { cacheControl = REFERENCE_CACHE_CONTROL, status = 200 } = {}) {
  const text = JSON.stringify(body);
  const headers = { 'Cache-Control': cacheControl, Vary: 'Cookie' };
  if (cacheControl !== NO_STORE) {
    const etag = weakEtag(text);
    headers.ETag = etag;
    const inm = request && request.headers && typeof request.headers.get === 'function' ? request.headers.get('if-none-match') : null;
    if (status === 200 && etagMatches(inm, etag)) return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(text, { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
