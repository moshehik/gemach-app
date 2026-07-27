import { NextResponse } from 'next/server';
import { validateOrderItemsAvailability } from '../../../../lib/inventory';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const data = await request.json();
    const { items, eventDate, isAbroad, fromDate, toDate, orderId } = data;

    const result = await validateOrderItemsAvailability(items, eventDate, isAbroad, fromDate, toDate, orderId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      valid: result.valid,
      errors: result.errors
    });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: 'שגיאה באימות המלאי: ' + error.message }, { status: 500 });
  }
}
