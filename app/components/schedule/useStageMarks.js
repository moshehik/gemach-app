'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// useStageMarks — הלוגיקה של סימון "בוצע" בדף הלו״ז (ללא עיצוב). השרת: POST /api/schedule/marks
// (lib/schedule/marks.js). הדף מעביר את התוצאה ל-StageSection/StageRow דרך הפרופים המתועדים:
//   onMarkDone(stage, row, { done: boolean, outcome?: 'ok'|'not_ok' })   סימון / ביטול שורה אחת
//   doneState(stage, row) -> { done, doneVia, doneBy, doneAt, outcome, busy, canMark, available }
//   onMarkAll(stage)                                                     "הכל בוצע" לשלב
//   canMarkAll / available / isBusy(stageKey, orderId)
// עדכון אופטימי: השורה מסומנת מיד; בשגיאה חוזרים למצב הקודם ומציגים הודעה רגועה (toast). המונים של השלב
// (done/pending/unknown/alerts) והסיכומים מחושבים מחדש בלקוח מתוך השורות, בלי קריאה נוספת לשרת.
// אין "חלון ביטול" מתוזמן (ההחלטות: ביטול סימון = לחיצה על "בוצע" עם חלון "בטוח?"); הטוסט רק מודיע.

const TOAST_MS = 3200;

const ERROR_TEXT = {
  401: 'יש להתחבר מחדש כדי לסמן "בוצע".',
  403: 'אין הרשאה לפעולה הזו.',
  503: 'סימון "בוצע" עדיין לא זמין - טבלת הסימונים לא נוצרה במסד.',
};

function rowKey(stageKey, orderId) {
  return stageKey + ':' + orderId;
}

function snapshot(row) {
  return {
    done: row.done, doneVia: row.doneVia || null, doneBy: row.doneBy || null, doneAt: row.doneAt || null,
    outcome: row.outcome || null, returnCondition: row.returnCondition, mark: row.mark || null,
    alerts: row.alerts || [], items: row.items,
  };
}

function optimisticPatch(row, { done, outcome }) {
  if (done) {
    return {
      done: true, doneVia: 'mark', doneBy: 'את/ה', doneAt: new Date().toISOString(), outcome: outcome || null,
      // שלבי ההחזרה: המצב שנבחר מוצג מיד (השרת מחזיר את המצב הסופי לפי הפריטים)
      ...(outcome ? { returnCondition: row.returnCondition || outcome } : {}),
      alerts: (row.alerts || []).filter((a) => a.code !== 'late_not_done'),
      items: row.items,
    };
  }
  return { done: false, doneVia: null, doneBy: null, doneAt: null, outcome: null, alerts: row.alerts || [], items: row.items };
}

