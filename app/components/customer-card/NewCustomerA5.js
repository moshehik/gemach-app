'use client';

// טופס לקוח חדש (/customers/new) בעיצוב החדש (הבעלים NP1). אותם שדות וכללים כמו הטופס הישן (LegacyCustomerPage.js, id === 'new'):
// שם פרטי / שם משפחה / טלפון / טלפון נוסף / מייל / רחוב / מספר בית / עיר / ת״ז / אישור דיוור / הערות; הכללים של יצירה
// (require_customer_email, require_full_address, require_customer_id_number, mandatory_field_groups) + שדות החובה של הכרטיס
// (customer_required_fields). הודעות המערכת בטוסט ולא ב-alert (NP2). אותו POST /api/customers (+ cardVariant:'a5'), ואחרי
// יצירה - מעבר לכרטיס הלקוח החדש, כמו בישן.

import '@/design-system/components.css';
import './customer-card.css';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { requiredFieldsFromSettings, customerBankFieldsEnabled } from '@/lib/customerRequiredFields';
import { parseFieldGroups } from '@/lib/customerValidation';
import usePageTooltip from '@/app/components/profile/usePageTooltip';
import CcIcon, { CcSprite } from './CcIcon';
import { CcPortalRoot } from './CcPortal';
import { CcUiProvider, useCcUi } from './CcUi';
import { CcEmailInput, CcInput, Tip } from './CcFields';
import { buildNewCustomerPayload, isStarred, newCustomerInitial, validateForSave } from './customerCardLogic';

const FIELD_NAMES = { firstName: 'שם פרטי', lastName: 'שם משפחה', phone1: 'טלפון', phone2: 'טלפון נוסף', email: 'מייל' };

