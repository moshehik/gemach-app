// unpaid_action_approval_once_per_visit (נווה יעקב, סבב 2026-10-05): אישור מנהל לפעולה בלי תשלום מלא
// מתבקש פעם אחת לביקור. org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר = התנהגות קיימת
// (ערך קיים של org1 לעולם לא משתנה). dry-run כברירת מחדל.
//   node scripts/seed_unpaid_action_approval_once_per_visit_setting.js --org=2 [--write]
//   node scripts/seed_unpaid_action_approval_once_per_visit_setting.js --org=1 [--write]
// ההגדרה (שם/קטגוריה/הערות) ב-scripts/lib/neve-2026-10-05-setting-defs.js.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');
const { UNPAID_ACTION_APPROVAL_ONCE_PER_VISIT } = require('./lib/neve-2026-10-05-setting-defs');

seedBoolSetting(UNPAID_ACTION_APPROVAL_ONCE_PER_VISIT).catch((e) => { console.error(e); process.exitCode = 1; });
