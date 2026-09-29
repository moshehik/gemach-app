import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';
import { issueSessionCookie } from '@/lib/auth';
import { hashApiKey, looksLikeApiKey, extractApiKeyFromHeaders, apiKeyState } from '@/lib/apiKeys';

// כניסה עם מפתח API (מונפק ב-/admin/site-settings/api-keys) - בלי שם משתמש וסיסמה. מחליף מפתח
// תקף בעוגיות הכניסה הרגילות (auth_token + auth_session) בדיוק כמו /api/login, ולכן כל מסך/API
// אחריו רואה עובד רגיל עם ההרשאות של תפקיד המפתח. ר' lib/apiKeys.js למודל האמון.
//
//   POST  Authorization: Bearer gmk_...   (או X-API-Key, או גוף JSON {"key":"gmk_..."}) -> JSON
//         מתאים לסקריפטים/סוכנים: שומרים את העוגיות (curl -c jar) וממשיכים איתן.
//   GET   ?key=gmk_...&next=/orders       -> עוגיות + הפניה לדף. נוחות לפתיחה מדפדפן/סוכן; המפתח
//         נשאר ב-URL (היסטוריה/לוגים) - לכן עדיף מפתח קצר-מועד, ואפשר לבטל בכל רגע.
//
// שגיאה תמיד 401 גנרי - לא מגלה אם המפתח אינו קיים, בוטל או פג.

const FAIL = () => NextResponse.json({ success: false, message: 'מפתח לא תקף' }, { status: 401 });

async function loginWithKey(key) {
  if (!looksLikeApiKey(key)) return null;
  const row = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
  if (apiKeyState(row) !== 'active') return null;
  const employee = await prisma.employee.findUnique({ where: { id: row.employeeId } });
  if (!employee || !employee.isActive) return null;

  const cookieStore = await cookies();
  cookieStore.set({
    name: 'auth_token',
    value: employee.id,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  try {
    issueSessionCookie(cookieStore, employee);
  } catch (e) {
    console.warn('api-key-login: issueSessionCookie failed:', e?.message || e);
  }

  // best-effort - כניסה לא נחסמת בגלל עדכון סטטיסטיקה. SQL גולמי בכוונה: עדכון דרך Prisma היה
  // נכתב ליומן השינויים בכל כניסה (הרחבת ה-audit), ורק מוסיף רעש - הכניסה עצמה כבר נרשמת בלוג.
  prisma
    .$executeRaw`UPDATE "ApiKey" SET "lastUsedAt" = NOW(), "useCount" = "useCount" + 1 WHERE "id" = ${row.id}`
    .catch((e) => console.error('Failed to update API key usage:', e));
  console.log(`[api-key-login] key "${row.name}" (${row.id}) logged in as employee ${employee.id} at ${new Date().toISOString()}`);

  return { employee, row };
}

export async function POST(request) {
  try {
    let key = extractApiKeyFromHeaders(request.headers);
    if (!key) {
      const body = await request.json().catch(() => ({}));
      key = typeof body.key === 'string' ? body.key.trim() : null;
    }
    const result = await loginWithKey(key);
    if (!result) return FAIL();
    return NextResponse.json({
      success: true,
      employeeId: result.employee.id,
      roleId: result.employee.roleId,
      name: result.row.name,
    });
  } catch (error) {
    console.error('api-key-login error:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = (searchParams.get('key') || extractApiKeyFromHeaders(request.headers) || '').trim();
    const result = await loginWithKey(key);
    if (!result) return FAIL();
    // רק נתיב פנימי - לעולם לא הפניה לדומיין חיצוני (open redirect)
    const next = searchParams.get('next') || '/';
    const safeNext = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
    return NextResponse.redirect(new URL(safeNext, request.url));
  } catch (error) {
    console.error('api-key-login error:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
