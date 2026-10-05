'use client';

// לשונית "פרטים" (העיצוב: pDetailsView / pDetailsEdit). ברירת מחדל תצוגה בלבד; העיפרון בכותרת הכרטיס פותח עריכה ו-✓ סוגר אותה
// (בלי לשמור - השמירה רק במסילה). החלטות הבעלים: שם פרטי + שם משפחה (אין "שם מלא"), רחוב + מספר בית (אין "כתובת מגורים"),
// כוכביות לפי customer_required_fields, העתקת מייל צפה, "השלם ל-@gmail.com", הצעות עיר/רחוב ברשימה נגללת, מתג "מאשר/ת קבלת
// דיוורים" (marketingConsent, מוסתר לפי hide_marketing_consent_field), חתימה על תקנון (נגזרת מההזמנות עד שתהיה עמודה), הערות -
// שורות אוטומטיות כקישורים להזמנה (לא מודגשות) + תיבת הערות שנערכת גם בתצוגה ונשמרת רק דרך "שמור" במסילה, ופרטי חשבון הבנק
// לזיכויים (J1 ב': בלי לשונית "זיכויים ופרטי בנק" נפרדת). בלי "פרטים מתקדמים" (אמצעי קשר / תזכורת - לא להכניס).

import { useEffect, useMemo, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { getHebrewDateString } from '@/lib/hebrewDate';
import CcIcon from '../CcIcon';
import { CcEmailInput, CcInput, Tip, ViewRow } from '../CcFields';
import { isStarred, joinNotes, signatureOrderText, signatureState, splitNotes } from '../customerCardLogic';

function EditBtn({ on, onClick, hidden }) {
  if (hidden) return null;
  const t = on ? 'סיום עריכה' : 'עריכת פרטי לקוח';
  return (
    <button type="button" className="ibtn" data-act="editcust" aria-label={t} data-tip={t} aria-pressed={on} onClick={onClick}>
      <CcIcon name={on ? 'check' : 'pencil'} />
    </button>
  );
}

export default function CcDetailsTab({ cc, ui }) {
  const { cur, editCust, setEditCust, setField, requiredKeys, settings } = cc;
  const [loc, setLoc] = useState({ cities: [], streets: [] });
  useEffect(() => {
    fetchSharedJson('/api/customers/locations', { ttl: TTL.REFERENCE })
      .then((d) => setLoc({ cities: d?.cities || [], streets: d?.streets || [] }))
      .catch(() => {});
  }, []);
  const star = (k) => isStarred(k, cur, { requiredKeys });
  const sig = signatureState(cur);
  const { manual, auto } = useMemo(() => splitNotes(cur.notes), [cur.notes]);
  const showConsent = settings.hide_marketing_consent_field !== 'true';

  const mailBtn = (
    <div className="cc-mailrow"><button type="button" className="btn sm" data-act="mail-open" onClick={cc.openMail}><CcIcon name="mail" size="sm" />מייל מהיר</button></div>
  );

  const custCard = editCust && !cc.readOnly ? (
    <div className="card dfields">
      <div className="card-h"><div className="ico rose"><CcIcon name="user" size="lg" /></div><h2>פרטי לקוח</h2><EditBtn on onClick={() => setEditCust(false)} /></div>
      <div className="grid2">
        <CcInput id="cFirst" field="firstName" label="שם פרטי" icon="user" value={cur.firstName} onChange={(v) => setField('firstName', v)} placeholder="שם פרטי..." required={star('firstName')} />
        <CcInput id="cLast" field="lastName" label="שם משפחה" icon="user" value={cur.lastName} onChange={(v) => setField('lastName', v)} placeholder="שם משפחה..." required={star('lastName')} />
        <CcInput id="cPhone" field="phone1" label="טלפון" icon="phone" value={cur.phone1} onChange={(v) => setField('phone1', v)} placeholder="050-000-0000" mode="tel" dir="ltr" required={star('phone1')} />
        <CcInput id="cPhone2" field="phone2" label="טלפון נוסף" icon="phone" value={cur.phone2} onChange={(v) => setField('phone2', v)} placeholder="אופציונלי" mode="tel" dir="ltr" required={star('phone2')} tip="טלפון בית או של בן משפחה" />
        <CcEmailInput id="cEmail" value={cur.email} onChange={(v) => setField('email', v)} required={star('email')} />
        <CcInput id="cStreet" field="street" label="רחוב" icon="pin" value={cur.street} onChange={(v) => setField('street', v)} placeholder="רחוב..." required={star('street')} suggest={loc.streets} />
        <CcInput id="cHouse" field="houseNum" label="מספר בית" icon="pin" value={cur.houseNum} onChange={(v) => setField('houseNum', v.replace(/[^\d]/g, ''))} placeholder="מספר..." mode="numeric" required={star('houseNum')} />
        <CcInput id="cCity" field="city" label="עיר" icon="pin" value={cur.city} onChange={(v) => setField('city', v)} placeholder="עיר..." required={star('city')} suggest={loc.cities} />
        <CcInput id="cId" field="zeout" label="תעודת זהות" icon="file" value={cur.zeout} onChange={(v) => setField('zeout', v)} placeholder="9 ספרות" mode="numeric" dir="ltr" required={star('zeout')} tip="לעריכה / ביטול הזמנה" />
      </div>
      <div className="row wrap cc-mt24"><button type="button" className="btn sm" data-act="mail-open" onClick={cc.openMail}><CcIcon name="mail" size="sm" />מייל מהיר</button><Tip text="שליחת מייל ללקוחה עם קבצים מצורפים" /></div>
    </div>
  ) : (
    <div className="card cust">
      <div className="card-h"><div className="ico rose"><CcIcon name="user" size="lg" /></div><h2>פרטי לקוח</h2><EditBtn on={false} hidden={cc.readOnly} onClick={() => setEditCust(true)} /></div>
      <div className="kv">
        <ViewRow icon="user" label="שם פרטי" value={cur.firstName} required={star('firstName')} />
        <ViewRow icon="user" label="שם משפחה" value={cur.lastName} required={star('lastName')} />
        <ViewRow icon="phone" label="טלפון" value={cur.phone1} bdi required={star('phone1')} />
        <ViewRow icon="phone" label="טלפון נוסף" value={cur.phone2} bdi required={star('phone2')} />
        <ViewRow icon="mail" label="מייל" value={cur.email} bdi required={star('email')} extra={mailBtn} />
        <ViewRow icon="pin" label="רחוב" value={cur.street} required={star('street')} />
        <ViewRow icon="pin" label="מספר בית" value={cur.houseNum} required={star('houseNum')} />
        <ViewRow icon="pin" label="עיר" value={cur.city} required={star('city')} />
        <ViewRow icon="file" label="תעודת זהות" value={cur.zeout} bdi required={star('zeout')} />
      </div>
    </div>
  );

  const sigText = sig.signed ? `חתמה${signatureOrderText(sig)}${sig.at ? ` · ${getHebrewDateString(sig.at)}` : ''}` : 'טרם נחתם';
  const termsCard = (
    <div className="card">
      <div className="card-h"><div className="ico gold"><CcIcon name="note" size="lg" /></div><h2>תקנון ועדכונים</h2></div>
      <div className="row wrap cc-gap14">
        <button type="button" className={`btn tgl${sig.signed ? ' on' : ''}`} id="termsBtn" aria-pressed={sig.signed} aria-disabled="true"
          data-tip="החתימה נרשמת היום בכל הזמנה; חתימה ברמת הלקוחה תופעל אחרי עדכון מסד הנתונים"
          onClick={() => ui.toast('info', 'החתימה על התקנון נרשמת בהזמנה', 'חתימה ברמת הלקוחה תופעל אחרי עדכון מסד הנתונים')}>
          {sig.signed ? <CcIcon name="check" size="sm" className="evck" anim={false} /> : null}<CcIcon name="sig" size="sm" />חתמה על התקנון
        </button>
        <span className="faint">{sigText}</span>
      </div>
      {showConsent ? (
        <div className="trow cc-mt24">
          <label className="sw"><input type="checkbox" id="newsOn" data-f="marketingConsent" checked={!!cur.marketingConsent} disabled={cc.readOnly} onChange={(e) => setField('marketingConsent', e.target.checked)} aria-label="מאשר/ת קבלת דיוורים" /><i /></label>
          <b>מאשר/ת קבלת דיוורים</b><Tip text="תזכורות ועדכוני מבצעים במייל" />
        </div>
      ) : null}
    </div>
  );

  const notesCard = (
    <div className="card">
      <div className="card-h"><div className="ico plum"><CcIcon name="note" size="lg" /></div><h2>הערות ללקוחה <Tip text="מוצג בחלון ההזמנה ומיועד לצוות בלבד" /></h2></div>
      {auto.length ? (
        <div className="list cc-autonotes">
          {auto.map((a, i) => (
            <a key={`${a.orderId}-${i}`} className="li lrow rlink" href={`/orders/${a.orderId}`} aria-label={`הזמנה ${a.orderId}`}>
              <div className="ic-b"><CcIcon name="note" /><span className="rlbl">אוטומטי</span></div>
              <div className="t"><span className="cc-an"><span className="cc-an-d">{getHebrewDateString(a.date)}</span> · דגם {a.model}{a.size ? ` מידה ${a.size}` : ''} · {a.rest}</span><span className="ln">הזמנה <bdi>#{a.orderId}</bdi></span></div>
              <span className="go" aria-hidden="true"><CcIcon name="ext" size="sm" /></span>
            </a>
          ))}
        </div>
      ) : null}
      <textarea className="inp" id="notes" data-f="notes" placeholder="כתבו כאן הערה…" value={manual} readOnly={cc.readOnly} onChange={(e) => setField('notes', joinNotes(cc.saved.notes, e.target.value))} aria-label="הערות ללקוחה" />
      {cc.changes.some((c) => c.field === 'notes') ? <div className="faint sm cc-notes-hint">השינוי בהערות יישמר רק בלחיצה על "שמור" בסיכום</div> : null}
    </div>
  );

  const bankCard = !cc.bankEnabled ? null : editCust && !cc.readOnly ? (
    <div className="card dfields">
      <div className="card-h"><div className="ico teal"><CcIcon name="bank" size="lg" /></div><h2>פרטי חשבון בנק לזיכויים</h2></div>
      <div className="grid2">
        <CcInput id="bkName" field="bankName" label="שם בנק" icon="bank" value={cur.bankName} onChange={(v) => setField('bankName', v)} placeholder="למשל: לאומי" required={star('bankName')} />
        <CcInput id="bkBranch" field="bankBranch" label="סניף" icon="bank" value={cur.bankBranch} onChange={(v) => setField('bankBranch', v)} placeholder="מספר סניף" mode="numeric" dir="ltr" required={star('bankBranch')} />
        <CcInput id="bkAcc" field="bankAccount" label="מספר חשבון" icon="bank" value={cur.bankAccount} onChange={(v) => setField('bankAccount', v)} mode="numeric" dir="ltr" required={star('bankAccount')} />
        <CcInput id="bkOwner" field="bankAccountName" label="שם בעל החשבון" icon="user" value={cur.bankAccountName} onChange={(v) => setField('bankAccountName', v)} required={star('bankAccountName')} />
      </div>
    </div>
  ) : (
    <div className="card cust cc-bank">
      <div className="card-h"><div className="ico teal"><CcIcon name="bank" size="lg" /></div><h2>פרטי חשבון בנק לזיכויים</h2><EditBtn on={false} hidden={cc.readOnly} onClick={() => setEditCust(true)} /></div>
      <div className="kv">
        <ViewRow icon="bank" label="שם בנק" value={cur.bankName} required={star('bankName')} />
        <ViewRow icon="bank" label="סניף" value={cur.bankBranch} bdi required={star('bankBranch')} />
        <ViewRow icon="bank" label="מספר חשבון" value={cur.bankAccount} bdi required={star('bankAccount')} />
        <ViewRow icon="user" label="שם בעל החשבון" value={cur.bankAccountName} required={star('bankAccountName')} />
      </div>
    </div>
  );

  return (
    <>
      {custCard}
      {termsCard}
      {notesCard}
      {bankCard}
    </>
  );
}
