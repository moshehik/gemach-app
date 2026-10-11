'use client';

// KioskRegistration - המסך "מילוי פרטים אישיים ושמירה" של עמדת הלקוח (רכיב משותף).
// מצב: mode="station" (בתוך העמדה, עם שלד האתר / העמדה הנעולה) | mode="public" (שלב הבא: מסלול ציבורי בלי שלד האתר - עוד לא נבנה; הרכיב עצמאי: כל מה
// שהוא צריך מגיע ב-props, והוא לא נוגע ב-router / נעילה / מצב העמדה).
//
// נקודות חיבור (שלב האינטגרציה):
//   submit        פונקציית השליחה היחידה (ברירת מחדל: submitRegistration מ-kioskRegistrationApi.js, היום POST /api/customers).
//   termsUrl      קובץ התקנון לצפייה בחלון בתוך המסך, בלי לצאת מהעמדה הנעולה (ברירת מחדל: GET /api/public-terms).
//   privacyUrl    מדיניות הפרטיות בחלון (ברירת מחדל: /privacy). שני הקישורים נפתחים ב-iframe בתוך חלון (Dlg), לא בלשונית חדשה.
//   useEnterNav   ה-hook לניווט באנטר (מקומי: kioskEnterNav.js; יוחלף ב-hook המשותף של סוכן customer-consent).
//   שדות הבקשה:   acceptedTerms / marketingConsent (true|false מפורש) / acceptedPrivacy - נשלחים כמו שהם ב-submit.

import { useEffect, useRef, useState } from 'react';
import { Dlg, DlgBadge } from '../a5-list/A5Ui';
import { KIcon, YesNo } from './KioskParts';
import { useEnterNav as useLocalEnterNav } from './kioskEnterNav';
import { submitRegistration } from './kioskRegistrationApi';
import { getMissingRegFields, CUSTOMER_FIELD_LABELS } from './kioskLogic';

export const TERMS_URL = '/api/public-terms';
export const PRIVACY_URL = '/privacy';

const EMPTY = {
  firstName: '', lastName: '', zeout: '', phone1: '', email: '', city: '', street: '', houseNum: '',
  acceptedTerms: null, marketingConsent: null, acceptedPrivacy: false,
};

/** חלון צפייה במסמך (תקנון / מדיניות פרטיות) בתוך המסך: iframe / תמונה, או הודעה ברורה כשאי אפשר להציג. */
function DocDialog({ title, url, onClose }) {
  const [state, setState] = useState({ status: 'loading', ct: '' });
  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    fetch(url, { signal: ac.signal, credentials: 'same-origin' })
      .then((res) => {
        if (!alive) return;
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        ac.abort(); // מספיק לנו הכותרת; הדפדפן יטען את המסמך עצמו ב-iframe
        setState(res.ok ? { status: 'ok', ct } : { status: 'err', ct });
      })
      .catch(() => { if (alive) setState({ status: 'err', ct: '' }); });
    return () => { alive = false; ac.abort(); };
  }, [url]);

  const isImage = state.ct.startsWith('image/');
  const viewable = state.status === 'ok' && (isImage || /pdf|html|text\/plain/.test(state.ct));
  return (
    <Dlg labelledBy="ks-doc-t" className="ks-doc" onClose={onClose} focusSel=".btn.primary">
      <DlgBadge icon="file" />
      <h2 id="ks-doc-t">{title}</h2>
      <div className="ks-doc-body">
        {state.status === 'loading' ? <p className="ks-doc-msg">טוען...</p> : null}
        {state.status === 'err' ? <p className="ks-doc-msg" role="alert">המסמך אינו זמין כרגע. אפשר לבקש לראות אותו אצל העובדת.</p> : null}
        {state.status === 'ok' && !viewable ? <p className="ks-doc-msg" role="alert">המסמך אינו ניתן להצגה על המסך. אפשר לבקש לראות אותו אצל העובדת.</p> : null}
        {viewable && isImage ? <img className="ks-doc-img" src={url} alt={title} /> : null}
        {viewable && !isImage ? <iframe className="ks-doc-frame" src={url} title={title} /> : null}
      </div>
      <div className="dbtns">
        <button type="button" className="btn primary lg block" data-agy-id="ks_doc_close" onClick={onClose}><KIcon id="check" />סגירה</button>
      </div>
    </Dlg>
  );
}

