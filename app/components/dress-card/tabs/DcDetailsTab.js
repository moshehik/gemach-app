'use client';

// DcDetailsTab - לשונית "פרטים" של כרטיס הדגם: זיהוי הדגם (תצוגה / עריכה), מצב הדגם (פעיל/לא פעיל + הצג בבדיקה [+ פרימיום]), תמונה, הערות.
// pDetailsView / pDetailsEdit / activityCard / imageCard / notesCard ב-model-card.js. כל העריכות נכנסות לעגלה ("שינויים בכרטיס") ונשמרות בלחיצה על "שמור".
import { useEffect, useRef, useState } from 'react';
import OcIcon from '../../order-card/OcIcon';
import { DcPill, Fld, Tip, Vf } from '../DcParts';
import { DcEntryDateDialog, DcInactiveDialog } from '../dialogs/DcDateDialogs';
import { hFull } from '@/lib/dressCardLogic';

export const CODE_TIP = 'קידומת הברקוד. הקוד ננעל לאחר יצירת הדגם כי הוא מרכיב את ברקודי הפריטים';
// קטגוריות קצרות (A, B...) מוצגות כ"קטגוריה A" כמו בעיצוב; שם ארוך מוצג כמו שהוא
export const catLabel = (c) => (/^[A-Za-z0-9]{1,3}$/.test(String(c || '')) ? `קטגוריה ${c}` : String(c || ''));

function PriceBtn() {
  return <a href="/dashboard/pricelist" target="_blank" rel="noopener noreferrer" className="btn sm" data-guide-id="dc.price-link" data-tip="מעבר למחירון הקטגוריה"><OcIcon name="ext" size="sm" />מחירון</a>;
}

function CatField({ dc }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = dc.cur.model.cat;
  const list = dc.categories.includes(cur) || !cur ? dc.categories : [...dc.categories, cur];
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const pick = (c) => { dc.patchModel({ cat: c }); setOpen(false); };
  return (
    <div className="field" data-guide-id="dc.f-cat">
      <label className="lbl" htmlFor="dcCatT">קטגוריית מחיר</label>
      <div className={`cb${open ? ' open' : ''}`} id="dcCat" ref={ref}>
        <button type="button" className="cb-t" id="dcCatT" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="cb-pin"><OcIcon name="tag" size="sm" /></span><span className="cb-v">{cur ? catLabel(cur) : '— בחר קטגוריית מחיר —'}</span><OcIcon name="chev" size="sm" />
        </button>
        <div className="cb-p" hidden={!open}>
          <ul className="cb-l" role="listbox" aria-label="קטגוריית מחיר">
            {list.map((c, i) => {
              const sel = c === cur;
              return (
                <li key={c} className={`cb-o${sel ? ' sel' : ''}`} role="option" aria-selected={sel} tabIndex={0} style={{ '--i': i }} onClick={() => pick(c)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(c); } }}>
                  <span className="cb-i"><OcIcon name="tag" size="sm" /></span><span className="cb-x"><b>{catLabel(c)}</b></span>{sel ? <span className="cb-ck"><OcIcon name="check" size="sm" /></span> : null}
                </li>
              );
            })}
            {cur ? (
              <li className="cb-o" role="option" aria-selected="false" tabIndex={0} style={{ '--i': list.length }} onClick={() => pick('')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(''); } }}>
                <span className="cb-i"><OcIcon name="x" size="sm" /></span><span className="cb-x"><b>ללא קטגוריה</b></span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ dc, ui }) {
  const m = dc.cur.model;
  const act = m.active;
  const markInactive = async () => {
    const r = await ui.openDialog(DcInactiveDialog, { active: m.active, reason: m.reason, exit: m.exit, entry: m.entry });
    if (r) dc.setActive(false, { reason: r.reason, exit: r.date });
  };
  const onActive = (k) => { if (k === 'on') { if (!act) dc.setActive(true); } else if (act) markInactive(); };
  return (
    <div className="card">
      <div className="card-h"><div className="ico gold"><OcIcon name="sliders" size="lg" /></div><h2>מצב הדגם</h2></div>
      <div className="dc-swrow">
        <b>סטטוס <Tip text={act ? 'הדגם זמין להשכרה ומופיע בבחירת דגמים בהזמנה חדשה. סימון "לא פעיל" מוציא אותו מהמאגר' : 'הדגם הוצא מהמאגר — לא ניתן לבחור אותו בהזמנה חדשה. סימון "פעיל" מחזיר אותו לפעילות'} /></b>
        <DcPill id="dcAct" data-guide-id="dc.status-pill" value={act ? 'on' : 'off'} options={[{ key: 'on', label: 'פעיל', icon: 'check' }, { key: 'off', label: 'לא פעיל', icon: 'ban' }]} onChange={onActive} label="סטטוס הדגם" />
      </div>
      {act ? null : (
        <div className="dc-why">
          <div className="status debt">
            <OcIcon name="ban" />
            <div className="t"><b>{`סיבה: ${m.reason || '—'}`}</b><small>{`יציאה: ${hFull(m.exit)}`}</small></div>
            <button type="button" className="btn sm" data-tip="עריכת סיבה ותאריך יציאה" onClick={markInactive}><OcIcon name="pencil" size="sm" />עריכה</button>
          </div>
        </div>
      )}
      <div className="dc-swrow">
        <b>הצג בבדיקה <Tip text="סימון עצמי בלבד — הדגם מסומן כ&quot;בבדיקה&quot; בהדפסת הכרטיס, כדי שיהיה ברור שהוא דורש תשומת לב מיוחדת. לא חוסם השכרה ולא מופיע ברשימת התראות המלאי" /></b>
        <DcPill id="dcInsp" data-guide-id="dc.inspect" value={m.inspect ? '1' : '0'} options={[{ key: '1', label: 'כן', icon: 'check' }, { key: '0', label: 'לא', icon: 'x' }]} onChange={(k) => dc.patchModel({ inspect: k === '1' })} label="הצג בבדיקה" />
      </div>
      {dc.flags.premiumEnabled ? (
        <div className="dc-swrow">
          <b>שמלת פרימיום <Tip text="פרימיום: המחיר נקבע לפי קטגוריית הפרימיום (כשהאפשרות פעילה בהגדרות)" /></b>
          <DcPill id="dcPrem" data-guide-id="dc.premium" value={m.premium ? '1' : '0'} options={[{ key: '1', label: 'כן', icon: 'check' }, { key: '0', label: 'לא', icon: 'x' }]} onChange={(k) => dc.patchModel({ premium: k === '1' })} label="שמלת פרימיום" />
        </div>
      ) : null}
    </div>
  );
}

