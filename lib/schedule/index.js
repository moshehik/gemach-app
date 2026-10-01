// lib/schedule/index.js — getScheduleDay: כל מה שיש ביום אחד בלו״ז, לקריאה בלבד.
//
// חוזה ה-JSON מתועד ב-docs/schedule-page-logic-spec.md (סעיף "פורמט התשובה"). אין כאן כתיבה,
// אין שינוי סכימה, ואין "סימון בוצע" (שלב 2 של הבנייה). המודול הזה מרכיב: הגדרות (settings.js),
// הגדרות השלבים (stages.js), השליפות (loaders.js) וההתראות (alerts.js).

import { STAGES, STAGE_BY_KEY, SHIFT_LABELS } from './stages';
import { loadScheduleSettings } from './settings';
import { loadOrderStageRows, loadEventStageRows, loadDeliveryStageRows, loadStaffOnShift } from './loaders';
import { alertsForRow } from './alerts';
import { isValidKey, isWithinReasonableRange, MAX_YEARS_FROM_TODAY, todayKey, dayStatus, hebrewLabel, weekdayLabel, addCalendarDays } from './dates';

// תפקידים שרואים הערות פנימיות (internalNotes) בשורה - הנהלה ראשית, מנהל סניף, מתכנת. אין היום
// פריט הרשאה ייעודי להערות פנימיות בקטלוג; זו ברירת מחדל מתועדת (ר' spec, "החלטות ברירת מחדל").
const INTERNAL_NOTES_ROLE_IDS = [0, 1, 2];

function rowBranch(row, stageKey) {
  if (stageKey === 'pick') return row.pickupBranch || row.branch || null;
  return row.branch || null;
}

function sortRows(rows) {
  return rows.sort((a, b) => {
    const na = (a.customer?.lastName || '') + ' ' + (a.customer?.firstName || '');
    const nb = (b.customer?.lastName || '') + ' ' + (b.customer?.firstName || '');
    const c = na.localeCompare(nb, 'he');
    return c !== 0 ? c : (a.orderId || 0) - (b.orderId || 0);
  });
}

/**
 * @param {object} params
 * @param {string} [params.date]     'YYYY-MM-DD' (יום ישראלי). ברירת מחדל: היום בישראל.
 * @param {string} [params.branch]   סינון תצוגה אופציונלי לפי סניף ההזמנה (Order.branch / pickupBranch) - פעיל רק
 *                                   כש-branches_enabled='true'. לפי בחירה בבקשה בלבד: אין שיוך עובד↔סניף ואין
 *                                   סינון לפי העובד המחובר (החלטה B2).
 * @param {{id?: string, roleId?: number}|null} [params.user]  העובד המחובר (להערות פנימיות). null = אורח.
 * @param {object} [params.settings] הגדרות פתורות (resolveScheduleSettings) - לבדיקות; אחרת נטענות מהמטמון.
 * @param {Date} [params.now]        "עכשיו" - לבדיקות.
 */
