import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTrustedDeviceFromCookieStore } from '@/lib/trustedDevice';

// Public, unauthenticated (used by the login screen before anyone is logged in) - only
// ever reveals a boolean, never anything about which employees exist or their data.
export async function GET() {
  try {
    const cookieStore = await cookies();
    const device = await getTrustedDeviceFromCookieStore(cookieStore);
    return NextResponse.json({ trusted: !!device, label: device?.label || null });
  } catch (error) {
    console.error('Error checking device status:', error);
    return NextResponse.json({ trusted: false });
  }
}
