import { NextResponse } from 'next/server';
import { getAvailableInventory } from '../../../../lib/inventory';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dressModelId = searchParams.get('dressModelId');
    const eventDate = searchParams.get('eventDate');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const bufferDays = searchParams.get('bufferDays') ? parseInt(searchParams.get('bufferDays')) : 3;
    const isAbroad = searchParams.get('isAbroad') === 'true';

    if (!dressModelId) {
      return NextResponse.json({ error: 'Missing dressModelId' }, { status: 400 });
    }

    let targetMinDate, targetMaxDate;
    if (isAbroad) {
      if (!fromDate || !toDate) {
        return NextResponse.json({ error: 'Missing fromDate/toDate for abroad order' }, { status: 400 });
      }
      targetMinDate = fromDate;
      targetMaxDate = toDate;
    } else {
      if (!eventDate) {
        return NextResponse.json({ error: 'Missing eventDate' }, { status: 400 });
      }
      targetMinDate = eventDate;
      targetMaxDate = eventDate;
    }

    const availability = await getAvailableInventory(dressModelId, targetMinDate, bufferDays, true, isAbroad, targetMaxDate);
    
    return NextResponse.json(availability);
  } catch (error) {
    console.error('Error in availability API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
