import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';

// מי יכול לאשר שינוי הגדרה: עובדים פעילים בהנהלה ראשית/מתכנת (HEAD_MANAGEMENT_ROLES) -
// אותו סינון כמו customAuthPrompt('הנהלה ראשית') ב-PopupProvider.js ואותו כלל ש-POST /api/settings אוכף. קריאה בלבד, בלי סיסמאות.
export const dynamic = 'force-dynamic';
const ROLE_LABEL = { 0: 'הנהלה ראשית', 2: 'מתכנת' };

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const rows = await prisma.employee.findMany({
      where: { isActive: true, roleId: { in: HEAD_MANAGEMENT_ROLES } },
      select: { id: true, firstName: true, lastName: true, fullName: true, roleId: true },
    });
    const approvers = rows.map((e) => ({
      id: e.id,
      name: [e.firstName, e.lastName].map((x) => (x || '').trim()).filter(Boolean).join(' ') || e.fullName || '',
      role: ROLE_LABEL[e.roleId] || '',
      roleId: e.roleId,
    })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    return NextResponse.json({ approvers });
  } catch (error) {
    console.error('a5 approvers error:', error);
    return NextResponse.json({ error: 'Failed to load approvers' }, { status: 500 });
  }
}
