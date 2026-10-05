// lib/uiVariantScreens.js — רשימת המסכים שיש להם גרסה ישנה וגרסה חדשה ("ישן / A5"), במקום אחד (4.10.2026).
//
// ESM טהור בלי imports של Next/prisma: נקרא בשרת, בלקוח, ב-node (scripts/test_page_variant_switch.mjs).
// lib/uiVariant.js בונה מכאן את רשימת המסכים, את מפתחות ההגדרה ואת ברירות המחדל; lib/uiVariantSelfSwitch.js בונה מכאן
// את רשימת המסכים שהנהלה רשאית להחליף לעצמה; דף "עיצוב ותצוגה" מציג מכאן את המתגים; האייקון PageVariantToggle
// מוצג רק במסך שהרשומה שלו אומרת ששתי הגרסאות קיימות.
//
// איך מוסיפים מסך (ר' docs/page-variant-switch-2026-10-04.md): רשומה אחת כאן + Switch (בחירה בין Legacy* לחדש) +
// עותק הקוד הישן (Legacy*.js, משוחזר מ-git כפי שהוא). כל השאר (הגדרה, עקיפה אישית, API, מתג בדף התצוגה, האייקון) נגזר מהרשומה.
//
// שדות:
//   id             מזהה המסך. גם המפתח ב-Employee.themeColor.uiVariants וגם הסיומת של SystemSetting ui_variant_<id>.
//   label          שם בעברית (דף "עיצוב ותצוגה", תיעוד).
//   routes         הנתיבים שבהם המסך מוצג (תיעוד + בדיקות). '*' = כל האתר (המעטפת); [] = רכיב גלובלי (חלון).
//   legacyExists   יש גרסה ישנה שאפשר לחזור אליה.
//   newExists      הגרסה החדשה בנויה ומחוברת (ענפים שבונים עכשיו מסך חדש משאירים false עד שהוא מוכן).
//   selfSwitch     הנהלה ראשית / מתכנת רשאים להחליף לעצמם (נאכף רק כשגם legacyExists וגם newExists).
//   excludeRoutes  (אופציונלי) נתיבים שתבנית ב-routes תופסת בטעות ואינם שייכים למסך (matchRoute מקבל כל מקטע בודד ב-':id',
//                  למשל '/employees/:id' תופס גם '/employees/attendance'). נבדק ב-screenMatchesPath.
//   switchTargets  לאן עוברים אחרי לחיצה על האייקון, כשהנתיב של הגרסה השנייה שונה: { a5: { from: to }, legacy: { from: to } }.
//                  בלי התאמה — נשארים באותו נתיב (טעינה מחדש).
//
// ברירת המחדל לפי תפקיד (החלטת הבעלים 4.10.2026): כשאין עקיפה אישית ואין הגדרת ארגון ui_variant_<id>, האתר נפתח בעיצוב
// הישן לכולם — חוץ מהמתכנת, שמקבל את החדש בכל מסך שהגרסה החדשה שלו קיימת (newExists). סדר ההכרעה המלא ב-lib/uiVariant.js:
// עקיפה אישית > הגדרת ארגון > ברירת מחדל לפי תפקיד (roleDefaultVariant).
//
// מסכים שאין להם גרסה ישנה (לו"ז / לוח חודשי, בדיקת מלאי) לא מופיעים כאן — ר' NO_LEGACY_PAGES.
// דף הכניסה מנוהל בנפרד (login_page_new) ומתועד ב-EXTERNAL_VARIANT_SWITCHES.

