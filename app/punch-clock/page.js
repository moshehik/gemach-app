'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { V3Page, Btn, IconBtn, Banner, Tip } from '@/app/v3/ui/components';
import Icon from '@/app/v3/ui/Icon';
import useAskDialog from '@/app/components/v3misc/useAskDialog';

export default function PunchClockPage() {
  const [employees, setEmployees] = useState(null); // null = loading
  const [employeeId, setEmployeeId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Trusted system computer (מחשב מערכת) - same fast path as the login screen: on a
  // computer a manager marked trusted, the 4-character short code is accepted here too.
  const [deviceTrusted, setDeviceTrusted] = useState(false);
  const passwordInputRef = useRef(null);
  const { ask, node: askNode } = useAskDialog();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchSharedJson('/api/employees', { ttl: TTL.STATIC })
      .then(list => setEmployees(Array.isArray(list) ? list : []))
      .catch(() => setEmployees([]));
    fetch('/api/auth/device-status')
      .then(res => res.json())
      .then(data => setDeviceTrusted(!!data.trusted))
      .catch(() => setDeviceTrusted(false));
  }, []);

  const filteredEmployees = (employees || [])
    .filter(emp => `${emp.firstName} ${emp.lastName}`.includes(employeeSearch));

  const handlePunch = async (action) => {
    if (!employeeId || !password) {
      setStatusMessage('בחרו עובד מהרשימה והזינו סיסמה.');
      return;
    }

    // 30 - כובסת ביציאה: אם מופעל, לפני יציאה מציג רשימת לא-החזירו לאישור
    if (action === 'OUT') {
      try {
        const settingsRes = await fetch('/api/settings', { cache: 'no-store' });
        const arr = await settingsRes.json();
        const on = Array.isArray(arr) ? arr.find(s => s.key === 'laundress_return_check_on_exit')?.value === 'true' : false;
        if (on) {
          const overdue = await fetch('/api/orders?filterStatus=archive&limit=50', { cache: 'no-store' }).then(r => r.json()).then(d => {
            const list = d.data || [];
            return list.filter(o => o.items?.some(i => !i.isDeleted && i.isTaken && !i.isReturned));
          }).catch(() => []);
          if (overdue.length > 0) {
            const names = overdue.slice(0, 5).map(o => `${o.customerName || '?'}`).join(', ');
            const ok = await ask({
              title: 'יש פריטים שלא הוחזרו',
              sub: `${overdue.length} משפחות עדיין לא החזירו (למשל: ${names}). לוודא שהן באמת לא החזירו?`,
              icon: 'alert-tri',
              okLabel: 'בדקתי, להמשיך',
              cancelLabel: 'ביטול',
            });
            if (!ok) { setStatusMessage('היציאה בוטלה. בדקו את ההחזרות.'); return; }
          }
        }
      } catch {}
    }

    setIsLoading(true);
    setStatusMessage('');

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, password, action })
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(`שגיאה: ${data.error}`);
      } else {
        setStatusMessage(action === 'IN' ? 'הכניסה נרשמה' : 'היציאה נרשמה');
        setEmployeeId('');
        setEmployeeSearch('');
        setPassword('');
        // Hide success message after 3 seconds
        setTimeout(() => setStatusMessage(''), 3000);
      }
    } catch (e) {
      setStatusMessage('שגיאת תקשורת. נסו שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  const isError = statusMessage.includes('שגיאה');

  return (
    <V3Page>
      <div className="v3-stack">
        <div className="v3-pagehead">
          <div className="v3-pagehead__title">
            <h1 className="v3-h1">שעון נוכחות</h1>
            <Tip>בוחרים את השם, מקלידים סיסמה, ורושמים כניסה או יציאה.</Tip>
          </div>
        </div>

        <section className="v3-card v3-stack">
          <div className="v3-stack" role="timer" aria-label="השעה כעת">
            <span className="v3-label"><Icon name="clock" loop /> השעה עכשיו</span>
            <span className="v3-display"><bdi>{currentTime || '...'}</bdi></span>
          </div>

          <div className="v3-field">
            <label className="v3-label" htmlFor="punch-clock-employeeSearch">שם העובד</label>
            <div className="v3-combo">
              <input
                data-element-name="שדה_punch-clock_1"
                className="v3-input"
                id="punch-clock-employeeSearch"
                type="text"
                value={employeeSearch}
                placeholder={employees === null ? 'טוען עובדים...' : 'הקלידו שם לחיפוש'}
                // "new-password" ולא "off" - כרום מתעלם בפועל מ-off בשדות מהסוג הזה,
                // ובלעדיו הדפדפן מציג dropdown native משלו עם שמות שהוקלדו בעבר, מעל
                // רשימת ההצעות המותאמת-אישית של הרכיב (אותו באג שכבר תוקן ב-LoginScreen).
                autoComplete="new-password"
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setIsDropdownOpen(true);
                  setEmployeeId('');
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              />
              {isDropdownOpen && (
                <div className="v3-combo__p">
                  {employees === null ? (
                    <div className="v3-combo__empty" role="status">
                      <span className="v3-spin" aria-hidden="true" />
                      טוען עובדים...
                    </div>
                  ) : (
                    <ul className="v3-combo__list">
                      {filteredEmployees.map(emp => (
                        <li
                          key={emp.id}
                          className="v3-combo__o"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEmployeeId(emp.id.toString());
                            setEmployeeSearch(`${emp.firstName} ${emp.lastName}`);
                            setIsDropdownOpen(false);
                            passwordInputRef.current?.focus();
                          }}
                        >
                          <span className="v3-combo__oi"><Icon name="user" size="sm" /></span>
                          <span className="v3-combo__ox"><b>{emp.firstName} {emp.lastName}</b></span>
                        </li>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <li className="v3-combo__empty">אין עובד בשם הזה</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="v3-field">
            <label className="v3-label" htmlFor="punch-clock-password">
              {deviceTrusted ? 'סיסמה או קוד קצר' : 'סיסמה'}
              {deviceTrusted && <Tip>במחשב מערכת מאושר אפשר להזין גם את הקוד הקצר בן 4 התווים.</Tip>}
            </label>
            <div className="v3-cluster" style={{ flexWrap: 'nowrap' }}>
              <input
                data-element-name="שדה_punch-clock_2"
                ref={passwordInputRef}
                className="v3-input"
                style={{ flex: 1, minWidth: 0 }}
                id="punch-clock-password"
                type={showPassword ? 'text' : 'password'}
                dir="auto"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="הזינו סיסמה"
                autoComplete="new-password"
              />
              <IconBtn icon="eye" label="הצגת הסיסמה" title="הצג סיסמה" aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)} />
            </div>
          </div>

          <div className="v3-stack">
            <Btn
              data-element-name="כפתור_punch-clock_3"
              variant="primary"
              size="lg"
              block
              icon="check-circle"
              loading={isLoading}
              onClick={() => handlePunch('IN')}
            >
              כניסה
            </Btn>
            <Btn
              data-element-name="כפתור_punch-clock_4"
              variant="secondary"
              size="lg"
              block
              icon="logout"
              loading={isLoading}
              onClick={() => handlePunch('OUT')}
            >
              יציאה
            </Btn>
          </div>

          {statusMessage && (
            <Banner kind={isError ? 'alert' : 'success'} text={statusMessage} />
          )}
        </section>
      </div>
      {askNode}
    </V3Page>
  );
}
