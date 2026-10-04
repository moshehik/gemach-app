'use client';

// OcDeliveryTab — לשונית "משלוח" של כרטיס ההזמנה החדש (R21, R49 מיקום) + OcDeliveryCards: אותו תוכן בתוך לשונית "פרטים" כשאין
// לשונית משלוח נפרדת (delivery_separate_tab כבוי - כמו בישן, שם כרטיס המשלוח יושב בתוך "פרטים כלליים"). מוצג רק כש-enable_deliveries.
// markup = pDelivery() בעיצוב המאושר (כרטיס-הזמנה.html): .dhero עם מתג "הזמנה עם משלוח", כרטיס "כיוון" (גלולה הלוך / חזור / הלוך-חזור),
// כרטיס "יעד" (עיר משלוח עם הצעות - רשימה סגורה, כתובת שונה ממגורים), "יוצא יום לפני האירוע". הכרטיסים "כבויים" (.dfields.off) בלי משלוח.
//
// ===== מפת פורט (← components/orders/modern/ModernGeneralDetails.js "MGD") =====
// מתג isDelivery ← MGD:439-457 ; כיוון (select הלוך/חזור/הלוך-חזור, ברירת מחדל בתצוגה הלוך-חזור) ← MGD:462-469
// עיר משלוח (ערי delivery_price_by_city, אחרת /api/customers/locations; "בחר עיר…" = '') + חובה + הודעה ← MGD:470-481
// כתובת שונה (רק כש-delivery_allow_address_override או כשחובה) + חובה + הודעה ← MGD:482-492
// יוצא יום לפני (רק כש-delivery_one_day_before_option) ← MGD:494-510 ; כל שינוי = edit.setOrder(prev => ({...prev, ...updates})) ← MGD:51-53
// הגדרות ← MGD:199-216 (deliverySettingsOf) ; חישוב החובה ← lib/deliveryValidation (deliveryFieldState). השמירה עצמה - ה-PUT של הבקר.
// נקודות הרחבה ל-W2b (R49, לא ממומש כאן): SLOTS.DeliveryJoinPicker (בורר הצטרפות למשלוח, אחרי כרטיס "יעד"). ר' W2a-NOTES.
import { useEffect, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import { SLOTS } from '../slots';
import {
  DEFAULT_DIRECTION, DELIVERY_DIRECTIONS, deliveryCityOptions, deliveryFieldState, deliverySettingsOf, filterSuggestions, resolveCityInput
} from '../parts/ocDetailsLogic';

// ערי הלקוחות / רחובות (גיבוי לרשימת הערים, הצעות לכתובת) - פעם אחת לכל טעינת דף, כמו TTL.REFERENCE של הישן
let locationsPromise = null;
function loadLocations() {
  if (!locationsPromise) {
    locationsPromise = fetch(`/api/customers/locations`).then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(d => ({ cities: (d && d.cities) || [], streets: (d && d.streets) || [] }));
  }
  return locationsPromise;
}
export function useCustomerLocations(enabled) {
  const [loc, setLoc] = useState({ cities: [], streets: [] });
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    loadLocations().then(d => { if (alive) setLoc(d); });
    return () => { alive = false; };
  }, [enabled]);
  return loc;
}

export const Tip = ({ text }) => (
  <button type="button" className="tip" data-tip={text} aria-label="עזרה"><OcIcon name="info" size="sm" /></button>
);

const hl = (o, q) => {
  const i = q ? o.indexOf(q) : -1;
  return i < 0 ? o : <>{o.slice(0, i)}<mark>{q}</mark>{o.slice(i + q.length)}</>;
};

/**
 * שדה עם רשימת הצעות (שדה העיר/הכתובת של העיצוב: .inpw > .inp[data-sug] + .inpx + ul.advlist > li.advo).
 * closed=true: רשימה סגורה - נקלט רק ערך מהרשימה (או ריק); עזיבה עם טקסט אחר מחזירה את הערך התקף (R21). closed=false: טקסט חופשי.
 */
