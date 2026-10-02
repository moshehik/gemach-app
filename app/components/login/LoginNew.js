'use client';

// דף הכניסה החדש - העיצוב המאושר (תצוגות-עיצוב\סיימתי-לעבוד\login-page.html) על רכיבי הפלטה, לפי
// החלטות הבעלים 1.10.2026 (L01-L17, Q01-Q09, LQ-01..07). הלוגיקה הטהורה ב-lib/loginFlow.js (נבדקת
// ב-scripts/test_login_logic.mjs); כאן רק התצוגה והקריאות לשרת.
//
//   L01/Q07/LQ-05  שדה עובד: בחירה מהרשימה וגם הקלדה שמסננת; שם שלא ברשימה = "לא נמצא עובד בשם הזה"
//   L02/Q08/G09    מחשב מהימן: תג ירוק + קוד מקוצר של 4 תווים (השרת מכבד אותו רק עם עוגיית trusted_device)
//   L03/L04/L05/L15 חלונות כהים: שכחתי סיסמה, סיסמה חדשה (חובה), הודעות שלא טופלו, משמרת פתוחה מאתמול
//   L06            הכניסה כחלון (isModal) וחזרה לאותו דף (reload / ?returnTo פנימי בלבד)
//   L07            "רק לרישום כניסה / יציאה למשמרת? לחצו כאן" -> /punch-clock
//   L09/L17        "זכור אותי במכשיר הזה" - לא מוצג במחשב משותף (יותר מ-3 עובדים שונים; השרת מכריע)
//   L10            ברכה "בוקר טוב / ערב טוב" לפי שעון ישראל
//   L11/LQ-06/LQ-07 פס עליון: לוגו + שם הגמ"ח (+ תגית לפי הארגון), בלי "עזרה בכניסה"
//   L12/G01/G03    עין להצגת/הסתרת הסיסמה
//   L13            רקע: תמונת עלי הכותרת של האתר (public/design-system/home-bg.jpg, מחלקת home-bg של הפלטה)
//   L14/Q01-Q05/Q09 מתג "רשום לי התחלת עבודה אוטומטית בכניסה" + "נרשמה התחלת עבודה ב-HH:MM"
//
// האייקונים: הספרייה המוטמעת של הפלטה (MenuSprite, #gmi-*) + סמל מקומי אחד שחסר בה (עין חצויה, G01).
// לא <use href="/design-system/sprite.svg#..."> - מסנני תוכן מחליפים קובצי תמונה (ר' menuParts.js).

import '@/design-system/components.css';
import './login.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { MenuSprite } from '../menu/menuParts';
import { readAutoClockMirror, writeAutoClockMirror } from './AutoClockSwitch';
import {
  greetingNow, sanitizeReturnPath, validateLoginForm, filterEmployees, matchEmployeeByName, employeeDisplayName,
  LOGIN_MESSAGES, PREVIOUS_SHIFT_MESSAGES, SHIFT_ACTION, punchInMessage, doneTitle, unreadMessagesText,
} from '@/lib/loginFlow';

const PLACEHOLDER_USER = 'בחרו מהרשימה או הקלידו חלק מהשם';
const PLACEHOLDER_PASS = 'הקלידו את הסיסמה';
const DONE_PANEL_MS = 1800;

function I({ n, sm = false }) {
  const local = n === 'eyeoff';
  return (
    <svg className={`ic${sm ? ' sm' : ''}`} aria-hidden="true" focusable="false">
      <use href={local ? `#gml-${n}` : `#gmi-${n}`} />
    </svg>
  );
}

