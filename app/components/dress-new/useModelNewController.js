'use client';

// הבקר של אשף "דגם חדש" (A5): כל המצב והפעולות. העיצוב המאושר: scratch/emp-models-build/model-new.js (תצוגות-עיצוב/עובדים-ודגמים/model-new.html),
// על התכונה האמיתית של האשף הישן (components/dresses/modern/ModernNewDressWizard.js) - אותם endpoints, אותם payloads (modelNewLogic.js), אותן הודעות שגיאה:
//   GET  /api/dresses/next-code            - הקוד הפנוי הבא (נטען מראש; לחצן "קוד פנוי")
//   GET  /api/dresses?advName=<קוד>        - זיהוי קוד תפוס תוך כדי הקלדה (במקום הרשימה המדומה של העיצוב); הכרעה סופית: POST (400 "הקוד כבר בשימוש!")
//   POST /api/dresses                      - יצירת הדגם (הנהלה ראשית / מתכנת בלבד - 403 מהשרת)
//   POST /api/dresses/<id>/items           - פריט אחד בכל קריאה; כישלון בפריט לא מבטל את הדגם
//   POST /api/upload                       - העלאת תמונה (FormData file -> { success, imageUrl, thumbnailUrl })
// שום קריאה ל-alert / confirm / prompt - חלונות הפלטה הכהים בלבד (MnDialogs.js).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { getSettingsCached } from '@/app/lib/pageCache';
import { hebrewParts, israelTodayKey, addDays } from '../schedule/hebrewCalendar';
import { createDialogManager } from '../new-order/newOrderLogic';
import * as L from './modelNewLogic';

const TOAST_MS = 2600;
const TOAST_LONG_MS = 6500;
const REDIRECT_MS = 2200; // אחרי "הדגם נוצר" - מעבר אוטומטי לכרטיס הדגם (כמו העיצוב)
const LEAVE_MS = 650;     // "חזרה לרשימת הדגמים" - הטוסט נראה רגע לפני המעבר (כמו העיצוב)
export const LIST_HREF = '/dashboard/dresses';

export const hDateFull = (key) => { const h = hebrewParts(key); return `${h.dl} ${h.m} ${h.y}`; };

const parseSettings = (data) => {
  const obj = { useModelNames: 'true', useFileNamesForImages: 'true', hide_dress_images: 'false' };
  if (Array.isArray(data)) data.forEach((s) => { if (s.key) obj[s.key] = s.value; });
  else if (data) Object.assign(obj, data);
  return obj;
};

const freshForm = (today, loc) => ({
  step: 1, saved: null, busy: false, catOpen: false, addErr: '', touched: {}, cartOpen: false, lastKey: 0,
  d: { code: '', name: '', cat: '', entry: today, img: '', thumb: '', imgLabel: '', notes: '', inspect: false },
  items: [], add: { size: '', serial: '', loc: loc || '' },
});

