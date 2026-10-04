'use client';

// OcDetailsTab — לשונית "פרטים" של כרטיס ההזמנה החדש (W2a): כרטיס לקוח (R19 החלפה, R20 פתיחת כרטיס, A7 "חסר" + ת״ז, חתימה על תקנון),
// כרטיס אירוע (A9 לוח עברי פנימי, R16 טווח לקיחה/החזרה לחו"ל ואמצע שבוע), הערות + הערות פנימיות (R15), "פרטים מתקדמים" (R18 ציפוף,
// A26 יום השכרה נוסף), ומשלוח כשאין לשונית משלוח נפרדת (R21). markup = pDetails() בעיצוב המאושר (כרטיס-הזמנה.html) + התוספות
// המאושרות של שכבת הסקירה (r15 / r16 / r18) בשמות נקיים. כל עריכה עוברת דרך oc.edit (A17 רשימת השינויים, טיוטות, PUT של הבקר).
//
// ===== מפת פורט (← components/orders/modern/ModernGeneralDetails.js "MGD") =====
// handleChange (עדכון פונקציונלי, לא דורס שינויים בזמן המתנה ל-PIN) ← MGD:51-53 → oc.edit.setOrder(prev => ({...prev, ...updates}))
// changeDates / תאריך אירוע / סוג אירוע / טווח / יום נוסף ← MGD:55-83, :326-399 (ocDetailsLogic: withDateUpdates, eventTypeUpdates,
//   rangeUpdates, extraDayUpdates) ; isEditingEvent (פתוח כשאין תאריך) ← MGD:22
// applyCustomSpacing (verifyPin 'feature:special_spacing_approval' בכל הקטנה בפועל) ← MGD:85-98 → oc.approve(...) ; hide_custom_spacing ← MGD:185-203
// הערות / הערות פנימיות ← MGD:401-421 ; חתימה ← MGD:128-130 → oc.toggleSignature() ; קישור לכרטיס לקוח ← MGD:289-293 ; החלפת לקוח ← MGD:132-159, :571-646
// הוסר בכוונה (החלטות הבעלים): עריכת תאריך ביצוע (R17) ; כפתור "תשלום / זיכוי ידני" (R22 → לשונית תשלומים, W4) ; מייל מהיר (A8 → W7, slot).
// נקודות הרחבה: SLOTS.QuickMailButton (W7, A8 - בשורת המייל בכרטיס הלקוח). ר' W2a-NOTES.
import { useState } from 'react';
import OcIcon from '../OcIcon';
import { SLOTS } from '../slots';
import OcHebrewCalendar from '../parts/OcHebrewCalendar';
import OcCustomerSwapDialog from '../parts/OcCustomerSwap';
import { OcDeliveryCards, Tip } from './OcDeliveryTab';
import {
  EXTRA_DAY_OPTIONS, customerAddress, customerName, customerUpdates, dateKeyOf, dayTitle, eventTypeUpdates, extraDayReady, extraDayUpdates, extraDayVisible,
  hasCustomSpacing, hebDateLabel, isRangeEvent, rangeUpdates, spacingAxis, spacingDecision, spacingDefaultOf, withDateUpdates, zeoutDisplay, zeoutRequired
} from '../parts/ocDetailsLogic';

const Miss = () => <span className="missv"><OcIcon name="alert" size="sm" />חסר</span>;

function KvRow({ icon, label, value, missing, children, dirLtr }) {
  const has = value !== null && value !== undefined && String(value).trim() !== '';
  return (
    <div className={`f${!has && missing ? ' miss' : ''}`}>
      <OcIcon name={icon} />
      <div className={children ? 'oc-kv-min' : undefined}>
        <small>{label}</small>
        {has ? <b>{dirLtr ? <bdi dir="ltr">{value}</bdi> : <bdi>{value}</bdi>}</b> : (missing ? <Miss /> : <b className="faint">—</b>)}
        {children}
      </div>
    </div>
  );
}