export default function KioskRegistration({
  mode = 'station',
  settings = {},
  onBack = null,
  onDone = null,
  submit = submitRegistration,
  termsUrl = TERMS_URL,
  privacyUrl = PRIVACY_URL,
  useEnterNav = useLocalEnterNav,
}) {
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { legacyId? } אחרי שמירה
  const [doc, setDoc] = useState(null); // 'terms' | 'privacy'
  const formRef = useRef(null);
  useEnterNav(formRef);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const missing = getMissingRegFields(form, settings);
  const bad = (k) => touched && missing.includes(k);
  const req = (cond) => (cond ? ' *' : '');
  const showMarketing = settings.hide_marketing_consent_field !== 'true';
  const needFullAddress = settings.require_full_address === 'true';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setTouched(true);
    if (missing.length > 0) {
      setError(`נא להשלים: ${missing.map((k) => CUSTOMER_FIELD_LABELS[k] || k).join(', ')}`);
      return;
    }
    setBusy(true);
    try {
      const out = await submit({ ...form, marketingConsent: showMarketing ? form.marketingConsent : false }, { mode });
      if (out && out.ok) {
        setDone({ legacyId: out.data && out.data.legacyId ? out.data.legacyId : null });
        setForm(EMPTY); // לא משאירים פרטים אישיים בזיכרון המסך אחרי השמירה
        setTouched(false);
      } else {
        setError((out && out.error) || 'שגיאה בשמירה, נא לפנות לצוות הגמ"ח');
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="ks-reg ks-reg-done" data-mode={mode} data-agy-id="kiosk_registration_done">
        <div className="ks-card ks-done-card" role="status" aria-live="polite">
          <span className="ks-done-ico" aria-hidden="true"><KIcon id="check" size="lg" /></span>
          <h2 className="kiosk-headline">הפרטים נשמרו</h2>
          <p className="ks-done-txt">גשי לעובדת ומסרי ת״ז או טלפון, וההזמנה תמשיך משם.</p>
          {done.legacyId ? <p className="ks-done-num">מספר לקוח: <b>{done.legacyId}</b></p> : null}
          <div className="ks-actions">
            <button type="button" className="btn primary lg" data-agy-id="kiosk_registration_done_btn" onClick={() => { setDone(null); if (onDone) onDone(); }}>
              <KIcon id="check" />סיום
            </button>
            <button type="button" className="btn ghost" data-agy-id="kiosk_registration_another_btn" onClick={() => setDone(null)}>
              <KIcon id="user" size="sm" />מילוי פרטים של לקוחה נוספת
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ks-reg" data-mode={mode} data-agy-id="kiosk_self_registration_card">
      <div className="ks-reg-head">
        <h2 className="kiosk-headline">מילוי פרטים אישיים</h2>
        <p className="ks-sub">ממלאים כאן את הפרטים פעם אחת, והעובדת תמשיך איתך משם להזמנה.</p>
      </div>

      <form className="ks-card ks-form" ref={formRef} onSubmit={onSubmit} noValidate autoComplete="off">
        <div className="ks-grid ks-grid-2">
          <div className={`field${bad('firstName') ? ' bad' : ''}`}>
            <label className="lbl" htmlFor="ks-r-first">שם פרטי *</label>
            <input id="ks-r-first" className="inp" data-enter="firstName" data-agy-id="reg_firstName_input" value={form.firstName} onChange={set('firstName')} autoComplete="off" />
          </div>
          <div className={`field${bad('lastName') ? ' bad' : ''}`}>
            <label className="lbl" htmlFor="ks-r-last">שם משפחה *</label>
            <input id="ks-r-last" className="inp" data-enter="lastName" data-agy-id="reg_lastName_input" value={form.lastName} onChange={set('lastName')} autoComplete="off" />
          </div>
          <div className={`field${bad('zeout') ? ' bad' : ''}`}>
            <label className="lbl" htmlFor="ks-r-id">תעודת זהות{req(settings.require_customer_id_number === 'true')}</label>
            <input id="ks-r-id" className="inp" dir="ltr" inputMode="numeric" maxLength={9} data-enter="zeout" data-agy-id="reg_zeout_input" value={form.zeout}
              onChange={(e) => setForm((p) => ({ ...p, zeout: e.target.value.replace(/\D/g, '') }))} autoComplete="off" />
          </div>
          <div className={`field${bad('phone1') ? ' bad' : ''}`}>
            <label className="lbl" htmlFor="ks-r-phone">טלפון נייד *</label>
            <input id="ks-r-phone" className="inp" type="tel" dir="ltr" inputMode="tel" data-enter="phone1" data-agy-id="reg_phone1_input" value={form.phone1} onChange={set('phone1')} autoComplete="off" />
          </div>
          <div className={`field ks-span2${bad('email') ? ' bad' : ''}`}>
            <label className="lbl" htmlFor="ks-r-mail">אימייל{req(settings.require_customer_email === 'true')}</label>
            <input id="ks-r-mail" className="inp" type="email" dir="ltr" inputMode="email" data-enter="email" data-agy-id="reg_email_input" value={form.email} onChange={set('email')} autoComplete="off" />
          </div>
        </div>
        <div className="ks-grid ks-grid-3">
          <div className={`field${bad('city') ? ' bad' : ''}`}>
            <label className="lbl" htmlFor="ks-r-city">עיר{req(needFullAddress)}</label>
            <input id="ks-r-city" className="inp" data-enter="city" data-agy-id="reg_city_input" value={form.city} onChange={set('city')} autoComplete="off" />
          </div>
          <div className={`field${bad('street') ? ' bad' : ''}`}>
            <label className="lbl" htmlFor="ks-r-street">רחוב{req(needFullAddress)}</label>
            <input id="ks-r-street" className="inp" data-enter="street" data-agy-id="reg_street_input" value={form.street} onChange={set('street')} autoComplete="off" />
          </div>
          <div className={`field${bad('houseNum') ? ' bad' : ''}`}>
            <label className="lbl" htmlFor="ks-r-house">מספר בית{req(needFullAddress)}</label>
            <input id="ks-r-house" className="inp" inputMode="numeric" data-enter="houseNum" data-agy-id="reg_houseNum_input" value={form.houseNum} onChange={set('houseNum')} autoComplete="off" />
          </div>
        </div>

        <div className="ks-consent">
          <div className="ks-consent-row">
            <YesNo id="ks-terms" label="חתמ/ה על התקנון *" value={form.acceptedTerms} enterName="acceptedTerms" invalid={bad('acceptedTerms')}
              onChange={(v) => setForm((p) => ({ ...p, acceptedTerms: v }))} />
            <button type="button" className="ks-link" data-agy-id="kiosk_view_terms_btn" onClick={() => setDoc('terms')}><KIcon id="file" size="sm" />צפייה בתקנון</button>
          </div>
          {form.acceptedTerms === false ? <p className="ks-hint">אפשר לחתום על התקנון גם אצל העובדת.</p> : null}
          {showMarketing ? (
            <div className="ks-consent-row">
              <YesNo id="ks-mkt" label="מאשר/ת קבלת דיוורים *" value={form.marketingConsent} enterName="marketingConsent" invalid={bad('marketingConsent')}
                onChange={(v) => setForm((p) => ({ ...p, marketingConsent: v }))} />
            </div>
          ) : null}
          <div className={`ks-consent-row ks-privacy${bad('acceptedPrivacy') ? ' bad' : ''}`}>
            <label className="ks-check">
              <input type="checkbox" data-enter="acceptedPrivacy" data-agy-id="reg_privacy_input" checked={form.acceptedPrivacy}
                onChange={(e) => setForm((p) => ({ ...p, acceptedPrivacy: e.target.checked }))} />
              <span>אישרתי את מדיניות הפרטיות *</span>
            </label>
            <button type="button" className="ks-link" data-agy-id="kiosk_view_privacy_btn" onClick={() => setDoc('privacy')}><KIcon id="shield" size="sm" />מדיניות פרטיות</button>
          </div>
        </div>

        {error ? <div className="errline on" role="alert">{error}</div> : null}

        <div className="ks-actions">
          {onBack ? (
            <button type="button" className="btn ghost" data-agy-id="kiosk_registration_back_btn" onClick={onBack}><KIcon id="back" size="sm" />חזרה</button>
          ) : null}
          <button type="submit" className="btn primary lg" data-enter-submit="" data-agy-id="reg_submit_btn" disabled={busy}>
            {busy ? 'שומר...' : <><KIcon id="check" />שמירת הפרטים</>}
          </button>
        </div>
      </form>

      {doc === 'terms' ? <DocDialog title="תקנון" url={termsUrl} onClose={() => setDoc(null)} /> : null}
      {doc === 'privacy' ? <DocDialog title="מדיניות פרטיות" url={privacyUrl} onClose={() => setDoc(null)} /> : null}
    </div>
  );
}
