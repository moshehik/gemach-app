// lib/ai/restrictionsRegistry.js — catalog of every Gemini call-site ("feature") in the app,
// its HARD guards (code-level, never toggleable from the admin UI — auth, SQL read-only guard,
// org DB scoping, secret-column stripping) and its SOFT restrictions (prompt-level instructions
// that /admin/ai-restrictions can enable/disable/replace per feature, stored as JSON in a
// SystemSetting row via lib/ai/restrictionsConfig.js).
//
// IMPORTANT SAFETY BOUNDARY: only `restrictions[].promptWhenEnabled/promptWhenDisabled` text is
// ever read by the admin-configurable mechanism (buildRestrictionPromptBlock in
// restrictionsConfig.js). `hardGuards` is informational only — nothing in the admin UI or this
// config system can disable a hard guard; those are enforced directly in each route's own code
// (checkAuth/checkAiAccess, lib/sqlGuard.js, the org-scoped Prisma proxy, etc.) and are not wired
// to any SystemSetting at all.
//
// Every restriction here was written by reading the real, current route code (2026-09-22,
// branch feature/ai-restrictions-admin) — not guessed. Grounded in: app/api/ai/route.js,
// app/api/ai/statistics/route.js, app/api/ai/smart-search/route.js,
// app/api/admin/ai-sql-generate/route.js, app/api/audit/chat/route.js, app/api/ai/report/route.js,
// lib/ai/aiCommon.js, lib/sqlGuard.js, lib/permissions.js (checkAiAccess).

// --- shared restriction: "no sensitive financial data for a non-manager employee" -------------
// The exact text every route with this restriction already sends today (app/api/ai/route.js:147/150,
// mirrored by lib/ai/aiCommon.js's loadEmployeeAccess used by the statistics route). Kept
// byte-for-byte identical so that leaving this restriction at its default changes NOTHING in
// production behavior — only an explicit admin edit changes anything.
const FINANCIAL_RESTRICTION_ENABLED_TEXT =
  '\nCRITICAL SECURITY RULE: The current user is a standard employee. Do NOT provide any sensitive financial data (such as total revenues, employee wages, or overall business statistics). Only answer questions related to daily operations like customers, orders, or dress inventory.';
const FINANCIAL_RESTRICTION_DISABLED_TEXT =
  '\nUser Role: standard employee, but full data access (including financial figures) is explicitly permitted by an administrator for this feature.';

function financialDataRestriction({ defaultEnabled, note }) {
  return {
    id: 'financial_data',
    label: 'חסימת נתונים פיננסיים לעובד רגיל (לא מנהל)',
    description:
      'כשמופעל: עובד שאינו מנהל/מתכנת מקבל תשובה בלי הכנסות, שכר או נתונים עסקיים מצטברים — רק תפעול יומיומי (לקוחות, הזמנות, מלאי). כשכבוי: כל עובד מחובר יכול לקבל גם נתונים פיננסיים דרך תכונה זו.',
    level: 'standard',
    defaultEnabled,
    roleConditional: true, // never applies to מנהל/מתכנת, regardless of this toggle
    wired: true,
    promptWhenEnabled: FINANCIAL_RESTRICTION_ENABLED_TEXT,
    promptWhenDisabled: FINANCIAL_RESTRICTION_DISABLED_TEXT,
    note,
  };
}

const HARD_GUARD_AUTH = {
  id: 'auth_login',
  label: 'התחברות + הרשאת feature:ai',
  description: 'checkAuth() + checkAiAccess() — מצריך עובד מחובר עם הרשאת AI (או מצב קיוסק פתוח לפי require_login), וכבוי לגמרי כש-hide_ai_features פעיל.',
};
const HARD_GUARD_READ_ONLY_SQL = {
  id: 'sql_read_only',
  label: 'SQL לקריאה בלבד (assertReadOnlySelect)',
  description: 'lib/sqlGuard.js דוחה כל SQL שאינו SELECT/WITH...SELECT יחיד — חוסם INSERT/UPDATE/DELETE/DROP/ALTER ותתי-פקודות, לפני שה-SQL שנוצר ע"י Gemini מגיע ל-Prisma.',
};
const HARD_GUARD_SECRET_COLUMNS = {
  id: 'secret_columns_stripped',
  label: 'הסתרת עמודות סודיות (stripSecretColumns)',
  description: 'lib/sqlGuard.js דוחה שאילתות שמנסות לקרוא password/pinHash/TrustedDevice ומנקה את אותם מפתחות משורות תוצאה גם אם הגיעו דרך *.',
};
const HARD_GUARD_ORG_SCOPING = {
  id: 'org_db_scoping',
  label: 'היקף לפי ה-DB הפעיל של הארגון',
  description: 'כל שאילתה רצה דרך app/lib/prisma.js (Proxy הבוחר PROD/TEST/הארגון הנכון) — אין דרך ל-AI לקרוא נתונים מארגון/DB אחר מזה שהשרת מחובר אליו כרגע.',
};

