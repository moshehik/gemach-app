const fs = require('fs');
let content = fs.readFileSync('app/api/global-search/route.js', 'utf8');

// 1. Increase LIMIT to 50 for Customers
content = content.replace(/LIMIT 10/g, 'LIMIT 50');

// 2. Add itemCount to Orders query
content = content.replace(
  'SELECT o.*, c.firstName, c.lastName ',
  'SELECT o.*, c.firstName, c.lastName, (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi.orderId = o.orderId AND oi.isDeleted = 0) as itemCount '
);

// 3. Process orders to convert BigInt
content = content.replace(
  'return NextResponse.json({ customers, orders, rentals });',
  \const processedOrders = orders.map(o => ({
      ...o,
      itemCount: o.itemCount ? Number(o.itemCount) : 0
    }));
    return NextResponse.json({ customers, orders: processedOrders, rentals });\
);

fs.writeFileSync('app/api/global-search/route.js', content, 'utf8');
console.log('API Updated successfully');