/** סמלים שחסרים בספריית הפלטה (G01 עין חצויה), מוטמעים בדף. */
function LocalSprite() {
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

function Highlight({ text, query }) {
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

export default function LoginNew({ isModal = false, onClose, brand }) {
  const [mounted, setMounted] = useState(false);
  const [greeting, setGreeting] = useState('');

  // רשימת העובדים (אותו מקור כמו המסך הישן: GET /api/employees - שמות ומזהים בלבד לאורח)
  const [employees, setEmployees] = useState([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [userText, setUserText] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const cbxRef = useRef(null);
  const userInputRef = useRef(null);
  const passInputRef = useRef(null);

  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [pinMode, setPinMode] = useState(false);

  const [trusted, setTrusted] = useState(false);
  const [shared, setShared] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [autoClock, setAutoClock] = useState(false);
  const [autoTouched, setAutoTouched] = useState(false);

  const [error, setError] = useState(null); // { field, message }
  const [loading, setLoading] = useState(false);

  // אחרי הכניסה: שרשרת צעדים (סיסמה חדשה -> משמרת מאתמול -> מסך סיום -> הודעות -> מעבר לדף)
  const loginRef = useRef(null);
  const stepsRef = useRef([]);
  const outcomeRef = useRef({});
  const [dialog, setDialog] = useState(null); // 'forgot' | 'reset' | 'previous' | 'notify'
  const [done, setDone] = useState(null); // { title, clk, note }

  const [forgotSending, setForgotSending] = useState(false);
  const [forgotResult, setForgotResult] = useState(null);
  const [np1, setNp1] = useState('');
  const [np2, setNp2] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [prevTime, setPrevTime] = useState('');
  const [prevPrompt, setPrevPrompt] = useState('');
  const [prevError, setPrevError] = useState('');
  const [prevSaving, setPrevSaving] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dialogRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    setGreeting(greetingNow());
    const t = setInterval(() => setGreeting(greetingNow()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchSharedJson('/api/employees', { ttl: TTL.STATIC })
      .then((data) => { if (Array.isArray(data)) setEmployees(data); })
      .catch((err) => console.error('Failed to load employees:', err))
      .finally(() => setListLoaded(true));
    fetch('/api/auth/device-status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setTrusted(!!d.trusted);
        setPinMode(!!d.trusted);
        setShared(!!d.shared);
      })
      .catch(() => {});
  }, []);

  // סגירת הרשימה בלחיצה מחוץ לשדה
  useEffect(() => {
    const onDown = (e) => { if (cbxRef.current && !cbxRef.current.contains(e.target)) setListOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (dialog && dialogRef.current) {
      const first = dialogRef.current.querySelector('input, button');
      try { (first || dialogRef.current).focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }, [dialog]);

  const selectedEmployee = useMemo(() => employees.find((e) => e.id === selectedId) || null, [employees, selectedId]);
  const filtered = useMemo(() => {
    // כשהשדה מציג את השם שנבחר - הרשימה המלאה (כמו במסך הישן), אחרת סינון לפי ההקלדה
    const showingSelected = selectedEmployee && userText.trim() === employeeDisplayName(selectedEmployee);
    return showingSelected ? employees : filterEmployees(employees, userText);
  }, [employees, userText, selectedEmployee]);

  const resolveEmployee = () => selectedEmployee || matchEmployeeByName(employees, userText);

  // המתג "רישום אוטומטי": העובד עדיין לא מזוהה, ולכן השדה משקף רק עותק מקומי בדפדפן; השרת מחליט לפי
  // ההעדפה השמורה שלו (Q04), ושינוי מפורש כאן נשלח ונשמר (Q01).
  const pick = (emp) => {
    setSelectedId(emp.id);
    setUserText(employeeDisplayName(emp));
    setListOpen(false);
    setActiveIdx(-1);
    setError(null);
    const mirror = readAutoClockMirror(emp.id);
    setAutoClock(mirror === true);
    setAutoTouched(false);
    setTimeout(() => passInputRef.current && passInputRef.current.focus(), 0);
  };

  const onUserChange = (e) => {
    setUserText(e.target.value);
    setSelectedId('');
    setListOpen(true);
    setActiveIdx(-1);
    if (error && error.field === 'user') setError(null);
  };

  const onUserKey = (e) => {
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

  const togglePin = () => {
    setPinMode((v) => !v);
    setPassword('');
    setPin('');
    setError(null);
  };

  // ---- אחרי הכניסה ----
  const navigateAfterLogin = () => {
    // רענון מלא ולא router.refresh: הסרגל/תפריט המשתמש מיושרים לעובד רק בטעינה נקייה. הכתובת לא השתנתה
    // (הכניסה מוצגת במקום הדף שהתבקש) ולכן reload חוזר לאותו דף. ?returnTo - נתיב פנימי בלבד.
    try {
      const target = sanitizeReturnPath(new URLSearchParams(window.location.search).get('returnTo'));
      if (target) { window.location.assign(target); return; }
    } catch (e) { /* ignore */ }
    window.location.reload();
  };

  // פונקציה רגילה (לא useCallback): קוראת לעצמה מתוך setTimeout/promise וקוראת רק refs ו-setters יציבים.
  function advance() {
    const next = stepsRef.current.shift();
    const data = loginRef.current || {};
    const out = outcomeRef.current;
    if (!next || next === 'go') { navigateAfterLogin(); return; }
    if (next === 'reset') { setDialog('reset'); return; }
    if (next === 'previous') { setPrevTime(''); setPrevError(''); setPrevPrompt((data.shift && data.shift.previous && data.shift.previous.prompt) || ''); setDialog('previous'); return; }
    if (next === 'done') {
      setDialog(null);
      const clk = out.punchedInAt ? punchInMessage(out.punchedInAt) : '';
      const note = out.closedAt ? `יציאת אתמול נשמרה: ${out.closedAt}` : (out.note || '');
      if (!clk && !note) { advance(); return; }
      setDone({ title: doneTitle(data.employee), clk, note });
      setTimeout(() => advance(), DONE_PANEL_MS);
      return;
    }
    if (next === 'notify') {
      // L05: ההגדרה notify_on_new_message_at_login (כמו במסך הישן), עכשיו כחלון כהה במקום alert
      fetch('/api/settings', { cache: 'no-store' }).then((r) => r.json()).then((arr) => {
        const on = Array.isArray(arr) && arr.find((s) => s.key === 'notify_on_new_message_at_login')?.value === 'true';
        if (!on) { advance(); return; }
        return fetch('/api/notifications', { cache: 'no-store' }).then((r) => r.json()).then((nd) => {
          const unread = (nd.notifications || []).filter((x) => !x.isRead && !x.isArchived);
          if (unread.length > 0) { setUnreadCount(unread.length); setDone(null); setDialog('notify'); } else advance();
        });
      }).catch(() => advance());
    }
  }

  const startAfterLogin = (data) => {
    loginRef.current = data;
    outcomeRef.current = {};
    const shift = data.shift || {};
    if (shift.action === SHIFT_ACTION.PUNCH_IN) outcomeRef.current.punchedInAt = shift.punchedInAt;
    const steps = [];
    if (data.mustResetPassword) steps.push('reset');
    if (shift.action === SHIFT_ACTION.ASK_PREVIOUS && shift.previous) steps.push('previous');
    steps.push('done', 'notify', 'go');
    stepsRef.current = steps;
    advance();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setListOpen(false);
    const emp = resolveEmployee();
    const credential = pinMode ? pin : password;
    const invalid = validateLoginForm({ userText, employeeId: emp ? emp.id : null, credential, pinMode, listLoaded });
    if (invalid) {
      setError(invalid);
      (invalid.field === 'user' ? userInputRef : passInputRef).current?.focus();
      return;
    }
    if (!selectedId) setSelectedId(emp.id);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginPage: true, // סימון לשרת: דף הכניסה החדש (רישום מכשיר, משמרת אוטומטית, "זכור אותי") - המסך הישן והקיוסק לא שולחים אותו
          employeeId: emp.id,
          ...(pinMode ? { pin: credential } : { password: credential }),
          rememberMe: !shared && rememberMe,
          ...(autoTouched ? { autoClockIn: autoClock } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        writeAutoClockMirror(emp.id, !!data.autoClockIn);
        if (data.shared) setShared(true);
        startAfterLogin(data);
        return; // הטעינה נשארת עד המעבר לדף
      }
      // השרת עשוי להודיע שהקוד המקוצר לא זמין (המחשב לא מהימן / אין קוד) - חוזרים לסיסמה מלאה
      if (data.requireFullPassword) { setPinMode(false); setPin(''); }
      setError({ field: 'pass', message: data.message || LOGIN_MESSAGES.generic });
      setLoading(false);
    } catch (err) {
      setError({ field: 'pass', message: LOGIN_MESSAGES.network });
      setLoading(false);
    }
  };

  // ---- שכחתי סיסמה (L03) ----
  const openForgot = () => { setForgotResult(null); setDialog('forgot'); };
  const sendForgot = async () => {
    const emp = resolveEmployee();
    if (!emp) { setForgotResult({ success: false, message: LOGIN_MESSAGES.forgotNeedsEmployee }); return; }
    setForgotSending(true);
    setForgotResult(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: emp.id }),
      });
      const data = await res.json().catch(() => ({}));
      setForgotResult({ success: !!data.success, message: data.message || (data.success ? 'נשלח בהצלחה' : 'שליחה נכשלה') });
    } catch (err) {
      setForgotResult({ success: false, message: LOGIN_MESSAGES.network });
    } finally {
      setForgotSending(false);
    }
  };

  // ---- סיסמה חדשה אחרי סיסמה זמנית (L04) ----
  const saveNewPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!np1 || np1.length < 4) { setResetError(LOGIN_MESSAGES.resetTooShort); return; }
    if (np1 !== np2) { setResetError(LOGIN_MESSAGES.resetMismatch); return; }
    setResetSaving(true);
    try {
      const id = loginRef.current?.employee?.id;
      const res = await fetch(`/api/employees/${id}/password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: np1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) { setNp1(''); setNp2(''); setDialog(null); advance(); } else setResetError(data.message || 'שגיאה בשמירת הסיסמה');
    } catch (err) {
      setResetError(LOGIN_MESSAGES.network);
    } finally {
      setResetSaving(false);
    }
  };

  // ---- משמרת פתוחה מאתמול (L15, Q03, LQ-02) ----
  const closePrevious = async (leaveOpen) => {
    setPrevError('');
    if (!leaveOpen && !prevTime) { setPrevError(PREVIOUS_SHIFT_MESSAGES.missingTime); return; }
    setPrevSaving(true);
    try {
      const prev = loginRef.current?.shift?.previous || {};
      const res = await fetch('/api/attendance/previous-shift', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveOpen ? { shiftId: prev.id, leaveOpen: true } : { shiftId: prev.id, exitTime: prevTime }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) { setPrevError(data.message || 'השמירה נכשלה'); return; }
      if (data.closed) outcomeRef.current.closedAt = data.closedAt;
      if (data.punchedIn) outcomeRef.current.punchedInAt = data.punchedInAt;
      if (data.note) outcomeRef.current.note = data.note;
      setDialog(null);
      advance();
    } catch (err) {
      setPrevError(LOGIN_MESSAGES.network);
    } finally {
      setPrevSaving(false);
    }
  };

  // ---- תצוגה ----
  const brandName = (brand && brand.name) || 'גמ״ח שמלות';
  const brandTag = (brand && brand.tag) || '';
  const [logoOk, setLogoOk] = useState(true);
  const showLogo = !!(brand && brand.hasLogo) && logoOk;

  const userInvalid = error && error.field === 'user';
  const passInvalid = error && error.field === 'pass';

  const formBody = done ? (
    <div className="done" role="status">
      <span className="ok"><I n="check" /></span>
      <h2>{done.title}</h2>
      {done.clk ? <div className="clk"><I n="clock" sm /><span>{done.clk}</span></div> : null}
      {done.note ? <div className="clk note"><I n="info" sm /><span>{done.note}</span></div> : null}
      <p>מעבירים אותך למערכת…</p>
    </div>
  ) : (
    <>
      {trusted ? <div className="lg-trusted"><I n="shield" sm />מחשב זה מוגדר כמערכת מהימנה</div> : null}
      <form className="lg-form" noValidate autoComplete="off" onSubmit={handleSubmit}>
        {error ? (
          <div className="msg" role="alert"><I n="alert" /><span>{error.message}</span></div>
        ) : null}

        <div className="field">
          <label className="lbl" htmlFor="lg-user">שם עובד</label>
          <div className="ctl cbx" ref={cbxRef}>
            <I n="user" />
            <input
              ref={userInputRef}
              className="inp"
              id="lg-user"
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={listOpen ? 'true' : 'false'}
              aria-controls="lg-userList"
              aria-invalid={userInvalid ? 'true' : undefined}
              aria-activedescendant={listOpen && activeIdx >= 0 && filtered[activeIdx] ? `lg-uo-${filtered[activeIdx].id}` : undefined}
              // "new-password" ולא "off": כרום מתעלם מ-off ומציג dropdown משלו מעל הרשימה (דיווח 2a4a2af4)
              autoComplete="new-password"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={listLoaded ? PLACEHOLDER_USER : LOGIN_MESSAGES.loading}
              value={userText}
              onChange={onUserChange}
              onFocus={() => setListOpen(true)}
              onClick={() => setListOpen(true)}
              onKeyDown={onUserKey}
            />
            <button
              type="button"
              className="cbx-t"
              aria-label="פתיחת רשימת העובדים"
              aria-expanded={listOpen ? 'true' : 'false'}
              aria-controls="lg-userList"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { if (listOpen) setListOpen(false); else { userInputRef.current?.focus(); setListOpen(true); } }}
            >
              <I n="chev" />
            </button>
            {listOpen ? (
              <ul className="cbx-l" id="lg-userList" role="listbox" aria-label="עובדים" onMouseDown={(e) => e.preventDefault()}>
                {!listLoaded ? (
                  <li className="cbx-n" role="presentation">{LOGIN_MESSAGES.loading}</li>
                ) : filtered.length ? filtered.map((emp, i) => {
                  const name = employeeDisplayName(emp);
                  return (
                    <li
                      key={emp.id}
                      id={`lg-uo-${emp.id}`}
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
        </div>

        <div className="field">
          <div className="lblrow">
            <label className="lbl" htmlFor="lg-pass">{pinMode ? '4 התווים האחרונים בסיסמה' : 'סיסמה'}</label>
            {trusted ? (
              <button type="button" className="pinbtn" onClick={togglePin}>
                {pinMode ? 'השתמש בסיסמה המלאה' : 'השתמש בקוד מקוצר (4 תווים)'}
              </button>
            ) : null}
          </div>
          <div className="ctl">
            <I n="lock" />
            {pinMode ? (
              <input
                ref={passInputRef}
                className="inp pin has-end"
                id="lg-pass"
                type={showPass ? 'text' : 'password'}
                maxLength={4}
                placeholder="••••"
                autoComplete="new-password"
                aria-invalid={passInvalid ? 'true' : undefined}
                value={pin}
                onChange={(e) => { setPin(e.target.value.slice(0, 4)); if (passInvalid) setError(null); }}
              />
            ) : (
              <input
                ref={passInputRef}
                className="inp has-end"
                id="lg-pass"
                type={showPass ? 'text' : 'password'}
                placeholder={PLACEHOLDER_PASS}
                autoComplete="new-password"
                aria-invalid={passInvalid ? 'true' : undefined}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passInvalid) setError(null); }}
              />
            )}
            <button
              type="button"
              className="eye"
              aria-label={showPass ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
              aria-pressed={showPass ? 'true' : 'false'}
              onClick={() => { setShowPass((v) => !v); passInputRef.current?.focus(); }}
            >
              <I n={showPass ? 'eyeoff' : 'eye'} />
            </button>
          </div>
          <button type="button" className="forgot" onClick={openForgot}>שכחתי סיסמה</button>
        </div>

        {!shared ? (
          <div className="row">
            <label className="chk">
              <input type="checkbox" role="switch" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              <span className="sw" aria-hidden="true" />
              זכור אותי במכשיר הזה
            </label>
          </div>
        ) : null}

        <div className="auto">
          <label className="chk">
            <input
              type="checkbox"
              role="switch"
              checked={autoClock}
              onChange={(e) => { setAutoClock(e.target.checked); setAutoTouched(true); }}
            />
            <span className="sw" aria-hidden="true" />
            <span className="tx">רשום לי התחלת עבודה אוטומטית בכניסה</span>
          </label>
        </div>

        <button className="gbtn" type="submit" disabled={loading}>
          {loading ? <span className="spin" aria-hidden="true" /> : null}
          <span>{loading ? 'נכנסים…' : 'כניסה'}</span>
        </button>
      </form>
      {!isModal ? (
        <div className="punch">
          <a href="/punch-clock">
            <I n="clock" sm />
            <span>רק לרישום כניסה / יציאה למשמרת, בלי להיכנס למערכת? <u>לחצו כאן</u></span>
          </a>
        </div>
      ) : null}
    </>
  );

  const forgotName = (() => { const emp = resolveEmployee(); return emp ? employeeDisplayName(emp) : ''; })();

  const dialogs = dialog ? (
    <div
      className="scrim on lg-dscrim"
      onClick={(e) => { if (dialog === 'forgot' && e.target === e.currentTarget) setDialog(null); }}
      onKeyDown={(e) => {
        // Escape סוגר רק את "שכחתי סיסמה" (שאר החלונות הם חובה, כמו בעיצוב); Tab נשאר בתוך החלון (focus trap)
        if (e.key === 'Escape' && dialog === 'forgot') { setDialog(null); return; }
        if (e.key === 'Tab' && dialogRef.current) {
          const items = [...dialogRef.current.querySelectorAll('input, button, [tabindex="0"]')].filter((el) => !el.disabled && el.offsetParent !== null);
          if (!items.length) { e.preventDefault(); return; }
          const first = items[0]; const last = items[items.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }}
    >
      <div className="dlg dk" role="dialog" aria-modal="true" aria-labelledby="lg-dlg-t" tabIndex={-1} ref={dialogRef}>
        {dialog === 'forgot' ? (
          <>
            <div className="dbadge"><I n="mail" /></div>
            <h2 id="lg-dlg-t">שכחתי סיסמה</h2>
            <div className="sub">
              תישלח סיסמה זמנית לכתובת המייל השמורה במערכת עבור העובד שנבחר (<bdi>{forgotName || 'לא נבחר עובד'}</bdi>). לאחר ההתחברות עם הסיסמה הזמנית תתבקש/י להגדיר סיסמה חדשה.
            </div>
            {forgotResult ? (
              <div className={`msg${forgotResult.success ? ' ok' : ''}`} role="status">
                <I n={forgotResult.success ? 'check' : 'alert'} /><span>{forgotResult.message}</span>
              </div>
            ) : null}
            <div className="dbtns">
              <div className="r2">
                <button type="button" className="ghost" onClick={() => setDialog(null)}>סגור</button>
                <button type="button" className="gbtn" disabled={forgotSending} onClick={sendForgot}>
                  {forgotSending ? <span className="spin" aria-hidden="true" /> : null}
                  {forgotSending ? 'שולח…' : 'שלח סיסמה זמנית'}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {dialog === 'reset' ? (
          <>
            <div className="dbadge"><I n="shield" /></div>
            <h2 id="lg-dlg-t">יש להגדיר סיסמה חדשה</h2>
            <div className="sub">התחברת עם סיסמה זמנית. יש להגדיר סיסמה קבועה חדשה כדי להמשיך.</div>
            {resetError ? <div className="msg" role="alert"><I n="alert" /><span>{resetError}</span></div> : null}
            <form className="dform" noValidate onSubmit={saveNewPassword}>
              <div className="field">
                <label className="lbl" htmlFor="lg-np1">סיסמה חדשה</label>
                <div className="ctl"><I n="lock" /><input className="inp" id="lg-np1" type="password" autoComplete="new-password" value={np1} onChange={(e) => setNp1(e.target.value)} /></div>
              </div>
              <div className="field">
                <label className="lbl" htmlFor="lg-np2">אימות סיסמה חדשה</label>
                <div className="ctl"><I n="lock" /><input className="inp" id="lg-np2" type="password" autoComplete="new-password" value={np2} onChange={(e) => setNp2(e.target.value)} /></div>
              </div>
              <button type="submit" className="gbtn" disabled={resetSaving}>{resetSaving ? 'שומר…' : 'שמור והמשך'}</button>
            </form>
          </>
        ) : null}

        {dialog === 'previous' ? (
          <>
            <div className="dbadge"><I n="clock" /></div>
            <h2 id="lg-dlg-t">לא נרשמה יציאה אתמול</h2>
            <div className="sub">{prevPrompt || 'המשמרת הקודמת עדיין פתוחה. באיזו שעה סיימת?'}</div>
            {prevError ? <div className="msg" role="alert"><I n="alert" /><span>{prevError}</span></div> : null}
            <form className="dform" noValidate onSubmit={(e) => { e.preventDefault(); closePrevious(false); }}>
              <div className="field">
                <label className="lbl" htmlFor="lg-ytime">שעת סיום המשמרת של אתמול</label>
                <div className="ctl"><I n="clock" /><input className="inp" id="lg-ytime" type="time" value={prevTime} onChange={(e) => { setPrevTime(e.target.value); setPrevError(''); }} /></div>
              </div>
              <div className="dbtns">
                <button type="submit" className="gbtn" disabled={prevSaving}>{prevSaving ? 'שומר…' : 'שמור והמשך'}</button>
                <button type="button" className="ghost" disabled={prevSaving} onClick={() => closePrevious(true)}>לא זוכר/ת, להשאיר פתוחה</button>
              </div>
            </form>
          </>
        ) : null}

        {dialog === 'notify' ? (
          <>
            <div className="dbadge"><I n="bell" /></div>
            <h2 id="lg-dlg-t">הודעות שלא טופלו</h2>
            <div className="sub">{unreadMessagesText(unreadCount)}</div>
            <div className="dbtns">
              <button type="button" className="gbtn" onClick={() => { setDialog(null); advance(); }}>הבנתי</button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  ) : null;

  const sprites = (
    <>
      <MenuSprite />
      <LocalSprite />
    </>
  );

  if (isModal) {
    const modal = (
      <div className="gm-ds gm-login is-modal" dir="rtl">
        {sprites}
        <div className="scrim on" onClick={(e) => { if (onClose && e.target === e.currentTarget) onClose(false); }}>
          <div className="mdl" role="dialog" aria-modal="true" aria-label="כניסת עובדים">
            <div className="mhead">
              <strong><I n="lock" />כניסת עובדים</strong>
              {onClose ? (
                <button type="button" className="mx" aria-label="סגירה" title="סגירה" onClick={() => onClose(false)}><I n="x" /></button>
              ) : null}
            </div>
            <p className="msub">נא להזדהות על מנת להמשיך למערכת</p>
            <section className="card lg-card">{formBody}</section>
          </div>
        </div>
        {dialogs}
      </div>
    );
    // לפני ה-mount אין document.body ל-portal (SSR) - מרנדרים במקום
    if (!mounted) return modal;
    return createPortal(modal, document.body);
  }

  return (
    <div className="gm-ds gm-login home-bg" dir="rtl">
      {sprites}
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
      <main className="lg-stage">
        <div className="lg-wrap">
          <div className="lg-hero">
            <h1 id="lg-ttl">{greeting}</h1>
            <p>כניסה למערכת הגמ״ח</p>
          </div>
          <section className="card lg-card" aria-labelledby="lg-ttl">{formBody}</section>
        </div>
      </main>
      {dialogs}
    </div>
  );
}
