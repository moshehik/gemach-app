// lib/uiVariantSelfSwitch.js — "מעבר עצמאי בין העיצוב הישן לחדש" (2026-10-01).
//
// ההחלטה (הבעלים, 1.10.2026): הנהלה ראשית ומתכנת יכולים להחליף בעצמם, לעצמם בלבד, את התפריט העליון
// (`shell`) ואת דף הבית (`home`) בין 'legacy' ל-'a5' — בלי להריץ סקריפט. זה מחליף (להנהלה בלבד) את
// החלטה GQ-08 ("רק הבעלים מחזיר לחדש"). לכל השאר ההתנהגות נשארת כמו קודם: רק legacy / null בתפריט,
// ואין שום דרך להדליק a5.
//
// ESM טהור בלי Next/prisma (לקוח prisma מוזרק), כדי לבדוק עם node רגיל — scripts/test_ui_variant_self_switch.mjs.
//
// עקרונות אבטחה:
//   * התפקיד נקבע בשרת מהעובד המאומת (Employee.roleId ב-DB) — לעולם לא מגוף הבקשה / העוגייה.
//   * העובד המטרה הוא תמיד העובד המאומת עצמו; גוף הבקשה לא יכול להכיל מזהה עובד (שדות זרים נתעלמים).
//   * רק המסכים shell ו-home. order_card / customer_card נדחים.
//   * הכתיבה דרך buildUiVariantOverride → mergeDesignPrefs → Employee.themeColor.uiVariants. אין כתיבת AuditLog
//     ידנית (ההרחבה של Prisma ב-app/lib/prisma.js רושמת כל כתיבה), ואין קריאות בתוך $transaction.
//   * הערה (GQ-01): ה-layout עדיין סומך על עוגיית designPrefs_<id> שהמשתמש יכול לערוך בדפדפן; הפיצ'ר הזה לא
//     מחמיר את זה — הוא רק מונע דרך API לא-הנהלה להדליק a5.

import { buildUiVariantOverride } from './designPrefsSchema.js';

export const SELF_SWITCH_SCREENS = Object.freeze(['shell', 'home']);

// אותו כלל כמו app/layout.js: roleId 0 = הנהלה ראשית, 2 = מתכנת (isHeadManagement), 1 = מנהל סניף (לא נכלל).
export function isManagementRole(roleId) {
  return roleId === 0 || roleId === 2;
}

export function isSelfSwitchScreen(screen) {
  return typeof screen === 'string' && SELF_SWITCH_SCREENS.includes(screen);
}

export const MAX_THEME_COLOR_LENGTH = 8192; // כמו PUT /api/me/design-prefs

const MSG = {
  unauthorized: 'לא מחובר/ת',
  inactive: 'העובד/ת אינו פעיל/ה',
  badJson: 'גוף הבקשה אינו JSON תקין',
  missingValue: "חסר השדה value (מותר 'legacy', null, ולהנהלה גם 'a5')",
  unknownScreen: 'המעבר העצמאי זמין רק לתפריט העליון (shell) ולדף הבית (home)',
  a5Forbidden: 'המעבר לעיצוב החדש זמין להנהלה בלבד. לשינוי פנו לבעלים.',
  homeForbidden: 'המעבר העצמאי של דף הבית זמין להנהלה בלבד.',
  tooLarge: 'ההעדפות גדולות מדי',
};

/**
 * מחזיר מה העובד רשאי לעשות — לשימוש GET /api/me/ui-variant (הצגת הסעיף בדף "עיצוב ותצוגה").
 * @param {{ roleId?: number|null, themeColor?: string|null }|null} employee
 */
export function describeSelfSwitch(employee) {
  const canSelfSwitch = !!employee && isManagementRole(employee.roleId);
  return { canSelfSwitch, screens: canSelfSwitch ? [...SELF_SWITCH_SCREENS] : [] };
}

/**
 * הליבה של POST /api/me/ui-variant/<screen>. לא נוגעת ב-Next; prisma מוזרק.
 *
 * @param {{
 *   screen: string,
 *   body: any,                    // כבר פוענח מ-JSON (או null אם הפענוח נכשל — ר' bodyParseFailed)
 *   bodyParseFailed?: boolean,
 *   employee: { id: string, roleId?: number|null, themeColor?: string|null, isActive?: boolean }|null, // העובד המאומת (מה-DB)
 *   prisma: { employee: { update: Function } },
 * }} args
 * @returns {Promise<{ status: number, json: object, nextPrefs?: object }>}
 *   nextPrefs מוחזר רק בהצלחה — כדי שה-route ירענן את עוגיית designPrefs_<id>.
 */
export async function applyUiVariantRequest({ screen, body, bodyParseFailed = false, employee, prisma }) {
  if (!employee) return { status: 401, json: { success: false, error: MSG.unauthorized } };
  if (!employee.isActive) return { status: 403, json: { success: false, error: MSG.inactive } };

  if (!isSelfSwitchScreen(screen)) return { status: 400, json: { success: false, error: MSG.unknownScreen } };

  if (bodyParseFailed) return { status: 400, json: { success: false, error: MSG.badJson } };
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.prototype.hasOwnProperty.call(body, 'value')) {
    return { status: 400, json: { success: false, error: MSG.missingValue } };
  }

  const canManage = isManagementRole(employee.roleId);

  // דף הבית: רק הנהלה. (התפריט — כמו קודם: כל עובד, אבל רק legacy / null.)
  if (screen !== 'shell' && !canManage) {
    return { status: 403, json: { success: false, error: MSG.homeForbidden } };
  }
  if (body.value === 'a5' && !canManage) {
    return { status: 403, json: { success: false, error: MSG.a5Forbidden } };
  }

  const built = buildUiVariantOverride(employee.themeColor, screen, body.value, { allowA5: canManage });
  if (!built.ok) return { status: 400, json: { success: false, error: built.error } };
  if (built.serialized.length > MAX_THEME_COLOR_LENGTH) {
    return { status: 413, json: { success: false, error: MSG.tooLarge } };
  }

  if (built.changed) {
    // תמיד על העובד המאומת עצמו (employee.id מהשרת), לעולם לא על מזהה מהגוף.
    await prisma.employee.update({
      where: { id: employee.id },
      data: { themeColor: built.serialized },
      select: { id: true },
    });
  }

  const variants = built.next.uiVariants || null;
  return {
    status: 200,
    nextPrefs: built.next,
    json: {
      success: true,
      employeeId: employee.id,
      screen,
      value: variants ? (variants[screen] || null) : null,
      // שדות תאימות לאחור (הלקוח הישן של "האתר הישן" לא קורא אותם, אבל הם היו חלק מהתשובה):
      shell: variants ? (variants.shell || null) : null,
      uiVariants: variants,
      changed: built.changed,
    },
  };
}
