'use client';

// useDressCard - הבקר של כרטיס הדגם החדש (A5), במבנה של useOrderCardController: טעינה, מצב שמור (saved) מול מצב עריכה (cur), "שינויים
// בכרטיס" (diff + ביטול שורה + החזר ביטול), שמירה (תוכנית בקשות לפי dressCardLogic.buildSavePlan), יציאה עם הגנה, מחיקה/שחזור דגם,
// טעינה עצלה של השכרות והיסטוריה. כל הלוגיקה הטהורה ב-lib/dressCardLogic.js (נבדקת ב-node).
//
// החלטת שמירה (ר' docs/a5-staff-models/model-card-notes.md): בדף הישן עריכות הפריטים נשמרו מיידית (PUT/POST/DELETE לכל פעולה) ושדות
// הדגם בלחצן "שמור". בעיצוב המאושר כל השינויים (גם הפריטים) מופיעים כשורות ב"שינויים בכרטיס" ונשמרים יחד - לכן הם נשמרים כאן יחד,
// אותם endpoints ואותם payloads, ברצף; צעד שנכשל נשאר בעגלה עם הודעה, השאר נשמרים.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cacheNamespace, fetchJson, getSettingsCached } from '@/app/lib/pageCache';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { addHistory } from '@/lib/historyManager';
import { getIsraelTodayKey } from '@/lib/hebrewDate';
import { nextWorkingDay } from '@/lib/businessDays';
import { israelDayKey, israelTime } from '@/lib/attendance/summary';
import { modelDisplayName, modelHasRealName } from '@/lib/modelDisplay';
import DcSummaryDialog from './dialogs/DcSummaryDialog';
import { DcDiscardDialog, DcSuccessDialog } from './dialogs/DcSimpleDialogs';
import {
  DEFAULT_LOCATIONS, applyStepResult, buildDressHistoryRows, buildSavePlan, clone, counts, deleteItemLocal, diffChanges, itemFromServer,
  lifeNodes, modelFromServer, rentalFromServer, tabMarkers, undoChange as undoChangeLogic,
} from '@/lib/dressCardLogic';

export const LIST_HREF = '/dashboard/dresses';
const dressCache = cacheNamespace('dress-detail'); // אותו מטמון כמו הדף הישן (SWR)
const lookup = { categories: null };

const parseSettings = (data) => {
  const obj = { useModelNames: 'true', useFileNamesForImages: 'true', hide_dress_images: 'false' };
  if (Array.isArray(data)) data.forEach((s) => { if (s.key) obj[s.key] = s.value; });
  else if (data) Object.assign(obj, data);
  return obj;
};

function makeStore() {
  let value = { status: 'idle', list: [], stats: {} };
  const ls = new Set();
  return { get: () => value, subscribe: (fn) => { ls.add(fn); return () => ls.delete(fn); }, emit: (v) => { value = v; ls.forEach((f) => f()); } };
}
const fromRaw = (raw, rawItems) => ({ model: modelFromServer(raw), items: rawItems.map(itemFromServer) });
// text = הודעת השרת; field = השדה שהשרת מצביע עליו (למשל 'name' כששם הדגם כבר קיים) - להצגה ליד השדה
const errInfo = async (res) => { try { const d = await res.json(); return { text: (d && d.error) || '', field: (d && d.field) || '' }; } catch { return { text: '', field: '' }; } };

