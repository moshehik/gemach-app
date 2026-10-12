// lib/modelDisplay.js - "שם תצוגה של דגם" - מקור אמת יחיד (נושא 11 "ניהול דגמים", 12.10.2026).
//
// הבעיה: בגמ"ח נווה יעקב אין שמות לדגמים, רק מספר (barcodePrefix). הנתונים שם הם: שם = המספר עצמו (146 דגמים), "דגם 567" (אחד), ו-13 דגמים
// שהייבוא מאקסס כתב להם "ללא שם - <קוד_שמלה באקסס>" (המספר הזה הוא המזהה הפנימי באקסס ולא מספר הדגם!). כל מסך שהדפיס dress.name גולמי
// הציג לנווה "ללא שם - 1243". הפונקציות כאן הן הדרך היחידה להציג דגם:
//
//   שם תיאורי אמיתי (אם קיים) -> אחרת מספר הדגם -> אחרת fallback ('—'). לעולם לא "אין שם" / "ללא שם".
//   הגדרה useModelNames === false (קיימת: SystemSetting "הצגת שמות דגמים במערכת"; נווה = false): תמיד מספר בלבד, גם אם בשם יושב טקסט שיורי.
//   הגמ"ח הראשי (useModelNames = true / לא הוגדר): שם תיאורי מוצג כמו תמיד; רק שם חסר / "ללא שם..." מוחלף במספר.
//
// לוגיקה טהורה (בלי prisma / next / DOM) - נבדקת ב-scripts/test_model_display.mjs. מיובאת גם מהשרת וגם מהלקוח.
// חשוב: את המספר שאחרי "ללא שם -" לעולם לא מפרשים כקוד דגם. הקוד היחיד הוא barcodePrefix.

/** שמות "ממלאי מקום" שנכתבים/נכתבו בנתונים (ייבוא מאקסס, עקיפת שדה חובה בטופס): ריק, "ללא שם", "ללא שם - 12", "אין שם", "ללא_שם", no name, unnamed... */
const PLACEHOLDER_RE = /^(?:ללא[\s_-]*שם|אין[\s_-]*שם|לא[\s_-]*ידוע|no[\s_-]*name|unnamed|untitled|n\/a|null|undefined)(?![֐-׿A-Za-z])/i;
const DASH_ONLY_RE = /^[-–—_.\s]+$/;
const AUTO_PREFIX_RE = /^דגם\s+(\S+)$/;

/** ברירת המחדל כשאין לדגם לא שם אמיתי ולא מספר (נדיר: דגם מחוק בלי קוד). */
export const MODEL_FALLBACK = '—';

const str = (v) => (v === null || v === undefined ? '' : String(v));

/** קוד הדגם (barcodePrefix) כמחרוזת, או '' כשאין. מקבל {barcodePrefix} או {code}. */
export function modelCode(model) {
  if (!model || typeof model !== 'object') return '';
  const c = model.barcodePrefix !== undefined && model.barcodePrefix !== null && model.barcodePrefix !== '' ? model.barcodePrefix : model.code;
  const s = str(c).trim();
  return s;
}

/** האם זה שם "ריק" שלא מזהה את הדגם: חסר, רווחים, מקפים בלבד, או אחד מהמילוי הידועים. */
export function isPlaceholderModelName(name) {
  const s = str(name).trim();
  if (s === '') return true;
  if (DASH_ONLY_RE.test(s)) return true;
  return PLACEHOLDER_RE.test(s);
}

/** האם הגדרת האתר מאפשרת שמות דגמים. settings = מפה {key: value} או מערך שורות {key, value}. ברירת מחדל = כן (כמו בכל הקוד הקיים: !== 'false'). */
export function modelNamesEnabled(settings) {
  if (settings === undefined || settings === null) return true;
  let v;
  if (Array.isArray(settings)) { const row = settings.find((s) => s && s.key === 'useModelNames'); v = row ? row.value : undefined; }
  else if (typeof settings === 'object') v = settings.useModelNames;
  else v = settings;
  if (v === false) return false;
  return str(v).trim().toLowerCase() !== 'false';
}

