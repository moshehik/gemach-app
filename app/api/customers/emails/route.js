import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getSessionEmployee, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import { normalizeEmail } from '@/lib/emailUtils';

// GET /api/customers/emails — נתיב תאימות לכרטיס "רשימת מיילים מלאה" במסך הניהול הראשי הישן בלבד (4.10.2026, מעבר "ישן / חדש"):
// app/admin/LegacyAdminPage.js -> EmailListCard -> components/FullEmailListModal.js (שוחזרו מ-git כפי שהם).
//
// זה לא המטפל הישן (שהוסר ב-f899806a, שם הספיק כל עובד מחובר): כאן רק הנהלה ראשית / מתכנת — אותו קהל כמו מסך הניהול
// (app/admin/layout.js) — ונכשל סגור: אין עובד מחובר פעיל (גם במצב "בלי חובת התחברות", גם בשגיאת DB) = אין גישה.
// אותם שדות ואותה צורה כמו פעם ({ success, count, data }). קריאה בלבד.
export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getSessionEmployee(); // null כשאין עוגייה מאומתת / העובד לא פעיל / שגיאת DB
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!HEAD_MANAGEMENT_ROLES.includes(me.roleId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const customers = await prisma.customer.findMany({
      where: { isDeleted: false, email: { not: null, notIn: [''] } },
      orderBy: { legacyId: 'desc' },
      select: { id: true, legacyId: true, firstName: true, lastName: true, phone1: true, city: true, email: true, emailSuffix: true },
    });
    const data = customers.map((c) => ({
      id: c.id,
      legacyId: c.legacyId,
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'ללא שם',
      phone: c.phone1 || '',
      city: c.city || '',
      email: normalizeEmail(c.email, c.emailSuffix),
    })).filter((c) => c.email && c.email.includes('@'));
    return NextResponse.json({ success: true, count: data.length, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching legacy email list:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}
