import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { computeOrderObligations } from '@/lib/pricingEngine';

export const dynamic = 'force-dynamic';

// Read-only refund simulator backend for /admin/refund-simulator. Runs the REAL
// computeOrderObligations (lib/pricingEngine.js) on a synthetic in-memory order - it never
// writes to the database and never touches a real order. Admin-only, same gate as /admin.

const SETTING_KEYS = [
  'REFUND_DAYS_FROM_ORDER', 'NO_REFUND_DAYS_BEFORE_EVENT', 'REFUND_PERCENTAGE', 'REFUND_REPAIRS',
  'ENABLE_SET_DISCOUNTS', 'CANCELLATION_CREDIT_MINUTES', 'premium_pricing_enabled', 'premium_categories',
  // מדיניות ההחלפה/ביטול המעודכנת (2026-09-22, lib/pricingCalc.js) - ר' docs/refund-swap-policy-2026-09-22.md
  'same_model_swap_no_fee', 'swap_min_days_before_event', 'swap_same_category_only', 'swap_pairing_window_minutes',
  'instant_undo_minutes', 'gap_size_price_rule', 'refund_tiers_at_deletion_time',
];

// GET -> the live price list + the live values of the settings the engine reads, so the page can
// show real categories/sizes/prices and prefill the rules.
export async function GET() {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [priceList, settings] = await Promise.all([
      prisma.priceList.findMany({ orderBy: [{ category: 'asc' }, { fromSize: 'asc' }] }),
      prisma.systemSetting.findMany({ where: { key: { in: SETTING_KEYS } }, select: { key: true, value: true } }),
    ]);
    return NextResponse.json({ priceList, settings });
  } catch (error) {
    console.error('refund-simulate GET failed:', error);
    return NextResponse.json({ error: 'Failed to load simulator data' }, { status: 500 });
  }
}

// POST { order:{orderDate,eventDate,isAbroad}, items:[{id,name,modelId,priceCategory,size,neck,sleeve,length,createdAt,deletedAt}],
//        now, settings:[{key,value}], priceList? }  ->  { newObligations, totalValid }
export async function POST(request) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const { order = {}, items = [], now = null, settings = [] } = body;
    if (!Array.isArray(items) || items.length > 50) return NextResponse.json({ error: 'items must be an array (max 50)' }, { status: 400 });

    const priceList = Array.isArray(body.priceList)
      ? body.priceList
      : await prisma.priceList.findMany({ orderBy: [{ category: 'asc' }, { fromSize: 'asc' }] });

    const toEngineItem = (it, i) => ({
      id: it.id ?? `sim-${i + 1}`,
      legacyId: null,
      quantity: 1,
      cartStatus: null,
      sizeText: it.size != null ? String(it.size) : '',
      neckAlteration: !!it.neck,
      sleeveAlteration: !!it.sleeve,
      lengthAlteration: it.length ? String(it.length) : '',
      createdAt: it.createdAt ? new Date(it.createdAt) : null,
      deletedAt: it.deletedAt ? new Date(it.deletedAt) : null,
      dressItem: { dress: { id: it.modelId ?? `model-${i + 1}`, name: it.name || `פריט ${i + 1}`, priceCategory: it.priceCategory || '', isPremium: false } },
    });
    const all = items.map(toEngineItem);

    const result = computeOrderObligations({
      order: {
        orderId: 0, legacyId: null, extraDay: null,
        isAbroad: !!order.isAbroad,
        orderDate: order.orderDate ? new Date(order.orderDate) : new Date(),
        eventDate: order.eventDate ? new Date(order.eventDate) : null,
      },
      items: all.filter((it) => !it.deletedAt),
      deletedItems: all.filter((it) => it.deletedAt),
      priceList,
      settings: settings.map((s) => ({ key: String(s.key), value: String(s.value) })),
      now,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('refund-simulate POST failed:', error);
    return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
  }
}
