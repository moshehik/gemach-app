'use client';

// שלב 1 "מי הלקוח?" - R.customer בעיצוב (B2: NO_SEC_TITLES, NEW_CUST_FLAT, TIP_HINTS). שלוש לשוניות: לפי טלפון / מהרשימה / לקוח חדש.
// S01 + S02 (לא להכניס): אין בדיקות חוסרים בבחירה מהרשימה ואין כרטיס "לקוח שנבחר" עם 5 שדות - שורת הלקוח + "חסר ללקוח" כמו באתר.
// R03: הודעת "חובה למלא לפחות אחד מבין" בגוון הסלמון של ההתראה ובגודל רגיל (no-grp). R05: הודעת השרת מתחת לשדה.
// R06: "מאשר/ת קבלת דיוורים" - הנוסח של כרטיס הלקוח/ההזמנה; מוסתר כש-hide_marketing_consent_field = 'true' (הגמ"ח הראשי).
import { Blk, ClearX, Field, Ic, Note, OneCard, SegPill, SubH, Switch, Tip, NO_FILL } from './NoUi';
import NoSuggest, { emailSuggestions } from './NoSuggest';
import { getCustomerFullName, CUSTOMER_FIELD_LABELS, isFieldMandatoryFromPicker } from './newOrderLogic';
import { isFieldRequiredByGroup, unsatisfiedFieldGroupErrors, unsatisfiedFieldGroupShortLabels } from '@/lib/customerValidation';

const TABS = [
  { v: 'phone', label: 'לפי טלפון', icon: 'phone' },
  { v: 'name', label: 'מהרשימה', icon: 'users' },
  { v: 'new', label: 'לקוח חדש', icon: 'plus' },
];

function custSub(c) {
  return [c.phone1, c.phone2, c.email, [c.city, c.street, c.houseNum].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
}

function CustRow({ c, open, onClick }) {
  return (
    <article className={`hrow irow${open ? ' open' : ''}`}>
      <div className="li rlink lrow" role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick(); } }}>
        <div className="ic-b"><Ic n="user" /></div>
        <div className="t">
          <b>{getCustomerFullName(c)}{c.isBlocked ? <> <span className="chip red"><Ic n="lock" />לקוח חסום</span></> : null}</b>
          <span className="ln"><bdi>{custSub(c)}</bdi></span>
        </div>
        <span className="go" aria-hidden="true"><Ic n={open ? 'check' : 'chev'} c="sm" /></span>
      </div>
    </article>
  );
}

function MissLine({ c, ctl }) {
  const parts = [...ctl.missingOf(c).map(k => CUSTOMER_FIELD_LABELS[k]), ...unsatisfiedFieldGroupShortLabels(c, ctl.fieldGroups)];
  if (!parts.length) return null;
  return (
    <Note style={{ marginTop: 14 }}>
      חסר ללקוח: {parts.join(', ')}.
      <div style={{ marginTop: 6 }}><a href={`/customers/${c.id}`} target="_blank" rel="noreferrer" className="lnk">עריכת פרטי לקוח (נפתח בכרטיסייה נפרדת)<Ic n="ext" c="sm" /></a></div>
    </Note>
  );
}

// פרטי הוראת קבע (hok_enabled) - ללקוח קיים נשמרים על order.hok*, ללקוח חדש על newCustomer.hok*
function HokCard({ value, onChange }) {
  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="card-h"><div className="ico blue"><Ic n="bank" c="lg" /></div><h2>פרטי הוראת קבע (3)</h2></div>
      <div className="grid2">
        <Field label="בנק" icon="bank" htmlFor="noHokBank"><input className="inp" id="noHokBank" autoComplete="off" {...NO_FILL} value={value.bankName || ''} onChange={(e) => onChange('BankName', e.target.value)} /></Field>
        <Field label="סניף" icon="pin" htmlFor="noHokBranch"><input className="inp" id="noHokBranch" autoComplete="off" {...NO_FILL} value={value.bankBranch || ''} onChange={(e) => onChange('BankBranch', e.target.value)} /></Field>
        <Field label="חשבון" icon="card" htmlFor="noHokAcc"><input className="inp" id="noHokAcc" dir="ltr" autoComplete="off" {...NO_FILL} value={value.bankAccount || ''} onChange={(e) => onChange('BankAccount', e.target.value)} /></Field>
      </div>
      <div className="trow" style={{ marginTop: 14 }}><Switch checked={value.consent} onChange={(v) => onChange('Consent', v)} label="אישור גביה" /><span>מאשר/ת גביה אוטומטית בהו&quot;ק במקרה של איחור/נזק</span></div>
    </div>
  );
}
const orderHok = (ctl) => ({ bankName: ctl.order.hokBankName, bankBranch: ctl.order.hokBankBranch, bankAccount: ctl.order.hokBankAccount, consent: ctl.order.hokConsent });
const setOrderHok = (ctl) => (k, v) => ctl.setOrder(prev => ({ ...prev, [`hok${k}`]: v }));

