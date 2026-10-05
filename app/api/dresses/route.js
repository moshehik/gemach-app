import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';
import { getCachedSetting } from '@/lib/settingsCache';
import { planListSearch, dressSearchAlternatives, sizeTextFilter, clampLimit, clampPage, buildRetryVariants } from '@/lib/listSearch';
import { sizeMatches } from '@/lib/searchNormalize';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const eventDateStr = searchParams.get('eventDate');
    const [warehouseSetting, reserveSetting] = await Promise.all([
      getCachedSetting('inventory_include_warehouse'),
      getCachedSetting('allow_renting_reserve_items')
    ]);
    const includeWarehouse = warehouseSetting && warehouseSetting.value === 'true';
    // allow_renting_reserve_items (SystemSetting, default false = old behavior) - see
    // lib/inventory.js for why this is a separate toggle from inventory_include_warehouse.
    const allowRentingReserve = reserveSetting && reserveSetting.value === 'true';
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    
    // Pagination parameters
    // תקרה ל-limit (קודם ללא הגבלה); 10000 מכסה את טעינת הקטלוג המלאה של עמוד הקיוסק (customer-interface: limit=10000)
    const page = clampPage(pageParam || '1');
    const limit = clampLimit(limitParam, 50, 10000);
    const skip = (page - 1) * limit;

    // Filter parameters
    const filterStatus = searchParams.get('filterStatus') || 'all';
    // תוכנית החיפוש (lib/listSearch.js): מספר = קידומת דגם, מידה (1-2 ספרות / S,M,L / "מידה X") = מידה מדויקת (2 = 02, לא 12/20)
    const searchPlan = planListSearch(searchParams.get('search') || '');
    const search = searchPlan.text;
    const sortKey = searchParams.get('sortKey') || 'entryDateToRepo';
    const sortDir = searchParams.get('sortDir') || 'desc';

    // Advanced filters
    const advName = searchParams.get('advName') || '';
    const advSize = searchParams.get('advSize') || '';
    const advSerial = searchParams.get('advSerial') || '';
    const advRentalsCountMin = parseInt(searchParams.get('advRentalsCountMin'), 10) || 0;
    const advNotInUse = searchParams.get('advNotInUse') === 'true';
    const advInRepair = searchParams.get('advInRepair') === 'true';
    const advItemDeleted = searchParams.get('advItemDeleted') === 'true';

    // Build Prisma Where
    const where = {};

    if (filterStatus === 'deleted') {
      where.isDeleted = true;
    } else if (filterStatus === 'active') {
      where.isDeleted = false;
      where.exitDateFromRepo = null;
      where.items = { some: { notInUse: false, isDeleted: false } };
    } else if (filterStatus === 'inactive') {
      where.isDeleted = false;
      where.OR = [
        { exitDateFromRepo: { not: null } },
        { items: { none: { notInUse: false, isDeleted: false } } }
      ];
    } else {
      // all
    }

    // תנאי החיפוש החופשי מצורף בסוף (whereWithSearch) כדי שאפשר יהיה לנסות שוב עם טקסט מומר (מקלדת אנגלית)
    if (advName) {
      const advNameNum = parseInt(advName, 10);
      const advNameCond = [ { name: { contains: advName } } ];
      if (!isNaN(advNameNum)) advNameCond.push({ barcodePrefix: advNameNum });
      where.AND = where.AND || [];
      where.AND.push({ OR: advNameCond });
    }

    const itemsWhere = {};
    // מידה מדויקת (sizeInList): "2" = "02" ולא 12/20/32; קודם contains
    if (advSize) itemsWhere.sizeText = sizeTextFilter(advSize) || { contains: advSize };
    if (advSerial) itemsWhere.serialNumber = parseInt(advSerial, 10);
    if (advNotInUse) itemsWhere.notInUse = true;
    if (advInRepair) itemsWhere.inRepair = true;
    if (advItemDeleted) itemsWhere.isDeleted = true;
    
    if (Object.keys(itemsWhere).length > 0) {
      where.items = where.items || {};
      where.items.some = { ...where.items.some, ...itemsWhere };
    }

    const orderBy = {};
    if (sortKey === 'itemsCount') {
      orderBy.items = { _count: sortDir };
    } else {
      orderBy[sortKey] = sortDir;
    }

    let dressModels = [];
    let totalCount = 0;

    const whereWithSearch = (plan) => {
      if (!plan.text) return where;
      const searchConditions = dressSearchAlternatives(plan);
      const w = { ...where };
      if (w.OR) {
        w.AND = [...(w.AND || []), { OR: w.OR }, { OR: searchConditions }];
        delete w.OR;
      } else {
        w.OR = searchConditions;
      }
      return w;
    };
    let searchWhere = whereWithSearch(searchPlan);
    const notices = [];

    const dressFindArgs = (w) => ({
        where: w,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          barcodePrefix: true,
          priceCategory: true,
          notes: true,
          inInspection: true,
          imageUrl: true,
          thumbnailUrl: true,
          entryDateToRepo: true,
          exitDateFromRepo: true,
          inactiveReason: true,
          isDeleted: true,
          items: {
            select: {
              id: true,
              sizeText: true,
              quantity: true,
              location: true,
              inRepair: true,
              notInUse: true,
              isDeleted: true,
              serialNumber: true,
              dressBarcode: true,
              _count: { select: { orderItems: true } }
            }
          }
        }
    });
    let [models, count] = await Promise.all([
      prisma.dressModel.findMany(dressFindArgs(searchWhere)),
      prisma.dressModel.count({ where: searchWhere })
    ]);
    // חיפוש טקסט שלא מצא כלום: הצלת מקלדת אנגלית (ר' lib/keyboardLayout.js) - אותה הודעה כמו ברשימות ההזמנות/לקוחות
    if (count === 0 && searchPlan.text) {
      for (const variant of buildRetryVariants(searchPlan, { scopeRestricted: false, fuzzy: false })) {
        if (!variant.text) continue;
        const retryWhere = whereWithSearch(planListSearch(variant.text));
        const retryCount = await prisma.dressModel.count({ where: retryWhere });
        if (retryCount > 0) {
          searchWhere = retryWhere;
          [models, count] = [await prisma.dressModel.findMany(dressFindArgs(retryWhere)), retryCount];
          notices.push(...variant.notices);
          break;
        }
      }
    }
    dressModels = models;
    totalCount = count;

    let bulkAvailable = null;
    if (eventDateStr) {
      const eventDate = new Date(eventDateStr);
      if (!isNaN(eventDate.getTime())) {
        const { getBulkAvailableInventory } = await import('../../../lib/inventory');
        bulkAvailable = await getBulkAvailableInventory(eventDate, dressModels.map(m => m.id));
      }
    }

    const formatted = dressModels.map(model => {
      const availableBySize = bulkAvailable ? { ...(bulkAvailable[model.id] || {}) } : null;
      const adjustedItems = model.items.map(item => {
        const size = item.sizeText || item.size || 'כללי';
        let availableQtyForThisItem = 1;
        const isWarehouseLoc = item.location && (item.location.includes('מחסן') || item.location.includes('warehouse'));
        const isReserveLoc = item.location && (item.location.includes('רזרבה') || item.location.includes('reserve'));
        const isUnusable = item.inRepair || item.notInUse || item.isDeleted
          || (!includeWarehouse && isWarehouseLoc) || (!allowRentingReserve && isReserveLoc);

        if (bulkAvailable) {
          if (isUnusable) {
             availableQtyForThisItem = 0;
          } else if (availableBySize[size] && availableBySize[size].available > 0) {
             const availableForThis = Math.min(item.quantity || 1, availableBySize[size].available);
             availableQtyForThisItem = availableForThis;
             availableBySize[size].available -= availableForThis;
          } else {
             availableQtyForThisItem = 0;
          }
        } else {
          if (isUnusable) {
             availableQtyForThisItem = 0;
          } else {
             availableQtyForThisItem = item.quantity || 1;
          }
        }

        return {
          ...item,
          quantity: availableQtyForThisItem,
          rentalsCount: item._count?.orderItems || 0,
          _count: undefined
        };
      });

      // Handle advanced filter rentalsCountMin locally since we couldn't easily do it in Prisma where
      if (advRentalsCountMin > 0) {
        const hasMatchingItem = adjustedItems.some(item => {
           let matches = true;
           if (advSize && !sizeMatches(item.sizeText, advSize)) matches = false;
           if (advSerial && item.serialNumber !== parseInt(advSerial, 10)) matches = false;
           if ((item.rentalsCount || 0) < advRentalsCountMin) matches = false;
           if (advNotInUse && !item.notInUse) matches = false;
           if (advInRepair && !item.inRepair) matches = false;
           if (advItemDeleted && !item.isDeleted) matches = false;
           return matches;
        });
        if (!hasMatchingItem) return null;
      }

      return {
        id: model.id,
        name: model.name,
        barcodePrefix: model.barcodePrefix,
        priceCategory: model.priceCategory,
        notes: model.notes,
        inInspection: model.inInspection,
        imageUrl: model.imageUrl,
        thumbnailUrl: model.thumbnailUrl,
        entryDateToRepo: model.entryDateToRepo,
        exitDateFromRepo: model.exitDateFromRepo,
        inactiveReason: model.inactiveReason,
        isDeleted: model.isDeleted,
        sizes: Array.from(new Set(adjustedItems.map(item => item.sizeText).filter(Boolean))),
        inStock: adjustedItems.some(item => item.quantity > 0),
        items: adjustedItems.map(i => ({
          id: i.id,
          sizeText: i.sizeText,
          serialNumber: i.serialNumber,
          barcode: i.dressBarcode,
          quantity: i.quantity,
          location: i.location,
          inRepair: i.inRepair,
          notInUse: i.notInUse,
          isDeleted: i.isDeleted,
          isUnusable: i.inRepair || i.notInUse || i.isDeleted
            || (!includeWarehouse && i.location && (i.location.includes('מחסן') || i.location.includes('warehouse')))
            || (!allowRentingReserve && i.location && (i.location.includes('רזרבה') || i.location.includes('reserve'))),
          rentalsCount: i.rentalsCount
        }))
      };
    }).filter(Boolean); // Filter out nulls from rentalsCountMin locally

    // If we filtered out some items locally because of rentalsCountMin, adjust totalCount (approximate)
    if (advRentalsCountMin > 0) {
      // It's not a perfect pagination fix but prevents loading the entire DB into memory.
      totalCount = Math.max(totalCount, formatted.length);
    }
    
    return NextResponse.json({
      data: formatted,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      ...(notices.length ? { notices } : {})
    });
  } catch (error) {
    console.error('Error fetching dresses:', error);
    return NextResponse.json({ error: 'Failed to fetch dresses' }, { status: 500 });
  }
}

