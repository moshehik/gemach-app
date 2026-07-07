import { NextResponse } from 'next/server';
import { calculatePrice } from '../../../lib/pricing';

export async function GET(request) {
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
