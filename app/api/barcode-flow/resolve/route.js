import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { classifyBarcode, isQuickBarcodeRentEnabled, normalizeBarcode } from '@/lib/barcodeFlow';

// זרימת הברקוד ברצף (lib/barcodeFlow.js): GET בלבד, לא משנה כלום - מסווג ברקוד ל-rented / free / ... כדי שהלקוח יחליט
// איזה חלון לפתוח. ההחזרה וההשכרה עצמן נשארות POST /api/returns/scan ו-POST /api/rentals/scan (עם כל הבדיקות שלהן).
// הרשאה: page:rentals ("השכרות והחזרות", app/rentals/layout.js) - בלעדיה 403 והלקוח חוזר להתנהגות הקודמת בלי ההמשכיות.
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    if (!(await canOpenPage('page:rentals'))) return NextResponse.json({ error: 'אין הרשאה להשכרות והחזרות', forbidden: true }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const barcode = normalizeBarcode(searchParams.get('barcode'));
    if (!barcode) return NextResponse.json({ error: 'חסר ברקוד' }, { status: 400 });
    // rental=1: הקורא (החיפוש המהיר) מבקש גם הזמנות מתאימות להשכרה - ורק אם ההגדרה quick_search_barcode_opens_rental דלוקה
    const rentalEnabled = await isQuickBarcodeRentEnabled();
    const withRental = rentalEnabled && searchParams.get('rental') === '1';
    const result = await classifyBarcode(barcode, { withRental });
    return NextResponse.json({ barcode, rentalEnabled, ...result });
  } catch (error) {
    console.error('barcode-flow/resolve error:', error);
    return NextResponse.json({ error: 'שגיאה בזיהוי הברקוד' }, { status: 500 });
  }
}
