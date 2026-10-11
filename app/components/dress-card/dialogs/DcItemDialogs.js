'use client';

// חלונות הפריט של כרטיס הדגם: הוספת פריט, עריכת פריט (מיקום תלת-מצבי, סטטוס, קרטון), פריט מחוק (שחזור), פרטי פריט והיסטוריית השכרות.
// addDlg / renderItemDlg / itemInfoDlg ב-model-card.js. כל החלונות עורכים עותק מקומי ומחזירים את התוצאה - השינוי עצמו נכנס לעגלה
// ("שינויים בכרטיס") ונשמר רק בלחיצה על "שמור".
import { useState, useSyncExternalStore } from 'react';
import { DlgBtn, DlgButtons, DlgHead } from '../../order-card/OcUi';
import OcIcon from '../../order-card/OcIcon';
import { DcPill, Tip } from '../DcParts';
import { RET_LABEL, bcFor, bcOf, hFull, hShort, locIcon, nextSerial, pad2, stOf, ST_LABEL, validateNewItem } from '@/lib/dressCardLogic';

const locOptions = (locations, current) => {
  const list = locations.includes(current) || !current ? locations : [...locations, current];
  return list.map((v) => ({ key: v, label: v, icon: locIcon(v) }));
};
const ST_OPTIONS = [{ key: 'normal', label: 'תקין', icon: 'check' }, { key: 'repair', label: 'בתיקון', icon: 'scissors' }, { key: 'unused', label: 'לא בשימוש', icon: 'ban' }];

/** close({size, serial, loc} | null) - ולידציה כמו addItem בדף הישן (+ ברקוד קיים) */
export function DcAddItemDialog({ items, prefix, locations, defaultLoc, close }) {
  const [size, setSize] = useState('');
  const [serial, setSerial] = useState('');
  const [loc, setLoc] = useState(defaultLoc || locations[0] || '');
  const [err, setErr] = useState('');
  const effSerial = serial || (size !== '' ? nextSerial(items, size) : '');
  const go = () => {
    const r = validateNewItem(items, prefix, { size, serial });
    if (r.error) { setErr(r.error); return; }
    close({ size: r.size, serial: r.serial, loc });
  };
  const onEnter = (e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); go(); } };
  return (
    <>
      <DlgHead id="oc-dlg-t" title="הוספת פריט" />
      <div className="dc-itm-dlg">
        <div className="dc-dlg-row dc2">
          <div className="field"><label className="lbl" htmlFor="dcNSize">מידה</label>
            <input className="inp" id="dcNSize" type="number" min="0" max="99" inputMode="numeric" placeholder="38" value={size} autoComplete="off" data-autofocus="true" onKeyDown={onEnter} onChange={(e) => { setSize(e.target.value); setErr(''); }} /></div>
          <div className="field"><label className="lbl" htmlFor="dcNSer">מס׳ סידורי</label>
            <input className="inp" id="dcNSer" type="number" min="0" max="99" inputMode="numeric" placeholder="אוטו׳" value={serial} autoComplete="off" onKeyDown={onEnter} onChange={(e) => { setSerial(e.target.value); setErr(''); }} /></div>
        </div>
        <div className="field"><label className="lbl">מיקום</label><DcPill id="dcNLoc" value={loc} options={locOptions(locations, loc)} onChange={setLoc} label="מיקום" /></div>
        <div className="field"><label className="lbl">ברקוד <Tip text="אוטומטי — נבנה מקוד הדגם + מידה + מס׳ סידורי" /></label>
          <div className="dc-barc"><OcIcon name="scan" /><bdi id="dcNBc">{size !== '' ? bcOf(prefix, size, effSerial) : `${prefix}____`}</bdi></div></div>
        <div className="dc-err" id="dcNErr" style={{ minHeight: 24 }} role="alert">{err ? <><OcIcon name="alert" size="sm" />{err}</> : null}</div>
      </div>
      <DlgButtons style={{ marginTop: 12 }}>
        <DlgBtn kind="primary" icon="plus" autoFocus={false} onClick={go}>הוסף לדגם</DlgBtn>
        <DlgBtn kind="ghost" icon="back" onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}

const LockedField = ({ label, value }) => <div className="field"><label className="lbl">{label}</label><input className="inp" value={value} disabled readOnly /></div>;

