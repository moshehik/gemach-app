import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { checkAuth } from '@/lib/auth';
import { normalizeEmail } from '@/lib/emailUtils';

export const dynamic = 'force-dynamic';

// 11 - ייבוא לקוח מימות המשיח (שלד בטוח, מותנה ב-yemot_import_customer_enabled)
export async function POST(request) {
  const all = await getAllCachedSettings();
  const enabled = all.find(s => s.key === 'yemot_enabled')?.value === 'true';
  const importOn = all.find(s => s.key === 'yemot_import_customer_enabled')?.value === 'true';
  if (!enabled || !importOn) {
    return NextResponse.json({ error: 'ייבוא מימות כבוי בהגדרות → סנכרון' }, { status: 403 });
  }
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { phone, yemotId } = await request.json();
    const apiUrl = all.find(s => s.key === 'yemot_api_url')?.value || '';
    const token = all.find(s => s.key === 'yemot_api_token')?.value || '';
    if (!apiUrl || !token) {
      return NextResponse.json({ error: 'נא להגדיר URL וטוקן ימות בהגדרות' }, { status: 400 });
    }
    // שלד: קריאה לימות + המרת פרטים ל-Customer
    const query = yemotId || phone;
    if (!query) return NextResponse.json({ error: 'חסר phone או yemotId' }, { status: 400 });
    const url = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!data) return NextResponse.json({ error: 'אין תשובה מימות' }, { status: 502 });
    // נסיון מיפוי גנרי
    const name = data.name || data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim();
    const mapped = {
      firstName: data.firstName || name.split(' ')[0] || '',
      lastName: data.lastName || name.split(' ').slice(1).join(' ') || '',
      phone1: data.phone || data.phone1 || phone || '',
      email: normalizeEmail(data.email || '', ''),
      city: data.city || '',
      street: data.street || '',
    };
    // אם הלקוח קיים לפי טלפון - החזר, אחרת צור
    const existing = mapped.phone1 ? await prisma.customer.findFirst({ where: { phone1: mapped.phone1, isDeleted: false } }) : null;
    if (existing) return NextResponse.json({ customer: existing, source: 'existing' });
    const maxC = await prisma.customer.findFirst({ where: { legacyId: { not: null } }, orderBy: { legacyId: 'desc' } });
    const nextId = (maxC?.legacyId || 0) + 1;
    const created = await prisma.customer.create({
      data: { legacyId: nextId, ...mapped },
    });
    return NextResponse.json({ customer: created, source: 'created' });
  } catch (e) {
    console.error('yemot import failed', e);
    return NextResponse.json({ error: 'שגיאת ייבוא' }, { status: 500 });
  }
}
