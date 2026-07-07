'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    BUFFER_DAYS: '7',
    nedarim_plus_terminal: '',
    ENABLE_SET_DISCOUNTS: 'false'
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const dataObj = {};
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.key) dataObj[item.key] = item.value;
          });
        }
        setSettings(prev => ({ ...prev, ...dataObj }));
      })
      .catch(err => console.error('Error fetching settings:', err));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 'true' : 'false') : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    
    try {
      const keyNames = {
        'BUFFER_DAYS': 'ימי מרווח להזמנה',
        'PAYMENT_APPROVAL_LEVEL': 'אישור תשלום ללא העברת אשראי',
        'nedarim_plus_terminal': 'קוד מוסד נדרים פלוס',
        'ENABLE_SET_DISCOUNTS': 'הפעל מבצע סטים'
      };
      
      const payload = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        name: keyNames[key] || key
      }));

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save settings');
      
      setMessage('ההגדרות נשמרו בהצלחה!');
    } catch (error) {
      console.error(error);
      setMessage('שגיאה בשמירת הגדרות.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', direction: 'rtl' }}>
      <h1 style={{ color: 'var(--primary-color)', marginBottom: '2rem' }}>הגדרות מערכת (ניהול הנהלה)</h1>
      
      <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              ימי מרווח להזמנה (ימים להגבלה)
            </label>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              מספר הימים לפני ואחרי תאריך אירוע שבו השמלה נחשבת 'תפוסה' במלאי ולא ניתנת להזמנה במקביל.
            </p>
            <input 
              type="number" 
              name="BUFFER_DAYS" 
              value={settings.BUFFER_DAYS || ''} 
              onChange={handleChange}
              min="0"
              max="30"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', maxWidth: '200px' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              אישור תשלום ללא העברת אשראי
            </label>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              קובע מי מורשה לאשר תשלום (כמו מזומן או המחאה) ללא סליקת אשראי.
            </p>
            <select
              name="PAYMENT_APPROVAL_LEVEL"
              value={settings.PAYMENT_APPROVAL_LEVEL || 'כולם'}
              onChange={handleChange}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', maxWidth: '200px' }}
            >
              <option value="כולם">כולם</option>
              <option value="עובד">עובד</option>
              <option value="מנהל">מנהל</option>
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold' }}>
              <input 
                type="checkbox" 
                name="ENABLE_SET_DISCOUNTS" 
                checked={settings.ENABLE_SET_DISCOUNTS === 'true'} 
                onChange={handleChange}
                style={{ marginLeft: '0.5rem', width: '20px', height: '20px' }}
              />
              הפעל מבצע סטים (זיכוי אוטומטי על פריטים נלווים)
            </label>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', marginRight: '2rem' }}>
              אם מופעל, כאשר לקוח מזמין שמלה ראשית, פריטים המוגדרים כ"כלול ב..." יקבלו זיכוי (שורת חיוב שלילית) במעמד חישוב ההזמנה.
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              קוד מוסד (נדרים פלוס)
            </label>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              הקוד המזהה של המוסד במערכת נדרים פלוס, הנדרש עבור סליקת אשראי.
            </p>
            <input 
              type="text" 
              name="nedarim_plus_terminal" 
              value={settings.nedarim_plus_terminal || ''} 
              onChange={handleChange}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', maxWidth: '200px' }}
            />
          </div>

          <button 
            type="submit" 
            disabled={saving}
            style={{ padding: '0.75rem 2rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            {saving ? 'שומר...' : 'שמור הגדרות'}
          </button>
          
          {message && (
            <span style={{ marginRight: '1rem', color: message.includes('שגיאה') ? '#e53935' : '#2e7d32', fontWeight: 'bold' }}>
              {message}
            </span>
          )}
        </form>
      </div>
    </main>
  );
}
