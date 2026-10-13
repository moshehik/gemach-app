import { withCpuTiming } from '@/lib/cpuTiming';
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { checkAuth } from '@/lib/auth';
import { getStockSnapshot } from '@/lib/preloadStockCache';
import { currentDbModeTag } from '@/lib/dbMode';

export const dynamic = 'force-dynamic';

async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('targetDate') || searchParams.get('eventDate');
    const isAbroad = searchParams.get('isAbroad') === 'true';
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const excludeOrderIdStr = searchParams.get('excludeOrderId');

    const minDateStr = isAbroad ? fromDate : targetDate;
    const maxDateStr = isAbroad ? toDate : minDateStr;

    if (!minDateStr) {
      return NextResponse.json({ error: 'Missing target date or fromDate for availability query' }, { status: 400 });
    }

    const minDate = new Date(minDateStr);
    const maxDate = maxDateStr ? new Date(maxDateStr) : minDate;

    // Calculate +/- 60 days window around event range
    const dateLimitStart = new Date(minDate);
    dateLimitStart.setDate(dateLimitStart.getDate() - 60);

    const dateLimitEnd = new Date(maxDate);
    dateLimitEnd.setDate(dateLimitEnd.getDate() + 60);

    // 1. Fetch system settings
    const settingsRaw = (await getAllCachedSettings()).filter(s => ['inventory_buffer_days', 'inventory_skip_weekends', 'inventory_include_warehouse', 'allow_renting_reserve_items', 'inventory_hold_minutes'].includes(s.key));

    let bufferDays = 3;
    let skipWeekends = true;
    let includeWarehouse = false;
    let allowRentingReserve = false;

    const bufferSetting = settingsRaw.find(s => s.key === 'inventory_buffer_days');
    if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);

    const weekendSetting = settingsRaw.find(s => s.key === 'inventory_skip_weekends');
    if (weekendSetting) skipWeekends = weekendSetting.value === 'true';

    const warehouseSetting = settingsRaw.find(s => s.key === 'inventory_include_warehouse');
    if (warehouseSetting) includeWarehouse = warehouseSetting.value === 'true';

    // See lib/inventory.js for why this is a separate toggle from inventory_include_warehouse.
    const reserveSetting = settingsRaw.find(s => s.key === 'allow_renting_reserve_items');
    if (reserveSetting) allowRentingReserve = reserveSetting.value === 'true';

    // חייב להיות זהה בדיוק לכלל השחרור של החזקה זמנית ב-getAvailableInventory (lib/inventory.js) —
    // אחרת המטמון בצד הלקוח "רואה" שמלה כפנויה/תפוסה אחרת מהבדיקה האמיתית בזמן ההוספה בשרת,
    // וההוספה נכשלת עם "אין במלאי" אחרי שהלקוח כבר הראה שהמידה זמינה.
    const holdSetting = settingsRaw.find(s => s.key === 'inventory_hold_minutes');
    const holdMinutes = holdSetting && !isNaN(parseInt(holdSetting.value, 10)) ? parseInt(holdSetting.value, 10) : 15;
    const cutoffDate = new Date(Date.now() - holdMinutes * 60 * 1000);

    // 2. Fetch total active stock (all dress items)
    const excludeLocationTerms = [
      ...(includeWarehouse ? [] : ['מחסן', 'warehouse']),
      ...(allowRentingReserve ? [] : ['רזרבה', 'reserve'])
    ];
    // 2+3. מלאי הפריטים הפעילים (stock) + מפת קידומת-ברקוד -> דגם: מטמון שרת של 60 שנ' (lib/preloadStockCache.js).
    // _t (רענון יזום של הלקוח אחרי כשל הוספה) עוקף את המטמון. ההזמנות (שלב 4) תמיד נקראות טריות.
    const { stock, prefixToModelId } = await getStockSnapshot(prisma, excludeLocationTerms, {
      fresh: searchParams.has('_t'),
      tag: currentDbModeTag(),
    });

    // 4. Fetch bookings in date range window — אותם תנאים בדיוק כמו getAvailableInventory
    // בשרת (ללא סינון לפי status, עם אותו כלל שחרור החזקה זמנית שפג תוקפה), כדי שהזמינות
    // שהלקוח רואה כאן תתאים תמיד לבדיקה האמיתית שתרוץ בהוספה/עריכה בפועל.
    const bookingsWhere = {
      isDeleted: false,
      isReturned: false,
      NOT: {
        AND: [
          { cartStatus: 'pending' },
          { cartStatusDate: { lt: cutoffDate } },
          { order: { legacyId: null } },
          { isTaken: false },
          { barcode: null }
        ]
      },
      order: {
        isDeleted: false,
        OR: [
          { eventDate: { gte: dateLimitStart, lte: dateLimitEnd } },
          { fromDate: { gte: dateLimitStart, lte: dateLimitEnd } },
          { toDate: { gte: dateLimitStart, lte: dateLimitEnd } }
        ]
      }
    };

    if (excludeOrderIdStr) {
      const excludeOrderId = parseInt(excludeOrderIdStr, 10);
      if (!isNaN(excludeOrderId)) {
        bookingsWhere.order.orderId = { not: excludeOrderId };
      }
    }

    const bookingsRaw = await prisma.orderItem.findMany({
      where: bookingsWhere,
      select: {
        barcodePrefix: true,
        sizeText: true,
        quantity: true,
        dressItem: {
          select: {
            dressModelId: true,
            sizeText: true
          }
        },
        order: {
          select: {
            eventDate: true,
            isAbroad: true,
            fromDate: true,
            toDate: true
          }
        }
      }
    });

    // Normalize bookings
    const bookings = bookingsRaw.map(b => {
      const modelId = b.dressModelId || b.dressItem?.dressModelId || (b.barcodePrefix ? prefixToModelId[b.barcodePrefix] : null);
      const size = b.sizeText || b.dressItem?.sizeText || 'כללי';
      
      return {
        m: modelId,
        s: size,
        q: b.quantity || 1,
        eD: b.order?.eventDate ? b.order.eventDate.toISOString() : null,
        fD: b.order?.fromDate ? b.order.fromDate.toISOString() : null,
        tD: b.order?.toDate ? b.order.toDate.toISOString() : null
      };
    }).filter(b => b.m !== null);

    return NextResponse.json({
      settings: {
        bufferDays,
        skipWeekends
      },
      stock,
      bookings
    });
  } catch (error) {
    console.error('Error in inventory preload API:', error);
    return NextResponse.json(
      { error: 'Failed to preload inventory availability' },
      { status: 500 }
    );
  }
}

// cpu-measure (docs/cpu-measurement-2026-10-06.md): Server-Timing/x-cpu-ms/x-boot-id on the response
const GET_timed = withCpuTiming(GET);
export { GET_timed as GET };
