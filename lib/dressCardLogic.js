// lib/dressCardLogic.js - הלוגיקה הטהורה של כרטיס הדגם החדש (A5): מודל תצוגה מנתוני השרת, אבחון שינויים ("שינויים בכרטיס" ברייל),
// תוכנית שמירה (אותם endpoints ואותם payloads כמו הדף הישן), ספירות, סימוני לשוניות, סריקת ברקוד, מיפוי השכרות ובניית שורות
// היסטוריה מ-AuditLog. בלי React ובלי fetch - נבדק ב-node (scripts/test_dress_card_logic.mjs).
//
// מקור העיצוב: scratch/emp-models-build/model-card.js (הדגם המאושר, 9.10.2026). מקור ההתנהגות: app/dashboard/dresses/[id]/page.js ו-
// components/dresses/modern/* (הדף הישן, קפוא ב-LegacyDressCardPage.js).
//
// מודל התצוגה:
//   model = { id, name, code, cat, notes, active, reason, exit, inspect, entry, img, thumb, premium, isDeleted }
//     active = אין exitDateFromRepo (כמו hasExitDate בדף הישן); exit / entry = מפתח יום ישראלי 'YYYY-MM-DD'.
//   item  = { id, size, serial, bc, loc, carton, repair, unused, why, del, ent, since }
import { israelDayKey, israelTime, hDayShort, hDayYear } from './attendance/summary.js';
import { isPlaceholderModelName, autoModelName } from './modelDisplay.js';

// ---------- קבועים ----------
// השדות של הדגם שנשמרים בלחצן השמירה (זהה ל-MODEL_FIELDS בדף הישן)
export const MODEL_FIELDS = ['name', 'barcodePrefix', 'priceCategory', 'notes', 'inInspection', 'imageUrl', 'thumbnailUrl', 'entryDateToRepo', 'exitDateFromRepo', 'inactiveReason', 'isSplit', 'isPremium'];
// חייב להיות זהה ל-ACTIVITY_TOGGLE_FIELDS בשרת (app/api/dresses/[id]/route.js): בקשה שמכילה רק אותם - מותרת לכל עובדת
export const ACTIVITY_TOGGLE_FIELDS = ['exitDateFromRepo', 'entryDateToRepo', 'inactiveReason'];
export const DEFAULT_LOCATIONS = ['חנות', 'רזרבה', 'מחסן'];
export const LOCATION_ICON = { 'חנות': 'store', 'רזרבה': 'flag', 'מחסן': 'box' };
export const locIcon = (loc) => LOCATION_ICON[loc] || 'pin';
export const ST_LABEL = { normal: 'תקין', repair: 'בתיקון', unused: 'לא בשימוש', deleted: 'מחוק' };
export const ST_ICON = { normal: 'check', repair: 'scissors', unused: 'ban', deleted: 'trash' };
export const RET_LABEL = { out: 'טרם הוחזר', ok: 'הוחזר תקין', bad: 'הוחזר עם בעיה' };
export const RET_ICON = { out: 'clock', ok: 'check', bad: 'alert' };

// ---------- עזרים כלליים ----------
export const pad2 = (n) => String(n).padStart(2, '0');
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const short = (v) => { const s = String(v == null ? '' : v); return s.length > 26 ? `${s.slice(0, 26)}…` : s; };
export const plural = (n, one, many, zero) => { if (n === 0 && zero !== undefined) return zero; return n === 1 ? one : `${n} ${many}`; };
const dayOf = (v) => (v ? israelDayKey(v) || '' : '');
export const hFull = (key) => (key ? hDayYear(key) : '');
export const hShort = (key) => (key ? hDayShort(key) : '');
export const weekdayName = (key) => new Date(`${key}T12:00:00`).toLocaleDateString('he-IL', { weekday: 'long' });
export const dayTitle = (key) => (key ? `${weekdayName(key)} ${hDayYear(key)}` : '');
export const addDays = (key, n) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/** ברקוד פריט: קוד הדגם + מידה (2 ספרות) + מס' סידורי (2 ספרות) - אותה נוסחה כמו buildBarcode בדף הישן */
export const bcOf = (prefix, size, serial) => `${prefix == null ? '' : prefix}${pad2(size)}${pad2(serial)}`;
/** הברקוד לתצוגה: הערך השמור בשרת (פריטים ישנים), ובחוסר - הנגזר */
export const bcFor = (item, prefix) => item.bc || bcOf(prefix, item.size, item.serial);

// ---------- מודל תצוגה מנתוני השרת ----------
export function modelFromServer(m) {
  const exit = dayOf(m.exitDateFromRepo);
  return {
    id: m.id,
    name: m.name || '',
    code: m.barcodePrefix == null ? '' : String(m.barcodePrefix),
    cat: m.priceCategory || '',
    notes: m.notes || '',
    active: !m.exitDateFromRepo,
    reason: m.inactiveReason || '',
    exit,
    inspect: !!m.inInspection,
    entry: dayOf(m.entryDateToRepo),
    img: m.imageUrl || '',
    thumb: m.thumbnailUrl || '',
    premium: !!m.isPremium,
    isDeleted: !!m.isDeleted,
  };
}

export function itemFromServer(i) {
  return {
    id: i.id,
    size: i.sizeText == null ? '' : String(i.sizeText),
    serial: i.serialNumber == null ? '' : i.serialNumber,
    bc: i.dressBarcode || '',
    loc: i.location || '',
    carton: i.cartonNumber == null ? '' : String(i.cartonNumber),
    repair: !!i.inRepair,
    unused: !!i.notInUse,
    why: i.notInUseReason || '',
    del: !!i.isDeleted,
    ent: dayOf(i.entryDateToRepo),
    since: i.notInUseSince || null,
  };
}

