// Single source of truth for the permissions catalog shown at /admin/permissions and
// on an employee's own card ("הרשאות ספציפיות"). Every access-control decision that is
// department- or employee-specific (not a single global on/off SystemSetting) belongs
// here — see the "Permissions system" section in CLAUDE.md for the standing rule.
//
// Each catalog item:
//   key                 stable id, "page:<slug>" or "feature:<slug>" — stored verbatim
//                       in DepartmentPermission.key / EmployeePermissionOverride.key.
//   group               'pages' | 'features' — the two tabs on the admin page.
//   label / description Hebrew display text.
//   type                'boolean' | 'number'.
//   enforced            true = an actual runtime check reads this value (see the
//                       "wired" comment on the item). false = the admin page lets you
//                       record the intended access, but nothing in the app enforces it
//                       yet — it still runs on the older hardcoded roleId check
//                       described in `note`. Migrating a `false` item to `true` means
//                       replacing that hardcoded check with a real read from
//                       lib/permissions.js, and flipping this flag — never flip it
//                       without doing the code change first.
//   userNote            the same thing in plain Hebrew for the popover users see on
//                       /admin/permissions (no file names, no English, no code terms).
//   note                DEVELOPER-facing: what currently governs this (for enforced:false items) or
//                       where enforcement lives (for enforced:true items).
//   defaultForRoleId(roleId) → default value used when no explicit
//                       DepartmentPermission row exists yet for that department.
//                       Chosen to match today's real behavior exactly, so turning this
//                       system on changes nothing until an admin edits something.
//                       (There is no per-item special storage: AI and error reports used to live in
//                       Employee.showAi / Employee.canReportErrors; since 2026-09-20 they use the same
//                       override rows as everything else and those columns are unused.)
//   settingKeys         optional: SystemSetting keys the default depends on (passed to defaultForRoleId as 2nd arg).
//   notConfigurable     optional string: this item is NOT offered in the row wizard (it is locked to head
//                       management / has no login), the string says why. Everything else in the 'pages' group is
//                       now enforced: true — the page's layout.js calls canOpenPage(key) in lib/permissions.js.
//   route               'pages' items only — the page's real URL, used by
//                       /admin/permissions' page picker to open/preview it. No
//                       equivalent for 'features' (not a navigable page).
//
// IMPORTANT — adding a new item here does NOT make it visible on /admin/permissions
// by itself: that page only shows PermissionPageGroup rows an admin actually created
// (see that model's doc comment in prisma/schema.prisma). Also create a row for the
// new item (via the page's "שורת הרשאה חדשה" button — the tables are never seeded),
// or it stays unmanageable from that UI even though it's fully wired everywhere else.

const HEAD_MANAGEMENT = [0, 2];

// SystemSetting toggles that several layouts read with the convention "anything but 'false' = on".
function settingOn(settings, key) {
  const v = settings && settings[key];
  return v === undefined || v === null || v !== 'false';
} // הנהלה ראשית / מתכנת — mirrors lib/auth.js HEAD_MANAGEMENT_ROLES

// Roles that are unconditionally allowed every boolean permission here ("full access, except
// what is restricted to the programmer specifically" — that lives in lib/auth.js
// DEVELOPER_ONLY_ROLES, outside this catalog). They get no editable column/toggle on
// /admin/permissions and no DepartmentPermission row can restrict them.
export const ALWAYS_ALLOWED_ROLE_IDS = [0, 2];
const MANAGER_TIER = [1, 2];    // מנהל / מתכנת — mirrors lib/auth.js ROLE_LEVELS['מנהל']

