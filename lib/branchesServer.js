// lib/branchesServer.js - צד שרת של ריבוי הסניפים: טעינת ההגדרות מהמטמון (lib/settingsCache.js) ואכיפת "כבוי = כמו היום".
// הלוגיקה הטהורה (פענוח, ולידציה, יכולות) ב-lib/branches.js.
import { getAllCachedSettings } from '@/lib/settingsCache';
import { branchConfigFromSettings, isMultiBranchEnabled, resolveBranchNoticeSettings } from '@/lib/branches';

/**
 * @returns {Promise<{ map: Record<string,string>, enabled: boolean, cfg: {branches: object[], derived: boolean}, notice: ReturnType<typeof resolveBranchNoticeSettings> }>}
 * שגיאת DB = כבוי (fail-open לכיוון ההתנהגות הקיימת).
 */
export async function loadBranchContext() {
  let rows = [];
  try { rows = (await getAllCachedSettings()) || []; } catch { rows = []; }
  const map = {};
  for (const r of rows) if (r && r.key) map[r.key] = r.value;
  return { map, enabled: isMultiBranchEnabled(map), cfg: branchConfigFromSettings(map), notice: resolveBranchNoticeSettings(map) };
}
