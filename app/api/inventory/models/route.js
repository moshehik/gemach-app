import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { checkAuth } from '@/lib/auth';
import { cleanQuery, parseBarcodeDigits } from '@/lib/searchNormalize';
import { cachedJson } from '@/lib/httpCache';

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const { searchParams } = new URL(request.url);
  // ניקוי תווים בלתי נראים (סימוני RTL מהדבקה) ורווחים; קידומת דגם רק מקלט ספרות בלבד - parseInt על טקסט חופשי ("12 דגם") הפך אותו ל-12.
  // ברקוד של 7 ספרות מתאים גם לפי הקידומת שלו (כל הספרות חוץ מ-4 האחרונות).
  const q = cleanQuery(searchParams.get('q'));
  const prefixCandidates = !q ? [] : [
    ...(/^\d{1,9}$/.test(q) ? [parseInt(q, 10)] : []),
    ...(/^\d{7}$/.test(q) ? [parseInt(parseBarcodeDigits(q).prefix, 10)] : [])
  ];
  const hasActiveItems = searchParams.get('hasActiveItems') === 'true';

  try {
    const models = await prisma.dressModel.findMany({
      where: {
        isDeleted: false,
        exitDateFromRepo: null,
        ...(q ? {
          OR: [
            { name: { contains: q } },
            ...(prefixCandidates.length ? prefixCandidates.map((n) => ({ barcodePrefix: { equals: n } })) : [{ barcodePrefix: { equals: -1 } }])
          ]
        } : {}),
        ...(hasActiveItems ? {
          items: {
            some: {
              isDeleted: false,
              notInUse: false
            }
          }
        } : {})
      },
      orderBy: { name: 'asc' }
    });

    // CPU phase 1B: private, max-age=60, swr=300 + ETag/304 (lib/httpCache.js). בוררי הדגמים של ההזמנה קוראים דרך apiCache (no-store).
    return cachedJson(request, { models });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}
