import { NextResponse } from 'next/server';
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
    const search = searchParams.get('search') || '';
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')) : null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 60;

    // Base query for OrderItem
    const whereClause = {
      isDeleted: false,
      order: {
        isDeleted: false
      }
    };

    if (startDate || endDate) {
      whereClause.order.eventDate = {};
      if (startDate) {
        // In legacy, it searched events > (date - 1), which means from the start of the date.
        whereClause.order.eventDate.gte = new Date(startDate);
      }
      if (endDate) {
        // Until the end of the date
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.order.eventDate.lte = end;
      }
    }

    if (hideNoAlterations) {
        // hideNoAlterations == true means we want to see orders WITHOUT alterations.
        // Wait, the legacy said "רשימת הזמנות ללא תיקונים" uses AND IIf([תיקון_אורך]>0 Or [תיקון_צוואר] Or [תיקון_שרוול],-1,0)=0
        whereClause.neckAlteration = { in: [0, null] };
        whereClause.lengthAlteration = null; // Assuming null or empty string means no alteration
        whereClause.sleeveAlteration = { in: [0, null] };
    } else {
        // Show only items that HAVE alterations
        whereClause.OR = [
            { neckAlteration: { gt: 0 } },
            { lengthAlteration: { not: null, not: "" } },
            { sleeveAlteration: { gt: 0 } }
        ];
        
        if (showOnlyPending) {
            whereClause.alterationDone = false;
        }
    }

    const items = await prisma.orderItem.findMany({
      where: whereClause,
      include: {
        order: {
          include: {
            customer: true
          }
        },
        dressItem: {
          include: {
            dress: true
          }
        }
      }
    });

    // Custom sorting as in Access:
    // 1. Today
    // 2. Tomorrow
    // 4. Other
    // Then: eventDate, customer Name, dress Name
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sortedItems = items.sort((a, b) => {
      const getPriority = (date) => {
        if (!date) return 4;
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() === today.getTime()) return 1;
        if (d.getTime() === tomorrow.getTime()) return 2;
        return 4;
      };

      const pA = getPriority(a.order?.eventDate);
      const pB = getPriority(b.order?.eventDate);

      if (pA !== pB) return pA - pB;

      const dateA = a.order?.eventDate ? new Date(a.order.eventDate).getTime() : 0;
      const dateB = b.order?.eventDate ? new Date(b.order.eventDate).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;

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
