// lib/stationAnalytics/server.js - הצד שרת של מסך "המרות בעמדה": prisma, הגדרות הקישור הציבורי ומטמון קצר. נקרא מ-app/api/admin/station-analytics/*.
import prisma from '@/app/lib/prisma';
import { currentDbModeTag } from '@/lib/dbMode';
import { loadPublicKioskConfig } from '@/lib/publicKiosk/config';
import { computeStationAnalytics, listDayRegistrations } from './service';

const TTL_MS = 60 * 1000;
const MAX_ENTRIES = 40;
const cache = new Map(); // key -> { at, value }

function cacheGet(key, now) {
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  if (hit) cache.delete(key);
  return null;
}

function cacheSet(key, value, now) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { at: now, value });
}

export function clearStationAnalyticsCache() {
  cache.clear();
}

/** המדדים המצטברים (ללא PII). המטמון מפוצל לפי מצב ה-DB (פרודקשן / גיבוי / TEST) כדי ששורות של מסד אחד לא יודלפו לשני. */
export async function getStationAnalytics(params, { fresh = false } = {}) {
  const now = Date.now();
  const key = `${currentDbModeTag()}|${params.from}|${params.to}|${params.channel}|${params.windowDays}`;
  if (!fresh) {
    const hit = cacheGet(key, now);
    if (hit) return hit;
  }
  const [cfg, data] = await Promise.all([loadPublicKioskConfig(), computeStationAnalytics(prisma, params)]);
  const value = { ...data, linkEnabled: !!cfg.linkEnabled, storeSelfService: !!cfg.storeSelfService };
  cacheSet(key, value, now);
  return value;
}

/** הרישומים של יום (שם פרטי + אות ראשונה). לא במטמון. */
export async function getDayRegistrations(params) {
  return listDayRegistrations(prisma, params);
}