export async function POST(request) {
  // יצירת דגם חדש בקטלוג — פעולת ניהול, מוגבלת להנהלה ראשית/מתכנת גם כשהקטלוג
  // עצמו פתוח לצפייה לכולם (ר' restrict_dress_catalog_to_head_management).
  if (!(await checkAuth('הנהלה ראשית'))) return new Response(JSON.stringify({ error: 'הרשאה זו שמורה להנהלה ראשית בלבד' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    
    // Check if duplicate barcodePrefix exists
    if (body.barcodePrefix) {
      const existing = await prisma.dressModel.findFirst({
        where: { 
          barcodePrefix: parseInt(body.barcodePrefix),
          isDeleted: false
        }
      });
      if (existing) {
        return NextResponse.json({ error: 'הקוד כבר בשימוש!' }, { status: 400 });
      }
    }

    const newModel = await prisma.dressModel.create({
      data: {
        name: body.name || `דגם ${body.barcodePrefix || 'חדש'}`,
        barcodePrefix: body.barcodePrefix ? parseInt(body.barcodePrefix) : null,
        priceCategory: body.priceCategory || null,
        notes: body.notes || null,
        inInspection: body.inInspection || false,
        imageUrl: body.imageUrl || null,
        thumbnailUrl: body.thumbnailUrl || null,
        entryDateToRepo: body.entryDateToRepo ? new Date(body.entryDateToRepo) : new Date(),
      }
    });

    return NextResponse.json(newModel);
  } catch (error) {
    console.error('Error creating dress model:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת הדגם' }, { status: 500 });
  }
}
