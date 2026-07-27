'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    BUFFER_DAYS: '7',
    nedarim_plus_terminal: '',
    ENABLE_SET_DISCOUNTS: 'false',
    require_login: 'false',
    inventory_include_warehouse: 'false',
    hide_internal_messaging: 'false',
    print_rental_box1: 'נבקש לבדוק עוד היום שההזמנה סופקה.\nהדרכים ליצירת קשר-\nבמייל- amechubad@gmail.com\nבטלפון- בין השעות 10:00- 11:00 בבוקר.',
    print_rental_box2: 'יש להחזיר את השמלות עם רוכסן סגור ושרוולים מסודרים כפי שקיבלתם אותם',
    print_rental_footer: 'שמרנו על תקנון הגמ"ח, לא כיבסנו ולא עשינו תיקונים לבד!'
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
        'ENABLE_SET_DISCOUNTS': 'הפעל מבצע סטים',
        'require_login': 'חובת התחברות למערכת',
        'inventory_include_warehouse': 'ספירת מלאי מחסן',
        'print_rental_box1': 'הערות השכרה - תיבה 1',
        'print_rental_box2': 'הערות השכרה - תיבה 2',
        'print_rental_footer': 'הערות השכרה - טקסט תחתון / תקנון',
        'hide_internal_messaging': 'הסתר מערכת הודעות'
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
      
      <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
        <form onSubmit={handleSave}>
          
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--element-bg)', borderRadius: '8px', border: '1px solid var(--element-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-main)' }}>
              <input 
                type="checkbox" 
                name="inventory_include_warehouse" 
                checked={settings.inventory_include_warehouse === 'true'} 
                onChange={handleChange}
                style={{ marginLeft: '0.5rem', width: '20px', height: '20px' }}
              />
              הצג וספור במלאי גם פריטים הנמצאים במחסן/רזרבה
            </label>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', marginRight: '2rem' }}>
              אם מסומן, מלאי שמוגדר במיקום מחסן או רזרבה ייספר כמלאי זמין ויוצג למשתמש. (ברירת מחדל: לא)
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              מסוף נדרים פלוס
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
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', maxWidth: '200px' }}
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
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', maxWidth: '200px' }}
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

          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--element-bg)', borderRadius: '8px', border: '1px solid var(--element-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-main)' }}>
              <input 
                type="checkbox" 
                name="require_login" 
                checked={settings.require_login === 'true'} 
                onChange={handleChange}
                style={{ marginLeft: '0.5rem', width: '20px', height: '20px' }}
              />
              דרוש התחברות עם קוד עובד וסיסמה (נעילת מערכת)
            </label>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', marginRight: '2rem' }}>
              אם מופעל, משתמשים יצטרכו להזין קוד עובד וסיסמה בכניסה למערכת. מומלץ לוודא שמוגדרים עובדים עם סיסמאות לפני הפעלת אפשרות זו.
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--element-bg)', borderRadius: '8px', border: '1px solid var(--element-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-main)' }}>
              <input 
                type="checkbox" 
                name="hide_internal_messaging" 
                checked={settings.hide_internal_messaging === 'true'} 
                onChange={handleChange}
                style={{ marginLeft: '0.5rem', width: '20px', height: '20px' }}
              />
              הסתר את מערכת ההודעות הפנימיות
            </label>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', marginRight: '2rem' }}>
              אם מסומן, פעמון ההתראות ומערכת ההודעות בין העובדים יוסתרו מהמערכת. (מצריך רענון דף להחלה)
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
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', maxWidth: '200px' }}
            />
          </div>

          <h3 style={{ color: 'var(--primary-color)', marginTop: '2rem', marginBottom: '1rem', borderBottom: '1px solid var(--element-border)', paddingBottom: '0.5rem' }}>
            הגדרות הדפסה - כרטיס השכרה
          </h3>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              הערות השכרה - תיבה עליונה
            </label>
            <textarea 
              name="print_rental_box1" 
              value={settings.print_rental_box1 || ''} 
              onChange={handleChange}
              rows="4"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              הערות השכרה - תיבה אמצעית
            </label>
            <textarea 
              name="print_rental_box2" 
              value={settings.print_rental_box2 || ''} 
              onChange={handleChange}
              rows="2"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              הערות השכרה - טקסט חתימה (תקנון)
            </label>
            <input 
              type="text" 
              name="print_rental_footer" 
              value={settings.print_rental_footer || ''} 
              onChange={handleChange}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }}
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
            <span style={{ marginRight: '1rem', color: message.includes('שגיאה') ? 'var(--error-color, #e53935)' : 'var(--success-color, #2e7d32)', fontWeight: 'bold' }}>
              {message}
            </span>
          )}
        </form>
      </div>
    </main>
  );
}
