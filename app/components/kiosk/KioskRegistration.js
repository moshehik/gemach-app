'use client';

// KioskRegistration - המסך "מילוי פרטים אישיים ושמירה" של עמדת הלקוח (רכיב משותף).
// מצב: mode="station" (בתוך העמדה, עם שלד האתר / העמדה הנעולה) | mode="public" (שלב הבא: מסלול ציבורי בלי שלד האתר - עוד לא נבנה; הרכיב עצמאי: כל מה
// שהוא צריך מגיע ב-props, והוא לא נוגע ב-router / נעילה / מצב העמדה).
//
// נקודות חיבור (שלב האינטגרציה):
//   submit        פונקציית השליחה היחידה (ברירת מחדל: submitRegistration מ-kioskRegistrationApi.js, היום POST /api/customers).
//   termsUrl      קובץ התקנון לצפייה בחלון בתוך המסך, בלי לצאת מהעמדה הנעולה (ברירת מחדל: GET /api/public-terms).
//   privacyUrl    מדיניות הפרטיות בחלון (ברירת מחדל: /privacy). שני הקישורים נפתחים ב-iframe בתוך חלון (Dlg), לא בלשונית חדשה.
//   useEnterNav   ה-hook לניווט באנטר: ברירת מחדל = ה-hook המשותף של כל טפסי הלקוח (app/components/shared/useEnterNavigation.js, lib/enterNavigation.js);
//                 קורא useEnterNav(onSubmit) ומחזיר מטפל keydown שמחברים ל-<form>. בשדה האחרון Enter מעביר פוקוס ללחצן השליחה (data-enter-submit) ולא שולח.
//   שדות הבקשה:   acceptedTerms / marketingConsent (true|false מפורש) / acceptedPrivacy - נשלחים כמו שהם ב-submit.
//
// עיצוב (בקשת הבעלים 13.10.2026): שדה אחד בכל שורה, בדיוק כמו טופס "לקוחה חדשה" באתר (customer-card/CcFields.js + .dfields בפלטה):
//   .field > label.lbl + .inpw[אייקון + input.inp + .inpx], בלי CSS מקביל. כל בחירת כן/לא הפכה למתג דו-מצבי של הפלטה (label.sw, כמו בטופס
//   לקוחה חדשה / כרטיס לקוחה): "חתמ/ה על התקנון", "מאשר/ת קבלת דיוורים", "אישרתי את מדיניות הפרטיות".
// החלטה לגבי החוזה (lib/publicKiosk/registrationInput.js): השרת דורש true/false מפורשים ל-acceptedTerms ול-marketingConsent (חסר = שגיאת ולידציה),
//   ולמתג דו-מצבי אין מצב שלישי "טרם נענה". לכן: מתג כבוי = false מפורש, והוא נשלח כ-false בעת השליחה גם אם המשתמשת לא נגעה בו
//   (ליד כל מתג מוצג הסבר ברור מה משמעות המצב הכבוי). אישור מדיניות הפרטיות חובה (true בלבד); דיוור חובה להיות "כן" רק כש-require_marketing_consent דלוק.

import { useEffect, useRef, useState } from 'react';
import { Dlg, DlgBadge } from '../a5-list/A5Ui';
import { KIcon } from './KioskParts';
import useEnterNavigation from '@/app/components/shared/useEnterNavigation';
import { useNoFill } from '@/lib/autofillGuard';
import { submitRegistration } from './kioskRegistrationApi';
import { getMissingRegFields, settingsFromRules, CUSTOMER_FIELD_LABELS } from './kioskLogic';

export const TERMS_URL = '/api/public-terms';
export const PRIVACY_URL = '/privacy';

