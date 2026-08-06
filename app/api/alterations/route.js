import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '../../../lib/auth';


export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const showOnlyPending = searchParams.get('showOnlyPending') === 'true'; // false means show all
    const hideNoAlterations = searchParams.get('hideNoAlterations') === 'true'; // Relevant for print wizard "רשימת הזמנות ללא תיקונים"
    const showAllOrders = searchParams.get('showAllOrders') === 'true'; // Show all orders regardless of alterations
    // The management screen (/alterations) only cares about items that still
    // need work before pickup - once the dress was taken or returned the
    // alteration is no longer actionable. Print reports don't send this flag.
    const hideTakenReturned = searchParams.get('hideTakenReturned') === 'true';
    const search = searchParams.get('search') || '';
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')) : null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 60;
    // Explicit order IDs (e.g. from the orders list's "הנתונים המוצגים כעת"
    // print-wizard option) take precedence over the date range - they're the
    // exact set the caller already filtered/searched down to.
    const orderIdsParam = searchParams.get('orderIds');
    const orderIds = orderIdsParam
      ? orderIdsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
      : null;

    // Single joined query instead of Prisma's nested-select (which issues 5
    // sequential round-trips - OrderItem, Order, Customer, DressItem,
    // DressModel - each paying ~100-300ms of latency to Neon). The filter
    // logic below mirrors the previous Prisma whereClause exactly.
    const conditions = [
      Prisma.sql`oi."isDeleted" = false`,
      Prisma.sql`o."isDeleted" = false`
    ];

    if (orderIds) {
      if (orderIds.length === 0) {
        // in: [] matches nothing
        conditions.push(Prisma.sql`false`);
      } else {
        conditions.push(Prisma.sql`o."orderId" IN (${Prisma.join(orderIds)})`);
      }
    } else if (startDate || endDate) {
      if (startDate) {
        // In legacy, it searched events > (date - 1), which means from the start of the date.
        conditions.push(Prisma.sql`o."eventDate" >= ${new Date(startDate)}`);
      }
      if (endDate) {
        // Until the end of the date
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(Prisma.sql`o."eventDate" <= ${end}`);
      }
    }

    if (showAllOrders) {
        // Do not add any filter on alterations, we want all orders matching the dates
    } else if (hideNoAlterations) {
        // hideNoAlterations == true means we want to see orders WITHOUT alterations.
        // Legacy: AND IIf([תיקון_אורך]>0 Or [תיקון_צוואר] Or [תיקון_שרוול],-1,0)=0
        // Legacy migration left some length values as '' / literal 'null' - treat those as "no alteration" too
        conditions.push(Prisma.sql`(oi."neckAlteration" = 0 OR oi."neckAlteration" IS NULL)`);
        conditions.push(Prisma.sql`(oi."lengthAlteration" IS NULL OR oi."lengthAlteration" IN ('', 'null', '0'))`);
        conditions.push(Prisma.sql`(oi."sleeveAlteration" = 0 OR oi."sleeveAlteration" IS NULL)`);
    } else {
        // Show only items that HAVE alterations; length must be non-NULL and
        // not legacy '' / 'null' / '0' junk (matches Prisma notIn semantics)
        conditions.push(Prisma.sql`(
            oi."neckAlteration" > 0
            OR (oi."lengthAlteration" IS NOT NULL AND oi."lengthAlteration" NOT IN ('', 'null', '0'))
            OR oi."sleeveAlteration" > 0
        )`);
        if (showOnlyPending) {
            conditions.push(Prisma.sql`oi."alterationDone" = false`);
        }
    }

    if (hideTakenReturned) {
      conditions.push(Prisma.sql`oi."isTaken" = false`);
      conditions.push(Prisma.sql`oi."isReturned" = false`);
    }

    const whereSql = conditions.reduce((acc, c) => Prisma.sql`${acc} AND ${c}`);

    const rows = await prisma.$queryRaw`
      SELECT
        oi."id", oi."description", oi."quantity", oi."sizeText", oi."size",
        oi."barcodePrefix", oi."neckAlteration", oi."lengthAlteration",
        oi."sleeveAlteration", oi."alterationDetails", oi."alterationDone",
        o."orderId" AS "o_orderId", o."eventDate" AS "o_eventDate",
        o."eventDateHebrew" AS "o_eventDateHebrew", o."notes" AS "o_notes",
        (c."id" IS NOT NULL) AS "has_customer",
        c."firstName" AS "c_firstName", c."lastName" AS "c_lastName",
        c."phone1" AS "c_phone1", c."city" AS "c_city",
        (di."id" IS NOT NULL) AS "has_dressItem",
        di."sizeText" AS "di_sizeText", di."serialNumber" AS "di_serialNumber",
        di."dressBarcode" AS "di_dressBarcode",
        (dm."id" IS NOT NULL) AS "has_dress",
        dm."name" AS "dm_name", dm."barcodePrefix" AS "dm_barcodePrefix"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."orderId" = oi."orderId"
      LEFT JOIN "Customer" c ON c."id" = o."customerId"
      LEFT JOIN "DressItem" di ON di."id" = oi."dressItemId"
      LEFT JOIN "DressModel" dm ON dm."id" = di."dressModelId"
      WHERE ${whereSql}
    `;

    // Reassemble the exact nested shape the old Prisma select produced -
    // app/print/alterations/page.js and the orders list consume it as-is.
    const items = rows.map(r => ({
      id: r.id,
      description: r.description,
      quantity: r.quantity,
      sizeText: r.sizeText,
      size: r.size,
      barcodePrefix: r.barcodePrefix,
      neckAlteration: r.neckAlteration,
      lengthAlteration: r.lengthAlteration,
      sleeveAlteration: r.sleeveAlteration,
      alterationDetails: r.alterationDetails,
      alterationDone: r.alterationDone,
      order: {
        orderId: r.o_orderId,
        eventDate: r.o_eventDate,
        eventDateHebrew: r.o_eventDateHebrew,
        notes: r.o_notes,
        customer: r.has_customer ? {
          firstName: r.c_firstName,
          lastName: r.c_lastName,
          phone1: r.c_phone1,
          city: r.c_city
        } : null
      },
      dressItem: r.has_dressItem ? {
        sizeText: r.di_sizeText,
        serialNumber: r.di_serialNumber,
        dressBarcode: r.di_dressBarcode,
        dress: r.has_dress ? {
          name: r.dm_name,
          barcodePrefix: r.dm_barcodePrefix
        } : null
      } : null
    }));

    // Like the legacy Access reports, resolve the dress-model name through the
    // item's barcode prefix (join to שמלות_דגמים) even when no physical
    // DressItem has been assigned yet - otherwise unassigned items print
    // without a model name.
    const unresolvedPrefixes = [...new Set(
      items.filter(i => !i.dressItem?.dress?.name && i.barcodePrefix != null).map(i => i.barcodePrefix)
    )];
    let modelByPrefix = {};
    if (unresolvedPrefixes.length > 0) {
      const models = await prisma.dressModel.findMany({
        where: { barcodePrefix: { in: unresolvedPrefixes } },
        select: { barcodePrefix: true, name: true }
      });
      modelByPrefix = Object.fromEntries(models.map(m => [m.barcodePrefix, m.name]));
    }
    items.forEach(i => {
      i.dressModelName = i.dressItem?.dress?.name || modelByPrefix[i.barcodePrefix] || null;
      i.dressPrefix = i.dressItem?.dress?.barcodePrefix ?? i.barcodePrefix ?? null;
    });

    const sortedItems = items.sort((a, b) => {
      const getPriority = (date) => {
        if (!date) return 2;
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = d.getTime() - today.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays <= 7) return 1; // This coming week (including today)
        return 2;
      };

      const pA = getPriority(a.order?.eventDate);
      const pB = getPriority(b.order?.eventDate);

      if (pA !== pB) return pA - pB;

      const dateA = a.order?.eventDate ? new Date(a.order.eventDate).getTime() : 0;
      const dateB = b.order?.eventDate ? new Date(b.order.eventDate).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA; // Newest to oldest (descending date)

      const custA = (a.order?.customer?.firstName || '') + ' ' + (a.order?.customer?.lastName || '');
      const custB = (b.order?.customer?.firstName || '') + ' ' + (b.order?.customer?.lastName || '');
      if (custA !== custB) return custA.localeCompare(custB);

      const dressA = a.dressItem?.dress?.name || a.dressItem?.dressName || '';
      const dressB = b.dressItem?.dress?.name || b.dressItem?.dressName || '';
      return dressA.localeCompare(dressB);
    });

    let filteredItems = sortedItems;
    if (search) {
      const lowerSearch = search.toLowerCase();
      filteredItems = sortedItems.filter(item => {
        const custFirst = item.order?.customer?.firstName?.toLowerCase() || '';
        const custLast = item.order?.customer?.lastName?.toLowerCase() || '';
        const dressName = item.dressItem?.dress?.name?.toLowerCase() || item.dressItem?.dressName?.toLowerCase() || '';
        const orderId = item.order?.orderId?.toString() || '';
        return custFirst.includes(lowerSearch) || custLast.includes(lowerSearch) || dressName.includes(lowerSearch) || orderId.includes(lowerSearch);
      });
    }

    if (page !== null) {
      const total = filteredItems.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const paginatedItems = filteredItems.slice((page - 1) * limit, page * limit);
      return NextResponse.json({ data: paginatedItems, total, totalPages });
    }

    return NextResponse.json(filteredItems);

  } catch (error) {
    console.error('Error fetching alterations:', error);
    return NextResponse.json({ error: 'Failed to fetch alterations' }, { status: 500 });
  }
}
