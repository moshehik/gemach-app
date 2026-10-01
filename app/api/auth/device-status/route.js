import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTrustedDeviceFromCookieStore } from '@/lib/trustedDevice';
import { getDeviceSharedStatus } from '@/lib/loginDeviceRegistry';

// Public, unauthenticated (used by the login screen before anyone is logged in) - only
// ever reveals booleans, never anything about which employees exist or their data.
//   trusted - מחשב מערכת מהימן (קוד מקוצר של 4 תווים מותר), ר' lib/trustedDevice.js
//   shared  - מחשב משותף (יותר מ-3 עובדים שונים נכנסו ממנו): "זכור אותי" לא מוצע, ר' lib/loginDeviceRegistry.js
export async function GET() {
  try {
    const cookieStore = await cookies();
    const [device, sharedStatus] = await Promise.all([
      getTrustedDeviceFromCookieStore(cookieStore),
      getDeviceSharedStatus(cookieStore),
    ]);
    return NextResponse.json({ trusted: !!device, label: device?.label || null, shared: !!sharedStatus.shared });
  } catch (error) {
    console.error('Error checking device status:', error);
    return NextResponse.json({ trusted: false, shared: false });
  }
}