function CustomerCard({ oc, ui }) {
  const order = oc.order || {};
  const c = order.customer;
  const s = oc.settings;
  const QuickMail = SLOTS.QuickMailButton; // W7 (A8, order_quick_mail_enabled) - נקודת הרחבה
  const swap = async () => {
    const picked = await ui.openDialog(OcCustomerSwapDialog, { settings: s }, { labelledBy: 'oc-cs-t', className: 'oc-cs' });
    if (picked && picked.id) oc.edit.setOrder(prev => (prev ? { ...prev, ...customerUpdates(picked) } : prev));
  };
  const phone = c ? (c.phone1 || c.phone2 || '') : '';
  const phone2 = c && c.phone1 && c.phone2 ? c.phone2 : '';
  const addr = customerAddress(c);
  const signed = !!order.hasSignedRegulations;
  return (
    <div className="card cust">
      <div className="card-h">
        <div className="ico rose"><OcIcon name="user" size="lg" /></div>
        <h2>לקוח</h2>
        <button type="button" className="ibtn" data-act="swap-customer" aria-label="החלפת לקוח" data-tip="החלפת לקוח" onClick={swap}><OcIcon name="swap" /></button>
        {c && c.id ? (
          <button type="button" className="ibtn" data-act="open-customer" aria-label="פתיחת כרטיס לקוח" data-tip="פתיחת כרטיס לקוח" onClick={() => window.open(`/customers/${c.id}`, '_blank', 'noopener')}><OcIcon name="ext" /></button>
        ) : null}
      </div>
      <div className="row wrap oc-cust-name"><span className="big">{c ? (customerName(c) || '—') : 'לא נבחר לקוח'}</span></div>
      {c ? (
        <div className="kv">
          <KvRow icon="phone" label="טלפון" value={phone} missing dirLtr />
          <KvRow icon="mail" label="מייל" value={c.email} missing dirLtr>
            {QuickMail ? <div className="oc-qm"><QuickMail oc={oc} ui={ui} /></div> : null}
          </KvRow>
          <KvRow icon="pin" label="כתובת" value={addr} missing />
          <KvRow icon="file" label="ת״ז" value={zeoutDisplay(c.zeout, s)} missing={zeoutRequired(s)} dirLtr />
          {phone2 ? <KvRow icon="phone" label="טלפון נוסף" value={phone2} dirLtr /> : null}
          <div className="f">
            <OcIcon name="note" />
            <div>
              <small>חתימה על התקנון</small>
              <button type="button" className={`btn tgl${signed ? ' on' : ''}`} id="termsBtn" aria-pressed={signed} onClick={() => oc.toggleSignature()}>
                {signed ? <OcIcon name="check" size="sm" className="evck" /> : null}<OcIcon name="sig" size="sm" />חתם על התקנון
              </button>
            </div>
          </div>
        </div>
      ) : <div className="faint oc-cust-none">לחצו על סמל ההחלפה כדי לבחור לקוח</div>}
    </div>
  );
}

function EventCard({ oc }) {
  const order = oc.order || {};
  const [editing, setEditing] = useState(() => !order.eventDate && !order.fromDate); // MGD:22
  const range = isRangeEvent(order);
  const set = (fn) => oc.edit.setOrder(prev => { if (!prev) return prev; const u = fn(prev); return u ? { ...prev, ...u } : prev; });
  const evKey = dateKeyOf(order.eventDate);
  const fromKey = dateKeyOf(order.fromDate);
  const toKey = dateKeyOf(order.toDate || order.returnDate);
  const title = range
    ? (fromKey ? `${hebDateLabel(fromKey)} – ${toKey ? hebDateLabel(toKey) : '?'}` : 'טרם נבחרו תאריכים')
    : (evKey ? dayTitle(evKey) : 'טרם נבחר תאריך');
  return (
    <div className="card oc-evt">
      <div className="card-h">
        <div className="ico gold"><OcIcon name="cal" size="lg" /></div>
        <h2 id="oc-evt-t">אירוע</h2>
        <button type="button" className="ibtn" data-act="editdate" aria-pressed={editing} aria-label={editing ? 'סיום עריכה' : 'עריכת תאריך'} data-tip={editing ? 'סיום עריכה' : 'עריכת תאריך'} onClick={() => setEditing(e => !e)}>
          <OcIcon name={editing ? 'check' : 'pencil'} />
        </button>
      </div>
      <div className="big">{title}</div>
      {editing ? (
        range
          ? <OcHebrewCalendar key="range" mode="range" from={fromKey} to={toKey} labelledBy="oc-evt-t" onRange={(a, b) => set(prev => rangeUpdates(prev, a, b))} />
          : <OcHebrewCalendar key="single" mode="single" value={evKey} labelledBy="oc-evt-t" onPick={(k) => { if (k !== evKey) set(() => withDateUpdates({ eventDate: k })); }} />
      ) : null}
      {range ? (
        <div className="oc-range">
          <label className="lbl"><OcIcon name="cal" size="sm" />טווח תאריכים (לקיחה והחזרה) <Tip text="לאירוע חו״ל: טווח חופשי" /></label>
          <div className="grid2">
            <div className="field"><div className="inpw"><OcIcon name="bag" size="sm" /><input className="inp" readOnly value={fromKey ? hebDateLabel(fromKey) : ''} placeholder="לקיחה" aria-label="תאריך לקיחה" tabIndex={-1} /></div></div>
            <div className="field"><div className="inpw"><OcIcon name="undo" size="sm" /><input className="inp" readOnly value={toKey ? hebDateLabel(toKey) : ''} placeholder="החזרה" aria-label="תאריך החזרה" tabIndex={-1} /></div></div>
          </div>
        </div>
      ) : null}
      <div className="row wrap oc-evt-row">
        <button type="button" className={`btn${range ? ' on' : ''}`} id="evType" aria-pressed={range} disabled={!editing}
          onClick={() => set(prev => eventTypeUpdates(prev, !isRangeEvent(prev)))}>
          {range ? <OcIcon name="check" size="sm" className="evck" /> : null}<OcIcon name="flag" size="sm" />חו״ל
        </button>
        <Tip text="טווח תאריכים חופשי" />
      </div>
    </div>
  );
}