export const UI_SCREEN_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'shell',
    label: 'תפריט עליון',
    routes: Object.freeze(['*']),
    legacyExists: true,
    newExists: true,
    selfSwitch: true,
    switchTargets: null,
  }),
  Object.freeze({
    id: 'home',
    label: 'דף הבית',
    routes: Object.freeze(['/']),
    legacyExists: true,
    newExists: true,
    selfSwitch: true,
    switchTargets: null,
  }),
  // order_card: כרטיס ההזמנה החדש (feature/order-card-a5, OrderCardSwitch ב-app/orders/[id]/page.js; הישן: LegacyOrderPage.js = page.js של main).
  // newExists:true -> המתכנת מקבל אותו כברירת מחדל לפי תפקיד, כל השאר נשארים בישן עד הגדרת ארגון / עקיפה אישית.
  // customer_card: נבנה בענף feature/customer-card-a5-2026-10-04. כשהגרסה החדשה מוכנה, הענף שלה משנה newExists:true — זה הכול.
  Object.freeze({
    id: 'order_card',
    label: 'כרטיס הזמנה',
    routes: Object.freeze(['/orders/:id']),
    excludeRoutes: Object.freeze(['/orders/new']), // מסך ההזמנה החדשה (app/orders/new) הוא דף אחר
    legacyExists: true,
    newExists: true,
    selfSwitch: true,
    switchTargets: null,
  }),
  Object.freeze({
    id: 'customer_card',
    label: 'כרטיס לקוח',
    routes: Object.freeze(['/customers/:id']),
    legacyExists: true,
    newExists: false,
    selfSwitch: true,
    switchTargets: null,
  }),
  // כרטיס עובד (ניהול): נבנה בענף feature/employee-card-a5-2026-10-04 (EmployeeCardSwitch ב-app/employees/[id]/page.js, הישן:
  // app/employees/[id]/LegacyEmployeeCardPage.js). newExists:false עד שהבעלים מאשר — כך שמתכנת לא מקבל אותו כברירת מחדל לפי תפקיד;
  // הגדרת ארגון ui_variant_employee_card='a5' עדיין מדליקה אותו. /employees/new מוגש מאותו דף ולכן תואם '/employees/:id';
  // /employees/attendance ו-/employees/report הם מסכים אחרים (מסך "נוכחות") ולכן מוחרגים.
  Object.freeze({
    id: 'employee_card',
    label: 'כרטיס עובד (ניהול)',
    routes: Object.freeze(['/employees/:id']),
    excludeRoutes: Object.freeze(['/employees/attendance', '/employees/report']),
    legacyExists: true,
    newExists: false,
    selfSwitch: true,
    switchTargets: null,
  }),
  // הפרופיל החדש חי ב-main מ-3.10.2026 (commit 7917382f); הישן: app/profile/LegacyProfilePage.js.
  Object.freeze({
    id: 'profile',
    label: 'הפרופיל שלי',
    routes: Object.freeze(['/profile']),
    legacyExists: true,
    newExists: true,
    selfSwitch: true,
    switchTargets: null,
  }),
  // מסך הניהול הראשי החדש חי ב-main מ-4.10.2026 (merge 079fc226); הישן: app/admin/LegacyAdminPage.js.
  Object.freeze({
    id: 'admin_hub',
    label: 'מסך ניהול ראשי',
    routes: Object.freeze(['/admin']),
    legacyExists: true,
    newExists: true,
    selfSwitch: true,
    switchTargets: null,
  }),
  // "סיכום נוכחות" חי ב-main מ-4.10.2026 (merge f3b1f771). הישן: לשונית "נוכחות" ב-/employees (LegacyEmployeesPage),
  // "דוח נוכחות חודשי" /employees/report (LegacyReportPage) ו"השעות שלי" /my-hours (LegacyMyHoursPage).
  // /employees/<id>/attendance קיים רק בחדש (אין לו מקבילה ישנה) — לא ברשימה, ואין בו אייקון.
  Object.freeze({
    id: 'attendance',
    label: 'נוכחות (סיכום נוכחות, השעות שלי)',
    routes: Object.freeze(['/employees/attendance', '/my-hours', '/employees/report', '/employees']),
    legacyExists: true,
    newExists: true,
    selfSwitch: true,
    switchTargets: Object.freeze({
      a5: Object.freeze({ '/employees': '/employees/attendance', '/employees/report': '/employees/attendance' }),
      legacy: Object.freeze({ '/employees/attendance': '/employees' }),
    }),
  }),
  // חלון "דיווח על שגיאות" החדש חי ב-main מ-4.10.2026 (commit 6c986418); הישן: app/components/LegacyErrorReportButton.js
  // (c944cb95:app/components/ErrorReportButton.js). רכיב גלובלי בשתי המעטפות — אין נתיב משלו.
  Object.freeze({
    id: 'error_report',
    label: 'חלון דיווח על שגיאות',
    routes: Object.freeze([]),
    legacyExists: true,
    newExists: true,
    selfSwitch: true,
    switchTargets: null,
  }),
  // הלוח החודשי החדש (4.10.2026, ענף feature/board-new-design-2026-10-04): מונים בלבד, לחיצה על יום = דף הלו"ז של אותו יום.
  // F13: משוחרר למתכנת בלבד קודם (ברירת מחדל לפי תפקיד: מתכנת חדש, כל השאר הלוח הישן). הישן: app/board/LegacyBoardPage.js
  // (c944cb95:app/board/page.js כפי שהוא). המתג עצמאי (selfSwitch) - אייקון בכותרת הלוח החדש + פינה בישן.
  Object.freeze({
    id: 'board',
    label: 'לוח חודשי',
    routes: Object.freeze(['/board']),
    legacyExists: true,
    newExists: true,
    selfSwitch: true,
    switchTargets: null,
  }),
  // הגדרות מערכת / הגדרות אתר / שינוי שמות (4.10.2026, ענף feature/settings-sim-2026-10-04): שלושה נתיבים = מסך אחד בהכרעה.
  // הישן: app/admin/settings/LegacySettingsPage.js, app/admin/site-settings/LegacySiteSettingsPage.js, app/admin/labels/LegacyLabelsPage.js
  // (ללא שינוי). ברירת מחדל לפי תפקיד: מתכנת חדש, כל השאר ישן (roleDefaultVariant). /admin/settings/help ו-/admin/site-settings/*
  // (api-keys, email-logs) הם דפים אחרים ולכן לא ברשימה.
  Object.freeze({
    id: 'settings',
    label: 'הגדרות מערכת / אתר / שינוי שמות',
    routes: Object.freeze(['/admin/settings', '/admin/site-settings', '/admin/labels']),
    legacyExists: true,
    newExists: true,
    selfSwitch: true,
    switchTargets: null,
  }),
]);

