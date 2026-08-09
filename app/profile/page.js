'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { invalidate } from '@/lib/apiCache';

// כרטיס "הפרופיל שלי" — גרסה מצומצמת של כרטיס העובד, לעובד המחובר בלבד.
// מציג ומעדכן פרטים אישיים בלבד דרך /api/me/profile (בלי שכר, תפקיד, AI
// ונוכחות — אלה נשארים בכרטיס העובד המנהלי תחת /employees).
export default function MyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  useEffect(() => {
    fetch('/api/me/profile')
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          setNotLoggedIn(true);
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && !data.error) setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfile(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      if (data.success) {
        invalidate(['/api/me']);
        window.alert('הפרטים נשמרו בהצלחה!');
      } else {
        window.alert(data.error || 'שגיאה בשמירת נתונים');
      }
    } catch (err) {
      window.alert('שגיאה בשמירת נתונים');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="container" style={{ padding: '2rem' }}><p>טוען נתונים...</p></main>;
  }

  if (notLoggedIn || !profile) {
    return (
      <main className="container animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--primary-color)', marginTop: 0 }}>הפרופיל שלי</h2>
          <p>כדי לצפות בפרופיל האישי יש להתחבר למערכת עם המשתמש שלך.</p>
        </div>
      </main>
    );
  }

  const inputStyle = { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' };
  const labelStyle = { display: 'block', marginBottom: '0.5rem', fontWeight: '500' };

  return (
    <main className="container animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button data-element-name="כפתור_profile_back" type="button" onClick={() => router.back()} className="btn" style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, border: '1px solid var(--element-border)' }}>→</button>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>הפרופיל שלי</h1>
        {profile.department?.name && (
          <span style={{ background: 'var(--element-bg)', color: 'var(--text-muted)', padding: '0.25rem 0.75rem', borderRadius: '16px', fontSize: '0.85rem' }}>
            {profile.department.name}
          </span>
        )}
      </div>

      <form onSubmit={handleSave} style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="form-group">
            <label style={labelStyle}>שם פרטי</label>
            <input data-element-name="שדה_profile_1" type="text" name="firstName" value={profile.firstName || ''} onChange={handleChange} style={inputStyle} />
          </div>
          <div className="form-group">
            <label style={labelStyle}>שם משפחה</label>
            <input data-element-name="שדה_profile_2" type="text" name="lastName" value={profile.lastName || ''} onChange={handleChange} style={inputStyle} />
          </div>
          <div className="form-group">
            <label style={labelStyle}>שם מלא</label>
            <input data-element-name="שדה_profile_3" type="text" name="fullName" value={profile.fullName || ''} onChange={handleChange} style={inputStyle} />
          </div>
          <div className="form-group">
            <label style={labelStyle}>תאריך כניסה לארגון</label>
            <input data-element-name="שדה_profile_4" type="text" value={profile.joinDate ? new Date(profile.joinDate).toLocaleDateString('he-IL') : '—'} disabled style={{ ...inputStyle, background: 'var(--element-bg)', color: 'var(--text-muted)' }} />
          </div>
          <div className="form-group">
            <label style={labelStyle}>טלפון 1</label>
            <input data-element-name="שדה_profile_5" type="text" name="phone1" value={profile.phone1 || ''} onChange={handleChange} style={inputStyle} />
          </div>
          <div className="form-group">
            <label style={labelStyle}>טלפון 2</label>
            <input data-element-name="שדה_profile_6" type="text" name="phone2" value={profile.phone2 || ''} onChange={handleChange} style={inputStyle} />
          </div>
          <div className="form-group">
            <label style={labelStyle}>מייל</label>
            <input data-element-name="שדה_profile_7" type="email" name="email" value={profile.email || ''} onChange={handleChange} style={inputStyle} />
          </div>
          <div className="form-group">
            <label style={labelStyle}>עיר</label>
            <input data-element-name="שדה_profile_8" type="text" name="city" value={profile.city || ''} onChange={handleChange} style={inputStyle} />
          </div>
          <div className="form-group">
            <label style={labelStyle}>רחוב</label>
            <input data-element-name="שדה_profile_9" type="text" name="street" value={profile.street || ''} onChange={handleChange} style={inputStyle} />
          </div>
          <div className="form-group">
            <label style={labelStyle}>מספר בית</label>
            <input data-element-name="שדה_profile_10" type="text" name="houseNum" value={profile.houseNum || ''} onChange={handleChange} style={inputStyle} />
          </div>

          <div className="form-group">
            <label style={labelStyle}>סיסמא לשעון נוכחות</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input data-element-name="שדה_profile_11" type="password" value="********" disabled style={{ ...inputStyle, background: 'var(--element-bg)', color: 'var(--text-muted)' }} />
              <button data-element-name="כפתור_profile_pw" type="button" onClick={() => setShowChangePassword(true)} className="btn btn-primary" style={{ whiteSpace: 'nowrap', padding: '0.75rem 1rem' }}>שינוי סיסמא</button>
            </div>
            {showChangePassword && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--element-bg)', borderRadius: '8px', border: '1px solid var(--element-border)' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.2rem' }}>סיסמא ישנה</label>
                  <input data-element-name="שדה_profile_12" type="password" value={oldPasswordInput} onChange={e => setOldPasswordInput(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.2rem' }}>סיסמא חדשה</label>
                  <input data-element-name="שדה_profile_13" type="password" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button data-element-name="כפתור_profile_pw_cancel" type="button" onClick={() => { setShowChangePassword(false); setOldPasswordInput(''); setNewPasswordInput(''); }} className="btn" style={{ background: 'var(--card-bg)', border: '1px solid var(--element-border)' }}>ביטול</button>
                  <button data-element-name="כפתור_profile_pw_ok" type="button" onClick={async () => {
                    if (!newPasswordInput) {
                      window.alert('יש להזין סיסמא חדשה');
                      return;
                    }
                    try {
                      const res = await fetch(`/api/employees/${profile.id}/password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ oldPassword: oldPasswordInput, newPassword: newPasswordInput })
                      });
                      const data = await res.json();
                      if (data.success) {
                        setShowChangePassword(false);
                        setOldPasswordInput('');
                        setNewPasswordInput('');
                        window.alert('הסיסמא שונתה בהצלחה');
                      } else {
                        window.alert(data.message || 'שינוי הסיסמה נכשל');
                      }
                    } catch (err) {
                      window.alert('שגיאה בשינוי הסיסמה');
                    }
                  }} className="btn btn-primary">אשר שינוי</button>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label style={labelStyle}>פלטת גוונים מודרנית לפרופיל</label>
            <select data-element-name="בחירה_profile_14" name="themeColor" value={profile.themeColor || 'standard'} onChange={handleChange} style={inputStyle}>
              <option value="standard">סטנדרט</option>
              <option value="dark">מצב לילה</option>
              <option value="vibrant">צבעוני ומודרני</option>
              <option value="pastel">גווני פסטל עדינים</option>
            </select>
          </div>

          <div className="form-group">
            <label style={labelStyle}>תמונת פרופיל (העלאת קובץ)</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input data-element-name="שדה_profile_15" type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setProfile(prev => ({ ...prev, profileImage: reader.result }));
                  };
                  reader.readAsDataURL(file);
                }
              }} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
              {profile.profileImage && (
                <button data-element-name="כפתור_profile_img_rm" type="button" onClick={() => setProfile(prev => ({ ...prev, profileImage: '' }))} className="btn" style={{ padding: '0.5rem', color: '#d32f2f' }}>הסר</button>
              )}
            </div>
            {profile.profileImage && profile.profileImage.startsWith('data:image') && (
              <div style={{ marginTop: '0.5rem' }}>
                <img src={profile.profileImage} alt="Profile" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--primary-color)' }} />
              </div>
            )}
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input data-element-name="שדה_profile_16" type="checkbox" id="receiveEmailAlerts" name="receiveEmailAlerts" checked={!!profile.receiveEmailAlerts} onChange={handleChange} style={{ width: '18px', height: '18px' }} />
            <label htmlFor="receiveEmailAlerts" style={{ fontWeight: '500', cursor: 'pointer' }}>קבלת התראות למייל</label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button data-element-name="כפתור_profile_save" type="submit" disabled={saving} className="btn btn-primary" style={{ borderRadius: '24px', padding: '0.75rem 2rem' }}>
            {saving ? 'שומר...' : 'שמירת פרטים'}
          </button>
        </div>
      </form>
    </main>
  );
}
