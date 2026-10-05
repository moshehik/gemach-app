import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { attachEmployeeNames } from '@/app/lib/auditLog';
import { stripProfileImages } from '@/lib/employeeCardHistory';

export async function GET(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית'))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;

    if (!employeeId) {
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 400 });
    }

    // `employeeId` on AuditLog is the ACTOR who made a change, not the entity being changed.
    // The history tab wants changes made TO this employee's own record (entityType:
    // 'Employee', entityId: <this employee's id>) AND changes made to this employee's
    // shifts (entityType: 'Shift', entityId: <shift id>, written by hand from the shifts
    // routes since Shift is excluded from the automatic audit extension - see
    // app/lib/prisma.js). Previously this route only queried the 'Employee' rows, so a
    // shift's own AuditLog entries (e.g. "הוספת משמרת") never appeared in this tab even
    // though they were recorded correctly in the database.
    const shifts = await prisma.shift.findMany({
      where: { employeeId },
      select: { id: true }
    });
    const shiftIds = shifts.map(s => s.id);

    let history = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'Employee', entityId: employeeId },
          ...(shiftIds.length > 0 ? [{ entityType: 'Shift', entityId: { in: shiftIds } }] : [])
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to recent 100 logs
    });

    // הרחבה אופציונלית (?extended=1, כרטיס העובד החדש): מוסיפה גם שורות יומן של חריגות
    // ההרשאה האישיות של העובד (EmployeePermissionOverride). בלי הפרמטר התשובה זהה לחלוטין
    // לקודמת, כך שהטאב הישן ממשיך לעבוד כמו שהוא. קריאה בלבד - לא נכתבת שום שורת יומן.
    //
    // איך מבודדים את שורות העובד: ל-EmployeePermissionOverride אין employeeId בשורת היומן
    // (entityId הוא מזהה שורת החריגה עצמה, לא העובד). לכן מאתרים את המזהים בשני דרכים:
    //   1. חריגות שעדיין קיימות - לפי employeeId בטבלת החריגות.
    //   2. שורות CREATE ישנות שבהן changesJson מכיל את העובד (תמונת מצב מלאה של השורה) -
    //      מהן מגיע מזהה השורה גם אחרי שהחריגה נמחקה, וכך נתפסות גם שורות המחיקה שלה.
    // מגבלות ידועות: (א) setEmployeeOverride משתמש ב-upsert, שתוסף היומן האוטומטי
    // (app/lib/prisma.js) לא מתעד - רק create/update/delete - ולכן שינוי ערך חריגה כיום לא נרשם
    // בכלל; (ב) שורת מחיקה נרשמת כ-{"deleted":true} בלי מפתח ההרשאה, וחריגה שנמחקה שלא נוצרה
    // בעבר דרך create אינה ניתנת לשיוך לעובד.
    if (new URL(request.url).searchParams.get('extended') === '1') {
      const overrides = await prisma.employeePermissionOverride.findMany({
        where: { employeeId },
        select: { id: true }
      });
      const createdLogs = await prisma.auditLog.findMany({
        where: {
          entityType: 'EmployeePermissionOverride',
          changesJson: { contains: employeeId }
        },
        select: { entityId: true },
        take: 500
      });
      const overrideIds = [...new Set([
        ...overrides.map(o => o.id),
        ...createdLogs.map(l => l.entityId)
      ])].filter(Boolean);

      if (overrideIds.length > 0) {
        const permissionLogs = await prisma.auditLog.findMany({
          where: { entityType: 'EmployeePermissionOverride', entityId: { in: overrideIds } },
          orderBy: { createdAt: 'desc' },
          take: 100
        });
        history = [...history, ...permissionLogs]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 100);
      }
    }

    let historyWithNames = await attachEmployeeNames(history);

    // ההרחבה בלבד: תמונת פרופיל נשמרת ביומן כ-data URL של כמה MB - הכרטיס החדש לא צריך אותה (מציג תווית),
    // ולכן מסירים אותה לפני השליחה. מסלול ברירת המחדל (הטאב הישן) נשאר זהה בייט-לבייט.
    if (new URL(request.url).searchParams.get('extended') === '1') {
      historyWithNames = stripProfileImages(historyWithNames);
    }

    return NextResponse.json(historyWithNames);
  } catch (error) {
    console.error('Error fetching employee history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
