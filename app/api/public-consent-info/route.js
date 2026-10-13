import { NextResponse } from 'next/server';
import { loadConsentContext } from '@/lib/consentDocsLoad';
import { consentConfig, TERMS_LABEL, PRIVACY_LABEL, MARKETING_LABEL, MARKETING_DETAIL, MARKETING_WORDING_VERSION } from '@/lib/customerConsent';
import { admitPublic, clientIpFromHeaders } from '@/lib/publicRateLimit';

// GET /api/public-consent-info - מה הלקוחה צריכה כדי לאשר: הקישורים לתקנון ולפרטיות, גרסאות המסמכים שבתוקף (לשליחה חזרה בטופס כ-termsVersion /
// privacyVersion), הנוסחים, ומה חובה. ללא התחברות (עמדת הלקוח, טפסי העובדים). בלי נתונים רגישים: רק מטא-דאטה של מסמכים פומביים.
// החוזה לסוכני העמדה: docs/customer-consents.md, "חוזה לעמדת הלקוח".
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const gate = admitPublic(`consent-info:${clientIpFromHeaders(request.headers)}`);
  if (!gate.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(gate.retryAfterSec) } });
  try {
    const { map, docs } = await loadConsentContext();
    const cfg = consentConfig(map);
    return NextResponse.json({
      enabled: cfg.enabled,
      hideMarketing: cfg.hideMarketing,
      requirePrivacy: cfg.requirePrivacy,
      requireMarketingYes: cfg.requireMarketingYes,
      terms: { hasFile: docs.hasTermsFile, version: docs.termsVersion, name: docs.termsName, type: docs.termsType, uploadedAt: docs.termsUploadedAt, pageUrl: '/terms', fileUrl: docs.hasTermsFile ? '/api/public-terms' : null, label: TERMS_LABEL },
      privacy: { version: docs.privacyVersion, updatedAt: docs.privacyUpdatedAt, pageUrl: '/privacy', label: PRIVACY_LABEL },
      marketing: { label: MARKETING_LABEL, detail: MARKETING_DETAIL, wordingVersion: MARKETING_WORDING_VERSION },
    }, { headers: { 'Cache-Control': 'public, max-age=30, must-revalidate', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    console.error('public-consent-info failed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