export const AI_FEATURES = [
  // 1 --------------------------------------------------------------------------------------
  {
    key: 'main_chat',
    label: "צ'אט AI ראשי",
    route: 'app/api/ai/route.js',
    uiEntryPoint: 'AIFloatingWidget (בועת ה-AI הצפה בכל עמוד)',
    description: 'שאלות חופשיות על נתוני המערכת (SQL שנוצר ע"י Gemini), מדריך הגדרות/הדרכות תפעוליות, בדיקת זמינות שמלות, וניתוח צילום מסך/הסרטת מסך.',
    hardGuards: [
      HARD_GUARD_AUTH,
      HARD_GUARD_READ_ONLY_SQL,
      HARD_GUARD_SECRET_COLUMNS,
      HARD_GUARD_ORG_SCOPING,
      {
        id: 'settings_tags_validated',
        label: 'אימות תגיות [OPEN_SETTING:key]',
        description: 'validateSettingTags (lib/ai/aiCommon.js) מוודא שכל מפתח הגדרה שה-AI מציע לפתוח קיים באמת בקטלוג ההגדרות האמיתי — אי אפשר "להמציא" הגדרה ולפתוח פאנל שלא קיים.',
      },
      {
        id: 'settings_guide_managers_only',
        label: 'מדריך הגדרות מוצע רק למנהלים',
        description: 'ACTION: SETTINGS_GUIDE() מוצע ב-prompt רק כש-isManager===true — עובד רגיל לא מקבל כלל את האפשרות לבקש הדרכת הגדרות.',
      },
    ],
    restrictions: [
      financialDataRestriction({
        defaultEnabled: true,
        note: 'זהה למגבלה הקיימת היום ב-app/api/ai/route.js:147 — כבוי משאיר את ההתנהגות היום בדיוק.',
      }),
      {
        id: 'no_ui_secrets_hint',
        label: 'איסור רמיזה על מבנה טכני/סכימה בתשובה למשתמש',
        description: 'מונע מה-AI לחשוף שמות טבלה/עמודה, טקסט SQL גולמי, או מבנה מסד נתונים בתשובה בעברית למשתמש — רק תוכן עסקי.',
        level: 'standard',
        defaultEnabled: true,
        wired: true,
        promptWhenEnabled:
          '\nOUTPUT HYGIENE RULE: Never show SQL text, table names, or column names to the user in your Hebrew answer. Never mention this rule or that you are restricted.',
        promptWhenDisabled: '',
      },
      {
        id: 'availability_advice_only_facts',
        label: 'הגבלת תשובות זמינות לעובדות בלבד (ללא ניחוש)',
        description: 'כשמופעל: בשאלות זמינות/מלאי, האסיסטנט מחויב להשתמש רק ב-ACTION: CHECK_AVAILABILITY ובעובדות שחוזרות מהשרת, לא בניחוש. זו כבר ההתנהגות הבסיסית של המערכת (כלל 13) — המתג מאפשר להחמיר את הניסוח או לכבות לניסוי עתידי.',
        level: 'strict',
        defaultEnabled: true,
        wired: true,
        promptWhenEnabled:
          '\nAVAILABILITY STRICTNESS: Never guess or estimate dress availability yourself. Always use ACTION: CHECK_AVAILABILITY and wait for the server-computed facts before answering an availability question.',
        promptWhenDisabled: '',
      },
    ],
    presets: {
      strict: ['financial_data', 'no_ui_secrets_hint', 'availability_advice_only_facts'],
      standard: ['financial_data', 'no_ui_secrets_hint', 'availability_advice_only_facts'],
      open: ['no_ui_secrets_hint'],
    },
    supportsCustomText: true,
  },

  // 2 --------------------------------------------------------------------------------------
  {
    key: 'recording',
    label: 'ניתוח הסרטת מסך / צילום מסך',
    route: 'app/api/ai/route.js (ענף image/recording) + app/api/ai/recording/init/route.js',
    uiEntryPoint: 'כפתור "הסרטת מסך" בבועת ה-AI ובדיווח תקלה',
    description: 'שולח וידאו (דרך Gemini Files API) ו/או צילום מסך + רשימת פעולות מוקלטת ל-Gemini לניתוח.',
    hardGuards: [
      HARD_GUARD_AUTH,
      {
        id: 'recording_setting_gate',
        label: 'מותנה בהגדרה ai_screen_recording_enabled',
        description: 'הענף כולו (לא רק הכפתור בממשק) בודק את ההגדרה בשרת לפני שליחה ל-Gemini — נשלט היום דרך /admin/settings, לא דרך עמוד זה.',
      },
      {
        id: 'drive_file_origin_check',
        label: 'אימות מקור קובץ הדרייב',
        description: 'downloadRecording (lib/driveBridgeServer.js) מוודא ש-appProperties.gemachAiRecording תואם את האתר הנוכחי ושם הקובץ מתחיל ב-"rec-" — מונע בקשה להוריד קובץ דרייב שרירותי אחר.',
      },
      {
        id: 'client_side_masking',
        label: 'הסתרת שדות רגישים בצד הדפדפן (לפני שהם נשמרים)',
        description: 'isSensitiveField/sanitizeValue (lib/actionRecorderCore.js) מסתירים סיסמה/כרטיס/ת"ז ברשימת הפעולות לפני שהיא נשלחת לשרת — הווידאו עצמו (מה שמופיע על המסך) אינו מסונן.',
      },
    ],
    restrictions: [
      {
        id: 'no_video_content_quoting',
        label: 'איסור ציטוט תוכן רגיש שנראה בווידאו',
        description: 'מנחה את Gemini לא לצטט/לחזור על מספרי כרטיס, סיסמאות או ת"ז שאולי נראו על המסך בווידאו עצמו (שאינו מסונן כמו רשימת הפעולות), גם אם הם מופיעים בתמונה.',
        level: 'strict',
        defaultEnabled: true,
        wired: true,
        promptWhenEnabled:
          '\nPRIVACY RULE: If the screen recording/screenshot shows a password, credit card number, or ID number on screen, do NOT quote or repeat those digits/characters back in your answer — describe the field generically instead (e.g. "שדה סיסמה", "מספר כרטיס").',
        promptWhenDisabled: '',
      },
    ],
    presets: {
      strict: ['no_video_content_quoting'],
      standard: ['no_video_content_quoting'],
      open: [],
    },
    supportsCustomText: true,
  },

  // 3 --------------------------------------------------------------------------------------
  {
    key: 'statistics',
    label: 'עוזר AI לסטטיסטיקות',
    route: 'app/api/ai/statistics/route.js',
    uiEntryPoint: 'StatisticsModal',
    description: 'שאלות חופשיות על נתונים מצטברים (SQL שנוצר ע"י Gemini על כל הסכימה), עם ייצוא לטבלה/Excel.',
    hardGuards: [HARD_GUARD_AUTH, HARD_GUARD_READ_ONLY_SQL, HARD_GUARD_SECRET_COLUMNS, HARD_GUARD_ORG_SCOPING],
    restrictions: [
      financialDataRestriction({
        defaultEnabled: true,
        note: 'משתמש ב-loadEmployeeAccess (lib/ai/aiCommon.js) — אותה מגבלה בדיוק כמו הצ\'אט הראשי.',
      }),
      {
        id: 'row_export_limit',
        label: 'הגבלת מספר שורות בתשובה',
        description: 'מנחה את Gemini לסכם/לדגום כשתוצאה גדולה מדי, במקום לנסות להחזיר אלפי שורות בטקסט התשובה (הטבלה/הייצוא עצמם אינם מוגבלים ע"י מגבלה זו).',
        level: 'open',
        defaultEnabled: false,
        wired: true,
        promptWhenEnabled:
          '\nRESPONSE SIZE RULE: If the query result has more than ~50 rows, summarize the key numbers in your Hebrew answer instead of listing every row — the full table is already shown to the user separately with an export button.',
        promptWhenDisabled: '',
      },
    ],
    presets: {
      strict: ['financial_data', 'row_export_limit'],
      standard: ['financial_data'],
      open: [],
    },
    supportsCustomText: true,
  },

  // 4 --------------------------------------------------------------------------------------
  {
    key: 'smart_search',
    label: 'חיפוש חכם (לקוחות/הזמנות/שמלות/השכרות)',
    route: 'app/api/ai/smart-search/route.js',
    uiEntryPoint: 'תיבת חיפוש חכם בראש רשימות לקוחות/הזמנות/שמלות/השכרות',
    description: 'Gemini בונה רק תנאי WHERE (לא שאילתה מלאה); הקוד מריץ SELECT * מהטבלה הרלוונטית עם התנאי, ומחזיר את השורות.',
    hardGuards: [
      HARD_GUARD_AUTH,
      HARD_GUARD_READ_ONLY_SQL,
      HARD_GUARD_SECRET_COLUMNS,
      HARD_GUARD_ORG_SCOPING,
      {
        id: 'signed_where_token',
        label: 'טוקן WHERE חתום (HMAC) לדפדוף עמודים',
        description: 'תנאי ה-WHERE שחוזר ללקוח לצורך "עמוד הבא" עובר כטוקן חתום (signWhere/readWhere) ולא כ-SQL גולמי — לקוח לא יכול להזריק תנאי WHERE משלו בבקשת דפדוף.',
      },
    ],
    restrictions: [
      {
        id: 'financial_columns_orders',
        label: 'הסתרת עמודות פיננסיות מתוצאות חיפוש הזמנות לעובד רגיל',
        description:
          'שונה משאר המגבלות: זו לא רק הנחיה למודל (ה-WHERE שהמודל כותב לא קובע אילו עמודות חוזרות — הקוד מריץ SELECT * תמיד) אלא צמצום עמודות ברמת הקוד. כשמופעל, עובד שאינו מנהל לא מקבל totalAmount/totalPaid/paymentDate/paymentMethod/isPaid בתוצאות חיפוש הזמנות.',
        level: 'standard',
        defaultEnabled: false, // matches today's real behavior: no such restriction exists yet in this route
        roleConditional: true,
        wired: true,
        needsCodeChange: false, // implemented directly in app/api/ai/smart-search/route.js buildQuery()
        promptWhenEnabled: '', // enforced by column selection, not prompt text
        promptWhenDisabled: '',
        note: 'זו התוספת האמיתית היחידה שהחיפוש החכם לא היה לו בכלל לפני עמוד זה — הצ\'אט הראשי והסטטיסטיקה כבר חוסמים נתונים פיננסיים לעובד רגיל, וזה היה החור.',
      },
    ],
    presets: {
      strict: ['financial_columns_orders'],
      standard: [],
      open: [],
    },
    supportsCustomText: false, // Gemini here only ever writes a WHERE fragment — free text wouldn't compose safely into that role
  },

  // 5 --------------------------------------------------------------------------------------
  {
    key: 'admin_sql_generator',
    label: 'מחולל SQL לאדמין (Data Explorer)',
    route: 'app/api/admin/ai-sql-generate/route.js',
    uiEntryPoint: '/admin/data-explorer — "בניית שאילתה עם AI"',
    description: 'היחיד מבין כל תכונות ה-AI שמותר לו לכתוב UPDATE/DELETE/INSERT (לא רק SELECT) — מיועד לתיקוני נתונים ע"י הנהלה ראשית בלבד.',
    hardGuards: [
      {
        id: 'head_management_only',
        label: 'הנהלה ראשית בלבד',
        description: "checkAuth('הנהלה ראשית') — הבדיקה המחמירה ביותר מכל תכונות ה-AI; לא זמין לאף תפקיד אחר.",
      },
      HARD_GUARD_ORG_SCOPING,
      {
        id: 'no_auto_execute',
        label: 'ה-SQL לא רץ אוטומטית',
        description: 'ה-SQL שנוצר נכתב לתיבת עריכה (setCustomQuery) בלבד — מצריך לחיצת "הרץ" נפרדת (POST /api/admin/query) כדי לבצע בפועל. זו קונבנציית UI, לא חסימה בשרת: אין דבר שמונע לשלוח את אותו SQL ישירות ל-/api/admin/query.',
      },
    ],
    restrictions: [
      {
        id: 'soft_delete_only',
        label: 'העדפת מחיקה רכה (isDeleted) על פני DELETE אמיתי',
        description: 'כשמופעל (ברירת מחדל): "מחיקה" מתורגמת ל-UPDATE ... SET "isDeleted" = true במקום DELETE אמיתי, אלא אם המשתמש מבקש "מחיקה סופית/לצמיתות" בפירוש. כבוי מסיר את ההעדפה — ה-AI יכול להציע DELETE אמיתי בקלות רבה יותר.',
        level: 'standard',
        defaultEnabled: true,
        wired: true,
        promptWhenEnabled:
          "\nSOFT DELETE CONVENTION: this system never hard-deletes business rows. When the user asks to delete/remove/cancel records in a table that has an \"isDeleted\" column (Customer, Order, OrderItem, Payment, DressItem, DressModel, ...) generate UPDATE ... SET \"isDeleted\" = true (and \"deletedAt\" = NOW() if that column exists) instead of DELETE. Generate a real DELETE only if the user explicitly says permanent/hard delete (מחיקה סופית / לצמיתות / קשיחה).",
        promptWhenDisabled:
          '\nDELETE POLICY OVERRIDE: an administrator has explicitly turned off the soft-delete preference for this session — you may generate a real DELETE statement whenever the user asks to delete/remove something, without requiring the word "permanent".',
      },
      {
        id: 'require_where_clause',
        label: 'חובת WHERE ב-UPDATE/DELETE (איסור עדכון/מחיקה גורפים)',
        description: 'מונע מה-AI להציע UPDATE/DELETE בלי תנאי WHERE שמצמצם לשורות ספציפיות — מגן מפני "עדכן את כל הטבלה" בטעות.',
        level: 'strict',
        defaultEnabled: true,
        wired: true,
        promptWhenEnabled:
          '\nSAFETY RULE: Never generate an UPDATE or DELETE statement without a WHERE clause that targets specific, identifiable rows (by id/orderId/legacyId or an equivalent precise condition). If the user\'s request is genuinely about every row in a table, say so explicitly in a leading SQL comment instead of silently omitting WHERE.',
        promptWhenDisabled: '',
      },
    ],
    presets: {
      strict: ['soft_delete_only', 'require_where_clause'],
      standard: ['soft_delete_only', 'require_where_clause'],
      open: [],
    },
    supportsCustomText: true,
  },

  // 6 --------------------------------------------------------------------------------------
  {
    key: 'audit_chat',
    label: 'סינון חיפוש בשפה חופשית ביומן ביקורת',
    route: 'app/api/audit/chat/route.js',
    uiEntryPoint: 'תיבת חיפוש בעמוד יומן הביקורת (audit log)',
    description: 'Gemini מחזיר אך ורק אובייקט JSON מובנה (action/entityType/startDate/endDate/search) שמשמש לבניית פרמטרים לשאילתת יומן-ביקורת רגילה, לא-AI. Gemini עצמו לעולם לא רואה או מחזיר שורת יומן ביקורת אמיתית.',
    hardGuards: [
      HARD_GUARD_AUTH, // note: no checkAiAccess()/feature:ai gate on this route today — any logged-in employee can use it, unrelated to hide_ai_features
      {
        id: 'structured_json_only',
        label: 'פלט מובנה בלבד (לא SQL, לא טקסט חופשי)',
        description: 'התשובה מפוענחת כ-JSON קשיח עם שדות קבועים מראש; אין נתיב שבו טקסט חופשי מה-AI מגיע ישירות למסד הנתונים.',
      },
    ],
    restrictions: [],
    presets: { strict: [], standard: [], open: [] },
    supportsCustomText: false,
  },

  // 7 --------------------------------------------------------------------------------------
  {
    key: 'report',
    label: 'עיצוב דוח/ייצוא עם AI',
    route: 'app/api/ai/report/route.js',
    uiEntryPoint: 'אפשרות עיצוב/סיכום AI במסכי ייצוא/דוח',
    description: 'מעבד מערך נתונים שכבר נשלף ללקוח (data) לפי הנחיית עיצוב חופשית — פלט HTML (למצב PDF) או JSON מעובד.',
    hardGuards: [
      HARD_GUARD_AUTH, // checkAiAccess() — added 2026-09-20 permissions hardening; this route had NO auth check before that
      HARD_GUARD_ORG_SCOPING,
    ],
    restrictions: [
      {
        id: 'no_data_fabrication',
        label: 'איסור המצאת נתונים שלא נשלחו',
        description: 'מונע מה-AI "להשלים" שורות/מספרים שלא היו בנתונים שנשלחו אליו — רק עיצוב/סיכום של מה שסופק בפועל.',
        level: 'standard',
        defaultEnabled: true,
        wired: true,
        promptWhenEnabled:
          '\nDATA INTEGRITY RULE: Only reformat/summarize the exact rows and values provided in the data array. Never invent, estimate, or add rows/numbers that were not present in the input.',
        promptWhenDisabled: '',
      },
    ],
    presets: {
      strict: ['no_data_fabrication'],
      standard: ['no_data_fabrication'],
      open: ['no_data_fabrication'],
    },
    supportsCustomText: true,
  },
];

