import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAuth } from '@/lib/auth';
import {
  generateDeviceToken,
  hashDeviceToken,
  trustedDeviceCookieOptions,
  getTrustedDeviceFromCookieStore,
  TRUSTED_DEVICE_COOKIE
} from '@/lib/trustedDevice';

// Manager-only management of "trusted system computers" (מחשבי מערכת), the shared
// front-desk machines employees are allowed to log into with just the last 4 digits of
// their real password. See lib/trustedDevice.js for the trust model this rests on.

// List all trusted devices (for the admin UI) + whether THIS browser is currently one of them.
export async function GET(request) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ success: false, message: 'פעולה זו מוגבלת למנהל בלבד' }, { status: 401 });
  }
  try {
    const devices = await prisma.trustedDevice.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const creatorIds = [...new Set(devices.map(d => d.createdById).filter(Boolean))];
    const creators = creatorIds.length
      ? await prisma.employee.findMany({ where: { id: { in: creatorIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const creatorNameById = Object.fromEntries(creators.map(c => [c.id, `${c.firstName || ''} ${c.lastName || ''}`.trim()]));

    const cookieStore = await cookies();
    const currentDevice = await getTrustedDeviceFromCookieStore(cookieStore);

    const safeDevices = devices.map(d => ({
      id: d.id,
      label: d.label,
      createdAt: d.createdAt,
      lastUsedAt: d.lastUsedAt,
      revokedAt: d.revokedAt,
      createdByName: d.createdById ? (creatorNameById[d.createdById] || null) : null,
      isThisDevice: !!currentDevice && currentDevice.id === d.id
    }));

    return NextResponse.json({ success: true, devices: safeDevices, isThisDeviceTrusted: !!currentDevice });
  } catch (error) {
    console.error('Error listing trusted devices:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}

// Mark THIS computer (the browser making the request) as trusted.
export async function POST(request) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ success: false, message: 'פעולה זו מוגבלת למנהל בלבד' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const label = (body.label || '').trim() || null;

    const cookieStore = await cookies();
    const managerId = cookieStore.get('auth_token')?.value || null;

    const token = generateDeviceToken();
    const tokenHash = hashDeviceToken(token);

    const device = await prisma.trustedDevice.create({
      data: {
        tokenHash,
        label,
        createdById: managerId
      }
    });

    cookieStore.set({ ...trustedDeviceCookieOptions(), value: token });

    return NextResponse.json({ success: true, device: { id: device.id, label: device.label, createdAt: device.createdAt } });
  } catch (error) {
    console.error('Error marking device trusted:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}

// Revoke a trusted device. Defaults to THIS browser's device; pass {id} to revoke a
// different one from the admin list (e.g. a computer that was decommissioned or lost).
export async function DELETE(request) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ success: false, message: 'פעולה זו מוגבלת למנהל בלבד' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const cookieStore = await cookies();

    let deviceId = body.id || null;
    if (!deviceId) {
      const currentDevice = await getTrustedDeviceFromCookieStore(cookieStore);
      if (!currentDevice) {
        return NextResponse.json({ success: false, message: 'מחשב זה אינו מוגדר כמערכת מהימנה' }, { status: 400 });
      }
      deviceId = currentDevice.id;
    }

    await prisma.trustedDevice.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() }
    });

    // Only clear the cookie if we just revoked the current browser's own device.
    const remainingCurrent = await getTrustedDeviceFromCookieStore(cookieStore);
    if (!remainingCurrent) {
      cookieStore.delete(TRUSTED_DEVICE_COOKIE);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking trusted device:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
