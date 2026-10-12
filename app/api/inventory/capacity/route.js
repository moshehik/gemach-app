import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { computeCapacity } from '@/lib/capacity';

export const dynamic = 'force-dynamic';

// GET /api/inventory/capacity?barcodePrefix=&size=&fromDate=&toDate=  ->  { inStock, reserve, occupiedCount, occupiedOrders }
// החישוב עצמו (כללי מלאי / רזרבה / תפוסה) נמצא ב-lib/capacity.js - מקור אמת יחיד גם לחיפוש המתקדם (app/api/a5/adv-b) ולפאנל התוצאות של
// החיפוש הראשי והמהיר (lib/searchPanel.js). כאן רק אימות הרשאה ופרמטרים.
export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const barcodePrefixParam = searchParams.get('barcodePrefix');
    const size = searchParams.get('size');
    const fromDateParam = searchParams.get('fromDate');
    const toDateParam = searchParams.get('toDate');

    if (!barcodePrefixParam || !size || !fromDateParam || !toDateParam) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const barcodePrefix = parseInt(barcodePrefixParam, 10);
    return NextResponse.json(await computeCapacity({ barcodePrefix, size, fromDate: fromDateParam, toDate: toDateParam }));
  } catch (error) {
    console.error('Error fetching capacity:', error);
    return NextResponse.json({ error: 'Failed to fetch capacity' }, { status: 500 });
  }
}
