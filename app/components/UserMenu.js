'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
    function handleEscape(event) {
      if (event.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuRef]);

  const handleLogout = async () => {
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
    return <div className="avatar skeleton" style={{ width: 34, height: 34 }} />;
  }

  if (!user) {
    return (
      <>
        {showLoginModal && <LoginScreen isModal={true} onClose={() => setShowLoginModal(false)} />}
        <div className={`user-menu${dropdownOpen ? ' open' : ''}`} ref={menuRef}>
          <div
            className="user-chip"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title="אורח — התחברות לא פעילה"
          >
            <div className="avatar">א</div>
          </div>
          {dropdownOpen && (
            <div className="user-menu-dropdown">
              <div className="user-menu-head">
                <div className="avatar">א</div>
                <div>
                  <strong>אורח</strong>
                  <span>התחברות לא פעילה</span>
                </div>
              </div>
              <button
                type="button"
                className="user-menu-item"
                onClick={() => { setDropdownOpen(false); setShowLoginModal(true); }}
              >
                <svg className="icon"><use href="#i-logout" /></svg>
                היכנס למערכת
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className={`user-menu${dropdownOpen ? ' open' : ''}`} id="userMenu" ref={menuRef}>
      <div
        className="user-chip"
        id="userMenuToggle"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        title={`${user.firstName} ${user.lastName} — ${activeShift ? 'בעבודה' : 'לא בעבודה'}`}
      >
        <div className="avatar">
          {(user.firstName ? user.firstName.charAt(0) : '') + (user.lastName ? user.lastName.charAt(0) : '') || 'U'}
          <span className={`status-dot ${activeShift ? 'online' : 'offline'}`} />
        </div>
        {isGlobalFetching && <span className="spinner" title="טוען נתונים..." style={{ width: 14, height: 14 }} />}
      </div>

      {dropdownOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-head">
            <div className="avatar">
              {(user.firstName ? user.firstName.charAt(0) : '') + (user.lastName ? user.lastName.charAt(0) : '') || 'U'}
              <span className={`status-dot ${activeShift ? 'online' : 'offline'}`} />
            </div>
            <div>
              <strong>{user.firstName} {user.lastName}</strong>
              <span>
                {activeShift && (
                  <svg className="icon" style={{ width: '9px', height: '9px', color: 'var(--success)' }}><use href="#i-check-circle" /></svg>
                )}
                {' '}{activeShift ? 'בעבודה כעת' : 'לא בעבודה'}{user.department?.name ? ` · ${user.department.name}` : ''}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="user-menu-item"
            disabled={actionLoading}
            onClick={() => { setDropdownOpen(false); router.push('/profile'); }}
          >
            <svg className="icon"><use href="#i-user" /></svg>
            הפרופיל שלי
          </button>
          <button
            type="button"
            className="user-menu-item"
            disabled={actionLoading}
            onClick={() => { setDropdownOpen(false); router.push('/punch-clock'); }}
          >
            <svg className="icon"><use href="#i-clock" /></svg>
            שעון נוכחות
          </button>
          <button
            type="button"
            className="user-menu-item"
            disabled={actionLoading}
            onClick={() => { setDropdownOpen(false); router.push('/messages'); }}
          >
            <svg className="icon"><use href="#i-message" /></svg>
            הודעות
          </button>
          <button
            type="button"
            className="user-menu-item"
            disabled={actionLoading}
            onClick={() => { setDropdownOpen(false); router.push('/display-settings'); }}
          >
            <svg className="icon"><use href="#i-settings" /></svg>
            עיצוב ותצוגה — התאמה אישית
          </button>
          <div className="user-menu-divider" />
          <button type="button" className="user-menu-item danger" onClick={handleLogout} disabled={actionLoading}>
            <svg className="icon"><use href="#i-logout" /></svg>
            התנתקות
          </button>
        </div>
      )}
    </div>
  );
}
