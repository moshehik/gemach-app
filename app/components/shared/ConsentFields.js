'use client';

// ConsentFields - שלוש ההסכמות המפורשות של לקוחה, כרכיב משותף: טפסי הרישום / העריכה של העובדים, וגם טופס הרישום בעמדת הלקוח (app/customer-interface).
//   1. "חתם/ה על התקנון"        - בחירה מפורשת כן / לא (ללא ברירת מחדל) + קישור לצפייה בתקנון (/terms)
//   2. "מאשר/ת קבלת דיוורים"    - בחירה מפורשת כן / לא (ללא ברירת מחדל) + הסבר + אפשרות הסרה; מוסתר לפי hide_marketing_consent_field
//   3. "אישרתי את מדיניות הפרטיות" - תיבת אישור + קישור לקריאת המדיניות (/privacy)
// מקלדת: Enter מקדם לשדה הבא ולעולם לא משנה בחירה (lib/enterNavigation.js - תואם useEnterNavigation); חצים / רווח / y,n,כ,ל בוחרים.
// הרכיב לא שומר כלום: הוא שולט בערכים דרך value/onChange; גוף הבקשה נבנה ב-withConsentBody (lib/consentForm.js) והשרת מאמת ורושם (lib/customerConsent.js).
//
// props:
//   value     {acceptedTerms: true|false|null, marketingConsent: true|false|null, acceptedPrivacy: boolean}
//   onChange  (patch) => void      patch חלקי, למשל {acceptedTerms: true}
//   settings  אובייקט key->value של ההגדרות (hide_marketing_consent_field, require_privacy_acceptance ...)
//   info      תשובת GET /api/public-consent-info (useConsentInfo) - קישורים וקיום קובץ תקנון; חסר = קישורי ברירת מחדל
//   isNew     טופס רישום (חובה לענות) או עריכה (רשות)
//   invalid   {terms, marketing, privacy} - להדגיש שדה שחסר
//   status    {terms, marketing, privacy} - שורת מצב קטנה לכל שדה (למשל "נרשם 12.10 בעמדה")
//   disabled  קריאה בלבד;  privacyLocked  אישור הפרטיות כבר נרשם - התיבה נעולה (אי אפשר "לבטל" אישור שנרשם, רק להציג)
//   idPrefix  קידומת מזהים (כמה מופעים בעמוד)
//   tone      'light' | 'dark' (ברירת מחדל: יורש מהקונטקסט)
import { useEffect, useId, useRef, useState } from 'react';
import { consentRequirements } from '@/lib/consentForm';
import './consent-fields.css';

const TERMS_LABEL = 'חתם/ה על התקנון';
const MARKETING_LABEL = 'מאשר/ת קבלת דיוורים';
const MARKETING_DETAIL = 'עדכונים והודעות שיווקיות מהגמ"ח, בדוא"ל ובהודעות. אפשר להסיר את ההסכמה בכל עת.';
const PRIVACY_LABEL = 'אישרתי את מדיניות הפרטיות';

let infoPromise = null;
let infoAt = 0;
/** מביא את GET /api/public-consent-info (מטמון קצר בדפדפן). info=null עד שנטען / בשגיאה (הרכיב ממשיך לעבוד עם קישורי ברירת מחדל). */
export function useConsentInfo(enabled = true) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    if (!infoPromise || Date.now() - infoAt > 30000) {
      infoAt = Date.now();
      infoPromise = fetch('/api/public-consent-info', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    }
    infoPromise.then((d) => { if (alive && d) setInfo(d); });
    return () => { alive = false; };
  }, [enabled]);
  return info;
}

function YesNo({ id, label, value, onChange, disabled, invalid, describedBy }) {
  const refs = [useRef(null), useRef(null)];
  const opts = [{ v: true, t: 'כן' }, { v: false, t: 'לא' }];
  const tabbable = value === true ? 0 : value === false ? 1 : 0;
  const pick = (i, focus) => { onChange(opts[i].v); if (focus && refs[i].current) refs[i].current.focus(); };
  const onKeyDown = (e, i) => {
    if (disabled) return;
    const k = e.key;
    // RTL: "כן" הוא הימני. ימינה / למעלה = כן, שמאלה / למטה = לא
    if (k === 'ArrowRight' || k === 'ArrowUp') { e.preventDefault(); pick(0, true); }
    else if (k === 'ArrowLeft' || k === 'ArrowDown') { e.preventDefault(); pick(1, true); }
    else if (k === ' ' || k === 'Spacebar') { e.preventDefault(); pick(i, false); }
    else if (k === 'y' || k === 'Y' || k === '1' || k === 'כ') { e.preventDefault(); pick(0, true); }
    else if (k === 'n' || k === 'N' || k === '0' || k === 'ל') { e.preventDefault(); pick(1, true); }
    // Enter: לא נוגעים - lib/enterNavigation.js מקדם לשדה הבא (ולא בוחר)
  };
  return (
    <div className={`cnf-yn${invalid ? ' cnf-bad' : ''}${value === null || value === undefined ? ' cnf-none' : ''}`} role="radiogroup" id={id} aria-labelledby={`${id}-lbl`} aria-describedby={describedBy} aria-invalid={invalid ? 'true' : undefined}>
      {opts.map((o, i) => (
        <button
          key={o.t}
          ref={refs[i]}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          tabIndex={disabled ? -1 : (i === tabbable ? 0 : -1)}
          disabled={disabled}
          className={`cnf-opt${value === o.v ? ' on' : ''}${o.v ? ' yes' : ' no'}`}
          onClick={() => pick(i, false)}
          onKeyDown={(e) => onKeyDown(e, i)}
          aria-label={`${label}: ${o.t}`}
        >{o.t}</button>
      ))}
    </div>
  );
}

