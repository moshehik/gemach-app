import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth, invalidateRequireLoginCache, HEAD_MANAGEMENT_ROLES, getSessionEmployee } from '@/lib/auth';
import { invalidateSettingsCache, getCachedSettingsList } from '@/lib/settingsCache';
import { validateNumericSetting, validateSelectSetting } from '../../lib/settingsValidation';
import { verifySecret } from '@/lib/passwordAuth';
import { encryptSecret } from '@/lib/secretCrypto';
import { SECRET_SETTING_KEYS, SECRET_MASK, secretWriteAction } from '../../lib/secretSettingKeys';
import { NON_WORKING_DAYS_SETTING_KEY, NON_WORKING_DAYS_PERMISSION_KEY, isNonWorkingDaysOnlySettingsBatch, validateNonWorkingDaysSettingValue, pastClosedDayChanges, stripNonWorkingDaysNotes, hebrewDateOfKey } from '@/lib/businessDays';
import { getIsraelTodayKey } from '@/lib/hebrewDate';
import { hasPermission } from '@/lib/permissions';
import { SETTINGS_HEBREW_NAMES } from '@/lib/settingsMetadata';

export const dynamic = 'force-dynamic';

// GET is intentionally left public: settings (e.g. UI/branding config) are
// read by pages that render before/without login, such as the public
// customer-interface kiosk page and the labels fetched on initial layout
// mount. Writing settings is admin-only (see POST below).
//
// CPU 5.10.2026: the rows come from a 30s per-instance server cache (lib/settingsCache.js getCachedSettingsList - the SAME
// findMany: BRAND_LOGO / backup_requested_at excluded, category asc + id asc) instead of a full findMany + 66KB serialize on every
// call. It is dropped by invalidateSettingsCache() right after every write here (POST) and in the other settings writers; other warm
// instances converge within 30s. `?fresh=1` bypasses it (settings-editing screens that must show exactly what was just saved).
// Everything user-dependent below (secret masking, non_working_days_extra notes) is applied per request on top of the cached rows.
export async function GET(request) {
  try {
    let fresh = false;
    try { fresh = !!request && new URL(request.url).searchParams.get('fresh') === '1'; } catch { /* no url (direct call) */ }
    const settings = await getCachedSettingsList({ fresh });
    let masked = settings.map(s =>
      SECRET_SETTING_KEYS.includes(s.key) ? { ...s, value: s.value ? SECRET_MASK : '' } : s
    );
    // ההערות החופשיות של ימי אי-הפעילות (non_working_days_extra) יכולות להכיל פרטים פנימיים, וה-GET הזה ציבורי (דפי הדפסה/הזמנה/החזרות
    // צריכים רק את הימים). בלי session תקף מסירים את שדה ה-note מהערך; הדף עצמו (/non-working-days) קורא את הערך המלא מ-/api/non-working-days.
    const nwd = masked.find(s => s.key === NON_WORKING_DAYS_SETTING_KEY);
    if (nwd && typeof nwd.value === 'string' && nwd.value.includes('"note"') && !(await checkAuth())) {
      masked = masked.map(s => (s === nwd ? { ...s, value: stripNonWorkingDaysNotes(s.value) } : s));
    }
    return NextResponse.json(masked);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Legacy shape: a plain array, saved only when checkAuth('הנהלה ראשית') sees a real
    // logged-in session cookie for roleId 0 (הנהלה ראשית) or 2 (מתכנת) - matches the
    // /admin page-level gate (HEAD_MANAGEMENT_ROLES, see app/admin/layout.js). A branch
    // manager (roleId 1) can't reach /admin/settings in the UI at all, so this endpoint
    // must not accept their role either - previously it used checkAuth('מנהל') (roleId
    // 1 or 2), which let a branch manager write settings via a direct API call even
    // though the page itself was already closed to them. When require_login is off (the
    // very setting an admin may be trying to turn ON from a fresh/anonymous browser),
    // there is no session cookie to check - so the client falls back to the same one-time
    // employeeId+pin confirmation pattern used elsewhere in the app (e.g. the debt-
    // approval flow in app/orders/[id]/page.js) instead of the cookie-only checkAuth.
    const isWrapped = !Array.isArray(body) && body && Array.isArray(body.items);
    const data = isWrapped ? body.items : body;

    let authorized = await checkAuth('הנהלה ראשית');
    if (!authorized && isWrapped && body.employeeId && body.pin) {
      const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } });
      authorized = !!(
        employee &&
        employee.isActive &&
        HEAD_MANAGEMENT_ROLES.includes(employee.roleId) &&
        (await verifySecret(body.pin, employee.password))
      );
    }
    // ימים ללא פעילות (lib/businessDays.js, החלטת הבעלים 1.10.2026 NWD-Q08): מנת שמירה שכולה המפתח
    // non_working_days_extra מותרת גם למי שאינו הנהלה ראשית כשיש לו את ההרשאה
    // feature:non_working_days_manage (קטלוג ההרשאות - ברירת מחדל סגורה, נפתחת בשורת הרשאה).
    // רק המפתח הזה: כל מפתח אחר במנה מחזיר את המסלול להנהלה ראשית בלבד. השם של השורה נקבע
    // מהקטלוג (לא מהלקוח) במסלול הזה.
    let viaNonWorkingDaysPermission = false;
    if (!authorized && isNonWorkingDaysOnlySettingsBatch(data)) {
      const employee = await getSessionEmployee();
      if (employee && (await hasPermission(employee, NON_WORKING_DAYS_PERMISSION_KEY))) {
        authorized = true;
        viaNonWorkingDaysPermission = true;
      }
    }
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format, expected array' }, { status: 400 });
    }

    for (const item of data) {
      if (!item.key) continue;
      if (viaNonWorkingDaysPermission) item.name = SETTINGS_HEBREW_NAMES[item.key] || item.key;
      const validationError = validateNumericSetting(item.key, item.value) || validateSelectSetting(item.key, item.value)
        || (item.key === NON_WORKING_DAYS_SETTING_KEY ? validateNonWorkingDaysSettingValue(item.value === undefined ? undefined : String(item.value)) : null);
      if (validationError) {
        return NextResponse.json({ error: `${item.key}: ${validationError}` }, { status: 400 });
      }
      // נעילת ימים שעברו גם בשרת (הבעלים NWD-Q05; עד עכשיו נאכף רק ב-UI): אסור להוסיף או להסיר יום (בודד או מתוך טווח) שקדם להיום הישראלי.
      // תאריכים עבריים קבועים נשארים מותרים. נבדק מול הערך השמור, גם להנהלה ראשית.
      if (item.key === NON_WORKING_DAYS_SETTING_KEY && item.value !== undefined) {
        const stored = await prisma.systemSetting.findUnique({ where: { key: NON_WORKING_DAYS_SETTING_KEY } });
        const locked = pastClosedDayChanges(stored ? stored.value : null, String(item.value), getIsraelTodayKey());
        if (locked.length) {
          const labels = locked.slice(0, 3).map((k) => (hebrewDateOfKey(k) || { label: k }).label).join(', ') + (locked.length > 3 ? ` ועוד ${locked.length - 3}` : '');
          return NextResponse.json({ error: `${item.key}: אי אפשר להוסיף או להסיר ימי אי-פעילות שכבר עברו (${labels}).` }, { status: 400 });
        }
      }
    }

    // The masked placeholder coming back unchanged means "admin didn't touch this
    // field" - drop it from the batch entirely so the upsert below never overwrites
    // the real encrypted value with the mask string itself.
    // An EMPTY value for a secret key also means "not touched" (a password field that was only
    // focused must never blank a stored credential) - clearing needs the explicit
    // SECRET_CLEAR_MARKER (see secretWriteAction in app/lib/secretSettingKeys.js).
    const writableData = data.filter(item => secretWriteAction(item.key, item.value) !== 'skip');

    const updatePromises = writableData.map(item => {
      if (item.key && item.value !== undefined) {
        const action = secretWriteAction(item.key, item.value);
        const storedValue = action === 'clear' ? '' : action === 'write' && SECRET_SETTING_KEYS.includes(item.key)
          ? encryptSecret(item.value)
          : String(item.value);
        return prisma.systemSetting.upsert({
          where: { key: item.key },
          update: {
            value: storedValue,
            name: item.name || item.key,
          },
          create: {
            key: item.key,
            value: storedValue,
            name: item.name || item.key,
          }
        });
      }
      return Promise.resolve();
    });

    // Keep inventory_buffer_days and BUFFER_DAYS always in sync
    const bufferItem = data.find(i => i.key === 'BUFFER_DAYS' || i.key === 'inventory_buffer_days');
    if (bufferItem && bufferItem.value !== undefined) {
      updatePromises.push(
        prisma.systemSetting.upsert({
          where: { key: 'inventory_buffer_days' },
          update: { value: String(bufferItem.value) },
          create: { key: 'inventory_buffer_days', value: String(bufferItem.value), name: 'ימי מרווח ביטחון בין השכרות', category: 'יומן', type: 'number' }
        }),
        prisma.systemSetting.upsert({
          where: { key: 'BUFFER_DAYS' },
          update: { value: String(bufferItem.value) },
          create: { key: 'BUFFER_DAYS', value: String(bufferItem.value), name: 'BUFFER_DAYS', category: 'הזמנות', type: 'number' }
        })
      );
    }

    // Keep nedarim_plus_terminal and NEDARIM_MOSAD always in sync
    const nedarimMosadItem = data.find(i => i.key === 'NEDARIM_MOSAD' || i.key === 'nedarim_plus_terminal');
    if (nedarimMosadItem && nedarimMosadItem.value !== undefined) {
      updatePromises.push(
        prisma.systemSetting.upsert({
          where: { key: 'nedarim_plus_terminal' },
          update: { value: String(nedarimMosadItem.value) },
          create: { key: 'nedarim_plus_terminal', value: String(nedarimMosadItem.value), name: 'קוד מוסד נדרים פלוס', category: 'תשלומים', type: 'text' }
        }),
        prisma.systemSetting.upsert({
          where: { key: 'NEDARIM_MOSAD' },
          update: { value: String(nedarimMosadItem.value) },
          create: { key: 'NEDARIM_MOSAD', value: String(nedarimMosadItem.value), name: 'קוד מוסד נדרים פלוס', category: 'תשלומים', type: 'text' }
        })
      );
    }

    await Promise.all(updatePromises);

    // lib/auth.js caches the require_login setting in-memory (30s TTL) so
    // checkAuth() doesn't hit the DB on every request — drop that cache now
    // so a toggle takes effect immediately on this server instance (other
    // warm serverless instances converge within the TTL).
    invalidateRequireLoginCache();
    invalidateSettingsCache();

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
