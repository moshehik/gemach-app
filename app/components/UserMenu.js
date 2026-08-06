'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle, LogOut, Clock, CheckCircle, LogIn, Monitor, IdCard } from 'lucide-react';
import LoginScreen from './LoginScreen';
import { fetchSharedJson, TTL } from '@/lib/apiCache';

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isGlobalFetching, setIsGlobalFetching] = useState(false);
  
  const menuRef = useRef(null);

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
        // Log as string to prevent Next.js dev overlay from catching the Error object
        if (!(err?.message || '').includes('HTTP 401')) {
          console.warn('Network or fetch error checking user session:', err.message || 'Failed to fetch');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const handleLogout = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout error:', err.message || 'Failed to fetch');
    } finally {
      // רענון מלא ולא router.refresh — מאותה סיבה כמו בהתחברות: ה-navbar
      // (שרת) וה-UserMenu (מטמון /api/me בזיכרון) מיושרים רק בטעינת עמוד נקייה.
      window.location.href = '/';
    }
  };

  const handlePunch = async (action) => {
    if (!user) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user.id,
          action: action
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (action === 'IN') {
          setActiveShift(data.shift);
        } else {
          setActiveShift(null);
        }
      } else {
        alert(data.error || 'שגיאה בדיווח נוכחות');
      }
    } catch (err) {
      alert('שגיאת תקשורת');
    } finally {
      setActionLoading(false);
      setDropdownOpen(false);
    }
  };

  if (loading) {
    return <div className="nav-avatar-skeleton" />;
  }

  if (!user) {
    return (
      <>
        {showLoginModal && <LoginScreen data-element-name="רכיב_UserMenu_1" isModal={true} onClose={() => setShowLoginModal(false)} />}
        <div className="user-menu" style={{ position: 'relative' }} ref={menuRef}>
        <button data-element-name="כפתור_UserMenu_2"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          title="אורח — התחברות לא פעילה"
          className="icon-nav-link avatar-nav-link is-guest"
        >
          א
        </button>

        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '0.5rem',
            background: 'var(--card-bg)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            minWidth: '220px',
            zIndex: 100,
            border: '1px solid var(--divider)',
            overflow: 'hidden'
          }}>
            {/* שם המשתמש והמצב ירדו מהכותרת לכאן, כדי שהטריגר יישאר אייקון בלבד */}
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--divider)', background: 'var(--element-bg)' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                אורח
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                התחברות לא פעילה
              </p>
            </div>
            <div style={{ padding: '0.5rem' }}>
              <button data-element-name="כפתור_UserMenu_3"
                onClick={() => {
                  setDropdownOpen(false);
                  setShowLoginModal(true);
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0.75rem', background: 'var(--btn-light-green-bg)', color: 'var(--success-text)',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: '500'
                }}
                className="user-menu-item"
              >
                <LogIn data-element-name="רכיב_UserMenu_4" size={18} />
                היכנס למערכת
              </button>
            </div>
            <div style={{ padding: '0.5rem', borderTop: '1px solid var(--divider)' }}>
              <button data-element-name="כפתור_UserMenu_5"
                onClick={() => {
                  setDropdownOpen(false);
                  window.dispatchEvent(new Event('show-screensaver'));
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0.75rem', background: 'transparent', color: 'var(--text-muted)',
                  border: 'none', borderRadius: '8px', cursor: 'pointer'
                }}
                className="user-menu-item"
              >
                <Monitor data-element-name="רכיב_UserMenu_6" size={18} />
                שומר מסך
              </button>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  return (
    <div className="user-menu" style={{ position: 'relative' }} ref={menuRef}>
      <button data-element-name="כפתור_UserMenu_7"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        title={`${user.firstName} ${user.lastName} — ${activeShift ? 'בעבודה' : 'לא בעבודה'}`}
        className={`icon-nav-link avatar-nav-link${activeShift ? ' is-online' : ''}`}
      >
        {user.firstName ? user.firstName.charAt(0) : 'U'}
        <span className="nav-avatar-status" />
        {isGlobalFetching && <span className="nav-avatar-spinner" title="טוען נתונים..." />}
      </button>

      {dropdownOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '0.5rem',
          background: 'var(--card-bg)',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          minWidth: '220px',
          zIndex: 100,
          border: '1px solid var(--divider)',
          overflow: 'hidden'
        }}>
          {/* השם המלא ומצב המשמרת ירדו מהכותרת לכאן — הטריגר עצמו נשאר אווטאר בלבד */}
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--divider)', background: 'var(--element-bg)' }}>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              שלום, {user.firstName}
            </p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {user.firstName} {user.lastName}
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: activeShift ? 'var(--success-text)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeShift ? 'var(--success-text)' : 'var(--element-border)' }} />
              {activeShift ? 'בעבודה' : 'לא בעבודה'}
            </p>
          </div>

          <div style={{ padding: '0.5rem' }}>
            {!activeShift ? (
              <button data-element-name="כפתור_UserMenu_8" 
                onClick={() => handlePunch('IN')}
                disabled={actionLoading}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0.75rem', background: 'var(--btn-light-green-bg)', color: 'var(--success-text)',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: '500'
                }}
                className="user-menu-item"
              >
                <LogIn data-element-name="רכיב_UserMenu_9" size={18} />
                כניסה לעבודה (שעון נוכחות)
              </button>
            ) : (
              <button data-element-name="כפתור_UserMenu_10" 
                onClick={() => handlePunch('OUT')}
                disabled={actionLoading}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0.75rem', background: 'var(--banner-debts-bg)', color: 'var(--danger-text)',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: '500'
                }}
                className="user-menu-item"
              >
                <LogOut data-element-name="רכיב_UserMenu_11" size={18} />
                יציאה ממשמרת
              </button>
            )}
          </div>

          <div style={{ padding: '0.5rem', borderTop: '1px solid var(--divider)' }}>
            <button data-element-name="כפתור_UserMenu_profile"
              onClick={() => {
                setDropdownOpen(false);
                router.push('/profile');
              }}
              disabled={actionLoading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0.75rem', background: 'transparent', color: 'var(--text-muted)',
                border: 'none', borderRadius: '8px', cursor: 'pointer'
              }}
              className="user-menu-item"
            >
              <IdCard data-element-name="רכיב_UserMenu_profile_icon" size={18} />
              הפרופיל שלי
            </button>
            <button data-element-name="כפתור_UserMenu_12"
              onClick={handleLogout}
              disabled={actionLoading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0.75rem', background: 'transparent', color: 'var(--text-muted)',
                border: 'none', borderRadius: '8px', cursor: 'pointer'
              }}
              className="user-menu-item"
            >
              <UserCircle data-element-name="רכיב_UserMenu_13" size={18} />
              התנתק / החלף משתמש
            </button>
            <button data-element-name="כפתור_UserMenu_14" 
              onClick={() => {
                setDropdownOpen(false);
                window.dispatchEvent(new Event('show-screensaver'));
              }}
              disabled={actionLoading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0.75rem', background: 'transparent', color: 'var(--text-muted)',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                marginTop: '4px'
              }}
              className="user-menu-item"
            >
              <Monitor data-element-name="רכיב_UserMenu_15" size={18} />
              שומר מסך
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
