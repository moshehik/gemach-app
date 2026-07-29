import { NextResponse } from 'next/server';
import { validateOrderItemsAvailability } from '../../../../lib/inventory';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const data = await request.json();
    const { items, eventDate, isAbroad, isWeekdayEvent, fromDate, toDate, orderId, customSpacing, simulateIfError } = data;
    const isCustomDuration = isAbroad || isWeekdayEvent;

    const result = await validateOrderItemsAvailability(items, eventDate, isCustomDuration, fromDate, toDate, orderId, customSpacing);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    let simulation = null;
    if (!result.valid && simulateIfError) {
      simulation = {};
      for (const spacing of [1, 2, 3]) {
        const simResult = await validateOrderItemsAvailability(items, eventDate, isCustomDuration, fromDate, toDate, orderId, spacing);
        simulation[spacing] = {
          valid: simResult.valid,
          errors: simResult.errors
        };
      }
    }

    return NextResponse.json({
      valid: result.valid,
      errors: result.errors,
      simulation
    });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: 'שגיאה באימות המלאי: ' + error.message }, { status: 500 });
  }
}
