// lib/ai/restrictionsConfig.js — reads/writes the admin-editable override for each AI feature's
// SOFT restrictions (see lib/ai/restrictionsRegistry.js for what "soft" means and the hard-guard
// safety boundary). Stored as one SystemSetting row per feature, key `ai_restrictions_<featureKey>`,
// value = JSON string. A MISSING row means "use the registry's own defaults, unchanged" — so this
// feature is purely additive: until an admin actually saves something on /admin/ai-restrictions,
// every route behaves exactly as it did before this file existed.
//
// This module ONLY composes PROMPT TEXT (or, for the one documented exception —
// financial_columns_orders on smart_search — a column-selection decision made directly in that
// route's own code). It never touches auth, SQL-guard, or DB-scoping logic.

import { getCachedSetting } from '@/lib/settingsCache';
import prisma from '@/app/lib/prisma';
import { invalidateSettingsCache } from '@/lib/settingsCache';
import { getFeatureDef } from './restrictionsRegistry';

export const SETTING_KEY_PREFIX = 'ai_restrictions_';

function defaultConfigFor(feature) {
  return {
    enabledIds: (feature?.restrictions || []).filter((r) => r.defaultEnabled).map((r) => r.id),
    custom: [],
    whitelistMode: false,
    whitelist: [],
  };
}

export async function getFeatureRestrictionConfig(featureKey) {
  const feature = getFeatureDef(featureKey);
  const defaults = defaultConfigFor(feature);
  if (!feature) return defaults;
  try {
    const row = await getCachedSetting(SETTING_KEY_PREFIX + featureKey);
    if (!row || !row.value) return defaults;
    const parsed = JSON.parse(row.value);
    return {
      enabledIds: Array.isArray(parsed.enabledIds) ? parsed.enabledIds : defaults.enabledIds,
      custom: Array.isArray(parsed.custom) ? parsed.custom.filter((c) => typeof c === 'string' && c.trim()) : [],
      whitelistMode: !!parsed.whitelistMode,
      whitelist: Array.isArray(parsed.whitelist) ? parsed.whitelist : [],
    };
  } catch (e) {
    console.error(`getFeatureRestrictionConfig(${featureKey}) parse error, falling back to defaults:`, e.message);
    return defaults;
  }
}

export async function setFeatureRestrictionConfig(featureKey, config) {
  const feature = getFeatureDef(featureKey);
  if (!feature) throw new Error(`Unknown AI feature key: ${featureKey}`);

  const validIds = new Set(feature.restrictions.map((r) => r.id));
  const enabledIds = Array.isArray(config.enabledIds) ? config.enabledIds.filter((id) => validIds.has(id)) : [];
  const custom = feature.supportsCustomText && Array.isArray(config.custom)
    ? config.custom.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim().slice(0, 2000)).slice(0, 20)
    : [];
  const whitelistMode = !!config.whitelistMode;
  const whitelist = Array.isArray(config.whitelist) ? config.whitelist.filter((w) => typeof w === 'string').slice(0, 200) : [];

  const value = JSON.stringify({ enabledIds, custom, whitelistMode, whitelist });
  const key = SETTING_KEY_PREFIX + featureKey;

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value, name: `מגבלות AI — ${feature.label}`, category: 'בינה מלאכותית', type: 'json' },
  });
  invalidateSettingsCache();

  return { enabledIds, custom, whitelistMode, whitelist };
}

export function isRestrictionEnabled(featureKey, config, restrictionId) {
  const feature = getFeatureDef(featureKey);
  const restriction = feature?.restrictions.find((r) => r.id === restrictionId);
  if (!restriction) return false;
  if (!config || !Array.isArray(config.enabledIds)) return !!restriction.defaultEnabled;
  return config.enabledIds.includes(restrictionId);
}

// Composes the prompt text for every ENABLED (or explicitly-disabled-with-text) restriction of a
// feature, skipping any id in excludeIds (used when a route already handles a restriction with its
// own special-cased logic, e.g. financial_data being role-conditional in app/api/ai/route.js).
export function buildRestrictionPromptBlock(featureKey, config, { excludeIds = [] } = {}) {
  const feature = getFeatureDef(featureKey);
  if (!feature) return '';
  const lines = [];
  for (const r of feature.restrictions) {
    if (excludeIds.includes(r.id)) continue;
    const enabled = isRestrictionEnabled(featureKey, config, r.id);
    const text = enabled ? r.promptWhenEnabled : (r.promptWhenDisabled || '');
    if (text) lines.push(text);
  }
  if (feature.supportsCustomText && Array.isArray(config?.custom)) {
    for (const c of config.custom) {
      if (c && c.trim()) lines.push(`\nADMIN-DEFINED RULE (Hebrew, added via /admin/ai-restrictions): ${c.trim()}`);
    }
  }
  return lines.join('');
}
