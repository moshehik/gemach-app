import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { checkMissingDressForItem } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

// #21 (בקשה 21, print_mark_missing_dresses) - נקרא רק מ-app/print/order/page.js כשההגדרה
// מופעלת. לכל פריט פעיל וטרם-נלקח בהזמנה, בודק (ר' checkMissingDressForItem ב-lib/inventory.js)
// אם אין כרגע יחידה פנויה של אותו דגם/מידה, ואם קיימת יחידה של אותו דגם/מידה שאמורה לחזור
// מחר מהזמנה אחרת - ומחזיר את שם המשפחה של אותה הזמנה, לתצוגה בדף ההכנה.
export async function GET(request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const orderId = parseInt(searchParams.get('orderId'), 10);
    if (!orderId || isNaN(orderId)) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
      include: {
        items: {
          where: { isDeleted: false, isTaken: false, isReturned: false },
          include: { dressItem: { include: { dress: true } } }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const missing = {};

    await Promise.all(order.items.map(async (item) => {
      let dressModelId = item.dressItem?.dress?.id || item.dressItem?.dressModelId || null;
      const sizeText = item.sizeText || item.dressItem?.sizeText || null;

      // הפריט טרם קיבל יחידה פיזית (dressItemId ריק) - ננסה לזהות את הדגם לפי קידומת
      // הברקוד שכבר נשמרה על הפריט (usage זהה ל-stripCodeLabel/description ב-print/order).
      if (!dressModelId && item.barcodePrefix != null) {
        const model = await prisma.dressModel.findFirst({
          where: { barcodePrefix: item.barcodePrefix, isDeleted: false },
          select: { id: true }
        });
        if (model) dressModelId = model.id;
      }

      if (!dressModelId) return;

      const result = await checkMissingDressForItem({
        dressModelId,
        sizeText,
        excludeOrderId: order.orderId
      });

      if (result) {
        missing[item.id] = result;
      }
    }));

    return NextResponse.json({ orderId: order.orderId, missing });
  } catch (err) {
    console.error('GET /api/print/missing-dresses error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