export default function useDressCard(dressId, ui) {
  const router = useRouter();
  const cached = dressCache.get(dressId);
  const [status, setStatus] = useState(cached ? 'ready' : 'loading');
  const [raw, setRaw] = useState(cached ? cached.model : null);
  const [state, setState] = useState(() => (cached ? { saved: fromRaw(cached.model, cached.items), cur: fromRaw(cached.model, cached.items) } : null));
  const [settings, setSettings] = useState({ useModelNames: 'true', useFileNamesForImages: 'true', hide_dress_images: 'false' });
  const [categories, setCategories] = useState(lookup.categories || []);
  const [locations, setLocations] = useState(DEFAULT_LOCATIONS);
  const [tab, setTab] = useState('details');
  const [editDet, setEditDet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [redoCount, setRedoCount] = useState(0);
  const [hit, setHit] = useState(null); // פריט שנמצא בסריקה (הדגשה קצרה)
  // ניהול פריטי דגם (הוספה / עריכה / מחיקה / שחזור): feature:dress_items_manage, מ-/api/me. סגור עד שנטען - בלי ההרשאה הפריטים לקריאה בלבד (השרת אוכף בנפרד)
  const [canManageItems, setCanManageItems] = useState(false);
  const [nameConflict, setNameConflict] = useState(null); // {name, text} - השרת סירב לשם הדגם (כבר קיים); מוצג ליד השדה כל עוד השם לא השתנה
  const [rentals, setRentals] = useState({ status: 'idle', list: [], stats: { total: 0, lastYear: 0, outNow: 0, overdue: 0 } });
  const [logs, setLogs] = useState({ status: 'idle', modelLogs: [], itemLogs: [] });
  const [listIntent, setListIntent] = useState(null); // {tab, filter, n} - "צ'יפ" ברייל שמעביר לרשימת הפריטים עם סינון
  const redoRef = useRef([]);
  // מאגר קטן להשכרות לחלונות (הם מרונדרים מחוץ לעץ הכרטיס ולכן לא רואים את ה-state; useSyncExternalStore בחלון "פרטי פריט")
  const [rentalsStore] = useState(makeStore);
  const stateRef = useRef(state);
  const rawRef = useRef(raw);
  const savingRef = useRef(false);
  const logsKey = useRef(0);
  const [logsVersion, setLogsVersion] = useState(0);
  useEffect(() => { stateRef.current = state; rawRef.current = raw; }, [state, raw]);

  const saved = state ? state.saved : null;
  const cur = state ? state.cur : null;
  const changes = useMemo(() => (saved && cur ? diffChanges(saved, cur) : []), [saved, cur]);
  const dirty = changes.length > 0;

  // ---------- טעינת נתוני עזר + הדגם ----------
  useEffect(() => {
    let off = false;
    getSettingsCached().then((data) => {
      if (off) return;
      const obj = parseSettings(data);
      setSettings(obj);
      if (obj.item_locations) setLocations(String(obj.item_locations).split(',').map((l) => l.trim()).filter(Boolean));
    }).catch((e) => console.error('Failed to load settings', e));
    if (!lookup.categories) {
      fetchJson('/api/pricelists/categories').then((d) => { lookup.categories = Array.isArray(d) ? d : []; if (!off) setCategories(lookup.categories); }).catch((e) => console.error('Failed to load categories', e));
    }
    fetchSharedJson('/api/me', { ttl: TTL.STATIC })
      .then((me) => { if (!off) setCanManageItems(!!(me && me.employee && me.employee.canManageDressItems)); })
      .catch(() => { if (!off) setCanManageItems(false); });
    return () => { off = true; };
  }, []);

  const applyServer = useCallback((data) => {
    const items = data.items || [];
    const model = { ...data };
    delete model.items;
    dressCache.set(dressId, { model, items });
    const next = fromRaw(model, items);
    setRaw(model);
    setState({ saved: clone(next), cur: clone(next) });
    return model;
  }, [dressId]);

  useEffect(() => {
    let off = false;
    // fetchJson מאחד בקשות GET זהות שעדיין באוויר (strict-mode ב-dev מריץ את האפקט פעמיים) - בקשת רשת אחת
    fetchJson(`/api/dresses/${dressId}?includeDeleted=true`)
      .then((data) => {
        if (!data || !data.id) throw new Error('not found');
        if (off) return;
        // רענון-רקע לא דורס עריכה שכבר התחילה
        if (stateRef.current && (diffChanges(stateRef.current.saved, stateRef.current.cur).length > 0)) { setStatus('ready'); return; }
        applyServer(data);
        setStatus('ready');
        addHistory({ type: 'dress', id: data.id, name: `דגם ${data.barcodePrefix || ''}`.trim(), subtext: modelHasRealName({ name: data.name, barcodePrefix: data.barcodePrefix }) ? data.name : '' });
      })
      .catch((e) => { if (!off) { console.error(e); if (!dressCache.has(dressId)) setStatus('notfound'); } });
    return () => { off = true; };
  }, [dressId, applyServer]);

  // ---------- הגנות יציאה ----------
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  // PageVariantToggle (החלפה ישן/חדש) שואל את הדף אם יש שינויים שלא נשמרו
  useEffect(() => {
    window.__gmDirty = () => !!(stateRef.current && diffChanges(stateRef.current.saved, stateRef.current.cur).length);
    return () => { window.__gmDirty = undefined; };
  }, []);

  // ---------- עריכה ----------
  const setCur = useCallback((fn, { keepRedo = false } = {}) => {
    if (!keepRedo && redoRef.current.length) { redoRef.current = []; setRedoCount(0); }
    setState((s) => (s ? { ...s, cur: fn(clone(s.cur)) } : s));
  }, []);
  const patchModel = useCallback((patch) => setCur((c) => { Object.assign(c.model, patch); return c; }), [setCur]);
  const setActive = useCallback((on, o = {}) => setCur((c) => {
    if (on) { c.model.active = true; c.model.reason = ''; c.model.exit = ''; } else { c.model.active = false; c.model.reason = o.reason || ''; c.model.exit = o.exit || ''; }
    return c;
  }), [setCur]);
  const patchItem = useCallback((id, patch) => setCur((c) => { const it = c.items.find((x) => String(x.id) === String(id)); if (it) Object.assign(it, patch); return c; }), [setCur]);
  const addItemLocal = useCallback((item) => setCur((c) => { c.items.push(item); return c; }), [setCur]);
  const deleteItem = useCallback((id) => setState((s) => (s ? { ...s, cur: deleteItemLocal(s.saved, s.cur, id) } : s)), []);

  const undoChange = useCallback((key) => {
    const s = stateRef.current; if (!s) return;
    redoRef.current = [...redoRef.current, clone(s.cur)]; setRedoCount(redoRef.current.length);
    setState({ saved: s.saved, cur: undoChangeLogic(s.saved, s.cur, key) });
  }, []);
  const redo = useCallback(() => {
    const st = redoRef.current; if (!st.length) return;
    const last = st[st.length - 1];
    redoRef.current = st.slice(0, -1); setRedoCount(redoRef.current.length);
    setState((s) => (s ? { ...s, cur: last } : s));
  }, []);
  const discardAll = useCallback(async () => {
    const s = stateRef.current; if (!s) return false;
    const n = diffChanges(s.saved, s.cur).length; if (!n) return false;
    const ok = await ui.openDialog(DcDiscardDialog, { count: n });
    if (!ok) return false;
    redoRef.current = [clone(s.cur)]; setRedoCount(1);
    setState({ saved: s.saved, cur: clone(s.saved) });
    ui.hideToast();
    return true;
  }, [ui]);

  // ---------- טוסט "שינויים ממתינים לשמירה" (פעם אחת בכל מעבר נקי -> מלוכלך, כמו notify בעיצוב) ----------
  const saveRef = useRef(null);
  const toastShown = useRef(false);
  useEffect(() => {
    if (!dirty) { toastShown.current = false; return; }
    if (toastShown.current) return;
    toastShown.current = true;
    ui.toast('info', 'שינויים ממתינים לשמירה', '', { text: 'לשמירה', icon: 'check', onClick: () => saveRef.current && saveRef.current() });
  }, [dirty, ui]);

  // ---------- שמירה ----------
  const validate = useCallback(() => {
    const s = stateRef.current; if (!s) return false;
    const m = s.cur.model; const useNames = settings.useModelNames !== 'false';
    const fail = (big, small) => { setTab('details'); setEditDet(true); ui.toast('error', big, small); return false; };
    if (useNames && !String(m.name || '').trim()) return fail('חסר שם לדגם', 'נא להזין שם לפני השמירה');
    if (!useNames && !String(m.code || '').trim()) return fail('חסר קוד לדגם', 'נא להזין קוד לפני השמירה');
    if (!m.active && m.exit && m.entry && m.exit < m.entry) return fail('תאריך היציאה קודם לכניסה', 'תאריך יציאה לא יכול להיות קודם לתאריך הכניסה למאגר');
    return true;
  }, [settings.useModelNames, ui]);

  const runPlan = useCallback(async () => {
    const s0 = stateRef.current; const r0 = rawRef.current;
    const plan = buildSavePlan({ saved: s0.saved, cur: s0.cur, raw: r0, locations, useModelNames: settings.useModelNames !== 'false' });
    let st = { saved: s0.saved, cur: s0.cur, raw: r0 };
    const failures = []; const failedLines = new Set(); let okLines = 0;
    for (const step of plan) {
      // עריכה שנכשלה לפריט -> לא מוחקים אותו
      if (step.itemId && failedLines.has(`item:${step.itemId}`)) { failures.push({ step, error: 'דולג כי עריכה קודמת של הפריט נכשלה' }); continue; }
      try {
        const res = await fetch(step.req.url, { method: step.req.method, headers: step.req.body ? { 'Content-Type': 'application/json' } : undefined, body: step.req.body ? JSON.stringify(step.req.body) : undefined });
        if (!res.ok) {
          const info = await errInfo(res);
          const err = new Error(info.text || `שגיאה ${res.status}`);
          err.field = info.field;
          throw err;
        }
        const data = await res.json().catch(() => ({}));
        st = applyStepResult(st, step, data);
        okLines += step.lines.length;
      } catch (e) {
        failures.push({ step, error: (e && e.message) || 'שגיאה בתקשורת עם השרת', field: (e && e.field) || '' });
        if (step.itemId) failedLines.add(`item:${step.itemId}`);
      }
    }
    return { st, failures, okLines, plan };
  }, [locations, settings.useModelNames]);

  const stepName = (step, items) => {
    if (step.kind === 'model') return 'פרטי הדגם';
    const it = (items || []).find((x) => String(x.id) === String(step.itemId));
    return it ? `פריט ${it.bc || `${it.size}/${it.serial}`}` : 'פריט';
  };

  const doSave = useCallback(async () => {
    if (savingRef.current) return null;
    savingRef.current = true; setSaving(true);
    try {
      const { st, failures, okLines } = await runPlan();
      redoRef.current = []; setRedoCount(0);
      setRaw(st.raw);
      setState({ saved: st.saved, cur: st.cur });
      dressCache.delete(dressId);
      setLogsVersion((v) => v + 1);
      // שם דגם שכבר קיים: ההודעה נשארת ליד שדה השם (לשונית הפרטים במצב עריכה) ולא רק בחלון התקלות
      const nameFail = failures.find((f) => f.step.kind === 'model' && f.field === 'name');
      setNameConflict(nameFail ? { name: st.cur.model.name, text: nameFail.error } : null);
      if (nameFail) { setTab('details'); setEditDet(true); }
      if (failures.length) {
        ui.hideToast();
        await ui.alert({
          title: 'חלק מהשינויים לא נשמרו', kind: 'error', okText: 'הבנתי',
          sub: 'השינויים שלא נשמרו נשארו ברשימת "שינויים בכרטיס" - אפשר לתקן ולנסות שוב.',
          body: <div className="chg">{failures.map((f, i) => <div className="c" key={i}><div className="t"><b>{stepName(f.step, st.cur.items)}</b><div className="faint sm">{f.error}</div></div></div>)}</div>,
        });
        return { okLines, failures };
      }
      // רענון שקט מהשרת (תאריך עדכון וכו') - רק כשהכול נשמר
      fetch(`/api/dresses/${dressId}?includeDeleted=true`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && !diffChanges(stateRef.current.saved, stateRef.current.cur).length) applyServer(d); }).catch(() => {});
      return { okLines, failures: [] };
    } finally { savingRef.current = false; setSaving(false); }
  }, [runPlan, dressId, ui, applyServer]);

  // זרימת השמירה של העיצוב: אימות -> חלון הסיכום (או "שינויים שלא נשמרו" ביציאה) -> שמירה -> חלון "כרטיס הדגם נשמר".
  // מחזיר 'saved' | 'discard' | 'cancel' | 'fail'
  const saveFlow = useCallback(async (from) => {
    const s = stateRef.current;
    if (!s || savingRef.current) return 'cancel';
    if (!diffChanges(s.saved, s.cur).length) return 'cancel';
    if (!validate()) return 'fail';
    const choice = await ui.openDialog(DcSummaryDialog, { mode: from === 'exit' ? 'exit' : 'save', changes: diffChanges(s.saved, s.cur) });
    if (choice === 'discard') {
      if (from !== 'exit') { redoRef.current = [clone(s.cur)]; setRedoCount(1); }
      setState({ saved: s.saved, cur: clone(s.saved) });
      ui.hideToast();
      return 'discard';
    }
    if (choice !== 'save') return 'cancel';
    const res = await doSave();
    if (!res || res.failures.length) return 'fail';
    ui.hideToast();
    const n = res.okLines;
    const m = stateRef.current.saved.model;
    ui.toast('info', 'כרטיס הדגם נשמר', n === 1 ? 'שינוי אחד נשמר' : `${n} שינויים נשמרו`);
    const next = await ui.openDialog(DcSuccessDialog, { sub: `דגם · ${modelDisplayName({ name: m.name, barcodePrefix: m.code }, { fallback: '' }) || m.code} · ${n === 1 ? 'שינוי אחד נשמר' : `${n} שינויים נשמרו`}` });
    if (next === 'print') window.open(`/dashboard/dresses/${dressId}/print`, '_blank');
    else if (next === 'list') router.push(LIST_HREF);
    return 'saved';
  }, [validate, ui, doSave, dressId, router]);

  const save = useCallback(() => saveFlow('save'), [saveFlow]);
  useEffect(() => { saveRef.current = () => saveFlow('save'); }, [saveFlow]);

  // ---------- יציאה ----------
  const exit = useCallback(async (href) => {
    const dest = typeof href === 'string' ? href : LIST_HREF;
    const s = stateRef.current;
    if (s && diffChanges(s.saved, s.cur).length) {
      const r = await saveFlow('exit');
      if (r === 'discard') { window.__gmDirty = undefined; router.push(dest); return true; }
      return false; // נשמר (החלון הסופי מציע "לרשימת הדגמים") / בוטל / נכשל
    }
    router.push(dest);
    return true;
  }, [saveFlow, router]);
  const exitRef = useRef(exit);
  useEffect(() => { exitRef.current = exit; }, [exit]);
  // קישורים פנימיים בזמן שיש שינויים: אותו חלון יציאה (כמו בכרטיס ההזמנה)
  useEffect(() => {
    if (!dirty) return undefined;
    const onDocClick = (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || a.target === '_blank' || href === window.location.pathname) return;
      e.preventDefault(); e.stopPropagation();
      exitRef.current(href);
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [dirty]);

  // ---------- מחיקה / שחזור של הדגם (אותם כללים כמו הדף הישן) ----------
  const deleteModel = useCallback(async () => {
    try {
      const res = await fetch(`/api/dresses/${dressId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setState((s) => (s ? { saved: { ...s.saved, model: { ...s.saved.model, isDeleted: true } }, cur: { ...s.cur, model: { ...s.cur.model, isDeleted: true } } } : s));
        ui.toast('info', 'הדגם נמחק', 'מחיקה רכה - ניתן לשחזר');
        return true;
      }
      ui.toast('error', 'מחיקת הדגם נכשלה', data.error || '');
    } catch { ui.toast('error', 'שגיאה בתקשורת עם השרת', ''); }
    return false;
  }, [dressId, ui]);
  const restoreModel = useCallback(async () => {
    try {
      const res = await fetch(`/api/dresses/${dressId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isDeleted: false }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState((s) => (s ? { saved: { ...s.saved, model: { ...s.saved.model, isDeleted: false } }, cur: { ...s.cur, model: { ...s.cur.model, isDeleted: false } } } : s));
        ui.toast('info', 'הדגם שוחזר', '');
        return true;
      }
      ui.toast('error', 'שחזור הדגם נכשל', data.error || '');
    } catch { ui.toast('error', 'שגיאה בתקשורת עם השרת', ''); }
    return false;
  }, [dressId, ui]);

  // ---------- תמונה (אותו flow של העלאה כמו הדף הישן; ההחלפה נשמרת בלחיצה על "שמור") ----------
  const uploadImage = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) { patchModel({ img: data.imageUrl, thumb: data.thumbnailUrl || '' }); ui.toast('info', 'התמונה הועלתה', 'לחצו שמירה כדי לשמור אותה בדגם'); }
      else ui.toast('error', 'שגיאה בהעלאת התמונה', '');
    } catch { ui.toast('error', 'שגיאה בתקשורת בהעלאת התמונה', ''); } finally { setUploading(false); }
  }, [patchModel, ui]);

  // ---------- טעינה עצלה: השכרות + היסטוריה ----------
  useEffect(() => { rentalsStore.emit(rentals); }, [rentals, rentalsStore]);
  const rentalsReq = useRef('idle');
  const ensureRentals = useCallback((force) => {
    if (!force && rentalsReq.current !== 'idle') return;
    rentalsReq.current = 'loading';
    setRentals((r) => ({ ...r, status: 'loading' }));
    fetch(`/api/dresses/${dressId}/rentals`).then((res) => { if (!res.ok) throw new Error('שגיאה בטעינת ההשכרות'); return res.json(); })
      .then((d) => {
        const today = getIsraelTodayKey();
        rentalsReq.current = 'ready';
        setRentals({ status: 'ready', list: (d.rentals || []).map((x, i) => rentalFromServer(x, i, today)), stats: d.stats || { total: 0, lastYear: 0, outNow: 0, overdue: 0 } });
      })
      .catch((e) => { rentalsReq.current = 'error'; setRentals((x) => ({ ...x, status: 'error', error: e.message })); });
  }, [dressId]);
  // סמן "השכרות" בלשונית דורש את הנתונים כבר בפתיחה (העיצוב מציג אותו מההתחלה)
  useEffect(() => { if (status === 'ready') ensureRentals(); }, [status, ensureRentals]);

  const modelDbId = saved ? saved.model.id : null;
  const itemIdsKey = saved ? saved.items.filter((i) => typeof i.id === 'string').map((i) => i.id).join(',') : '';
  const logsReq = useRef(-1);
  const ensureLogs = useCallback((force) => {
    if (!modelDbId) return;
    if (!force && logsReq.current === logsVersion) return;
    logsReq.current = logsVersion;
    const mySeq = ++logsKey.current;
    setLogs((l) => ({ ...l, status: 'loading' }));
    const reqs = [fetch(`/api/audit?entityType=DressModel&entityId=${modelDbId}&limit=100`).then((r) => (r.ok ? r.json() : { logs: [] }))];
    if (itemIdsKey) reqs.push(fetch(`/api/audit?entityType=DressItem&entityIds=${itemIdsKey}&limit=200`).then((r) => (r.ok ? r.json() : { logs: [] })));
    Promise.all(reqs).then((rs) => { if (mySeq === logsKey.current) setLogs({ status: 'ready', modelLogs: rs[0].logs || [], itemLogs: rs[1] ? rs[1].logs || [] : [] }); })
      .catch((e) => { if (mySeq === logsKey.current) setLogs((x) => ({ ...x, status: 'error', error: e.message })); });
  }, [modelDbId, itemIdsKey, logsVersion]);
  // הרישומים נטענים כשנכנסים ללשונית "פריטים" (פרטי הוספה בפירוט שורה) או "היסטוריה"; אחרי שמירה (logsVersion) - נטענים מחדש
  useEffect(() => { if (status === 'ready' && (tab === 'history' || tab === 'items')) ensureLogs(); }, [status, tab, ensureLogs]);
  useEffect(() => { if (tab === 'rentals' || tab === 'history') ensureRentals(); }, [tab, ensureRentals]);

  // ---------- נגזרות ----------
  const prefix = cur ? cur.model.code : '';
  const cn = useMemo(() => (cur ? counts(cur.items) : counts([])), [cur]);
  const markers = useMemo(() => (cur ? tabMarkers({ items: cur.items, rentalStats: rentals.status === 'ready' ? rentals.stats : null }) : {}), [cur, rentals]);
  const historyRows = useMemo(() => buildDressHistoryRows({ modelLogs: logs.modelLogs, itemLogs: logs.itemLogs, items: cur ? cur.items : [], prefix }), [logs.modelLogs, logs.itemLogs, cur, prefix]);
  const life = useMemo(() => (cur ? lifeNodes({ model: cur.model, rentals: rentals.list, todayKey: getIsraelTodayKey(), nextWorking: (k) => nextWorkingDay(k, null) }) : []), [cur, rentals.list]);
  const flags = useMemo(() => ({
    useModelNames: settings.useModelNames !== 'false',
    showImages: settings.hide_dress_images !== 'true',
    useFileNamesForImages: settings.useFileNamesForImages === 'true',
    premiumEnabled: settings.premium_pricing_enabled === 'true',
  }), [settings]);

  // "צ'יפ" ברייל -> לשונית הפריטים עם סינון (all | avail | repair | unused | reserve); סריקה -> איתור פריט ופתיחת הפירוט. הרשימה קוראת את listIntent
  const goFilter = useCallback((filter) => { setTab('items'); setListIntent({ type: 'filter', filter, n: Date.now() }); }, []);
  const hitTimer = useRef(null);
  const locateItem = useCallback((id) => {
    setTab('items'); setListIntent({ type: 'locate', id, n: Date.now() }); setHit(id);
    clearTimeout(hitTimer.current); hitTimer.current = setTimeout(() => setHit(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(hitTimer.current), []);
  const lastUpdate = useMemo(() => {
    const iso = raw && raw.updatedAt; if (!iso) return null;
    return { day: israelDayKey(iso), time: israelTime(iso) };
  }, [raw]);

  const nameError = nameConflict && cur && nameConflict.name === cur.model.name ? nameConflict.text : '';

  return {
    dressId, status, raw, saved, cur, settings, flags, categories, locations, prefix, canManageItems, nameError,
    tab, setTab, editDet, setEditDet,
    changes, dirty, saving, uploading, redoCount, hit, setHit, listIntent, goFilter, locateItem,
    counts: cn, markers, rentals, rentalsStore, ensureRentals, logs, ensureLogs, historyRows, life, lastUpdate,
    patchModel, setActive, patchItem, addItemLocal, deleteItem, undoChange, redo, discardAll,
    save, exit, deleteModel, restoreModel, uploadImage,
  };
}
