'use client';

// DcRail - הרייל "סיכום" + "שינויים בכרטיס" של כרטיס הדגם (renderRail ב-model-card.js; מבנה OcRail של כרטיס ההזמנה): צ'יפים (פעיל/לא פעיל,
// פריטים, זמינים, בתיקון, לא בשימוש, ברזרבה - הצ'יפים מעבירים ללשונית הפריטים עם הסינון), רשימת שינויים עם ביטול לכל שורה ו"החזר ביטול",
// והלחצנים שמור / בטל שינויים. בנייד (מתחת ל-1024px) הרייל הוא גיליון תחתון שנפתח מהלחצן "שינויים בכרטיס".
import { useEffect, useRef, useState } from 'react';
import OcIcon from '../order-card/OcIcon';
import { Segs } from './DcParts';
import { DcInactiveDialog } from './dialogs/DcDateDialogs';

const UNDO_LEAVE_MS = 220;

export default function DcRail({ dc, ui }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(null);
  const [sheet, setSheet] = useState(false);
  const leavingRef = useRef(false);
  const undoFocusRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width:1023px)');
    const sync = () => setSheet(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const aside = rootRef.current && rootRef.current.closest('#rail');
    if (aside) aside.classList.toggle('open', open);
  }, [open]);
  useEffect(() => {
    if (!open || !sheet) return undefined;
    const close = () => { setOpen(false); const t = rootRef.current && rootRef.current.querySelector('.cart-t'); if (t) t.focus(); };
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('#scrim.on, #scrim2.on')) close(); };
    const onDown = (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#rail, #scrim, #scrim2, #toast, .oc-portal')) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open, sheet]);

  const { cur, changes, dirty, counts: cn, saving } = dc;
  const count = changes.length;
  const m = cur.model;

  const prevCount = useRef(null);
  useEffect(() => {
    const el = rootRef.current && rootRef.current.querySelector('.cart-t');
    if (el) { el.classList.remove('bump'); if (prevCount.current !== null && count > prevCount.current) { void el.offsetWidth; el.classList.add('bump'); } }
    prevCount.current = count;
  }, [count]);

  const undo = (key) => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(key);
    setTimeout(() => { leavingRef.current = false; setLeaving(null); undoFocusRef.current = true; dc.undoChange(key); }, UNDO_LEAVE_MS);
  };
  useEffect(() => {
    if (!undoFocusRef.current) return;
    undoFocusRef.current = false;
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.isConnected !== false && !(rootRef.current && rootRef.current.contains(ae) && ae.closest('.cl.leaving'))) return;
    const root = rootRef.current;
    const next = root && root.querySelector('.cart-list .cl-u:not([disabled])');
    const target = next || (root && root.querySelector('.cart-t'));
    if (target) target.focus();
  }, [changes, count]);

  const toggleActive = async () => {
    if (!m.active) { dc.setActive(true); return; }
    const r = await ui.openDialog(DcInactiveDialog, { active: true, reason: m.reason, exit: m.exit, entry: m.entry });
    if (r) dc.setActive(false, { reason: r.reason, exit: r.date });
  };
  const chip = (cls, icn, txt, onClick, label, gid) => (
    <button type="button" className={`gl ${cls}`} aria-label={label} data-guide-id={gid} onClick={onClick}><OcIcon name={icn} /><span className="gv">{txt}</span></button>
  );

  return (
    <div className="rcard cart" ref={rootRef}>
      <div className="sec-h"><OcIcon name="list" size="sm" /><span>סיכום</span></div>
      <div className="glance" data-guide-id="dc.rail-glance">
        {chip(`sig ${m.active ? 'yes' : 'no'}`, m.active ? 'check' : 'ban', m.active ? 'פעיל' : 'לא פעיל', toggleActive, m.active ? 'הדגם פעיל — לחיצה לסימון כלא פעיל' : 'הדגם לא פעיל — לחיצה להחזרה לפעילות', 'dc.rail-status')}
        {chip('items-c', 'box', `${cn.n} פריטים`, () => dc.goFilter('all'), 'כל הפריטים')}
        {chip('avail', 'check', `${cn.avail} זמינים`, () => dc.goFilter('avail'), 'פריטים זמינים')}
        {chip('rep', 'scissors', `${cn.repair} בתיקון`, () => dc.goFilter('repair'), 'פריטים בתיקון')}
        {chip('unu', 'ban', `${cn.unused} לא בשימוש`, () => dc.goFilter('unused'), 'פריטים שאינם בשימוש')}
        {chip('res', 'flag', `${cn.reserve} ברזרבה`, () => dc.goFilter('reserve'), 'פריטים ברזרבה')}
      </div>
      <div className="cart-h">
        <button type="button" className="cart-t" data-guide-id="dc.rail-changes" data-act="cart-toggle" data-oc-focus-fallback="1" aria-expanded={sheet ? open : true} onClick={() => setOpen((v) => !v)}>
          <OcIcon name="cart" size="sm" /><b>שינויים בכרטיס</b><span className="badge">{count}</span><span className="cart-sum" /><OcIcon name="chev" size="sm" />
        </button>
        {dc.redoCount ? (
          <button type="button" className="redo fresh" data-act="redo" data-tip="החזר ביטול" aria-label="החזר ביטול" disabled={saving} onClick={dc.redo}>
            <OcIcon name="redo" size="sm" anim />{dc.redoCount > 1 ? <i>{dc.redoCount}</i> : null}
          </button>
        ) : null}
      </div>
      <div className="cart-body">
        <div className="cart-list">
          {count ? changes.map((c) => (
            <div className={`cl enter${leaving === c.k ? ' leaving' : ''}`} key={c.k} data-key={c.k} tabIndex={0}>
              <div className="cl-i"><OcIcon name={c.icon} /></div>
              <div className="cl-t"><span><Segs parts={c.text} /></span>{c.note ? <small>{c.note}</small> : null}</div>
              <button type="button" className="cl-u" data-act="undo" data-k={c.k} data-tip="ביטול השינוי" aria-label="ביטול השינוי" disabled={saving} onClick={() => undo(c.k)}><OcIcon name="bk" size="sm" /></button>
            </div>
          )) : <div className="cart-empty"><OcIcon name="check" size="lg" /><span>אין שינויים</span></div>}
        </div>
      </div>
      {dirty ? (
        <div className="cart-actions enter">
          <button type="button" className="btn primary lg block" data-guide-id="dc.rail-save" data-act="save" disabled={saving} onClick={() => dc.save()}><OcIcon name="check" />שמור</button>
          <button type="button" className="btn ghost block sec" data-guide-id="dc.rail-discard" data-act="discard" disabled={saving} onClick={() => dc.discardAll()}><OcIcon name="undo" size="sm" />בטל שינויים</button>
        </div>
      ) : null}
    </div>
  );
}
