import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { checkAuth } from '@/lib/auth';

// roleId 1 (מנהל) ו-roleId 2 (מתכנת) הם תפקידי מערכת: שערי ההרשאות ב-lib/auth.js
// (ROLE_LEVELS) ובבדיקות מנהל נוספות מסתמכים על המספרים האלה ישירות. מחיקתם
// הייתה שוברת את מנגנון ההרשאות של המערכת כולה - ולכן חסומה כאן בצד השרת.
const SYSTEM_ROLE_IDS = [1, 2];

export async function PUT(request, { params }) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת מנהל לעדכון מחלקה' }, { status: 401 });
  }
  try {
    const resolvedParams = await params;
    const roleId = parseInt(resolvedParams.roleId, 10);
    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'מספר מחלקה לא תקין' }, { status: 400 });
    }

    const body = await request.json();
    const name = (body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'חובה להזין שם מחלקה' }, { status: 400 });
    }

    const existing = await prisma.department.findUnique({ where: { roleId } });
    if (!existing) {
      return NextResponse.json({ error: `מחלקה מספר ${roleId} לא נמצאה במערכת` }, { status: 404 });
    }

    // שם כפול היה יוצר דו-משמעות בהגדרות שמפנות למחלקות לפי שם (ראו POST ביצירה)
    const nameTaken = await prisma.department.findFirst({
      where: { name, roleId: { not: roleId } }
    });
    if (nameTaken) {
      return NextResponse.json({ error: `כבר קיימת מחלקה בשם "${name}" (מספר ${nameTaken.roleId})` }, { status: 409 });
    }

    const updated = await prisma.department.update({
      where: { roleId },
      data: { name }
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון המחלקה' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת מנהל למחיקת מחלקה' }, { status: 401 });
  }
  try {
    const resolvedParams = await params;
    const roleId = parseInt(resolvedParams.roleId, 10);
    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'מספר מחלקה לא תקין' }, { status: 400 });
    }

    if (SYSTEM_ROLE_IDS.includes(roleId)) {
      return NextResponse.json({
        error: 'לא ניתן למחוק מחלקה זו: זהו תפקיד מערכת (מנהל/מתכנת) שמנגנון ההרשאות מסתמך עליו'
      }, { status: 409 });
    }

    const existing = await prisma.department.findUnique({ where: { roleId } });
    if (!existing) {
      return NextResponse.json({ error: `מחלקה מספר ${roleId} לא נמצאה במערכת` }, { status: 404 });
    }

    // חסימת מחיקה של מחלקה בשימוש: Employee.roleId הוא הטבלה היחידה בסכימה
    // שמפנה ל-Department (נבדק מול prisma/schema.prisma). סופרים את כל העובדים,
    // כולל לא-פעילים - גם עובד לא-פעיל עדיין מצביע על המחלקה בכרטיס שלו.
    const employeeCount = await prisma.employee.count({ where: { roleId } });
    if (employeeCount > 0) {
      return NextResponse.json({
        error: `לא ניתן למחוק את המחלקה "${existing.name}": משויכים אליה ${employeeCount} עובדים. יש להעביר אותם למחלקה אחרת בכרטיס העובד ולנסות שוב.`
      }, { status: 409 });
    }

    await prisma.department.delete({ where: { roleId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json({ error: 'שגיאה במחיקת המחלקה' }, { status: 500 });
  }
}
