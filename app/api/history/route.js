import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';
import { verifyEmployeeCredentials } from '../../../lib/employeeAuth';
import { verifySecret } from '@/lib/passwordAuth';


export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '60', 10);
    const search = searchParams.get('search') || '';
    const employeeId = searchParams.get('employeeId') || ''; // can be "guest", number, or empty
    const sort = searchParams.get('sort') || 'timestamp';
    const order = searchParams.get('order') || 'desc';
    const filterType = searchParams.get('filterType') || ''; // 'api', 'pages', or ''

    const where = {};

    if (search) {
      where.OR = [
        { pageUrl: { contains: search } },
        { requestQuery: { contains: search } },
        { loadingError: { contains: search } },
      ];
    }

    if (filterType === 'api') {
      where.pageUrl = { contains: '/api/' };
    } else if (filterType === 'pages') {
      where.NOT = { pageUrl: { contains: '/api/' } };
    }

    if (employeeId) {
      if (employeeId === 'guest') {
        where.isGuest = true;
      } else {
        where.employeeId = employeeId;
      }
    }

    const total = await prisma.pageVisitLog.count({ where });
    const totalPages = Math.ceil(total / limit) || 1;

    const skip = (page - 1) * limit;

    const data = await prisma.pageVisitLog.findMany({
      where,
      orderBy: { [sort]: order },
      skip,
      take: limit,
    });

    const totalOverall = await prisma.pageVisitLog.count();

    return NextResponse.json({
      success: true,
      data,
      total,
      totalPages,
      totalOverall // for showing alert if > 10000
    });
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const { ids, deleteAll, olderThanDays, username, password } = body;

    // username (employeeId) may legitimately be blank - see the fallback scan below
    if (!password) {
      return NextResponse.json({ success: false, message: 'נדרש שם משתמש וסיסמה לאישור המחיקה' }, { status: 401 });
    }

    // Verify employee credentials - passwords are hashed, so this compares via bcrypt in JS
    // (see lib/employeeAuth.js) rather than a plaintext `password: password` clause.
    let validEmployee = await verifyEmployeeCredentials(username, password);

    // כשהדף שולח לכאן את ה-employeeId שהוחזר מ-customAuthPrompt (PopupProvider) הוא עלול
    // להישאר ריק אם המשתמש לא בחר את עצמו מרשימת "בחר מנהל" - כמו ב-/api/auth/verify-pin,
    // נופלים במקרה הזה לסריקת כל העובדים הפעילים במקום לדחות אישור שכבר תקף.
    if (!validEmployee && !username) {
      const candidates = await prisma.employee.findMany({ where: { isActive: true } });
      for (const candidate of candidates) {
        if (await verifySecret(password, candidate.password)) {
          validEmployee = candidate;
          break;
        }
      }
    }

    if (!validEmployee) {
      return NextResponse.json({ success: false, message: 'שם משתמש או סיסמה שגויים' }, { status: 401 });
    }

    // Check for management role (roleId === 1)
    if (validEmployee.roleId !== 1) {
      return NextResponse.json({ success: false, message: 'אין הרשאת ניהול (מנהל) לביצוע פעולה זו' }, { status: 403 });
    }

    if (deleteAll) {
      await prisma.pageVisitLog.deleteMany({});
    } else if (olderThanDays !== undefined && olderThanDays !== null && olderThanDays !== '') {
      const days = parseInt(olderThanDays, 10);
      if (!Number.isFinite(days) || days <= 0) {
        return NextResponse.json({ success: false, message: 'מספר ימים לא תקין' }, { status: 400 });
      }
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await prisma.pageVisitLog.deleteMany({
        where: { timestamp: { lt: cutoff } }
      });
      return NextResponse.json({ success: true, deletedCount: result.count });
    } else if (Array.isArray(ids) && ids.length > 0) {
      await prisma.pageVisitLog.deleteMany({
        where: { id: { in: ids } }
      });
    } else {
      return NextResponse.json({ success: false, message: 'לא נבחרו רשומות למחיקה' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete history:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת במחיקה' }, { status: 500 });
  }
}
