'use client';

// חלקים משותפים לדף הכניסה (LoginNew.js) ולשעון הנוכחות בעיצוב החדש (PunchClockNew.js): האייקונים, הפס העליון,
// שדה בחירת העובד (בחירה מהרשימה + הקלדה שמסננת), שדה הסיסמה עם העין, והחלון הכהה. הוצאו מ-LoginNew.js כמו שהם
// (אותו markup, אותן מחלקות, אותו סדר עדכוני state) כדי ששני הדפים לא יסטו זה מזה; ההתנהגות של דף הכניסה לא השתנתה.
// ה-CSS: login.css (היקף .gm-ds.gm-login) - שום כלל חדש כאן.

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { MenuSprite } from '../menu/menuParts';
import { filterEmployees, employeeDisplayName, LOGIN_MESSAGES } from '@/lib/loginFlow';

export const PLACEHOLDER_USER = 'בחרו מהרשימה או הקלידו חלק מהשם';
export const PLACEHOLDER_PASS = 'הקלידו את הסיסמה';

export function I({ n, sm = false }) {
  const local = n === 'eyeoff';
  return (
    <svg className={`ic${sm ? ' sm' : ''}`} aria-hidden="true" focusable="false">
      <use href={local ? `#gml-${n}` : `#gmi-${n}`} />
    </svg>
  );
}

/** סמלים שחסרים בספריית הפלטה (G01 עין חצויה), מוטמעים בדף. */
export function LocalSprite() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="gml-eyeoff" viewBox="0 0 24 24">
          <path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </symbol>
      </defs>
    </svg>
  );
}

/** ספריית האייקונים של הפלטה (#gmi-*) + הסמל המקומי (#gml-eyeoff), מוטמעים בדף - לא קובץ sprite.svg חיצוני. */
export function LoginSprites() {
  return (
    <>
      <MenuSprite />
      <LocalSprite />
    </>
  );
}

export function Highlight({ text, query }) {
  const q = (query || '').trim();
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}
    </>
  );
}

/** הפס העליון (L11): לוגו + שם הגמ"ח (+ תגית לפי הארגון), בלי ניווט. brand = { name, tag, hasLogo } מ-app/layout.js. */
export function LoginBar({ brand }) {
  const brandName = (brand && brand.name) || 'גמ״ח שמלות';
  const brandTag = (brand && brand.tag) || '';
  const [logoOk, setLogoOk] = useState(true);
  const showLogo = !!(brand && brand.hasLogo) && logoOk;
  return (
    <header className="snav lg-bar" role="banner">
      <div className="sn-brand" aria-label={brandName}>
        <span className={`sn-mark${showLogo ? ' ph' : ''}`}>
          {showLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/api/logo" alt="לוגו הארגון" onError={() => setLogoOk(false)} />
            : <I n="dress" />}
        </span>
        <span className="sn-name">{brandName}</span>
        {brandTag ? <span className="sn-tag">{brandTag}</span> : null}
      </div>
    </header>
  );
}

const DEFAULT_IDS = { input: 'lg-user', list: 'lg-userList', option: 'lg-uo-' };

/**
 * שדה בחירת העובד (L01/Q07/LQ-05): בחירה מהרשימה וגם הקלדה שמסננת. הטקסט והעובד שנבחר שייכים להורה (מקור האמת
 * של הטופס); הרשימה הפתוחה והשורה המסומנת במקלדת פנימיים. ref: { close() } - הטופס סוגר את הרשימה בשליחה.
 * @param {{ employees: Array, listLoaded: boolean, userText: string, selectedId: string, invalid?: boolean,
 *   onTextChange: (value: string) => void, onPick: (emp: object) => void, inputRef?: object, ids?: object }} props
 */
