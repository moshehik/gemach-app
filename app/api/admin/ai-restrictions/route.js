import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import { AI_FEATURES, BASE_PROMPT_SUMMARY } from '../../../../lib/ai/restrictionsRegistry';
import { AI_WHITELISTS } from '../../../../lib/ai/whitelistRegistry';
import { getFeatureRestrictionConfig, setFeatureRestrictionConfig } from '../../../../lib/ai/restrictionsConfig';

// Head-management-only, same gate as the admin SQL generator (app/api/admin/ai-sql-generate/route.js)
// — this manages what Gemini is/isn't told across every AI feature, so it gets the strictest
// existing precedent rather than the plain feature:ai gate. The /admin/* layout (app/admin/layout.js)
// already blocks the page itself the same way; this route needs its own check since API routes
// aren't covered by that layout.
async function requireHeadManagement() {
  return checkAuth('הנהלה ראשית');
}

export async function GET() {
  if (!(await requireHeadManagement())) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  const featuresWithConfig = await Promise.all(
    AI_FEATURES.map(async (feature) => ({
      key: feature.key,
      label: feature.label,
      route: feature.route,
      uiEntryPoint: feature.uiEntryPoint,
      description: feature.description,
      hardGuards: feature.hardGuards,
      restrictions: feature.restrictions.map((r) => ({
        id: r.id,
        label: r.label,
        description: r.description,
        level: r.level,
        defaultEnabled: r.defaultEnabled,
        roleConditional: !!r.roleConditional,
        wired: !!r.wired,
        note: r.note || null,
      })),
      presets: feature.presets,
      supportsCustomText: !!feature.supportsCustomText,
      whitelist: AI_WHITELISTS[feature.key] || null,
      config: await getFeatureRestrictionConfig(feature.key),
    }))
  );

  return NextResponse.json({ features: featuresWithConfig, basePrompt: BASE_PROMPT_SUMMARY });
}

export async function PUT(req) {
  if (!(await requireHeadManagement())) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { featureKey, config } = body || {};
    if (!featureKey || typeof featureKey !== 'string' || !config || typeof config !== 'object') {
      return NextResponse.json({ error: 'featureKey and config are required' }, { status: 400 });
    }

    const saved = await setFeatureRestrictionConfig(featureKey, config);
    return NextResponse.json({ success: true, config: saved });
  } catch (error) {
    console.error('PUT /api/admin/ai-restrictions error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save' }, { status: 400 });
  }
}