// ---------- נגזרות ----------
export const stOf = (it) => (it.del ? 'deleted' : it.unused ? 'unused' : it.repair ? 'repair' : 'normal');

export function counts(items) {
  const a = items.filter((i) => !i.del);
  return {
    n: a.length,
    avail: a.filter((i) => !i.repair && !i.unused).length,
    repair: a.filter((i) => i.repair).length,
    unused: a.filter((i) => i.unused).length,
    reserve: a.filter((i) => i.loc === 'רזרבה').length,
    att: a.filter((i) => i.repair || i.unused).length,
  };
}

const sizeNum = (s) => { const n = Number(s); return s !== '' && Number.isFinite(n) ? n : null; };
/** מפתח מיון פריט: מידות מספריות לפי המספר, אחריהן טקסטואליות; בתוך מידה - לפי מס' סידורי */
export function compareItems(a, b) {
  const an = sizeNum(a.size); const bn = sizeNum(b.size);
  if (an !== null && bn !== null && an !== bn) return an - bn;
  if (an !== null && bn === null) return -1;
  if (an === null && bn !== null) return 1;
  if (an === null && bn === null && a.size !== b.size) return String(a.size).localeCompare(String(b.size), 'he');
  return (Number(a.serial) || 0) - (Number(b.serial) || 0);
}
export const itemSortKey = (it) => (sizeNum(it.size) ?? 9999) * 1000 + (Number(it.serial) || 0);

/** המספר הסידורי הבא למידה (כמו nextSerialFor בדף הישן) */
export function nextSerial(items, size) {
  const same = items.filter((i) => String(i.size).trim() === String(size).trim() && i.serial !== '' && i.serial != null);
  return same.length ? Math.max(...same.map((i) => parseInt(i.serial, 10) || 0)) + 1 : 1;
}

/** טווחי מספרים סידוריים: 1,2,3,5 -> "01–03, 05" */
export function ranges(serials) {
  const nums = serials.map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  if (!nums.length) return '';
  const out = [];
  let st = nums[0]; let pv = nums[0];
  for (let i = 1; i <= nums.length; i++) {
    if (nums[i] === pv + 1) { pv = nums[i]; continue; }
    out.push(st === pv ? pad2(st) : `${pad2(st)}–${pad2(pv)}`);
    st = nums[i]; pv = nums[i];
  }
  return out.join(', ');
}

/** אימות הוספת פריט (כמו addItem בדף הישן + כלל "ברקוד כבר קיים" של השרת): מחזיר { error } או { size, serial, bc } */
export function validateNewItem(items, prefix, { size, serial }) {
  const sz = String(size == null ? '' : size).trim();
  if (!sz) return { error: 'חובה להזין מידה' };
  const n = Number(sz);
  if (Number.isNaN(n) || n < 0 || n > 99 || !Number.isInteger(n)) return { error: 'מידה חייבת להיות מספר שלם בין 0 ל-99' };
  const sr = serial !== '' && serial != null ? Number(serial) : nextSerial(items, sz);
  if (Number.isNaN(sr) || sr < 0 || sr > 99 || !Number.isInteger(sr)) return { error: 'מס׳ סידורי חייב להיות מספר שלם בין 0 ל-99' };
  const bc = bcOf(prefix, n, sr);
  if (items.some((i) => !i.del && bcFor(i, prefix) === bc)) return { error: `פריט עם הברקוד ${bc} כבר קיים` };
  return { size: String(n), serial: sr, bc };
}

/** סריקת ברקוד בכרטיס: ברקוד מלא, או הסיומת (מידה+סידורי, לפחות 4 ספרות) - כמו scan() בעיצוב */
export function scanMatch(items, prefix, value) {
  const v = String(value || '').trim();
  if (!v) return null;
  const hits = items.filter((i) => { const bc = bcFor(i, prefix); return bc === v || (v.length >= 4 && bc.endsWith(v) && bc.length - v.length <= 4); });
  // פריט פעיל קודם למחוק
  return hits.find((i) => !i.del) || hits[0] || null;
}

// ---------- סימוני לשוניות (בלי מונים - סמני התראה בלבד) ----------
export function tabMarkers({ items, rentalStats }) {
  const att = counts(items).att;
  const od = rentalStats ? rentalStats.overdue || 0 : 0;
  return {
    items: att > 0 ? { key: 'items', cls: 'debt', icon: 'alert', tip: att === 1 ? 'פריט אחד דורש טיפול' : `${att} פריטים דורשים טיפול` } : null,
    rentals: od > 0 ? { key: 'rentals', cls: 'debt', icon: 'alert', tip: od === 1 ? 'השכרה אחת ממתינה להחזרה' : `${od} השכרות ממתינות להחזרה` } : null,
  };
}

// ---------- שינויים ממתינים ("שינויים בכרטיס") ----------
const notesSnip = (o, n) => {
  const a = String(o || ''); const b = String(n || '');
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  const from = Math.max(0, p - 6);
  const cut = (x) => (from ? '…' : '') + (x.slice(from, from + 22) || 'ריק') + (x.length > from + 22 ? '…' : '');
  return [cut(a), cut(b)];
};
const showV = (k, v) => {
  if (k === 'entry' || k === 'exit') return v ? hFull(v) : 'ריק';
  if (k === 'active') return v ? 'פעיל' : 'לא פעיל';
  if (k === 'inspect') return v ? 'מופעל' : 'כבוי';
  if (k === 'premium') return v ? 'פרימיום' : 'רגילה';
  if (k === 'img') return v ? 'תמונה מקושרת' : 'ללא תמונה';
  return String(v == null ? '' : v).trim() ? short(v) : 'ריק';
};
const seg = (t, b) => ({ t, b: !!b });

