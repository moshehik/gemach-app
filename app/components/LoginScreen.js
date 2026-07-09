'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, LogIn } from 'lucide-react';

export default function LoginScreen() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data);
        }
      })
      .catch(err => console.error('Failed to load employees:', err));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !password) {
      setError('נא לבחור עובד ולהזין סיסמה');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedEmployee, password })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        router.refresh();
      } else {
        setError(data.message || 'שגיאה בהתחברות');
      }
    } catch (err) {
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      backgroundImage: 'radial-gradient(circle at 50% -20%, #3b82f6 0%, transparent 40%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem'
    }} dir="rtl">
      
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '3rem 2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(59, 130, 246, 0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: '76px',
            height: '76px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4), inset 0 2px 4px rgba(255,255,255,0.3)',
            transform: 'rotate(-5deg)'
          }}>
            <Lock size={34} color="white" strokeWidth={2.5} style={{ transform: 'rotate(5deg)' }} />
          </div>
          <h2 style={{ fontSize: '2.1rem', fontWeight: '800', color: 'white', margin: '0 0 0.5rem 0', letterSpacing: '-0.025em' }}>
            כניסת עובדים
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '1.05rem' }}>
            נא להזדהות על מנת להמשיך למערכת
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              padding: '1rem',
              borderRadius: '12px',
              fontSize: '0.95rem',
              textAlign: 'center',
              fontWeight: '500',
              animation: 'shake 0.4s ease-in-out'
            }}>
              {error}
            </div>
          )}
          
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              שם העובד
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: selectedEmployee ? 'white' : '#64748b',
                  padding: '1.1rem 3.2rem 1.1rem 1rem',
                  borderRadius: '14px',
                  fontSize: '1rem',
                  appearance: 'none',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.25)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.boxShadow = 'none'; }}
              >
                <option value="" style={{ color: '#0f172a' }}>-- בחר מהרשימה --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id} style={{ color: '#0f172a' }}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
              <User size={20} color={selectedEmployee ? '#3b82f6' : '#64748b'} style={{ position: 'absolute', right: '1.1rem', top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s' }} />
            </div>
          </div>
          
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              קוד כניסה
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="הזן את הקוד שלך"
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  padding: '1.1rem 3.2rem 1.1rem 1rem',
                  borderRadius: '14px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  letterSpacing: password.length > 0 ? '0.2em' : 'normal'
                }}
                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.25)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.boxShadow = 'none'; }}
              />
              <Lock size={20} color={password ? '#3b82f6' : '#64748b'} style={{ position: 'absolute', right: '1.1rem', top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s' }} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '1.5rem',
              width: '100%',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '1.1rem',
              borderRadius: '14px',
              fontSize: '1.15rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: loading ? 0.8 : 1,
              boxShadow: '0 8px 20px -6px rgba(37, 99, 235, 0.6)'
            }}
            onMouseOver={(e) => { if(!loading) { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 25px -6px rgba(37, 99, 235, 0.7)'; } }}
            onMouseOut={(e) => { if(!loading) { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 8px 20px -6px rgba(37, 99, 235, 0.6)'; } }}
            onMouseDown={(e) => { if(!loading) { e.target.style.transform = 'translateY(1px)'; e.target.style.boxShadow = '0 4px 10px -6px rgba(37, 99, 235, 0.6)'; } }}
            onMouseUp={(e) => { if(!loading) { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 25px -6px rgba(37, 99, 235, 0.7)'; } }}
          >
            {loading ? (
              <span style={{ display: 'inline-block', width: '22px', height: '22px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
            ) : (
              <>
                <LogIn size={22} />
                היכנס למערכת
              </>
            )}
          </button>
        </form>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
            20%, 40%, 60%, 80% { transform: translateX(4px); }
          }
          * { box-sizing: border-box; }
        `}} />
      </div>
    </div>
  );
}
