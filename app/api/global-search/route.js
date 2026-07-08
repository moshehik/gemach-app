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

    // 1. Search Customers
    const customers = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Customer" 
      WHERE isDeleted = 0 
      AND (
        firstName LIKE $1 OR 
        lastName LIKE $1 OR 
        phone1 LIKE $1 OR 
        phone2 LIKE $1 OR 
        city LIKE $1 OR 
        id = $2
      )
      LIMIT 50
    `, likeQ, isNum ? numQ : -1);

    // 2. Search Orders
    const orders = await prisma.$queryRawUnsafe(`
      SELECT o.*, c.firstName, c.lastName, (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi.orderId = o.orderId AND oi.isDeleted = 0) as itemCount
      FROM "Order" o
      LEFT JOIN "Customer" c ON o.customerId = c.id
      WHERE o.isDeleted = 0
      AND (
        c.firstName LIKE $1 OR
        c.lastName LIKE $1 OR
        c.phone1 LIKE $1 OR
        o.eventDateHebrew LIKE $1 OR
        CAST(o."eventDate" AS TEXT) LIKE $1 OR
        o.orderId = $2 OR 
        o.id = $2
      )
      LIMIT 50
    `, likeQ, isNum ? numQ : -1);

    // 3. Search Rentals (OrderItems / Dresses)
    const rentals = await prisma.$queryRawUnsafe(`
      SELECT oi.*, d.dressName as catalogName, d.barcodePrefix as catalogBarcode
      FROM "OrderItem" oi
      LEFT JOIN "DressItem" d ON oi.dressItemId = d.id
      WHERE oi.isDeleted = 0
      AND (
        oi.description LIKE $1 OR 
        oi.sizeText LIKE $1 OR 
        d.dressName LIKE $1 OR
        oi.barcode LIKE $1 OR
        CAST(oi."barcodePrefix" AS TEXT) LIKE $1 OR
        CAST(d."barcodePrefix" AS TEXT) LIKE $1 OR
        oi.orderId = $2
      )
      LIMIT 50
    `, likeQ, isNum ? numQ : -1);

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
