import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifySecret, isBcryptHash, hashSecret, last4Of } from '@/lib/passwordAuth';
import { getTrustedDeviceFromCookieStore, markDeviceUsed } from '@/lib/trustedDevice';
import { issueSessionCookie } from '@/lib/auth';
import { SESSION_MAX_AGE_SECONDS } from '@/lib/authTokens';
import { recordLoginOnDevice } from '@/lib/loginDeviceRegistry';
import { getAutoClockIn, setAutoClockIn } from '@/lib/autoClockPref';
import { findOpenShift, punchIn } from '@/lib/shiftPunch';
import { decideAutoShift, SHIFT_ACTION, formatIsraelHHMM, previousShiftPrompt } from '@/lib/loginFlow';

// גוף הבקשה (דף הכניסה החדש, app/components/login/LoginNew.js; המסך הישן שולח רק employeeId + password/pin):
//   employeeId, password | pin        - כמו תמיד. pin רק ממחשב מערכת מהימן (lib/trustedDevice.js).
//   loginPage (true)                  - סימון מפורש של דף הכניסה החדש. בלעדיו (המסך הישן, שחרור הקיוסק ב-
//                                       app/customer-interface/page.js) המסלול מתנהג בדיוק כמו קודם: בלי רישום
//                                       מכשיר, בלי משמרת אוטומטית, בלי "זכור אותי", עוגיות session בלבד.
//   rememberMe (bool)                 - "זכור אותי במכשיר הזה" (L09): עוגיות ההתחברות נשמרות שבוע גם אחרי
//                                       סגירת הדפדפן. מתעלמים ממנו במחשב משותף (יותר מ-3 עובדים שונים,
//                                       lib/loginDeviceRegistry.js) - השרת מכריע, לא הלקוח.
//   autoClockIn (bool, אופציונלי)     - העובד שינה את המתג "רשום לי התחלת עבודה אוטומטית" בכניסה הזאת:
//                                       נשמר בהעדפות שלו (Q01). לא נשלח = ההעדפה השמורה בשרת קובעת (Q04).
// התשובה: success, mustResetPassword, shared, rememberMe (מה שכובד בפועל), autoClockIn (ההעדפה בתוקף),
// employee {id, firstName}, shift { action, punchedInAt?, previous? } לפי טבלת ההחלטות ב-lib/loginFlow.js.
export async function POST(request) {
  try {
    const body = await request.json();
    const { employeeId, password, pin } = body || {};

    if (!employeeId || (!password && !pin)) {
      return NextResponse.json({ success: false, message: 'נא להזין קוד עובד וסיסמה' }, { status: 400 });
    }

    const parsedLegacyId = /^\d+$/.test(String(employeeId)) ? parseInt(employeeId, 10) : NaN; // digits only: a UUID that merely STARTS with digits must not match some other employee's legacyId
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          ...(isNaN(parsedLegacyId) ? [] : [{ legacyId: parsedLegacyId }]),
          { id: employeeId }
        ]
      }
    });

    if (!employee) {
      return NextResponse.json({ success: false, message: 'עובד לא נמצא' }, { status: 404 });
    }

    if (!employee.isActive) {
      return NextResponse.json({ success: false, message: 'חשבון העובד אינו פעיל' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const isNewLoginPage = body.loginPage === true;
    // Trusted-device lookup: needed for the PIN path (as before) and, on the new page, for the rollout rule
    // "a trusted work computer is treated as shared" (no remember-me) - one lookup either way.
    const trustedDevice = (pin || isNewLoginPage) ? await getTrustedDeviceFromCookieStore(cookieStore) : null;

    if (pin) {
      // Fast path: only ever valid on a computer a manager has explicitly marked trusted.
      // The trust check happens first and is independent of anything the client claims -
      // a request that merely *says* "this is a trusted device" without holding the actual
      // cookie is rejected before the PIN is even looked at.
      if (!trustedDevice) {
        return NextResponse.json({ success: false, message: 'מחשב זה אינו מוגדר כמערכת מהימנה - יש להזין את הסיסמה המלאה', requireFullPassword: true }, { status: 401 });
      }
      if (!employee.pinHash) {
        return NextResponse.json({ success: false, message: 'לעובד זה טרם הוגדר קוד כניסה מקוצר. יש להזין את הסיסמה המלאה', requireFullPassword: true }, { status: 401 });
      }
      const pinOk = await verifySecret(pin, employee.pinHash);
      if (!pinOk) {
        return NextResponse.json({ success: false, message: 'קוד שגוי' }, { status: 401 });
      }
      markDeviceUsed(trustedDevice.id);
    } else {
      if (!employee.password) {
        return NextResponse.json({ success: false, message: 'לעובד זה טרם הוגדרה סיסמה במערכת. אנא פנה למנהל.' }, { status: 401 });
      }
      // Many employees imported from the legacy Access system still carry their original
      // short numeric code as PLAINTEXT in this column (never hashed - only pinHash, derived
      // from it at import time, is a real bcrypt hash for them). bcrypt.compare against a
      // non-bcrypt string always returns false, so the normal path alone would permanently
      // lock these accounts out of full-password login. Fall back to an exact-match check
      // against the legacy plaintext, and migrate it to a real hash right here on success -
      // every login organically pays down the migration debt instead of needing a bulk pass.
      let passwordOk = await verifySecret(password, employee.password);
      if (!passwordOk && !isBcryptHash(employee.password) && password === employee.password) {
        passwordOk = true;
        try {
          await prisma.employee.update({
            where: { id: employee.id },
            data: {
              password: await hashSecret(password),
              pinHash: await hashSecret(last4Of(password)),
            },
          });
        } catch (e) {
          console.warn('Failed to migrate legacy plaintext password on login:', e?.message || e);
        }
      }
      if (!passwordOk) {
        return NextResponse.json({ success: false, message: 'סיסמא שגויה' }, { status: 401 });
      }
    }

    // --- מחשב משותף (L09/L17): רישום העובד למחשב הזה, והכרעה אם "זכור אותי" מכובד. רק מדף הכניסה החדש. ---
    // כלל פריסה שמרני (לאישור הבעלים): מחשב מערכת מהימן (עמדות העבודה) נחשב משותף מההתחלה - "זכור אותי"
    // לא מוצע ולא מכובד בו; ברירת המחדל "מסומן" של העיצוב נשארת רק למחשב פרטי לא-מהימן.
    const device = isNewLoginPage ? await recordLoginOnDevice(cookieStore, employee.id) : { shared: false };
    const shared = !!device.shared || !!trustedDevice;
    const rememberMe = isNewLoginPage && body.rememberMe === true && !shared;

    // Set cookie — a session cookie (no maxAge) on purpose: closing the browser
    // entirely should require logging in again (2026-08-24, per user-role bug
    // report 91c1fe06 — reopening the app after a full browser close silently
    // resumed the previous employee). Still persists across reloads/new tabs
    // within the same browser session, same as before.
    // חריג (החלטת הבעלים 1.10.2026, דף הכניסה החדש): "זכור אותי במכשיר הזה" - רק כשהעובד ביקש וגם
    // המחשב אינו משותף - העוגייה נשמרת SESSION_MAX_AGE_SECONDS (שבוע), כמו תוקף הטוקן החתום.
    cookieStore.set({
      name: 'auth_token',
      value: employee.id, // Ensure we store the UUID string
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      ...(rememberMe ? { maxAge: SESSION_MAX_AGE_SECONDS } : {}),
    });

    // Signed session cookie (auth_session) — DB-free role verification fast
    // path for checkAuth/checkPageAccess/RootLayout. Best-effort: if
    // AUTH_SECRET isn't configured (or signing fails) the login still
    // succeeds and everything falls back to the legacy auth_token-only path.
    try {
      issueSessionCookie(cookieStore, employee, rememberMe ? { maxAge: SESSION_MAX_AGE_SECONDS, remember: true } : {});
    } catch (e) {
      console.warn('issueSessionCookie failed (continuing with legacy auth only):', e?.message || e);
    }

    // --- רישום התחלת עבודה אוטומטי (L14, Q01-Q04, Q09) ---
    let autoClockIn = getAutoClockIn(employee);
    if (isNewLoginPage && typeof body.autoClockIn === 'boolean' && body.autoClockIn !== autoClockIn) {
      try {
        autoClockIn = await setAutoClockIn(employee, body.autoClockIn);
      } catch (e) {
        console.warn('Failed to save auto-clock-in preference on login:', e?.message || e);
      }
    }

    const now = new Date();
    let shift = { action: SHIFT_ACTION.NONE };
    try {
      if (!isNewLoginPage) throw Object.assign(new Error('skip'), { skip: true });
      const openShift = await findOpenShift(employee.id);
      const decision = decideAutoShift({ autoClockIn, openShift, now });
      if (decision.action === SHIFT_ACTION.PUNCH_IN) {
        const created = await punchIn(employee, now);
        shift = { action: SHIFT_ACTION.PUNCH_IN, punchedInAt: created.entryTime, punchedInHHMM: formatIsraelHHMM(created.entryTime) };
      } else if (decision.action === SHIFT_ACTION.ASK_PREVIOUS) {
        shift = {
          action: SHIFT_ACTION.ASK_PREVIOUS,
          previous: {
            id: openShift.id,
            entryTime: openShift.entryTime,
            startedHHMM: formatIsraelHHMM(openShift.entryTime),
            prompt: previousShiftPrompt(openShift, now),
          },
        };
      } else {
        shift = { action: decision.action };
      }
    } catch (e) {
      // רישום המשמרת לעולם לא מפיל כניסה - הכניסה כבר הצליחה. (המסך הישן / הקיוסק: בלי משמרת, בלי שגיאה.)
      if (!e?.skip) {
        console.warn('Auto clock-in on login failed:', e?.message || e);
        shift = { action: SHIFT_ACTION.NONE, error: true };
      }
    }

    return NextResponse.json({
      success: true,
      mustResetPassword: !!employee.mustResetPassword,
      shared,
      rememberMe,
      autoClockIn,
      employee: { id: employee.id, firstName: employee.firstName || '' },
      shift,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
