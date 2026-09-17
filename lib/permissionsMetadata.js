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
//   note                what currently governs this (for enforced:false items) or
//                       where enforcement lives (for enforced:true items).
//   defaultForRoleId(roleId) → default value used when no explicit
//                       DepartmentPermission row exists yet for that department.
//                       Chosen to match today's real behavior exactly, so turning this
//                       system on changes nothing until an admin edits something.
//   legacyEmployeeField optional Employee column name. When set, a per-employee
//                       override for this key reads/writes that existing boolean
//                       column (Employee.showAi / Employee.canReportErrors) instead of
//                       a new EmployeePermissionOverride row — avoids a second,
//                       competing storage location for a flag that already exists and
//                       is already wired into other code paths. A legacy-field override
//                       can only grant access on top of the department default, not
//                       revoke it (matches how these two flags already behave today).

const HEAD_MANAGEMENT = [0, 2]; // הנהלה ראשית / מתכנת — mirrors lib/auth.js HEAD_MANAGEMENT_ROLES
const MANAGER_TIER = [1, 2];    // מנהל / מתכנת — mirrors lib/auth.js ROLE_LEVELS['מנהל']

export const PERMISSION_CATALOG = [
  // ---------------------------------------------------------------------
  // Pages — documented intent only in this phase (enforced: false). Real
  // access is still each page's own layout.js gate (see `note`). A future
  // migration replaces that gate's roleId array with a read from
  // lib/permissions.js and flips `enforced` to true, one page at a time.
  // ---------------------------------------------------------------------
  {
    key: 'page:admin',
    group: 'pages',
    label: 'אזור ניהול (/admin וכל תתי־הדפים שלו)',
    description: 'הגדרות מערכת, מחלקות, סטטיסטיקות, מחירון וכו\'.',
    type: 'boolean',
    enforced: false,
    note: 'נשלט כרגע לפי app/admin/layout.js — roleId 0/2 (הנהלה ראשית/מתכנת) בלבד.',
    defaultForRoleId: (roleId) => HEAD_MANAGEMENT.includes(roleId),
  },
  {
    key: 'page:employees',
    group: 'pages',
    label: 'ניהול עובדים (/employees)',
    description: 'רשימת עובדים, כרטיסי עובד, נוכחות.',
    type: 'boolean',
    enforced: false,
    note: 'נשלט כרגע לפי app/employees/layout.js — roleId 0/2 (הנהלה ראשית/מתכנת) בלבד.',
    defaultForRoleId: (roleId) => HEAD_MANAGEMENT.includes(roleId),
  },
  {
    key: 'page:refunds',
    group: 'pages',
    label: 'זיכויים (/refunds)',
    description: 'ביטולים והחזרים כספיים.',
    type: 'boolean',
    enforced: false,
    note: 'נשלט כרגע לפי app/refunds/layout.js — הנהלה ראשית/מתכנת, ולפעמים גם מנהל סניף (roleId 1), בהתאם להגדרת מערכת restrict_refunds_to_head_management.',
    defaultForRoleId: (roleId) => [0, 1, 2].includes(roleId),
  },
  {
    key: 'page:dresses_catalog',
    group: 'pages',
    label: 'קטלוג שמלות (/dashboard/dresses)',
    description: 'ניהול דגמים ופריטים.',
    type: 'boolean',
    enforced: false,
    note: 'נשלט כרגע לפי app/dashboard/dresses/layout.js — הנהלה ראשית/מתכנת כברירת מחדל, פתוח לכולם אם הגדרת המערכת restrict_dress_catalog_to_head_management כבויה.',
    defaultForRoleId: (roleId) => [0, 1, 2].includes(roleId),
  },
  {
    key: 'page:pricelist',
    group: 'pages',
    label: 'מחירון (/dashboard/pricelist)',
    description: 'הגדרת תעריפים וכללי תמחור.',
    type: 'boolean',
    enforced: false,
    note: 'נשלט כרגע לפי app/dashboard/pricelist/layout.js — roleId 0/2 (הנהלה ראשית/מתכנת) בלבד.',
    defaultForRoleId: (roleId) => HEAD_MANAGEMENT.includes(roleId),
  },
  {
    key: 'page:board',
    group: 'pages',
    label: 'לוח חודשי (/board)',
    description: 'תצוגת לוח שנה חודשית של הזמנות.',
    type: 'boolean',
    enforced: false,
    note: 'רק בסיידבר (app/layout.js) — הנהלה ראשית/מתכנת/מנהל כברירת מחדל, פתוח לכולם אם הגדרת המערכת restrict_board_to_managers כבויה. אין layout.js משלו שאוכף בשרת.',
    defaultForRoleId: (roleId) => [0, 1, 2].includes(roleId),
  },
  {
    key: 'page:home',
    group: 'pages',
    label: 'עמוד הבית (/)',
    description: 'קטלוג הדגמים והזמינות.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:orders',
    group: 'pages',
    label: 'רשימת הזמנות (/orders)',
    description: 'חיפוש ועריכת הזמנות קיימות.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:orders_new',
    group: 'pages',
    label: 'הזמנה חדשה (/orders/new)',
    description: 'פתיחת הזמנת השכרה חדשה.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:rentals',
    group: 'pages',
    label: 'השכרות והחזרות (/rentals)',
    description: 'סריקת מסירה/החזרה של פריטים.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:customers',
    group: 'pages',
    label: 'לקוחות (/customers)',
    description: 'רשימת לקוחות וכרטיס לקוח.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:deliveries',
    group: 'pages',
    label: 'משלוחים (/deliveries)',
    description: 'ניהול והדפסת משלוחים.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר כשהגדרת המערכת enable_deliveries דולקת (הגדרה גלובלית, לא לפי מחלקה).',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:alterations',
    group: 'pages',
    label: 'תיקונים/מדידות (/alterations)',
    description: 'ניהול תיקוני תפירה.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר כשהגדרת המערכת enable_alterations דולקת (הגדרה גלובלית, לא לפי מחלקה).',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:customer_interface',
    group: 'pages',
    label: 'מסך לקוחות/קיוסק (/customer-interface)',
    description: 'מסך הדגמה עצמאי ללקוחות בעמדה פיזית.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:dashboard',
    group: 'pages',
    label: 'דשבורד (/dashboard)',
    description: 'גרפים ומגמות כלליות.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:employees_report',
    group: 'pages',
    label: 'דוח נוכחות עובדים (/employees/report)',
    description: 'סיכום שעות ונוכחות של כלל העובדים.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:messages',
    group: 'pages',
    label: 'הודעות פנימיות (/messages)',
    description: 'מערכת ההודעות הפנימית בין עובדים.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    defaultForRoleId: () => true,
  },
  {
    key: 'page:punch_clock',
    group: 'pages',
    label: 'שעון נוכחות (/punch-clock)',
    description: 'כניסה/יציאה ממשמרת.',
    type: 'boolean',
    enforced: false,
    note: 'פתוח כיום לכל עובד מחובר, ללא בדיקת תפקיד.',
    defaultForRoleId: () => true,
  },

  // ---------------------------------------------------------------------
  // Features — real, wired checks (enforced: true). Editing these from
  // /admin/permissions or an employee card takes effect immediately.
  // ---------------------------------------------------------------------
  {
    key: 'feature:ai',
    group: 'features',
    label: 'שימוש בבינה מלאכותית (AI)',
    description: 'חיפוש AI, צ\'אט AI, ואשף הדוחות עם AI.',
    type: 'boolean',
    enforced: true,
    note: 'מיושם ב-app/layout.js (זמינות הרכיב) — בנוסף להנהלה ראשית/מתכנת שרואים AI תמיד. הרשאה פרטנית לעובד נשארת ב-Employee.showAi הקיים (ר\' כרטיס עובד) — יכולה רק להוסיף גישה, לא לשלול אותה.',
    defaultForRoleId: (roleId) => HEAD_MANAGEMENT.includes(roleId),
    legacyEmployeeField: 'showAi',
  },
  {
    key: 'feature:error_reports',
    group: 'features',
    label: 'דיווח על תקלות במערכת',
    description: 'הגשת דיווח תקלה חדש ומעקב אחריו.',
    type: 'boolean',
    enforced: true,
    note: 'מיושם ב-app/api/error-report/route.js. הרשאה פרטנית לעובד נשארת ב-Employee.canReportErrors הקיים (ר\' כרטיס עובד) — יכולה רק להוסיף גישה, לא לשלול אותה.',
    defaultForRoleId: (roleId) => [0, 1, 2].includes(roleId),
    legacyEmployeeField: 'canReportErrors',
  },
  {
    key: 'feature:debt_approval',
    group: 'features',
    label: 'אישור הזמנות ללא תשלום מלא',
    description: 'יציאה/שמירה של הזמנה עם חוב פתוח, בלי אישור PIN של מנהל בפועל.',
    type: 'boolean',
    enforced: true,
    note: 'מיושם ב-app/components/PopupProvider.js ו-app/api/auth/verify-pin/route.js, תחת רמת האימות "אישור הזמנה ללא תשלום מלא" — בנוסף למנהל/מתכנת (roleId 1/2) שמאושרים תמיד.',
    defaultForRoleId: (roleId) => MANAGER_TIER.includes(roleId),
  },
  {
    key: 'feature:export_max_rows',
    group: 'features',
    label: 'כמות שורות מרבית לייצוא בלי אישור מנהל',
    description: 'באשף היצוא (Excel/PDF) — מעבר לכמות הזו נדרש קוד מנהל.',
    type: 'number',
    enforced: true,
    note: 'מיושם ב-components/ExportButtons.js דרך /api/me. ערך זה קובע רק את הסף לפתיחת חלונית קוד המנהל — מי שיכול להזין את הקוד עצמו נשאר מנהל/מתכנת (roleId 1/2) בלי קשר לערך הזה.',
    defaultForRoleId: () => 200,
  },
];

export function getCatalogItem(key) {
  return PERMISSION_CATALOG.find((item) => item.key === key) || null;
}

export function getCatalogGroup(group) {
  return PERMISSION_CATALOG.filter((item) => item.group === group);
}

export function defaultValueForRoleId(item, roleId) {
  if (!item) return undefined;
  const raw = item.defaultForRoleId(roleId);
  return item.type === 'boolean' ? !!raw : raw;
}