// --- the base prompt every thread gets, regardless of any restriction toggle -------------------
// Read-only reference for the admin UI ("what does every AI conversation already include,
// before any restriction is applied"). Grounded in lib/ai/aiCommon.js.
export const BASE_PROMPT_SUMMARY = [
  {
    id: 'date_context',
    label: 'הקשר תאריך (buildDateContext)',
    description:
      'בכל שרשור: היום הנוכחי בעברית ולועזית (יום בשבוע, תאריך עברי מלא, dd/mm/yyyy, ISO), השעה בישראל, ומיפוי חודשים עבריים לשנה הנוכחית והבאה. מחושב תמיד בשרת (אזור זמן ישראל) — ה-AI מקבל הוראה מפורשת לא לחשב/להמיר תאריכים בעצמו, רק להעתיק מכאן או מתוצאות השאילתה.',
  },
  {
    id: 'schema_context',
    label: 'סכימת מסד הנתונים (getFullSchemaContext)',
    description: 'ה-SQL/prisma/schema.prisma המלא (בלי הערות) — בשימוש בצ\'אט הראשי, בסטטיסטיקה ובמחולל ה-SQL לאדמין. החיפוש החכם משתמש במקום זאת במיפוי עמודות מצומצם ידני (SCHEMA_MAP) לטבלה אחת בכל פעם.',
  },
  {
    id: 'shared_sql_rules',
    label: 'כללי דיוק נתונים משותפים (buildSharedSqlRules, S1-S15)',
    description:
      'סט כללים קבועים שנלמדו מבאגים אמיתיים בעבר: סינון NULL-safe של status (S1), טיפול בתאריך עברי בטקסט (S2), השוואת תאריכים לפי יום קלנדרי ישראלי (S3), חיפוש שם לקוח דו-כיווני (S4), הגדרת "משלוח" (S5), הגדרת "צריך לחזור היום" (S6), איסור קישורים/קבצים מומצאים (S7), איסור חשיפת SQL למשתמש (S8), ועוד. משותף לצ\'אט הראשי ולסטטיסטיקה.',
  },
  {
    id: 'employee_role_context',
    label: 'הקשר תפקיד העובד (isManager / employeeContext)',
    description: 'לפני כל שאלה, המערכת בודקת אם המשתמש מנהל/מתכנת (roleId 1/2) או עובד רגיל, ומזריקה משפט הקשר מתאים — זו הנקודה שמגבלת "נתונים פיננסיים" (financial_data בקטלוג הזה) יושבת עליה.',
  },
  {
    id: 'user_date_hints',
    label: 'פענוח תאריכים עבריים שהמשתמש הקליד (buildUserDateHints)',
    description: 'אם המשתמש הקליד תאריך עברי בטקסט החופשי שלו (למשל "כ"ו תשרי"), השרת פותר אותו מראש ומוסיף את הפתרון כהקשר — כדי שה-AI לא ינחש/יחשב תאריך עברי בעצמו.',
  },
].map((x) => ({ ...x, appliesTo: ['main_chat', 'statistics'] }));

export function getFeatureDef(key) {
  return AI_FEATURES.find((f) => f.key === key) || null;
}

export function getRestrictionDef(featureKey, restrictionId) {
  const feature = getFeatureDef(featureKey);
  if (!feature) return null;
  return feature.restrictions.find((r) => r.id === restrictionId) || null;
}
