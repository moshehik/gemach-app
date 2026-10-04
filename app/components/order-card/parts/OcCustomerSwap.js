'use client';

// OcCustomerSwap — חלון "החלפת לקוח" (R19) בכרטיס ההזמנה החדש: לקוח קיים (חיפוש) / לקוח חדש (טופס יצירה, POST /api/customers).
// markup = WIN.newcust בשכבת הסקירה של העיצוב המאושר (כרטיס-הזמנה.html): גלולת "לקוח קיים | לקוח חדש", שדה חיפוש + רשימת .chg,
// טופס grid2 עם "השלם ל- @gmail.com", "שמור ובחר" / "ביטול". נפתח ב-ui.openDialog(OcCustomerSwapDialog) → close(customer|null).
//
// ===== מפת פורט (← components/orders/modern/ModernGeneralDetails.js "MGD", components/CustomerSelector.js "CS") =====
// מצב customerMode / newCustomer ← MGD:24-25 ; חיפוש: GET /api/customers?search=…&limit=50 (debounce 300ms; רשימה מלאה בפתיחה) ← CS:54-97
// value={null} (לא מסננים לפי הלקוח הנוכחי) ← MGD:594-599 ; selectCustomer ← MGD:132-136 (ה-updates עצמם: customerUpdates)
// handleSaveNewCustomer ← MGD:138-159 (alert → הודעה בחלון; הודעת השרת מוצגת כשיש) ; "השלם ל- @gmail.com" ← MGD:612-620
// שינוי מכוון: ת״ז בטופס כש-require_customer_id_number (השרת דוחה בלעדיה - בישן "שגיאה בשמירת לקוח" בלי הסבר). ר' W2a-NOTES.
import { useEffect, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgButtons, DlgBtn, DlgHead, Field, Inp } from '../OcUi';
import { NEW_CUSTOMER_EMPTY, customerName, gmailComplete, gmailCompletable, newCustomerBody, newCustomerError } from './ocDetailsLogic';