/** close({loc, carton, st, why} | {action:'delete'} | {action:'restore'} | null) */
export function DcEditItemDialog({ item, prefix, locations, onInfo, close }) {
  const bc = bcFor(item, prefix);
  const [loc, setLoc] = useState(item.loc);
  const [carton, setCarton] = useState(item.carton);
  const [st, setSt] = useState(stOf(item) === 'deleted' ? 'normal' : stOf(item));
  const [why, setWhy] = useState(item.why);
  if (item.del) {
    return (
      <>
        <DlgHead id="oc-dlg-t" title={<>פריט מחוק <bdi>{bc}</bdi></>} sub={<><span data-tip="מידה">{item.size}</span> · <span data-tip="מספר סידורי">{pad2(item.serial)}</span></>} />
        <DlgButtons>
          <DlgBtn kind="primary" icon="refresh" act="itm-del" autoFocus onClick={() => close({ action: 'restore' })}>שחזור פריט</DlgBtn>
          <DlgBtn kind="ghost" icon="back" onClick={() => close(null)}>סגירה</DlgBtn>
        </DlgButtons>
      </>
    );
  }
  return (
    <>
      <DlgHead id="oc-dlg-t" title={<>עריכת פריט <bdi>{bc}</bdi></>} sub={<Tip text="המידה, הסידורי והברקוד נעולים — הם מרכיבים את זהות הפריט" />} />
      <div className="dc-itm-dlg">
        <div className="dc-dlg-row">
          <LockedField label="מידה" value={item.size} />
          <LockedField label="סידורי" value={pad2(item.serial)} />
          <LockedField label="ברקוד" value={bc} />
        </div>
        <div className="field"><label className="lbl">מיקום</label><DcPill id="dcDLoc" value={loc} options={locOptions(locations, loc)} onChange={setLoc} label="מיקום" /></div>
        <div className="field"><label className="lbl">סטטוס</label><DcPill id="dcDSt" value={st} options={ST_OPTIONS} onChange={(v) => setSt(v)} label="סטטוס" /></div>
        {st === 'unused' ? <div className="field"><label className="lbl" htmlFor="dcDWhy">סיבה</label><textarea className="inp" id="dcDWhy" rows={2} placeholder="סיבה" value={why} data-autofocus="true" onChange={(e) => setWhy(e.target.value)} /></div> : null}
        <div className="field"><label className="lbl" htmlFor="dcDCart">מס׳ קרטון</label><input className="inp" id="dcDCart" value={carton} placeholder="מס׳" inputMode="numeric" autoComplete="off" onChange={(e) => setCarton(e.target.value)} /></div>
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="ibtn" aria-label="פרטים והיסטוריית השכרות" data-tip="פרטים והיסטוריית השכרות" onClick={() => onInfo(item.id)}><OcIcon name="info" size="sm" /></button>
          <button type="button" className="ibtn danger" aria-label="מחיקת פריט" data-tip="מחיקת פריט" onClick={() => close({ action: 'delete' })}><OcIcon name="trash" size="sm" /></button>
        </div>
      </div>
      <DlgButtons style={{ marginTop: 20 }}>
        <DlgBtn kind="primary" icon="check" act="itm-ok" autoFocus onClick={() => close({ loc, carton: carton.trim(), st, why: st === 'unused' ? why.trim() : '' })}>אישור</DlgBtn>
        <DlgBtn kind="ghost" icon="back" onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}

const Row = ({ k, v }) => <div className="hv-r"><small>{k}</small><b>{v}</b></div>;

/** פרטי פריט והיסטוריית השכרות (מתוך רשימת ההשכרות של הדגם - אותם נתונים כמו /api/dresses/items/[id]/history, מסוננים לפריט) */
export function DcItemInfoDialog({ item, prefix, rentalsStore, close }) {
  const rentals = useSyncExternalStore(rentalsStore.subscribe, rentalsStore.get, rentalsStore.get);
  const bc = bcFor(item, prefix);
  const st = stOf(item);
  const rs = (rentals.list || []).filter((r) => r.bc === bc).sort((a, b) => (a.event < b.event ? 1 : -1));
  return (
    <>
      <DlgHead id="oc-dlg-t" title={<>פרטי פריט <bdi>{bc}</bdi></>} sub={<><span data-tip="מידה">{item.size}</span> · <span data-tip="מספר סידורי">{pad2(item.serial)}</span> · {ST_LABEL[st]}</>} />
      <Row k="מיקום" v={item.loc || '—'} />
      <Row k="מס׳ קרטון" v={item.carton || '—'} />
      <Row k="נכנס למאגר" v={item.ent ? hFull(item.ent) : '—'} />
      {item.unused ? <Row k="סיבה" v={item.why || 'לא נרשמה סיבה'} /> : null}
      {rentals.status === 'ready' ? <Row k="סה״כ השכרות" v={rs.length} /> : null}
      <h2 style={{ fontSize: 18, margin: '20px 0 4px' }}>השכרות</h2>
      {rentals.status === 'loading' || rentals.status === 'idle' ? <div className="empty" role="status"><span className="spin" /><p>טוען היסטוריה...</p></div>
        : rentals.status === 'error' ? <div className="empty" role="alert"><OcIcon name="alert" /><p>שגיאה בטעינת ההשכרות</p></div>
          : rs.length ? rs.map((x) => <Row key={x.id} k={hShort(x.event)} v={`#${x.order} · ${x.cust} · ${RET_LABEL[x.ret]}`} />) : <div className="empty">אין השכרות</div>}
      <DlgButtons style={{ marginTop: 20 }}>
        <DlgBtn kind="primary" icon="check" autoFocus onClick={() => close(null)}>סגירה</DlgBtn>
      </DlgButtons>
    </>
  );
}
