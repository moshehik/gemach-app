// lib/uiVariantSelfSwitch.js — "מעבר עצמאי בין העיצוב הישן לחדש" (2026-10-01).
//
// ההחלטה (הבעלים, 1.10.2026): הנהלה ראשית ומתכנת יכולים להחליף בעצמם, לעצמם בלבד, את התפריט העליון
// (`shell`) ואת דף הבית (`home`) בין 'legacy' ל-'a5' — בלי להריץ סקריפט.
//
// ההחלטה המורחבת (הבעלים, 11.10.2026, מילה במילה): "כולם דלוק לכולם אם בוחרים באתר החדש, כל עוד הם לא בוחרים בעצמם הוא נשאר
// בישן חוץ ממני שהוא ברירת מחדל בחדש". כלומר: כל עיצוב חדש *זמין* לכל עובד פעיל (הנהלה ראשית, מנהל סניף, מזכירה, עובד רגיל -
// כל roleId כולל null); כל עובד בוחר בעצמו, לעצמו בלבד, מסך-מסך (האייקון PageVariantToggle ודף "עיצוב ותצוגה"); כל עוד לא בחר -
// הוא נשאר בישן; רק המתכנת (roleId 2) מקבל את החדש כברירת מחדל (roleDefaultVariant ב-lib/uiVariantScreens.js, לא השתנה).
// לא נכתבת שום הגדרת ארגון. הכלל כולו במקום אחד: canEmployeeSelfSwitch כאן (השרת, ה-layout, הלקוח והבדיקות קוראים ממנו).
//
// ESM טהור בלי Next/prisma (לקוח prisma מוזרק), כדי לבדוק עם node רגיל — scripts/test_ui_variant_self_switch.mjs.
//
// עקרונות אבטחה:
//   * התפקיד נקבע בשרת מהעובד המאומת (Employee.roleId ב-DB) — לעולם לא מגוף הבקשה / העוגייה.
//   * העובד המטרה הוא תמיד העובד המאומת עצמו; גוף הבקשה לא יכול להכיל מזהה עובד (שדות זרים נתעלמים).
//   * רק מסכים שברשומה המרכזית (lib/uiVariantScreens.js) מסומנים selfSwitch ושתי הגרסאות שלהם קיימות (4.10.2026: shell, home,
//     profile, admin_hub, attendance, error_report). order_card / customer_card נדחים עד שהגרסה החדשה שלהם מסומנת newExists.
//   * הכתיבה דרך buildUiVariantOverride → mergeDesignPrefs → Employee.themeColor.uiVariants. אין כתיבת AuditLog
//     ידנית (ההרחבה של Prisma ב-app/lib/prisma.js רושמת כל כתיבה), ואין קריאות בתוך $transaction.
//   * GQ-01b (4.10.2026): עוגיית designPrefs_<id> שה-layout קורא חתומה ב-HMAC ונכתבת רק בשרת (lib/designPrefsSig.js) - עריכה בדפדפן
//     כבר לא מדליקה a5; עוגייה לא תקפה = אין עקיפה. התשובה של ה-POST מרעננת אותה מה-DB (app/lib/uiVariantRoute.js).

import { buildUiVariantOverride } from './designPrefsSchema.js';
import { getScreenEntry, hasBothVersions, screenMatchesPath, selfSwitchableScreenIds } from './uiVariantScreens.js';
import { isForcedLegacyPath } from './uiVariant.js';

// 4.10.2026: המסכים נגזרים מהרשומה המרכזית (lib/uiVariantScreens.js): selfSwitch + שתי הגרסאות קיימות.
// היום: shell, home, profile, admin_hub, attendance, error_report. order_card / customer_card נכנסים אוטומטית כשהענף שלהם
// מסמן newExists:true ברשומה.
export const SELF_SWITCH_SCREENS = Object.freeze(selfSwitchableScreenIds());