export default function useModelNewController({ router }) {
  const today = useMemo(() => israelTodayKey(), []);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState({ useModelNames: 'true', useFileNamesForImages: 'true', hide_dress_images: 'false' });
  const [categories, setCategories] = useState(null); // null = טוען
  const [priceRows, setPriceRows] = useState([]);
  const [head, setHead] = useState(null); // null = טרם נטען; true = הנהלה ראשית / מתכנת
  const [nextCode, setNextCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(true);
  const [takenMap, setTakenMap] = useState({}); // { '623': true|false } - תוצאת /api/dresses לכל קוד שנבדק
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [S, setS] = useState(() => freshForm(today, ''));
  const Sref = useRef(S);
  useLayoutEffect(() => { Sref.current = S; });
  const keyRef = useRef(1);
  const redirT = useRef(null);
  const leaveT = useRef(null);
  const upd = useCallback((p) => setS((prev) => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) })), []);

  const useModelNames = settings.useModelNames !== 'false';
  const showImages = settings.hide_dress_images !== 'true';
  const codeLen = L.parseCodeLen(settings.barcodePrefixLength);
  const locations = useMemo(() => L.parseLocations(settings.item_locations), [settings.item_locations]);
  const steps = useMemo(() => L.stepsOf(showImages), [showImages]);

  // ---------- טוסט ----------
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const say = useCallback((kind, big, small) => {
    setToast({ kind, big, small, n: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), kind === 'ok' ? TOAST_MS : TOAST_LONG_MS);
  }, [setToast]);
  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(redirT.current); clearTimeout(leaveT.current); }, []);

  // ---------- חלונות (שכבה אחת: #dlg) ----------
  const [dlg, setDlg] = useState(null);
  const [dlgMgr] = useState(() => createDialogManager((layer, value) => setDlg(value)));
  const ask = useCallback((type, props = {}) => dlgMgr.ask(type, props, 1), [dlgMgr]);
  const answer = useCallback((result, id) => dlgMgr.answer(1, result, id), [dlgMgr]);
  const showBusy = useCallback((on) => {
    dlgMgr.setBusy(on);
    setDlg(on ? { type: 'busy', props: {}, id: -1 } : null);
  }, [dlgMgr]);

  // ---------- טעינה ראשונית: הגדרות, קטגוריות, מחירון, הרשאה, הקוד הפנוי הבא ----------
  useEffect(() => {
    let off = false;
    getSettingsCached().then((data) => {
      if (off) return;
      const obj = parseSettings(data);
      setSettings(obj);
      const locs = L.parseLocations(obj.item_locations);
      setS((prev) => (prev.add.loc ? prev : { ...prev, add: { ...prev.add, loc: locs[0] } }));
    }).catch((err) => console.error('Failed to load settings', err)).finally(() => { if (!off) setReady(true); });
    fetchSharedJson('/api/pricelists/categories', { ttl: TTL.STATIC })
      .then((data) => { if (!off) setCategories(Array.isArray(data) ? data : []); })
      .catch((err) => { console.error('Failed to load categories', err); if (!off) setCategories([]); });
    fetchSharedJson('/api/pricelists', { ttl: TTL.STATIC })
      .then((data) => { if (!off && Array.isArray(data)) setPriceRows(data); })
      .catch(() => {});
    fetchSharedJson('/api/me', { ttl: TTL.STATIC })
      .then((me) => { if (!off) { const r = me && me.employee ? me.employee.roleId : undefined; setHead(r === 0 || r === 2); } })
      .catch(() => { if (!off) setHead(null); });
    return () => { off = true; };
  }, []);

  const loadNextCode = useCallback(async () => {
    const res = await fetch('/api/dresses/next-code');
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, code: data && data.nextCode != null ? String(data.nextCode) : '', error: data && data.error };
  }, []);
  useEffect(() => {
    let off = false;
    loadNextCode().then((r) => {
      if (off || !r.ok || !r.code) return;
      setNextCode(r.code);
      setS((prev) => (prev.d.code ? prev : { ...prev, d: { ...prev.d, code: r.code } }));
    }).catch((err) => console.error('Failed to fetch next code', err)).finally(() => { if (!off) setCodeLoading(false); });
    return () => { off = true; };
  }, [loadNextCode]);

  // ---------- זיהוי קוד תפוס (במקום הרשימה המדומה של העיצוב) ----------
  const code = String(S.d.code || '').trim();
  const codeFormatOk = !L.codeError(code, { len: codeLen });
  useEffect(() => {
    if (!codeFormatOk || takenMap[code] !== undefined) return undefined;
    let off = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dresses?advName=${encodeURIComponent(code)}&filterStatus=all&fields=summary&limit=50`);
        if (!res.ok || off) return;
        const data = await res.json();
        const n = Number(code);
        const hit = (data.data || []).some((m) => m.barcodePrefix === n && !m.isDeleted);
        if (!off) setTakenMap((p) => ({ ...p, [code]: hit }));
      } catch { /* הבדיקה החיה היא עזר - ההכרעה הסופית ב-POST */ }
    }, 350);
    return () => { off = true; clearTimeout(t); };
  }, [code, codeFormatOk, takenMap]);

  // ---------- נגזרות ----------
  const codeErr = L.codeError(code, { len: codeLen, taken: takenMap[code] === true });
  const nameOk = !useModelNames || String(S.d.name || '').trim() !== '';
  const catOk = !!S.d.cat;
  const step1Ok = !codeErr && nameOk && catOk;
  const missing = L.missingList({ codeErr, hasCode: code !== '', nameOk, catOk, useModelNames });
  const dirty = L.isDirty(S.d, S.items, { todayKey: today, nextCode });
  const sizes = L.sizesOf(S.items);
  const canCreate = step1Ok && !S.busy && !S.saved && head !== false;
  const bcPrev = L.barcodePreview(code, S.add, S.items);
  const catOptions = useMemo(() => (categories || []).map((c) => ({ key: c, title: c, small: L.priceRangeLabel(priceRows, c) })), [categories, priceRows]);

  // ---------- ניווט ----------
  const touchAll = useCallback(() => upd({ touched: { code: 1, name: 1, cat: 1 } }), [upd]);
  const go = useCallback((n) => {
    const cur = Sref.current;
    if (cur.saved || cur.busy || n === cur.step || n < 1 || n > 4) return;
    if (n > 1 && !step1Ok) { touchAll(); say('warn', 'חסרים פרטי זיהוי', `יש להשלים: ${missing.join(', ')}`); return; }
    upd({ step: n, catOpen: false });
    if (typeof window !== 'undefined') {
      const bars = document.getElementById('pbars');
      if (bars && bars.getBoundingClientRect().top < 0) window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step1Ok, missing, touchAll, say, upd]);

  const goList = useCallback(() => {
    say('info', 'חזרה לרשימת הדגמים', '');
    clearTimeout(leaveT.current);
    leaveT.current = setTimeout(() => router.push(LIST_HREF), LEAVE_MS);
  }, [router, say]);
  const goCard = useCallback(() => {
    const sv = Sref.current.saved;
    if (sv && sv.id) router.replace(`${LIST_HREF}/${sv.id}`);
  }, [router]);

  const exit = useCallback(async () => {
    const cur = Sref.current;
    if (cur.busy) return;
    if (!cur.saved && dirty) {
      const leave = await ask('exit');
      if (!leave) return;
    }
    goList();
  }, [dirty, ask, goList]);

  const reset = useCallback(async () => {
    clearTimeout(redirT.current);
    setTakenMap({});
    setS(freshForm(today, locations[0]));
    try {
      const r = await loadNextCode();
      if (r.ok && r.code) { setNextCode(r.code); setS((prev) => (prev.d.code ? prev : { ...prev, d: { ...prev.d, code: r.code } })); }
    } catch { /* נשאר בלי קוד מראש */ }
  }, [today, locations, loadNextCode]);

  const discard = useCallback(async () => {
    const ok = await ask('discard');
    if (!ok) return;
    await reset();
    say('info', 'הטופס אופס', '');
  }, [ask, reset, say]);

  const newAgain = useCallback(async () => {
    await reset();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }, [reset]);

  // ---------- שלב 1 ----------
  const setField = useCallback((p) => upd((prev) => ({ d: { ...prev.d, ...p } })), [upd]);
  const onCode = useCallback((v) => setField({ code: L.sanitizeCode(v, codeLen) }), [setField, codeLen]);
  const touch = useCallback((k) => upd((prev) => ({ touched: { ...prev.touched, [k]: 1 } })), [upd]);
  const autoCode = useCallback(async () => {
    try {
      const r = await loadNextCode();
      if (!r.ok) { say('warn', r.error || 'לא נמצא קוד פנוי', ''); return; }
      setNextCode(r.code);
      if (String(Sref.current.d.code).trim() === r.code) { say('info', 'זה כבר הקוד הפנוי הבא', ''); return; }
      upd((prev) => ({ d: { ...prev.d, code: r.code }, touched: { ...prev.touched, code: 1 } }));
    } catch (err) {
      console.error(err);
      say('warn', 'שגיאה בתקשורת', '');
    }
  }, [loadNextCode, say, upd]);
  const pickCat = useCallback((k) => upd((prev) => ({ d: { ...prev.d, cat: k }, catOpen: false, touched: { ...prev.touched, cat: 1 } })), [upd]);
  const toggleCat = useCallback(() => upd((prev) => ({ catOpen: !prev.catOpen })), [upd]);
  const closeCat = useCallback(() => upd((prev) => (prev.catOpen ? { catOpen: false } : null)), [upd]);
  const pickDate = useCallback(async () => {
    const key = await ask('date', { date: Sref.current.d.entry, today });
    if (key) setField({ entry: key });
  }, [ask, setField, today]);

  // ---------- שלב 2 ----------
  const uploadImage = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) setField({ img: data.imageUrl, thumb: data.thumbnailUrl || '', imgLabel: file.name });
      else say('warn', 'שגיאה בהעלאת התמונה', '');
    } catch (err) {
      console.error(err);
      say('warn', 'שגיאה בתקשורת בהעלאת התמונה', '');
    } finally { setUploading(false); }
  }, [setField, say]);
  const imgFromUrl = useCallback(async () => {
    const cur = Sref.current.d;
    const v = await ask('url', { value: cur.imgLabel && !/^blob:/.test(cur.img) ? cur.imgLabel : '', code: String(cur.code || '').trim() });
    if (v) setField({ img: v, thumb: '', imgLabel: v });
  }, [ask, setField]);
  const removeImage = useCallback(() => setField({ img: '', thumb: '', imgLabel: '' }), [setField]);

  // ---------- שלב 3 ----------
  const setAdd = useCallback((p) => upd((prev) => ({ add: { ...prev.add, ...p }, addErr: '' })), [upd]);
  const onSize = useCallback((v) => upd((prev) => ({ add: { ...prev.add, size: v, serial: String(v).trim() === '' ? '' : String(L.nextSerial(prev.items, v)) }, addErr: '' })), [upd]);
  const addItem = useCallback(() => {
    const cur = Sref.current;
    const r = L.validateNewItem(cur.add, cur.items);
    if (r.error) { upd({ addErr: r.error }); return false; }
    const it = { key: keyRef.current++, size: String(r.size), serial: r.serial, loc: cur.add.loc || locations[0] };
    const items = [...cur.items, it];
    upd({ items, lastKey: it.key, addErr: '', add: { size: String(r.size), serial: String(L.nextSerial(items, r.size)), loc: cur.add.loc } });
    return true;
  }, [upd, locations]);
  const removeItem = useCallback((key) => upd((prev) => {
    const items = prev.items.filter((p) => p.key !== key);
    if (items.length === prev.items.length) return null;
    const add = { ...prev.add };
    if (String(add.size).trim() !== '') add.serial = String(L.nextSerial(items, add.size));
    return { items, lastKey: 0, addErr: '', add };
  }), [upd]);

  // ---------- יצירה ----------
  const create = useCallback(async () => {
    const cur = Sref.current;
    if (cur.busy || cur.saved) return;
    if (head === false) { say('warn', 'אין הרשאה', 'יצירת דגם שמורה להנהלה ראשית'); return; }
    if (!step1Ok) { touchAll(); if (cur.step !== 1) upd({ step: 1 }); say('warn', 'חסרים פרטי זיהוי', `יש להשלים: ${missing.join(', ')}`); return; }
    upd({ busy: true, catOpen: false });
    setProgress('');
    showBusy(true);
    const planned = cur.items;
    try {
      const res = await fetch('/api/dresses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(L.buildModelPayload(cur.d, { useModelNames })) });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) {
        showBusy(false);
        const e = L.describeCreateError(res.status, created);
        if (e.duplicate) setTakenMap((p) => ({ ...p, [String(cur.d.code).trim()]: true }));
        upd({ busy: false, step: 1, touched: { ...Sref.current.touched, code: 1 } });
        say('warn', e.forbidden ? 'אין הרשאה ליצור דגם' : 'יצירת הדגם נכשלה', e.msg);
        return;
      }
      // הפריטים נוצרים אחד-אחד; כישלון בפריט בודד לא מבטל את הדגם שכבר נוצר
      const failed = [];
      let okCount = 0;
      for (let i = 0; i < planned.length; i++) {
        const it = planned[i];
        setProgress(`יוצר פריטים... ${i + 1}/${planned.length}`);
        const barcode = L.buildBarcode(String(cur.d.code).trim(), it.size, it.serial);
        try {
          const itemRes = await fetch(`/api/dresses/${created.id}/items`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(L.buildItemPayload(it, created, cur.d, locations)),
          });
          if (!itemRes.ok) {
            const err = await itemRes.json().catch(() => null);
            failed.push({ barcode, msg: (err && err.error) || 'שגיאה' });
          } else okCount++;
        } catch { failed.push({ barcode, msg: 'שגיאת תקשורת' }); }
      }
      showBusy(false);
      const saved = { id: created.id, code: String(created.barcodePrefix != null ? created.barcodePrefix : cur.d.code), name: created.name || String(cur.d.name).trim(), n: okCount, sizes: L.sizesOf(planned).length, failed };
      upd({ saved, busy: false });
      say(failed.length ? 'warn' : 'ok', failed.length ? 'הדגם נוצר, אך חלק מהפריטים נכשלו' : 'הדגם נוצר',
        `#${saved.code} · ${saved.name}${okCount ? ` · ${L.plural(okCount, 'פריט אחד', 'פריטים')}` : ''}`);
      clearTimeout(redirT.current);
      if (!failed.length) redirT.current = setTimeout(() => { if (Sref.current.saved) goCard(); }, REDIRECT_MS);
    } catch (err) {
      console.error(err);
      showBusy(false);
      upd({ busy: false });
      say('warn', 'שגיאה בתקשורת עם השרת', '');
    }
  }, [head, step1Ok, missing, touchAll, upd, say, showBusy, useModelNames, locations, goCard]);

  // ---------- מקלדת: Escape סוגר חלון (לא בזמן יצירה) / רשימת הקטגוריות ----------
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (dlg && dlg.type !== 'busy') { answer(null, dlg.id); return; }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dlg, answer]);

  return {
    ready, S, upd, steps, today, settings, useModelNames, showImages, codeLen, locations, categories, catOptions, head,
    nextCode, codeLoading, uploading, progress,
    toast, setToast, say, dlg, ask, answer,
    code, codeErr, nameOk, catOk, step1Ok, missing, dirty, sizes, canCreate, bcPrev,
    go, exit, discard, newAgain, goCard, touch, touchAll,
    setField, onCode, autoCode, pickCat, toggleCat, closeCat, pickDate,
    uploadImage, imgFromUrl, removeImage,
    setAdd, onSize, addItem, removeItem, create,
  };
}