function PhoneTab({ ctl }) {
  const res = ctl.foundCustomersFromPhone;
  const sel = ctl.pickedFound;
  const anyMissing = res.some(c => ctl.missingOf(c).length || unsatisfiedFieldGroupShortLabels(c, ctl.fieldGroups).length);
  const one = res.length === 1 ? res[0] : null;
  return (
    <>
      <Field label="מספר טלפון *" icon="phone" htmlFor="noPhoneQ">
        <input className="inp" id="noPhoneQ" type="tel" dir="ltr" inputMode="tel" placeholder="05..." autoComplete="off" {...NO_FILL} autoFocus
          value={ctl.phoneSearchInput} onChange={(e) => ctl.setPhoneSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ctl.handleCheckPhone(); } }} />
        <ClearX show={!!ctl.phoneSearchInput} onClear={() => { ctl.setPhoneSearchInput(''); ctl.setFoundCustomersFromPhone([]); }} />
      </Field>
      <div className="row wrap" style={{ marginTop: 24, gap: 16, alignItems: 'center' }}>
        <button type="button" className="btn navy" onClick={ctl.handleCheckPhone} disabled={ctl.isCheckingPhone}><Ic n="search" />{ctl.isCheckingPhone ? 'מחפש...' : 'בדיקה והמשך'}</button>
        <Tip t="מספר שלא קיים במערכת יפתח כרטיס לקוח חדש עם המספר שהוזן." />
      </div>
      <div id="phoneRes" style={{ marginTop: 16 }}>
        {res.length ? (
          <>
            {res.length > 1 ? <Note style={{ marginBottom: 10 }}>נמצאו {res.length} לקוחות עם מספר טלפון זה - יש לבחור את הלקוח הנכון.</Note> : null}
            <div className="hres"><div className="hgrp">{res.map(c => <CustRow key={c.id} c={c} open={!!sel && sel.id === c.id} onClick={() => ctl.setPickedFound(c)} />)}</div></div>
            {sel ? <MissLine c={sel} ctl={ctl} /> : null}
            {one && ctl.settings.hok_enabled === 'true' ? <HokCard value={orderHok(ctl)} onChange={setOrderHok(ctl)} /> : null}
            <div className="row wrap" style={{ marginTop: 14, gap: 10 }}>
              <button type="button" className="btn primary" disabled={!sel} onClick={() => sel && ctl.handleUseExistingCustomer(sel)}><Ic n="check" />כן, זה הלקוח</button>
              {anyMissing && (sel || one) ? <a className="btn" href={`/customers/${(sel || one).id}`} target="_blank" rel="noreferrer"><Ic n="pencil" c="sm" />עריכת פרטי לקוח</a> : null}
              <button type="button" className="btn ghost" onClick={() => { ctl.setNewCustomer(prev => ({ ...prev, phone1: ctl.phoneSearchInput.trim() })); ctl.setFoundCustomersFromPhone([]); ctl.setSearchMode('new'); }}><Ic n="plus" c="sm" />אף אחד מאלה - לקוח חדש</button>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

function ListTab({ ctl }) {
  const c = ctl.order.selectedCustomer;
  const list = ctl.listResults || [];
  return (
    <>
      <Field label="חיפוש לפי שם, טלפון או עיר" icon="search" htmlFor="noListQ">
        <input className="inp" id="noListQ" placeholder="חפש לקוח לפי שם, טלפון, עיר..." autoComplete="off" {...NO_FILL} readOnly={!!c}
          value={c ? `${getCustomerFullName(c)}${c.phone1 ? ` (${c.phone1})` : ''}` : ctl.listQuery} onChange={(e) => ctl.setListQuery(e.target.value)} />
        {c ? <ClearX show onClear={() => ctl.pickFromList(null)} label="נקה בחירה" tip="נקה בחירה" /> : null}
      </Field>
      {c ? (
        <div style={{ marginTop: 16 }}>
          <div className="lbl">נבחר</div>
          <div className="hres"><div className="hgrp"><CustRow c={c} open /></div></div>
          <MissLine c={c} ctl={ctl} />
          {ctl.settings.hok_enabled === 'true' ? <HokCard value={orderHok(ctl)} onChange={setOrderHok(ctl)} /> : null}
        </div>
      ) : (
        <div className="hres" style={{ marginTop: 14 }}>
          <div className="hres-bar"><span className="hres-n">לקוחות <b>{list.length}</b></span>{ctl.listLoading ? <span className="muted sm">טוען...</span> : null}</div>
          <div className="hgrp">
            {list.length ? list.map(x => <CustRow key={x.id} c={x} onClick={() => ctl.pickFromList(x)} />) : <div className="empty">{ctl.listLoading || ctl.listResults === null ? 'טוען...' : 'לא נמצאו לקוחות.'}</div>}
          </div>
        </div>
      )}
    </>
  );
}

function NewTab({ ctl }) {
  const s = ctl.settings;
  const n = ctl.newCustomer;
  const set = (k) => (v) => { ctl.setNewCustomerError(null); ctl.setNewCustomer(prev => ({ ...prev, [k]: v })); };
  const onEnter = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const box = e.target.closest('.blk');
    if (!box) return;
    const all = Array.from(box.querySelectorAll('input, select, textarea')).filter(el => !el.disabled && el.type !== 'checkbox' && el.offsetParent !== null);
    const next = all[all.indexOf(e.target) + 1];
    if (next) { next.focus(); if (typeof next.select === 'function') next.select(); } else ctl.handleSaveNewCustomerAndProceed();
  };
  const star = (on) => (on ? ' *' : '');
  const err = ctl.newCustomerError;
  const errFor = (f) => (err && err.field === f ? <div className="muted sm no-ferr"><Ic n="alert" c="sm" />{err.text}</div> : null);
  const groupErrors = unsatisfiedFieldGroupErrors(n, ctl.fieldGroups);
  const addrReq = (k) => s.require_full_address === 'true' || isFieldMandatoryFromPicker(s, k);
  const inp = (k, extra = {}) => ({ className: 'inp', autoComplete: 'off', ...NO_FILL, value: n[k] || '', onChange: (e) => set(k)(e.target.value), onKeyDown: onEnter, ...extra });
  return (
    <>
      {ctl.phoneSearchInput.trim() ? (
        <Note style={{ marginBottom: 14 }} icon="alert">
          לא נמצא לקוח עם הטלפון שהוזן. יתכן שהמספר במערכת שונה מעט - כדאי לנסות{' '}
          <button type="button" className="btn sm" onClick={() => ctl.setSearchMode('name')}><Ic n="search" c="sm" />חיפוש לפי שם</button>{' '}לפני יצירת כרטיס חדש.
        </Note>
      ) : null}
      <div className="grid2 col1">
        <Field label="שם פרטי *" icon="user" htmlFor="noNcFirst"><input id="noNcFirst" {...inp('firstName')} /></Field>
        <Field label="שם משפחה *" icon="user" htmlFor="noNcLast"><input id="noNcLast" {...inp('lastName')} /></Field>
        <Field label="טלפון *" icon="phone" htmlFor="noNcPhone" after={errFor('phone1')}><input id="noNcPhone" type="tel" dir="ltr" placeholder="נייד או קווי" {...inp('phone1')} /></Field>
        <Field label={`טלפון נוסף${star(isFieldRequiredByGroup('phone2', n, ctl.fieldGroups))}`} icon="phone" htmlFor="noNcPhone2" after={errFor('phone2')}><input id="noNcPhone2" type="tel" dir="ltr" placeholder="נייד או קווי" {...inp('phone2')} /></Field>
        <Field label={`אימייל${star(s.require_customer_email === 'true' || isFieldMandatoryFromPicker(s, 'email') || isFieldRequiredByGroup('email', n, ctl.fieldGroups))}`} icon="mail" htmlFor="noNcEmail"
          after={<>
            {n.email && !n.email.includes('@') ? <div style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={() => set('email')(`${n.email}@gmail.com`)}><Ic n="mail" c="sm" />השלם ל- @gmail.com</button></div> : null}
            {errFor('email')}
            {groupErrors.map(m => <div key={m} className="no-grp" role="note"><Ic n="alert" c="sm" />{m}</div>)}
          </>}>
          <NoSuggest id="noNcEmail" value={n.email} onChange={set('email')} options={emailSuggestions} prefix inputProps={{ type: 'email', dir: 'ltr', placeholder: 'לשליחת ההזמנה במייל', onKeyDown: onEnter }} />
        </Field>
      </div>
      <div className="ncmore">
        <div className="grid2 col1">
          <Field label={`עיר מגורים${star(addrReq('city'))}`} icon="pin" htmlFor="noNcCity"><NoSuggest id="noNcCity" value={n.city} onChange={set('city')} options={ctl.customerLocations.cities} inputProps={{ onKeyDown: onEnter }} /></Field>
          <Field label={`רחוב${star(addrReq('street'))}`} icon="pin" htmlFor="noNcStreet"><NoSuggest id="noNcStreet" value={n.street || ''} onChange={set('street')} options={ctl.customerLocations.streets} inputProps={{ onKeyDown: onEnter }} /></Field>
          <Field label={`מספר בית${star(addrReq('houseNum'))}`} icon="home" htmlFor="noNcHouse"><input id="noNcHouse" {...inp('houseNum')} /></Field>
          <Field
            label={<>תעודת זהות{s.require_customer_id_number === 'true' ? ' *' : (s.require_id_for_edit_cancel === 'true' ? <> <span className="muted sm">(לעריכה/ביטול עתידי)</span></> : null)}</>}
            icon="file" htmlFor="noNcId" after={errFor('zeout')}>
            <input id="noNcId" dir="ltr" inputMode="numeric" placeholder="ת״ז" {...inp('zeout')} />
          </Field>
        </div>
        {s.hide_marketing_consent_field !== 'true' ? (
          <div className="trow"><Switch checked={n.marketingConsent} onChange={set('marketingConsent')} label="אישור דיוור" /><span>מאשר/ת קבלת דיוורים{star(s.require_marketing_consent === 'true')}</span></div>
        ) : null}
      </div>
      {s.hok_enabled === 'true' ? <HokCard value={{ bankName: n.hokBankName, bankBranch: n.hokBankBranch, bankAccount: n.hokBankAccount, consent: n.hokConsent }} onChange={(k, v) => set(`hok${k}`)(v)} /> : null}
      {err && !err.field ? <Note style={{ marginTop: 14 }}>{err.text}</Note> : null}
      <div className="row" style={{ marginTop: 24 }}>
        <button type="button" className="btn primary" disabled={ctl.savingCustomer} aria-busy={ctl.savingCustomer} onClick={() => ctl.handleSaveNewCustomerAndProceed()}><Ic n="check" />{ctl.savingCustomer ? 'שומר...' : 'שמור לקוח והמשך'}</button>
      </div>
    </>
  );
}

export default function StepCustomer({ ctl }) {
  return (
    <OneCard>
      <Blk>
        <SubH icon="search" tone="rose" title="בחירת לקוח" />
        <SegPill id="custSeg" label="אופן בחירת הלקוח" options={TABS} value={ctl.searchMode}
          onChange={(v) => { ctl.setSearchMode(v); if (v === 'phone') ctl.setFoundCustomersFromPhone([]); }} />
        <div style={{ marginTop: 18 }}>
          {ctl.searchMode === 'phone' ? <PhoneTab ctl={ctl} /> : ctl.searchMode === 'name' ? <ListTab ctl={ctl} /> : <NewTab ctl={ctl} />}
        </div>
      </Blk>
    </OneCard>
  );
}