// === המקום היחיד לצמצום ===
// null = כל עובד פעיל רשאי להחליף לעצמו (החלטת הבעלים 11.10.2026). כדי לצמצם שוב (למשל רק הנהלה ראשית + מתכנת) -
// מערך של roleId, למשל Object.freeze([0, 2]); אז רק עובד שה-roleId שלו (מספר, מה-DB) ברשימה. זה הכול - אין עוד מקום.
export const SELF_SWITCH_ONLY_ROLE_IDS = null;

/**
 * מי רשאי להחליף לעצמו "ישן / חדש" (האייקון PageVariantToggle, דף "עיצוב ותצוגה", GET/POST /api/me/ui-variant*).
 * כל עובד *מאומת ופעיל* (isActive === true בדיוק), בכל תפקיד כולל roleId null. לא מאומת / לא פעיל / לא אובייקט -> false.
 * זה דגל תצוגה בלבד: המעבר לעיצוב החדש לא נותן שום הרשאה - הדפים החדשים קוראים לאותם API מוגנים ולאותם שערים (PageGate / checkAuth).
 * @param {{ roleId?: number|null, isActive?: boolean }|null|undefined} employee
 */
export function canEmployeeSelfSwitch(employee) {
  if (!employee || typeof employee !== 'object' || Array.isArray(employee)) return false;
  if (employee.isActive !== true) return false;
  if (SELF_SWITCH_ONLY_ROLE_IDS === null) return true;
  return typeof employee.roleId === 'number' && SELF_SWITCH_ONLY_ROLE_IDS.includes(employee.roleId);
}

/**
 * האם להציג את אייקון המעבר "ישן / חדש" (PageVariantToggle) — הכלל המלא במקום אחד (טהור, נבדק ב-scripts/test_page_variant_switch.mjs):
 *   המשתמש רשאי להחליף לעצמו (canSelfSwitch מה-layout = canEmployeeSelfSwitch), המסך ברשומה עם שתי הגרסאות ומותר בו מעבר עצמאי,
 *   הנתיב אינו קיוסק / שעון נוכחות / הדפסה, והנתיב הוא אחד מנתיבי המסך ברשומה (routes ריק = רכיב גלובלי, למשל חלון הדיווח).
 */
export function shouldShowVariantToggle({ canSelfSwitch, screen, pathname }) {
  if (canSelfSwitch !== true) return false;
  if (!isSelfSwitchScreen(screen) || !hasBothVersions(screen)) return false;
  const p = typeof pathname === 'string' ? pathname : '';
  if (isForcedLegacyPath(p)) return false;
  const entry = getScreenEntry(screen);
  const routes = entry ? entry.routes : [];
  return routes.length === 0 || screenMatchesPath(entry, p);
}

/** האם העובד רשאי להחליף לעצמו את המסך הזה (בשני הכיוונים, כולל shell). */
export function canSelfSwitchScreen(employee, screen) {
  return canEmployeeSelfSwitch(employee) && isSelfSwitchScreen(screen);
}

export function isSelfSwitchScreen(screen) {
  return typeof screen === 'string' && SELF_SWITCH_SCREENS.includes(screen);
}

export const MAX_THEME_COLOR_LENGTH = 8192; // כמו PUT /api/me/design-prefs

// "כל האתר" (12.10.2026, בקשת הבעלים לנווה יעקב): לחצן "חזרה לממשק החדש" בכותרת הממשק הישן, ו"האתר הישן" בתפריט החדש, מחליפים
// בבת אחת את כל המסכים שמותר להחליף (SELF_SWITCH_SCREENS) - לא רק מסך אחד. אותם כללי הרשאה כמו מעבר של מסך בודד.