/**
 * שורות העגלה. כל שורה: { k, icon, label, scope:'model'|'item', kind, bc?, text:[{t,b}], plain, old, nw, note }
 * (text = מקטעים עם הדגשה, במקום ה-HTML של העיצוב; plain/old/nw/kind משמשים את רישום היומן ואת חלון הסיכום).
 */
export function diffChanges(saved, cur) {
  const out = [];
  const S = saved.model; const C = cur.model;
  const F = (k, label, icn, kind) => {
    if (S[k] === C[k]) return;
    let o = showV(k, S[k]); let n = showV(k, C[k]);
    if (k === 'notes') [o, n] = notesSnip(S[k], C[k]);
    out.push({ k: `f:${k}`, icon: icn, label, scope: 'model', kind: kind || 'details', text: [seg(label, true), seg(' עודכן')], plain: `עודכן: ${label}`, old: o, nw: n, note: `${o} ← ${n}` });
  };
  F('name', 'שם דגם', 'tag'); F('cat', 'קטגוריית מחיר', 'card'); F('entry', 'תאריך כניסה למאגר', 'cal'); F('notes', 'הערות לדגם', 'note'); F('img', 'תמונת הדגם', 'dress');
  if (S.active !== C.active) {
    const o = showV('active', S.active);
    const n = showV('active', C.active);
    out.push({
      k: 'f:active', icon: C.active ? 'check' : 'ban', label: 'סטטוס פעילות', scope: 'model', kind: 'status',
      text: [seg(C.active ? 'הדגם הוחזר לפעילות' : 'הדגם סומן כלא פעיל', true)], plain: C.active ? 'הדגם הוחזר לפעילות' : 'הדגם סומן כלא פעיל',
      old: o, nw: n + (C.active ? '' : ` · ${C.reason || 'ללא סיבה'}`), note: `${o} ← ${n}${C.active ? '' : ` · ${short(C.reason || 'ללא סיבה')}`}`,
    });
  } else if (!C.active && (S.reason !== C.reason || S.exit !== C.exit)) {
    const o = `${short(S.reason || 'ללא סיבה')} · ${hShort(S.exit)}`;
    const n = `${short(C.reason || 'ללא סיבה')} · ${hShort(C.exit)}`;
    out.push({ k: 'f:active', icon: 'ban', label: 'סיבת אי-פעילות', scope: 'model', kind: 'status', text: [seg('סיבת אי-פעילות', true), seg(' עודכנה')], plain: 'עודכנה סיבת אי-פעילות', old: o, nw: n, note: `${o} ← ${n}` });
  }
  F('inspect', 'הצגה בבדיקה', 'eye', 'status');
  F('premium', 'שמלת פרימיום', 'tag', 'details');
  const prefix = C.code;
  cur.items.forEach((ci) => {
    const si = saved.items.find((x) => x.id === ci.id);
    const bc = bcFor(ci, prefix);
    const nm = [seg('פריט ', true), { t: bc, b: true, bdi: true }];
    if (!si) {
      const d = `מידה ${ci.size} · ${ci.loc || '—'}`;
      out.push({ k: `i:${ci.id}:add`, icon: 'plus', label: 'פריט חדש', scope: 'item', kind: 'add', bc, text: [seg('נוסף '), ...nm], plain: 'נוסף פריט', old: '—', nw: d, note: d });
      return;
    }
    const P = (f, label, icn, kind, o, n, txt) => out.push({ k: `i:${ci.id}:${f}`, icon: icn, label, scope: 'item', kind, bc, text: [...nm, seg(` ${txt || `${label} עודכן`}`)], plain: txt || `${label} עודכן`, old: o, nw: n, note: `${o} ← ${n}` });
    if (si.del !== ci.del) P('del', 'מחיקה', ci.del ? 'trash' : 'refresh', 'del', ci.del ? 'קיים' : 'מחוק', ci.del ? 'מחוק' : 'קיים', ci.del ? 'נמחק' : 'שוחזר');
    if (si.loc !== ci.loc) P('loc', 'מיקום', 'pin', 'loc', si.loc || '—', ci.loc || '—', 'מיקום עודכן');
    if ((si.carton || '') !== (ci.carton || '')) P('carton', 'מס׳ קרטון', 'hash', 'loc', si.carton || '—', ci.carton || '—', 'מס׳ קרטון עודכן');
    if (si.repair !== ci.repair) P('repair', 'בתיקון', 'scissors', 'repair', si.repair ? 'בתיקון' : 'לא בתיקון', ci.repair ? 'בתיקון' : 'לא בתיקון', ci.repair ? 'סומן בתיקון' : 'הוצא מתיקון');
    if (si.unused !== ci.unused || (ci.unused && si.why !== ci.why)) {
      P('unused', 'לא בשימוש', 'ban', 'unused',
        si.unused ? `לא בשימוש${si.why ? ` · ${short(si.why)}` : ''}` : 'בשימוש',
        ci.unused ? `לא בשימוש${ci.why ? ` · ${short(ci.why)}` : ''}` : 'בשימוש',
        ci.unused ? (si.unused ? 'סיבת אי-שימוש עודכנה' : 'סומן כלא בשימוש') : 'הוחזר לשימוש');
    }
  });
  return out;
}

