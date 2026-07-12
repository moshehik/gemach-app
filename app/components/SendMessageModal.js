'use client';
import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';

export default function SendMessageModal({ isOpen, onClose, onSuccess }) {
  const [employees, setEmployees] = useState([]);
  const [receiverId, setReceiverId] = useState('all');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Fetch employees for the dropdown
      fetch('/api/employees')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setEmployees(data.employees || []);
          }
        })
        .catch(err => console.error('Failed to fetch employees:', err));
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!content.trim()) {
      setError('יש להזין תוכן להודעה');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId,
          content
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setContent('');
        setReceiverId('all');
        onSuccess();
      } else {
        setError(data.error || 'שגיאה בשליחת הודעה');
      }
    } catch (err) {
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--card-bg)',
        width: '90%',
        maxWidth: '450px',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-color)' }}>שליחת הודעה</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: '#ef4444', fontSize: '0.9rem', background: '#fef2f2', padding: '0.5rem', borderRadius: '6px' }}>{error}</div>}
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-color)', fontWeight: '500' }}>נמען:</label>
            <select 
              value={receiverId} 
              onChange={e => setReceiverId(e.target.value)}
              className="form-control"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
            >
              <option value="all">כולם</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-color)', fontWeight: '500' }}>תוכן ההודעה:</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="form-control"
              placeholder="כתוב הודעה כאן..."
              style={{ width: '100%', height: '120px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', resize: 'none' }}
            />
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', background: 'var(--input-bg)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', color: '#64748b', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}
          >
            ביטול
          </button>
          <button 
            onClick={handleSend}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#2563eb', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'שולח...' : <><Send size={16} /> שליחה</>}
          </button>
        </div>
      </div>
    </div>
  );
}
