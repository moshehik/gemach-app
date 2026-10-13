import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { checkAuth } from '../../../../lib/auth';
import { cachedJson } from '@/lib/httpCache';
import { currentDbModeTag } from '@/lib/dbMode';

// הצעות עיר/רחוב. חיסכון בנתונים יוצאים מ-Neon (2026-10-13): Prisma `findMany({ distinct })` מסנן בזיכרון - כל קריאה משכה את כל
// ~16.6k הלקוחות פעמיים (~1.5MB) כדי להחזיר ~1000 ערכים. `groupBy` מבצע GROUP BY ב-SQL: חוזרות רק השורות הייחודיות (~15KB).
// בנוסף מטמון שרת קצר לאינסטנס חם (מפתח = תגית מסד, ר' CLAUDE.md "backup mode"), כי הרשימה משתנה רק כשנפתח לקוח עם עיר/רחוב חדשים.
const TTL_MS = 2 * 60 * 1000;
const cache = new Map(); // dbModeTag -> { data, expiresAt, promise }

const clean = (rows, field) => [...new Set(rows.map((r) => (r[field] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));

async function loadLocations() {
  const where = { isDeleted: false };
  const [cityRows, streetRows] = await Promise.all([
    prisma.customer.groupBy({ by: ['city'], where }),
    prisma.customer.groupBy({ by: ['street'], where }),
  ]);
  return { cities: clean(cityRows, 'city'), streets: clean(streetRows, 'street') };
}

async function getLocations() {
  const tag = currentDbModeTag();
  const hit = cache.get(tag);
  if (hit && hit.data && hit.expiresAt > Date.now()) return hit.data;
  if (hit && hit.promise) return hit.promise;
  const promise = loadLocations()
    .then((data) => { cache.set(tag, { data, expiresAt: Date.now() + TTL_MS, promise: null }); return data; })
    .catch((err) => { if (cache.get(tag)?.promise === promise) cache.delete(tag); throw err; }); // שגיאות לא נמטמנות
  cache.set(tag, { data: hit?.data || null, expiresAt: 0, promise });
  return promise;
}

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { cities, streets } = await getLocations();

    // CPU phase 1B: private, max-age=60, swr=300 + ETag/304 (lib/httpCache.js) - הצעות עיר/רחוב בלבד, ישן של דקות לא מזיק
    return cachedJson(request, { cities, streets });
  } catch (error) {
    console.error('Error fetching customer locations:', error);
    return NextResponse.json({ error: 'Failed to fetch customer locations' }, { status: 500 });
  }
}