export const PERMISSION_CATALOG = [
  // ---------------------------------------------------------------------
  // Pages — the connectable ones are enforced (their layout.js calls canOpenPage(key) in
  // lib/permissions.js). The rest are notConfigurable (locked to head management / no login).
  // ---------------------------------------------------------------------
  {
    key: 'page:admin',
    group: 'pages',
    label: 'אזור ניהול (כולל כל העמודים שבו)',
    route: '/admin',
    description: 'הגדרות מערכת, מחלקות, סטטיסטיקות, מחירון וכו\'.',
    type: 'boolean',
    enforced: false,
    notConfigurable: "נעול להנהלה ראשית ומתכנת: כל ה-API של אזור הניהול מוגבל להם בשרת, כך שפתיחת העמוד למחלקה אחרת הייתה מציגה מסך שבור.", // hidden from the row wizard: nothing to configure
    note: 'נשלט כרגע לפי app/admin/layout.js — roleId 0/2 (הנהלה ראשית/מתכנת) בלבד.',
    userNote: 'כרגע רק הנהלה ראשית ומתכנת נכנסים לכאן.',
    defaultForRoleId: (roleId) => HEAD_MANAGEMENT.includes(roleId),
  },
  {
    key: 'page:employees',
    group: 'pages',
    label: 'ניהול עובדים',
    route: '/employees',
    description: 'רשימת עובדים, כרטיסי עובד, נוכחות.',
    type: 'boolean',
    enforced: false,
    notConfigurable: "נעול להנהלה ראשית ומתכנת: נתוני העובדים (שכר, סיסמאות, נוכחות) מוגנים בשרת להם בלבד.", // hidden from the row wizard: nothing to configure
    note: 'נשלט כרגע לפי app/employees/layout.js — roleId 0/2 (הנהלה ראשית/מתכנת) בלבד.',
    userNote: 'כרגע רק הנהלה ראשית ומתכנת נכנסים לכאן.',
    defaultForRoleId: (roleId) => HEAD_MANAGEMENT.includes(roleId),
  },
  {
    key: 'page:refunds',
    group: 'pages',
    label: 'זיכויים',
    route: '/refunds',
    description: 'ביטולים והחזרים כספיים.',
    type: 'boolean',
    enforced: true,
    settingKeys: ['restrict_refunds_to_head_management'],
    note: 'נאכף בשרת: app/refunds/layout.js קורא ל-canOpenPage("page:refunds") (lib/permissions.js). ברירת המחדל תלויה בהגדרת המערכת restrict_refunds_to_head_management (מופעלת = הנהלה ראשית/מתכנת בלבד; כבויה = גם מנהל סניף). שורת הרשאה גוברת על ברירת המחדל. ה-API של הזיכויים נשאר פתוח לכל עובד מחובר (הכרטיסייה "תשלומים" בהזמנה משתמשת בו).',
    userNote: 'קובע מי נכנס לעמוד הזיכויים והחובות. אם לא הוגדרה שורה, נקבע לפי הגדרת המערכת "זיכויים להנהלה ראשית בלבד". הנהלה ראשית ומתכנת תמיד נכנסים. הפעולות על זיכוי מתוך כרטיס ההזמנה לא תלויות בעמוד הזה.',
    defaultForRoleId: (roleId, s) => (settingOn(s, 'restrict_refunds_to_head_management') ? HEAD_MANAGEMENT.includes(roleId) : [0, 1, 2].includes(roleId)),
  },
  {
    key: 'page:dresses_catalog',
    group: 'pages',
    label: 'קטלוג שמלות',
    route: '/dashboard/dresses',
    description: 'ניהול דגמים ופריטים.',
    type: 'boolean',
    enforced: true,
    settingKeys: ['restrict_dress_catalog_to_head_management'],
    note: 'נאכף בשרת: app/dashboard/dresses/layout.js קורא ל-canOpenPage("page:dresses_catalog"). ברירת המחדל תלויה בהגדרת המערכת restrict_dress_catalog_to_head_management. שורת הרשאה גוברת.',
    userNote: 'קובע מי נכנס לקטלוג הדגמים והפריטים. אם לא הוגדרה שורה, נקבע לפי הגדרת המערכת "קטלוג דגמים להנהלה ראשית בלבד". הנהלה ראשית ומתכנת תמיד נכנסים.',
    defaultForRoleId: (roleId, s) => (settingOn(s, 'restrict_dress_catalog_to_head_management') ? HEAD_MANAGEMENT.includes(roleId) : true),
  },
  {
    key: 'page:pricelist',
    group: 'pages',
    label: 'מחירון',
    route: '/dashboard/pricelist',
    description: 'הגדרת תעריפים וכללי תמחור.',
    type: 'boolean',
    enforced: false,
    notConfigurable: "נעול להנהלה ראשית ומתכנת: שינוי תעריפים מוגן בשרת להם בלבד.", // hidden from the row wizard: nothing to configure
    note: 'נשלט כרגע לפי app/dashboard/pricelist/layout.js — roleId 0/2 (הנהלה ראשית/מתכנת) בלבד.',
    userNote: 'כרגע רק הנהלה ראשית ומתכנת נכנסים לכאן.',
    defaultForRoleId: (roleId) => HEAD_MANAGEMENT.includes(roleId),
  },
  {
    key: 'page:board',
    group: 'pages',
    label: 'לוח חודשי',
    route: '/board',
    description: 'תצוגת לוח שנה חודשית של הזמנות.',
    type: 'boolean',
    enforced: true,
    settingKeys: ['restrict_board_to_managers'],
    note: 'נאכף בשרת (מ-2026-09-20): app/board/layout.js קורא ל-canOpenPage("page:board") וגם התפריט הצדדי. קודם ההגבלה הייתה רק הסתרת הכפתור בתפריט וכל עובד יכול היה לפתוח את העמוד בכתובת. ברירת המחדל תלויה בהגדרת המערכת restrict_board_to_managers (מופעלת = מנהלים בלבד). שורת הרשאה גוברת.',
    userNote: 'קובע מי רואה את הלוח החודשי (גם בתפריט וגם בכניסה ישירה בכתובת). אם לא הוגדרה שורה, נקבע לפי הגדרת המערכת "לוח חודשי למנהלים בלבד". הנהלה ראשית ומתכנת תמיד נכנסים.',
    defaultForRoleId: (roleId, s) => (settingOn(s, 'restrict_board_to_managers') ? [0, 1, 2].includes(roleId) : true),
  },
  {
    key: 'page:home',
    group: 'pages',
    label: 'עמוד הבית',
    route: '/',
    description: 'קטלוג הדגמים והזמינות.',
    type: 'boolean',
    enforced: false,
    notConfigurable: "תמיד פתוח לכל עובד מחובר: זה עמוד הכניסה למערכת.", // hidden from the row wizard: nothing to configure
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    userNote: 'כרגע פתוח לכל עובד שמחובר.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:orders',
    group: 'pages',
    label: 'רשימת הזמנות',
    route: '/orders',
    description: 'חיפוש ועריכת הזמנות קיימות.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת (מ-2026-09-20): app/orders/layout.js קורא ל-canOpenPage("page:orders"). ברירת המחדל: פתוח לכל עובד מחובר; שורת הרשאה יכולה לשלול או להוסיף. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל רשימת ההזמנות וכרטיס ההזמנה (כל מה שמתחת ל-/orders חוץ מהזמנה חדשה). אם לא הוגדרה שורה — פתוח לכל עובד שמחובר. הנהלה ראשית ומתכנת תמיד נכנסים.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:orders_new',
    group: 'pages',
    label: 'הזמנה חדשה',
    route: '/orders/new',
    description: 'פתיחת הזמנת השכרה חדשה.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת (מ-2026-09-20): app/orders/layout.js קורא ל-canOpenPage("page:orders_new"). ברירת המחדל: פתוח לכל עובד מחובר; שורת הרשאה יכולה לשלול או להוסיף. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל פתיחת הזמנה חדשה. אם לא הוגדרה שורה — פתוח לכל עובד שמחובר. הנהלה ראשית ומתכנת תמיד נכנסים.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:rentals',
    group: 'pages',
    label: 'השכרות והחזרות',
    route: '/rentals',
    description: 'סריקת מסירה/החזרה של פריטים.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת (מ-2026-09-20): app/rentals/layout.js קורא ל-canOpenPage("page:rentals"). ברירת המחדל: פתוח לכל עובד מחובר; שורת הרשאה יכולה לשלול או להוסיף. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל עמוד ההשכרות וההחזרות. אם לא הוגדרה שורה — פתוח לכל עובד שמחובר. הנהלה ראשית ומתכנת תמיד נכנסים.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:customers',
    group: 'pages',
    label: 'לקוחות',
    route: '/customers',
    description: 'רשימת לקוחות וכרטיס לקוח.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת (מ-2026-09-20): app/customers/layout.js קורא ל-canOpenPage("page:customers"). ברירת המחדל: פתוח לכל עובד מחובר; שורת הרשאה יכולה לשלול או להוסיף. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל רשימת הלקוחות וכרטיס לקוח. אם לא הוגדרה שורה — פתוח לכל עובד שמחובר. הנהלה ראשית ומתכנת תמיד נכנסים.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:deliveries',
    group: 'pages',
    label: 'משלוחים',
    route: '/deliveries',
    description: 'ניהול והדפסת משלוחים.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת (מ-2026-09-20): app/deliveries/layout.js קורא ל-canOpenPage("page:deliveries"). ברירת המחדל: פתוח לכל עובד מחובר; שורת הרשאה יכולה לשלול או להוסיף. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל עמוד המשלוחים. אם לא הוגדרה שורה — פתוח לכל עובד שמחובר. הנהלה ראשית ומתכנת תמיד נכנסים.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:alterations',
    group: 'pages',
    label: 'תיקונים ומדידות',
    route: '/alterations',
    description: 'ניהול תיקוני תפירה.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת (מ-2026-09-20): app/alterations/layout.js קורא ל-canOpenPage("page:alterations"). ברירת המחדל: פתוח לכל עובד מחובר; שורת הרשאה יכולה לשלול או להוסיף. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל עמוד התיקונים והמדידות. אם לא הוגדרה שורה — פתוח לכל עובד שמחובר. הנהלה ראשית ומתכנת תמיד נכנסים.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:customer_interface',
    group: 'pages',
    label: 'מסך לקוחות (קיוסק)',
    route: '/customer-interface',
    description: 'מסך הדגמה עצמאי ללקוחות בעמדה פיזית.',
    type: 'boolean',
    enforced: false,
    notConfigurable: "עומד בפני עצמו ופועל בלי התחברות (מסך לקוחות בעמדה פיזית), לכן לא ניתן להגביל לפי מחלקה.", // hidden from the row wizard: nothing to configure
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    userNote: 'כרגע פתוח לכל עובד שמחובר.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:dashboard',
    group: 'pages',
    label: 'דשבורד',
    route: '/dashboard',
    description: 'גרפים ומגמות כלליות.',
    type: 'boolean',
    enforced: false,
    notConfigurable: "נעול להנהלה ראשית ומתכנת: מציג הכנסות וסטטיסטיקות כלליות.", // hidden from the row wizard: nothing to configure
    note: 'נשלט כרגע בתוך app/dashboard/page.js עצמו (לא ב-layout) — הנהלה ראשית/מתכנת (roleId 0/2) בלבד; אומת בבדיקה חיה ב-2026-09-20 (מנהל סניף, תופרת ומזכירה נחסמים).',
    userNote: 'כרגע רק הנהלה ראשית ומתכנת נכנסים לכאן.',
    defaultForRoleId: (roleId) => HEAD_MANAGEMENT.includes(roleId),
  },
  {
    key: 'page:employees_report',
    group: 'pages',
    label: 'דוח נוכחות עובדים',
    route: '/employees/report',
    description: 'סיכום שעות ונוכחות של כלל העובדים.',
    type: 'boolean',
    enforced: false,
    notConfigurable: "נעול להנהלה ראשית ומתכנת: הדוח נשען על נתוני שכר ונוכחות של כל העובדים.", // hidden from the row wizard: nothing to configure
    note: 'נשלט כרגע לפי app/employees/layout.js (העמוד יושב תחת /employees) — roleId 0/2 בלבד; ה-API שלו /api/employees/attendance נחסם באותו כלל מאז 2026-09-20.',
    userNote: 'כרגע רק הנהלה ראשית ומתכנת נכנסים לכאן.',
    defaultForRoleId: (roleId) => HEAD_MANAGEMENT.includes(roleId),
  },
  {
    key: 'page:messages',
    group: 'pages',
    label: 'הודעות פנימיות',
    route: '/messages',
    description: 'מערכת ההודעות הפנימית בין עובדים.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת (מ-2026-09-20): app/messages/layout.js קורא ל-canOpenPage("page:messages"). ברירת המחדל: פתוח לכל עובד מחובר; שורת הרשאה יכולה לשלול או להוסיף. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל ההודעות הפנימיות. אם לא הוגדרה שורה — פתוח לכל עובד שמחובר. הנהלה ראשית ומתכנת תמיד נכנסים.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:punch_clock',
    group: 'pages',
    label: 'שעון נוכחות',
    route: '/punch-clock',
    description: 'כניסה/יציאה ממשמרת.',
    type: 'boolean',
    enforced: false,
    notConfigurable: "פועל בלי התחברות (כל עובד מזדהה בסיסמה שלו), לכן לא ניתן להגביל לפי מחלקה.", // hidden from the row wizard: nothing to configure
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    userNote: 'כרגע פתוח לכל עובד שמחובר.',
    defaultForRoleId: () => true,
  },

  // ---------------------------------------------------------------------
  // Features — real, wired checks (enforced: true). Editing these from
  // /admin/permissions or an employee card takes effect immediately.
  // ---------------------------------------------------------------------
  {
    key: 'feature:ai',
    group: 'features',
    label: 'שימוש בבינה מלאכותית',
    description: 'חיפוש חכם, צ\'אט ואשף הדוחות עם בינה מלאכותית.',
    type: 'boolean',
    enforced: true,
    note: 'מיושם בשרת: checkAiAccess() ב-lib/permissions.js נקרא מכל הנתיבים תחת app/api/ai/** (מאז 2026-09-20; קודם רק הסתרת הרכיב ב-app/layout.js — עובד יכול היה לקרוא ל-API ישירות), וכן app/layout.js מסתיר את הרכיב לפי אותו כלל. הנהלה ראשית/מתכנת תמיד מורשים; אחרת קובעת חריגה פרטנית לעובד (מכרטיס העובד או משורת הרשאה, מוסיפה או שוללת), אחריה שורת המחלקה, אחריה ברירת המחדל. הרכיב ב-app/layout.js נקבע דרך resolvePageAccess (אותה החלטה). מתג המערכת hide_ai_features מכבה AI לכולם. (Employee.showAi לא נקרא יותר — הועבר לשורות חריגה ב-2026-09-20.)',
    userNote: 'קובע מי יכול להשתמש בבינה המלאכותית (החיפוש החכם, הצ\'אט ואשף הדוחות). הנהלה ראשית ומתכנת תמיד מורשים. אפשר להוסיף או לשלול גישה לעובד מסוים, גם מכרטיס העובד וגם משורת הרשאה.',
    defaultForRoleId: (roleId) => HEAD_MANAGEMENT.includes(roleId),
  },
  {
    key: 'feature:error_reports',
    group: 'features',
    label: 'דיווח על תקלות במערכת',
    description: 'הגשת דיווח תקלה חדש ומעקב אחריו.',
    type: 'boolean',
    enforced: true,
    note: 'מיושם ב-app/api/error-report/route.js. הרשאה פרטנית לעובד היא שורת חריגה רגילה (כרטיס עובד או שורת הרשאה; מוסיפה או שוללת) — Employee.canReportErrors לא נקרא יותר (הועבר ב-2026-09-20).',
    userNote: 'מי שמורשה יכול להגיש דיווח על תקלה ולעקוב אחריו. אפשר להוסיף או לשלול גישה לעובד מסוים, גם מכרטיס העובד וגם משורת הרשאה.',
    defaultForRoleId: (roleId) => [0, 1, 2].includes(roleId),
  },
  {
    key: 'feature:debt_approval',
    group: 'features',
    label: 'אישור הזמנות ללא תשלום מלא',
    description: 'לסיים או לשמור הזמנה שלא שולמה במלואה, בלי לבקש קוד אישור ממנהל.',
    type: 'boolean',
    enforced: true,
    note: 'מיושם ב-app/components/PopupProvider.js (בחירת המאשר), ב-app/api/auth/verify-pin/route.js (רמת האימות "מאשר הזמנה ללא תשלום") וב-canApproveDebt() ב-lib/permissions.js שנקרא מ-PUT /api/orders/[id] ומ-/api/orders/[id]/debt-approval לפני רישום המאשר. הנהלה ראשית/מתכנת תמיד מורשים; מנהל סניף (roleId 1) מורשה כברירת מחדל אבל שורת הרשאה יכולה לשלול זאת. השרת לא חוסם שמירת הזמנה לא-משולמת עצמה — רק מסרב לרשום מאשר שאינו מורשה.',
    userNote: 'קובע מי יכול לאשר הזמנה שלא שולמה במלואה בלי קוד ממנהל. הנהלה ראשית ומתכנת מורשים תמיד. מנהל סניף מורשה כברירת מחדל, ואפשר לשלול ממנו את זה בשורת הרשאה.',
    defaultForRoleId: (roleId) => MANAGER_TIER.includes(roleId),
  },
  {
    key: 'feature:export_max_rows',
    group: 'features',
    label: 'כמות שורות מרבית לייצוא בלי אישור מנהל',
    description: 'בייצוא לקבצים — מעל הכמות הזו נדרש קוד של מנהל.',
    type: 'number',
    enforced: true,
    note: 'מיושם ב-components/ExportButtons.js דרך /api/me. ערך זה קובע רק את הסף לפתיחת חלונית קוד המנהל — מי שיכול להזין את הקוד עצמו נשאר מנהל/מתכנת (roleId 1/2) בלי קשר לערך הזה.',
    userNote: 'מעל הכמות הזו נדרש קוד של מנהל כדי לייצא. מי שיכול להזין את הקוד נשאר מנהל סניף או מתכנת, בלי קשר לערך.',
    defaultForRoleId: () => 200,
  },
];

export function getCatalogItem(key) {
  return PERMISSION_CATALOG.find((item) => item.key === key) || null;
}

export function getCatalogGroup(group) {
  return PERMISSION_CATALOG.filter((item) => item.group === group);
}

// `settings` = { key: value } for the SystemSetting keys the item lists in `settingKeys`
// (refunds / dress catalog / monthly board defaults follow an org-level toggle).
export function defaultValueForRoleId(item, roleId, settings) {
  if (!item) return undefined;
  const raw = item.defaultForRoleId(roleId, settings);
  return item.type === 'boolean' ? !!raw : raw;
}
