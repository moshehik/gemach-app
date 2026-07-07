import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function GET() {
  try {
    // 1. Get length setting
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'barcodePrefixLength' }
    });
    const length = setting && setting.value ? parseInt(setting.value) : 3;

    // 2. Build the start number (e.g. length 3 -> 100)
    let startNumber = Math.pow(10, length - 1);
    const endNumber = Math.pow(10, length) - 1;

    // 3. Find all existing codes in this range
    const models = await prisma.dressModel.findMany({
      where: {
        barcodePrefix: {
          gte: startNumber,
          lte: endNumber
        }
      },
      select: { barcodePrefix: true },
      orderBy: { barcodePrefix: 'asc' }
    });

    const usedCodes = new Set(models.map(m => m.barcodePrefix));

    // 4. Find the first available code
    let nextCode = startNumber;
    while (nextCode <= endNumber) {
      if (!usedCodes.has(nextCode)) {
        return NextResponse.json({ nextCode });
      }
      nextCode++;
    }

    return NextResponse.json({ error: 'לא נמצא קוד פנוי באורך זה' }, { status: 400 });

  } catch (error) {
    console.error('Error finding next code:', error);
    return NextResponse.json({ error: 'שגיאה במציאת קוד פנוי' }, { status: 500 });
  }
}