// דפים חדשים בלי גרסה ישנה — אין להם מתג ואין בהם אייקון.
export const NO_LEGACY_PAGES = Object.freeze([
  Object.freeze({ id: 'schedule', label: 'לו"ז / לוח חודשי', routes: Object.freeze(['/schedule']) }),
  Object.freeze({ id: 'stock_check', label: 'בדיקת מלאי', routes: Object.freeze(['/stock-check']) }),
  Object.freeze({ id: 'attendance_employee', label: 'נוכחות עובד (עריכה)', routes: Object.freeze(['/employees/:id/attendance']) }),
]);

// מתגים "ישן / חדש" שקיימים מחוץ למנגנון הזה. דף הכניסה מוצג לפני ההתחברות, ולכן אין עקיפה אישית ואין אייקון;
// הארגון מחזיר את הישן עם SystemSetting login_page_new = 'false' (ר' app/layout.js loginVariant).
export const EXTERNAL_VARIANT_SWITCHES = Object.freeze([
  Object.freeze({ id: 'login', label: 'דף הכניסה + שעון נוכחות', settingKey: 'login_page_new', offValue: 'false', preAuth: true, selfSwitch: false }),
]);

const BY_ID = new Map(UI_SCREEN_REGISTRY.map((s) => [s.id, s]));

