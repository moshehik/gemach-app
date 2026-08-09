import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '@/lib/auth';

// מקור האמת היחיד לרשימת המחלקות הוא טבלת Department במסד הנתונים — אין
// (ואסור שיהיה) fallback קשיח בקוד. רשימה כפולה בקוד מתיישנת בשקט ברגע
// שמחלקות נוצרות/נמחקות דרך מסך הניהול (/admin/departments), ו-fallback שקט
// מסתיר תקלת DB אמיתית מאחורי נתונים שגויים. כשליפה נכשלת מחזירים 500 מפורש
// והלקוחות מציגים מצב שגיאה ברור.

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const departments = await prisma.department.findMany({
      orderBy: { roleId: 'asc' },
      // ספירת העובדים המשויכים - משמשת את מסך ניהול המחלקות (וגם את חסימת המחיקה בצד השרת)
      include: { _count: { select: { employees: true } } }
    });
    return NextResponse.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת רשימת המחלקות מהמערכת' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת מנהל ליצירת מחלקה' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    const roleId = parseInt(body.roleId, 10);

    if (!name) {
      return NextResponse.json({ error: 'חובה להזין שם מחלקה' }, { status: 400 });
    }
    if (isNaN(roleId) || roleId < 0) {
      return NextResponse.json({ error: 'חובה להזין מספר מחלקה תקין (מספר שלם, 0 ומעלה)' }, { status: 400 });
    }

    // שמות חייבים להיות ייחודיים בפועל: הגדרות מערכת (למשל "מחלקות מורשות")
    // שומרות מחלקות לפי שם - שם כפול היה יוצר דו-משמעות.
    const nameTaken = await prisma.department.findFirst({ where: { name } });
    if (nameTaken) {
      return NextResponse.json({ error: `כבר קיימת מחלקה בשם "${name}" (מספר ${nameTaken.roleId})` }, { status: 409 });
    }

    const created = await prisma.department.create({ data: { roleId, name } });
    return NextResponse.json(created);
  } catch (error) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'מספר המחלקה שהוזן כבר קיים במערכת' }, { status: 409 });
    }
    console.error('Error creating department:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת המחלקה' }, { status: 500 });
  }
}
