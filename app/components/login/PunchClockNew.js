'use client';

// שעון הנוכחות (/punch-clock) בעיצוב דף הכניסה החדש: אותו רקע, פס עליון, כרטיס, שדה עובד עם הקלדה, סיסמה עם עין,
// באנר שגיאה, חלון כהה ומסך אישור רגוע. ההתנהגות לא השתנתה: אותן קריאות (GET /api/employees, GET
// /api/auth/device-status, POST /api/attendance עם { employeeId, password, action }), אותה בדיקת "כובסת ביציאה",
// ואותו כלל קוד מקוצר (4 תווים) - השרת מכבד אותו רק במחשב מערכת מהימן; בשדה אחד, כמו קודם (בלי מצב קוד נפרד).
// ההכרעה כניסה/יציאה נשארת של השרת (lib/shiftPunch.js): שני הכפתורים שולחים IN / OUT והשרת מחזיר שגיאה
// ("כבר נרשמה כניסה", "לא נמצאה משמרת פתוחה") כשהפעולה לא מתאימה. הלוגיקה הטהורה: lib/punchClockFlow.js.
// כבוי: login_page_new = 'false' -> app/punch-clock/page.js מציג את הדף הישן (PunchClockLegacy.js).

import '@/design-system/components.css';
import './login.css';
import './punch-clock.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import {
  I, LoginSprites, LoginBar, EmployeeCombobox, PasswordField, DarkDialog, PLACEHOLDER_PASS,
} from './loginParts';
import { greetingNow, matchEmployeeByName, employeeDisplayName } from '@/lib/loginFlow';
import {
  PUNCH_ACTION, PUNCH_MESSAGES, validatePunchForm, punchErrorInfo, laundressCheckEnabled, overdueOrders,
  overdueConfirmText, formatIsraelClock, punchDoneInfo,
} from '@/lib/punchClockFlow';

const DONE_PANEL_MS = 4000;
const IDS = { input: 'pc-user', list: 'pc-userList', option: 'pc-uo-' };