export const isItemPending = (saved, it) => {
  const s = saved.items.find((x) => x.id === it.id);
  if (!s) return true;
  return ['loc', 'carton', 'repair', 'unused', 'why', 'del'].some((k) => s[k] !== it[k]);
};

/** ביטול שורת שינוי אחת: מחזיר מצב cur חדש (לא משנה את הקלט) */
export function undoChange(saved, cur, key) {
  const next = clone(cur);
  const p = key.split(':');
  if (p[0] === 'f') {
    if (p[1] === 'active') { next.model.active = saved.model.active; next.model.reason = saved.model.reason; next.model.exit = saved.model.exit; }
    else {
      next.model[p[1]] = saved.model[p[1]];
      if (p[1] === 'img') next.model.thumb = saved.model.thumb;
    }
  } else {
    const id = p[1]; const f = p[2];
    if (f === 'add') next.items = next.items.filter((x) => String(x.id) !== String(id));
    else {
      const s = saved.items.find((x) => String(x.id) === String(id));
      const c = next.items.find((x) => String(x.id) === String(id));
      if (s && c) { if (f === 'unused') { c.unused = s.unused; c.why = s.why; } else c[f] = s[f]; }
    }
  }
  return next;
}

/** מחיקת פריט בעגלה: פריט שלא נשמר עוד מוסר לגמרי, שמור - מסומן כמחוק (כמו delItem בעיצוב) */
export function deleteItemLocal(saved, cur, id) {
  const next = clone(cur);
  const it = next.items.find((x) => String(x.id) === String(id));
  if (!it) return next;
  if (!saved.items.find((x) => String(x.id) === String(id))) next.items = next.items.filter((x) => x !== it);
  else it.del = true;
  return next;
}

// ---------- תוכנית שמירה: אותם endpoints ואותם payloads כמו הדף הישן ----------
// model: הדגם כפי שנשלף מהשרת (raw) - הערכים הלא-משתנים נשלחים כמו שהם (תאריכים עם השעה המקורית).
export function buildModelPayload(raw, cur, { useModelNames = true } = {}) {
  const C = cur.model;
  const sameDay = (iso, key) => dayOf(iso) === key;
  const payload = {
    name: C.name,
    barcodePrefix: raw.barcodePrefix ?? null,
    priceCategory: C.cat || null,
    notes: C.notes,
    inInspection: C.inspect,
    imageUrl: C.img || null,
    thumbnailUrl: C.thumb || null,
    entryDateToRepo: C.entry && sameDay(raw.entryDateToRepo, C.entry) ? raw.entryDateToRepo : (C.entry || null),
    exitDateFromRepo: C.active ? null : (C.exit && sameDay(raw.exitDateFromRepo, C.exit) ? raw.exitDateFromRepo : (C.exit || null)),
    inactiveReason: C.active ? null : (C.reason || null),
    isSplit: raw.isSplit ?? null,
    isPremium: C.premium,
  };
  // גמ"ח בלי שמות דגמים: השם הוא מספר הדגם עצמו (כמו דגמי נווה שיובאו), לא "דגם <קוד>" ולא "ללא שם - N" (lib/modelDisplay.js; השרת אוכף את אותו כלל)
  if (!useModelNames && isPlaceholderModelName(payload.name)) payload.name = autoModelName(payload.barcodePrefix) || payload.name;
  return payload;
}

const MODEL_LINE_KEYS = ['f:name', 'f:cat', 'f:entry', 'f:notes', 'f:img', 'f:active', 'f:inspect', 'f:premium'];
const ACTIVITY_LINE_KEYS = ['f:active'];

/**
 * @returns {{id:string, lines:string[], req:{method:string,url:string,body?:object}, kind:string, itemId?:any}[]}
 * סדר: דגם, אחר כך פריטים (עריכות, מחיקות, הוספות).
 */