export async function getScheduleDay({ date, branch, user, settings, now = new Date() } = {}) {
  const today = todayKey(now);
  const dayKey = date || today;
  if (!isValidKey(dayKey)) {
    const err = new Error('תאריך לא תקין - נדרש YYYY-MM-DD');
    err.status = 400;
    throw err;
  }
  if (!isWithinReasonableRange(dayKey, today)) {
    const err = new Error(`התאריך מחוץ לטווח - הלו״ז זמין עד ${MAX_YEARS_FROM_TODAY} שנים קדימה או אחורה מהיום`);
    err.status = 400;
    throw err;
  }

  const resolved = settings || (await loadScheduleSettings());
  const includeInternalNotes = !!(user && INTERNAL_NOTES_ROLE_IDS.includes(user.roleId));
  const ctx = {
    dayKey,
    todayKey: today,
    stageDefs: STAGE_BY_KEY,
    stageSettings: resolved.stages,
    maxScanRows: resolved.maxScanRows,
    // רשימת הימים של הבעלים (non_working_days_extra) - לכל ספירת ימי עסקים בלו״ז (lib/businessDays.js)
    nonWorkingDays: resolved.nonWorkingDays,
    includeInternalNotes,
  };

  const [orderStage, eventStages, deliveryStages, staff] = await Promise.all([
    resolved.stages.order.enabled ? loadOrderStageRows(ctx) : { rows: [], truncated: false },
    loadEventStageRows(ctx),
    loadDeliveryStageRows(ctx),
    loadStaffOnShift(ctx).catch((e) => { console.error('schedule: staff load failed', e); return []; }),
  ]);

  const rowsByStage = {
    order: orderStage.rows,
    ...eventStages.rowsByStage,
    dout: deliveryStages.dout,
    dback: deliveryStages.dback,
  };

  const branchFilter = resolved.branchesEnabled && branch ? String(branch).trim() : '';
  const alertCtx = { dayKey, todayKey: today, lateReturnThresholdDays: resolved.lateReturnThresholdDays };
  const warnings = [];
  const totals = { total: 0, done: 0, pending: 0, unknown: 0, alerts: 0 };

  const stages = STAGES.map((stage) => {
    const cfg = resolved.stages[stage.key];
    let rows = cfg.enabled ? (rowsByStage[stage.key] || []) : [];
    if (branchFilter) rows = rows.filter((r) => rowBranch(r, stage.key) === branchFilter);
    rows = sortRows(rows);

    const counts = { total: rows.length, done: 0, pending: 0, unknown: 0, alerts: 0 };
    for (const row of rows) {
      row.alerts = alertsForRow(row, stage, alertCtx);
      if (row.alerts.length) counts.alerts++;
      if (stage.infoOnly) continue;
      if (row.done === true) counts.done++;
      else if (row.done === false) counts.pending++;
      else counts.unknown++;
    }
    if (!stage.infoOnly) {
      totals.total += counts.total;
      totals.done += counts.done;
      totals.pending += counts.pending;
      totals.unknown += counts.unknown;
    }
    totals.alerts += counts.alerts;
    if (cfg.enabled && !stage.infoOnly && !stage.doneSource && rows.length) {
      warnings.push(`לשלב ${stage.number} (${stage.label}) אין עדיין שדה "בוצע" במסד - המונה "בוצע" שלו לא זמין.`);
    }

    return {
      key: stage.key,
      number: stage.number,
      label: stage.label,
      plural: stage.plural,
      what: stage.what,
      infoOnly: stage.infoOnly,
      enabled: cfg.enabled,
      offsetBusinessDays: cfg.offset,
      shift: cfg.shift,
      shiftLabel: SHIFT_LABELS[cfg.shift] || '',
      doneSource: stage.doneSource,
      showModel: stage.showModel,
      showAddress: stage.showAddress,
      counts,
      items: rows,
    };
  });

  const truncated = !!(orderStage.truncated || eventStages.truncated);
  if (truncated) warnings.push(`נסרקו רק ${resolved.maxScanRows} הזמנות ראשונות - ייתכן שחסרות שורות (schedule_max_scan_rows).`);

  // "יום לא עובד" + הסיבה - מהכלל האחיד (lib/businessDays.js), כולל הימים שהבעלים סימן. הדף מציג את זה
  // כמו שהוא ולא מחשב חגים/ימים בשבוע בעצמו. reasons: 'friday' | 'shabbat' | 'chag' | 'erev_chag' | 'closed'
  // (ובגרסה 2 של הכלל גם 'chol_hamoed' | 'range' | 'recurring' - עוברים הלאה אוטומטית); titles: שמות החגים.
  const status = dayStatus(dayKey, resolved.nonWorkingDays);

  return {
    date: dayKey,
    dateHebrew: hebrewLabel(dayKey),
    weekday: weekdayLabel(dayKey),
    isToday: dayKey === today,
    today,
    tomorrow: addCalendarDays(today, 1),
    nonWorkingDay: !status.working,
    dayStatus: { working: status.working, reasons: status.reasons, titles: status.titles, note: status.note },
    generatedAt: now.toISOString(),
    settings: {
      deliveriesEnabled: resolved.deliveriesEnabled,
      alterationsEnabled: resolved.alterationsEnabled,
      branchesEnabled: resolved.branchesEnabled,
      branches: resolved.branches || [],
      branchFilter: branchFilter || null,
      lateReturnThresholdDays: resolved.lateReturnThresholdDays,
      pickupHours: resolved.pickupHours,
      deliveryDaysBefore: deliveryStages.meta?.daysBefore ?? null,
      deliveryDaysAfter: deliveryStages.meta?.daysAfter ?? null,
      includeInternalNotes,
    },
    staff,
    stages,
    totals,
    truncated,
    warnings,
  };
}
