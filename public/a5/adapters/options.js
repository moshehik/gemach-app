/* A5 options: (1) הצעות לשדות החיפוש המתקדם  (2) חלון ההגדרה המהירה. תלוי רק ב-core.js (A5.api) */
(function () {
  const A5 = (window.A5 = window.A5 || {});
  A5.adv = A5.adv || { focus: {} };
  A5.settings = A5.settings || {};

  /* ---------- (1) הצעות ---------- */
  const OPT_TTL = 60 * 1000;
  const cache = new Map(); // key|focus|typed -> {t, list}
  const inflight = new Map();

  /* Promise<string[]>: עד 50 ערכים אמיתיים, מסוננים בשרת (GET /api/a5/options), ממוינים א-ב / מספרים עולה.
     typed ריק = הנפוצים/האחרונים. שגיאת רשת/הרשאה נזרקת (Error עם .status) כדי שהממשק יציג "אין חיבור לשרת". */
  A5.adv.options = function (key, focus, typed) {
    typed = String(typed == null ? '' : typed).trim();
    const ck = [key, key === 'q' ? focus || '' : '', typed].join('|');
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.t < OPT_TTL) return Promise.resolve(hit.list.slice());
    if (inflight.has(ck)) return inflight.get(ck).then((l) => l.slice());
    const qs = 'key=' + encodeURIComponent(key) + '&focus=' + encodeURIComponent(focus || '') + '&typed=' + encodeURIComponent(typed);
    const p = A5.api('/api/a5/options?' + qs).then((d) => {
      const list = Array.isArray(d && d.options) ? d.options : [];
      cache.set(ck, { t: Date.now(), list });
      return list.slice();
    }).finally(() => inflight.delete(ck));
    inflight.set(ck, p);
    return p.then((l) => l.slice());
  };

  /* ---------- (2) הגדרות ---------- */
  // מפתחות hide_* שמוצגים הפוכים (כמו INVERTED_DISPLAY_KEYS ב-lib/settingsMetadata.js). הפונקציה סימטרית
  const INVERTED = ['hide_custom_spacing', 'hide_ai_features', 'hide_dress_images', 'hide_gregorian_calendar', 'hide_internal_messaging', 'hide_error_reporting'];
  const toRaw = (key, v) => (INVERTED.includes(key) && (v === 'true' || v === 'false') ? (v === 'true' ? 'false' : 'true') : v);
  const known = new Map(); // key -> entry אחרון שנטען (לשם ולמגבלות)

  /* GET /api/a5/settings?key= -> {key,name,category,location,pagePath,description,fieldType,currentValue,options?,limits?}
     fieldType: boolean|select|multiline|number|text (עריכה) | department|mandatoryFields|fieldGroups|secret|timestamp (קריאה בלבד).
     currentValue הוא ערך תצוגה (כבר הפוך למפתחות hide_*). 403 = אין הרשאה (עובדת/אורחת), 404 = מפתח לא קיים */
  A5.settings.get = async function (key) {
    const d = await A5.api('/api/a5/settings?key=' + encodeURIComponent(key));
    const s = d && d.setting;
    if (!s) { const e = new Error('not found'); e.status = 404; throw e; }
    known.set(key, s);
    return s;
  };

  /* עזר: הודעת שגיאת אימות לפי אותם כללים כמו app/lib/settingsValidation.js (רק לסוג number, לפי s.limits) */
  A5.settings.validate = function (s, value) {
    if (!s || s.fieldType !== 'number') return null;
    const v = String(value == null ? '' : value).trim();
    const L = s.limits;
    if (v === '') return L && L.allowEmpty ? null : 'יש להזין ערך מספרי.';
    const n = Number(v);
    if (Number.isNaN(n)) return 'יש להזין מספר בלבד.';
    if (!L) return null;
    if (!L.allowDecimal && !Number.isInteger(n)) return 'יש להזין מספר שלם (ללא נקודה עשרונית).';
    if (n < L.min) return 'הערך קטן מדי — המינימום המותר הוא ' + L.min + '.';
    if (n > L.max) return 'הערך גדול מדי — המקסימום המותר הוא ' + L.max + '.';
    return null;
  };

  /* GET /api/a5/settings/approvers -> [{id,name,role,roleId}] : עובדים פעילים בהנהלה ראשית (0) או מתכנת (2), ממוינים א-ב */
  A5.settings.approvers = async function () {
    const d = await A5.api('/api/a5/settings/approvers');
    return Array.isArray(d && d.approvers) ? d.approvers : [];
  };

  /* שמירה: POST /api/settings {items:[{key,value,name}], employeeId?, pin?}  -- לא מורצה בפיתוח.
     value = ערך תצוגה. בלי {employeeId,pin}: השרת מאשר לפי העוגייה (הנהלה ראשית/מתכנת); אחרת 401 (err.status===401) ->
     הממשק פותח את אישור המנהל ומבצע שוב עם {employeeId, pin} של המאשר (השרת מאמת את הסיסמה במסד).
     מחזיר {ok:true}. שגיאות: 400 (ערך לא תקין: err.message="key: ..."), 401, 500 */
  A5.settings.save = async function (key, value, approval) {
    let s = known.get(key);
    if (!s) s = await A5.settings.get(key);
    const bad = A5.settings.validate(s, value);
    if (bad) { const e = new Error(bad); e.status = 400; throw e; }
    const body = { items: [{ key, value: toRaw(key, String(value)), name: s.name }] };
    if (approval && approval.employeeId && approval.pin) { body.employeeId = approval.employeeId; body.pin = approval.pin; }
    await A5.api('/api/settings', { method: 'POST', body });
    known.set(key, Object.assign({}, s, { currentValue: String(value) }));
    return { ok: true };
  };
})();
