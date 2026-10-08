import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
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
// הפעלה: מתכנת בלבד (כמו db-mode). כיבוי: מותר לכל מי שנמצא על המחשב - מחיקת העוגייה לא מסכנת כלום.
// GET גלוי לכולם ומחזיר רק מצב (גם הבאנר ודף ההגדרות משתמשים בו).

export const dynamic = 'force-dynamic';

function state() {
  return {
    device: isDeviceBackupRequest() ? 'backup' : 'real', // מה שהמחשב הזה קיבל לפי העוגייה
    effective: getEffectiveDbMode() === 'test' ? 'backup' : 'real', // המסד שהבקשה הזו באמת פנתה אליו (כולל המתג הגלובלי)
    available: !!process.env.TEST_DATABASE_URL,
  };
}

export async function GET() {
  return NextResponse.json(state(), { headers: { 'Cache-Control': 'no-store' } });
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

  // 'מתכנת' = DEVELOPER_ONLY_ROLES ([2]) ב-lib/auth.js. נבדק מול המסד שהבקשה הנוכחית פונה אליו.
  if (!(await checkAuth('מתכנת'))) {
    return NextResponse.json({ error: 'Unauthorized. Developer access required.' }, { status: 401 });
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