function ImageCard({ dc, edit }) {
  const m = dc.cur.model;
  const fileRef = useRef(null);
  const [broken, setBroken] = useState(false);
  const fallback = !m.img && dc.flags.useFileNamesForImages && m.code ? `/images/dresses/${m.code}.jpg` : '';
  const src = m.img || fallback;
  // תמונה לפי קוד הדגם: בודקים אותה ברקע (Image) ומציגים אותה רק אחרי שנטענה - עד אז ואם חסרה: מצב "אין תמונה" (בלי הבהוב של מסגרת שבורה)
  const [probed, setProbed] = useState('');
  useEffect(() => { setBroken(false); }, [src]);
  useEffect(() => {
    if (m.img || !fallback) return undefined;
    let off = false;
    const im = new window.Image();
    im.onload = () => { if (!off) setProbed(fallback); };
    im.onerror = () => { if (!off) setProbed(''); };
    im.src = fallback;
    return () => { off = true; };
  }, [m.img, fallback]);
  const showImg = m.img ? !broken : (!!fallback && probed === fallback && !broken);
  const has = !!m.img;
  const focusUrl = () => { dc.setEditDet(true); setTimeout(() => { const i = document.getElementById('dcImg'); if (i) i.focus(); }, 60); };
  return (
    <div className="card">
      <div className="card-h"><div className="ico gold"><OcIcon name="dress" size="lg" /></div><h2>תמונת הדגם <Tip text={`כשאין תמונה מועלית, המערכת מחפשת אוטומטית קובץ בשם הקוד (${m.code}.jpg) לפי הגדרת שמות קבצים לתמונות`} /></h2></div>
      <div className={`dc-frame${showImg ? ' has' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- תמונת הדגם מכתובת חיצונית/מקומית שרירותית (כמו בדף הישן) */}
        {showImg ? <img alt="תמונת הדגם" src={src} onError={() => setBroken(true)} /> : <OcIcon name="dress" />}
        <b>{has ? 'תמונה מקושרת' : showImg ? 'תמונה לפי קוד הדגם' : 'אין תמונה'}</b>
        {has ? <small><bdi dir="ltr">{m.img}</bdi></small> : null}
      </div>
      <div className="dc-acts">
        <button type="button" className="btn sm" data-guide-id="dc.img-upload" data-tip="העלאת קובץ תמונה" disabled={dc.uploading} onClick={() => fileRef.current && fileRef.current.click()}><OcIcon name="plus" size="sm" />{dc.uploading ? 'מעלה...' : has ? 'החלפה' : 'העלאה'}</button>
        <button type="button" className="btn sm" data-guide-id="dc.img-url" data-tip="הזנת כתובת תמונה" onClick={focusUrl}><OcIcon name="clip" size="sm" />כתובת</button>
        {has ? <button type="button" className="btn sm" data-tip="הסרת התמונה" onClick={() => dc.patchModel({ img: '', thumb: '' })}><OcIcon name="trash" size="sm" />הסרה</button> : null}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) dc.uploadImage(f); e.target.value = ''; }} />
      </div>
      {edit ? (
        <div className="dfields" style={{ marginTop: 20 }}>
          <Fld id="dcImg" label="כתובת תמונה" icon="clip" value={m.img} onChange={(v) => dc.patchModel({ img: v, thumb: v ? m.thumb : '' })} dir="ltr" placeholder={`/images/dresses/${m.code}.jpg`} inputStyle={{ direction: 'ltr', textAlign: 'right' }} />
        </div>
      ) : null}
    </div>
  );
}

function NotesCard({ dc }) {
  return (
    <div className="card">
      <div className="card-h"><div className="ico plum"><OcIcon name="note" size="lg" /></div><h2>הערות לדגם <Tip text="הערות כלליות לגבי הדגם. מוצג לצוות בלבד" /></h2></div>
      <textarea className="inp" id="dcNotes" data-guide-id="dc.notes" placeholder="הערה…" value={dc.cur.model.notes} onChange={(e) => dc.patchModel({ notes: e.target.value })} />
    </div>
  );
}

export default function DcDetailsTab({ dc, ui }) {
  const m = dc.cur.model;
  const ed = dc.editDet;
  const editBtn = (
    <button type="button" className="ibtn" data-guide-id="dc.edit-details" data-act="editdet" aria-label={ed ? 'סיום עריכה' : 'עריכת פרטי דגם'} data-tip={ed ? 'סיום עריכה' : 'עריכת פרטי דגם'} aria-pressed={ed} onClick={() => dc.setEditDet(!ed)}>
      <OcIcon key={ed ? 'check' : 'pencil'} name={ed ? 'check' : 'pencil'} />
    </button>
  );
  const pickEntry = async () => {
    const d = await ui.openDialog(DcEntryDateDialog, { value: m.entry });
    if (d) dc.patchModel({ entry: d });
  };
  return (
    <>
      {ed ? (
        <div className="card dfields">
          <div className="card-h"><div className="ico rose"><OcIcon name="tag" size="lg" /></div><h2>זיהוי הדגם</h2>{editBtn}</div>
          <div className="grid2">
            <Fld id="dcCode" data-guide-id="dc.f-code" label="קוד דגם" icon="hash" value={m.code} lock dir="ltr" tip={CODE_TIP} />
            {dc.flags.useModelNames ? <Fld id="dcName" data-guide-id="dc.f-name" label="שם דגם" icon="tag" value={m.name} placeholder="שם הדגם..." onChange={(v) => dc.patchModel({ name: v })} error={dc.nameError} /> : null}
            <CatField dc={dc} />
            <div className="field" data-guide-id="dc.f-entry">
              <label className="lbl" htmlFor="dcEntry">תאריך כניסה למאגר</label>
              <div className="dc-dateline">
                <div className="inpw"><OcIcon name="cal" size="sm" /><input className="inp" id="dcEntry" readOnly value={hFull(m.entry)} aria-label="תאריך כניסה למאגר (לוח עברי)" /></div>
                <button type="button" className="btn sm" onClick={pickEntry}><OcIcon name="pencil" size="sm" />שינוי תאריך</button>
              </div>
            </div>
          </div>
          <div className="dc-acts" style={{ marginTop: 24 }}><PriceBtn /></div>
        </div>
      ) : (
        <div className="card cust">
          <div className="card-h"><div className="ico rose"><OcIcon name="tag" size="lg" /></div><h2>זיהוי הדגם</h2>{editBtn}</div>
          <div className="kv">
            <Vf icon="hash" label="קוד דגם" data-guide-id="dc.f-code" value={m.code} bdi tipx={CODE_TIP} />
            {dc.flags.useModelNames ? <Vf icon="tag" label="שם דגם" data-guide-id="dc.f-name" value={m.name} /> : null}
            <Vf icon="card" label="קטגוריית מחיר" data-guide-id="dc.f-cat" value={m.cat ? catLabel(m.cat) : ''} extra={<div style={{ marginTop: 10 }}><PriceBtn /></div>} />
            <Vf icon="cal" label="תאריך כניסה למאגר" data-guide-id="dc.f-entry" value={hFull(m.entry)} />
          </div>
        </div>
      )}
      <ActivityCard dc={dc} ui={ui} />
      {dc.flags.showImages ? <ImageCard dc={dc} edit={ed} /> : null}
      <NotesCard dc={dc} />
    </>
  );
}
