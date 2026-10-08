import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/auth';
import { canEnableDeviceBackup } from '@/lib/deviceBackupAccess';
import { getEffectiveDbMode } from '@/app/lib/prisma';
import { isDeviceBackupRequest } from '@/lib/dbMode';
import {
  DEVICE_DB_VIEW_COOKIE,
  DEVICE_DB_VIEW_MAX_AGE_SECONDS,
  createDeviceDbViewToken,
} from '@/lib/deviceDbView';

// "מצב גיבוי במחשב הזה בלבד": שלא כמו /api/admin/db-mode (שמחליף את מסד האתר לכל המשתמשים), כאן נקבעת עוגייה חתומה
// בדפדפן של מי שהפעיל - רק הבקשות ממנו ניגשות למסד הגיבוי (TEST_DATABASE_URL), וכל שאר המחשבים ממשיכים לראות את
// האמיתי. ר' lib/deviceDbView.js ו-app/lib/prisma.js (readDeviceBackupFlag).
// הפעלה: מתכנת, או עובד שהמתכנת אישר ברשימה (lib/deviceBackupAccess.js). כיבוי: מותר לכל מי שנמצא על המחשב - מחיקת העוגייה
// לא מסכנת כלום. GET מחזיר מצב + canEnable (האם המשתמש הנוכחי רשאי להפעיל) + isProgrammer (להצגת עורך הרשימה).

export const dynamic = 'force-dynamic';

async function state() {
  const me = await getSessionEmployee();
  return {
    canEnable: await canEnableDeviceBackup(me),
    isProgrammer: !!me && me.roleId === 2,
    device: isDeviceBackupRequest() ? 'backup' : 'real', // מה שהמחשב הזה קיבל לפי העוגייה
    effective: getEffectiveDbMode() === 'test' ? 'backup' : 'real', // המסד שהבקשה הזו באמת פנתה אליו (כולל המתג הגלובלי)
    available: !!process.env.TEST_DATABASE_URL,
  };
}

export async function GET() {
  return NextResponse.json(await state(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch { /* גוף ריק = בקשה לא תקינה, למטה */ }
  const mode = body && body.mode;
  if (mode !== 'backup' && mode !== 'real') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  const res = NextResponse.json({ success: true, mode });
  res.headers.set('Cache-Control', 'no-store');

  if (mode === 'real') {
    res.cookies.set(DEVICE_DB_VIEW_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }

  // נבדק מול המסד שהבקשה הנוכחית פונה אליו (בהפעלה זה האמיתי, כי העוגייה עוד לא קיימת).
  if (!(await canEnableDeviceBackup(await getSessionEmployee()))) {
    return NextResponse.json({ error: 'אין לך הרשאה להפעיל מצב גיבוי במחשב הזה. פנה למתכנת.' }, { status: 401 });
  }
  if (!process.env.TEST_DATABASE_URL) {
    return NextResponse.json({ error: 'TEST_DATABASE_URL אינו מוגדר בסביבה הזו' }, { status: 400 });
  }
  const token = createDeviceDbViewToken();
  if (!token) {
    return NextResponse.json({ error: 'AUTH_SECRET אינו מוגדר - אי אפשר לחתום את העוגייה' }, { status: 500 });
  }
  res.cookies.set(DEVICE_DB_VIEW_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DEVICE_DB_VIEW_MAX_AGE_SECONDS,
  });
  return res;
}