export function SuggestInput({ id, name, icon = 'pin', value, options, closed, onCommit, placeholder, describedBy, required, disabled }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  const inRef = useRef(null);
  const shown = closed ? (focused ? text : (value || '')) : (value || '');
  const q = shown.trim();
  const list = filterSuggestions(options, q);
  const listId = `${id}-list`;

  const commit = (v) => { if ((v || '') !== (value || '')) onCommit(v); };
  const pick = (v) => {
    setOpen(false); setAct(-1);
    if (closed) { setText(v); commit(v); } else commit(v);
  };
  const onChange = (e) => {
    const v = e.target.value;
    setOpen(true); setAct(-1);
    if (closed) setText(v); else commit(v);
  };
  const onBlur = () => {
    setOpen(false); setAct(-1);
    if (closed) {
      const r = resolveCityInput(text, options);
      if (r !== null) commit(r);
      setFocused(false);
    }
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (!list.length) return;
      const n = list.length;
      setAct(a => (a + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
    } else if (e.key === 'Enter') {
      if (open && act >= 0 && list[act] !== undefined) { e.preventDefault(); pick(list[act]); }
      else if (closed) { e.preventDefault(); const r = resolveCityInput(text, options); if (r) pick(r); }
    } else if (e.key === 'Escape') {
      if (open) { e.stopPropagation(); setOpen(false); setAct(-1); }
    }
  };
  const clear = () => {
    if (closed) setText(''); else commit('');
    setOpen(true); setAct(-1);
    if (inRef.current) inRef.current.focus();
  };

  return (
    <div className="inpw">
      <OcIcon name={icon} size="sm" />
      <input
        ref={inRef} className="inp" id={id} name={name} value={shown} placeholder={placeholder} disabled={disabled}
        autoComplete="off" data-lpignore="true" data-1p-ignore data-form-type="other"
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open && act >= 0 ? `${listId}-${act}` : undefined} aria-describedby={describedBy} aria-required={required || undefined}
        onFocus={() => { if (closed) { setText(value || ''); setFocused(true); } setOpen(true); }}
        onClick={() => setOpen(true)} onChange={onChange} onBlur={onBlur} onKeyDown={onKeyDown}
      />
      <button type="button" className="inpx" aria-label="ניקוי" hidden={!shown} onMouseDown={(e) => e.preventDefault()} onClick={clear}><OcIcon name="x" size="sm" /></button>
      {open && !disabled ? (
        <ul className="advlist" id={listId} role="listbox" aria-label="הצעות">
          {list.length ? list.map((o, i) => (
            <li key={o} role="option" id={`${listId}-${i}`} aria-selected={i === act} className={`advo${i === act ? ' act' : ''}`} data-v={o}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
              <span className="advo-t">{hl(o, q)}</span>
            </li>
          )) : <li className="advo none" role="presentation">אין התאמות</li>}
        </ul>
      ) : null}
    </div>
  );
}