const MSG = {
  unauthorized: 'לא מחובר/ת',
  inactive: 'העובד/ת אינו פעיל/ה',
  badJson: 'גוף הבקשה אינו JSON תקין',
  missingValue: "חסר השדה value (מותר 'legacy', 'a5' או null)",
  unknownScreen: 'המסך הזה לא ניתן להחלפה בין ישן לחדש',
  forbidden: 'המעבר העצמאי בין העיצוב הישן לחדש אינו זמין למשתמש הזה.',
  tooLarge: 'ההעדפות גדולות מדי',
};

/**
 * מחזיר מה העובד רשאי לעשות — לשימוש GET /api/me/ui-variant (הצגת הסעיף בדף "עיצוב ותצוגה").
 * @param {{ roleId?: number|null, themeColor?: string|null, isActive?: boolean }|null} employee
 */
export function describeSelfSwitch(employee) {
  const canSelfSwitch = canEmployeeSelfSwitch(employee);
  return { canSelfSwitch, screens: canSelfSwitch ? [...SELF_SWITCH_SCREENS] : [] };
}

/**
 * הליבה של POST /api/me/ui-variant (בלי מסך): מחליפה את *כל* המסכים ב-SELF_SWITCH_SCREENS לאותו ערך, בכתיבה אחת של Employee.themeColor.
 * גוף: { value: 'a5' | 'legacy' } (null לא מותר כאן - "ביטול עקיפה" לכל המסכים הוא פעולה אחרת ולא נדרשת). אותם כללים בדיוק כמו applyUiVariantRequest:
 * העובד המטרה הוא תמיד המאומת, לא פעיל 403, לא מאומת 401, גוף לא תקין 400. מסכים שאינם ברשימה (למשל employee_card) לא נוגעים.
 * @returns {Promise<{ status: number, json: object, nextPrefs?: object }>}
 */
export async function applyUiVariantAllRequest({ body, bodyParseFailed = false, employee, prisma }) {
  if (!employee) return { status: 401, json: { success: false, error: MSG.unauthorized } };
  if (!employee.isActive) return { status: 403, json: { success: false, error: MSG.inactive } };
  if (bodyParseFailed) return { status: 400, json: { success: false, error: MSG.badJson } };
  if (!body || typeof body !== 'object' || Array.isArray(body) || (body.value !== 'a5' && body.value !== 'legacy')) {
    return { status: 400, json: { success: false, error: "הערך חייב להיות 'legacy' או 'a5'" } };
  }
  if (!canEmployeeSelfSwitch(employee)) return { status: 403, json: { success: false, error: MSG.forbidden } };

  let serialized = typeof employee.themeColor === 'string' ? employee.themeColor : null;
  let next = null;
  let changed = false;
  for (const screen of SELF_SWITCH_SCREENS) {
    const built = buildUiVariantOverride(serialized, screen, body.value, { allowA5: true });
    if (!built.ok) return { status: 400, json: { success: false, error: built.error } };
    serialized = built.serialized;
    next = built.next;
    if (built.changed) changed = true;
  }
  if (!next) return { status: 400, json: { success: false, error: MSG.unknownScreen } };
  if (serialized.length > MAX_THEME_COLOR_LENGTH) return { status: 413, json: { success: false, error: MSG.tooLarge } };

  if (changed) {
    await prisma.employee.update({ where: { id: employee.id }, data: { themeColor: serialized }, select: { id: true } });
  }
  return {
    status: 200,
    nextPrefs: next,
    json: { success: true, employeeId: employee.id, scope: 'all', value: body.value, screens: [...SELF_SWITCH_SCREENS], uiVariants: next.uiVariants || null, changed },
  };
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

  // הכלל האחד (canEmployeeSelfSwitch). עובד פעיל כבר אומת למעלה; כאן רק צמצום אפשרי לפי תפקיד (SELF_SWITCH_ONLY_ROLE_IDS).
  if (!canEmployeeSelfSwitch(employee)) {
    return { status: 403, json: { success: false, error: MSG.forbidden } };
  }

  const built = buildUiVariantOverride(employee.themeColor, screen, body.value, { allowA5: true });
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
