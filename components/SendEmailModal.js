'use client';
import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';

export default function SendEmailModal({ isOpen, onClose, defaultTo, customerId, employeeId }) {
  const [formData, setFormData] = useState({
    to: defaultTo || '',
    cc: '',
    subject: '',
    body: '',
    username: '',
    password: ''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (defaultTo) {
      setFormData(prev => ({ ...prev, to: defaultTo }));
    }
  }, [defaultTo]);

  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => {
        // Filter by manager (1) or programmer (2)
        const filtered = data.filter(emp => emp.roleId === 1 || emp.roleId === 2);
        setAdmins(filtered);
      })
      .catch(console.error);
  }, []);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let fileContent = '';
      let fileName = '';

      if (file) {
        fileContent = await convertFileToBase64(file);
        fileName = file.name;
      }

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          emailBody: formData.body,
          fileName,
          fileContent,
          customerId,
          employeeId
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('המייל נשלח בהצלחה!');
        setTimeout(() => {
          onClose();
          setSuccess('');
          setFormData(prev => ({ ...prev, subject: '', body: '', cc: '', username: '', password: '' }));
          setFile(null);
        }, 2000);
      } else {
        setError(data.message || 'שגיאה בשליחת המייל');
      }
    } catch (err) {
      console.error(err);
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', 
    padding: '0.75rem', 
    borderRadius: '8px', 
    border: '1px solid var(--element-border)',
    outline: 'none',
    fontFamily: 'inherit'
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} dir="rtl">
      <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '500px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0, color: 'var(--primary-color)', marginBottom: '1.5rem', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>שליחת מייל</h2>
        
        {success ? (
          <div style={{ background: '#d4edda', color: '#155724', padding: '1rem', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>
            {success}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {error && <div style={{ background: '#f8d7da', color: '#721c24', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>{error}</div>}
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: '0.9rem' }}>אל (To):</label>
              <input type="email" name="to" value={formData.to} onChange={handleChange} required style={inputStyle} dir="ltr" />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: '0.9rem' }}>עותק (CC):</label>
              <input type="email" name="cc" value={formData.cc} onChange={handleChange} style={inputStyle} dir="ltr" />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: '0.9rem' }}>נושא:</label>
              <input type="text" name="subject" value={formData.subject} onChange={handleChange} required style={inputStyle} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: '0.9rem' }}>תוכן:</label>
              <textarea name="body" value={formData.body} onChange={handleChange} required style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold', fontSize: '0.9rem' }}>קובץ מצורף:</label>
              <input type="file" onChange={handleFileChange} style={inputStyle} />
            </div>

            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', border: '1px solid #e9ecef', marginTop: '0.5rem' }}>
              <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold', color: '#495057', fontSize: '0.95rem' }}>אימות מנהל לשליחה:</p>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>שם משתמש (מנהל):</label>
                <select name="username" value={formData.username} onChange={handleChange} required style={inputStyle}>
                  <option value="">-- בחר מנהל/מתכנת --</option>
                  {admins.map(admin => (
                    <option key={admin.id} value={admin.id}>{admin.firstName} {admin.lastName || ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>סיסמה:</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} required style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Send size={18} />
                {loading ? 'שולח...' : 'שלח מייל'}
              </button>
              <button type="button" onClick={onClose} disabled={loading} className="btn btn-outline" style={{ flex: 1, padding: '0.75rem' }}>
                ביטול
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
