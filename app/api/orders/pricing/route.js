import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { calculatePrice } from '../../../lib/pricing';

export async function GET(request) {
  // /api/* לא עובר דרך middleware.js, ולכן בלי בדיקה כאן ראוט זה היה פתוח לגולש אנונימי.
  // אותה בדיקה ואותה תשובת 401 כמו שאר ראוטי ההזמנות (למשל [id]/email).
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const dressModelId = searchParams.get('dressModelId');
    const sizeText = searchParams.get('sizeText');
    const eventDateParam = searchParams.get('eventDate');

    if (!dressModelId || !sizeText) {
      return NextResponse.json(
        { error: 'Missing required parameters: dressModelId and sizeText' },
        { status: 400 }
      );
    }

    const eventDate = eventDateParam ? new Date(eventDateParam) : new Date();

    const priceInfo = await calculatePrice(dressModelId, sizeText, eventDate);
    
    return NextResponse.json(priceInfo);
  } catch (error) {
    console.error('Error in pricing API:', error);
    return NextResponse.json(
      { error: 'Failed to calculate price' },
      { status: 500 }
    );
  }
}
