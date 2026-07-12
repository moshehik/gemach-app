'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle, LogOut, Clock, CheckCircle, LogIn } from 'lucide-react';

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
      .catch(err => console.error('Error fetching user:', err))
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
    await fetch('/api/logout', { method: 'POST' });
    router.refresh();
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
      <div className="user-menu" style={{ position: 'relative' }}>
        <div 
          style={{ 
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            borderRadius: '24px',
          }}
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
        </div>
      </div>
    );
  }

  return (
    <div className="user-menu" style={{ position: 'relative' }} ref={menuRef}>
      <button 
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
              <button 
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
                <LogIn size={18} />
                כניסה לעבודה (שעון נוכחות)
              </button>
            ) : (
              <button 
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
                <LogOut size={18} />
                יציאה ממשמרת
              </button>
            )}
          </div>

          <div style={{ padding: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
            <button 
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
              <UserCircle size={18} />
              התנתק / החלף משתמש
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
