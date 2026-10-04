'use client';

// כרטיס עובד (ניהול) - העיצוב המאושר: תצוגות-עיצוב/כרטיס-עובד-ניהול.html (4.10.2026) + תשובות הבעלים EC-01..EC-12
// (scratch/empcard-build/DECISIONS.md), רכיבי פלטה בלבד, בתוך .gm-ds.gm-ec (שורש: gm-ds gm-ec home-bg dlg-dark, בלי gm-home).
// החוזה מול השרת לא השתנה לעומת הכרטיס הישן (app/employees/[id]/LegacyEmployeeCardPage.js): GET / POST / PUT /api/employees[/id],
// POST /api/employees/<id>/password | reset-password | set-password, shifts, הרשאות אישיות, send-email, history (lib/employeeCardA5.js
// משחזר את המטענים; הבדיקה scripts/test_employee_card_a5.mjs). לוגיקת התיקון שנבדק (requestJson / describeFailure: כישלון שמירה לא
// מוצג כהצלחה, שינוי סיסמה בכרטיס של עובד אחר) נשמרת כאן וגם בכרטיס הישן. שינויים מהישן = החלטות הבעלים בלבד:
//   EC-05 תמונת פרופיל בלבד, בלי emailSuffix, בלי שדה מספר מחלקה חלופי | EC-08 כרטיס אחד "מחלקה, סטטוס והערות" | EC-09 הרשאות
//   ב-7 קטגוריות מתקפלות | EC-10 אישור מנהל למייל בחלון נפרד | EC-11 הודעת הצלחה לעובד חדש לפני המעבר | EC-12 כרטיס צר + שמירה 420px.
// אין window.alert / confirm: הודעות בטוסט של הפלטה (#toast), אישורים בחלון כהה (#dlg), אימות מנהל בשכבה 2 (#dlg2).

import '@/design-system/components.css';
import './employee-card.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestJson, describeFailure } from '@/lib/employeeCardSave';
import {
  blankEmployee, employeeSaveRequest, joinDateValue, initialsOf, needsGmailFill, withGmail,
  passwordChangeBody, passwordChangeError, setPasswordError, departmentOptions, authBody,
} from '@/lib/employeeCardA5';
import { HomeSprite } from '../home/HomeParts';
import usePageTooltip from '../profile/usePageTooltip';
import { Combo } from '../attendance/parts';
import {
  Ic, Dlg, DlgBadge, ConfirmDlg, EcToast, EcContext, EcPortalRoot, NO_FILL, TOAST_MS, TOAST_ERR_MS, decorateEc,
} from './EcUi';
import EcApprovalDialog from './EcApproval';
import EcPermissions from './EcPermissions';
import EcAttendance from './EcAttendance';
import EcHistory from './EcHistory';
import EcMail from './EcMail';

const FLASH_KEY = 'ec-flash-toast';
const focusId = (elId) => { const el = document.getElementById(elId); if (el) el.focus(); };
const TABS = [['details', 'פרטי עובד', 'userck'], ['attendance', 'נוכחות וסיכום', 'clock'], ['history', 'היסטוריה', 'sn-history']];

function CardHead({ icon, id, children }) {
  return (
    <div className="card-h">
      <div className="ico rose"><Ic id={icon} size="lg" /></div>
      <h2 id={id}>{children}</h2>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, shown, onToggle, hint }) {
  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="inpw">
        <Ic id="lock" size="sm" />
        <input className="inp" type={shown ? 'text' : 'password'} id={id} value={value} onChange={onChange} autoComplete="new-password" {...NO_FILL} />
        <button type="button" className="inpx" aria-pressed={shown} aria-label={shown ? 'הסתר סיסמה' : 'הצג סיסמה'} data-tip={shown ? 'הסתר סיסמה' : 'הצג סיסמה'} onClick={onToggle}>
          <Ic id="eye" size="sm" />
        </button>
      </div>
      {hint ? <span className="sm faint ec-pwhint">{hint}</span> : null}
    </div>
  );
}

