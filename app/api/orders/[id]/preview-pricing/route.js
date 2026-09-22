import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { computeOrderObligations, computeDeliveryObligationPreview } from '@/lib/pricingCalc';

export const dynamic = 'force-dynamic';

// זהה ל-SETTING_KEYS הפנימי של lib/pricingEngine.js - כפילות מכוונת, באותה מוסכמה
// כמו RECALC_SETTING_KEYS ב-app/api/orders/[id]/route.js, כדי לא לשנות את חתימת
// הפונקציה המשותפת computeOrderObligations רק בשביל הראוט הזה.
const SETTING_KEYS = [
  'REFUND_DAYS_FROM_ORDER',
  'NO_REFUND_DAYS_BEFORE_EVENT',
  'REFUND_PERCENTAGE',
  'REFUND_REPAIRS',
  'ENABLE_SET_DISCOUNTS',
  'CANCELLATION_CREDIT_MINUTES',
  'premium_pricing_enabled',
  'premium_categories',
  'same_model_swap_no_fee',
  'swap_min_days_before_event',
  'swap_same_category_only',
  'refund_tiers_at_deletion_time',
  'swap_pairing_window_minutes',
  'instant_undo_minutes',
  'gap_size_price_rule',
  'delivery_price_by_city',
  'delivery_price'
];

/**
 * תצוגה מקדימה "חיה" של חישוב המחיר - בלי לשמור שום דבר ל-DB.
 * שונה מ-recalculateOrderObligations({dryRun:true}): זה קורא items/deletedItems מה-DB
 * בלבד, ולכן לא רואה שינויים מקומיים בכרטיס (מחיקת פריט, שינוי תאריך אירוע/חו"ל) שעדיין
 * לא נשמרו. הראוט הזה מקבל מהלקוח את מצב ה-items/order העדכני בפועל (כפי שנשמר ב-state
 * של הכרטיס, כולל שינויים שטרם נשמרו), ומריץ עליו את אותה לוגיקת חישוב טהורה
 * (computeOrderObligations) כדי שטאב התשלומים יוכל להציג סכום מדויק לפני לחיצה על שמור.
 *
 * פריט שסומן למחיקה מקומית (isDeleted=true) אך טרם נשמר עדיין לא קיבל deletedAt אמיתי
 * (זה נחתם רק בשמירה בפועל - ר' app/api/orders/[id]/route.js). כדי שדמי הביטול/הזיכוי
 * יחושבו נכון גם בתצוגה המקדימה, "מדביקים" להם deletedAt = עכשיו, בדיוק כמו שהשמירה
 * הייתה עושה, אבל בלי לכתוב את זה לשום מקום.
 */
export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const parsedOrderId = parseInt(resolvedParams.id);
    if (isNaN(parsedOrderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await request.json();
    const clientItems = Array.isArray(body.items) ? body.items : [];
    const orderOverrides = body.order || {};

    const [baseOrder, priceList, settings] = await Promise.all([
      prisma.order.findUnique({
        where: { orderId: parsedOrderId },
        // obligations רק בשביל בדיקת "כבר קיים חיוב משלוח" ב-computeDeliveryObligationPreview
        // למטה - לא רלוונטי לחישוב עצמו (computeOrderObligations מקבל את items/deletedItems
        // מהלקוח, לא מה-DB, ר' התיעוד למעלה).
        include: { obligations: { where: { isDeleted: false }, select: { description: true } } }
      }),
      prisma.priceList.findMany(),
      getAllCachedSettings().then(all => all.filter(s => SETTING_KEYS.includes(s.key)))
    ]);

    if (!baseOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // בסיס מה-DB (legacyId, orderDate וכו') + דריסה של השדות שמשפיעים על מחיר ועשויים
    // עדיין להיות רק ב-state המקומי של הכרטיס (לא נשמרו) - בדיוק השדות שנשלחים בפועל
    // ב-handleSave של הכרטיס.
    const effectiveOrder = {
      ...baseOrder,
      eventDate: orderOverrides.eventDate !== undefined ? orderOverrides.eventDate : baseOrder.eventDate,
      isAbroad: orderOverrides.isAbroad !== undefined ? orderOverrides.isAbroad : baseOrder.isAbroad,
      isWeekdayEvent: orderOverrides.isWeekdayEvent !== undefined ? orderOverrides.isWeekdayEvent : baseOrder.isWeekdayEvent,
      fromDate: orderOverrides.fromDate !== undefined ? orderOverrides.fromDate : baseOrder.fromDate,
      toDate: orderOverrides.toDate !== undefined ? orderOverrides.toDate : baseOrder.toDate,
      isDelivery: orderOverrides.isDelivery !== undefined ? orderOverrides.isDelivery : baseOrder.isDelivery,
      deliveryCity: orderOverrides.deliveryCity !== undefined ? orderOverrides.deliveryCity : baseOrder.deliveryCity,
      deliveryDirection: orderOverrides.deliveryDirection !== undefined ? orderOverrides.deliveryDirection : baseOrder.deliveryDirection
    };

    const now = new Date();
    const activeItems = clientItems.filter(i => !i.isDeleted && i.dressItem && i.dressItem.dress);
    const deletedItems = clientItems
      .filter(i => i.isDeleted)
      .map(i => (i.deletedAt ? i : { ...i, deletedAt: now }));

    const { newObligations, totalValid } = computeOrderObligations({
      order: effectiveOrder,
      items: activeItems,
      deletedItems,
      priceList,
      settings
    });

    // חיוב משלוח (ר' applyDeliveryCharge ב-lib/pricingEngine.js) לא חלק מ-computeOrderObligations
    // בכלל - הוא מחושב רק בפועל בתוך ה-PUT האמיתי. בלעדיו, תצוגה מקדימה של הזמנה קיימת
    // שמסמנים בה משלוח (או משנים בה עיר/כיוון משלוח) לא כללה את החיוב הזה כלל, כך שהסכום
    // שהוצג לפני שמירה היה נמוך מהאמת - בדיוק הבאג שגרם לחוב לא-ידוע על משלוח (ר' דיווח
    // 6124472b). מוסיפים אותו כאן מאותו חישוב טהור ומשותף (computeDeliveryObligationPreview).
    const deliveryPreview = computeDeliveryObligationPreview({
      isDelivery: effectiveOrder.isDelivery,
      deliveryCity: effectiveOrder.deliveryCity,
      deliveryDirection: effectiveOrder.deliveryDirection,
      deliveryPriceByCity: settings.find(s => s.key === 'delivery_price_by_city')?.value,
      deliveryPrice: settings.find(s => s.key === 'delivery_price')?.value,
      // חיוב "משלוח" קיים ולא נמחק בהזמנה האמיתית - נבדק בנפרד מ-newObligations (שמכיל רק
      // חיובים אוטומטיים מ-computeOrderObligations, לא כולל משלוח מלכתחילה, כך שאין סיכון
      // לספור פעמיים).
      existingObligations: baseOrder.obligations || []
    });
    if (deliveryPreview) {
      newObligations.push({ ...deliveryPreview, isPreview: true });
    }

    const newTotal = newObligations.reduce((sum, o) => sum + o.amount, 0);

    return NextResponse.json({ newObligations, newTotal, totalValid });
  } catch (error) {
    console.error('Error computing pricing preview:', error);
    return NextResponse.json({ error: `שגיאה בחישוב תצוגה מקדימה: ${error.message}` }, { status: 500 });
  }
}
