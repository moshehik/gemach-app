// lib/modelNameCleanup.js - תכנון (טהור, בלי DB) של ניקוי שמות דגמים "ללא שם - N" (נושא 11 "ניהול דגמים", 12.10.2026).
// משמש את scripts/clean_placeholder_model_names.js (dry-run כברירת מחדל) ונבדק ב-scripts/test_model_name_cleanup.mjs.
//
// הרקע: ייבוא מאקסס כתב לכל דגם בלי שם את "ללא שם - <קוד_שמלה באקסס>" (scripts/import_from_access.js; תוקן באותו נושא).
// ה-N הוא המזהה הפנימי של אקסס ולא מספר הדגם. מספר הדגם הוא barcodePrefix, ולכן שם חלופי = מספר הדגם עצמו
// (כמו 146 דגמי נווה שיובאו עם שם = קוד). הצגה כבר מתוקנת בקוד (lib/modelDisplay.js) - הניקוי רק מסיר את הטקסט מהנתונים.
import { isPlaceholderModelName, replacePlaceholderModelNames } from './modelDisplay.js';

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).toLowerCase();
const codeOf = (m) => (m && m.barcodePrefix !== null && m.barcodePrefix !== undefined && m.barcodePrefix !== '' ? String(m.barcodePrefix).trim() : '');

/**
 * דגמים לשינוי שם.
 * @param {{id:string,name:string|null,barcodePrefix:number|string|null,isDeleted?:boolean}[]} models כל הדגמים (כולל מחוקים - השם UNIQUE גם עליהם)
 * @param {{useModelNames?:boolean}} opts useModelNames === false: גם "דגם <קוד>" הופך ל-"<קוד>"
 * @returns {{renames:{id:string,from:string,to:string|null,reason:string}[], collisions:{id:string,from:string,wanted:string,heldBy:string}[], unchanged:number}}
 */
export function planModelRenames(models, opts = {}) {
  const taken = new Map(); // key(name) -> id (כולל שמות שיתפסו תוך כדי התכנון)
  for (const m of models) if (norm(m.name)) taken.set(key(m.name), m.id);
  const renames = [];
  const collisions = [];
  let unchanged = 0;
  for (const m of models) {
    const from = norm(m.name);
    if (!from) { unchanged++; continue; } // שם ריק / null: לא נוגעים (ההצגה בטוחה)
    const code = codeOf(m);
    let to;
    let reason;
    if (isPlaceholderModelName(from)) { to = code || null; reason = 'placeholder'; }
    else if (opts.useModelNames === false && code && key(from) === key(`דגם ${code}`)) { to = code; reason = 'auto-name'; }
    else { unchanged++; continue; }
    if (to === null) { // מילוי ואין מספר דגם: מאפסים ל-NULL (אפשרי בכמה שורות - UNIQUE מתעלם מ-NULL)
      taken.delete(key(from));
      renames.push({ id: m.id, from: m.name, to: null, reason });
      continue;
    }
    const holder = taken.get(key(to));
    if (holder && holder !== m.id) { collisions.push({ id: m.id, from: m.name, wanted: to, heldBy: holder }); continue; }
    taken.delete(key(from));
    taken.set(key(to), m.id);
    renames.push({ id: m.id, from: m.name, to, reason });
  }
  return { renames, collisions, unchanged };
}

/** שדה DressItem.dressName (ישן) עם מילוי -> מספר הדגם של הפריט (או NULL בלי דגם). items: {id, dressName, barcodePrefix} (barcodePrefix של הדגם המקושר). */
export function planItemDressNames(items) {
  const out = [];
  for (const it of items) {
    if (!norm(it.dressName) || !isPlaceholderModelName(it.dressName)) continue;
    const code = codeOf(it);
    out.push({ id: it.id, from: it.dressName, to: code || null });
  }
  return out;
}

/**
 * תיאורי חיוב (PaymentObligation.description) שנשמרו עם "ללא שם - N". nameToCode: מפה {שם-המילוי-המקורי -> מספר הדגם} (נבנית לפני שינוי השמות).
 * שורה שיש בה מילוי שאין לו מספר ידוע לא משתנה (נספרת ב-unresolved) - לא ממציאים.
 */
export function planObligationTexts(rows, nameToCode) {
  const map = new Map([...nameToCode].map(([k, v]) => [key(k), v]));
  const updates = [];
  let unresolved = 0;
  for (const r of rows) {
    const from = String(r.description == null ? '' : r.description);
    let missing = false;
    const to = replacePlaceholderModelNames(from, (found) => {
      const c = map.get(key(found));
      if (!c) missing = true;
      return c || found;
    });
    if (missing) { unresolved++; continue; }
    if (to !== from) updates.push({ id: r.id, from, to });
  }
  return { updates, unresolved };
}
