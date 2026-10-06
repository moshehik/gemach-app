import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { checkAuth } from '../../../../lib/auth';
import { cachedJson } from '@/lib/httpCache';

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const [cityRows, streetRows] = await Promise.all([
      prisma.customer.findMany({ where: { isDeleted: false }, select: { city: true }, distinct: ['city'] }),
      prisma.customer.findMany({ where: { isDeleted: false }, select: { street: true }, distinct: ['street'] }),
    ]);

    const cities = cityRows.map(r => (r.city || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'he'));
    const streets = streetRows.map(r => (r.street || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'he'));

    // CPU phase 1B: private, max-age=60, swr=300 + ETag/304 (lib/httpCache.js) - הצעות עיר/רחוב בלבד, ישן של דקות לא מזיק
    return cachedJson(request, { cities, streets });
  } catch (error) {
    console.error('Error fetching customer locations:', error);
    return NextResponse.json({ error: 'Failed to fetch customer locations' }, { status: 500 });
  }
}
