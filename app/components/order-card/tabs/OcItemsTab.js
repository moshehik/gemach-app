'use client';

// OcItemsTab — לשונית "פריטים" של כרטיס ההזמנה החדש (W3, PLAN §B.5; העיצוב: pItems → .card.items-card). מקבלת {oc, ui, active}.
//  - "הוסף פריט" (btn navy) → חלונית "הוספת שמלה" (OcAddItemPanel, A27/R23). מוסתר בהזמנה נעולה (R3) וכשהמכסה max_items_per_order
//    מלאה — בלי הודעה (R32).
//  - פס "ההזמנה נעולה" מתחת לכותרת כשתאריך האירוע עבר ולא שוחרר (R3).
//  - סרגל (A10): "פריטים N" · מתג רשימה/טבלה דו-מצבי (OcViewSwitch, כמו בהיסטוריה/כרטיס הלקוח) · פרטי תיקונים (כש-enable_alterations) · מחוקים — כל הלחצנים באותו גובה ובסגנון לחצן
//    "מחוקים" (btn tgl, ✓ כשנבחר — הערת הבעלים). טבלה = תצוגה בלבד, עם מיון עמודות.
//  - רשימה: OcItemRow (R25–R30, A11). מחוקים: רשימה נפרדת עם "שחזור".
//  - חלונות: עריכה (R24), פרטים והיסטוריה (R28), תפוסה (R29), בחירת פריט לברקוד (R25) — כולם דרך ui.openDialog (כהים).
// מפת פורט: ModernItemsManager.js (MIM) — הפעולות ב-hooks/useItemActions.js; התצוגה לפי העיצוב (לא טבלת הישן).
import { useCallback, useMemo, useRef, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import OcIcon from '../OcIcon';
import OcViewSwitch from '../OcViewSwitch';
import { fmtMoney } from '../orderCardLogic';
import useItemActions, { altText, alterationsEnabled, creatorIdOf, itemName, itemPrice, quotaFull, statusText, IT_COLS, sortItems } from '../hooks/useItemActions';
import OcItemRow from '../parts/OcItemRow';
import OcAddItemPanel from '../parts/OcAddItemPanel';
import OcItemEditDialog from '../parts/OcItemEditDialog';
import OcItemDetailsDialog from '../parts/OcItemDetailsDialog';
import OcCapacityDialog from '../parts/OcCapacityDialog';
import { OcItemChooserDialog } from '../parts/OcBarcodeRow';


function ItemsTable({ list, mode, order, sort, setSort, altEnabled }) {
  const cols = altEnabled ? IT_COLS : IT_COLS.filter(([k]) => k !== 'alt');
  const rows = sortItems(list, sort, order, mode);
  return (
    <div className="tblw">
      <table className="rtbl">
        <thead>
          <tr>
            {cols.map(([k, t]) => (
              <th key={k} className={sort.col === k ? `sorted ${sort.dir > 0 ? 'asc' : 'desc'}` : ''} aria-sort={sort.col === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                <span className="thw">{t}
                  <span className="tsort">
                    <button type="button" className="tsb tu" aria-label={`מיון ${t} עולה`} onClick={() => setSort({ col: k, dir: 1 })}><OcIcon name="chev" size="sm" /></button>
                    <button type="button" className="tsb td" aria-label={`מיון ${t} יורד`} onClick={() => setSort({ col: k, dir: -1 })}><OcIcon name="chev" size="sm" /></button>
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((i, n) => (
            <tr key={i.id || i._localId || n}>
              <td><b><bdi>{itemName(i)}</bdi></b></td>
              <td>{i.sizeText || '—'}</td>
              <td>{statusText(i, order, mode)}</td>
              {altEnabled ? <td>{altText(i) || '—'}</td> : null}
              <td><bdi dir="ltr">{fmtMoney(itemPrice(i))}</bdi></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// לחצן סרגל (A10): כולם btn tgl באותו גובה, ✓ (evck) כשנבחר — כמו "מחוקים"
function BarToggle({ on, onClick, icon, children, id, act }) {
  return (
    <button type="button" id={id} className={`btn tgl oc-bt${on ? ' on' : ''}`} data-act={act} aria-pressed={!!on} onClick={onClick}>
      {on ? <OcIcon name="check" size="sm" className="evck" /> : null}
      {id === 'delToggle' ? <span className="dtico"><OcIcon name="trash" size="sm" /></span> : <OcIcon name={icon} size="sm" />}
      {children}
    </button>
  );
}

export default function OcItemsTab({ oc, ui }) {
  const chooseItem = useCallback(({ candidates, barcode }) => ui.openDialog(OcItemChooserDialog, { candidates, barcode }), [ui]);
  const actions = useItemActions(oc, ui, { chooseItem });
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState('list');
  const [sub, setSub] = useState('active');
  const [altShow, setAltShow] = useState(false);
  const [sort, setSort] = useState({ col: 'model', dir: 1 });
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const [creators, setCreators] = useState({}); // itemId → employeeId | null (A11)
  const [employees, setEmployees] = useState(null);
  const logsCache = useRef(new Map());

  const locked = oc.flags.isLocked;
  const altEnabled = alterationsEnabled(oc.settings);
  const full = quotaFull(oc.settings, oc.items);
  const items = oc.items || [];
  const act = useMemo(() => items.filter(i => !i.isDeleted), [items]);
  const del = useMemo(() => items.filter(i => i.isDeleted && (i.id || i._localId)), [items]);
  const mode = sub === 'del' ? 'del' : 'active';
  const list = mode === 'del' ? del : act;

  // יומן הפריט (A11 "פרטי הוספה" + חלון הפרטים) — נטען פעם אחת לפריט, רק כשצריך
  const loadLogs = useCallback((id) => {
    const c = logsCache.current;
    if (!c.has(id)) {
      c.set(id, fetch(`/api/audit/order-item/${id}`).then(r => (r.ok ? r.json() : [])).catch(() => []));
    }
    return c.get(id);
  }, []);
  const ensureEmployees = useCallback(() => {
    if (employees) return;
    fetchSharedJson('/api/employees?slim=1', { ttl: TTL.STATIC }).then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => setEmployees([]));
  }, [employees]);
  const employeeName = useCallback((id) => {
    if (!id || !employees) return '';
    const e = employees.find(x => String(x.id) === String(id));
    return e ? `${e.firstName || ''} ${e.lastName || ''}`.trim() : '';
  }, [employees]);

  const toggleRow = (item) => {
    const k = item.id || item._localId;
    setOpenKeys(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
    if (item.id && !item.isNew && !(item.id in creators)) {
      ensureEmployees();
      loadLogs(item.id).then(logs => setCreators(prev => ({ ...prev, [item.id]: creatorIdOf(logs) })));
    }
  };

  const openEdit = (item) => {
    if (item.isTaken && !item.isReturned) { ui.toast('error', 'לא ניתן לערוך פריט שכבר נלקח (מושכר).'); return; }
    ui.openDialog(OcItemEditDialog, { item, oc, ui, actions, rules: actions.rules, altEnabled }, { className: 'oc-editdlg' });
  };
  const openDetails = (item) => {
    ensureEmployees();
    ui.openDialog(OcItemDetailsDialog, { item, order: oc.order, obligations: (oc.snapshot && oc.snapshot.obligations) || oc.obligations, loadLogs, employeeName }, { className: 'oc-detdlg' });
  };
  const openCapacity = (item) => ui.openDialog(OcCapacityDialog, { item, order: oc.order }, { className: 'oc-capdlg' });

  const showAdd = !locked && !full;
  const tbl = view === 'table';

  return (
    <div className="card items-card">
      <div className="card-h">
        <div className="ico teal"><OcIcon name="dress" size="lg" /></div>
        <h2>פריטים</h2>
        {showAdd ? (
          <button type="button" className="btn navy" data-act="addtoggle" aria-expanded={addOpen} onClick={() => setAddOpen(v => !v)}>
            <OcIcon name="plus" />הוסף פריט
          </button>
        ) : null}
      </div>
      {locked ? (
        <div className="chip amber oc-lockbar" data-act="lockbar" role="status">
          <OcIcon name="lock" size="sm" />ההזמנה נעולה — תאריך האירוע עבר · השכרה, עריכה ומחיקה של פריטים חסומות
        </div>
      ) : null}
      {showAdd ? <OcAddItemPanel oc={oc} ui={ui} actions={actions} open={addOpen} onClose={() => setAddOpen(false)} altEnabled={altEnabled} /> : null}
      <div className="hres-bar">
        <span className="hres-n">פריטים <b>{list.length}</b></span>
        <OcViewSwitch value={view} onChange={setView} act="view" />
        {altEnabled ? <BarToggle on={altShow} icon="scissors" act="altshow" onClick={() => setAltShow(v => !v)}>פרטי תיקונים</BarToggle> : null}
        {del.length || sub === 'del' ? <BarToggle id="delToggle" on={sub === 'del'} act="deltoggle" onClick={() => setSub(s => (s === 'del' ? 'active' : 'del'))}>מחוקים</BarToggle> : null}
      </div>
      <div className="hres">
        {!list.length ? (
          <div className="empty">{mode === 'del' ? 'אין פריטים שנמחקו' : 'אין פריטים פעילים'}</div>
        ) : tbl ? (
          <ItemsTable list={list} mode={mode} order={oc.order} sort={sort} setSort={setSort} altEnabled={altEnabled} />
        ) : (
          <div className="hgrp">
            {list.map(item => {
              const k = item.id || item._localId;
              return (
                <OcItemRow
                  key={k}
                  item={item}
                  mode={mode}
                  oc={oc}
                  ui={ui}
                  actions={actions}
                  open={openKeys.has(k)}
                  onToggle={() => toggleRow(item)}
                  locked={locked}
                  quotaFull={full}
                  altEnabled={altEnabled}
                  altShow={altShow}
                  creatorName={item.id ? employeeName(creators[item.id]) : ''}
                  onDetails={() => openDetails(item)}
                  onCapacity={() => openCapacity(item)}
                  onEdit={() => openEdit(item)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
