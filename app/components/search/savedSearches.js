'use client';

// "חיפושים שמורים" ('$') + היסטוריית חיפושים: הצד של הדפדפן. נתוני GET/POST/DELETE /api/saved-searches ו-GET/POST /api/search-history.
// כללים:
//  - אין טעינה בעליית הדף: הרשימה נטענת רק כשהרשימה של '$' נפתחת, או כשיש טקסט חיפוש שאפשר לשמור (כדי לדעת אם הוא כבר שמור).
//  - מטמון ברמת המודול (חלונית הבית, חיפוש התפריט ומגירת הנייד חולקים אותו), תוקף 60 שניות.
//  - הטבלה חסרה במסד (השרת עונה unavailable): המצב 'unavailable' נשאר עד רענון, התכונה מוסתרת בשקט (בלי שגיאה, בלי ניסיונות חוזרים).
//  - "אל תשאל שוב" במחיקה: משתנה בזיכרון המודול בלבד = עד רענון הדף (PFX-10), לא נשמר בשום אחסון.
//  - רישום חיפוש להיסטוריה (rememberSearch) הוא best-effort: כישלון לא מפריע לחיפוש.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SAVED_TEXT, defaultSaveLabel, isQuerySaved, saveCandidate, savePayload, SAVED_SEARCH_LIMIT } from '@/lib/quickShortcuts';

const TTL_MS = 60000;
const FLASH_MS = 1600;

/* ---------- מאגר הרשימה (מודול) ---------- */
const INITIAL = Object.freeze({ state: 'idle', list: [], at: 0 }); // state: idle | loading | ok | error | unavailable
let store = INITIAL;
let inflight = null;
const listeners = new Set();
const setStore = (next) => { store = next; listeners.forEach((f) => f()); };
const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };
const getStore = () => store;
const getServerStore = () => INITIAL;
export function resetSavedSearchesStore() { store = INITIAL; inflight = null; skipDeleteConfirm = false; lastSearch = ''; historyUnavailable = false; historyLoaded = false; }

async function jsonOf(res) { try { return await res.json(); } catch { return null; } }