export function buildSavePlan({ saved, cur, raw, locations = DEFAULT_LOCATIONS, useModelNames = true, now = new Date() }) {
  const lines = diffChanges(saved, cur);
  const keys = lines.map((l) => l.k);
  const steps = [];
  const modelKeys = keys.filter((k) => MODEL_LINE_KEYS.includes(k));
  if (modelKeys.length) {
    const body = buildModelPayload(raw, cur, { useModelNames });
    // סימון פעיל/לא פעיל (ותאריך הכניסה) נשלח כבקשה שמכילה רק את ACTIVITY_TOGGLE_FIELDS - כך מותר לכל עובדת (ר' route.js של השרת)
    const activityOnly = modelKeys.every((k) => ACTIVITY_LINE_KEYS.includes(k) || k === 'f:entry');
    const payload = activityOnly ? Object.fromEntries(ACTIVITY_TOGGLE_FIELDS.map((f) => [f, body[f]])) : body;
    steps.push({ id: 'model', kind: 'model', lines: modelKeys, req: { method: 'PUT', url: `/api/dresses/${cur.model.id}`, body: payload } });
  }
  const prefix = cur.model.code;
  cur.items.forEach((ci) => {
    const si = saved.items.find((x) => String(x.id) === String(ci.id));
    if (!si) {
      if (ci.del) return;
      steps.push({
        id: `item:${ci.id}:add`, kind: 'add', itemId: ci.id, lines: [`i:${ci.id}:add`],
        req: {
          method: 'POST', url: `/api/dresses/${cur.model.id}/items`,
          body: {
            sizeText: String(ci.size).trim(), serialNumber: ci.serial, dressBarcode: bcFor(ci, prefix),
            location: ci.loc || locations[0] || null, barcodePrefix: raw.barcodePrefix, dressName: cur.model.name, entryDateToRepo: now.toISOString(),
          },
        },
      });
      return;
    }
    const lk = (f) => `i:${ci.id}:${f}`;
    const fieldLines = ['loc', 'carton', 'repair', 'unused'].map(lk).filter((k) => keys.includes(k));
    if (si.del && !ci.del) {
      steps.push({ id: `item:${ci.id}:restore`, kind: 'restore', itemId: ci.id, lines: [lk('del')], req: { method: 'PUT', url: `/api/dresses/items/${ci.id}`, body: { isDeleted: false } } });
    }
    if (fieldLines.length) {
      const body = {};
      if (keys.includes(lk('loc'))) body.location = ci.loc || null;
      if (keys.includes(lk('carton'))) body.cartonNumber = ci.carton || null;
      if (keys.includes(lk('repair')) || keys.includes(lk('unused'))) {
        body.inRepair = ci.repair; body.notInUse = ci.unused;
        body.notInUseSince = ci.unused ? (si.since || now.toISOString()) : null;
        body.notInUseReason = ci.unused ? (ci.why || null) : null;
      }
      steps.push({ id: `item:${ci.id}:edit`, kind: 'edit', itemId: ci.id, lines: fieldLines, req: { method: 'PUT', url: `/api/dresses/items/${ci.id}`, body } });
    }
    if (!si.del && ci.del) {
      steps.push({ id: `item:${ci.id}:del`, kind: 'delete', itemId: ci.id, lines: [lk('del')], req: { method: 'DELETE', url: `/api/dresses/items/${ci.id}` } });
    }
  });
  return steps;
}

/**
 * מיישם תוצאת צעד שהצליח על (saved, cur). data = גוף התשובה של השרת. מחזיר { saved, cur, raw }.
 * צעדים שנכשלו לא מיושמים - השינויים שלהם נשארים בעגלה.
 */
export function applyStepResult({ saved, cur, raw }, step, data) {
  const S = clone(saved); const C = clone(cur);
  let R = raw;
  if (step.kind === 'model') {
    // השרת מחזיר את הדגם המעודכן; הערכים השמורים = הערכים בעגלה (אותו מקור), ה-raw מתעדכן לתאריכים המדויקים
    R = data && typeof data === 'object' ? { ...raw, ...data } : raw;
    const m = modelFromServer({ ...R, barcodePrefix: R.barcodePrefix });
    S.model = { ...C.model, id: S.model.id, isDeleted: m.isDeleted };
    C.model = { ...C.model, isDeleted: m.isDeleted };
  } else if (step.kind === 'add') {
    const it = itemFromServer(data);
    S.items = [...S.items.filter((x) => String(x.id) !== String(step.itemId)), it];
    C.items = C.items.map((x) => (String(x.id) === String(step.itemId) ? { ...it } : x));
  } else if (step.kind === 'delete') {
    S.items = S.items.map((x) => (String(x.id) === String(step.itemId) ? { ...x, del: true } : x));
    C.items = C.items.map((x) => (String(x.id) === String(step.itemId) ? { ...x, del: true } : x));
  } else {
    const it = itemFromServer(data);
    const ci = C.items.find((x) => String(x.id) === String(step.itemId));
    // השורה השמורה = מה שהשרת החזיר; השורה בעגלה נשארת (אולי יש בה עוד שינוי שעוד לא נשלח - למשל מחיקה)
    S.items = S.items.map((x) => (String(x.id) === String(step.itemId) ? { ...it, del: step.kind === 'restore' ? false : x.del } : x));
    if (ci && step.kind === 'restore') ci.del = false;
  }
  return { saved: S, cur: C, raw: R };
}

// ---------- מחיקת דגם ----------
export const deleteBlockedReason = (items) => { const n = counts(items).n; return n > 0 ? `לא ניתן למחוק דגם שיש בו פריטים פעילים במלאי (כרגע ${n})` : ''; };

// ---------- השכרות ----------
/** שורת השכרה מהתשובה של /api/dresses/[id]/rentals (לפי אותו סדר ששרת מחזיר, id = אינדקס יציב) */
export function rentalFromServer(r, i, todayKey) {
  const event = dayOf(r.eventDate);
  const taken = r.isTaken || r.takenDate ? dayOf(r.takenDate) : '';
  const ret = !r.isReturned ? 'out' : r.returnedOk === false ? 'bad' : 'ok';
  const overdue = !!(r.isTaken && !r.isReturned && event && event < todayKey);
  return {
    id: i + 1, order: r.orderId, cust: r.customerName || '', size: r.sizeText == null ? '' : String(r.sizeText),
    bc: r.dressBarcode || '', event, taken, ret, overdue, note: '', retDate: r.isReturned ? dayOf(r.returnDate) : '',
  };
}

