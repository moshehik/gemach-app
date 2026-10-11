'use client';

// pkContext.js - ההקשר של מסמך מודפס (ctx של pkCore.shell ושל pkSpecs): שם הגמ"ח וכתובתו (הגדרות המערכת), שם המדפיס/ה, תאריך עברי ולועזי של היום
// (שעון ישראל), ופורמטרים לתאריכים עבריים ושעות. נטען פעם אחת לכל פתיחה; כל כשל ברשת = ערכי ברירת מחדל (ההדפסה לא נחסמת בגלל כותרת).
import { dayKey, hDateFull, timeHM } from '../a5-list/dates';
import { WEEKDAYS, dow, israelTodayKey } from '../schedule/hebrewCalendar';

const GM_TTL_MS = 10 * 60 * 1000;
let gmCache = null; // { at, gm }

async function fetchJson(url) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 4000) : null;
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
    return res.ok ? await res.json() : null;
  } catch { return null; } finally { if (timer) clearTimeout(timer); }
}

async function loadGm() {
  if (gmCache && Date.now() - gmCache.at < GM_TTL_MS) return gmCache.gm;
  const list = await fetchJson('/api/settings');
  const get = (k) => (Array.isArray(list) ? ((list.find((s) => s.key === k) || {}).value || '') : '');
  const gm = { name: String(get('gmach_name') || 'גמ״ח שמלות').trim(), addr: String(get('gmach_address')).trim(), phone: String(get('gmach_phone')).trim() };
  if (Array.isArray(list)) gmCache = { at: Date.now(), gm };
  return gm;
}

async function loadWho() {
  const me = await fetchJson('/api/me');
  const e = me && me.employee;
  if (!e) return '';
  return String(e.fullName || `${e.firstName || ''} ${e.lastName || ''}`).trim();
}

export async function makePrintCtx() {
  const [gm, who] = await Promise.all([loadGm(), loadWho()]);
  const todayKey = israelTodayKey();
  const [y, m, d] = todayKey.split('-');
  return {
    gm,
    who,
    todayKey,
    dateLine: `יום ${WEEKDAYS[dow(todayKey)]} · ${hDateFull(todayKey)}`,
    greg: `${d}/${m}/${y}`,
    time: timeHM(new Date()),
    hDate: hDateFull,
    hm: timeHM,
    dayKey,
  };
}

/** שם קובץ ה-PDF: "<שם המסמך> · dd-mm-yyyy" (בלי סיומת) */
export function pdfBaseName(file, ctx) {
  const [y, m, d] = ctx.todayKey.split('-');
  return `${file} · ${d}-${m}-${y}`;
}
