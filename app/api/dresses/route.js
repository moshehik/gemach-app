import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';
import { getCachedSetting } from '@/lib/settingsCache';
import { planListSearch, dressSearchAlternatives, sizeTextFilter, clampLimit, clampPage, buildRetryVariants } from '@/lib/listSearch';
import { sizeMatches } from '@/lib/searchNormalize';
import { validateModelInput } from '@/lib/dressInputValidation';
const TX_OPTS = { timeout: 20000, maxWait: 10000 }; // כל כתיבה מוסיפה שורת היסטוריה (app/lib/prisma.js) וה-DB (Neon) איטי בהתעוררות - ברירת המחדל 5 שניות נפלה
import { duplicateNameBody, findNameConflict, isNameUniqueViolation } from '@/lib/dressNameConflict';
import { modelDisplayName, autoModelName } from '@/lib/modelDisplay';
import { getModelDisplayOpts } from '@/lib/modelDisplayServer';


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
    // fields (CPU phase 1B, 2026-10-06): בלי הפרמטר - הצורה הישנה המלאה (כל פריט של כל דגם, כולל rentalsCount) לכל הצרכנים הקיימים/מטמוני לקוח ישנים.
    //   fields=summary - רשימת הקטלוג (dashboard/dresses): בלי items; במקומם itemsCount / activeItemsCount / inUseItemsCount (+ sizes, inStock), תקרת limit 500.
    //   fields=kiosk   - מסך הקיוסק: items מקובצים לפי (מידה, isUnusable, זמין) עם count, בלי מזהים/ברקוד/מיקום/rentalsCount.
    const fieldsParam = searchParams.get('fields');
    const fieldsMode = fieldsParam === 'summary' || fieldsParam === 'kiosk' ? fieldsParam : null;
    const page = clampPage(pageParam || '1');
    const limit = clampLimit(limitParam, 50, fieldsMode === 'summary' ? 500 : 10000);
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
    // counts=1 (רשימת הדגמים החדשה, 9.10.2026): תוספת תואמת-לאחור לתצורת summary - ספירות לכל דגם (לא בשימוש / בתיקון / רזרבה / פריטים מחוקים /
    // השכרות / מידות עם כמויות) + updatedAt. בלי הפרמטר התשובה זהה לחלוטין לקודם. ספירת ההשכרות היא _count.orderItems של כל פריט, כמו בצורה המלאה.
    const wantCounts = fieldsMode === 'summary' && searchParams.get('counts') === '1';
    const needItemRentals = !fieldsMode || advRentalsCountMin > 0 || wantCounts;

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

    // שם הדגם ברשימה / בבוררים: אמיתי, אחרת המספר (lib/modelDisplay.js); נווה (useModelNames=false) = מספר בלבד. כרטיס הדגם (GET /api/dresses/[id]) נשאר גולמי לעריכה.
    const mOpts = await getModelDisplayOpts();
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
          ...(wantCounts ? { updatedAt: true } : {}),
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
              // ספירת ההשכרות לכל פריט היא תת-שאילתה לכל שורה - מיותרת בתצוגות המוקטנות (חוץ מסינון advRentalsCountMin)
              ...(needItemRentals ? { _count: { select: { orderItems: true } } } : {})
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
      for (const variant of buildRetryVariants(searchPlan, { scopeRestricted: false, fuzzy: false, barcode: false, dateStage: false })) {
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

      const modelFields = {
        id: model.id,
        name: modelDisplayName(model, { ...mOpts, fallback: '' }) || null,
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
        inStock: adjustedItems.some(item => item.quantity > 0)
      };

      if (fieldsMode === 'summary') {
        // רשימת הקטלוג: רק ספירות. itemsCount = פריטים לא מחוקים (העמודה "כמות פריטים"), inUseItemsCount = פריטים עם notInUse=false (כולל מחוקים -
        // בדיוק התנאי הישן !items.some(i => !i.notInUse) של "לא פעיל"), activeItemsCount = notInUse=false וגם לא מחוק (התראת "החזר לפעילות").
        const summary = {
          ...modelFields,
          itemsCount: adjustedItems.filter(i => !i.isDeleted).length,
          inUseItemsCount: adjustedItems.filter(i => !i.notInUse).length,
          activeItemsCount: adjustedItems.filter(i => !i.notInUse && !i.isDeleted).length
        };
        if (!wantCounts) return summary;
        // ספירות נוספות (counts=1): הכול על פריטים לא מחוקים, חוץ מ-deletedItemsCount ו-rentalsCount (השכרות היסטוריות של כל הפריטים)
        const live = adjustedItems.filter(i => !i.isDeleted);
        const sizeMap = new Map();
        live.forEach(i => { const k = i.sizeText || 'כללי'; sizeMap.set(k, (sizeMap.get(k) || 0) + 1); });
        const isReserveLocation = (loc) => !!loc && (loc.includes('רזרבה') || loc.includes('reserve'));
        return {
          ...summary,
          notInUseCount: live.filter(i => i.notInUse).length,
          repairCount: live.filter(i => i.inRepair).length,
          reserveCount: live.filter(i => isReserveLocation(i.location)).length,
          deletedItemsCount: adjustedItems.length - live.length,
          rentalsCount: adjustedItems.reduce((n, i) => n + (i.rentalsCount || 0), 0),
          sizeCounts: [...sizeMap.entries()],
          updatedAt: model.updatedAt || null
        };
      }

      if (fieldsMode === 'kiosk') {
        // הקיוסק קורא מכל פריט רק: sizeText, זמינות (quantity>0), ו-isUnusable (notInUse/isDeleted/inRepair/מחסן/רזרבה כבר בפנים). פריטים זהים בשלוש הערכים
        // האלה מקובצים לשורה אחת עם count - בקטלוג של ~13K פריטים על ~120 דגמים זה מוריד את התשובה בסדר גודל.
        const groups = new Map();
        for (const i of adjustedItems) {
          const unusable = !!(i.inRepair || i.notInUse || i.isDeleted
            || (!includeWarehouse && i.location && (i.location.includes('מחסן') || i.location.includes('warehouse')))
            || (!allowRentingReserve && i.location && (i.location.includes('רזרבה') || i.location.includes('reserve'))));
          const avail = i.quantity > 0 ? 1 : 0;
          const gkey = `${i.sizeText ?? ''}\u0000${unusable ? 1 : 0}\u0000${avail}`;
          const g = groups.get(gkey);
          if (g) g.count += 1;
          else groups.set(gkey, { sizeText: i.sizeText, quantity: avail, isUnusable: unusable, count: 1 });
        }
        return { ...modelFields, items: Array.from(groups.values()) };
      }

      return {
        ...modelFields,
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
  let attemptedName = '';
  try {
    const body = await request.json().catch(() => null);

    // ולידציה בשרת (lib/dressInputValidation.js): אורך הקוד לפי ההגדרה, ספרות בלבד, שם לא ריק, קטגוריה קיימת, אורכי שדות - לא סומכים על הלקוח
    const [lenSetting, catRows] = await Promise.all([
      getCachedSetting('barcodePrefixLength'),
      prisma.priceList.findMany({ select: { category: true }, distinct: ['category'] }),
    ]);
    const codeLen = lenSetting && lenSetting.value ? parseInt(lenSetting.value, 10) || 3 : 3;
    const categories = catRows.map((c) => c.category).filter((c) => c && c.trim() !== '');
    const v = validateModelInput(body, { codeLen, categories });
    if (v.error) return NextResponse.json({ error: v.error, ...(v.field ? { field: v.field } : {}) }, { status: 400 });
    const d = v.data;

    // DressModel.name הוא UNIQUE (כולל מחוקים רכות): שם שכבר קיים = 400 ברור, לא 500 כללי. השם האפקטיבי - גם השם האוטומטי "דגם <קוד>"
    // גמ"ח בלי שמות דגמים (useModelNames=false, נווה יעקב): השם נקבע כאן בשרת למספר הדגם עצמו - בדיוק כמו שאר דגמי נווה (שם = קוד) - ולא "ללא שם" / "דגם <קוד>" ולא מה שהלקוח שלח (lib/modelDisplay.js autoModelName).
    // בגמ"ח עם שמות: כמו תמיד - השם שהוזן, ובהיעדרו "דגם <קוד>".
    const createOpts = await getModelDisplayOpts();
    attemptedName = createOpts.useModelNames === false ? autoModelName(d.barcodePrefix) : (d.name || `דגם ${d.barcodePrefix || 'חדש'}`);
    if (attemptedName) {
      const nameTaken = await findNameConflict(prisma, attemptedName);
      if (nameTaken) return NextResponse.json(duplicateNameBody(attemptedName, nameTaken), { status: 400 });
    }

    // בדיקת קוד תפוס + יצירה תחת נעילת advisory לפי הקוד: שתי יצירות מקבילות עם אותו קוד (אין אילוץ unique ב-DB, ושינוי סכמה דורש DDL בשני המסדים) לא יכולות לעבור שתיהן
    const newModel = await prisma.$transaction(async (tx) => {
      if (d.barcodePrefix !== null) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dress-model-code:${d.barcodePrefix}`}))`;
        const existing = await tx.dressModel.findFirst({ where: { barcodePrefix: d.barcodePrefix, isDeleted: false }, select: { id: true } });
        if (existing) return null;
      }
      return tx.dressModel.create({
        data: {
          name: attemptedName || null,
          barcodePrefix: d.barcodePrefix,
          priceCategory: d.priceCategory,
          notes: d.notes,
          inInspection: d.inInspection,
          imageUrl: d.imageUrl,
          thumbnailUrl: d.thumbnailUrl,
          entryDateToRepo: d.entryDateToRepo,
        },
      });
    }, TX_OPTS);
    if (!newModel) return NextResponse.json({ error: 'הקוד כבר בשימוש!' }, { status: 400 });

    return NextResponse.json(newModel);
  } catch (error) {
    if (isNameUniqueViolation(error)) {
      // מרוץ: דגם באותו שם נוצר בין הבדיקה לכתיבה
      const taken = await findNameConflict(prisma, attemptedName).catch(() => null);
      return NextResponse.json(duplicateNameBody(attemptedName, taken), { status: 400 });
    }
    console.error('Error creating dress model:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת הדגם' }, { status: 500 });
  }
}
