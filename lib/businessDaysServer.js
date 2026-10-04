// lib/businessDaysServer.js - קריאת ההגדרה non_working_days_extra בשרת (דרך מטמון ההגדרות).
// הלוגיקה עצמה (הכלל, הספירה, הפרסור) טהורה ויושבת ב-lib/businessDays.js כדי שתרוץ גם בדפדפן;
// הקובץ הזה מייבא prisma (דרך settingsCache) ולכן הוא לשרת בלבד - לא לייבא מרכיבי 'use client'.
// חוזה: scratch/schedule-build/CONTRACT-non-working-days.md סעיף 4.3.

import { getCachedSetting } from '@/lib/settingsCache';
import { NON_WORKING_DAYS_SETTING_KEY, parseNonWorkingDaysSetting, EMPTY_NON_WORKING_CONFIG } from '@/lib/businessDays';

/**
 * רשימת הימים של הבעלים כ-NonWorkingConfig. שורה חסרה / ריקה / שגיאת DB -> קונפיג ריק
 * (ברירות המחדל שישי/שבת/חג/חול המועד/ערב חג בלבד) - לעולם לא זורק, כדי שדף משלוחים/איחורים לא ייפול
 * בגלל ההגדרה.
 * @param {object} [client] - prisma/tx client אופציונלי (כמו ב-getCachedSetting)
 */
// הפרסור (כולל פריסת טווחים) יקר יחסית וה-hot paths (משלוחים, איחורים, לו״ז) קוראים לכאן בכל בקשה: זוכרים את הקונפיג האחרון
// לפי המחרוזת הגולמית. הקונפיג לקריאה בלבד אצל כל הצרכנים (isConfig / normalizeConfig), אז אפשר לשתף אותו.
let memoRaw;
let memoConfig = null;

export async function getNonWorkingDaysConfig(client) {
  try {
    const row = await getCachedSetting(NON_WORKING_DAYS_SETTING_KEY, client);
    const raw = row?.value ?? null;
    if (memoConfig && raw === memoRaw) return memoConfig;
    const config = parseNonWorkingDaysSetting(raw);
    memoRaw = raw;
    memoConfig = config;
    return config;
  } catch (e) {
    console.error('getNonWorkingDaysConfig failed, using defaults only:', e);
    return EMPTY_NON_WORKING_CONFIG;
  }
}
