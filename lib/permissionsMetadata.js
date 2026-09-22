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
//   approver            optional true: an "approve with a password" action — this item decides who counts as
//                       a valid approver (see the comment above feature:reserve_rental_approval). Such an item
//                       also has approverLabel (the wording in the password window).
//   settingKeys         (no item uses it since 2026-09-22 - every default is closed; the machinery stays for a future item).
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

// Builds a password-approval item (see the comment above the first one in the catalog): boolean,
// enforced, approver:true, closed by default (head management / programmer are always allowed).
function approverItem({ key, label, description, approverLabel, note, userNote }) {
  return {
    key,
    group: 'features',
    label,
    description,
    type: 'boolean',
    enforced: true,
    approver: true,
    approverLabel,
    note,
    userNote,
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
  };
}

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
    note: 'נאכף בשרת: app/refunds/layout.js קורא ל-canOpenPage("page:refunds"). ברירת המחדל (מ-2026-09-22): רק הנהלה ראשית/מתכנת - כל גישה אחרת נקבעת בשורת הרשאה. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל זיכויים. אם לא הוגדרה שורה - רק הנהלה ראשית ומתכנת נכנסים; כל גישה אחרת נקבעת בשורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
  },
  {
    key: 'page:dresses_catalog',
    group: 'pages',
    label: 'קטלוג שמלות',
    route: '/dashboard/dresses',
    description: 'ניהול דגמים ופריטים.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת: app/dashboard/dresses/layout.js קורא ל-canOpenPage("page:dresses_catalog"). ברירת המחדל (מ-2026-09-22): רק הנהלה ראשית/מתכנת - כל גישה אחרת נקבעת בשורת הרשאה. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל קטלוג שמלות. אם לא הוגדרה שורה - רק הנהלה ראשית ומתכנת נכנסים; כל גישה אחרת נקבעת בשורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
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
    note: 'נאכף בשרת: app/board/layout.js קורא ל-canOpenPage("page:board"). ברירת המחדל (מ-2026-09-22): רק הנהלה ראשית/מתכנת - כל גישה אחרת נקבעת בשורת הרשאה. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל לוח חודשי. אם לא הוגדרה שורה - רק הנהלה ראשית ומתכנת נכנסים; כל גישה אחרת נקבעת בשורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
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
    note: 'נאכף בשרת: app/orders/layout.js קורא ל-canOpenPage("page:orders"). ברירת המחדל (מ-2026-09-22): רק הנהלה ראשית/מתכנת - כל גישה אחרת נקבעת בשורת הרשאה. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל רשימת הזמנות. אם לא הוגדרה שורה - רק הנהלה ראשית ומתכנת נכנסים; כל גישה אחרת נקבעת בשורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
  },
  {
    key: 'page:orders_new',
    group: 'pages',
    label: 'הזמנה חדשה',
    route: '/orders/new',
    description: 'פתיחת הזמנת השכרה חדשה.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת: app/orders/layout.js קורא ל-canOpenPage("page:orders_new"). ברירת המחדל (מ-2026-09-22): רק הנהלה ראשית/מתכנת - כל גישה אחרת נקבעת בשורת הרשאה. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל הזמנה חדשה. אם לא הוגדרה שורה - רק הנהלה ראשית ומתכנת נכנסים; כל גישה אחרת נקבעת בשורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
  },
  {
    key: 'page:rentals',
    group: 'pages',
    label: 'השכרות והחזרות',
    route: '/rentals',
    description: 'סריקת מסירה/החזרה של פריטים.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת: app/rentals/layout.js קורא ל-canOpenPage("page:rentals"). ברירת המחדל (מ-2026-09-22): רק הנהלה ראשית/מתכנת - כל גישה אחרת נקבעת בשורת הרשאה. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל השכרות והחזרות. אם לא הוגדרה שורה - רק הנהלה ראשית ומתכנת נכנסים; כל גישה אחרת נקבעת בשורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
  },
  {
    key: 'page:customers',
    group: 'pages',
    label: 'לקוחות',
    route: '/customers',
    description: 'רשימת לקוחות וכרטיס לקוח.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת: app/customers/layout.js קורא ל-canOpenPage("page:customers"). ברירת המחדל (מ-2026-09-22): רק הנהלה ראשית/מתכנת - כל גישה אחרת נקבעת בשורת הרשאה. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל לקוחות. אם לא הוגדרה שורה - רק הנהלה ראשית ומתכנת נכנסים; כל גישה אחרת נקבעת בשורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
  },
  {
    key: 'page:deliveries',
    group: 'pages',
    label: 'משלוחים',
    route: '/deliveries',
    description: 'ניהול והדפסת משלוחים.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת: app/deliveries/layout.js קורא ל-canOpenPage("page:deliveries"). ברירת המחדל (מ-2026-09-22): רק הנהלה ראשית/מתכנת - כל גישה אחרת נקבעת בשורת הרשאה. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל משלוחים. אם לא הוגדרה שורה - רק הנהלה ראשית ומתכנת נכנסים; כל גישה אחרת נקבעת בשורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
  },
  {
    key: 'page:alterations',
    group: 'pages',
    label: 'תיקונים ומדידות',
    route: '/alterations',
    description: 'ניהול תיקוני תפירה.',
    type: 'boolean',
    enforced: true,
    note: 'נאכף בשרת: app/alterations/layout.js קורא ל-canOpenPage("page:alterations"). ברירת המחדל (מ-2026-09-22): רק הנהלה ראשית/מתכנת - כל גישה אחרת נקבעת בשורת הרשאה. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל תיקונים ומדידות. אם לא הוגדרה שורה - רק הנהלה ראשית ומתכנת נכנסים; כל גישה אחרת נקבעת בשורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
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
    note: 'נאכף בשרת: app/messages/layout.js קורא ל-canOpenPage("page:messages"). ברירת המחדל (מ-2026-09-22): רק הנהלה ראשית/מתכנת - כל גישה אחרת נקבעת בשורת הרשאה. התפריט הצדדי מציג את הקישור לפי אותה החלטה.',
    userNote: 'קובע מי נכנס אל הודעות פנימיות. אם לא הוגדרה שורה - רק הנהלה ראשית ומתכנת נכנסים; כל גישה אחרת נקבעת בשורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
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
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
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
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
  },
  {
    key: 'feature:debt_approval',
    group: 'features',
    label: 'אישור הזמנות ללא תשלום מלא',
    description: 'לסיים או לשמור הזמנה שלא שולמה במלואה, בלי לבקש קוד אישור ממנהל.',
    type: 'boolean',
    enforced: true,
    note: 'מיושם ב-app/components/PopupProvider.js (בחירת המאשר), ב-app/api/auth/verify-pin/route.js (רמת האימות "מאשר הזמנה ללא תשלום") וב-canApproveDebt() ב-lib/permissions.js שנקרא מ-PUT /api/orders/[id] ומ-/api/orders/[id]/debt-approval לפני רישום המאשר. אותה הרשאה משמשת גם את עמוד הזיכויים (app/refunds/page.js: אישור/ביטול אישור חוב) - שני המסלולים מגיעים לאותו שרת. הנהלה ראשית/מתכנת תמיד מורשים; כל השאר נקבע בשורת הרשאה (ברירת המחדל מ-2026-09-22: סגור). השרת לא חוסם שמירת הזמנה לא-משולמת עצמה — רק מסרב לרשום מאשר שאינו מורשה.',
    userNote: 'קובע מי יכול לאשר הזמנה שלא שולמה במלואה בלי קוד ממנהל, וגם לאשר או לבטל אישור חוב בעמוד הזיכויים. הנהלה ראשית ומתכנת מורשים תמיד; כל אחד אחר לפי שורת הרשאה.',
    defaultForRoleId: () => false, // closed by default since 2026-09-22 - access comes from permission rows
  },

  // ---- "מי רשאי לאשר": כל פעולה שמבקשת סיסמה של מאשר (חלון "אימות הרשאה", ר' PopupProvider.js) ----
  // approver:true + approverLabel. הפריט קובע מי נחשב מאשר תקף - אותה החלטה בבורר העובדים בלקוח
  // (approvals ב-GET /api/employees), ב-/api/auth/verify-pin (requiredLevel = מפתח הפריט) ובשרת עצמו
  // כשיש שם בדיקה. מתגי ההפעלה (האם בכלל נדרש אישור) נשארים הגדרות מערכת גלובליות; כאן רק "מי".
  // ברירת המחדל של כולם סגורה (הנהלה ראשית ומתכנת תמיד מורשים) - כל גישה אחרת מגיעה משורות הרשאה.
  approverItem({
    key: 'feature:reserve_rental_approval',
    label: 'אישור השכרת שמלה מהרזרבה',
    description: 'לאשר בסיסמה השכרה של שמלה שמסומנת "רזרבה" ולכן חסומה להשכרה.',
    approverLabel: 'מאשר השכרת רזרבה',
    note: 'נאכף ב-app/api/rentals/scan/route.js (חסימת רזרבה טהורה בלבד) ובבורר המאשר ב-components/orders/RentalReturnModal.js. ההתראה הפנימית למנהלים נשלחת כשהמאשר אינו מנהל סניף/הנהלה ראשית/מתכנת. עד 2026-09-22 נקבע לפי ההגדרה allow_shift_lead_reserve_rental (הוסתרה מדף ההגדרות).',
    userNote: 'קובע מי יכול לאשר בסיסמה השכרה של שמלה שמסומנת "רזרבה". שמלה שמסומנת "מחסן" נשלטת בהרשאה נפרדת.',
  }),
  approverItem({
    key: 'feature:warehouse_rental_approval',
    label: 'אישור השכרת שמלה מהמחסן',
    description: 'לאשר בסיסמה השכרה של שמלה שמסומנת "מחסן" ולכן חסומה להשכרה.',
    approverLabel: 'מאשר השכרת מחסן',
    note: 'נאכף ב-app/api/rentals/scan/route.js (חסימת מחסן, או מחסן+רזרבה יחד) ובבורר המאשר ב-components/orders/RentalReturnModal.js. עד 2026-09-22 היה קשיח: roleId 1/2.',
    userNote: 'קובע מי יכול לאשר בסיסמה השכרה של שמלה שמסומנת "מחסן". שמלה שמסומנת "רזרבה" נשלטת בהרשאה נפרדת.',
  }),
  approverItem({
    key: 'feature:payment_exit_approval',
    label: 'אישור יציאה מהזמנה חדשה בלי תשלום מלא',
    description: 'לאשר בסיסמה סיום הזמנה חדשה בלי גביית תשלום, או תשלום שאינו מכסה את כל הסכום (חוץ מאשראי).',
    approverLabel: 'מאשר תשלום חלקי',
    note: 'נאכף ב-app/orders/new/page.js (הבורר והאימות ב-/api/auth/verify-pin עם requiredLevel="feature:payment_exit_approval"). החלונית נפתחת רק כשהגדרת המערכת PAYMENT_APPROVAL_LEVEL אינה "כולם" - ההגדרה נשארה מתג הפעלה בלבד ואינה קובעת עוד מי מאשר. הזמנה קיימת נשלטת ב-feature:debt_approval.',
    userNote: 'קובע מי יכול לאשר בסיסמה סיום של הזמנה חדשה בלי תשלום מלא. החלונית מופיעה רק כשבהגדרות המערכת "רמת אישור ליציאה מהזמנה בלי תשלום מלא" אינה "כולם". הזמנה שכבר קיימת נשלטת בהרשאה "אישור הזמנות ללא תשלום מלא".',
  }),
  approverItem({
    key: 'feature:item_change_approval',
    label: 'אישור ביטול או הוספת פריט בהזמנה קיימת',
    description: 'לאשר בסיסמה ביטול פריט או הוספת פריט חדש להזמנה שכבר נשמרה.',
    approverLabel: 'מאשר שינוי פריטים',
    note: 'נאכף בשרת ב-PUT /api/orders/[id] וב-POST /api/orders/[id]/items דרך verifyManagerPin(..., "feature:item_change_approval") ב-lib/managerAuth.js, ובבורר המאשר ב-app/orders/[id]/page.js וב-components/orders/modern/ModernItemsManager.js. האישור נדרש רק כשהגדרת המערכת require_manager_code_for_item_changes מופעלת.',
    userNote: 'קובע מי יכול לאשר בסיסמה ביטול פריט או הוספת פריט חדש להזמנה שכבר נשמרה. האישור נדרש רק כשבהגדרות המערכת מופעל "דרוש קוד מנהל לביטול/הוספת פריט".',
  }),
  approverItem({
    key: 'feature:barcode_mismatch_override',
    label: 'אישור השכרה של ברקוד שלא תואם להזמנה',
    description: 'לאשר בסיסמה השכרת שמלה שהדגם או המידה שלה שונים ממה שהוזמן.',
    approverLabel: 'מאשר ברקוד שלא תואם',
    note: 'נאכף ב-lib/rentalBarcodeGuard.js (verifyManagerOverride) ובבורר המאשר ב-components/orders/RentalReturnModal.js וב-components/orders/modern/rentalToggle.js. פועל רק כשהגדרת המערכת enforce_rental_barcode_match מופעלת.',
    userNote: 'קובע מי יכול לאשר בסיסמה השכרה של שמלה שהדגם או המידה שלה לא תואמים למה שהוזמן. הבדיקה פעילה רק כשבהגדרות המערכת מופעל "חסום השכרה של ברקוד שלא תואם".',
  }),
  approverItem({
    key: 'feature:unpaid_action_items_tab',
    label: 'אישור השכרה/החזרה בלי תשלום מלא (טאב הפריטים)',
    description: 'לאשר בסיסמה סימון פריט כהושכר/הוחזר מתוך טאב הפריטים בכרטיס הזמנה שלא שולמה במלואה.',
    approverLabel: 'מאשר פעולה ללא תשלום מלא',
    note: 'components/orders/modern/ModernItemsManager.js (סריקה, השכרה, החזרה). עד 2026-09-22 קשיח: roleId 1/2 (רמת "מנהל"). שימו לב: הטאב "השכרות" באותו כרטיס נשלט בהרשאה נפרדת (feature:unpaid_action_rentals_tab) - כך היה גם קודם.',
    userNote: 'קובע מי יכול לאשר בסיסמה השכרה או החזרה של פריט מטאב הפריטים בכרטיס הזמנה שעדיין לא שולמה במלואה. הטאב "השכרות" בכרטיס נשלט בהרשאה נפרדת.',
  }),
  approverItem({
    key: 'feature:unpaid_action_rentals_tab',
    label: 'אישור השכרה/החזרה בלי תשלום מלא (טאב ההשכרות)',
    description: 'לאשר בסיסמה סריקת השכרה או החזרה בטאב ההשכרות בכרטיס הזמנה שלא שולמה במלואה.',
    approverLabel: 'מאשר פעולה ללא תשלום מלא',
    note: 'components/orders/modern/ModernRentalsManager.js. עד 2026-09-22 קשיח: רמת "עובד" (כל עובד פעיל מזדהה בסיסמה שלו).',
    userNote: 'קובע מי יכול לאשר בסיסמה סריקת השכרה או החזרה בטאב "השכרות" בכרטיס הזמנה שעדיין לא שולמה במלואה. טאב הפריטים בכרטיס נשלט בהרשאה נפרדת.',
  }),
  approverItem({
    key: 'feature:item_edit_reopen',
    label: 'פתיחה מחדש של עריכת פריט אחרי 15 דקות',
    description: 'לאשר בסיסמה עריכה מלאה (דגם/מידה/תיקונים) של פריט בהזמנה קיימת אחרי שחלון העריכה הראשוני נסגר.',
    approverLabel: 'מאשר עריכת פריט',
    note: 'components/orders/modern/ModernItemsManager.js (handleReopenFullEdit). עד 2026-09-22 קשיח: roleId 1/2.',
    userNote: 'קובע מי יכול לפתוח מחדש לעריכה מלאה פריט בהזמנה קיימת אחרי שחלון ה-15 דקות הראשוני נסגר.',
  }),
  approverItem({
    key: 'feature:locked_order_edit',
    label: 'עריכת הזמנה שתאריך האירוע שלה עבר',
    description: 'לאשר בסיסמה פתיחה לעריכה של הזמנה שננעלה כי תאריך האירוע עבר.',
    approverLabel: 'מאשר עריכת הזמנה נעולה',
    note: 'app/orders/[id]/page.js (handleUnlock). עד 2026-09-22 קשיח: roleId 1/2.',
    userNote: 'קובע מי יכול לאשר בסיסמה עריכה של הזמנה שתאריך האירוע שלה כבר עבר.',
  }),
  approverItem({
    key: 'feature:special_spacing_approval',
    label: 'שינוי ציפוף ימים מיוחד בהזמנה',
    description: 'לאשר בסיסמה שינוי ריווח (ציפוף) ימים מותאם אישית בין השכרות בהזמנה.',
    approverLabel: 'מאשר ציפוף ימים',
    note: 'app/orders/new/page.js ו-components/orders/modern/ModernGeneralDetails.js. עד 2026-09-22 קשיח: roleId 1/2.',
    userNote: 'קובע מי יכול לאשר בסיסמה שינוי של ציפוף ימים מיוחד בהזמנה.',
  }),
  approverItem({
    key: 'feature:past_date_order_approval',
    label: 'שמירת הזמנה חדשה לתאריך שעבר',
    description: 'לאשר בסיסמה שמירת הזמנה חדשה שתאריך האירוע שלה כבר חלף.',
    approverLabel: 'מאשר תאריך שעבר',
    note: 'app/orders/new/page.js. עד 2026-09-22 קשיח: roleId 1/2.',
    userNote: 'קובע מי יכול לאשר בסיסמה שמירת הזמנה חדשה לתאריך שכבר עבר.',
  }),
  approverItem({
    key: 'feature:missing_contact_approval',
    label: 'המשך הזמנה ללקוח בלי אמצעי תקשורת נוסף',
    description: 'לאשר בסיסמה פתיחת הזמנה ללקוח שחסר לו טלפון נוסף או כתובת מייל.',
    approverLabel: 'מאשר חוסר בפרטי קשר',
    note: 'app/orders/new/page.js (לקוח חדש ולקוח קיים). עד 2026-09-22 קשיח: roleId 1/2.',
    userNote: 'קובע מי יכול לאשר בסיסמה המשך הזמנה ללקוח שחסר לו טלפון נוסף או כתובת מייל.',
  }),
  approverItem({
    key: 'feature:customer_email_approval',
    label: 'שליחת מייל ללקוח מכרטיס הלקוח או ההזמנה',
    description: 'לאשר בסיסמה שליחת מייל מהיר ללקוח.',
    approverLabel: 'מאשר שליחת מייל',
    note: 'app/customers/[id]/page.js, components/orders/modern/ModernGeneralDetails.js ובשרת POST /api/send-email (שם היה קשיח: roleId 1/2).',
    userNote: 'קובע מי יכול לאשר בסיסמה שליחת מייל מהיר ללקוח.',
  }),
  approverItem({
    key: 'feature:export_over_limit_approval',
    label: 'אישור ייצוא מעל הכמות המרבית',
    description: 'לאשר בסיסמה ייצוא לקובץ של יותר שורות מהמותר בלי אישור.',
    approverLabel: 'מאשר ייצוא',
    note: 'components/ExportButtons.js. הסף עצמו הוא feature:export_max_rows. עד 2026-09-22 קשיח: roleId 1/2.',
    userNote: 'קובע מי יכול לאשר בסיסמה ייצוא של יותר שורות מהכמות המרבית המותרת בלי אישור.',
  }),
  {
    key: 'feature:export_max_rows',
    group: 'features',
    label: 'כמות שורות מרבית לייצוא בלי אישור מנהל',
    description: 'בייצוא לקבצים — מעל הכמות הזו נדרש קוד של מאשר (ההרשאה "אישור ייצוא מעל הכמות המרבית").',
    type: 'number',
    enforced: true,
    note: 'מיושם ב-components/ExportButtons.js דרך /api/me. ערך זה קובע רק את הסף לפתיחת חלונית הקוד — מי שיכול להזין את הקוד נקבע בהרשאה feature:export_over_limit_approval.',
    userNote: 'מעל הכמות הזו נדרש קוד של מאשר כדי לייצא. מי שרשאי לאשר נקבע בהרשאה "אישור ייצוא מעל הכמות המרבית".',
    defaultForRoleId: () => 200,
  },
];

export function getCatalogItem(key) {
  return PERMISSION_CATALOG.find((item) => item.key === key) || null;
}

// Every catalog item that is a password-approval action (GET /api/employees returns each employee's
// resolved value per key as `approvals`, and PopupProvider's employee picker filters by it).
export function getApproverKeys() {
  return PERMISSION_CATALOG.filter((item) => item.approver).map((item) => item.key);
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
