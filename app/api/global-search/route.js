import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ customers: [], orders: [], rentals: [] });
  }

  try {
    // Check if query is a number
    const isNum = !isNaN(q) && q.trim() !== '';
    const numQ = isNum ? Number(q) : undefined;
    const likeQ = `%${q}%`;

    // Run the three independent searches concurrently instead of sequentially.
    const [customers, orders, rentals] = await Promise.all([
      // 1. Search Customers
      prisma.$queryRawUnsafe(`
        SELECT * FROM "Customer"
        WHERE "isDeleted" = false
        AND (
          "firstName" LIKE $1 OR
          "lastName" LIKE $1 OR
          phone1 LIKE $1 OR
          phone2 LIKE $1 OR
          city LIKE $1 OR
          id = $3
        )
        ORDER BY "updatedAt" DESC
        LIMIT 50
      `, likeQ, isNum ? numQ : -1, q),

      // 2. Search Orders
      prisma.$queryRawUnsafe(`
        SELECT o.*, c."firstName", c."lastName", (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi."orderId" = o."orderId" AND oi."isDeleted" = false) as "itemCount"
        FROM "Order" o
        LEFT JOIN "Customer" c ON o."customerId" = c.id
        WHERE o."isDeleted" = false
        AND (
          c."firstName" LIKE $1 OR
          c."lastName" LIKE $1 OR
          c.phone1 LIKE $1 OR
          o."eventDateHebrew" LIKE $1 OR
          TO_CHAR(o."eventDate", 'DD/MM/YYYY') LIKE $1 OR
          TO_CHAR(o."eventDate", 'DD-MM-YYYY') LIKE $1 OR
          o."orderId" = $2 OR
          o.id = $3
        )
        ORDER BY o."orderId" DESC
        LIMIT 50
      `, likeQ, isNum ? numQ : -1, q),

      // 3. Search Rentals (OrderItems / Dresses) — used by app/page.js's global search results
      prisma.$queryRawUnsafe(`
        SELECT oi.*, d."dressName" as "catalogName", d."barcodePrefix" as "catalogBarcode"
        FROM "OrderItem" oi
        LEFT JOIN "DressItem" d ON oi."dressItemId" = d.id
        WHERE oi."isDeleted" = false
        AND (
          oi.description LIKE $1 OR
          oi."sizeText" LIKE $1 OR
          d."dressName" LIKE $1 OR
          oi.barcode LIKE $1 OR
          CAST(oi."barcodePrefix" AS TEXT) LIKE $1 OR
          CAST(d."barcodePrefix" AS TEXT) LIKE $1 OR
          oi."orderId" = $2 OR
          oi.id = $3
        )
        ORDER BY oi."createdAt" DESC
        LIMIT 50
      `, likeQ, isNum ? numQ : -1, q)
    ]);

    const processedOrders = orders.map(o => ({
      ...o,
      itemCount: o.itemCount ? Number(o.itemCount) : 0
    }));

    return NextResponse.json({ customers, orders: processedOrders, rentals });
  } catch (error) {
    console.error('Global search error:', error);
    return NextResponse.json({ error: 'Failed to perform global search' }, { status: 500 });
  }
}
