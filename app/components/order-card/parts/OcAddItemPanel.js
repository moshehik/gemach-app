'use client';

// OcAddItemPanel — חלונית "הוספת שמלה" בלשונית הפריטים (העיצוב: .addpanel; A27, R23). דגם (שדה עם הצעות כמו בעיצוב, data-sug →
// .advlist), מידה (לחצני .sizes עם הזמינות של הישן), תיקונים כש-enable_alterations פעיל (צוואר / שרוול / "אורך" בלי "ס״מ" /
// "פירוט התיקון הנדרש"), "מחיר השכרה" ו"דמי ביטול כרגע" מהמנוע (POST preview-pricing — לא ערכים קבועים; AMB-14) ו"הוסף להזמנה"
// (= "אישור" של שורה חדשה בישן: POST מיידי, R47 לפי ההגדרה).
//
// מפת פורט: ModelInput ← components/orders/OrderModelSelector.js (חיפוש /api/inventory/models?q=…&hasActiveItems=true, 300ms,
// Enter = התאמה מדויקת לשם/קוד, "ללא שם" → קוד) ; useSizeRows/SizeButtons ← components/orders/OrderSizeSelector.js (חישוב מקומי
// ממטמון המלאי, אחרת /api/orders/availability או /api/inventory/sizes; אותו טקסט זמינות, מידה לא זמינה מנוטרלת).
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { calculateDynamicAvailability } from '@/lib/clientInventory';
import { sortSizeRows } from '@/lib/sizeSort';
import OcIcon from '../OcIcon';
import { buildPreviewBody, fmtMoney } from '../orderCardLogic';
import { isChecked } from '../hooks/useItemActions';

const NO_FILL = { autoComplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };

// "ללא שם" → קוד הדגם (OrderModelSelector.displayModelName)
export function displayModelName(model) {
  const name = (model?.name || '').trim();
  if (name.startsWith('ללא שם') && model?.barcodePrefix) return String(model.barcodePrefix);
  return name;
}

// ---------- דגם: שדה עם רשימת הצעות ----------
export function ModelInput({ id, value, onChange, ui, disabled }) {
  const [query, setQuery] = useState(value ? displayModelName(value) : '');
  const [models, setModels] = useState([]);
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  const wrapRef = useRef(null);
  const effectiveQuery = open && value && query === displayModelName(value) ? '' : query;

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      fetchSharedJson(`/api/inventory/models?q=${encodeURIComponent(effectiveQuery)}&hasActiveItems=true`, { ttl: TTL.REFERENCE })
        .then(data => { if (!cancelled) { setModels(data.models || []); setAct(-1); } })
        .catch(err => console.error('Failed to fetch models', err));
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [effectiveQuery, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);

  const pick = (m) => { setQuery(displayModelName(m)); setOpen(false); onChange(m); };
  // Enter בלי בחירה מהרשימה: התאמה מדויקת לשם או לקוד, אחרת הודעה (OrderModelSelector.resolveTypedValue)
  const resolveTyped = async () => {
    const typed = query.trim();
    if (!typed) return;
    if (value && typed.toLowerCase() === displayModelName(value).trim().toLowerCase()) { setOpen(false); return; }
    const findExact = (list) => (list || []).find(m => (m.name && m.name.trim().toLowerCase() === typed.toLowerCase())
      || (m.barcodePrefix && String(m.barcodePrefix).trim().toLowerCase() === typed.toLowerCase()));
    let match = findExact(models);
    if (!match) {
      try {
        const data = await fetchSharedJson(`/api/inventory/models?q=${encodeURIComponent(typed)}&hasActiveItems=true`, { ttl: TTL.REFERENCE });
        match = findExact(data.models);
      } catch (err) { console.error('Failed to resolve typed model', err); }
    }
    if (match) pick(match);
    else ui.toast('error', `לא נמצא דגם עם השם/קוד "${typed}". יש לבחור דגם מהרשימה הנפתחת.`);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!models.length) return;
      e.preventDefault();
      setOpen(true);
      setAct(a => (a + (e.key === 'ArrowDown' ? 1 : -1) + models.length) % models.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && act >= 0 && models[act]) pick(models[act]);
      else resolveTyped();
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };
  const clear = () => { setQuery(''); onChange(null); setOpen(true); };
  const listId = `${id}-list`;
  return (
    <div className="inpw" ref={wrapRef}>
      <OcIcon name="dress" size="sm" />
      <input
        className="inp"
        id={id}
        name={`${id}-nofill`}
        inputMode="numeric"
        value={query}
        placeholder="מספר דגם..."
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && act >= 0 ? `${listId}-${act}` : undefined}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); }}
        onKeyDown={onKey}
        {...NO_FILL}
      />
      {query ? <button type="button" className="inpx" aria-label="ניקוי" data-tip="ניקוי" onMouseDown={(e) => e.preventDefault()} onClick={clear}><OcIcon name="x" size="sm" /></button> : null}
      {open ? (
        <ul className="advlist" id={listId} role="listbox" aria-label="הצעות">
          {models.length ? models.map((m, i) => (
            <li key={m.id} id={`${listId}-${i}`} role="option" aria-selected={i === act} className={`advo${i === act ? ' act' : ''}`} onMouseDown={(e) => { e.preventDefault(); pick(m); }}>
              <span className="advo-t">{displayModelName(m)}{m.barcodePrefix && displayModelName(m) !== String(m.barcodePrefix) ? <span className="faint oc-advcode"> · קוד {m.barcodePrefix}</span> : null}</span>
            </li>
          )) : <li className="advo none" role="presentation">אין התאמות</li>}
        </ul>
      ) : null}
    </div>
  );
}

