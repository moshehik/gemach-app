// lib/schedule/stageSettings.js - "הגדרות תהליכים" של הלו"ז: תצוגת העריכה והמרת הקלט לכתיבת SystemSetting. לוגיקה טהורה (בלי prisma/next),
// נבדקת ב-scripts/test_schedule_stage_settings.mjs. מקור הדרישה: החלון "הגדרות תהליכים" בעיצוב המאושר (תצוגות-עיצוב/סיימתי-לעבוד/לוז-יומי.html, openSettings)
// וההחלטות B3 (רק הנהלה ראשית כותבת) + A2 (אין ימים לשלב 1) ב-docs/schedule-page-logic-spec.md.
//
// המפתחות שהקוד כבר קורא (lib/schedule/settings.js resolveScheduleSettings): schedule_stage_<key>_enabled ('false' מכבה), _days (ימי עסקים, 0-60, גודל - הכיוון קבוע
// לשלב), _shift ('none'|'am'|'pm'|'all'). שורה חסרה = ברירת המחדל. בנוסף: branch_transfer_horizon_days (טווח התראת ההעברה בין סניפים, ימים קדימה, ברירת מחדל 14).
import { STAGES, SHIFT_VALUES, SHIFT_LABELS } from './stages.js';
import { resolveScheduleSettings } from './settings.js';
import { GROUP_ORDER } from './stageSettingsMeta.js';

export const HORIZON_KEY = 'branch_transfer_horizon_days';
export const DEFAULT_HORIZON_DAYS = 14;
export const MAX_STAGE_DAYS = 60;

export const stageKeyOf = (stageKey, field) => `schedule_stage_${stageKey}_${field}`;

// שלב "קבוע" = שלב מידע בלבד (הזמנות חדשות, אירוע): תמיד מוצג, אין לו ימים. כמו "קבוע" בעיצוב.
export const isFixedStage = (stage) => !!stage.infoOnly;

export function stageGroupOf(stage) {
  if (stage.defaultOffset === null) return 'other';
  if (stage.defaultOffset < 0) return 'before';
  if (stage.defaultOffset === 0) return 'event';
  return 'after';
}

/**
 * תצוגת העריכה מתוך מפת ההגדרות (key -> value).
 * @returns {{ stages: Array<object>, horizonDays: number }}
 */
export function buildStageSettingsView(map = {}) {
  const resolved = resolveScheduleSettings(map);
  const stages = STAGES.map((s) => {
    const r = resolved.stages[s.key];
    const days = s.offsetConfigurable && r.offset !== null ? Math.abs(r.offset) : null;
    const dir = s.defaultOffset === null ? null : (s.defaultOffset < 0 ? 'before' : 'after');
    return {
      key: s.key, number: s.number, label: s.label, what: s.what, group: stageGroupOf(s),
      fixed: isFixedStage(s), daysConfigurable: !!s.offsetConfigurable, days, defaultDays: s.offsetConfigurable ? Math.abs(s.defaultOffset || 0) : null,
      direction: dir, enabled: !!r.enabled, shift: r.shift, requiresSetting: s.requiresSetting,
    };
  });
  const raw = parseInt(String(map[HORIZON_KEY] ?? ''), 10);
  const horizonDays = Number.isFinite(raw) ? Math.min(60, Math.max(1, raw)) : DEFAULT_HORIZON_DAYS;
  return { stages, horizonDays };
}

/**
 * ולידציה והמרה של קלט העריכה ל-writes (key -> value) - רק מה שהשתנה לעומת ההגדרות הנוכחיות, או שורה שכבר קיימת.
 * input = { stages: { [key]: { enabled?, days?, shift? } }, horizonDays? }; שלב קבוע / שדה שאינו חל עליו - מתעלמים (A2: אין ימים לשלב 1).
 * @returns {{ ok: boolean, writes?: Record<string,string>, errors: string[] }}
 */
export function buildStageWrites(input, map = {}) {
  const errors = [];
  const writes = {};
  const current = buildStageSettingsView(map);
  const curByKey = Object.fromEntries(current.stages.map((s) => [s.key, s]));
  const put = (key, value, effectiveNow) => {
    // כותבים כשהערך שונה מהנוכחי, או כשהשורה כבר קיימת (כדי שלא תיוותר ישנה)
    if (String(value) !== String(effectiveNow) || map[key] !== undefined) writes[key] = String(value);
  };
  const stagesIn = (input && input.stages) || {};
  for (const [key, patch] of Object.entries(stagesIn)) {
    const def = STAGES.find((s) => s.key === key);
    if (!def) { errors.push(`שלב לא מוכר: ${key}`); continue; }
    if (!patch || typeof patch !== 'object') continue;
    const cur = curByKey[key];
    if (patch.enabled !== undefined && !cur.fixed) {
      put(stageKeyOf(key, 'enabled'), patch.enabled ? 'true' : 'false', cur.enabled ? 'true' : 'false');
    }
    if (patch.days !== undefined && cur.daysConfigurable) {
      const n = parseInt(String(patch.days), 10);
      if (!Number.isFinite(n) || n < 0 || n > MAX_STAGE_DAYS) errors.push(`${def.label}: ימים חייבים להיות בין 0 ל-${MAX_STAGE_DAYS}`);
      else put(stageKeyOf(key, 'days'), n, cur.days);
    }
    if (patch.shift !== undefined && !cur.fixed) {
      if (!SHIFT_VALUES.includes(patch.shift)) errors.push(`${def.label}: משמרת לא תקינה`);
      else put(stageKeyOf(key, 'shift'), patch.shift, cur.shift);
    }
  }
  if (input && input.horizonDays !== undefined) {
    const n = parseInt(String(input.horizonDays), 10);
    if (!Number.isFinite(n) || n < 1 || n > 60) errors.push('טווח התראת ההעברה חייב להיות בין 1 ל-60 ימים');
    else put(HORIZON_KEY, n, current.horizonDays);
  }
  return errors.length ? { ok: false, errors } : { ok: true, writes, errors: [] };
}

export { SHIFT_VALUES, SHIFT_LABELS, GROUP_ORDER };