export function recount(data) {
  if (!data || !Array.isArray(data.stages)) return data;
  const totals = { total: 0, done: 0, pending: 0, unknown: 0, alerts: 0 };
  const stages = data.stages.map((stage) => {
    const counts = { total: stage.items.length, done: 0, pending: 0, unknown: 0, alerts: 0 };
    for (const row of stage.items) {
      if (row.alerts && row.alerts.length) counts.alerts++;
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
    return { ...stage, counts };
  });
  return { ...data, stages, totals };
}

export function applyRowPatches(data, stageKey, patches) {
  if (!data) return data;
  const byId = new Map(patches.map((p) => [p.orderId, p]));
  const stages = data.stages.map((stage) => {
    if (stage.key !== stageKey) return stage;
    return {
      ...stage,
      items: stage.items.map((row) => {
        const p = byId.get(row.orderId);
        if (!p) return row;
        const rest = { ...p };
        delete rest.orderId;
        delete rest.stage;
        return { ...row, ...rest }; // מפתח שחסר בטלאי (למשל returnCondition בשלב שאינו החזרה) נשאר כמו בשורה
      }),
    };
  });
  return recount({ ...data, stages });
}

async function postMarks(body) {
  const res = await fetch('/api/schedule/marks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* לא JSON */ }
  if (!res.ok) {
    const err = new Error((json && json.error) || ERROR_TEXT[res.status] || 'השמירה נכשלה');
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function errorText(e) {
  if (!e) return 'השמירה נכשלה';
  if (e.body && e.body.earlyReturn) return (e.body.error || 'תאריך האירוע עדיין לא הגיע') + ' אפשר לסמן מכרטיס ההזמנה עם אישור מנהל.';
  if (e.status && ERROR_TEXT[e.status] && !(e.body && e.body.error)) return ERROR_TEXT[e.status];
  if (e.status === 0 || e.name === 'TypeError') return 'אין חיבור לשרת - הסימון לא נשמר.';
  return e.message || 'השמירה נכשלה';
}

/**
 * @param {{ data: object|null, setData: Function }} params  data = תשובת GET /api/schedule; setData = ה-setter של הדף
 */
export function useStageMarks({ data, setData }) {
  const [busy, setBusy] = useState({});
  const [toast, setToast] = useState(null);
  const busyRef = useRef({});
  const timer = useRef(null);
  const seq = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const say = useCallback((title, text, kind = 'ok') => {
    clearTimeout(timer.current);
    setToast({ n: ++seq.current, title, text, kind });
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  const dismissToast = useCallback(() => { clearTimeout(timer.current); setToast(null); }, []);

  const setBusyKey = useCallback((key, on) => {
    if (on) busyRef.current[key] = true; else delete busyRef.current[key];
    setBusy({ ...busyRef.current });
  }, []);

  const available = !!(data && data.marks && data.marks.available);
  const canMark = !!(available && data.marks.canMark);
  const canMarkAll = !!(available && data.marks.canMarkAll);
  const dayKey = data ? data.date : null;

  const isBusy = useCallback((stageKey, orderId) => !!busy[rowKey(stageKey, orderId)] || !!busy['all:' + stageKey], [busy]);

  const patchRows = useCallback((stageKey, patches) => {
    setData((prev) => applyRowPatches(prev, stageKey, patches));
  }, [setData]);

  // סימון / ביטול שורה אחת. outcome רק לשלבי ההחזרה (8/9): 'ok' (ברירת מחדל, "בוצע" = הוחזר תקין) / 'not_ok'.
  const onMarkDone = useCallback(async (stage, row, { done, outcome } = {}) => {
    if (!canMark || !dayKey || !stage || !row || stage.infoOnly) return false;
    const key = rowKey(stage.key, row.orderId);
    if (busyRef.current[key] || busyRef.current['all:' + stage.key]) return false;
    const before = snapshot(row);
    setBusyKey(key, true);
    patchRows(stage.key, [{ orderId: row.orderId, ...optimisticPatch(row, { done, outcome }) }]);
    try {
      const res = await postMarks({ action: done ? 'mark' : 'unmark', stageKey: stage.key, dayKey, orderId: row.orderId, ...(done && outcome ? { outcome } : {}), source: 'row' });
      if (res && res.row) patchRows(stage.key, [res.row]);
      const who = (row.customer && row.customer.name) || '';
      // note מהשרת: ביטול שלא שינה את "בוצע" כי העובדה (נלקח/הוחזר בכרטיס) עדיין תקפה
      const note = res && res.row && res.row.note ? ' · ' + res.row.note : '';
      say(
        done ? (outcome === 'not_ok' ? 'סומן כהוחזר לא תקין' : 'סומן כבוצע') : 'הסימון בוטל',
        stage.label + ' · #' + row.orderId + (who ? ' · ' + who : '') + note,
        done ? (outcome === 'not_ok' ? 'warn' : 'ok') : (note ? 'warn' : 'undo'),
      );
      return true;
    } catch (e) {
      patchRows(stage.key, [{ orderId: row.orderId, ...before }]);
      say(done ? 'הסימון לא נשמר' : 'הביטול לא נשמר', errorText(e), 'error');
      return false;
    } finally {
      setBusyKey(key, false);
    }
  }, [canMark, dayKey, patchRows, say, setBusyKey]);

  // "הכל בוצע" לשלב: רק השורות שעדיין לא בוצעו ושהמשתמשת רואה (orderIds נשלחים לשרת, שמאמת מחדש כל אחת).
  const onMarkAll = useCallback(async (stage) => {
    if (!canMarkAll || !dayKey || !stage || stage.infoOnly) return false;
    const key = 'all:' + stage.key;
    if (busyRef.current[key]) return false;
    const pending = (stage.items || []).filter((r) => r.done !== true);
    if (!pending.length) return false;
    const befores = pending.map((r) => ({ orderId: r.orderId, ...snapshot(r) }));
    setBusyKey(key, true);
    patchRows(stage.key, pending.map((r) => ({ orderId: r.orderId, ...optimisticPatch(r, { done: true, outcome: 'ok' }) })));
    try {
      const res = await postMarks({ action: 'mark_all', stageKey: stage.key, dayKey, orderIds: pending.map((r) => r.orderId) });
      const got = new Set((res.rows || []).map((r) => r.orderId));
      // שורות שהשרת לא סימן (נחסמו / כבר לא בשלב) חוזרות למצב הקודם
      const rollback = befores.filter((b) => !got.has(b.orderId));
      patchRows(stage.key, [...(res.rows || []), ...rollback]);
      const n = (res.counts && res.counts.marked) || 0;
      const skipped = (res.skipped || []).length;
      say(
        n ? 'כל "' + stage.label + '" סומנו כבוצעו' : 'לא סומן דבר',
        n + ' שורות סומנו' + (skipped ? ' · ' + skipped + ' לא סומנו (דורשות אישור מנהל)' : ''),
        n ? 'ok' : 'warn',
      );
      return true;
    } catch (e) {
      patchRows(stage.key, befores);
      say('"הכל בוצע" לא נשמר', errorText(e), 'error');
      return false;
    } finally {
      setBusyKey(key, false);
    }
  }, [canMarkAll, dayKey, patchRows, say, setBusyKey]);

  const doneState = useCallback((stage, row) => ({
    available,
    canMark: canMark && !!(row && row.canMark !== false),
    done: row ? row.done : null,
    doneVia: row ? row.doneVia || null : null,
    doneBy: row ? row.doneBy || null : null,
    doneAt: row ? row.doneAt || null : null,
    outcome: row ? row.outcome || null : null,
    busy: row && stage ? isBusy(stage.key, row.orderId) : false,
  }), [available, canMark, isBusy]);

  return useMemo(() => ({
    available, canMark, canMarkAll, isBusy, doneState, onMarkDone, onMarkAll, toast, dismissToast,
  }), [available, canMark, canMarkAll, isBusy, doneState, onMarkDone, onMarkAll, toast, dismissToast]);
}

export default useStageMarks;
