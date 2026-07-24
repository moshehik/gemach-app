import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const eventDateStr = searchParams.get('eventDate');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    
    // Pagination parameters
    const page = pageParam ? parseInt(pageParam, 10) : null;
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const skip = page ? (page - 1) * limit : 0;

    // Filter parameters
    const filterStatus = searchParams.get('filterStatus') || 'all';
    const search = searchParams.get('search') || '';
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

    if (search) {
      const searchNumber = parseInt(search, 10);
      const searchConditions = [
        { name: { contains: search } },
        { priceCategory: { contains: search } },
        { notes: { contains: search } }
      ];
      if (!isNaN(searchNumber)) searchConditions.push({ barcodePrefix: searchNumber });
      
      if (where.OR) {
        where.AND = [ { OR: where.OR }, { OR: searchConditions } ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    if (advName) {
      const advNameNum = parseInt(advName, 10);
      const advNameCond = [ { name: { contains: advName } } ];
      if (!isNaN(advNameNum)) advNameCond.push({ barcodePrefix: advNameNum });
      where.AND = where.AND || [];
      where.AND.push({ OR: advNameCond });
    }

    const itemsWhere = {};
    if (advSize) itemsWhere.sizeText = { contains: advSize };
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

    if (page) {
      const [models, count] = await Promise.all([
        prisma.dressModel.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            items: {
              include: { _count: { select: { orderItems: true } } }
            }
          }
        }),
        prisma.dressModel.count({ where })
      ]);
      dressModels = models;
      totalCount = count;
    } else {
      // For backward compatibility (e.g. customer interface)
      dressModels = await prisma.dressModel.findMany({
        where: { isDeleted: false },
        include: {
          items: true // Removed _count subquery for speed
        }
      });
    }

    let bulkAvailable = null;
    if (eventDateStr) {
      const eventDate = new Date(eventDateStr);
      if (!isNaN(eventDate.getTime())) {
        const { getBulkAvailableInventory } = await import('../../../lib/inventory');
        bulkAvailable = await getBulkAvailableInventory(eventDate);
      }
    }

    const formatted = dressModels.map(model => {
      const availableBySize = bulkAvailable ? { ...(bulkAvailable[model.id] || {}) } : null;
      const adjustedItems = model.items.map(item => {
        const size = item.sizeText || item.size || 'כללי';
        let availableQtyForThisItem = 1;
        const isUnusable = item.inRepair || item.notInUse || item.isDeleted || 
           (item.location && (item.location.includes('מחסן') || item.location.includes('warehouse') || item.location.includes('רזרבה') || item.location.includes('reserve')));

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
           if (advSize && (!item.sizeText || !item.sizeText.includes(advSize))) matches = false;
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
        entryDateToRepo: model.entryDateToRepo,
        exitDateFromRepo: model.exitDateFromRepo,
        isDeleted: model.isDeleted,
        sizes: Array.from(new Set(adjustedItems.map(item => item.sizeText).filter(Boolean))),
        inStock: adjustedItems.some(item => item.quantity > 0),
        items: adjustedItems
      };
    }).filter(Boolean); // Filter out nulls from rentalsCountMin locally

    if (page) {
      // If we filtered out some items locally because of rentalsCountMin, adjust totalCount (approximate)
      if (advRentalsCountMin > 0) {
        totalCount = formatted.length; // Might break actual pagination pages count slightly if spanning multiple pages
      }
      return NextResponse.json({
        data: formatted,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      });
    }

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching dresses:', error);
    return NextResponse.json({ error: 'Failed to fetch dresses' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
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
        entryDateToRepo: body.entryDateToRepo ? new Date(body.entryDateToRepo) : new Date(),
      }
    });

    return NextResponse.json(newModel);
  } catch (error) {
    console.error('Error creating dress model:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת הדגם' }, { status: 500 });
  }
}