const EMPTY = {
  firstName: '', lastName: '', zeout: '', phone1: '', phone2: '', email: '', city: '', street: '', houseNum: '', website: '',
  acceptedTerms: false, marketingConsent: false, acceptedPrivacy: false, // מתג כבוי = false מפורש (ר' ההחלטה בראש הקובץ)
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

/** שדה טקסט אחד - אותו שלד כמו CcInput (customer-card/CcFields.js): field > lbl + inpw[אייקון, input.inp, inpx], הודעת שגיאה מתחת. */
function RegField({ id, label, icon, bad, msg, value, onClear, children }) {
  return (
    <div className={`field${bad ? ' bad' : ''}`}>
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="inpw">
        <KIcon id={icon} size="sm" />
        {children}
        <button type="button" className="inpx" aria-label="ניקוי" hidden={!value} onClick={onClear}><KIcon id="x" size="sm" /></button>
      </div>
      {bad && msg ? <p className="ks-ferr" role="alert"><KIcon id="alert" size="sm" />{msg}</p> : null}
    </div>
  );
}

/** שורת מתג דו-מצבי (label.sw של הפלטה בתוך .trow, כמו בטופס לקוחה חדשה) + הסבר למשמעות המצב הכבוי. */
function SwitchRow({ id, label, checked, onChange, bad, hint, agy, children }) {
  return (
    <div className={`ks-swrow${bad ? ' bad' : ''}`}>
      <div className="trow">
        <label className="sw"><input type="checkbox" id={id} data-agy-id={agy} checked={!!checked} aria-describedby={`${id}-h`} aria-invalid={bad ? 'true' : undefined} onChange={(e) => onChange(e.target.checked)} /><i /></label>
        <div className="ks-swtxt">
          <div className="ks-swline">
            <label className="ks-swl" htmlFor={id}>{label}</label>
            {children}
          </div>
          <p className="ks-hint" id={`${id}-h`}>{hint}</p>
        </div>
      </div>
    </div>
  );
}

export default function KioskRegistration({
  mode = 'station',
  settings = {},
  rules = null,
  onBack = null,
  onDone = null,
  submit = submitRegistration,
  termsUrl = TERMS_URL,
  privacyUrl = PRIVACY_URL,
  useEnterNav = useEnterNavigation,
}) {
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { legacyId? } אחרי שמירה
  const [doc, setDoc] = useState(null); // 'terms' | 'privacy'
  const [serverFields, setServerFields] = useState({}); // שדות שהשרת סימן כלא תקינים (400 fields), מתנקים בעריכה
  const formRef = useRef(null);
  // עמדה ציבורית משותפת: בלי הצעות היסטוריית הקלדה של הדפדפן (שמות / טלפונים / מיילים של לקוחות קודמות) - lib/autofillGuard.js
  const nf = useNoFill();
  // Enter = השדה הבא (גם על בחירת כן/לא, בלי לשנות אותה); בשדה האחרון - פוקוס ללחצן השליחה, לא שליחה
  const onFormKeyDown = useEnterNav(() => { const b = formRef.current && formRef.current.querySelector('[data-enter-submit]'); if (b && !b.disabled) b.focus(); });

  // מסלול ציבורי: הגדרות הטופס מגיעות מ-rules (GET /api/public-kiosk/config); בעמדה - מ-settings
  const eff = rules ? { ...settings, ...settingsFromRules(rules) } : settings;
  const showPhone2 = !!(rules && Array.isArray(rules.oneOf) && rules.oneOf.some((g) => Array.isArray(g) && g.includes('phone2')));
  const set = (k) => (e) => { const v = e.target.value; setForm((p) => ({ ...p, [k]: v })); setServerFields((f) => (f[k] ? { ...f, [k]: undefined } : f)); };
  const missing = getMissingRegFields(form, eff);
  const bad = (k) => (touched && missing.includes(k)) || !!serverFields[k] || (k === 'zeout' && !!serverFields.idNumber);
  const req = (cond) => (cond ? ' *' : '');
  const clear = (k) => () => { setForm((p) => ({ ...p, [k]: '' })); setServerFields((f) => (f[k] ? { ...f, [k]: undefined } : f)); };
  // הודעת שגיאה מתחת לשדה: מהשרת (400 fields) אם יש, אחרת "שדה חובה" לשדה שחסר
  const fieldMsg = (k) => {
    const sv = serverFields[k] || (k === 'zeout' ? serverFields.idNumber : null);
    return typeof sv === 'string' && sv ? sv : 'שדה חובה';
  };
  const showMarketing = eff.hide_marketing_consent_field !== 'true';
  const needFullAddress = eff.require_full_address === 'true';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setServerFields({});
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
        setServerFields((out && out.fields) || {});
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

      <form className="ks-card ks-form dfields" ref={formRef} onSubmit={onSubmit} onKeyDown={onFormKeyDown} noValidate autoComplete="off">
        <div className="ks-col" data-agy-id="reg_fields_col">
          <RegField id="ks-r-first" label="שם פרטי *" icon="user" bad={bad('firstName')} msg={fieldMsg('firstName')} value={form.firstName} onClear={clear('firstName')}>
            <input id="ks-r-first" className="inp" {...nf('firstName')} data-agy-id="reg_firstName_input" aria-required="true" aria-invalid={bad('firstName') ? 'true' : undefined} value={form.firstName} onChange={set('firstName')} />
          </RegField>
          <RegField id="ks-r-last" label="שם משפחה *" icon="user" bad={bad('lastName')} msg={fieldMsg('lastName')} value={form.lastName} onClear={clear('lastName')}>
            <input id="ks-r-last" className="inp" {...nf('lastName')} data-agy-id="reg_lastName_input" aria-required="true" aria-invalid={bad('lastName') ? 'true' : undefined} value={form.lastName} onChange={set('lastName')} />
          </RegField>
          <RegField id="ks-r-id" label={`תעודת זהות${req(eff.require_customer_id_number === 'true')}`} icon="file" bad={bad('zeout')} msg={fieldMsg('zeout')} value={form.zeout} onClear={clear('zeout')}>
            <input id="ks-r-id" className="inp" dir="ltr" inputMode="numeric" maxLength={9} {...nf('zeout')} data-agy-id="reg_zeout_input" aria-invalid={bad('zeout') ? 'true' : undefined} value={form.zeout}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setForm((p) => ({ ...p, zeout: v })); setServerFields((f) => (f.zeout || f.idNumber ? { ...f, zeout: undefined, idNumber: undefined } : f)); }} />
          </RegField>
          <RegField id="ks-r-phone" label="טלפון נייד *" icon="phone" bad={bad('phone1')} msg={fieldMsg('phone1')} value={form.phone1} onClear={clear('phone1')}>
            <input id="ks-r-phone" className="inp" type="tel" dir="ltr" inputMode="tel" {...nf('phone1')} data-agy-id="reg_phone1_input" aria-required="true" aria-invalid={bad('phone1') ? 'true' : undefined} value={form.phone1} onChange={set('phone1')} />
          </RegField>
          {showPhone2 ? (
            <RegField id="ks-r-phone2" label="טלפון נוסף" icon="phone" bad={bad('phone2')} msg={fieldMsg('phone2')} value={form.phone2} onClear={clear('phone2')}>
              <input id="ks-r-phone2" className="inp" type="tel" dir="ltr" inputMode="tel" {...nf('phone2')} data-agy-id="reg_phone2_input" aria-invalid={bad('phone2') ? 'true' : undefined} value={form.phone2} onChange={set('phone2')} />
            </RegField>
          ) : null}
          <RegField id="ks-r-mail" label={`אימייל${req(eff.require_customer_email === 'true')}`} icon="mail" bad={bad('email')} msg={fieldMsg('email')} value={form.email} onClear={clear('email')}>
            <input id="ks-r-mail" className="inp" type="email" dir="ltr" inputMode="email" {...nf('email')} data-agy-id="reg_email_input" aria-invalid={bad('email') ? 'true' : undefined} value={form.email} onChange={set('email')} />
          </RegField>
          <RegField id="ks-r-city" label={`עיר מגורים${req(needFullAddress)}`} icon="pin" bad={bad('city')} msg={fieldMsg('city')} value={form.city} onClear={clear('city')}>
            <input id="ks-r-city" className="inp" {...nf('city')} data-agy-id="reg_city_input" aria-invalid={bad('city') ? 'true' : undefined} value={form.city} onChange={set('city')} />
          </RegField>
          <RegField id="ks-r-street" label={`רחוב${req(needFullAddress)}`} icon="pin" bad={bad('street')} msg={fieldMsg('street')} value={form.street} onClear={clear('street')}>
            <input id="ks-r-street" className="inp" {...nf('street')} data-agy-id="reg_street_input" aria-invalid={bad('street') ? 'true' : undefined} value={form.street} onChange={set('street')} />
          </RegField>
          <RegField id="ks-r-house" label={`מספר בית${req(needFullAddress)}`} icon="home" bad={bad('houseNum')} msg={fieldMsg('houseNum')} value={form.houseNum} onClear={clear('houseNum')}>
            <input id="ks-r-house" className="inp" inputMode="numeric" {...nf('houseNum')} data-agy-id="reg_houseNum_input" aria-invalid={bad('houseNum') ? 'true' : undefined} value={form.houseNum} onChange={set('houseNum')} />
          </RegField>
        </div>

        {/* honeypot (נקודת חיבור לשרת: השדה website): אדם לא רואה ולא ממלא; בוט שממלא מקבל "הצלחה" ושום דבר לא נשמר */}
        <div className="ks-hp" aria-hidden="true">
          <label htmlFor="ks-r-website">אתר</label>
          <input id="ks-r-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
        </div>

        <div className="ks-consent ks-col">
          <SwitchRow id="ks-terms" agy="reg_terms_switch" label="חתמ/ה על התקנון" checked={form.acceptedTerms} bad={bad('acceptedTerms')}
            onChange={(v) => setForm((p) => ({ ...p, acceptedTerms: v }))}
            hint={form.acceptedTerms ? 'סומן: חתמת על התקנון.' : 'כבוי = עדיין לא חתמת. אפשר לחתום על התקנון גם אצל העובדת.'}>
            <button type="button" className="ks-link" data-agy-id="kiosk_view_terms_btn" onClick={() => setDoc('terms')}><KIcon id="file" size="sm" />צפייה בתקנון</button>
          </SwitchRow>
          {showMarketing ? (
            <SwitchRow id="ks-mkt" agy="reg_marketing_switch" label={`מאשר/ת קבלת דיוורים${req(eff.require_marketing_consent === 'true')}`} checked={form.marketingConsent} bad={bad('marketingConsent')}
              onChange={(v) => setForm((p) => ({ ...p, marketingConsent: v }))}
              hint={form.marketingConsent ? 'סומן: מאשר/ת קבלת עדכונים והודעות מהגמ"ח.' : 'כבוי = לא מאשר/ת קבלת דיוורים. אפשר לשנות בכל עת.'} />
          ) : null}
          <SwitchRow id="ks-priv" agy="reg_privacy_input" label="אישרתי את מדיניות הפרטיות *" checked={form.acceptedPrivacy} bad={bad('acceptedPrivacy')}
            onChange={(v) => setForm((p) => ({ ...p, acceptedPrivacy: v }))}
            hint="חובה לאשר את מדיניות הפרטיות כדי לשמור את הפרטים.">
            <button type="button" className="ks-link" data-agy-id="kiosk_view_privacy_btn" onClick={() => setDoc('privacy')}><KIcon id="shield" size="sm" />מדיניות פרטיות</button>
          </SwitchRow>
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