/** השעה בשעון ישראל, מתעדכנת כל שנייה בתוך רכיב משלה (שאר הטופס לא מצויר מחדש כל שנייה). */
function NowClock() {
  const [text, setText] = useState('');
  useEffect(() => {
    const tick = () => setText(formatIsraelClock(new Date()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="pc-now" role="timer" aria-label="השעה כעת">
      <I n="clock" sm />
      <bdi dir="ltr">{text || '--:--:--'}</bdi>
    </div>
  );
}

export default function PunchClockNew({ brand }) {
  const [greeting, setGreeting] = useState('');
  const [employees, setEmployees] = useState([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [userText, setUserText] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  // מחשב מערכת מהימן: אותה מסלול מהיר כמו בדף הכניסה - הקוד המקוצר (4 תווים) מתקבל כאן בשדה הסיסמה
  const [trusted, setTrusted] = useState(false);
  const [error, setError] = useState(null); // { field: 'user'|'pass'|null, message }
  const [busy, setBusy] = useState(null); // PUNCH_ACTION.IN | PUNCH_ACTION.OUT בזמן שליחה
  const [done, setDone] = useState(null); // { title, clk, note }
  const [confirm, setConfirm] = useState(null); // { text, resolve } - "כובסת ביציאה"
  // כשהדף נפתח בניווט פנימי מתוך מעטפת האתר (לא בטעינה מלאה) המעטפת נשארת מאחור - הדף מכסה אותה במסך מלא
  const [overlay, setOverlay] = useState(false);

  const comboRef = useRef(null);
  const userInputRef = useRef(null);
  const passInputRef = useRef(null);
  const doneTimerRef = useRef(null);

  useLayoutEffect(() => {
    if (document.querySelector('.app-shell, .gm-menu')) setOverlay(true);
  }, []);

  useEffect(() => {
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
      .then((d) => setTrusted(!!d.trusted))
      .catch(() => setTrusted(false));
  }, []);

  useEffect(() => () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current); }, []);

  const selectedEmployee = employees.find((e) => e.id === selectedId) || null;
  const resolveEmployee = () => selectedEmployee || matchEmployeeByName(employees, userText);

  const pick = (emp) => {
    setSelectedId(emp.id);
    setUserText(employeeDisplayName(emp));
    setError(null);
    setTimeout(() => passInputRef.current && passInputRef.current.focus(), 0);
  };

  const onUserChange = (value) => {
    setUserText(value);
    setSelectedId('');
    if (error && error.field === 'user') setError(null);
  };

  const askConfirm = (text) => new Promise((resolve) => setConfirm({ text, resolve }));
  const answerConfirm = (ok) => {
    if (confirm) confirm.resolve(ok);
    setConfirm(null);
  };

  const backToForm = () => {
    if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }
    setDone(null);
  };

  const handlePunch = async (action) => {
    if (busy) return;
    if (comboRef.current) comboRef.current.close();
    const emp = resolveEmployee();
    const invalid = validatePunchForm({ userText, employeeId: emp ? emp.id : null, credential: password, listLoaded });
    if (invalid) {
      setError(invalid);
      (invalid.field === 'user' ? userInputRef : passInputRef).current?.focus();
      return;
    }
    if (!selectedId) setSelectedId(emp.id);
    setError(null);

    // 30 - כובסת ביציאה: אם מופעל, לפני יציאה מציג רשימת לא-החזירו לאישור
    if (action === PUNCH_ACTION.OUT) {
      try {
        const settingsRes = await fetch('/api/settings', { cache: 'no-store' });
        const arr = await settingsRes.json();
        if (laundressCheckEnabled(arr)) {
          const overdue = await fetch('/api/orders?filterStatus=archive&limit=50', { cache: 'no-store' })
            .then((r) => r.json()).then(overdueOrders).catch(() => []);
          if (overdue.length > 0) {
            const ok = await askConfirm(overdueConfirmText(overdue));
            if (!ok) { setError({ field: null, message: PUNCH_MESSAGES.exitCancelled }); return; }
          }
        }
      } catch (e) { /* כמו קודם: תקלה בבדיקה לא עוצרת את הרישום */ }
    }

    setBusy(action);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: String(emp.id), password, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(punchErrorInfo(res.status, data));
        return;
      }
      setDone(punchDoneInfo({ action, firstName: emp.firstName, shift: data.shift, now: new Date() }));
      setSelectedId('');
      setUserText('');
      setPassword('');
      setShowPass(false);
      doneTimerRef.current = setTimeout(() => { doneTimerRef.current = null; setDone(null); }, DONE_PANEL_MS);
    } catch (e) {
      setError({ field: null, message: PUNCH_MESSAGES.network });
    } finally {
      setBusy(null);
    }
  };

  const userInvalid = !!(error && error.field === 'user');
  const passInvalid = !!(error && error.field === 'pass');

  const formBody = done ? (
    <div className="done" role="status">
      <span className="ok"><I n="check" /></span>
      <h2>{done.title}</h2>
      {done.clk ? <div className="clk"><I n="clock" sm /><span>{done.clk}</span></div> : null}
      {done.note ? <div className="clk note"><I n="info" sm /><span>{done.note}</span></div> : null}
      <p>{PUNCH_MESSAGES.backToForm}</p>
      <button type="button" className="ghost" onClick={backToForm}>חזרה לטופס</button>
    </div>
  ) : (
    <>
      {trusted ? <div className="lg-trusted"><I n="shield" sm />מחשב זה מוגדר כמערכת מהימנה</div> : null}
      <form className="lg-form" noValidate autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        {error ? (
          <div className="msg" role="alert"><I n="alert" /><span>{error.message}</span></div>
        ) : null}

        <div className="field">
          <label className="lbl" htmlFor={IDS.input}>שם עובד</label>
          <EmployeeCombobox
            ref={comboRef}
            employees={employees}
            listLoaded={listLoaded}
            userText={userText}
            selectedId={selectedId}
            invalid={userInvalid}
            onTextChange={onUserChange}
            onPick={pick}
            inputRef={userInputRef}
            ids={IDS}
          />
        </div>

        <div className="field">
          <label className="lbl" htmlFor="pc-pass">{trusted ? 'סיסמה או קוד מקוצר (4 תווים)' : 'סיסמה'}</label>
          <PasswordField
            id="pc-pass"
            inputRef={passInputRef}
            placeholder={PLACEHOLDER_PASS}
            invalid={passInvalid}
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (passInvalid) setError(null); }}
            showPass={showPass}
            onToggle={() => { setShowPass((v) => !v); passInputRef.current?.focus(); }}
          />
        </div>

        <div className="pc-actions">
          <button type="button" className="gbtn" disabled={!!busy} onClick={() => handlePunch(PUNCH_ACTION.IN)}>
            {busy === PUNCH_ACTION.IN ? <span className="spin" aria-hidden="true" /> : <I n="check" />}
            <span>כניסה למשמרת</span>
          </button>
          <button type="button" className="gbtn" disabled={!!busy} onClick={() => handlePunch(PUNCH_ACTION.OUT)}>
            {busy === PUNCH_ACTION.OUT ? <span className="spin" aria-hidden="true" /> : <I n="logout" />}
            <span>יציאה ממשמרת</span>
          </button>
        </div>
      </form>
      <div className="punch">
        {/* קישור רגיל ולא <Link>: ה-layout הראשי מכריע בשרת אם להציג מעטפת או דף כניסה, ורק טעינה מלאה מריצה אותו מחדש */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">
          <I n="back" sm />
          <span>חזרה לכניסה למערכת</span>
        </a>
      </div>
    </>
  );

  return (
    <div className={`gm-ds gm-login gm-punch home-bg${overlay ? ' is-overlay' : ''}`} dir="rtl">
      <LoginSprites />
      <LoginBar brand={brand} />
      <main className="lg-stage">
        <div className="lg-wrap">
          <div className="lg-hero">
            <h1 id="pc-ttl">{greeting}</h1>
            <p>רישום כניסה ויציאה למשמרת</p>
            <NowClock />
          </div>
          <section className="card lg-card" aria-labelledby="pc-ttl">{formBody}</section>
        </div>
      </main>
      {confirm ? (
        <DarkDialog labelledBy="pc-dlg-t" onEscape={() => answerConfirm(false)}>
          <div className="dbadge"><I n="info" /></div>
          <h2 id="pc-dlg-t">לפני שרושמים יציאה</h2>
          <div className="sub">{confirm.text}</div>
          <div className="dbtns">
            <div className="r2">
              <button type="button" className="ghost" onClick={() => answerConfirm(false)}>ביטול</button>
              <button type="button" className="gbtn" onClick={() => answerConfirm(true)}>המשך ליציאה</button>
            </div>
          </div>
        </DarkDialog>
      ) : null}
    </div>
  );
}