/** צמתי "יומן הדגם" (כניסה -> השכרה אחרונה -> השכרה קרובה / החזרה צפויה | יציאה). המועד הצפוי להחזרה: יום העבודה הראשון אחרי האירוע (lib/lateReturn.js getExpectedReturnKey) */
// nextWorking(key): יום העבודה הראשון אחרי יום (lib/businessDays.js nextWorkingDay; מוזרק מהרכיב - המודול הזה נשאר טהור ורץ ב-node פשוט)
export function lifeNodes({ model, rentals, todayKey, nextWorking = (k) => addDays(k, 1) }) {
  const nodes = [{ k: 'entry', l: 'נכנס למאגר', i: 'cal', date: model.entry, done: true, info: 'נרשם במאגר' }];
  const withEvent = rentals.filter((r) => r.event);
  const past = withEvent.filter((r) => r.event <= todayKey).sort((a, b) => (a.event < b.event ? 1 : -1))[0];
  const fut = withEvent.filter((r) => r.event > todayKey).sort((a, b) => (a.event < b.event ? -1 : 1))[0];
  if (past) nodes.push({ k: 'last', l: 'השכרה אחרונה', i: 'bag', date: past.event, done: true, info: `הזמנה #${past.order} · ${past.cust}` });
  if (!model.active) nodes.push({ k: 'exit', l: 'יציאה מהמאגר', i: 'ban', date: model.exit || todayKey, done: (model.exit || todayKey) <= todayKey, info: `סיבה: ${model.reason || '—'}` });
  else if (fut) {
    nodes.push({ k: 'next', l: 'השכרה קרובה', i: 'gift', date: fut.event, done: false, info: `הזמנה #${fut.order} · ${fut.cust}` });
    nodes.push({ k: 'ret', l: 'החזרה צפויה', i: 'undo', date: nextWorking(fut.event) || addDays(fut.event, 1), done: false, info: `הזמנה #${fut.order}` });
  }
  nodes.forEach((n, o) => { n.o = o; });
  nodes.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.o - b.o));
  const idx = nodes.findIndex((n) => !n.done);
  nodes.forEach((n, i) => { n.cur = i === idx && dayDiff(todayKey, n.date) <= 0; });
  return nodes;
}

// ---------- היסטוריה (AuditLog -> שורות בעיצוב המאושר) ----------
// הרישום האוטומטי (app/lib/prisma.js) שומר ב-UPDATE את מה שנשלח בבקשה (כל MODEL_FIELDS בכל שמירה, לא רק מה ששונה) ואין בו "לפני".
// לכן: מעבדים את הרישומים של כל ישות מהישן לחדש, מנהלים מצב מצטבר, ושורה נוצרת רק לשדה שערכו שונה מהמצב הקודם; "לפני" = הערך
// הקודם. ישות שאין לה רישום CREATE והרישום הראשון שלה הוא עדכון - נוצרת שורה אחת "עודכנו פרטי הדגם/הפריט" עם הערכים (אין מה להשוות).
export const HISTORY_KINDS = [['details', 'עדכון פרטים', 'pencil'], ['status', 'פעילות ובדיקה', 'sliders'], ['loc', 'מיקום וקרטון', 'pin'], ['care', 'תיקון / לא בשימוש', 'scissors'], ['add', 'הוספה / מחיקה', 'plus'], ['doc', 'מסמכים', 'print']];
export const kindGroup = (k) => ({ create: 'add', add: 'add', del: 'add', details: 'details', status: 'status', loc: 'loc', repair: 'care', unused: 'care', print: 'doc' }[k] || 'details');

const parseChanges = (raw) => { try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const isFT = (v) => v && typeof v === 'object' && !Array.isArray(v) && ('from' in v || 'to' in v);
const norm = (v) => (v === undefined ? null : v && typeof v === 'object' && !isFT(v) && 'set' in v ? v.set : v);
const nv = (v) => (v === undefined || v === null || v === '' || v === false ? '' : v);
const same = (a, b) => nv(a) === nv(b);
const yesNo = (v) => (v ? 'כן' : 'לא');
const dateV = (v) => (v ? hFull(dayOf(v)) : 'ריק');
const txtV = (v) => (String(v == null ? '' : v).trim() ? short(v) : 'ריק');

const MODEL_FIELD_LABEL = { name: 'שם דגם', barcodePrefix: 'קוד דגם', priceCategory: 'קטגוריית מחיר', notes: 'הערות לדגם', entryDateToRepo: 'תאריך כניסה למאגר', exitDateFromRepo: 'תאריך יציאה', inactiveReason: 'סיבה', inInspection: 'הצגה בבדיקה', imageUrl: 'תמונת הדגם', thumbnailUrl: 'תמונה ממוזערת', isPremium: 'פרימיום', isSplit: 'דגם מפוצל', isDeleted: 'מחיקה' };
const ITEM_FIELD_LABEL = { sizeText: 'מידה', serialNumber: 'מס׳ סידורי', dressBarcode: 'ברקוד', location: 'מיקום', cartonNumber: 'מס׳ קרטון', inRepair: 'בתיקון', notInUse: 'לא בשימוש', notInUseReason: 'סיבה', isDeleted: 'מחיקה' };
const IGNORED = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'dressModelId', 'legacyId', 'locationNum', 'quantity', 'dressName', 'barcodePrefix_', 'notInUseSince', 'isSplit', 'entryDateToRepo_']);