export default function NewCustomerA5() {
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const [portalEl, setPortalEl] = useState(null);
  usePageTooltip(rootRef, ttRef, false);
  return (
    <div className="gm-ds gm-cc home-bg dlg-dark" dir="rtl" ref={rootRef}>
      <CcSprite />
      <CcPortalRoot.Provider value={portalEl}>
        <CcUiProvider>
          <NewBody />
        </CcUiProvider>
      </CcPortalRoot.Provider>
      <div className="cc-portal" ref={setPortalEl} />
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}

function NewBody() {
  const ui = useCcUi();
  const router = useRouter();
  const [c, setC] = useState(newCustomerInitial);
  const [settings, setSettings] = useState({});
  const [loc, setLoc] = useState({ cities: [], streets: [] });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then((d) => { if (Array.isArray(d)) setSettings(d.reduce((a, s) => ({ ...a, [s.key]: s.value }), {})); })
      .catch(() => {});
    fetchSharedJson('/api/customers/locations', { ttl: TTL.REFERENCE })
      .then((d) => setLoc({ cities: d?.cities || [], streets: d?.streets || [] }))
      .catch(() => {});
  }, []);
  const requiredKeys = requiredFieldsFromSettings(settings);
  // שדות הבנק רק כשההגדרה customer_bank_fields_enabled פעילה (ברירת מחדל: כבוי) - וכבויה גם לא חובה (requiredFieldsFromSettings)
  const bankEnabled = customerBankFieldsEnabled(settings);
  const set = (k) => (v) => setC((p) => ({ ...p, [k]: v }));
  const star = (k) => isStarred(k, c, { requiredKeys, isNew: true, settings });
  const groups = parseFieldGroups(settings.mandatory_field_groups);

  const save = async (e) => {
    if (e) e.preventDefault();
    if (saving) return;
    const v = validateForSave(c, { requiredKeys, isNew: true, settings });
    if (!v.ok) {
      ui.toast('error', v.errors[0], v.errors.slice(1).join(' · ') || 'נא להשלים לפני השמירה');
      if (v.field) setTimeout(() => { const el = document.querySelector(`.gm-cc [data-f="${v.field}"]`); if (el) el.focus(); }, 40);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildNewCustomerPayload(c, { bankEnabled })) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { ui.toast('error', data.error || data.message || 'שגיאה בשמירת נתונים'); return; }
      if (data.id) {
        ui.toast('info', 'הלקוחה נוספה', 'פותחים את כרטיס הלקוחה…');
        router.push(`/customers/${data.id}`);
      }
    } catch {
      ui.toast('error', 'שגיאת רשת בשמירה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app cc-app cc-new" id="app">
      <div className="topbar">
        <button type="button" className="back" data-act="exit" aria-label="חזרה" data-tip="חזרה" onClick={() => router.back()}><CcIcon name="back" /></button>
        <div className="ttl"><h1><small>לקוח</small><bdi>חדש</bdi></h1></div>
      </div>
      <form className="layout cc-layout-msg" onSubmit={save} autoComplete="off" noValidate>
        <main className="main">
          <section className="panel on">
            <div className="card dfields">
              <div className="card-h"><div className="ico rose"><CcIcon name="user" size="lg" /></div><h2>פרטי לקוח</h2></div>
              <div className="grid2">
                <CcInput id="nFirst" field="firstName" label="שם פרטי" icon="user" value={c.firstName} onChange={set('firstName')} placeholder="שם פרטי..." required={star('firstName')} />
                <CcInput id="nLast" field="lastName" label="שם משפחה" icon="user" value={c.lastName} onChange={set('lastName')} placeholder="שם משפחה..." required={star('lastName')} />
                <CcInput id="nPhone" field="phone1" label="טלפון" icon="phone" value={c.phone1} onChange={set('phone1')} placeholder="050-000-0000" mode="tel" dir="ltr" required={star('phone1')} />
                <CcInput id="nPhone2" field="phone2" label="טלפון נוסף" icon="phone" value={c.phone2} onChange={set('phone2')} placeholder="אופציונלי" mode="tel" dir="ltr" required={star('phone2')} tip="טלפון בית או של בן משפחה" />
                <CcEmailInput id="nEmail" value={c.email} onChange={set('email')} required={star('email')} />
                <CcInput id="nStreet" field="street" label="רחוב" icon="pin" value={c.street} onChange={set('street')} placeholder="רחוב..." required={star('street')} suggest={loc.streets} />
                <CcInput id="nHouse" field="houseNum" label="מספר בית" icon="pin" value={c.houseNum} onChange={(v) => set('houseNum')(v.replace(/[^\d]/g, ''))} placeholder="מספר..." mode="numeric" required={star('houseNum')} />
                <CcInput id="nCity" field="city" label="עיר" icon="pin" value={c.city} onChange={set('city')} placeholder="עיר..." required={star('city')} suggest={loc.cities} />
                <CcInput id="nId" field="zeout" label="תעודת זהות" icon="file" value={c.zeout} onChange={set('zeout')} placeholder="9 ספרות" mode="numeric" dir="ltr" required={star('zeout')} tip="לעריכה / ביטול הזמנה" />
              </div>
              {groups.length ? (
                <div className="faint sm cc-mt24">
                  {groups.map((g) => `יש למלא לפחות אחד מבין: ${g.map((k) => FIELD_NAMES[k] || k).join(' / ')}`).join(' · ')}
                </div>
              ) : null}
              {settings.hide_marketing_consent_field !== 'true' ? (
                <div className="trow cc-mt24">
                  <label className="sw"><input type="checkbox" id="newMarketingConsent" data-f="marketingConsent" checked={!!c.marketingConsent} onChange={(e) => setC((p) => ({ ...p, marketingConsent: e.target.checked }))} aria-label="מאשר/ת קבלת דיוורים" /><i /></label>
                  <b>מאשר/ת קבלת דיוורים</b><Tip text="תזכורות ועדכוני מבצעים במייל" />
                </div>
              ) : null}
            </div>
            {bankEnabled ? (
              <div className="card dfields">
                <div className="card-h"><div className="ico teal"><CcIcon name="bank" size="lg" /></div><h2>פרטי חשבון בנק לזיכויים</h2></div>
                <div className="grid2">
                  <CcInput id="nBkName" field="bankName" label="שם בנק" icon="bank" value={c.bankName} onChange={set('bankName')} placeholder="למשל: לאומי" required={star('bankName')} />
                  <CcInput id="nBkBranch" field="bankBranch" label="סניף" icon="bank" value={c.bankBranch} onChange={set('bankBranch')} placeholder="מספר סניף" mode="numeric" dir="ltr" required={star('bankBranch')} />
                  <CcInput id="nBkAcc" field="bankAccount" label="מספר חשבון" icon="bank" value={c.bankAccount} onChange={set('bankAccount')} mode="numeric" dir="ltr" required={star('bankAccount')} />
                  <CcInput id="nBkOwner" field="bankAccountName" label="שם בעל החשבון" icon="user" value={c.bankAccountName} onChange={set('bankAccountName')} required={star('bankAccountName')} />
                </div>
              </div>
            ) : null}
            <div className="card">
              <div className="card-h"><div className="ico plum"><CcIcon name="note" size="lg" /></div><h2>הערות ללקוחה <Tip text="מוצג בחלון ההזמנה ומיועד לצוות בלבד" /></h2></div>
              <textarea className="inp" id="notes" data-f="notes" placeholder="כתבו כאן הערה…" value={c.notes} onChange={(e) => setC((p) => ({ ...p, notes: e.target.value }))} aria-label="הערות ללקוחה" />
            </div>
            <div className="cc-newsave">
              <button type="submit" className="btn primary lg block" data-act="save" disabled={saving}><CcIcon name="check" />{saving ? 'שומר…' : 'שמירת לקוחה'}</button>
            </div>
          </section>
        </main>
      </form>
    </div>
  );
}
