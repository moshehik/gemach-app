import { getAllCachedSettings } from '@/lib/settingsCache';

/**
 * Resolves the Nedarim Plus institution number (Mosad/MosadId) the same way across
 * every Nedarim-related admin route: an explicit per-call override, then the
 * NEDARIM_MOSAD_ID env var, then the nedarim_plus_terminal/NEDARIM_MOSAD
 * SystemSetting (kept in sync with each other by app/api/settings/route.js).
 */
export async function resolveNedarimMosadId(override) {
  if (override) return override;
  if (process.env.NEDARIM_MOSAD_ID) return process.env.NEDARIM_MOSAD_ID;
  const setting = (await getAllCachedSettings()).find(
    (s) => s.key === 'NEDARIM_MOSAD' || s.key === 'nedarim_plus_terminal'
  );
  return setting?.value || '';
}
