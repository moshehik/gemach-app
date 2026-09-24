'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginScreen from './LoginScreen';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { Icon } from '@/app/v3/ui';
import { useTopbarPanel } from './topbarPanel';

export default function UserMenu({ hideInternalMessaging = false, children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isGlobalFetching, setIsGlobalFetching] = useState(false);

  const { open: dropdownOpen, close: closeMenu, itemProps, triggerProps } = useTopbarPanel({ hover: true });

  useEffect(() => {
    const handleFetchStart = () => setIsGlobalFetching(true);
    const handleFetchEnd = () => setIsGlobalFetching(false);
    window.addEventListener('app-data-fetching-start', handleFetchStart);
    window.addEventListener('app-data-fetching-end', handleFetchEnd);
    return () => {
      window.removeEventListener('app-data-fetching-start', handleFetchStart);
      window.removeEventListener('app-data-fetching-end', handleFetchEnd);
    };
  }, []);

  useEffect(() => {
    // מטמון משותף — אותה קריאת /api/me משרתת גם את PopupProvider ודפים נוספים.
    // 401 (לא מחובר) נזרק כשגיאה מהמטמון ומטופל כ"אורח" בדיוק כמו קודם.
    fetchSharedJson('/api/me', { ttl: TTL.STATIC })
      .then(data => {
        if (data && data.success) {
          setUser(data.employee);
          setActiveShift(data.activeShift);
        }
      })
      .catch(err => {
        // 401 = לא מחובר (מצב אורח רגיל) — לא שגיאה אמיתית.
        if (!(err?.message || '').includes('HTTP 401')) {
          console.warn('Network or fetch error checking user session:', err.message || 'Failed to fetch');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    // דיווח משתמשת (749aaf87, 2026-09-09): תזכורת על משפחות באיחור גם ביציאה, לא רק
    // בכניסה/כל שעה (ר' OverdueRemindersWatcher.js) - דיאלוג חוסם (window.customConfirm,
    // לא alert/toast) כדי שבאמת תספיק לראות אותו לפני שהעמוד מתרענן; best-effort - אם
    // השרת/הרשת לא זמינים כרגע, לא חוסמים את ההתנתקות עצמה.
    try {
      const overdueRes = await fetch('/api/orders/overdue', { cache: 'no-store' });
      if (overdueRes.ok) {
        const overdueData = await overdueRes.json();
        if (Array.isArray(overdueData.orders) && overdueData.orders.length > 0) {
          const proceed = await window.customConfirm(
            `יש ${overdueData.orders.length} משפחות שעדיין לא החזירו שמלות ומועד ההחזרה שלהן עבר. לצאת בכל זאת?`
          );
          if (!proceed) return;
        }
      }
    } catch (e) {
      // ignore - לא קשור להצלחת ההתנתקות עצמה
    }

    setActionLoading(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout error:', err.message || 'Failed to fetch');
    } finally {
      // רענון מלא ולא router.refresh — ה-navbar (שרת) וה-UserMenu (מטמון /api/me) מיושרים רק בטעינת עמוד נקייה.
      window.location.href = '/';
    }
  };

  if (loading) {
    return <div className="v3-user v3-user--skeleton" aria-hidden="true"><span className="v3-user__av" /></div>;
  }

  if (!user) {
    return (
      <>
        {showLoginModal && <LoginScreen isModal={true} onClose={() => setShowLoginModal(false)} />}
        <div {...itemProps}>
          <button
            type="button"
            {...triggerProps}
            className="v3-user"
            aria-label="תפריט משתמש - אורח"
            title="אורח — התחברות לא פעילה"
          >
            <span className="v3-user__av">א</span>
            <span className="v3-user__name">אורח</span>
            <Icon name="chevron-down" className="v3-topbar__chev" anim={false} />
          </button>
          <div className="v3-topbar__panel v3-tb-panel" role="menu" aria-label="משתמש">
            <div className="v3-uhead">
              <span className="v3-user__av v3-user__av--lg">א</span>
              <div>
                <strong>אורח</strong>
                <span>התחברות לא פעילה</span>
              </div>
            </div>
            <button
              type="button"
              className="v3-link"
              role="menuitem"
              data-tbl
              onClick={() => { closeMenu(false); setShowLoginModal(true); }}
            >
              <span className="v3-link__ic"><Icon name="logout" /></span>
              היכנס למערכת
            </button>
          </div>
        </div>
      </>
    );
  }

  const initials = (user.firstName ? user.firstName.charAt(0) : '') + (user.lastName ? user.lastName.charAt(0) : '') || 'U';
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

  return (
    <>
      <ShiftClock activeShift={activeShift} />
      <div {...itemProps} id="userMenu">
        <button
          type="button"
          {...triggerProps}
          className="v3-user"
          id="userMenuToggle"
          aria-label={`תפריט משתמש - ${fullName}`}
          title={`${fullName} — ${activeShift ? 'בעבודה' : 'לא בעבודה'}`}
        >
          <span className="v3-user__av">
            {initials}
            <span className={`v3-user__dot ${activeShift ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
          </span>
          <span className="v3-user__name">{user.firstName}</span>
          {isGlobalFetching
            ? <Icon name="loader" size="xs" loop title="טוען נתונים..." />
            : <Icon name="chevron-down" className="v3-topbar__chev" anim={false} />}
        </button>

        <div className="v3-topbar__panel v3-tb-panel" role="menu" aria-label="משתמש">
          <div className="v3-uhead">
            <span className="v3-user__av v3-user__av--lg">
              {initials}
              <span className={`v3-user__dot ${activeShift ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
            </span>
            <div>
              <strong>{fullName}</strong>
              <span>
                {activeShift ? 'בעבודה כעת' : 'לא בעבודה'}{user.department?.name ? ` · ${user.department.name}` : ''}
              </span>
            </div>
          </div>

          <button type="button" className="v3-link" role="menuitem" data-tbl disabled={actionLoading}
            onClick={() => { closeMenu(false); router.push('/profile'); }}>
            <span className="v3-link__ic"><Icon name="user" /></span>הפרופיל שלי
          </button>
          <button type="button" className="v3-link" role="menuitem" data-tbl disabled={actionLoading}
            onClick={() => { closeMenu(false); router.push('/punch-clock'); }}>
            <span className="v3-link__ic"><Icon name="clock" /></span>שעון נוכחות
          </button>
          <button type="button" className="v3-link" role="menuitem" data-tbl disabled={actionLoading}
            onClick={() => { closeMenu(false); router.push('/my-hours'); }}>
            <span className="v3-link__ic"><Icon name="calendar" /></span>שעות העבודה שלי
          </button>
          {!hideInternalMessaging && (
            <button type="button" className="v3-link" role="menuitem" data-tbl disabled={actionLoading}
              onClick={() => { closeMenu(false); router.push('/messages'); }}>
              <span className="v3-link__ic"><Icon name="message" /></span>הודעות
            </button>
          )}
          <button type="button" className="v3-link" role="menuitem" data-tbl disabled={actionLoading}
            onClick={() => { closeMenu(false); router.push('/display-settings'); }}>
            <span className="v3-link__ic"><Icon name="settings" /></span>עיצוב ותצוגה — התאמה אישית
          </button>
          {children}
          <div className="v3-sep" role="separator" />
          <button type="button" className="v3-link v3-link--danger" role="menuitem" data-tbl onClick={handleLogout} disabled={actionLoading}>
            <span className="v3-link__ic"><Icon name="logout" /></span>התנתקות
          </button>
        </div>
      </div>
    </>
  );
}

// שעון משמרת (תצוגה בלבד): זמן שחלף מ-activeShift.entryTime שכבר מגיע מ-/api/me. אין קריאת רשת נוספת.
function ShiftClock({ activeShift }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeShift?.entryTime) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [activeShift?.entryTime]);
  if (!activeShift?.entryTime) return null;
  const start = new Date(activeShift.entryTime).getTime();
  if (!Number.isFinite(start) || start > now + 60000) return null;
  const mins = Math.max(0, Math.floor((now - start) / 60000));
  const text = `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
  return (
    <span className="v3-clock" title="משמרת נוכחית - זמן מתחילת הכניסה">
      <i aria-hidden="true" />במשמרת <bdi>{text}</bdi>
    </span>
  );
}