export const EmployeeCombobox = forwardRef(function EmployeeCombobox(
  { employees, listLoaded, userText, selectedId, invalid = false, onTextChange, onPick, inputRef, ids = DEFAULT_IDS },
  ref,
) {
  const [listOpen, setListOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const cbxRef = useRef(null);
  const ownInputRef = useRef(null);
  const userInputRef = inputRef || ownInputRef;

  useImperativeHandle(ref, () => ({ close: () => setListOpen(false) }), []);

  // סגירת הרשימה בלחיצה מחוץ לשדה
  useEffect(() => {
    const onDown = (e) => { if (cbxRef.current && !cbxRef.current.contains(e.target)) setListOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const selectedEmployee = useMemo(() => employees.find((e) => e.id === selectedId) || null, [employees, selectedId]);
  const filtered = useMemo(() => {
    // כשהשדה מציג את השם שנבחר - הרשימה המלאה (כמו במסך הישן), אחרת סינון לפי ההקלדה
    const showingSelected = selectedEmployee && userText.trim() === employeeDisplayName(selectedEmployee);
    return showingSelected ? employees : filterEmployees(employees, userText);
  }, [employees, userText, selectedEmployee]);

  const pick = (emp) => {
    setListOpen(false);
    setActiveIdx(-1);
    onPick(emp);
  };

  const onChange = (e) => {
    onTextChange(e.target.value);
    setListOpen(true);
    setActiveIdx(-1);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!listOpen) setListOpen(true);
      if (!filtered.length) return;
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIdx((cur) => (cur + d + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' && listOpen && activeIdx >= 0 && filtered[activeIdx]) {
      e.preventDefault();
      pick(filtered[activeIdx]);
    } else if (e.key === 'Escape' && listOpen) {
      e.stopPropagation();
      setListOpen(false);
    } else if (e.key === 'Tab') {
      setListOpen(false);
    }
  };

  return (
    <div className="ctl cbx" ref={cbxRef}>
      <I n="user" />
      <input
        ref={userInputRef}
        className="inp"
        id={ids.input}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listOpen ? 'true' : 'false'}
        aria-controls={ids.list}
        aria-invalid={invalid ? 'true' : undefined}
        aria-activedescendant={listOpen && activeIdx >= 0 && filtered[activeIdx] ? `${ids.option}${filtered[activeIdx].id}` : undefined}
        // "new-password" ולא "off": כרום מתעלם מ-off ומציג dropdown משלו מעל הרשימה (דיווח 2a4a2af4)
        autoComplete="new-password"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={listLoaded ? PLACEHOLDER_USER : LOGIN_MESSAGES.loading}
        value={userText}
        onChange={onChange}
        onFocus={() => setListOpen(true)}
        onClick={() => setListOpen(true)}
        onKeyDown={onKey}
      />
      {listOpen ? (
        <ul className="cbx-l" id={ids.list} role="listbox" aria-label="עובדים" onMouseDown={(e) => e.preventDefault()}>
          {!listLoaded ? (
            <li className="cbx-n" role="presentation">{LOGIN_MESSAGES.loading}</li>
          ) : filtered.length ? filtered.map((emp, i) => {
            const name = employeeDisplayName(emp);
            return (
              <li
                key={emp.id}
                id={`${ids.option}${emp.id}`}
                role="option"
                className={`cbx-o${i === activeIdx ? ' act' : ''}`}
                aria-selected={emp.id === selectedId ? 'true' : 'false'}
                onClick={() => pick(emp)}
              >
                <I n="user" sm /><span><Highlight text={name} query={selectedEmployee ? '' : userText} /></span>
              </li>
            );
          }) : (
            <li className="cbx-n" role="presentation">{LOGIN_MESSAGES.listEmpty}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
});

/**
 * שדה הסיסמה עם כפתור העין (L12/G01/G03). pin = שדה הקוד המקוצר (4 תווים, מרווח אותיות רחב).
 * @param {{ id: string, value: string, onChange: (e: object) => void, inputRef?: object, placeholder?: string,
 *   invalid?: boolean, pin?: boolean, showPass: boolean, onToggle: () => void }} props
 */
export function PasswordField({ id, value, onChange, inputRef, placeholder, invalid = false, pin = false, showPass, onToggle }) {
  return (
    <div className="ctl">
      <I n="lock" />
      <input
        ref={inputRef}
        className={`inp${pin ? ' pin' : ''} has-end`}
        id={id}
        type={showPass ? 'text' : 'password'}
        maxLength={pin ? 4 : undefined}
        placeholder={placeholder}
        autoComplete="new-password"
        aria-invalid={invalid ? 'true' : undefined}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="eye"
        aria-label={showPass ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
        aria-pressed={showPass ? 'true' : 'false'}
        onClick={onToggle}
      >
        <I n={showPass ? 'eyeoff' : 'eye'} />
      </button>
    </div>
  );
}

/**
 * החלון הכהה (L03-L05, L15): מעטפת + חלון עם focus trap. Escape סוגר רק כש-onEscape מוגדר (שאר החלונות חובה).
 * focusKey: כשהוא משתנה (חלון אחר באותה מעטפת) הפוקוס עובר לשדה/כפתור הראשון בחלון.
 * @param {{ labelledBy?: string, focusKey?: any, onEscape?: () => void, onBackdrop?: () => void, children: any }} props
 */
export function DarkDialog({ labelledBy = 'lg-dlg-t', focusKey, onEscape, onBackdrop, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (dialogRef.current) {
      const first = dialogRef.current.querySelector('input, button');
      try { (first || dialogRef.current).focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }, [focusKey]);

  const onKeyDown = useCallback((e) => {
    // Tab נשאר בתוך החלון (focus trap)
    if (e.key === 'Escape' && onEscape) { onEscape(); return; }
    if (e.key === 'Tab' && dialogRef.current) {
      const items = [...dialogRef.current.querySelectorAll('input, button, [tabindex="0"]')].filter((el) => !el.disabled && el.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onEscape]);

  return (
    <div
      className="scrim on lg-dscrim"
      onClick={(e) => { if (onBackdrop && e.target === e.currentTarget) onBackdrop(); }}
      onKeyDown={onKeyDown}
    >
      <div className="dlg dk" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={dialogRef}>
        {children}
      </div>
    </div>
  );
}
