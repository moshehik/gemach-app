// lib/schedule/settings.js — קריאת הגדרות הלו״ז מ-SystemSetting עם ברירות מחדל שאינן משנות התנהגות.
//
// כלל (CLAUDE.md, Standing rules → Settings & the two orgs): שורה חסרה/ריקה = ההתנהגות של היום.
// אין כאן כתיבה ואין זריעה - מפתחות `schedule_*` עדיין לא קיימים באף DB; עד שייווצרו (בשני
// הגמ"חים בו-זמנית, לפי הנוהל) הקוד רץ על ברירות המחדל שלמטה.
//
// מפתחות קיימים שנקראים (לא לשכפל - החלטה B09): enable_deliveries, enable_alterations,
// branches_enabled, late_return_threshold_days, standard_pickup_hours, delivery_* (נקראים בתוך
// lib/deliveries.js עצמו), ו-non_working_days_extra (רשימת הימים של הבעלים - lib/businessDays.js;
// נקרא מאותה קריאת מטמון, בלי שאילתה נוספת, ומועבר לכל חישובי ימי העסקים של הלו״ז).
//
// מפתחות חדשים (מוצעים, לא זרועים):
//   schedule_stage_<key>_enabled   'true'/'false' - ברירת מחדל: פעיל (למשלוחים: רק אם enable_deliveries='true';
//                                  לתיקונים: רק אם enable_alterations אינו 'false').
//   schedule_stage_<key>_days      מספר ימי עסקים יחסית לאירוע - רק לשלבים offsetConfigurable
//                                  (repair 0, prep 3, pick 2, manret 1). נשמר כערך מוחלט; הכיוון קבוע לשלב.
//   schedule_stage_<key>_shift     'none' | 'am' | 'pm' | 'all' - תגית משמרת בלבד (S08), לא מסננת נתונים.
//   schedule_max_scan_rows         תקרת שורות לסריקה ב-JS (ברירת מחדל 3000, כמו JS_SCAN_MAX בחיפוש המתקדם).
//
// לוח ימי העסקים (2026-10-01, החלטות הבעלים B4 + 3): כלל אחד לכל השלבים - lib/businessDays.js (שישי, שבת,
// חג, ערב חג, רשימת הבעלים). אין מתג לכל שלב ואין מפתח schedule_skip_chag_all_stages (הטיוטה הקודמת
// הציעה אותו; הוא היה מאפשר ללו״ז לסטות מכרטיס ההזמנה ומרשימת האיחורים, בניגוד להחלטה 3 "אותו כלל
// לשלב 8, לכרטיס ההזמנה ולרשימת האיחורים"). שלבים 5/9 (משלוחים) עוברים דרך lib/deliveries.js, שמחיל
// את אותו כלל (שישי/שבת שם לפי delivery_skip_weekends, כמו בדף המשלוחים).
//
// החלטה B3: הגדרות השלבים נכתבות רק ע"י הנהלה ראשית. בשלב זה אין כתיבה בכלל (קריאה בלבד); כשייבנה
// מסך ההגדרות, הכתיבה תעבור שער isHeadManagement כמו /admin/settings.
// החלטה A2: לשלב 1 אין "ימים מהאירוע" - אין מפתח schedule_stage_order_days (offsetConfigurable=false).

import { getAllCachedSettings } from '@/lib/settingsCache';
import { LATE_RETURN_THRESHOLD_DAYS } from '@/lib/lateReturn';
import { NON_WORKING_DAYS_SETTING_KEY, parseNonWorkingDaysSetting } from '@/lib/businessDays';
import { STAGES, SHIFT_VALUES } from './stages';

export const DEFAULT_MAX_SCAN_ROWS = 3000;
export const DEFAULT_PICKUP_HOURS = '20:00-21:30'; // כמו STANDARD_PICKUP_HOURS ב-app/print/order/page.js

function toInt(value, fallback, { min = 0, max = 60 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// map: { key: value } (מחרוזות, כמו SystemSetting.value). פונקציה טהורה - נוחה לבדיקות.
export function resolveScheduleSettings(map = {}) {
  const deliveriesEnabled = map.enable_deliveries === 'true';
  const alterationsEnabled = map.enable_alterations !== 'false'; // אותו כלל כמו app/layout.js
  const branchesEnabled = map.branches_enabled === 'true';

  const stages = {};
  for (const stage of STAGES) {
    const enabledRaw = map[`schedule_stage_${stage.key}_enabled`];
    let enabled = enabledRaw !== 'false';
    if (stage.requiresSetting === 'enable_deliveries' && !deliveriesEnabled) enabled = false;
    if (stage.requiresSetting === 'enable_alterations' && !alterationsEnabled) enabled = false;

    let offset = stage.defaultOffset;
    if (stage.offsetConfigurable && stage.defaultOffset !== null) {
      // הערך נשמר כמספר ימים (גודל); הכיוון קבוע לשלב (לפני/אחרי האירוע), גם אם הוקלד מינוס
      const raw = map[`schedule_stage_${stage.key}_days`];
      const parsed = raw === undefined || raw === null || String(raw).trim() === '' ? NaN : parseInt(String(raw), 10);
      const days = toInt(Number.isFinite(parsed) ? Math.abs(parsed) : null, Math.abs(stage.defaultOffset), { min: 0, max: 60 });
      offset = days === 0 ? 0 : (stage.defaultOffset < 0 ? -days : days);
    }

    const shiftRaw = map[`schedule_stage_${stage.key}_shift`];
    const shift = SHIFT_VALUES.includes(shiftRaw) ? shiftRaw : 'none';

    stages[stage.key] = { enabled, offset, shift };
  }

  return {
    deliveriesEnabled,
    alterationsEnabled,
    branchesEnabled,
    lateReturnThresholdDays: toInt(map.late_return_threshold_days, LATE_RETURN_THRESHOLD_DAYS, { min: 1, max: 90 }),
    pickupHours: map.standard_pickup_hours || DEFAULT_PICKUP_HOURS,
    maxScanRows: toInt(map.schedule_max_scan_rows, DEFAULT_MAX_SCAN_ROWS, { min: 100, max: 20000 }),
    // רשימת הימים של הבעלים (NonWorkingConfig). שורה חסרה/ריקה/שבורה = ברירות המחדל בלבד - לעולם לא זורק.
    nonWorkingDays: parseNonWorkingDaysSetting(map[NON_WORKING_DAYS_SETTING_KEY] ?? null),
    stages,
  };
}

export async function loadScheduleSettings(loadAll = getAllCachedSettings) {
  const rows = await loadAll().catch(() => []);
  const map = {};
  for (const row of rows || []) if (row && row.key) map[row.key] = row.value;
  return resolveScheduleSettings(map);
}
