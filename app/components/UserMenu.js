'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle, LogOut, Clock, CheckCircle, LogIn, Monitor } from 'lucide-react';
import LoginScreen from './LoginScreen';

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const menuRef = useRef(null);

  useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.employee);
          setActiveShift(data.activeShift);
        }
      })
      .catch(err => {
        // Log as string to prevent Next.js dev overlay from catching the Error object
        console.warn('Network or fetch error checking user session:', err.message || 'Failed to fetch');
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
      router.refresh();
      setActionLoading(false);
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
    return <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />;
  }

  if (!user) {
    return (
      <>
        {showLoginModal && <LoginScreen data-element-name="רכיב_UserMenu_1" isModal={true} onClose={() => setShowLoginModal(false)} />}
        <div className="user-menu" style={{ position: 'relative' }} ref={menuRef}>
        <button data-element-name="כפתור_UserMenu_2" 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{ 
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            borderRadius: '24px',
            cursor: 'pointer'
          }}
          className="hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', 
            background: '#94a3b8', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: '1.1rem'
          }}>
            א
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
              אורח
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              התחברות לא פעילה
            </span>
          </div>
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
            border: '1px solid #f1f5f9',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '0.5rem' }}>
              <button data-element-name="כפתור_UserMenu_3" 
                onClick={() => {
                  setDropdownOpen(false);
                  setShowLoginModal(true);
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0.75rem', background: '#ecfdf5', color: '#059669',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: '500', transition: 'background 0.2s'
                }}
                className="hover:bg-green-100 dark:hover:bg-green-900"
              >
                <LogIn data-element-name="רכיב_UserMenu_4" size={18} />
                היכנס למערכת
              </button>
            </div>
            <div style={{ padding: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
              <button data-element-name="כפתור_UserMenu_5" 
                onClick={() => {
                  setDropdownOpen(false);
                  window.dispatchEvent(new Event('show-screensaver'));
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0.75rem', background: 'transparent', color: '#64748b',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                className="hover:bg-gray-100 dark:hover:bg-gray-700"
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
        style={{ 
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '24px',
          transition: 'background 0.2s'
        }}
        className="hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%', 
          background: 'var(--primary-color)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', fontSize: '1.1rem'
        }}>
          {user.firstName ? user.firstName.charAt(0) : 'U'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
            {user.firstName} {user.lastName}
          </span>
          <span style={{ fontSize: '0.75rem', color: activeShift ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeShift ? '#10b981' : '#cbd5e1' }} />
            {activeShift ? 'בעבודה' : 'לא בעבודה'}
          </span>
        </div>
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
          border: '1px solid #f1f5f9',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem', color: '#334155' }}>
              שלום, {user.firstName}
            </p>
          </div>
          
          <div style={{ padding: '0.5rem' }}>
            {!activeShift ? (
              <button data-element-name="כפתור_UserMenu_8" 
                onClick={() => handlePunch('IN')}
                disabled={actionLoading}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0.75rem', background: '#ecfdf5', color: '#059669',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: '500', transition: 'background 0.2s'
                }}
                className="hover:bg-green-100"
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
                  padding: '0.75rem', background: '#fef2f2', color: '#dc2626',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: '500', transition: 'background 0.2s'
                }}
                className="hover:bg-red-100"
              >
                <LogOut data-element-name="רכיב_UserMenu_11" size={18} />
                יציאה ממשמרת
              </button>
            )}
          </div>

          <div style={{ padding: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
            <button data-element-name="כפתור_UserMenu_12" 
              onClick={handleLogout}
              disabled={actionLoading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0.75rem', background: 'transparent', color: '#64748b',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              className="hover:bg-gray-100"
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
                padding: '0.75rem', background: 'transparent', color: '#64748b',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                transition: 'background 0.2s',
                marginTop: '4px'
              }}
              className="hover:bg-gray-100 dark:hover:bg-gray-700"
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
