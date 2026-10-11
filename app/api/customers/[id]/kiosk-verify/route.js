// POST /api/customers/[id]/kiosk-verify - העובדת מאשרת שפרטי לקוחה שנרשמה בעמדה אומתו (מסיר את הסימון "נרשמה בעמדה - לאמת פרטים").
// אין כאן שינוי סכמה: הסימון הוא שורה קבועה ב-Customer.officeNotes (lib/kioskRegistration.js). הכתיבה עוברת ב-update רגיל,
// והתוסף של Prisma רושם שורת יומן אחת (לא כותבים AuditLog ידנית).
import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { buildVerifiedOfficeNotes } from '@/lib/kioskRegistration';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    if (typeof id !== 'string' || !id || id.length > 64) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true, isDeleted: true, officeNotes: true } });
    if (!customer || customer.isDeleted) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    const next = buildVerifiedOfficeNotes(customer.officeNotes);
    if (next === null) return NextResponse.json({ ok: true, changed: false });
    // update רגיל: ההיסטוריה מציגה שינוי בשדה "נתוני משרד" (פעולה/שדה מותאמים לא מוכרים ללוח ההיסטוריה של הלקוח)
    await prisma.customer.update({ where: { id }, data: { officeNotes: next } });
    return NextResponse.json({ ok: true, changed: true });
  } catch (error) {
    console.error('Error verifying kiosk registration:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