/**
 * שם תצוגה של דגם. model = { name, barcodePrefix } (גם { code }). opts = { useModelNames, fallback }.
 * useModelNames === false -> מספר בלבד. undefined/true -> שם תיאורי אמיתי אם יש, אחרת מספר.
 */
export function modelDisplayName(model, opts = {}) {
  const fallback = opts.fallback === undefined ? MODEL_FALLBACK : opts.fallback;
  const code = modelCode(model);
  const raw = str(model && typeof model === 'object' ? model.name : model).trim();
  const placeholder = isPlaceholderModelName(raw);
  if (opts.useModelNames === false) {
    if (code) return code;
    if (placeholder) return fallback;
    const auto = AUTO_PREFIX_RE.exec(raw);
    return auto ? auto[1] : raw;
  }
  if (!placeholder) return raw;
  return code || fallback;
}

/** האם לדגם יש שם תיאורי אמיתי (לא ריק, לא "ללא שם", לא המספר עצמו, לא "דגם <מספר>") - ורק כשהאתר מאפשר שמות. */
export function modelHasRealName(model, opts = {}) {
  if (opts.useModelNames === false) return false;
  const raw = str(model && typeof model === 'object' ? model.name : model).trim();
  if (isPlaceholderModelName(raw)) return false;
  const code = modelCode(model);
  if (code && (raw === code || raw === `דגם ${code}`)) return false;
  if (/^\d+$/.test(raw) && !code) return false;
  return true;
}

/** הקוד לתצוגה נפרדת ליד השם ("דגם 4512"): רק כשיש שם תיאורי אמיתי (אחרת השם הוא הקוד עצמו - מציגים אותו פעם אחת). */
export function modelCodeSuffix(model, opts = {}) {
  const code = modelCode(model);
  if (!code) return '';
  return modelHasRealName(model, opts) ? code : '';
}

/** תווית לתיאור פריט / מסמך: "שם (קוד: 4512)" כשיש שם אמיתי, אחרת רק המספר. */
export function modelLabelWithCode(model, opts = {}) {
  const disp = modelDisplayName(model, opts);
  const code = modelCodeSuffix(model, opts);
  return code ? `${disp} (קוד: ${code})` : disp;
}

/** מחליף "ללא שם" / "ללא שם - 1243" / "ללא שם 3" בתוך טקסט חופשי (תיאורי חיוב, הערות). resolve(מחרוזת-המילוי) -> טקסט חלופי (מספר הדגם), או falsy = 'דגם'. */
export function replacePlaceholderModelNames(text, resolve) {
  const s = str(text);
  if (!s) return s;
  return s.replace(/(?:ללא[\s_-]*שם|אין[\s_-]*שם)(?:\s*-\s*\d+|\s+\d+)?(?![֐-׿])/g, (m) => {
    let r = null;
    try { r = typeof resolve === 'function' ? resolve(m.trim()) : null; } catch { r = null; }
    return r ? String(r) : 'דגם';
  });
}

/** שם הדגם שנכתב ל-DB כשיוצרים דגם בגמ"ח בלי שמות (useModelNames=false): מספר הדגם עצמו - כמו כל הדגמים שיובאו לנווה (שם = קוד). */
export function autoModelName(code) {
  const c = str(code).trim();
  return c || null;
}


/** טקסט פריט (description) שנשמר בעבר עם "ללא שם - N": מחליף את המילוי במספר הדגם (code). לא נוגע בטקסט בלי מילוי. */
export function scrubPlaceholderInText(text, code) {
  return replacePlaceholderModelNames(text, () => (code === null || code === undefined ? '' : String(code)));
}

/**
 * עותק של רשומת דגם (מ-API של רשימות / בוררים) כשהשדה name הוא שם התצוגה: שם אמיתי, אחרת המספר; null כשאין אף אחד.
 * רק לתשובות רשימה / בורר שמוצגות כמו שהן. את מסכי עריכת הדגם (GET /api/dresses/[id]) לא מעבירים כאן - שם צריך לראות ולתקן את השם הגולמי.
 */
export function withDisplayName(model, opts = {}) {
  if (!model || typeof model !== 'object') return model;
  const n = modelDisplayName(model, { ...opts, fallback: '' });
  return { ...model, name: n || null };
}
