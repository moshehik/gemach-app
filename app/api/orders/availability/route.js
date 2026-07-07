import { NextResponse } from 'next/server';
import { getAvailableInventory } from '../../../lib/inventory';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dressModelId = searchParams.get('dressModelId');
    const eventDate = searchParams.get('eventDate');
    const bufferDays = searchParams.get('bufferDays') ? parseInt(searchParams.get('bufferDays')) : 3;
    const isAbroad = searchParams.get('isAbroad') === 'true';
    const toDate = searchParams.get('toDate');

    if (!dressModelId || !eventDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: dressModelId and eventDate' },
        { status: 400 }
      );
    }

    const availability = await getAvailableInventory(dressModelId, eventDate, bufferDays, true, isAbroad, toDate);
    
    return NextResponse.json(availability);
  } catch (error) {
    console.error('Error in availability API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
