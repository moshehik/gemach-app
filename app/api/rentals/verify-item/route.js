import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function POST(request) {
  try {
    const { barcode } = await request.json();

    if (!barcode) {
      return NextResponse.json({ valid: false, error: 'לא הוזן ברקוד' }, { status: 400 });
    }

    const cleanBarcode = barcode.trim().replace(/\s+/g, '');

    // 1. Find DressItem in DB by exact barcode
    let dressItem = await prisma.dressItem.findFirst({
      where: { dressBarcode: cleanBarcode },
      include: { dress: true }
    });

    let barcodePrefix = null;
    let sizeText = null;
    let dressModelId = null;
    let dressName = null;

    if (dressItem) {
      barcodePrefix = dressItem.dress?.barcodePrefix || dressItem.barcodePrefix;
      sizeText = dressItem.sizeText;
      dressModelId = dressItem.dressModelId;
      dressName = dressItem.dress?.name || dressItem.dressName;
    } else {
      // 2. Parse barcode prefix and size as fallback if exact DressItem tag isn't registered
      // e.g. 1904601 -> prefix 190, size 46, serial 01
      if (cleanBarcode.length >= 5) {
        const prefixStr = cleanBarcode.substring(0, cleanBarcode.length - 4);
        const sizeStr = cleanBarcode.substring(cleanBarcode.length - 4, cleanBarcode.length - 2);
        barcodePrefix = parseInt(prefixStr, 10);
        sizeText = sizeStr;

        // Try to find dressModel by prefix
        if (!isNaN(barcodePrefix)) {
          const dressModel = await prisma.dressModel.findFirst({
            where: { barcodePrefix: barcodePrefix, isDeleted: false }
          });
          if (dressModel) {
            dressModelId = dressModel.id;
            dressName = dressModel.name;
          }

          // Try to find any dressItem by prefix and sizeText
          dressItem = await prisma.dressItem.findFirst({
            where: { barcodePrefix: barcodePrefix, sizeText: sizeStr, isDeleted: false },
            include: { dress: true }
          });
          if (dressItem) {
            dressName = dressItem.dress?.name || dressItem.dressName || dressName;
          }
        }
      }
    }

    // If dress item exists in DB, check validity & stock rules
    if (dressItem) {
      if (dressItem.isDeleted || dressItem.notInUse) {
        return NextResponse.json({
          valid: false,
          error: `הפריט עם ברקוד ${cleanBarcode} אינו בשימוש או שבוטל במאגר.`
        }, { status: 400 });
      }

      if (dressItem.inRepair) {
        return NextResponse.json({
          valid: false,
          error: `הפריט עם ברקוד ${cleanBarcode} נמצא בתיקון ולא ניתן להשכרה.`
        }, { status: 400 });
      }

      // Check warehouse setting
      const warehouseSetting = await prisma.systemSetting.findUnique({
        where: { key: 'inventory_include_warehouse' }
      });
      const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';

      if (!includeWarehouse && dressItem.location) {
        const locLower = dressItem.location.toLowerCase();
        if (
          locLower.includes('מחסן') ||
          locLower.includes('רזרבה') ||
          locLower.includes('warehouse') ||
          locLower.includes('reserve')
        ) {
          return NextResponse.json({
            valid: false,
            error: `הפריט עם ברקוד ${cleanBarcode} נמצא ב"${dressItem.location}" (רזרבה/מחסן) ולא ניתן להשכרה.`
          }, { status: 400 });
        }
      }
    }

    return NextResponse.json({
      valid: true,
      dressItem: {
        id: dressItem?.id || null,
        barcode: cleanBarcode,
        barcodePrefix: barcodePrefix,
        sizeText: sizeText,
        dressModelId: dressModelId,
        dressName: dressName || (barcodePrefix ? `דגם ${barcodePrefix}` : null),
        location: dressItem?.location || 'חנות'
      }
    });

  } catch (error) {
    console.error('Error verifying rental item:', error);
    return NextResponse.json({ valid: false, error: 'שגיאה בבדיקת פריט במאגר' }, { status: 500 });
  }
}
