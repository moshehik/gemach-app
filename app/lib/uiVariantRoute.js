import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { applyUiVariantRequest, describeSelfSwitch } from '@/lib/uiVariantSelfSwitch';
import { syncDesignPrefsCookie } from './designPrefsCookie';

// הדבק של ה-routes של /api/me/ui-variant/* (shell, home) ושל GET /api/me/ui-variant: זיהוי העובד, קריאת הגוף,
// קריאה לליבה הטהורה (lib/uiVariantSelfSwitch.js — שם כל כללי ההרשאה והבדיקות) ורענון עוגיית designPrefs_<id> (חתומה ב-HMAC,
// lib/designPrefsSig.js, GQ-01b — רק השרת כותב אותה).
//
// מזוהה אך ורק לפי העוגייה החתומה (כמו design-prefs) — אין פרמטר id, עובד לא יכול לשנות לעובד אחר. התפקיד
// (Employee.roleId) נקרא מה-DB, לא מהגוף / מהעוגייה. הכתיבה היא prisma.employee.update רגיל → הרחבת ה-AuditLog
// ב-app/lib/prisma.js רושמת אותה (UPDATE Employee); אין רישום ידני.

async function getSessionEmployee() {
  const cookieStore = await cookies();
  const token = getVerifiedAuthCookie(cookieStore);
  if (!token || !token.value) return null;

  const parsedLegacy = /^\d+$/.test(String(token.value)) ? parseInt(token.value, 10) : NaN; // digits only (see design-prefs/route.js)
  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { id: token.value },
        ...(isNaN(parsedLegacy) ? [] : [{ legacyId: parsedLegacy }])
      ]
    },
    select: { id: true, themeColor: true, isActive: true, roleId: true }
  });
  return employee ? { employee, cookieKey: token.value, cookieStore } : null;
}

/** POST /api/me/ui-variant/<screen> */
export async function handleUiVariantPost(request, screen) {
  try {
    const session = await getSessionEmployee();

    let body = null;
    let bodyParseFailed = false;
    if (session) {
      try {
        body = await request.json();
      } catch (e) {
        bodyParseFailed = true;
      }
    }

    const result = await applyUiVariantRequest({
      screen,
      body,
      bodyParseFailed,
      employee: session ? session.employee : null,
      prisma,
    });

    const res = NextResponse.json(result.json, { status: result.status });
    if (result.status === 200 && result.nextPrefs && session) {
      // המפתח של העוגייה הוא ערך ה-auth_token המאומת (כך ה-layout קורא אותה: designPrefs_${authToken.value}). התוכן תמיד
      // מה-DB (result.nextPrefs = מה שנכתב עכשיו), לא ממה שהיה בעוגייה. כשל בכתיבה לא מפיל את הבקשה: בלי רענון שלה
      // DesignPrefsSync ירענן אותה בטעינה הבאה.
      syncDesignPrefsCookie(res, session.cookieStore, session.cookieKey, result.nextPrefs);
    }
    return res;
  } catch (error) {
    console.error(`Error updating ${screen} ui-variant override:`, error);
    return NextResponse.json({ success: false, error: 'שגיאת שרת' }, { status: 500 });
  }
}

/** GET /api/me/ui-variant — האם העובד המחובר רשאי לעבור בעצמו (להצגת הסעיף בדף "עיצוב ותצוגה"). */
export async function handleUiVariantGet() {
  try {
    const session = await getSessionEmployee();
    if (!session) return NextResponse.json({ success: false, error: 'לא מחובר/ת' }, { status: 401 });
    if (!session.employee.isActive) return NextResponse.json({ success: false, error: 'העובד/ת אינו פעיל/ה' }, { status: 403 });
    return NextResponse.json({ success: true, ...describeSelfSwitch(session.employee) });
  } catch (error) {
    console.error('Error reading ui-variant self-switch capability:', error);
    return NextResponse.json({ success: false, error: 'שגיאת שרת' }, { status: 500 });
  }
}
