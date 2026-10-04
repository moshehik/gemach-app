import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';
import { buildMultiWordNameSql, buildFuzzyNameSql } from '@/lib/searchUtils';

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
    // חיפוש שנראה כמו ברקוד (ספרות בלבד, 5+): ברקוד חוזר בהזמנות רבות לאורך השנים, ולכן הפריט
    // שמושכר עכשיו (נלקח ולא הוחזר) קודם - זה מה שמי שסורקת/מקלידה ברקוד מחפשת. שאר החיפושים כמו קודם.
    const rentalsOrderBy = /^d{5,}$/.test(q.trim())
      ? `CASE WHEN oi."isTaken" AND NOT oi."isReturned" THEN 0 ELSE 1 END, oi."createdAt" DESC`
      : `oi."createdAt" DESC`;

    // חיפוש שם מלא ("רחל כהן") - $1/likeQ בודק כל שדה מול המחרוזת השלמה, כך ששם
    // פרטי+משפחה יחד (בשני טורים נפרדים) לא היה תואם אף שדה בנפרד. מוסיפים תנאי
    // נוסף ($4+) שדורש שכל מילה תימצא בשם הפרטי או המשפחה, בלי תלות בסדר -
    // ר' lib/searchUtils.js ודיווח "החיפוש במסך הבית גם כן לא עובד".
    const custNameWords = buildMultiWordNameSql(q, 4, '"firstName"', '"lastName"');
    // Tier 2+3 fuzzy name matching (docs/smart-quick-search-plan-2026-09-27.md) -
    // pg_trgm similarity + Hebrew phonetic key, so a spelling variant like
    // שיינווטר surfaces when someone searches שיינועטר. Additive only - never
    // hides the exact/multi-word matches above, just widens recall and ranks
    // below them.
    const custFuzzy = buildFuzzyNameSql(
      q, 4 + (custNameWords ? custNameWords.params.length : 0),
      '"firstName"', '"lastName"', '"firstNamePhoneticKey"', '"lastNamePhoneticKey"'
    );

    const orderNameWords = buildMultiWordNameSql(q, 4, 'c."firstName"', 'c."lastName"');
    const orderFuzzy = buildFuzzyNameSql(
      q, 4 + (orderNameWords ? orderNameWords.params.length : 0),
      'c."firstName"', 'c."lastName"', 'c."firstNamePhoneticKey"', 'c."lastNamePhoneticKey"'
    );

    // SECURITY: explicit column lists only (never SELECT * / o.* / oi.*). Any employee can call this
    // endpoint, and the full rows carry zeout (ID number), bank*/hok* details, email, addresses,
    // internalNotes/officeNotes/notes, blockedReason, hokDetails. Add a column here only if a
    // consumer (app/page.js, TopbarSearch, public/a5 adapters) actually renders it.
    // Run the three independent searches concurrently instead of sequentially.
    const [customers, orders, rentals] = await Promise.all([
      // 1. Search Customers
      prisma.$queryRawUnsafe(`
        SELECT "id", "firstName", "lastName", "phone1", "phone2", "city",
          COALESCE(
            "firstName" LIKE $1 OR "lastName" LIKE $1 OR phone1 LIKE $1 OR phone2 LIKE $1 OR city LIKE $1 OR id = $3
            ${custNameWords ? `OR ${custNameWords.clauseSql}` : ''}
          , false) AS "isExactMatch",
          ${custFuzzy ? custFuzzy.scoreSql : '0'} AS "fuzzyScore"
        FROM "Customer"
        WHERE "isDeleted" = false
        AND (
          "firstName" LIKE $1 OR
          "lastName" LIKE $1 OR
          phone1 LIKE $1 OR
          phone2 LIKE $1 OR
          city LIKE $1 OR
          id = $3
          ${custNameWords ? `OR ${custNameWords.clauseSql}` : ''}
          ${custFuzzy ? `OR ${custFuzzy.clauseSql}` : ''}
        )
        ORDER BY "isExactMatch" DESC, "fuzzyScore" DESC NULLS LAST, "updatedAt" DESC
        LIMIT 50
      `, likeQ, isNum ? numQ : -1, q,
        ...(custNameWords ? custNameWords.params : []),
        ...(custFuzzy ? custFuzzy.params : [])),

      // 2. Search Orders
      prisma.$queryRawUnsafe(`
        SELECT o."id", o."orderId", o."customerId", o."status", o."totalAmount",
          o."eventDate", o."eventDateHebrew", c."firstName", c."lastName",
          (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi."orderId" = o."orderId" AND oi."isDeleted" = false) as "itemCount",
          COALESCE(
            c."firstName" LIKE $1 OR c."lastName" LIKE $1 OR c.phone1 LIKE $1 OR
            o."eventDateHebrew" LIKE $1 OR TO_CHAR(o."eventDate", 'DD/MM/YYYY') LIKE $1 OR TO_CHAR(o."eventDate", 'DD-MM-YYYY') LIKE $1 OR
            o."orderId" = $2 OR o.id = $3
            ${orderNameWords ? `OR ${orderNameWords.clauseSql}` : ''}
          , false) AS "isExactMatch",
          ${orderFuzzy ? orderFuzzy.scoreSql : '0'} AS "fuzzyScore"
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
          ${orderFuzzy ? `OR ${orderFuzzy.clauseSql}` : ''}
        )
        ORDER BY "isExactMatch" DESC, "fuzzyScore" DESC NULLS LAST, o."orderId" DESC
        LIMIT 50
      `, likeQ, isNum ? numQ : -1, q,
        ...(orderNameWords ? orderNameWords.params : []),
        ...(orderFuzzy ? orderFuzzy.params : [])),

      // 3. Search Rentals (OrderItems / Dresses) — used by app/page.js's global search results
      // d."dressName"/d."barcodePrefix" are legacy, pre-migration fields (see schema.prisma) —
      // post-migration items carry their name/barcode on DressModel via dressModelId instead,
      // so we join DressModel too and COALESCE both, same relation app/api/orders/route.js uses.
      prisma.$queryRawUnsafe(`
        SELECT oi."id", oi."orderId", oi."barcode", oi."sizeText", oi."description",
          oi."isTaken", oi."isReturned",
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
        ORDER BY ${rentalsOrderBy}
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