function Row({ children, invalid, className = '' }) {
  return <div className={`cnf-row${invalid ? ' cnf-row-bad' : ''}${className ? ` ${className}` : ''}`}>{children}</div>;
}

export default function ConsentFields({ value, onChange, settings, info, isNew = false, invalid = {}, status = {}, disabled = false, privacyLocked = false, idPrefix, tone }) {
  const autoId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const p = idPrefix || `cnf${autoId}`;
  const req = consentRequirements(settings, { isNew });
  const v = value || {};
  const termsHref = (info && info.terms && info.terms.pageUrl) || '/terms';
  const privacyHref = (info && info.privacy && info.privacy.pageUrl) || '/privacy';
  const hasFile = info && info.terms ? !!info.terms.hasFile : null; // null = עוד לא נטען
  const star = (on) => (on ? <span className="cnf-req" aria-hidden="true"> *</span> : null);

  return (
    <div className={`cnf${tone ? ` cnf-${tone}` : ''}`} data-consent-fields="1">
      {req.showTerms ? (
        <Row invalid={invalid.terms}>
          <div className="cnf-txt">
            <span className="cnf-lbl" id={`${p}-terms-lbl`}>{TERMS_LABEL}{star(req.termsRequired)}</span>
            <span className="cnf-sub">
              {hasFile === false ? <span className="cnf-muted">אין עדיין קובץ תקנון בהגדרות</span>
                : <a className="cnf-link" href={termsHref} target="_blank" rel="noopener noreferrer" data-enter-skip="1">צפייה בתקנון</a>}
            </span>
            {status.terms ? <span className="cnf-st" id={`${p}-terms-st`}>{status.terms}</span> : null}
          </div>
          <YesNo id={`${p}-terms`} label={TERMS_LABEL} value={v.acceptedTerms === true ? true : v.acceptedTerms === false ? false : null} onChange={(x) => onChange({ acceptedTerms: x })} disabled={disabled} invalid={invalid.terms} describedBy={status.terms ? `${p}-terms-st` : undefined} />
        </Row>
      ) : null}

      {req.showMarketing ? (
        <Row invalid={invalid.marketing}>
          <div className="cnf-txt">
            <span className="cnf-lbl" id={`${p}-mkt-lbl`}>{MARKETING_LABEL}{star(req.marketingRequired || req.marketingMustBeYes)}</span>
            <span className="cnf-sub">{MARKETING_DETAIL}</span>
            {status.marketing ? <span className="cnf-st" id={`${p}-mkt-st`}>{status.marketing}</span> : null}
          </div>
          <YesNo id={`${p}-mkt`} label={MARKETING_LABEL} value={v.marketingConsent === true ? true : v.marketingConsent === false ? false : null} onChange={(x) => onChange({ marketingConsent: x })} disabled={disabled} invalid={invalid.marketing} describedBy={status.marketing ? `${p}-mkt-st` : undefined} />
        </Row>
      ) : null}

      {req.showPrivacy ? (
        <Row invalid={invalid.privacy} className="cnf-row-chk">
          <label className="cnf-chk" htmlFor={`${p}-priv`}>
            <input id={`${p}-priv`} type="checkbox" checked={!!v.acceptedPrivacy} disabled={disabled || privacyLocked} aria-invalid={invalid.privacy ? 'true' : undefined} aria-describedby={status.privacy ? `${p}-priv-st` : undefined} onChange={(e) => onChange({ acceptedPrivacy: e.target.checked })} />
            <span className="cnf-lbl">{PRIVACY_LABEL}{star(req.privacyRequired)}</span>
          </label>
          <a className="cnf-link" href={privacyHref} target="_blank" rel="noopener noreferrer" data-enter-skip="1">קריאת המדיניות</a>
          {status.privacy ? <span className="cnf-st" id={`${p}-priv-st`}>{status.privacy}</span> : null}
        </Row>
      ) : null}
    </div>
  );
}