export function loadSavedSearches(force = false) {
  if (store.state === 'unavailable') return Promise.resolve();
  if (!force && store.state === 'ok' && Date.now() - store.at < TTL_MS) return Promise.resolve();
  if (inflight) return inflight;
  if (store.state !== 'ok') setStore({ ...store, state: 'loading' });
  inflight = (async () => {
    try {
      const res = await fetch('/api/saved-searches', { cache: 'no-store', credentials: 'same-origin' });
      const d = await jsonOf(res);
      if (res.ok && d && d.unavailable) { setStore({ state: 'unavailable', list: [], at: Date.now() }); return; }
      if (!res.ok || !d || !Array.isArray(d.savedSearches)) throw new Error('status ' + res.status);
      setStore({ state: 'ok', list: d.savedSearches, at: Date.now() });
    } catch {
      setStore({ state: 'error', list: store.list, at: 0 });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** { ok:true, item } | { ok:false, reason: 'limit' | 'unavailable' | 'error' } */
export async function createSavedSearch(payload) {
  try {
    const res = await fetch('/api/saved-searches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) });
    const d = await jsonOf(res);
    if (res.status === 409) return { ok: false, reason: 'limit' };
    if (d && d.unavailable) { setStore({ state: 'unavailable', list: [], at: Date.now() }); return { ok: false, reason: 'unavailable' }; }
    if (!res.ok || !d || !d.savedSearch) return { ok: false, reason: 'error' };
    setStore({ state: store.state === 'ok' ? 'ok' : store.state, list: [d.savedSearch, ...store.list.filter((s) => s.id !== d.savedSearch.id)], at: store.at || Date.now() });
    return { ok: true, item: d.savedSearch };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** מחיקה אופטימית: השורה נעלמת מיד; אם השרת נכשל (חוץ מ"לא נמצא") הרשימה נטענת מחדש. */
export async function deleteSavedSearch(id) {
  const before = store;
  setStore({ ...store, list: store.list.filter((s) => s.id !== id) });
  try {
    const res = await fetch('/api/saved-searches?id=' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok || res.status === 404) return { ok: true };
    const d = await jsonOf(res);
    if (d && d.unavailable) setStore({ state: 'unavailable', list: [], at: Date.now() }); else { setStore(before); loadSavedSearches(true); }
    return { ok: false };
  } catch {
    setStore(before);
    return { ok: false };
  }
}

/* ---------- החיפוש האחרון + היסטוריה ---------- */
let lastSearch = '';
let historyUnavailable = false;
let historyLoaded = false;
const lastListeners = new Set();
const setLast = (q) => { if (q === lastSearch) return; lastSearch = q; lastListeners.forEach((f) => f()); };
const subscribeLast = (f) => { lastListeners.add(f); return () => lastListeners.delete(f); };

/** רושם חיפוש שהורץ: זוכרים אותו כ"החיפוש האחרון" ושולחים להיסטוריה של העובדת (שקט, best-effort). קידומות וטקסט ריק לא נרשמים. */
export function rememberSearch(text) {
  const q = saveCandidate(text);
  if (!q) return;
  const same = q === lastSearch;
  setLast(q);
  if (same || historyUnavailable) return;
  try {
    fetch('/api/search-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ query: q }) })
      .then((r) => r.json().catch(() => null))
      .then((d) => { if (d && d.unavailable) historyUnavailable = true; })
      .catch(() => {});
  } catch { /* ignore */ }
}

async function loadLastFromHistory() {
  if (historyLoaded || historyUnavailable || lastSearch) return;
  historyLoaded = true;
  try {
    const res = await fetch('/api/search-history', { cache: 'no-store', credentials: 'same-origin' });
    const d = await jsonOf(res);
    if (d && d.unavailable) { historyUnavailable = true; return; }
    if (!res.ok || !d || !Array.isArray(d.history)) return;
    const first = d.history.map((h) => saveCandidate(h && h.query)).find(Boolean);
    if (first && !lastSearch) setLast(first);
  } catch { /* ignore */ }
}

/* ---------- "אל תשאל שוב" (בזיכרון המודול: עד רענון) ---------- */
let skipDeleteConfirm = false;
export const deleteConfirmSkipped = () => skipDeleteConfirm;

/**
 * הוק לכל מקום חיפוש (דף הבית / חיפוש התפריט / מגירה). toast(title, text) מהמארח; focusInput מחזיר מיקוד לשדה החיפוש.
 * ref יציב: האובייקט שמוחזר משתנה רק כשמשהו שהוא מציג משתנה (כדי לא לצייר מחדש את הרשימה על כל הקלדה).
 */
export function useSavedSearches({ toast, focusInput } = {}) {
  const snap = useSyncExternalStore(subscribe, getStore, getServerStore);
  const last = useSyncExternalStore(subscribeLast, () => lastSearch, () => '');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState(null); // החיפוש השמור שממתין לאישור מחיקה
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef(0);
  const cbs = useRef({ toast, focusInput });
  useEffect(() => { cbs.current = { toast, focusInput }; });
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const load = useCallback(() => { loadSavedSearches(false); loadLastFromHistory(); }, []);
  const reload = useCallback(() => { loadSavedSearches(true); }, []);
  const say = useCallback((title, text) => { if (cbs.current.toast) cbs.current.toast(title, text || ''); }, []);
  const refocus = useCallback(() => { if (cbs.current.focusInput) cbs.current.focusInput(); }, []);

  const afterCreate = useCallback((r, name) => {
    if (r.ok) return true;
    if (r.reason === 'limit') say(SAVED_TEXT.limitReached, 'מחקי חיפוש שמור כדי להוסיף');
    else if (r.reason !== 'unavailable') say(SAVED_TEXT.saveFailed, name ? '“' + name + '”' : '');
    return false;
  }, [say]);

  // שמירה שקטה ליד ה-X (PFX-09): אייקון שמירה, ואחריה הודעה קטנה "החיפוש נשמר"
  const quickSave = useCallback(async (text) => {
    const payload = savePayload(text);
    if (!payload) return;
    if (isQuerySaved(getStore().list, payload.query)) { say('החיפוש כבר שמור', '“' + payload.label + '”'); return; }
    const r = await createSavedSearch(payload);
    if (!afterCreate(r, payload.label)) return;
    setFlash(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), FLASH_MS);
    say(SAVED_TEXT.savedToast, '“' + payload.label + '”');
  }, [say, afterCreate]);

  const beginSave = useCallback(() => { setFormError(''); setSaving(true); }, []);
  const cancelSave = useCallback(() => { setSaving(false); setFormError(''); refocus(); }, [refocus]);
  const submitSave = useCallback(async (name) => {
    const label = String(name || '').trim();
    if (!label) { setFormError(SAVED_TEXT.nameRequired); return; }
    const payload = savePayload(lastSearch, defaultSaveLabel(label));
    if (!payload) { setSaving(false); return; }
    const r = await createSavedSearch(payload);
    if (!afterCreate(r, payload.label)) { setSaving(false); refocus(); return; }
    setSaving(false); setFormError('');
    say(SAVED_TEXT.savedToast, '“' + payload.label + '”');
    refocus();
  }, [say, afterCreate, refocus]);

  const removeNow = useCallback(async (id) => {
    const r = await deleteSavedSearch(id);
    if (!r.ok) say(SAVED_TEXT.deleteFailed, '');
  }, [say]);
  const askDelete = useCallback((item) => {
    if (!item || !item.id) return;
    if (skipDeleteConfirm) { removeNow(item.id); return; }
    setConfirm({ id: item.id, name: item.title || item.query || '' });
  }, [removeNow]);
  const cancelDelete = useCallback(() => { setConfirm(null); refocus(); }, [refocus]);
  const confirmDelete = useCallback((noAsk) => {
    const c = confirm;
    if (noAsk) skipDeleteConfirm = true;
    setConfirm(null);
    if (c) removeNow(c.id);
    refocus();
  }, [confirm, removeNow, refocus]);

  const { state, list } = snap;
  return useMemo(() => ({
    state, list, last, load, reload, saving, formError, confirm, flash,
    full: list.length >= SAVED_SEARCH_LIMIT,
    quickSave, beginSave, cancelSave, submitSave, askDelete, cancelDelete, confirmDelete,
  }), [state, list, last, load, reload, saving, formError, confirm, flash, quickSave, beginSave, cancelSave, submitSave, askDelete, cancelDelete, confirmDelete]);
}