/** @returns {Array} שורות { id, ts:'YYYY-MM-DDTHH:MM', scope, kind, icon, text, who, bc, det:[[label,value]] , prev, next } ממוינות מהחדש לישן */
export function buildDressHistoryRows({ modelLogs = [], itemLogs = [], items = [], prefix = '' }) {
  const bcById = new Map(items.map((i) => [String(i.id), bcFor(i, prefix)]));
  const asc = (a, b) => (new Date(a.createdAt) - new Date(b.createdAt)) || String(a.id).localeCompare(String(b.id));
  const rows = [];
  const stamp = (l) => { const d = israelDayKey(l.createdAt) || ''; const t = israelTime(l.createdAt) || ''; return `${d}T${t}`; };
  const who = (l) => l.employeeName || 'המערכת';
  const push = (l, n, r) => rows.push({ id: `${l.id}:${n}`, lid: String(l.id), n, ts: stamp(l), who: who(l), bc: '', det: [], prev: '', next: '', ...r });
  const byEntity = (logs) => { const m = new Map(); [...logs].sort(asc).forEach((l) => { const k = String(l.entityId); if (!m.has(k)) m.set(k, []); m.get(k).push(l); }); return m; };

  // ----- הדגם -----
  byEntity(modelLogs).forEach((logs) => {
    let state = null;
    logs.forEach((l) => {
      const ch = parseChanges(l.changesJson);
      const vals = {}; Object.keys(ch).forEach((k) => { vals[k] = isFT(ch[k]) ? ch[k].to : norm(ch[k]); });
      if (l.action === 'CREATE') {
        state = { ...vals };
        push(l, 0, { scope: 'model', kind: 'create', icon: 'plus', text: 'הדגם נוצר', det: [['שם דגם', txtV(vals.name)], ['קוד דגם', vals.barcodePrefix == null ? 'ריק' : String(vals.barcodePrefix)], ['קטגוריית מחיר', txtV(vals.priceCategory)]].filter((x) => x[1] !== 'ריק') });
        return;
      }
      if (l.action === 'DELETE') { push(l, 0, { scope: 'model', kind: 'del', icon: 'trash', text: 'הדגם נמחק' }); return; }
      if (l.action !== 'UPDATE') {
        push(l, 0, { scope: 'model', kind: 'details', icon: 'pencil', text: l.action || 'פעולה' });
        return;
      }
      const prevState = state;
      state = { ...(state || {}), ...vals };
      if (!prevState) {
        // אין בסיס להשוואה: שורה אחת עם הערכים הלא-ריקים של הרישום הראשון
        const det = Object.keys(vals).filter((k) => !IGNORED.has(k) && MODEL_FIELD_LABEL[k] && vals[k] !== null && vals[k] !== '' && vals[k] !== false).map((k) => [MODEL_FIELD_LABEL[k], k.endsWith('DateToRepo') || k.endsWith('FromRepo') ? dateV(vals[k]) : typeof vals[k] === 'boolean' ? yesNo(vals[k]) : txtV(vals[k])]);
        push(l, 0, { scope: 'model', kind: 'details', icon: 'pencil', text: 'עודכנו פרטי הדגם', det });
        return;
      }
      let n = 0;
      const ch1 = (k) => (k in vals) && !same(vals[k], prevState[k]);
      const row = (r) => push(l, n++, { scope: 'model', ...r });
      const ba = (b, a) => ({ det: [['לפני', b], ['אחרי', a]], prev: b, next: a });
      if (ch1('name')) row({ kind: 'details', icon: 'tag', text: 'עודכן שם דגם', ...ba(txtV(prevState.name), txtV(vals.name)) });
      if (ch1('priceCategory')) row({ kind: 'details', icon: 'card', text: 'עודכנה קטגוריית מחיר', ...ba(txtV(prevState.priceCategory), txtV(vals.priceCategory)) });
      if (ch1('notes')) row({ kind: 'details', icon: 'note', text: 'עודכנו הערות לדגם', ...ba(txtV(prevState.notes), txtV(vals.notes)) });
      if (ch1('entryDateToRepo') && prevState.entryDateToRepo !== undefined && dayOf(vals.entryDateToRepo) !== dayOf(prevState.entryDateToRepo)) row({ kind: 'details', icon: 'cal', text: 'עודכן תאריך כניסה למאגר', ...ba(dateV(prevState.entryDateToRepo), dateV(vals.entryDateToRepo)) });
      if (ch1('barcodePrefix')) row({ kind: 'details', icon: 'hash', text: 'עודכן קוד דגם', ...ba(txtV(prevState.barcodePrefix), txtV(vals.barcodePrefix)) });
      if (ch1('isPremium')) row({ kind: 'details', icon: 'tag', text: 'עודכן סוג תמחור (פרימיום)', ...ba(yesNo(prevState.isPremium), yesNo(vals.isPremium)) });
      if (ch1('imageUrl') || ch1('thumbnailUrl')) row({ kind: 'details', icon: 'dress', text: 'עודכנה תמונת הדגם', ...ba(prevState.imageUrl ? 'תמונה מקושרת' : 'ללא תמונה', vals.imageUrl ? 'תמונה מקושרת' : 'ללא תמונה') });
      if (ch1('exitDateFromRepo') || ch1('inactiveReason')) {
        const was = !!prevState.exitDateFromRepo; const now = !!vals.exitDateFromRepo;
        if (was !== now) row({ kind: 'status', icon: now ? 'ban' : 'check', text: now ? 'הדגם סומן כלא פעיל' : 'הדגם הוחזר לפעילות', ...(now ? { det: [['סיבה', txtV(vals.inactiveReason)], ['יציאה מהמאגר', dateV(vals.exitDateFromRepo)]] } : ba('לא פעיל', 'פעיל')) });
        else if (now) row({ kind: 'status', icon: 'ban', text: 'עודכנה סיבת אי-פעילות', ...ba(txtV(prevState.inactiveReason), txtV(vals.inactiveReason)) });
      }
      if (ch1('inInspection')) row({ kind: 'status', icon: 'eye', text: vals.inInspection ? 'הצגה בבדיקה הופעלה' : 'הצגה בבדיקה כובתה', ...ba(vals.inInspection ? 'כבוי' : 'מופעל', vals.inInspection ? 'מופעל' : 'כבוי') });
      if (ch1('isDeleted')) row({ kind: 'del', icon: vals.isDeleted ? 'trash' : 'refresh', text: vals.isDeleted ? 'הדגם נמחק' : 'הדגם שוחזר' });
      if (n === 0) {
        // שמירה ללא שינוי בשדות הידועים (נשלחו אותם ערכים): נשאר רישום כדי שלא ייעלם תיעוד
        row({ kind: 'details', icon: 'pencil', text: 'הדגם נשמר ללא שינוי בשדות' });
      }
    });
  });

  // ----- הפריטים -----
  byEntity(itemLogs).forEach((logs, id) => {
    let state = null;
    const bcNow = bcById.get(id) || '';
    logs.forEach((l) => {
      const ch = parseChanges(l.changesJson);
      const vals = {}; Object.keys(ch).forEach((k) => { vals[k] = isFT(ch[k]) ? ch[k].to : norm(ch[k]); });
      const bc = bcNow || (vals.dressBarcode ? String(vals.dressBarcode) : '');
      let n = 0;
      const row = (r) => push(l, n++, { scope: 'item', bc, ...r });
      const ba = (b, a) => ({ det: [['לפני', b], ['אחרי', a]], prev: b, next: a });
      if (l.action === 'CREATE') {
        state = { ...vals };
        row({ kind: 'add', icon: 'plus', text: 'נוסף פריט', det: [['מידה', txtV(vals.sizeText)], ['מיקום', txtV(vals.location)]] });
        return;
      }
      if (l.action === 'DELETE') { row({ kind: 'del', icon: 'trash', text: 'פריט נמחק' }); return; }
      const prevState = state;
      state = { ...(state || {}), ...vals };
      if (!prevState) {
        if (vals.isDeleted === true) { row({ kind: 'del', icon: 'trash', text: 'פריט נמחק', det: vals.notInUseReason ? [['סיבה', txtV(vals.notInUseReason)]] : [] }); return; }
        if (vals.isDeleted === false) { row({ kind: 'del', icon: 'refresh', text: 'פריט שוחזר' }); return; }
        const det = Object.keys(vals).filter((k) => !IGNORED.has(k) && ITEM_FIELD_LABEL[k] && vals[k] !== null && vals[k] !== '' && vals[k] !== false).map((k) => [ITEM_FIELD_LABEL[k], typeof vals[k] === 'boolean' ? yesNo(vals[k]) : txtV(vals[k])]);
        row({ kind: 'details', icon: 'pencil', text: 'עודכנו פרטי הפריט', det });
        return;
      }
      const ch1 = (k) => (k in vals) && !same(vals[k], prevState[k]);
      if (ch1('isDeleted')) row({ kind: 'del', icon: vals.isDeleted ? 'trash' : 'refresh', text: vals.isDeleted ? 'פריט נמחק' : 'פריט שוחזר' });
      if (ch1('location')) row({ kind: 'loc', icon: 'pin', text: 'עודכן מיקום פריט', ...ba(txtV(prevState.location), txtV(vals.location)) });
      if (ch1('cartonNumber')) row({ kind: 'loc', icon: 'hash', text: 'עודכן מס׳ קרטון', ...ba(txtV(prevState.cartonNumber), txtV(vals.cartonNumber)) });
      if (ch1('inRepair')) row({ kind: 'repair', icon: 'scissors', text: vals.inRepair ? 'סומן בתיקון' : 'תיקון הושלם', ...ba(vals.inRepair ? 'לא בתיקון' : 'בתיקון', vals.inRepair ? 'בתיקון' : 'לא בתיקון') });
      if (ch1('notInUse')) row({ kind: 'unused', icon: 'ban', text: vals.notInUse ? 'סומן כלא בשימוש' : 'הוחזר לשימוש', det: vals.notInUse ? [['סיבה', txtV(vals.notInUseReason)]] : [['לפני', 'לא בשימוש'], ['אחרי', 'בשימוש']] });
      else if (ch1('notInUseReason') && vals.notInUse) row({ kind: 'unused', icon: 'ban', text: 'סיבת אי-שימוש עודכנה', ...ba(txtV(prevState.notInUseReason), txtV(vals.notInUseReason)) });
      if (ch1('sizeText') || ch1('serialNumber') || ch1('dressBarcode')) row({ kind: 'details', icon: 'pencil', text: 'עודכנו פרטי פריט', ...ba(txtV(prevState.dressBarcode), txtV(vals.dressBarcode)) });
      if (n === 0) row({ kind: 'details', icon: 'pencil', text: 'הפריט נשמר ללא שינוי בשדות' });
    });
  });

  // מהחדש לישן; באותו רגע - הרישום המאוחר קודם, ובתוך רישום אחד - לפי סדר היצירה
  rows.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : a.lid !== b.lid ? b.lid.localeCompare(a.lid, 'en', { numeric: true }) : a.n - b.n));
  return rows;
}

/** מי הוסיף את הפריט ומתי עודכן לאחרונה - מתוך שורות ההיסטוריה (ל"פרטי הוספה" / "עודכן" בפירוט שורת פריט) */
export function itemAuditSummary(rows, bc) {
  const lg = rows.filter((l) => l.scope === 'item' && l.bc === bc);
  const added = lg.filter((l) => l.kind === 'add').pop();
  return { added: added || null, last: lg[0] || null };
}
