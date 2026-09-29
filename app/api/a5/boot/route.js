import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { resolvePageAccess, checkAiAccess } from '@/lib/permissions';
import { buildNavGroups } from '@/app/components/navConfig';

// נקודת אתחול לעמוד החדש (/a5): מי מחובר, הגדרות הארגון שהעמוד צריך, התפריט לפי הרשאות
// (אותם כללים בדיוק כמו app/layout.js) והאם החיפוש החכם מותר. קריאה בלבד.
export const dynamic = 'force-dynamic';

const SETTING_KEYS = [
  'require_login', 'home_welcome_title', 'hide_internal_messaging', 'hide_ai_features',
  'hide_gregorian_calendar', 'enable_alterations', 'enable_deliveries', 'gmach_name', 'gmach_subtitle',
  'packing_enabled', 'branches_enabled',
];
const NAV_PAGE_KEYS = ['page:refunds', 'page:dresses_catalog', 'page:board', 'page:orders', 'page:orders_new', 'page:rentals', 'page:customers', 'page:deliveries', 'page:alterations'];
const ROLE_LABEL = { 0: 'הנהלה ראשית', 1: 'מנהל סניף', 2: 'מתכנת' };

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = getVerifiedAuthCookie(cookieStore);
    const all = await getAllCachedSettings().catch(() => []);
    const settings = {};
    for (const s of all) if (SETTING_KEYS.includes(s.key)) settings[s.key] = s.value;
    const requireLogin = settings.require_login === 'true';

    let employee = null;
    if (token?.value) {
      const parsedLegacy = /^\d+$/.test(String(token.value)) ? parseInt(token.value, 10) : NaN;
      const row = await prisma.employee.findFirst({
        where: { OR: [{ id: token.value }, ...(isNaN(parsedLegacy) ? [] : [{ legacyId: parsedLegacy }])] },
        select: { id: true, firstName: true, lastName: true, fullName: true, roleId: true, isActive: true },
      });
      if (row && row.isActive) {
        employee = {
          id: row.id,
          name: row.fullName || [row.firstName, row.lastName].filter(Boolean).join(' '),
          firstName: row.firstName || '',
          roleId: row.roleId,
          roleLabel: ROLE_LABEL[row.roleId] || 'עובד',
        };
      }
    }

    const authenticated = !!employee;
    // אורח: נכנס רק כשחובת ההתחברות כבויה (אותו כלל כמו הפריסה הראשית)
    const open = !requireLogin;
    if (!authenticated && !open) {
      return NextResponse.json({ authenticated: false, requireLogin: true, settings: { home_welcome_title: settings.home_welcome_title || '' } }, { status: 401 });
    }
    if (!(await checkAuth())) {
      return NextResponse.json({ authenticated: false, requireLogin }, { status: 401 });
    }

    const roleId = employee ? employee.roleId : null;
    const isHead = authenticated ? (roleId === 0 || roleId === 2) : open;
    const isManager = authenticated ? (roleId === 1 || roleId === 2 || roleId === 0) : open;
    const pageAccess = authenticated
      ? await resolvePageAccess(roleId, employee.id, NAV_PAGE_KEYS).catch(() => null)
      : null;
    const pageVisible = (key) => (pageAccess ? pageAccess[key] : true);
    const gated = (key) => (authenticated ? (pageAccess ? pageAccess[key] : isHead) : open);

    const navGroups = buildNavGroups({
      showAdminTab: isHead,
      showEmployeesTab: isHead,
      showRefundsTab: gated('page:refunds'),
      showDressesTab: gated('page:dresses_catalog'),
      showBoardTab: gated('page:board'),
      enableAlterations: settings.enable_alterations !== 'false' && pageVisible('page:alterations'),
      showMessages: settings.hide_internal_messaging !== 'true',
      showDeliveries: settings.enable_deliveries === 'true' && pageVisible('page:deliveries'),
      showOrdersNew: pageVisible('page:orders') && pageVisible('page:orders_new'),
      showOrders: pageVisible('page:orders'),
      showRentals: pageVisible('page:rentals'),
      showCustomers: pageVisible('page:customers'),
    });

    const aiAllowed = await checkAiAccess().catch(() => false);

    return NextResponse.json({
      authenticated,
      requireLogin,
      employee,
      isHead,
      isManager,
      aiAllowed,
      settings,
      navGroups,
    });
  } catch (error) {
    console.error('a5/boot error:', error);
    return NextResponse.json({ error: 'boot failed' }, { status: 500 });
  }
}