export default function EmployeeCardA5({ employeeId }) {
  const id = employeeId;
  const isNew = id === 'new';
  const router = useRouter();
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const fileRef = useRef(null);
  const pwBtnRef = useRef(null);
  const pwSetBtnRef = useRef(null);
  const toastTimer = useRef(null);
  const navTimer = useRef(null);
  const savingRef = useRef(false);
  const pwBusyRef = useRef(false);
  const copyTimer = useRef(null);
  const [portalRoot, setPortalRoot] = useState(null);
  const setRoot = useCallback((el) => { rootRef.current = el; setPortalRoot(el); }, []);

  const [employee, setEmployee] = useState(isNew ? blankEmployee() : null);
  const [loading, setLoading] = useState(!isNew);
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'details';
    const t = new URLSearchParams(window.location.search).get('tab'); // ?tab=history / ?tab=attendance (סיכום הנוכחות: "לכרטיס העובד · היסטוריה")
    return !isNew && (t === 'history' || t === 'attendance') ? t : 'details';
  });
  const [saving, setSaving] = useState(false);
  const [permRefresh, setPermRefresh] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [toast, setToast] = useState(null);
  const [mailOpen, setMailOpen] = useState(false);
  const [info, setInfo] = useState(null);
  const [conf, setConf] = useState(null); // { opts, resolve }
  const [approval, setApproval] = useState(null); // { opts, resolve }
  const [copied, setCopied] = useState(false);
  const [drag, setDrag] = useState(false);

  // סיסמה
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [mgrPw, setMgrPw] = useState('');
  const [eye, setEye] = useState({});
  const [pwSetOpen, setPwSetOpen] = useState(false);
  const [setPw, setSetPw] = useState('');
  const [setAuth, setSetAuth] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  // נתוני עזר: מי מחובר, מחלקות, הגדרת תמונת הפרופיל
  const [sessionEmployeeId, setSessionEmployeeId] = useState(null);
  const [departments, setDepartments] = useState(null);
  const [deptFailed, setDeptFailed] = useState(false);
  const [showImage, setShowImage] = useState(true);
  const isOwnCard = sessionEmployeeId !== null && sessionEmployeeId === id;

  usePageTooltip(rootRef, ttRef, false);

  // --- הודעות / חלונות -------------------------------------------------------------------------
  const say = useCallback((title, kind = 'ok', text) => {
    setToast({ title, text, kind, n: Date.now(), ms: kind === 'error' ? TOAST_ERR_MS : TOAST_MS });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), kind === 'error' ? TOAST_ERR_MS : TOAST_MS);
  }, []);
  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(navTimer.current); clearTimeout(copyTimer.current); }, []);
  const confirm = useCallback((opts) => new Promise((resolve) => setConf({ opts, resolve })), []);
  const approve = useCallback((opts) => new Promise((resolve) => setApproval({ opts, resolve })), []);
  const showInfo = useCallback((item) => setInfo(item), []);
  const ec = useMemo(() => ({ say, confirm, approve, info: showInfo }), [say, confirm, approve, showInfo]);

  // הודעת הצלחה שנשארה מהכרטיס הקודם (עובד חדש: ההודעה מוצגת לפני המעבר, והכרטיס החדש ממשיך אותה)
  useEffect(() => {
    try {
      const m = window.sessionStorage.getItem(FLASH_KEY);
      if (m) { window.sessionStorage.removeItem(FLASH_KEY); say(m); }
    } catch { /* אחסון חסום */ }
  }, [say]);

  // --- טעינות -----------------------------------------------------------------------------------
  useEffect(() => {
    fetch('/api/me').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && d.employee && d.employee.id) setSessionEmployeeId(d.employee.id); }).catch(() => {});
    fetch('/api/settings').then((r) => r.json()).then((d) => {
      const s = Array.isArray(d) ? d.find((x) => x.key === 'show_employee_profile_image') : null;
      if (s) setShowImage(s.value !== 'false');
    }).catch(() => {});
    let off = false;
    fetch('/api/departments').then((r) => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then((d) => { if (!off) setDepartments(Array.isArray(d) ? d : []); })
      .catch(() => { if (!off) setDeptFailed(true); });
    return () => { off = true; };
  }, []);

  useEffect(() => {
    if (isNew) return undefined;
    let off = false;
    fetch(`/api/employees/${id}`)
      .then(async (res) => ({ ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) }))
      .then(({ ok, status, data }) => {
        if (off) return;
        if (!ok || data.error) {
          say(describeFailure('טעינת כרטיס העובד נכשלה', { ok: false, status, data, networkError: false }), 'error');
          router.push('/employees');
        } else setEmployee(data);
        setLoading(false);
      })
      .catch(() => {
        if (off) return;
        say('טעינת כרטיס העובד נכשלה: אין תקשורת עם השרת - בדוק את החיבור ונסה שוב', 'error');
        setLoading(false);
      });
    return () => { off = true; };
  }, [id, isNew, router, say]);

  // אחרי פעולת משמרת / שינוי "הצג מחוקות": מרעננים רק את המשמרות - לא דורסים עריכה שלא נשמרה בלשונית הפרטים
  const reloadShifts = useCallback(async (withDeleted) => {
    if (isNew) return;
    const q = withDeleted ? '?includeDeleted=true' : '';
    const result = await requestJson(`/api/employees/${id}${q}`);
    if (result.ok && Array.isArray(result.data.shifts)) setEmployee((p) => (p ? { ...p, shifts: result.data.shifts } : p));
    else if (!result.ok) say(describeFailure('רענון המשמרות נכשל', result), 'error');
  }, [id, isNew, say]);
  const firstShowDel = useRef(true);
  useEffect(() => {
    if (firstShowDel.current) { firstShowDel.current = false; return; }
    reloadShifts(showDeleted);
  }, [showDeleted, reloadShifts]);

  // טולטיפים וקישוט לחצנים (data-ico + data-tip), גם בחלונות (הם בתוך השורש)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let raf = 0;
    const run = () => { raf = 0; decorateEc(root); };
    run();
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(run); });
    mo.observe(root, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // --- טופס ---------------------------------------------------------------------------------------
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEmployee((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const readAvatar = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setEmployee((prev) => ({ ...prev, profileImage: reader.result }));
    reader.readAsDataURL(file);
  };
  const removeAvatar = () => { setEmployee((prev) => ({ ...prev, profileImage: '' })); if (fileRef.current) fileRef.current.value = ''; };

  const handleSave = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    let navigating = false;
    try {
      const req = employeeSaveRequest(id, employee);
      const result = await requestJson(req.url, { method: req.method, headers: req.headers, body: req.body });
      if (!result.ok) { say(describeFailure('שמירת הפרטים נכשלה', result), 'error'); return; }
      if (isNew) {
        if (!result.data.id) { say('שמירת הפרטים נכשלה: השרת לא החזיר מזהה לעובד החדש', 'error'); return; }
        // EC-11: הודעת ההצלחה מוצגת לפני המעבר לכרטיס החדש (הוא ממשיך להציג אותה)
        say('הפרטים נשמרו בהצלחה!');
        try { window.sessionStorage.setItem(FLASH_KEY, 'הפרטים נשמרו בהצלחה!'); } catch { /* אחסון חסום */ }
        navigating = true;
        navTimer.current = setTimeout(() => router.push(`/employees/${result.data.id}`), 900);
      } else {
        setPermRefresh((n) => n + 1); // שינוי מחלקה משנה את ברירות המחדל שמוצגות בהרשאות
        say('הפרטים נשמרו בהצלחה!');
      }
    } finally {
      if (!navigating) { savingRef.current = false; setSaving(false); }
    }
  };

  // --- סיסמה --------------------------------------------------------------------------------------
  const closePwBox = (focus) => {
    setPwOpen(false); setOldPw(''); setNewPw(''); setMgrPw(''); setEye({});
    if (focus && pwBtnRef.current) pwBtnRef.current.focus();
  };
  const closeSetBox = (focus) => {
    setPwSetOpen(false); setSetPw(''); setSetAuth(null); setEye((p) => ({ ...p, set: false }));
    if (focus && pwSetBtnRef.current) pwSetBtnRef.current.focus();
  };
  const confirmPasswordChange = async () => {
    if (pwBusyRef.current) return;
    const err = passwordChangeError({ newPassword: newPw, sessionEmployeeId });
    if (err) { say(err, 'error'); focusId('employee-detail-newPassword'); return; }
    pwBusyRef.current = true; setPwBusy(true);
    try {
      const result = await requestJson(`/api/employees/${id}/password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // בכרטיס של עובד אחר (הנהלה ראשית / מתכנת): סיסמת המנהל עצמו לאימות; בכרטיס של עצמי: הסיסמה הישנה
        body: JSON.stringify(passwordChangeBody({ isOwnCard, oldPassword: oldPw, managerPassword: mgrPw, newPassword: newPw })),
      });
      if (result.ok) { closePwBox(true); say('הסיסמא שונתה בהצלחה'); } else say(describeFailure('שינוי הסיסמה נכשל', result), 'error');
    } finally { pwBusyRef.current = false; setPwBusy(false); }
  };
  const resetPassword = async () => {
    const auth = await approve({ message: 'הזן קוד מנהל לאיפוס הסיסמה ושליחתה למייל העובד', level: 'מנהל' });
    if (!auth) return;
    const result = await requestJson(`/api/employees/${id}/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authBody(auth)),
    });
    if (result.ok) say(result.data.message || 'סיסמה זמנית נשלחה למייל העובד'); else say(describeFailure('איפוס הסיסמה נכשל', result), 'error');
  };
  const openSetPassword = async () => {
    const auth = await approve({ message: 'הזן קוד מנהל לקביעת סיסמה ישירות לעובד', level: 'מנהל' });
    if (!auth) return;
    setSetAuth(auth); setPwSetOpen(true);
  };
  const confirmSetPassword = async () => {
    if (pwBusyRef.current) return;
    const err = setPasswordError(setPw);
    if (err) { say(err, 'error'); focusId('employee-detail-setPassword'); return; }
    pwBusyRef.current = true; setPwBusy(true);
    try {
      const result = await requestJson(`/api/employees/${id}/set-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authBody(setAuth), newPassword: setPw }),
      });
      if (result.ok) { closeSetBox(true); say(result.data.message || 'הסיסמה נקבעה בהצלחה'); } else say(describeFailure('קביעת הסיסמה נכשלה', result), 'error');
    } finally { pwBusyRef.current = false; setPwBusy(false); }
  };
  // Enter מאשר רק משדה טקסט (ולא כשהמקש מוחזק), Escape מבטל - כמו בעיצוב המאושר
  const onBoxKeys = (e, onOk, onCancel) => {
    if (e.key === 'Enter') { if (e.target.tagName === 'INPUT') { e.preventDefault(); if (!e.repeat) onOk(); } }
    else if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
  };

  // --- מייל ---------------------------------------------------------------------------------------
  const copyEmail = () => {
    try { if (navigator.clipboard) navigator.clipboard.writeText(employee.email); } catch { /* ללא הרשאה */ }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1200);
  };

  // --- לשוניות ------------------------------------------------------------------------------------
  const onTabKeys = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = TABS.findIndex((t) => t[0] === tab);
    const n = (i + (e.key === 'ArrowLeft' ? 1 : -1) + TABS.length) % TABS.length;
    e.preventDefault();
    setTab(TABS[n][0]);
    const el = document.getElementById(`t-${TABS[n][0]}`);
    if (el) el.focus();
  };

  // --- תצוגה --------------------------------------------------------------------------------------
  let body;
  if (loading || !employee) {
    body = (
      <div className="app ec">
        <div className="topbar"><div className="ttl"><div><h1>כרטיס עובד</h1></div></div></div>
        <div className="layout"><main className="main"><div className="pr-load" role="status"><span className="spin" />טוען נתונים...</div></main></div>
      </div>
    );
  } else {
    const photo = !!(employee.profileImage && employee.profileImage.startsWith('data:image'));
    const deptOpts = deptFailed
      ? [[employee.roleId === null || employee.roleId === undefined || employee.roleId === '' ? '' : String(employee.roleId), employee.roleId === null || employee.roleId === undefined || employee.roleId === '' ? 'לא נטענה' : `מחלקה ${employee.roleId}`]]
      : departments === null ? [['', 'טוען מחלקות...']] : departmentOptions(departments, employee.roleId);
    const deptVal = deptFailed ? deptOpts[0][0] : departments === null ? '' : (employee.roleId === null || employee.roleId === undefined ? '' : String(employee.roleId));
    const fullTitle = isNew ? 'עובד חדש' : `כרטיס עובד: ${employee.firstName} ${employee.lastName}`;
    const eyeBtn = (k) => () => setEye((p) => ({ ...p, [k]: !p[k] }));
    body = (
      <div className="app ec">
        <div className="topbar no-print">
          <button type="button" className="back" data-ico="back" id="ecBack" aria-label="חזרה" data-tip="חזרה" onClick={() => router.back()}><Ic id="back" /></button>
          <div className="ttl"><div><h1 id="ecTitle">{fullTitle}</h1></div></div>
        </div>

        <div className="layout">
          <main className="main">
            {!isNew ? (
              <nav className="tabs no-print" id="ecTabs" role="tablist" aria-label="כרטיס עובד" onKeyDown={onTabKeys}>
                {TABS.map(([k, label, icon]) => (
                  <button key={k} type="button" className={`tab${tab === k ? ' on' : ''}`} role="tab" id={`t-${k}`} aria-selected={tab === k} aria-controls={`p-${k}`} tabIndex={tab === k ? 0 : -1} data-tab={k} onClick={() => setTab(k)}>
                    <span className="tico"><Ic id={icon} /></span>{label}
                  </button>
                ))}
              </nav>
            ) : null}

            <section className={`panel no-print${tab === 'details' ? ' on' : ''}`} id="p-details" role="tabpanel" aria-labelledby="t-details">
              <form id="ecForm" autoComplete="off" style={{ display: 'contents' }} onSubmit={handleSave}>

                <section className="card dfields" aria-labelledby="h-personal">
                  <CardHead icon="userck" id="h-personal">פרטים אישיים</CardHead>
                  {showImage ? (
                    <div className="pf-avwrap" id="ecAvWrap">
                      <label className="lbl" htmlFor="employee-detail-profileImage">תמונת פרופיל (העלאת קובץ)</label>
                      <div className="pf-avrow">
                        {photo
                          ? <div className="pf-av photo" id="ecAv" aria-hidden="true" style={{ backgroundImage: `url("${employee.profileImage}")` }} />
                          : <div className="pf-av" id="ecAv" aria-hidden="true">{initialsOf(employee)}</div>}
                        <label className={`pf-up${drag ? ' drag' : ''}`} id="ecUp" htmlFor="employee-detail-profileImage" title="לחיצה או גרירת קובץ"
                          onDragEnter={(e) => { e.preventDefault(); setDrag(true); }} onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                          onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
                          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) readAvatar(f); }}>
                          <Ic id="plus" size="lg" />
                          <strong>גרור/י תמונה לכאן או לחצ/י לבחירה</strong>
                          <span className="sm faint">תמונה בלבד</span>
                        </label>
                        <input type="file" id="employee-detail-profileImage" accept="image/*" hidden ref={fileRef} onChange={(e) => readAvatar(e.target.files[0])} />
                        {employee.profileImage ? <button type="button" className="btn danger sm" id="ecImgRm" data-ico="trash" title="הסרת התמונה" onClick={removeAvatar}><Ic id="trash" size="sm" />הסר</button> : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid2">
                    <div className="field"><label className="lbl" htmlFor="employee-detail-firstName">שם פרטי *</label><input className="inp" type="text" id="employee-detail-firstName" name="firstName" value={employee.firstName || ''} onChange={handleChange} required autoComplete="off" {...NO_FILL} /></div>
                    <div className="field"><label className="lbl" htmlFor="employee-detail-lastName">שם משפחה *</label><input className="inp" type="text" id="employee-detail-lastName" name="lastName" value={employee.lastName || ''} onChange={handleChange} required autoComplete="off" {...NO_FILL} /></div>
                    <div className="field"><label className="lbl" htmlFor="employee-detail-fullName">שם מלא (מחושב/לתצוגה)</label><input className="inp" type="text" id="employee-detail-fullName" name="fullName" value={employee.fullName || ''} onChange={handleChange} autoComplete="off" {...NO_FILL} /></div>
                    <div className="field"><label className="lbl" htmlFor="employee-detail-joinDate">תאריך כניסה לארגון</label><div className="inpw dt"><Ic id="cal" size="sm" /><input className="inp" type="date" id="employee-detail-joinDate" name="joinDate" value={joinDateValue(employee.joinDate)} onChange={handleChange} /></div></div>
                  </div>
                </section>

                <section className="card dfields" aria-labelledby="h-contact">
                  <CardHead icon="phone" id="h-contact">יצירת קשר</CardHead>
                  <div className="grid2">
                    <div className="field"><label className="lbl" htmlFor="employee-detail-phone1">טלפון נייד *</label><div className="inpw"><Ic id="phone" size="sm" /><input className="inp" type="tel" inputMode="tel" id="employee-detail-phone1" name="phone1" value={employee.phone1 || ''} onChange={handleChange} required autoComplete="off" {...NO_FILL} /></div></div>
                    <div className="field"><label className="lbl" htmlFor="employee-detail-phone2">טלפון נוסף</label><div className="inpw"><Ic id="phone" size="sm" /><input className="inp" type="tel" inputMode="tel" id="employee-detail-phone2" name="phone2" value={employee.phone2 || ''} onChange={handleChange} autoComplete="off" {...NO_FILL} /></div></div>
                    <div className="field wide">
                      <label className="lbl" htmlFor="employee-detail-email">דוא&quot;ל</label>
                      <div className="ec-eml">
                        <div className="inpw"><Ic id="mail" size="sm" /><input className="inp" type="email" inputMode="email" id="employee-detail-email" name="email" value={employee.email || ''} onChange={handleChange} autoComplete="off" {...NO_FILL} /></div>
                        {employee.email ? <button type="button" className="ibtn" id="ecCopy" aria-label="העתק כתובת מייל" onClick={copyEmail}><Ic id={copied ? 'check' : 'copy'} /></button> : null}
                        {employee.email && !isNew ? <button type="button" className="ibtn" id="ecSend" aria-label="שלח מייל" onClick={() => setMailOpen(true)}><Ic id="mail" /></button> : null}
                      </div>
                      {needsGmailFill(employee.email) ? (
                        <div className="ec-fill" id="ecFill"><button type="button" className="btn sm" id="ecGmail" onClick={() => setEmployee((p) => ({ ...p, email: withGmail(p.email) }))}>השלם ל- <bdi dir="ltr">@gmail.com</bdi></button></div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="card dfields" aria-labelledby="h-address">
                  <CardHead icon="pin" id="h-address">כתובת</CardHead>
                  <div className="grid2">
                    <div className="field"><label className="lbl" htmlFor="employee-detail-city">עיר</label><input className="inp" type="text" id="employee-detail-city" name="city" value={employee.city || ''} onChange={handleChange} autoComplete="off" {...NO_FILL} /></div>
                    <div className="field"><label className="lbl" htmlFor="employee-detail-street">רחוב</label><input className="inp" type="text" id="employee-detail-street" name="street" value={employee.street || ''} onChange={handleChange} autoComplete="off" {...NO_FILL} /></div>
                    <div className="field"><label className="lbl" htmlFor="employee-detail-houseNum">בית</label><input className="inp" type="text" id="employee-detail-houseNum" name="houseNum" value={employee.houseNum || ''} onChange={handleChange} autoComplete="off" {...NO_FILL} /></div>
                  </div>
                </section>

                <section className="card dfields" aria-labelledby="h-security">
                  <CardHead icon="lock" id="h-security">אבטחה</CardHead>
                  {isNew ? (
                    <div className="field" id="pwNew">
                      <label className="lbl" htmlFor="employee-detail-password">סיסמא לשעון נוכחות</label>
                      <input className="inp" type="text" id="employee-detail-password" name="password" value={employee.password || ''} onChange={handleChange} autoComplete="off" {...NO_FILL} />
                    </div>
                  ) : (
                    <div id="pwEdit">
                      <div className="field" style={{ maxWidth: 620 }}>
                        <label className="lbl" htmlFor="employee-detail-pwDisplay">סיסמא לשעון נוכחות</label>
                        <div className="inpw"><Ic id="lock" size="sm" /><input className="inp" type="password" id="employee-detail-pwDisplay" value="********" disabled readOnly /></div>
                      </div>
                      <div className="ec-pwact">
                        <button type="button" className="btn" id="pwOpen" ref={pwBtnRef} aria-expanded={pwOpen} aria-controls="pwBox" onClick={() => setPwOpen(true)}>שינוי סיסמא</button>
                        <button type="button" className="btn" id="pwReset" onClick={resetPassword}><Ic id="refresh" size="sm" />אפס ושלח למייל</button>
                        <button type="button" className="btn" id="pwSetOpen" ref={pwSetBtnRef} aria-expanded={pwSetOpen} aria-controls="pwSetBox" onClick={openSetPassword}><Ic id="lock" size="sm" />קבע סיסמה ידנית</button>
                      </div>
                      <div className="sm faint ec-hint">מטעמי אבטחה לא ניתן לצפות בסיסמה קיימת - ניתן לשנות אותה (בידיעת הסיסמה הנוכחית, או בכרטיס של עובד אחר - הנהלה ראשית / מתכנת באימות הסיסמה שלהם), לאפס ולשלוח סיסמה זמנית לעובד במייל, או שמנהל יקבע סיסמה חדשה ישירות (לעובד בלי מייל שמור, או בלי גישה אליו כרגע).</div>

                      {pwOpen ? (
                        <div className="pf-pwbox" id="pwBox" onKeyDown={(e) => onBoxKeys(e, confirmPasswordChange, () => closePwBox(true))}>
                          {isOwnCard
                            ? <PasswordField id="employee-detail-oldPassword" label="סיסמא ישנה" value={oldPw} onChange={(e) => setOldPw(e.target.value)} shown={!!eye.old} onToggle={eyeBtn('old')} />
                            : <PasswordField id="employee-detail-managerPassword" label="הסיסמא שלך (לאימות המנהל)" value={mgrPw} onChange={(e) => setMgrPw(e.target.value)} shown={!!eye.mgr} onToggle={eyeBtn('mgr')} hint="שינוי סיסמה לעובד אחר מותר להנהלה ראשית ולמתכנת, באימות הסיסמה שלך. הסיסמה הנוכחית של העובד אינה נדרשת." />}
                          <PasswordField id="employee-detail-newPassword" label="סיסמא חדשה" value={newPw} onChange={(e) => setNewPw(e.target.value)} shown={!!eye.new} onToggle={eyeBtn('new')} />
                          <div className="pf-pwbtns">
                            <button type="button" className="btn ghost" id="pwCancel" onClick={() => closePwBox(true)}>ביטול</button>
                            <button type="button" className="btn primary" id="pwOk" disabled={pwBusy} onClick={confirmPasswordChange}>אשר שינוי</button>
                          </div>
                        </div>
                      ) : null}

                      {pwSetOpen ? (
                        <div className="pf-pwbox" id="pwSetBox" onKeyDown={(e) => onBoxKeys(e, confirmSetPassword, () => closeSetBox(true))}>
                          <PasswordField id="employee-detail-setPassword" label="סיסמה חדשה לעובד" value={setPw} onChange={(e) => setSetPw(e.target.value)} shown={!!eye.set} onToggle={eyeBtn('set')} />
                          <div className="pf-pwbtns">
                            <button type="button" className="btn ghost" id="pwSetCancel" onClick={() => closeSetBox(true)}>ביטול</button>
                            <button type="button" className="btn primary" id="pwSetOk" disabled={pwBusy} onClick={confirmSetPassword}>אשר קביעה</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>

                <section className="card dfields" aria-labelledby="h-dept">
                  <CardHead icon="users" id="h-dept">מחלקה, סטטוס והערות</CardHead>
                  <div className="grid2">
                    <div className="field" id="deptField">
                      <label className="lbl" htmlFor="cbt-dept">מחלקה (תפקיד)</label>
                      <Combo id="dept" label="מחלקה (תפקיד)" value={deptVal} options={deptOpts} disabled={deptFailed || departments === null}
                        onChange={(v) => setEmployee((p) => ({ ...p, roleId: v }))} />
                      {deptFailed ? <div className="ec-warn" style={{ color: 'var(--red)' }}><Ic id="alert" size="sm" /><span>רשימת המחלקות לא נטענה מהשרת - לא ניתן לשנות מחלקה כרגע. המחלקה הנוכחית נשמרת כמו שהיא.</span></div> : null}
                    </div>
                  </div>
                  <div className="pf-prefs ec-sw1">
                    <div className="trow"><label className="sw"><input type="checkbox" id="employee-detail-isActive" name="isActive" checked={!!employee.isActive} onChange={handleChange} /><i /></label><label htmlFor="employee-detail-isActive" className="pf-pl">עובד פעיל במערכת</label></div>
                    <div className="trow"><label className="sw"><input type="checkbox" id="employee-detail-receiveEmailAlerts" name="receiveEmailAlerts" checked={!!employee.receiveEmailAlerts} onChange={handleChange} /><i /></label><label htmlFor="employee-detail-receiveEmailAlerts" className="pf-pl">קבלת התראות מערכת למייל</label></div>
                  </div>
                  <div className="field wide ec-notes"><label className="lbl" htmlFor="employee-detail-notes">הערות</label><textarea className="inp" id="employee-detail-notes" name="notes" rows={4} value={employee.notes || ''} onChange={handleChange} autoComplete="off" {...NO_FILL} /></div>
                </section>

                <section className="card dfields" aria-labelledby="h-pay">
                  <CardHead icon="wallet" id="h-pay">נתוני שכר</CardHead>
                  <div className="grid2">
                    <div className="field"><label className="lbl" htmlFor="employee-detail-hourlyWage">שכר לשעה (₪)</label><div className="inpw money"><span className="aff" aria-hidden="true">₪</span><input className="inp" type="number" step="0.01" inputMode="decimal" id="employee-detail-hourlyWage" name="hourlyWage" value={employee.hourlyWage || ''} onChange={handleChange} autoComplete="off" {...NO_FILL} /></div></div>
                    <div className="field"><label className="lbl" htmlFor="employee-detail-paymentMethod">אופן תשלום</label><div className="inpw"><Ic id="bank" size="sm" /><input className="inp" type="text" id="employee-detail-paymentMethod" name="paymentMethod" value={employee.paymentMethod || ''} onChange={handleChange} autoComplete="off" {...NO_FILL} /></div></div>
                    <div className="field ec-travel"><span className="lbl" id="ec-travel-l">זכאות לנסיעות</span><div className="trow"><label className="sw"><input type="checkbox" id="employee-detail-travelExpenses" name="travelExpenses" aria-labelledby="ec-travel-l" checked={!!employee.travelExpenses} onChange={handleChange} /><i /></label><label htmlFor="employee-detail-travelExpenses" className="pf-pl">{employee.travelExpenses ? 'זכאי לנסיעות' : 'לא זכאי לנסיעות'}</label></div></div>
                  </div>
                </section>

                {!isNew ? (
                  <section className="card dfields" id="permCard" aria-labelledby="h-perm">
                    <CardHead icon="shield" id="h-perm">הרשאות ספציפיות</CardHead>
                    <p className="pr-intro">מה העובד מורשה, לפי מחלקתו, שורות ההרשאה ב<a href="/admin/permissions" id="permLink">מסך ההרשאות</a> וחריגות אישיות שנקבעות כאן. הכול נשמר מיד ומופיע גם במסך ההרשאות.</p>
                    <div id="permBody"><EcPermissions employeeId={id} refreshKey={permRefresh} /></div>
                  </section>
                ) : null}

                <div className="ec-save"><button type="submit" className="btn primary lg block" id="ecSave" disabled={saving}>{saving ? 'שומר...' : 'שמור פרטים'}</button></div>
              </form>
            </section>

            {!isNew ? (
              <section className={`panel${tab === 'attendance' ? ' on' : ''}`} id="p-attendance" role="tabpanel" aria-labelledby="t-attendance">
                {tab === 'attendance' ? <EcAttendance employee={employee} employeeId={id} showDeleted={showDeleted} onShowDeleted={setShowDeleted} onReload={() => reloadShifts(showDeleted)} /> : null}
              </section>
            ) : null}
            {!isNew ? (
              <section className={`panel no-print${tab === 'history' ? ' on' : ''}`} id="p-history" role="tabpanel" aria-labelledby="t-history">
                {tab === 'history' ? <EcHistory employeeId={id} refreshKey={permRefresh} /> : null}
              </section>
            ) : null}
          </main>
        </div>
      </div>
    );
  }

  const closeConf = (v) => { const c = conf; setConf(null); if (c) c.resolve(v); };
  const closeApproval = (v) => { const a = approval; setApproval(null); if (a) a.resolve(v); };

  return (
    <div className="gm-ds gm-ec home-bg dlg-dark" ref={setRoot} dir="rtl">
      <HomeSprite />
      <EcPortalRoot.Provider value={portalRoot}>
        <EcContext.Provider value={ec}>
          {body}
          <EcToast toast={toast} onClose={() => setToast(null)} />
          {mailOpen && employee ? <EcMail employeeId={id} defaultTo={employee.email} name={`${employee.firstName || ''} ${employee.lastName || ''}`.trim()} onClose={() => setMailOpen(false)} /> : null}
          {info ? (
            <Dlg labelledBy="ec-info-t" onClose={() => setInfo(null)} focusSel=".btn">
              <DlgBadge icon="info" />
              <h2 id="ec-info-t">{info.label}</h2>
              <div className="ec-info">
                {info.description ? <p>{info.description}</p> : null}
                <span className={`chip ${info.enforced ? 'green' : 'gold'}`}>{info.enforced ? 'פעיל — שינוי כאן משפיע מיד' : 'לתיעוד בלבד — לא משנה את הגישה בפועל'}</span>
                {info.userNote ? <p>{info.userNote}</p> : null}
                {info.route ? <p><a href={info.route} target="_blank" rel="noopener noreferrer" className="pr-link">פתיחת העמוד בטאב חדש</a></p> : null}
              </div>
              <div className="dbtns"><button type="button" className="btn ghost block" data-ec="close" onClick={() => setInfo(null)}><Ic id="x" size="sm" />סגירה</button></div>
            </Dlg>
          ) : null}
          {conf ? <ConfirmDlg {...conf.opts} onYes={() => closeConf(true)} onNo={() => closeConf(false)} /> : null}
          {approval ? <EcApprovalDialog {...approval.opts} onResult={closeApproval} /> : null}
        </EcContext.Provider>
      </EcPortalRoot.Provider>
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}