// ---------- מידה: שורות זמינות (OrderSizeSelector) ----------
export function useSizeRows(modelId, order, inventoryCache, cartItems) {
  const [fetched, setFetched] = useState({ key: '', rows: [] });
  const local = useMemo(() => {
    if (!modelId || !inventoryCache || !order) return null;
    try {
      return calculateDynamicAvailability(modelId, order.isAbroad ? order.fromDate : order.eventDate, order.isAbroad ? order.toDate : null, inventoryCache, cartItems || [], order.customSpacing);
    } catch (err) {
      console.error('Failed to calculate sizes from cache', err);
      return [];
    }
  }, [modelId, order, inventoryCache, cartItems]);
  const fetchKey = !modelId || local ? '' : JSON.stringify([modelId, order?.isAbroad, order?.eventDate, order?.fromDate, order?.toDate, order?.customSpacing]);
  useEffect(() => {
    if (!fetchKey) return undefined;
    let cancelled = false;
    let url = `/api/inventory/sizes?modelId=${modelId}`;
    const hasDates = order ? (order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate) : false;
    if (hasDates) {
      const queryParams = new URLSearchParams({ dressModelId: modelId, isAbroad: order.isAbroad || false });
      if (order.eventDate) queryParams.append('eventDate', order.eventDate);
      if (order.isAbroad) {
        if (order.fromDate) queryParams.append('fromDate', order.fromDate);
        if (order.toDate) queryParams.append('toDate', order.toDate);
      }
      if (order.customSpacing !== undefined && order.customSpacing !== null) queryParams.append('customSpacing', order.customSpacing);
      url = `/api/orders/availability?${queryParams.toString()}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : (data.sizes || []);
        setFetched({ key: fetchKey, rows: sortSizeRows(rows.map(r => (typeof r === 'string' ? { sizeText: r } : r))) });
      })
      .catch(err => console.error('Failed to fetch sizes', err));
    return () => { cancelled = true; };
  }, [fetchKey]);
  if (local) return { rows: local, loading: false };
  if (!modelId) return { rows: [], loading: false };
  return fetched.key === fetchKey ? { rows: fetched.rows, loading: false } : { rows: [], loading: true };
}

// טקסט הזמינות של הישן (OrderSizeSelector :104-121) + האם מנוטרלת
export function sizeInfo(row, order) {
  const normalAvail = row.withNormalBuffer?.availableQuantity ?? row.availableQuantity;
  const customAvail = row.withCustomSpacing?.availableQuantity;
  const hasCustom = !!order && order.customSpacing !== undefined && order.customSpacing !== null;
  const selectedAvail = hasCustom ? customAvail : normalAvail;
  const disabled = selectedAvail !== undefined && selectedAvail !== null && selectedAvail <= 0;
  let info;
  if (normalAvail !== undefined) {
    if (row.withCustomSpacing) {
      const gain = row.withCustomSpacing.gain || 0;
      info = `רגיל: ${normalAvail} | ציפוף: ${customAvail}${gain > 0 ? ` (+${gain})` : ''} מתוך ${row.totalInStock}`;
    } else {
      info = `פנוי ${normalAvail} מתוך ${row.totalInStock}`;
    }
  } else {
    info = `במלאי: ${row.totalQuantity || row.totalInStock}`;
  }
  return { size: row.sizeText || row.size, info, disabled };
}

// variant="pill": גלולת בחירה (seg pill + pth) כמו "מידה חלופית פנויה" בחלון העריכה של העיצוב
export function SizeButtons({ rows, order, value, onChange, allow, loading, labelledBy, variant }) {
  if (loading) return <div className="faint oc-sizes-msg" role="status">טוען מידות...</div>;
  const list = rows.map(r => sizeInfo(r, order)).filter(s => s.size && (!allow || s.size === value || allow(s.size)));
  if (!list.length) return <div className="faint oc-sizes-msg">אין מידות להצגה</div>;
  if (variant === 'pill') {
    const idx = Math.max(0, list.findIndex(s => s.size === value));
    return (
      <div className="seg pill" role="radiogroup" aria-labelledby={labelledBy} style={{ '--n': list.length, '--i': idx }}>
        <span className="pth" aria-hidden="true" />
        {list.map(s => (
          <button key={s.size} type="button" role="radio" aria-checked={value === s.size} className={value === s.size ? 'on' : ''} disabled={s.disabled && value !== s.size} data-tip={s.info} aria-label={`מידה ${s.size} (${s.info})`} onClick={() => onChange(s.size)}>{s.size}</button>
        ))}
      </div>
    );
  }
  return (
    <div className="sizes" role="radiogroup" aria-labelledby={labelledBy}>
      {list.map(s => (
        <button key={s.size} type="button" role="radio" aria-checked={value === s.size} className={value === s.size ? 'on' : ''} disabled={s.disabled && value !== s.size} data-tip={s.info} aria-label={`מידה ${s.size} (${s.info})`} onClick={() => onChange(s.size)}>
          {s.size}
        </button>
      ))}
    </div>
  );
}

// ---------- תיקונים (R23): צוואר / שרוול / אורך / פירוט ----------
export function AltFields({ value, onChange, idPrefix, lockedParts = false, label = 'פרטי תיקון', boxClass = 'field' }) {
  const neck = isChecked(value.neckAlteration);
  const sleeve = isChecked(value.sleeveAlteration);
  return (
    <div className={`${boxClass} oc-alt`}>
      <label className="lbl" id={`${idPrefix}-altl`}><OcIcon name="scissors" size="sm" />{label}</label>
      <div className="row wrap oc-alt-row">
        <button type="button" className={`btn tgl${neck ? ' on' : ''}`} aria-pressed={neck} disabled={lockedParts} onClick={() => onChange({ neckAlteration: neck ? 0 : 1 })}>{neck ? <OcIcon name="check" size="sm" className="evck" /> : null}צוואר</button>
        <button type="button" className={`btn tgl${sleeve ? ' on' : ''}`} aria-pressed={sleeve} disabled={lockedParts} onClick={() => onChange({ sleeveAlteration: sleeve ? 0 : 1 })}>{sleeve ? <OcIcon name="check" size="sm" className="evck" /> : null}שרוול</button>
        <div className="inpw oc-len">
          <input className="inp" inputMode="decimal" placeholder="אורך" aria-label="אורך" disabled={lockedParts} value={value.lengthAlteration || ''} onChange={(e) => onChange({ lengthAlteration: e.target.value })} {...NO_FILL} />
        </div>
      </div>
      <textarea className="inp" rows={2} placeholder="פירוט התיקון הנדרש…" aria-label="פירוט התיקון הנדרש" value={value.alterationDetails || ''} onChange={(e) => onChange({ alterationDetails: e.target.value })} {...NO_FILL} />
    </div>
  );
}

// ---------- A27: מחיר השכרה ודמי ביטול מהמנוע ----------
// פריט "היפותטי" (לא נשמר) נשלח ל-preview-pricing (אותו endpoint וגוף כמו התצוגה המקדימה של הישן, בלי כתיבה) עם שאר הפריטים:
// פעם פעיל → סכום חיובי ההשכרה שלו (בלי שורות "תיקון"); פעם כמבוטל עכשיו → מה שהיה נשאר לתשלום (= דמי הביטול לפי המדרגות).
export const PREVIEW_ITEM_ID = 'oc-add-preview';
export function hypotheticalItem(model, draft) {
  return {
    id: PREVIEW_ITEM_ID,
    legacyId: null,
    sizeText: draft.sizeText,
    neckAlteration: draft.neckAlteration || 0,
    sleeveAlteration: draft.sleeveAlteration || 0,
    lengthAlteration: draft.lengthAlteration || '',
    isDeleted: false,
    dressItem: { id: PREVIEW_ITEM_ID, dressModelId: model.id, sizeText: draft.sizeText, dress: { id: model.id, name: model.name, priceCategory: model.priceCategory || '', isPremium: !!model.isPremium, barcodePrefix: model.barcodePrefix } },
  };
}
export function priceFromPreview(newObligations) {
  return (newObligations || []).filter(o => o.orderItemId === PREVIEW_ITEM_ID && Number(o.amount) > 0 && !/^תיקון/.test(o.description || ''))
    .reduce((s, o) => s + Number(o.amount), 0);
}
export function feeFromPreview(newObligations) {
  const net = (newObligations || []).filter(o => o.orderItemId === PREVIEW_ITEM_ID).reduce((s, o) => s + (Number(o.amount) || 0), 0);
  return Math.max(0, Math.round(net * 100) / 100);
}
function useAddPricePreview(oc, model, draft) {
  const [res, setRes] = useState({ key: '', price: null, fee: null });
  const orderId = oc.order?.orderId;
  const key = model && draft.sizeText && orderId ? JSON.stringify([model.id, draft.sizeText, isChecked(draft.neckAlteration), isChecked(draft.sleeveAlteration), draft.lengthAlteration || '', oc.order.eventDate, oc.order.isAbroad, oc.order.fromDate, oc.order.toDate]) : '';
  const itemsRef = useRef(oc.items);
  const orderRef = useRef(oc.order);
  useEffect(() => { itemsRef.current = oc.items; orderRef.current = oc.order; });
  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      const hypo = hypotheticalItem(model, draft);
      const others = (itemsRef.current || []).filter(i => i.id && !i.isNew);
      const post = (items) => fetch(`/api/orders/${orderId}/preview-pricing`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPreviewBody(items, orderRef.current))
      }).then(r => (r.ok ? r.json() : null));
      try {
        const [active, cancelledNow] = await Promise.all([post([...others, hypo]), post([...others, { ...hypo, isDeleted: true }])]);
        if (cancelled) return;
        setRes({ key, price: active ? priceFromPreview(active.newObligations) : null, fee: cancelledNow ? feeFromPreview(cancelledNow.newObligations) : null });
      } catch (err) {
        console.error('Price preview failed', err);
        if (!cancelled) setRes({ key, price: null, fee: null });
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [key]);
  return res.key === key && key ? res : { price: null, fee: null };
}

const EMPTY_DRAFT = { sizeText: '', neckAlteration: 0, sleeveAlteration: 0, lengthAlteration: '', alterationDetails: '' };

export default function OcAddItemPanel({ oc, ui, actions, open, onClose, altEnabled }) {
  const [model, setModel] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const { rows, loading } = useSizeRows(model?.id, oc.order, oc.inventoryCache, oc.items);
  const { price, fee } = useAddPricePreview(oc, model, draft);
  const patch = (p) => setDraft(d => ({ ...d, ...p }));
  const canAdd = !!model && !!draft.sizeText && !busy;
  const add = async () => {
    if (!canAdd) return;
    setBusy(true);
    try {
      const r = await actions.addItem({ model, ...draft });
      if (r && (r.ok || r.localId)) { setModel(null); setDraft(EMPTY_DRAFT); if (r.ok) onClose(); }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`addpanel${open ? ' open' : ''}`} aria-hidden={!open} hidden={!open}>
      <div className="row spread">
        <b className="big oc-addt">הוספת שמלה</b>
        <button type="button" className="ibtn oc-addx" data-act="addtoggle" aria-label="סגירה" data-tip="סגירה" onClick={onClose}><OcIcon name="x" size="sm" /></button>
      </div>
      <div className="grid2">
        <div className="field">
          <label className="lbl" htmlFor="addModel">מספר דגם</label>
          <ModelInput id="addModel" value={model} ui={ui} onChange={(m) => { setModel(m); patch({ sizeText: '' }); }} />
        </div>
        <div className="field">
          <label className="lbl" id="addSizeL">מידה</label>
          {model ? <SizeButtons rows={rows} order={oc.order} value={draft.sizeText} loading={loading} labelledBy="addSizeL" onChange={(s) => patch({ sizeText: s })} /> : <div className="faint oc-sizes-msg">יש לבחור דגם</div>}
        </div>
      </div>
      {altEnabled ? <AltFields value={draft} idPrefix="add" onChange={patch} /> : null}
      <div className="row spread wrap">
        <span className="muted oc-addprice">
          מחיר השכרה: <b><bdi dir="ltr">{price !== null ? fmtMoney(price) : '—'}</bdi></b>
          {fee !== null ? <> · דמי ביטול כרגע <b><bdi dir="ltr">{fmtMoney(fee)}</bdi></b></> : null}
        </span>
        <button type="button" className="btn navy" data-act="additem" disabled={!canAdd} onClick={add}>
          <OcIcon name="plus" />{busy ? 'מוסיף...' : 'הוסף להזמנה'}
        </button>
      </div>
    </div>
  );
}
