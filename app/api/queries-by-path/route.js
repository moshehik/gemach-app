import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pathname = searchParams.get('path') || '';
    const urlSearchRaw = searchParams.get('urlSearch') || '';
    const lastApiCallRaw = searchParams.get('lastApiCall') || '';
    const activeFiltersRaw = searchParams.get('activeFilters') || '';
    const internalSearch = (searchParams.get('search') || '').toLowerCase();

    // Parse active filters from live DOM inputs + URL + intercepted last API call
    let activeFilters = {};
    if (activeFiltersRaw) {
      try {
        activeFilters = JSON.parse(activeFiltersRaw);
      } catch (e) {}
    }

    // Merge URL params from window.location.search
    const urlParams = new URLSearchParams(urlSearchRaw);
    urlParams.forEach((val, key) => {
      if (val && !activeFilters[key]) {
        activeFilters[key] = val;
      }
    });

    // Merge params from last API call made by the page
    let lastApiEndpoint = '';
    if (lastApiCallRaw) {
      try {
        const dummyUrl = new URL(lastApiCallRaw, 'http://localhost');
        lastApiEndpoint = dummyUrl.pathname + dummyUrl.search;
        dummyUrl.searchParams.forEach((val, key) => {
          if (val && key !== '_t') {
            activeFilters[key] = val;
          }
        });
      } catch(e) {}
    }

    // Status Hebrew Dictionary
    const statusLabels = {
      unpaid: 'לא שולם (חוב)',
      all: 'הכל',
      archive: 'ארכיון',
      deleted: 'נמחקו',
      taken: 'אצל לקוח / נלקח',
      returned: 'הוחזר',
      active: 'פעיל'
    };

    const activeFilterEntries = Object.entries(activeFilters).filter(([k, v]) => v && String(v).trim());
    const filterSummaryText = activeFilterEntries.length > 0
      ? activeFilterEntries.map(([k, v]) => {
          const displayVal = statusLabels[v] || v;
          return `${k}: "${displayVal}"`;
        }).join(' | ')
      : 'ללא פילטרים פעילים';

    let resultQuery = null;

    // 1. Customer Interface / Availability (/customer-interface)
    if (pathname.includes('/customer-interface')) {
      const dateVal = activeFilters.eventDate || activeFilters['תאריך אירוע'] || '';
      const searchVal = activeFilters.search || activeFilters['חיפוש דגם או מידה...'] || activeFilters['search_input'] || '';

      const whereObj = {
        isDeleted: false,
        exitDate: null,
        ...(searchVal ? { name: { contains: searchVal } } : {})
      };

      const dateFilterSnippet = dateVal ? `
        orderItems: {
          where: {
            isDeleted: false,
            order: { eventDate: new Date("${dateVal}") } // [פילטר תאריך אירוע פעיל]
          }
        }` : `
        orderItems: { where: { isDeleted: false } }`;

      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (זמינות לקוח וקטלוג)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/dresses' + (urlSearchRaw || '')} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution with Active Filters):
prisma.dressModel.findMany({
  where: ${JSON.stringify(whereObj, null, 2)},
  include: {
    items: {
      where: { isDeleted: false },
      include: {${dateFilterSnippet}
      }
    }
  },
  orderBy: { name: 'asc' }
});`,
        isMain: true
      };
    }

    // 2. Orders List (/orders)
    else if (pathname.includes('/orders') && !pathname.includes('/new') && !pathname.match(/\/orders\/\d+/)) {
      const statusVal = activeFilters.filterStatus || activeFilters.status || '';
      const searchVal = activeFilters.search || activeFilters['חיפוש'] || activeFilters['שם לקוח / טלפון / ברקוד'] || '';
      const dateFromVal = activeFilters.eventDateFrom || activeFilters.fromDate || '';
      const dateToVal = activeFilters.eventDateTo || activeFilters.toDate || '';
      const pageVal = parseInt(activeFilters.page || '1', 10);
      const limitVal = parseInt(activeFilters.limit || '50', 10);
      const skipVal = (pageVal - 1) * limitVal;

      const whereObj = {
        isDeleted: statusVal === 'deleted' ? true : false,
        ...(statusVal === 'archive' ? { eventDate: { lt: "TODAY" } } : {}),
        ...(statusVal === 'unpaid' ? { totalPaid: { lt: "totalAmount" } } : {}),
        ...(searchVal ? {
          OR: [
            { customer: { firstName: { contains: searchVal } } },
            { customer: { lastName: { contains: searchVal } } },
            { items: { some: { dressItem: { dress: { name: { contains: searchVal } } } } } }
          ]
        } : {}),
        ...(dateFromVal || dateToVal ? {
          eventDate: {
            ...(dateFromVal ? { gte: dateFromVal } : {}),
            ...(dateToVal ? { lte: dateToVal } : {})
          }
        } : {})
      };

      resultQuery = {
        name: `⭐ קריאת השרת בזמן אמת (הזמנות - עמוד ${pageVal})`,
        subtitle: `קריאת API שנלכדה: ${lastApiEndpoint || 'GET /api/orders?page=' + pageVal + '&limit=50'}`,
        sql: `// הקוד המדויק שמופעל כעת בשרת (נלכד מ-API: ${lastApiEndpoint || '/api/orders'}):
prisma.order.findMany({
  where: ${JSON.stringify(whereObj, null, 2)},
  include: {
    customer: true,
    payments: true,
    obligations: true,
    items: {
      include: { dressItem: { include: { dress: true } } }
    }
  },
  orderBy: { eventDate: 'desc' },
  skip: ${skipVal},  // (עמוד ${pageVal}: מדלג על ${skipVal} רשומות)
  take: ${limitVal}
});`,
        isMain: true
      };
    }

    // 3. New Order Form (/orders/new)
    else if (pathname.includes('/orders/new')) {
      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (יצירת הזמנה חדשה)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'POST /api/orders & GET /api/customers & GET /api/dresses'} | ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
prisma.order.create({
  data: {
    orderId: nextOrderId,
    customerId: data.customerId,
    totalAmount: parseFloat(data.totalAmount),
    eventDate: new Date(data.eventDate),
    items: {
      create: data.items.map(item => ({
        dressItemId: item.sampleItemId,
        sizeText: item.sizeText,
        quantity: item.quantity,
        finalPrice: item.finalPrice
      }))
    },
    payments: { create: [{ amount: data.payment.amount, paymentMethod: data.payment.method }] }
  }
});`,
        isMain: true
      };
    }

    // 4. Single Order View (/orders/[id])
    else if (pathname.match(/\/orders\/\d+/)) {
      const orderIdMatch = pathname.match(/\/orders\/(\d+)/);
      const orderId = orderIdMatch ? orderIdMatch[1] : '[ID]';

      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (כרטיס הזמנה)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/orders/' + orderId}`,
        sql: `// Prisma Query (Server Execution):
prisma.order.findUnique({
  where: { orderId: ${orderId} },
  include: {
    customer: true,
    payments: true,
    obligations: true,
    items: {
      include: {
        dressItem: { include: { dress: true } }
      }
    }
  }
});`,
        isMain: true
      };
    }

    // 5. Customers List (/customers)
    else if (pathname.includes('/customers') && !pathname.includes('/customers/new') && !pathname.match(/\/customers\/[a-zA-Z0-9-]+/)) {
      const pageVal = parseInt(activeFilters.page || '1', 10);
      const limitVal = parseInt(activeFilters.limit || '50', 10);
      const sortVal = activeFilters.sort || 'legacyId';
      const orderVal = activeFilters.order || 'desc';
      const searchVal = activeFilters.search || '';
      const skipVal = (pageVal - 1) * limitVal;

      const whereObj = {
        isDeleted: false,
        ...(searchVal ? {
          OR: [
            { firstName: { contains: searchVal } },
            { lastName: { contains: searchVal } },
            { phone1: { contains: searchVal } },
            { email: { contains: searchVal } },
            { city: { contains: searchVal } }
          ]
        } : {})
      };

      resultQuery = {
        name: `⭐ קריאת השרת בזמן אמת (עמוד ${pageVal})`,
        subtitle: `קריאת API שנלכדה: ${lastApiEndpoint || 'GET /api/customers?page=' + pageVal + '&limit=50'}`,
        sql: `// הקוד המדויק שמופעל כעת בשרת (נלכד מ-API: ${lastApiEndpoint || '/api/customers'}):
const [customers, totalCount] = await Promise.all([
  prisma.customer.findMany({
    where: ${JSON.stringify(whereObj, null, 2)},
    orderBy: { ${sortVal}: '${orderVal}' },
    skip: ${skipVal},  // (עמוד ${pageVal}: מדלג על ${skipVal} רשומות)
    take: ${limitVal}
  }),
  prisma.customer.count({
    where: ${JSON.stringify(whereObj, null, 2)}
  })
]);`,
        isMain: true
      };
    }

    // 6. Single Customer Card (/customers/[id])
    else if (pathname.startsWith('/customers/')) {
      const custId = pathname.replace('/customers/', '') || '[ID]';

      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (כרטיס לקוח)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/customers/' + custId}`,
        sql: `// Prisma Query (Server Execution):
prisma.customer.findUnique({
  where: { id: ${custId} },
  include: {
    orders: {
      include: { items: true, payments: true }
    }
  }
});`,
        isMain: true
      };
    }

    // 7. Dresses Catalog (/dresses or /dashboard/dresses)
    else if (pathname.includes('/dresses') || pathname.includes('/dashboard/dresses')) {
      const searchVal = activeFilters.search || activeFilters['חיפוש דגם...'] || '';

      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (מאגר דגמי שמלות)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/dresses' + (urlSearchRaw || '')} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution with Active Filters):
prisma.dressModel.findMany({
  where: { 
    isDeleted: false,
    ${searchVal ? `name: { contains: "${searchVal}" }` : ''}
  },
  include: {
    items: {
      select: { id: true, barcodePrefix: true, sizeText: true, quantity: true, inRepair: true }
    }
  },
  orderBy: { name: 'asc' }
});`,
        isMain: true
      };
    }

    // 8. Rentals (/rentals)
    else if (pathname.includes('/rentals')) {
      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (השכרות והחזרות)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/orders?forRentals=true'} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
prisma.orderItem.findMany({
  where: {
    isDeleted: false,
    OR: [{ isTaken: true }, { isReturned: true }]
  },
  include: {
    order: { include: { customer: true } },
    dressItem: { include: { dress: true } }
  },
  orderBy: { order: { eventDate: 'desc' } }
});`,
        isMain: true
      };
    }

    // 9. Alterations (/alterations)
    else if (pathname.includes('/alterations')) {
      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (תיקונים ותופרות)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/alterations'} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
prisma.orderItem.findMany({
  where: {
    isDeleted: false,
    OR: [
      { neckAlteration: 1 },
      { sleeveAlteration: 1 },
      { lengthAlteration: { not: '' } }
    ]
  },
  include: {
    order: { include: { customer: true } },
    dressItem: { include: { dress: true } }
  }
});`,
        isMain: true
      };
    }

    // 10. Employees (/employees)
    else if (pathname.includes('/employees')) {
      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (עובדים ונוכחות)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/employees'} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
prisma.employee.findMany({
  where: { isDeleted: false },
  include: {
    shifts: { orderBy: { date: 'desc' }, take: 10 }
  },
  orderBy: { name: 'asc' }
});`,
        isMain: true
      };
    }

    // 11. Pricelist (/pricelist or /dashboard/pricelist)
    else if (pathname.includes('/pricelist')) {
      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (מחירון שירותים)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/pricelists'} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
prisma.priceList.findMany({
  orderBy: [
    { category: 'asc' },
    { price: 'asc' }
  ]
});`,
        isMain: true
      };
    }

    // 12. Dashboard (/dashboard)
    else if (pathname.includes('/dashboard') && !pathname.includes('/dresses') && !pathname.includes('/pricelist')) {
      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (דשבורד וסיכומים)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/dashboard'} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
await Promise.all([
  prisma.order.count({ where: { isDeleted: false } }),
  prisma.order.aggregate({ _sum: { totalAmount: true } }),
  prisma.customer.count({ where: { isDeleted: false } })
]);`,
        isMain: true
      };
    }

    // 13. Refunds (/refunds)
    else if (pathname.includes('/refunds')) {
      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (החזרים וזיכויים)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/refunds'} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
prisma.refund.findMany({
  include: { customer: true, order: true },
  orderBy: { createdAt: 'desc' }
});`,
        isMain: true
      };
    }

    // 14. Board (/board)
    else if (pathname.includes('/board')) {
      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (לוח משימות ותזכורות)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/notifications & GET /api/orders'} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
prisma.notification.findMany({
  where: { isRead: false },
  orderBy: { createdAt: 'desc' }
});`,
        isMain: true
      };
    }

    // 15. Messages (/messages)
    else if (pathname.includes('/messages')) {
      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (יומן הודעות ותקשורת)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/notifications'} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
prisma.notification.findMany({
  orderBy: { createdAt: 'desc' },
  take: 50
});`,
        isMain: true
      };
    }

    // 16. Punch Clock (/punch-clock)
    else if (pathname.includes('/punch-clock')) {
      resultQuery = {
        name: '⭐ שאילתת השרת בזמן אמת (שעון נוכחות עובדים)',
        subtitle: `נתיב API: ${lastApiEndpoint || 'GET /api/attendance'} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
prisma.shift.findMany({
  where: { date: { gte: startOfMonth } },
  include: { employee: true },
  orderBy: { date: 'desc' }
});`,
        isMain: true
      };
    }

    // Default Fallback
    else {
      resultQuery = {
        name: `⭐ שאילתת השרת בזמן אמת (${pathname || 'מסך נוכחי'})`,
        subtitle: `נתיב: ${lastApiEndpoint || pathname} | פילטרים פעילים: ${filterSummaryText}`,
        sql: `// Prisma Query (Server Execution):
prisma.order.findMany({
  where: { isDeleted: false },
  take: 20
});`,
        isMain: true
      };
    }

    // Filter by internal search if user typed in the debugger search box
    if (resultQuery && internalSearch) {
      const matchesSearch = 
        resultQuery.name.toLowerCase().includes(internalSearch) ||
        resultQuery.subtitle.toLowerCase().includes(internalSearch) ||
        resultQuery.sql.toLowerCase().includes(internalSearch);

      if (!matchesSearch) {
        return NextResponse.json([]);
      }
    }

    return NextResponse.json(resultQuery ? [resultQuery] : []);
  } catch (error) {
    console.error('Error in queries-by-path API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
