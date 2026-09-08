import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';
import { buildMultiWordNameSql } from '@/lib/searchUtils';

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

    // חיפוש שם מלא ("רחל כהן") - $1/likeQ בודק כל שדה מול המחרוזת השלמה, כך ששם
    // פרטי+משפחה יחד (בשני טורים נפרדים) לא היה תואם אף שדה בנפרד. מוסיפים תנאי
    // נוסף ($4+) שדורש שכל מילה תימצא בשם הפרטי או המשפחה, בלי תלות בסדר -
    // ר' lib/searchUtils.js ודיווח "החיפוש במסך הבית גם כן לא עובד".
    const custNameWords = buildMultiWordNameSql(q, 4, '"firstName"', '"lastName"');
    const orderNameWords = buildMultiWordNameSql(q, 4, 'c."firstName"', 'c."lastName"');

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
          ${custNameWords ? `OR ${custNameWords.clauseSql}` : ''}
        )
        ORDER BY "updatedAt" DESC
        LIMIT 50
      `, likeQ, isNum ? numQ : -1, q, ...(custNameWords ? custNameWords.params : [])),

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
          ${orderNameWords ? `OR ${orderNameWords.clauseSql}` : ''}
        )
        ORDER BY o."orderId" DESC
        LIMIT 50
      `, likeQ, isNum ? numQ : -1, q, ...(orderNameWords ? orderNameWords.params : [])),

      // 3. Search Rentals (OrderItems / Dresses) — used by app/page.js's global search results
      // d."dressName"/d."barcodePrefix" are legacy, pre-migration fields (see schema.prisma) —
      // post-migration items carry their name/barcode on DressModel via dressModelId instead,
      // so we join DressModel too and COALESCE both, same relation app/api/orders/route.js uses.
      prisma.$queryRawUnsafe(`
        SELECT oi.*,
          COALESCE(d."dressName", dm."name") as "catalogName",
          COALESCE(d."barcodePrefix", dm."barcodePrefix") as "catalogBarcode"
        FROM "OrderItem" oi
        LEFT JOIN "DressItem" d ON oi."dressItemId" = d.id
        LEFT JOIN "DressModel" dm ON d."dressModelId" = dm.id
        WHERE oi."isDeleted" = false
        AND (
          oi.description LIKE $1 OR
          oi."sizeText" LIKE $1 OR
          COALESCE(d."dressName", dm."name") LIKE $1 OR
          oi.barcode LIKE $1 OR
          CAST(oi."barcodePrefix" AS TEXT) LIKE $1 OR
          CAST(COALESCE(d."barcodePrefix", dm."barcodePrefix") AS TEXT) LIKE $1 OR
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