function NotesCard({ oc }) {
  const order = oc.order || {};
  const set = (updates) => oc.edit.setOrder(prev => (prev ? { ...prev, ...updates } : prev));
  return (
    <div className="card oc-notes">
      <div className="card-h"><div className="ico plum"><OcIcon name="note" size="lg" /></div><h2>הערות להזמנה <Tip text="מוצג ברשימה ומודפס פעם אחת" /></h2></div>
      <label className="lbl" htmlFor="notes"><OcIcon name="note" size="sm" />הערות להזמנה (מוצג ללקוח ומודפס)</label>
      <textarea className="inp" id="notes" placeholder="כתבו כאן הערה…" value={order.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
      <div className="oc-inotes">
        <label className="lbl" htmlFor="ocInternalNotes"><OcIcon name="note" size="sm" />הערות פנימיות (לא מוצג ללקוח)</label>
        <textarea className="inp" id="ocInternalNotes" placeholder="כתבו כאן הערה לצוות בלבד…" value={order.internalNotes || ''} onChange={(e) => set({ internalNotes: e.target.value })} />
      </div>
    </div>
  );
}

function Pill({ id, label, options, value, onPick, isDisabled }) {
  const i = Math.max(0, options.findIndex(([v]) => v === value));
  return (
    <div className="seg pill" id={id} role="radiogroup" aria-label={label} style={{ '--n': options.length, '--i': i }}>
      <span className="pth" aria-hidden="true" />
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} disabled={isDisabled ? isDisabled(v) : undefined} onClick={() => { if (v !== value) onPick(v); }}>{l}</button>
      ))}
    </div>
  );
}

function AdvancedCard({ oc }) {
  const order = oc.order || {};
  const s = oc.settings;
  const hide = !!s.hideCustomSpacing;
  const showXday = extraDayVisible(s, order);
  const def = spacingDefaultOf(s);
  const custom = hasCustomSpacing(order, hide);
  const [open, setOpen] = useState(() => custom || !!order.extraDay);
  if (hide && !showXday) return null;
  const selected = custom ? order.customSpacing : null;
  const spacingOptions = [[null, 'רגיל'], ...spacingAxis(def, selected).map(d => [d, String(d)])];
  const applySpacing = async (v) => {
    const { needsApproval, valueToStore } = spacingDecision(oc.order || {}, v, def);
    if (needsApproval) {
      const ok = await oc.approve('feature:special_spacing_approval', 'הקטנת ציפוף הימים להזמנה זו');
      if (!ok) return;
    }
    oc.edit.setOrder(prev => (prev ? { ...prev, ...withDateUpdates({ customSpacing: valueToStore }) } : prev));
  };
  const setXday = (v) => oc.edit.setOrder(prev => { if (!prev) return prev; const u = extraDayUpdates(prev, v); return u ? { ...prev, ...u } : prev; });
  return (
    <details className="coll" id="adv" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary><OcIcon name="sliders" />פרטים מתקדמים<span className="chip gray oc-adv-chip">מנהל</span><OcIcon name="chev" className="chev" /></summary>
      <div className="in">
        {!hide ? (
          <div>
            <label className="lbl"><OcIcon name="cal" size="sm" />ציפוף ימים מיוחד <Tip text="להזמנה זו בלבד · דורש מנהל" /></label>
            <div className="faint oc-r18">רגיל לפי המערכת: {def} ימים · הקטנה דורשת אישור מנהל</div>
            <Pill id="spacing" label="ציפוף ימים מיוחד" options={spacingOptions} value={selected} onPick={applySpacing} />
          </div>
        ) : null}
        {showXday ? (
          <div>
            <label className="lbl"><OcIcon name="plus" size="sm" />יום השכרה נוסף <Tip text="תוספת 50% מסך ההזמנה" /></label>
            <Pill id="xday" label="יום השכרה נוסף" options={EXTRA_DAY_OPTIONS} value={order.extraDay || null} onPick={setXday} isDisabled={(v) => !!v && !extraDayReady(order)} />
          </div>
        ) : null}
      </div>
    </details>
  );
}

export default function OcDetailsTab({ oc, ui }) {
  if (!oc.order) return null;
  const s = oc.settings;
  return (
    <>
      <CustomerCard oc={oc} ui={ui} />
      <EventCard oc={oc} />
      <NotesCard oc={oc} />
      <AdvancedCard oc={oc} />
      {s.enableDeliveries && !s.deliverySeparateTab ? <OcDeliveryCards oc={oc} ui={ui} /> : null}
    </>
  );
}
