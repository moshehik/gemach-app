'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { V3Page, Btn, Chip, Dialog, Row, Tip, Icon } from '@/app/v3/ui/components';

export default function LoginScreen({ isModal = false, onClose }) {
  const [employees, setEmployees] = useState([]);
  const [isFetchingEmployees, setIsFetchingEmployees] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [password, setPassword] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();
  // Chrome falls back to an input's `id` (this one is a fixed string, "login-employee")
  // to key its own "previously typed values" suggestion list when there's no `name` -
  // autoComplete="new-password" alone didn't suppress that (see the comment at the input
  // itself, and report 2a4a2af4 which kept recurring even after that fix). A random
  // per-mount `name` means the browser never has a stable key to accumulate/match against -
  // same fix already applied to the order-item model search field (report 0a88cf56 follow-up).
  // Generated client-side only (useEffect, not during render) so the server-rendered HTML
  // and the client's pre-hydration render both have no `name` attribute here - computing it
  // during render (even via a ref) makes the server and client pick different random values
  // for the same paint, which React flags as a hydration mismatch on this exact attribute.
  const [employeeAutofillGuardName, setEmployeeAutofillGuardName] = useState(undefined);
  useEffect(() => {
    setEmployeeAutofillGuardName(`no-autofill-${Math.random().toString(36).slice(2)}`);
  }, []);

  // Trusted-device fast path: this computer may have been marked trusted by a manager
  // (see /admin/trusted-devices), which lets whoever logs in from it use just the last 4
  // characters of their real password instead of typing the whole thing every time.
  const [deviceTrusted, setDeviceTrusted] = useState(false);
  const [usePinMode, setUsePinMode] = useState(false);

  // "שכחתי סיסמה" - emails a temporary password to the employee's address on file.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotResult, setForgotResult] = useState(null);

  // Forced "set a new password" prompt, shown right after logging in with a temporary
  // password issued by the forgot-password/reset flow (Employee.mustResetPassword).
  const [resetRequired, setResetRequired] = useState(false);
  const [resetEmployeeId, setResetEmployeeId] = useState(null);
  const [newPass1, setNewPass1] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchSharedJson('/api/employees', { ttl: TTL.STATIC })
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data);
        }
        setIsFetchingEmployees(false);
      })
      .catch(err => {
        console.error('Failed to load employees:', err);
        setIsFetchingEmployees(false);
      });

    fetch('/api/auth/device-status')
      .then(res => res.json())
      .then(data => {
        setDeviceTrusted(!!data.trusted);
        setUsePinMode(!!data.trusted);
      })
      .catch(() => {});
  }, []);

  const resolveEmployeeId = () => {
    let finalEmployeeId = selectedEmployee;
    if (!finalEmployeeId && searchTerm) {
      const match = employees.find(emp => `${emp.firstName} ${emp.lastName}`.trim() === searchTerm.trim());
      if (match) {
        finalEmployeeId = match.id;
        setSelectedEmployee(match.id);
      }
    }
    return finalEmployeeId;
  };

  const finishLogin = () => {
    // 29 - התראה בכניסה על הודעה שלא טופלה (אם מופעל)
    try {
      fetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).then(arr => {
        const on = Array.isArray(arr) ? arr.find(s => s.key === 'notify_on_new_message_at_login')?.value === 'true' : false;
        if (on) {
          fetch('/api/notifications', { cache: 'no-store' }).then(nr => nr.json()).then(nd => {
            const list = nd.notifications || [];
            const unread = list.filter(x => !x.isRead && !x.isArchived);
            if (unread.length > 0 && typeof window !== 'undefined') {
              const msg = `מחכות לכם ${unread.length} הודעות חדשות שלא טופלו`;
              if (window.customAlert) window.customAlert(msg);
              else alert(msg);
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    } catch {}
    // רענון מלא ולא router.refresh: ה-navbar מיוצר בשרת לפי תפקיד המשתמש,
    // ו-UserMenu מציג את /api/me מהמטמון המשותף בזיכרון — שניהם מתעדכנים
    // לעובד שנכנס רק בטעינת עמוד נקייה. אם העמוד הנוכחי אסור לתפקיד החדש,
    // ה-guard בשרת ממילא יפנה לדף הבית.
    // גם כשמסך הכניסה מוצג במקום דף מבוקש (showLogin ב-layout.js, לא ניווט
    // אמיתי - כתובת ה-URL נשארת זהה לדף שהמשתמש ניסה להגיע אליו), reload()
    // ולא href='/' - כדי לחזור לאותו דף במקום לקפוץ לדף הבית (דיווח 2026-09-23).
    window.location.reload();
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    const finalEmployeeId = resolveEmployeeId();
    const credential = usePinMode ? pinValue : password;

    if (!finalEmployeeId || !credential) {
      setError(usePinMode ? 'בחרו את שמכם והקלידו 4 תווים' : 'בחרו את שמכם והקלידו את הקוד');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usePinMode
          ? { employeeId: finalEmployeeId, pin: credential }
          : { employeeId: finalEmployeeId, password: credential })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.mustResetPassword) {
          setResetEmployeeId(finalEmployeeId);
          setResetRequired(true);
        } else {
          finishLogin();
        }
      } else {
        // The server may tell us the PIN path isn't usable right now (device not trusted
        // after all, or this employee has no PIN yet) - fall back to the full password field.
        if (data.requireFullPassword) {
          setUsePinMode(false);
          setPinValue('');
        }
        setError(data.message || 'ההתחברות לא הצליחה');
      }
    } catch (err) {
      setError('אין קשר עם השרת, נסו שוב');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const finalEmployeeId = resolveEmployeeId();
    if (!finalEmployeeId) {
      setForgotResult({ success: false, message: 'קודם בוחרים את שמכם ברשימה' });
      return;
    }
    setForgotSending(true);
    setForgotResult(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: finalEmployeeId })
      });
      const data = await res.json();
      setForgotResult({ success: !!data.success, message: data.message || (data.success ? 'הסיסמה הזמנית בדרך למייל' : 'לא הצלחנו לשלוח, נסו שוב') });
    } catch (err) {
      setForgotResult({ success: false, message: 'אין קשר עם השרת, נסו שוב' });
    } finally {
      setForgotSending(false);
    }
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!newPass1 || newPass1.length < 4) {
      setResetError('הסיסמה צריכה לכלול לפחות 4 תווים');
      return;
    }
    if (newPass1 !== newPass2) {
      setResetError('שתי הסיסמאות צריכות להיות זהות');
      return;
    }
    setResetSaving(true);
    try {
      const res = await fetch(`/api/employees/${resetEmployeeId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPass1 })
      });
      const data = await res.json();
      if (data.success) {
        setResetRequired(false);
        finishLogin();
      } else {
        setResetError(data.message || 'לא הצלחנו לשמור את הסיסמה');
      }
    } catch (err) {
      setResetError('אין קשר עם השרת, נסו שוב');
    } finally {
      setResetSaving(false);
    }
  };

  // Fix: when input still shows selected employee's display name and dropdown is open, show full list instead of filtering to that single name
  const selectedEmployeeObj = employees.find(emp => emp.id === selectedEmployee) || null;
  const selectedDisplay = selectedEmployeeObj ? `${selectedEmployeeObj.firstName} ${selectedEmployeeObj.lastName}`.trim() : '';
  const isShowingSelectedDisplay = isDropdownOpen && selectedDisplay && searchTerm === selectedDisplay;
  const filteredEmployees = isShowingSelectedDisplay
    ? employees
    : employees.filter(emp => `${emp.firstName} ${emp.lastName}`.includes(searchTerm));

  // ---- v3 presentation layer (cosmetic only) ----
  const initialsOf = (emp) => `${(emp.firstName || '').trim().charAt(0)}${(emp.lastName || '').trim().charAt(0)}`;

  const trustedNote = deviceTrusted && (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--v3-sp-1)' }}>
      <Chip variant="info" icon="shield">מחשב מהימן</Chip>
      <Tip label="על מחשב מהימן">מנהל סימן את המחשב הזה כמהימן, ולכן מספיקים 4 התווים האחרונים של הסיסמה.</Tip>
    </div>
  );

  const errorBox = error && (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--v3-sp-2)', background: 'var(--v3-rose-50)', border: 'var(--v3-bw-hair) solid var(--v3-rose-200)', color: 'var(--v3-plum)', borderRadius: 'var(--v3-r-btn)', padding: 'var(--v3-sp-3) var(--v3-sp-4)', fontWeight: 'var(--v3-fw-medium)' }}>
      <Icon name="alert-circle" />
      <span>{error}</span>
    </div>
  );

  const formFields = (
    <form onSubmit={handleLogin} autoComplete="off" className="v3-stack">

      {errorBox}

      <div className="v3-field" ref={dropdownRef}>
        <label className="v3-label" htmlFor="login-employee">שם העובד</label>
        <div style={{ position: 'relative' }}>
          {isFetchingEmployees ? (
            <span className="v3-spin" style={{ position: 'absolute', insetInlineStart: 'var(--v3-sp-3)', top: '50%', transform: 'translateY(-50%)' }} />
          ) : (
            <Icon name="user" data-element-name="לחיץ_LoginScreen_6" style={{ position: 'absolute', insetInlineStart: 'var(--v3-sp-3)', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: selectedEmployee ? 'var(--v3-navy)' : 'var(--v3-navy-500)' }} onClick={() => setIsDropdownOpen(!isDropdownOpen)} />
          )}
          <input data-element-name="שדה_LoginScreen_4"
            id="login-employee"
            className="v3-input"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedEmployee('');
              setIsDropdownOpen(true);
            }}
            disabled={isFetchingEmployees}
            placeholder={isFetchingEmployees ? 'רגע, טוענים את הרשימה...' : 'הקלידו שם או בחרו מהרשימה'}
            onFocus={() => setIsDropdownOpen(true)}
            onClick={() => { if (selectedDisplay) setIsDropdownOpen(true); }}
            style={{ minHeight: 'var(--v3-control-h-lg)', paddingInlineStart: 'var(--v3-sp-8)', paddingInlineEnd: selectedEmployee ? 'var(--v3-sp-8)' : undefined }}
            // autoComplete="new-password" (לא "off", שכרום מתעלם ממנו בפועל בשדות
            // מהסוג הזה) - בלי זה, מעל תיבת הבחירה המותאמת-אישית של הרכיב (עם
            // רשימת העובדים המלאה) הדפדפן הציג גם dropdown native משלו עם ערכים
            // שהוקלדו בעבר באותו שדה - שתי רשימות זו על גבי זו (דיווח 2a4a2af4).
            // עדיין לא הספיק לבד - לשדה אין name, אז כרום נופל חזרה על ה-id הקבוע
            // ("login-employee") כמפתח להיסטוריה שלו; name אקראי מונע את זה לגמרי.
            name={employeeAutofillGuardName}
            autoComplete="new-password"
          />
          {selectedEmployee && !isFetchingEmployees && (
            <button
              type="button"
              className="v3-combo__clear"
              aria-label="נקה בחירה"
              title="נקה בחירה"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setSelectedEmployee(''); setSearchTerm(''); setIsDropdownOpen(true); }}
              style={{ position: 'absolute', insetInlineEnd: 'var(--v3-sp-2)', top: '50%', transform: 'translateY(-50%)', border: 'var(--v3-bw-hair) solid var(--v3-sky-300)', cursor: 'pointer', padding: 0 }}
            >
              <Icon name="x" size="xs" />
            </button>
          )}
        </div>

        {isDropdownOpen && (
          <div role="listbox" aria-label="רשימת עובדים" style={{ marginTop: 'var(--v3-sp-2)', border: 'var(--v3-bw-hair) solid var(--v3-sky-300)', borderRadius: 'var(--v3-r-btn)', background: 'var(--v3-surface)', overflow: 'hidden' }}>
            {isFetchingEmployees ? (
              <div className="v3-combo__empty">
                <span className="v3-spin" />
                רגע, טוענים את הרשימה...
              </div>
            ) : filteredEmployees.length > 0 ? (
              <div className="v3-combo__list">
                {filteredEmployees.map((emp, i) => (
                  <div data-element-name="לחיץ_LoginScreen_7"
                    key={emp.id}
                    role="option"
                    aria-selected={selectedEmployee === emp.id}
                    className={`v3-combo__o${selectedEmployee === emp.id ? ' is-selected' : ''}`}
                    style={{ '--i': i }}
                    onClick={() => {
                      setSelectedEmployee(emp.id);
                      setSearchTerm(`${emp.firstName} ${emp.lastName}`);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <span className="v3-combo__oi" aria-hidden="true"><bdi>{initialsOf(emp)}</bdi></span>
                    <span className="v3-combo__ox"><b>{emp.firstName} {emp.lastName}</b></span>
                    {selectedEmployee === emp.id && <span className="v3-combo__ck"><Icon name="check" size="sm" /></span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="v3-combo__empty">
                <Icon name="user" />
                לא מצאנו עובד בשם הזה
              </div>
            )}
          </div>
        )}
      </div>

      <div className="v3-field">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--v3-sp-2)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--v3-sp-1)' }}>
            <label className="v3-label" htmlFor="login-password" style={{ marginBottom: 0 }}>
              {usePinMode ? '4 התווים האחרונים של הסיסמה' : 'קוד כניסה'}
            </label>
            {usePinMode && <Tip label="על הקוד המקוצר">במחשב מהימן מספיקים 4 התווים האחרונים של הסיסמה שלכם.</Tip>}
          </span>
          {deviceTrusted && (
            <Btn
              variant="quiet"
              size="sm"
              icon={usePinMode ? 'lock' : 'shield'}
              onClick={() => { setUsePinMode(!usePinMode); setError(''); setPassword(''); setPinValue(''); }}
            >
              {usePinMode ? 'עוברים לסיסמה המלאה' : 'עוברים לקוד מקוצר'}
            </Btn>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <Icon name="lock" style={{ position: 'absolute', insetInlineStart: 'var(--v3-sp-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--v3-navy-500)', pointerEvents: 'none' }} />
          {usePinMode ? (
            <input data-element-name="שדה_LoginScreen_pin"
              id="login-password"
              className="v3-input"
              type="password"
              maxLength={4}
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.slice(0, 4))}
              placeholder="••••"
              style={{ minHeight: 'var(--v3-control-h-lg)', letterSpacing: '0.6em', textAlign: 'center', paddingInline: 'var(--v3-sp-8)' }}
              // "new-password" ולא "off" - כרום מתעלם בפועל מ-off בשדות סיסמה של
              // התחברות, אבל מכבד new-password (מסמן שזו לא סיסמה שמורה קיימת, אז
              // לא מציע אוטופיל ולא מציע לשמור) - אותו טריק שכבר קיים בשדה העובד
              // למעלה. ר' דיווח org2 5cb73cc0.
              autoComplete="new-password"
            />
          ) : (
            <input data-element-name="שדה_LoginScreen_8"
              id="login-password"
              className="v3-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הקלידו את הקוד שלכם"
              style={{ minHeight: 'var(--v3-control-h-lg)', paddingInlineStart: 'var(--v3-sp-8)' }}
              autoComplete="new-password"
            />
          )}
        </div>
        <div style={{ textAlign: 'end', marginTop: 'var(--v3-sp-1)' }}>
          <Btn
            variant="quiet"
            size="sm"
            icon="mail"
            onClick={() => { setForgotOpen(true); setForgotResult(null); }}
          >
            שכחתי סיסמה
          </Btn>
        </div>
      </div>

      <Btn data-element-name="כפתור_LoginScreen_10"
        type="submit"
        variant="primary"
        size="lg"
        block
        loading={loading}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v3-sp-2)' }}>
          {!loading && <Icon name="arrow-end" data-element-name="רכיב_LoginScreen_11" />}
          כניסה למערכת
        </span>
      </Btn>
    </form>
  );

  const markTile = (
    <div style={{ width: 'var(--v3-sp-9)', height: 'var(--v3-sp-9)', borderRadius: 'var(--v3-r-lg)', background: 'var(--v3-grad-navy-panel)', color: 'var(--v3-white)', display: 'grid', placeItems: 'center', margin: '0 auto var(--v3-sp-3)', boxShadow: 'var(--v3-sh-raise)' }}>
      <Icon name="lock" size="xl" data-element-name="רכיב_LoginScreen_3" style={{ color: 'var(--v3-white)' }} />
    </div>
  );

  const loginCard = isModal ? (
    <Dialog
      open
      variant="form"
      closeOnScrim={false}
      onClose={() => { if (onClose) onClose(false); }}
      aria-label="כניסת עובדים"
      style={{ maxWidth: 'var(--v3-dlg-w)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v3-sp-3)' }}>
        <Icon name="lock" data-element-name="רכיב_LoginScreen_3" />
        <h2 className="v3-h3" style={{ flex: 1, margin: 0 }}>כניסת עובדים</h2>
        {onClose && (
          <Btn data-element-name="כפתור_LoginScreen_1" round size="sm" className="v3-btn--icon" onClick={() => onClose(false)} title="סגירה" aria-label="סגירה">
            <Icon name="x" data-element-name="רכיב_LoginScreen_2" />
          </Btn>
        )}
      </div>
      <p className="v3-muted" style={{ margin: 0, textAlign: 'center' }}>בחרו את שמכם והקלידו את הקוד</p>
      {trustedNote}
      {formFields}
    </Dialog>
  ) : (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundImage: 'radial-gradient(circle at 15% 0%, var(--v3-sky-a60), transparent 55%), radial-gradient(circle at 100% 100%, var(--v3-sky-a40), transparent 50%)' }}>
      <header style={{ minHeight: 'var(--v3-sp-9)', display: 'flex', alignItems: 'center', gap: 'var(--v3-sp-3)', padding: '0 var(--v3-gutter)', background: 'var(--v3-grad-topbar)', color: 'var(--v3-white)' }}>
        <Icon name="shirt" size="lg" style={{ color: 'var(--v3-gold-300)' }} />
        <b style={{ fontSize: 'var(--v3-fs-xl)' }}>גמ"ח</b>
        <span style={{ width: 1, alignSelf: 'stretch', margin: 'var(--v3-sp-4) 0', background: 'var(--v3-dark-hair)' }} aria-hidden="true" />
        <small style={{ color: 'var(--v3-sky-300)', fontSize: 'var(--v3-fs-sm)', lineHeight: 1.3 }}>הזמנות<br />והשכרות</small>
      </header>
      <main style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 'var(--v3-sp-7)', padding: 'var(--v3-sp-7) var(--v3-gutter)', width: '100%', maxWidth: 'var(--v3-container)', marginInline: 'auto' }}>
        <section className="v3-card" data-v3-anim-host="" style={{ flex: '1 1 320px', maxWidth: 480, padding: 'var(--v3-sp-6)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--v3-sp-5)' }}>
            {markTile}
            <h1 className="v3-h1">ברוכים הבאים</h1>
            <p className="v3-muted" style={{ margin: 'var(--v3-sp-2) 0 var(--v3-sp-2)' }}>בחרו את שמכם והקלידו את הקוד</p>
            {trustedNote}
          </div>
          {formFields}
          <div style={{ textAlign: 'center', marginTop: 'var(--v3-sp-4)' }}>
            <Btn variant="quiet" size="sm" icon="clock" href="/punch-clock">רק לדווח כניסה או יציאה ממשמרת</Btn>
          </div>
        </section>
        <aside style={{ flex: '1 1 280px', maxWidth: 440 }}>
          <h2 style={{ margin: '0 0 var(--v3-sp-5)', fontSize: 'var(--v3-fs-display)', lineHeight: 1.15, color: 'var(--v3-navy)' }}>
            כל הגמח,<br /><span style={{ color: 'var(--v3-gold-b)' }}>במקום אחד</span>
          </h2>
          <div className="v3-stack">
            {[
              { icon: 'shirt', title: 'הזמנות והשכרות', text: 'מהפגישה הראשונה ועד ההחזרה.' },
              { icon: 'box', title: 'מלאי וזמינות', text: 'רואים מיד מה פנוי לאירוע.' },
              { icon: 'coin', title: 'תשלומים ומעקב', text: 'חובות, זיכויים וקבלות בכל רגע.' },
            ].map((p) => (
              <div key={p.title} style={{ display: 'flex', gap: 'var(--v3-sp-3)', alignItems: 'flex-start' }}>
                <span style={{ width: 'var(--v3-sp-7)', height: 'var(--v3-sp-7)', flex: 'none', borderRadius: 'var(--v3-r-md)', display: 'grid', placeItems: 'center', background: 'var(--v3-sky-100)', color: 'var(--v3-navy-500)', border: 'var(--v3-bw-hair) solid var(--v3-sky-300)' }}>
                  <Icon name={p.icon} />
                </span>
                <span className="v3-muted"><b style={{ color: 'var(--v3-navy)' }}>{p.title}</b><br />{p.text}</span>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );

  const forgotDialog = (
    <Dialog
      open={forgotOpen}
      onClose={() => setForgotOpen(false)}
      variant="form"
      nested
      icon="mail"
      title="שכחתי סיסמה"
      style={{ maxWidth: 'var(--v3-dlg-w)' }}
      actions={(
        <>
          <Btn variant="primary" loading={forgotSending} onClick={handleForgotPassword}>
            {forgotSending ? 'שולח...' : 'שלחו לי סיסמה זמנית'}
          </Btn>
          <Btn onClick={() => setForgotOpen(false)}>סגירה</Btn>
        </>
      )}
    >
      <div className="v3-rows">
        <Row label="הסיסמה הזמנית תישלח עבור" icon="user" tip="הסיסמה תישלח למייל השמור במערכת. אחרי הכניסה איתה תתבקשו לבחור סיסמה קבועה חדשה.">
          {searchTerm || 'לא נבחר עובד'}
        </Row>
      </div>
      {forgotResult && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--v3-sp-2)', borderRadius: 'var(--v3-r-btn)', padding: 'var(--v3-sp-3) var(--v3-sp-4)', fontWeight: 'var(--v3-fw-medium)', ...(forgotResult.success ? { background: 'var(--v3-sky-100)', border: 'var(--v3-bw-hair) solid var(--v3-sky-300)', color: 'var(--v3-navy)' } : { background: 'var(--v3-rose-50)', border: 'var(--v3-bw-hair) solid var(--v3-rose-200)', color: 'var(--v3-plum)' }) }}>
          <Icon name={forgotResult.success ? 'check-circle' : 'alert-circle'} />
          <span>{forgotResult.message}</span>
        </div>
      )}
    </Dialog>
  );

  const resetDialog = (
    <Dialog
      open={resetRequired}
      onClose={() => {}}
      variant="form"
      nested
      closeOnScrim={false}
      icon="shield"
      title="בחרו סיסמה קבועה"
      sub="נכנסתם עם סיסמה זמנית"
      style={{ maxWidth: 'var(--v3-dlg-w)' }}
    >
      {resetError && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--v3-sp-2)', background: 'var(--v3-rose-50)', border: 'var(--v3-bw-hair) solid var(--v3-rose-200)', color: 'var(--v3-plum)', borderRadius: 'var(--v3-r-btn)', padding: 'var(--v3-sp-3) var(--v3-sp-4)', fontWeight: 'var(--v3-fw-medium)' }}>
          <Icon name="alert-circle" />
          <span>{resetError}</span>
        </div>
      )}
      <form onSubmit={handleSetNewPassword} className="v3-stack">
        <div className="v3-field">
          <label className="v3-label" htmlFor="login-newpass1">סיסמה חדשה</label>
          <div style={{ position: 'relative' }}>
            <Icon name="lock" style={{ position: 'absolute', insetInlineStart: 'var(--v3-sp-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--v3-navy-500)', pointerEvents: 'none' }} />
            <input id="login-newpass1" className="v3-input" style={{ paddingInlineStart: 'var(--v3-sp-8)' }} type="password" value={newPass1} onChange={(e) => setNewPass1(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <div className="v3-field">
          <label className="v3-label" htmlFor="login-newpass2">הקלידו שוב את הסיסמה</label>
          <div style={{ position: 'relative' }}>
            <Icon name="lock" style={{ position: 'absolute', insetInlineStart: 'var(--v3-sp-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--v3-navy-500)', pointerEvents: 'none' }} />
            <input id="login-newpass2" className="v3-input" style={{ paddingInlineStart: 'var(--v3-sp-8)' }} type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <Btn type="submit" variant="primary" size="lg" block loading={resetSaving}>
          {resetSaving ? 'שומר...' : 'שמירה והמשך'}
        </Btn>
      </form>
    </Dialog>
  );

  // Dialog portals itself to document.body (after its own mount), so both display
  // modes render the same tree; `mounted` is kept for parity with the old flow.
  void mounted;
  return (
    <V3Page page={false} sprite={!isModal} style={isModal ? { display: 'contents' } : undefined}>
      {loginCard}
      {forgotDialog}
      {resetDialog}
    </V3Page>
  );
}