/** תוכן המשלוח (גם בלשונית "משלוח" וגם בתוך "פרטים"). מחזיר null כש-enable_deliveries כבוי. */
export function OcDeliveryCards({ oc, ui }) {
  const order = oc.order || {};
  const ds = deliverySettingsOf(oc.settings);
  const loc = useCustomerLocations(ds.enabled);
  if (!ds.enabled) return null;
  const on = !!order.isDelivery;
  const customer = order.customer;
  const set = (updates) => oc.edit.setOrder(prev => (prev ? { ...prev, ...updates } : prev));
  const fs = deliveryFieldState(order, customer, ds);
  const cityOptions = deliveryCityOptions(ds.priceByCity, loc.cities, order.deliveryCity);
  const dir = order.deliveryDirection || DEFAULT_DIRECTION;
  const di = Math.max(0, DELIVERY_DIRECTIONS.findIndex(([v]) => v === dir));
  const JoinPicker = SLOTS.DeliveryJoinPicker; // W2b (R49) - נקודת הרחבה; לא קיים עד שהזרם שלו ירשום אותו ב-slots.js

  return (
    <div className="oc-del" data-oc-del={on ? 'on' : 'off'}>
      <div className={`dhero${on ? '' : ' off'}`}>
        <div className="ico"><OcIcon name="truck" size="lg" /></div>
        <div className="oc-del-hero">
          <div className="trow">
            <label className="sw">
              <input type="checkbox" id="delOn" checked={on} aria-label="הזמנה עם משלוח" onChange={(e) => set({ isDelivery: e.target.checked })} />
              <i />
            </label>
            <b className="big">הזמנה עם משלוח</b>
            <Tip text="משלוח אחד בלבד להזמנה" />
          </div>
        </div>
      </div>

      <div className={`card dfields${on ? '' : ' off'}`} inert={on ? undefined : true}>
        <div className="card-h"><div className="ico teal"><OcIcon name="arrlr" size="lg" /></div><h2>כיוון</h2></div>
        <div className="seg pill" id="dirSeg" role="radiogroup" aria-label="כיוון המשלוח" style={{ '--n': 3, '--i': di }}>
          <span className="pth" aria-hidden="true" />
          {DELIVERY_DIRECTIONS.map(([v, icon]) => (
            <button key={v} type="button" role="radio" aria-checked={dir === v} className={dir === v ? 'on' : ''} data-dir={v}
              onClick={() => { if (order.deliveryDirection !== v) set({ deliveryDirection: v }); }}>
              <OcIcon name={icon} size="sm" />{v}
            </button>
          ))}
        </div>
      </div>

      <div className={`card dfields${on ? '' : ' off'}`} inert={on ? undefined : true}>
        <div className="card-h"><div className="ico teal"><OcIcon name="pin" size="lg" /></div><h2>יעד</h2></div>
        <div className="grid2">
          <div className="field">
            <label className="lbl" htmlFor="delCityIn">עיר משלוח{fs.cityRequired ? <span className="oc-req" aria-hidden="true"> *</span> : null}</label>
            <SuggestInput id="delCityIn" name="delcity-nofill" icon="pin" value={order.deliveryCity || ''} options={cityOptions} closed
              placeholder="עיר..." required={fs.cityRequired} describedBy={fs.cityMsg ? 'oc-del-city-msg' : undefined}
              onCommit={(v) => set({ deliveryCity: v })} />
            {fs.cityMsg ? <p className="oc-fmsg" id="oc-del-city-msg" role="alert"><OcIcon name="alert" size="sm" />{fs.cityMsg}</p> : null}
          </div>
          {fs.showAddress ? (
            <div className="field">
              <label className="lbl" htmlFor="delAddr">כתובת שונה ממגורים{fs.addressRequired ? <span className="oc-req" aria-hidden="true"> *</span> : null} <Tip text="רק אם שונה מכתובת הלקוח" /></label>
              <SuggestInput id="delAddr" name="deladdr-nofill" icon="pin" value={order.deliveryAddress || ''} options={loc.streets}
                placeholder="רחוב ומספר..." required={fs.addressRequired} describedBy={fs.addressMsg ? 'oc-del-addr-msg' : undefined}
                onCommit={(v) => set({ deliveryAddress: v })} />
              {fs.addressMsg ? <p className="oc-fmsg" id="oc-del-addr-msg" role="alert"><OcIcon name="alert" size="sm" />{fs.addressMsg}</p> : null}
            </div>
          ) : null}
        </div>
        {ds.oneDayBeforeOption ? (
          <div className="row wrap oc-del-one">
            <button type="button" className={`btn tgl${order.deliveryOneDayBefore ? ' on' : ''}`} id="delOneBtn" aria-pressed={!!order.deliveryOneDayBefore}
              onClick={() => set({ deliveryOneDayBefore: !order.deliveryOneDayBefore })}>
              {order.deliveryOneDayBefore ? <OcIcon name="check" size="sm" className="evck" /> : null}<OcIcon name="truck" size="sm" />יוצא יום לפני האירוע
            </button>
            <Tip text="ברירת מחדל: יומיים לפני" />
          </div>
        ) : null}
      </div>
      {JoinPicker ? <JoinPicker oc={oc} ui={ui} /> : null}
    </div>
  );
}

export default function OcDeliveryTab({ oc, ui }) {
  return <OcDeliveryCards oc={oc} ui={ui} />;
}
