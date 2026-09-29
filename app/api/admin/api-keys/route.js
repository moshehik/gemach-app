import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth, getSessionEmployee, canManageRoles } from '@/lib/auth';
import {
  API_KEY_ROLES,
  API_KEY_EXPIRY_OPTIONS_DAYS,
  SERVICE_EMPLOYEE_LEGACY_ID_MIN,
  SERVICE_EMPLOYEE_LEGACY_ID_MAX,
  generateApiKey,
  hashApiKey,
  apiKeyPreview,
  apiKeyState,
} from '@/lib/apiKeys';

// ניהול מפתחות API - מתכנת בלבד (roleId 2). מפתח = כניסה בלי סיסמה, אז זו הרשאה חזקה מכל כניסה
// רגילה: תמיד מאומתת מול ה-DB (forceDb), ולא נפתחת גם להנהלה ראשית. ר' lib/apiKeys.js.
const DENIED = () => NextResponse.json({ success: false, message: 'פעולה זו מוגבלת למתכנת בלבד' }, { status: 401 });

export async function GET() {
  if (!(await checkAuth('מתכנת', { forceDb: true }))) return DENIED();
  try {
    const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
    const creatorIds = [...new Set(keys.map((k) => k.createdById).filter(Boolean))];
    const creators = creatorIds.length
      ? await prisma.employee.findMany({ where: { id: { in: creatorIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const creatorNameById = Object.fromEntries(creators.map((c) => [c.id, `${c.firstName || ''} ${c.lastName || ''}`.trim()]));

    const now = new Date();
    return NextResponse.json({
      success: true,
      roles: API_KEY_ROLES,
      expiryOptionsDays: API_KEY_EXPIRY_OPTIONS_DAYS,
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPreview: k.keyPreview,
        roleId: k.roleId,
        createdAt: k.createdAt,
        createdByName: k.createdById ? creatorNameById[k.createdById] || null : null,
        expiresAt: k.expiresAt,
        lastUsedAt: k.lastUsedAt,
        useCount: k.useCount,
        revokedAt: k.revokedAt,
        state: apiKeyState(k, now),
      })),
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}

// הנפקת מפתח חדש. המפתח המלא חוזר בתשובה הזו בלבד - לא נשמר ואי אפשר לשחזר אותו.
export async function POST(request) {
  if (!(await checkAuth('מתכנת', { forceDb: true }))) return DENIED();
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim().slice(0, 80);
    if (!name) {
      return NextResponse.json({ success: false, message: 'נא לתת למפתח שם (למשל "בדיקות Claude")' }, { status: 400 });
    }
    const roleId = Number(body.roleId);
    if (!API_KEY_ROLES.some((r) => r.roleId === roleId)) {
      return NextResponse.json({ success: false, message: 'תפקיד לא חוקי' }, { status: 400 });
    }
    const actor = await getSessionEmployee();
    if (!actor || !canManageRoles(actor.roleId, roleId)) {
      return NextResponse.json({ success: false, message: 'אי אפשר להנפיק מפתח בהרשאה גבוהה משלך' }, { status: 403 });
    }
    let expiresAt = null;
    if (body.expiresInDays !== null && body.expiresInDays !== undefined && body.expiresInDays !== '') {
      const days = Number(body.expiresInDays);
      if (!API_KEY_EXPIRY_OPTIONS_DAYS.includes(days)) {
        return NextResponse.json({ success: false, message: 'תוקף לא חוקי' }, { status: 400 });
      }
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    // legacyId הבא הפנוי בטווח עובדי השירות (ה-unique של העמודה מגן מפני מרוץ; ננסה שוב פעם אחת).
    const key = generateApiKey();
    let created = null;
    for (let attempt = 0; attempt < 2 && !created; attempt++) {
      const top = await prisma.employee.aggregate({
        _max: { legacyId: true },
        where: { legacyId: { gte: SERVICE_EMPLOYEE_LEGACY_ID_MIN, lt: SERVICE_EMPLOYEE_LEGACY_ID_MAX } },
      });
      const legacyId = (top._max.legacyId ?? SERVICE_EMPLOYEE_LEGACY_ID_MIN - 1) + 1;
      if (legacyId >= SERVICE_EMPLOYEE_LEGACY_ID_MAX) {
        return NextResponse.json({ success: false, message: 'נגמר מקום למפתחות - יש לנקות מפתחות ישנים' }, { status: 409 });
      }
      try {
        const employee = await prisma.employee.create({
          data: {
            legacyId,
            firstName: 'מפתח API',
            lastName: name,
            roleId,
            isActive: true,
            notes: 'עובד שירות שנוצר אוטומטית עבור מפתח API (/admin/site-settings/api-keys). אין לו סיסמה - נכנסים אליו רק דרך המפתח. מתבטל יחד עם המפתח.',
          },
        });
        created = await prisma.apiKey.create({
          data: {
            name,
            keyHash: hashApiKey(key),
            keyPreview: apiKeyPreview(key),
            employeeId: employee.id,
            roleId,
            createdById: actor.id,
            expiresAt,
          },
        });
      } catch (e) {
        if (attempt === 1 || e?.code !== 'P2002') throw e;
      }
    }

    return NextResponse.json({
      success: true,
      key, // מוצג פעם אחת בלבד
      apiKey: { id: created.id, name: created.name, keyPreview: created.keyPreview, expiresAt: created.expiresAt },
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}

// ביטול מפתח: ביטול רך (נשמר בהיסטוריה) + כיבוי עובד השירות שלו ואיפוס התפקיד שלו. כניסה חדשה
// נחסמת מיד; עוגיה שכבר הונפקה מאבדת כל גישה מוגבלת-תפקיד (מנהל/מתכנת/הנהלה) תוך עד 15 דקות
// (חלון הטריות של auth_session), כי בדיקת התפקיד נופלת ל-DB ורואה roleId ריק. מסכים שדורשים
// רק "מחובר" (בלי תפקיד) נשארים פתוחים לעוגיה הזו עד שהיא פגה (עד 7 ימים) - אותה מגבלה קיימת
// גם בכיבוי עובד רגיל, ולכן עדיף מפתח קצר-מועד.
export async function DELETE(request) {
  if (!(await checkAuth('מתכנת', { forceDb: true }))) return DENIED();
  try {
    const body = await request.json().catch(() => ({}));
    if (!body.id) {
      return NextResponse.json({ success: false, message: 'חסר מזהה מפתח' }, { status: 400 });
    }
    const row = await prisma.apiKey.findUnique({ where: { id: String(body.id) } });
    if (!row) {
      return NextResponse.json({ success: false, message: 'המפתח לא נמצא' }, { status: 404 });
    }
    if (!row.revokedAt) {
      await prisma.apiKey.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    }
    await prisma.employee.updateMany({ where: { id: row.employeeId }, data: { isActive: false, roleId: null } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