function CustomerSearch({ picked, onPick, onConfirm }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    fetch(`/api/customers?search=${encodeURIComponent(debounced)}&limit=50`, { signal: ctl.signal })
      .then(r => r.json())
      .then(d => { if (!ctl.signal.aborted) { setList(Array.isArray(d && d.data) ? d.data : []); setLoading(false); } })
      .catch(e => { if (e && e.name === 'AbortError') return; console.error('Failed to fetch customers', e); setList([]); setLoading(false); });
    return () => ctl.abort();
  }, [debounced]);

  const rows = list || [];
  return (
    <div className="oc-cs-pane">
      <Field label="חיפוש לקוח" htmlFor="oc-cs-q">
        <div className="inpw">
          <OcIcon name="search" size="sm" />
          <Inp id="oc-cs-q" placeholder="שם, טלפון או מייל…" value={q} data-autofocus="true" onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && picked) { e.preventDefault(); onConfirm(); } }} />
        </div>
      </Field>
      <div className="chg oc-cs-list" role="listbox" aria-label="לקוחות" aria-busy={loading}>
        {!list ? <div className="c oc-cs-empty"><div className="t faint">טוען…</div></div> : null}
        {list && !rows.length ? <div className="c oc-cs-empty"><div className="t faint">לא נמצאו לקוחות</div></div> : null}
        {rows.map(c => {
          const sel = !!picked && picked.id === c.id;
          return (
            <div key={c.id} className={`c oc-cs-row${sel ? ' oc-sel' : ''}`} role="option" tabIndex={0} aria-selected={sel}
              onClick={() => onPick(c)} onDoubleClick={() => { onPick(c); onConfirm(c); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(c); if (e.key === 'Enter') onConfirm(c); } }}>
              <div className="t">{customerName(c) || '—'}<div className="faint oc-sub"><bdi>{[c.phone1, c.phone2, c.email, c.city].filter(Boolean).join(' · ')}</bdi></div></div>
              {sel ? <OcIcon name="check" size="sm" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewCustomerForm({ form, setForm, settings }) {
  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  return (
    <div className="oc-cs-pane">
      <div className="grid2">
        <Field label="שם פרטי *" htmlFor="oc-nc-fn"><Inp id="oc-nc-fn" value={form.firstName} onChange={set('firstName')} data-autofocus="true" /></Field>
        <Field label="שם משפחה *" htmlFor="oc-nc-ln"><Inp id="oc-nc-ln" value={form.lastName} onChange={set('lastName')} /></Field>
      </div>
      <div className="grid2 oc-cs-gap">
        <Field label="טלפון *" htmlFor="oc-nc-ph"><Inp id="oc-nc-ph" dir="ltr" inputMode="tel" value={form.phone1} onChange={set('phone1')} /></Field>
        <Field label="דוא״ל *" htmlFor="oc-nc-em"><Inp id="oc-nc-em" dir="ltr" type="email" value={form.email} onChange={set('email')} /></Field>
      </div>
      {gmailCompletable(form.email) ? (
        <div className="oc-cs-gm"><button type="button" className="btn sm" onClick={() => setForm(prev => ({ ...prev, email: gmailComplete(prev.email) }))}>השלם ל- @gmail.com</button></div>
      ) : null}
      <div className="grid2 oc-cs-gap">
        <Field label="עיר" htmlFor="oc-nc-city"><Inp id="oc-nc-city" value={form.city} onChange={set('city')} /></Field>
        <Field label="רחוב" htmlFor="oc-nc-st"><Inp id="oc-nc-st" value={form.street} onChange={set('street')} /></Field>
      </div>
      <div className={settings.requireCustomerIdNumber ? 'grid2 oc-cs-gap' : 'oc-cs-gap'}>
        <Field label="בית" htmlFor="oc-nc-hn"><Inp id="oc-nc-hn" inputMode="numeric" value={form.houseNum} onChange={set('houseNum')} /></Field>
        {settings.requireCustomerIdNumber ? (
          <Field label="תעודת זהות *" htmlFor="oc-nc-id"><Inp id="oc-nc-id" dir="ltr" inputMode="numeric" value={form.zeout || ''} onChange={set('zeout')} /></Field>
        ) : null}
      </div>
    </div>
  );
}

/** חלון ההחלפה. props: {settings, close}. close(customer) = הלקוח שנבחר / נוצר; close(null) = ביטול. */
export default function OcCustomerSwapDialog({ settings, close }) {
  const [mode, setMode] = useState('existing');
  const [picked, setPicked] = useState(null);
  const [form, setForm] = useState({ ...NEW_CUSTOMER_EMPTY });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const confirmExisting = (c) => { const x = c || picked; if (x) close(x); };
  const saveNew = async () => {
    if (busyRef.current) return;
    const e = newCustomerError(form, settings);
    if (e) { setErr(e); return; }
    busyRef.current = true; setBusy(true); setErr('');
    try {
      const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCustomerBody(form, settings)) });
      if (res.ok) { const saved = await res.json(); close(saved); return; }
      let msg = '';
      try { const d = await res.json(); msg = d && d.error ? String(d.error) : ''; } catch { /* גוף לא JSON */ }
      setErr(msg ? `שגיאה בשמירת לקוח: ${msg}` : 'שגיאה בשמירת לקוח');
    } catch {
      setErr('שגיאה בשמירת לקוח');
    }
    busyRef.current = false; setBusy(false);
  };
  const tabs = [['existing', 'לקוח קיים'], ['new', 'לקוח חדש']];
  const i = mode === 'new' ? 1 : 0;

  return (
    <>
      <DlgHead id="oc-cs-t" title="החלפת לקוח" />
      <div className="seg pill" id="ocCustSeg" role="radiogroup" aria-label="סוג לקוח" style={{ '--n': 2, '--i': i }}>
        <span className="pth" aria-hidden="true" />
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setErr(''); }}>{l}</button>
        ))}
      </div>
      {mode === 'existing'
        ? <CustomerSearch picked={picked} onPick={setPicked} onConfirm={confirmExisting} />
        : <NewCustomerForm form={form} setForm={(fn) => { setErr(''); setForm(fn); }} settings={settings || {}} />}
      {err ? <div className="amsg" role="alert"><OcIcon name="alert" size="sm" />{err}</div> : null}
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" disabled={busy || (mode === 'existing' && !picked)} onClick={() => (mode === 'existing' ? confirmExisting() : saveNew())}>שמור ובחר</DlgBtn>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}