/** הרשומה של מסך, או null. בדיקה לפי Map (לא obj[key]) — '__proto__' / 'constructor' לא נמצאים. */
export function getScreenEntry(id) {
  return typeof id === 'string' && BY_ID.has(id) ? BY_ID.get(id) : null;
}

/** כל מזהי המסכים (סדר הרישום). */
export const UI_SCREEN_IDS = Object.freeze(UI_SCREEN_REGISTRY.map((s) => s.id));

// התפקידים שנפתחים בעיצוב החדש כברירת מחדל: מתכנת בלבד (roleId 2 — אותו ערך כמו DEVELOPER_ONLY_ROLES ב-lib/roles.js;
// הקובץ הזה טהור ולכן לא מייבא את lib/auth.js / lib/roles.js — scripts/test_page_variant_switch.mjs בודק שהשניים זהים).
// להרחבה (למשל גם הנהלה ראשית): להוסיף כאן את ה-roleId. זה המקום היחיד.
export const NEW_DESIGN_DEFAULT_ROLE_IDS = Object.freeze([2]);

/**
 * ברירת המחדל לפי תפקיד: 'a5' למתכנת במסך שהגרסה החדשה שלו קיימת, 'legacy' לכל השאר (כולל מסך לא מוכר / אורח).
 * @param {string} id
 * @param {number|null|undefined} roleId  Employee.roleId של המשתמש המחובר (null = אורח / לא ידוע)
 */
export function roleDefaultVariant(id, roleId) {
  const e = getScreenEntry(id);
  if (!e || !e.newExists) return 'legacy';
  return typeof roleId === 'number' && NEW_DESIGN_DEFAULT_ROLE_IDS.includes(roleId) ? 'a5' : 'legacy';
}

/** שתי הגרסאות קיימות — רק אז יש מה להחליף (אייקון, מתג בדף התצוגה, API). */
export function hasBothVersions(id) {
  const e = getScreenEntry(id);
  return !!(e && e.legacyExists && e.newExists);
}

/** מסכים שהנהלה רשאית להחליף לעצמה: selfSwitch + שתי הגרסאות קיימות. */
export function selfSwitchableScreenIds() {
  return UI_SCREEN_REGISTRY.filter((s) => s.selfSwitch && s.legacyExists && s.newExists).map((s) => s.id);
}

function normPath(p) {
  if (typeof p !== 'string' || !p) return '';
  return p.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

/** האם pathname תואם תבנית ('/orders/:id', '*', '/x'). */
export function matchRoute(pattern, pathname) {
  const p = normPath(pathname);
  if (!p) return false;
  if (pattern === '*') return true;
  const a = normPath(pattern).split('/');
  const b = p.split('/');
  if (a.length !== b.length) return false;
  return a.every((seg, i) => (seg.startsWith(':') ? b[i].length > 0 : seg === b[i]));
}

/** האם pathname שייך למסך (אחד מ-routes ולא אחד מ-excludeRoutes). routes ריק = רכיב גלובלי: false. */
export function screenMatchesPath(entryOrId, pathname) {
  const e = typeof entryOrId === 'string' ? getScreenEntry(entryOrId) : entryOrId;
  if (!e || !Array.isArray(e.routes)) return false;
  if (!e.routes.some((r) => matchRoute(r, pathname))) return false;
  return !(Array.isArray(e.excludeRoutes) && e.excludeRoutes.some((r) => matchRoute(r, pathname)));
}

/**
 * לאן לעבור אחרי מעבר לגרסה `to` מהנתיב pathname. מחזיר נתיב יעד אחר, או null (= להישאר / טעינה מחדש).
 */
export function switchTargetFor(id, to, pathname) {
  const e = getScreenEntry(id);
  if (!e || !e.switchTargets || (to !== 'a5' && to !== 'legacy')) return null;
  const map = e.switchTargets[to];
  if (!map) return null;
  const p = normPath(pathname);
  return Object.prototype.hasOwnProperty.call(map, p) ? map[p] : null;
}
