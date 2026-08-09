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
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  const handlePasswordConfirm = async () => {
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
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, profileImage: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="page-head">
        <div>
          <h1>הפרופיל שלי</h1>
          <div className="page-desc">טוען נתונים...</div>
        </div>
      </div>
    );
  }

  if (notLoggedIn || !profile) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>הפרופיל שלי</h1>
          </div>
        </div>
        <div className="card card-pad">
          <p>כדי לצפות בפרופיל האישי יש להתחבר למערכת עם המשתמש שלך.</p>
        </div>
      </>
    );
  }

  const initials = `${(profile.firstName || '').charAt(0)}${(profile.lastName || '').charAt(0)}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>הפרופיל שלי</h1>
          <div className="page-desc">
            פרטים אישיים, אבטחה והעדפות תצוגה של המשתמש המחובר
            {profile.department?.name && (
              <span className="badge badge-neutral" style={{ marginInlineStart: '8px' }}>{profile.department.name}</span>
            )}
          </div>
        </div>
        <div className="page-actions">
          <button data-element-name="כפתור_profile_back" type="button" onClick={() => router.back()} className="btn btn-secondary btn-icon-only" title="חזרה">
            <svg className="icon"><use href="#i-arrow-end" /></svg>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="card card-pad">
        <div className="form-grid">

          <div className="field">
            <label htmlFor="profile-firstName">שם פרטי</label>
            <input data-element-name="שדה_profile_1" className="input" type="text" id="profile-firstName" name="firstName" value={profile.firstName || ''} onChange={handleChange} />
          </div>

          <div className="field">
            <label htmlFor="profile-lastName">שם משפחה</label>
            <input data-element-name="שדה_profile_2" className="input" type="text" id="profile-lastName" name="lastName" value={profile.lastName || ''} onChange={handleChange} />
          </div>

          <div className="field">
            <label htmlFor="profile-fullName">שם מלא</label>
            <input data-element-name="שדה_profile_3" className="input" type="text" id="profile-fullName" name="fullName" value={profile.fullName || ''} onChange={handleChange} />
          </div>

          <div className="field">
            <label htmlFor="profile-joinDate">תאריך כניסה לארגון</label>
            <div className="input-icon-wrap">
              <svg className="icon"><use href="#i-calendar" /></svg>
              <input data-element-name="שדה_profile_4" className="input" type="text" id="profile-joinDate" value={profile.joinDate ? new Date(profile.joinDate).toLocaleDateString('he-IL') : '—'} disabled />
            </div>
          </div>

          <div className="field">
            <label htmlFor="profile-phone1">טלפון 1</label>
            <div className="input-icon-wrap">
              <svg className="icon"><use href="#i-phone" /></svg>
              <input data-element-name="שדה_profile_5" className="input" type="text" id="profile-phone1" name="phone1" value={profile.phone1 || ''} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="profile-phone2">טלפון 2</label>
            <div className="input-icon-wrap">
              <svg className="icon"><use href="#i-phone" /></svg>
              <input data-element-name="שדה_profile_6" className="input" type="text" id="profile-phone2" name="phone2" value={profile.phone2 || ''} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="profile-email">מייל</label>
            <div className="input-icon-wrap">
              <svg className="icon"><use href="#i-mail" /></svg>
              <input data-element-name="שדה_profile_7" className="input" type="email" id="profile-email" name="email" value={profile.email || ''} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="profile-city">עיר</label>
            <input data-element-name="שדה_profile_8" className="input" type="text" id="profile-city" name="city" value={profile.city || ''} onChange={handleChange} />
          </div>

          <div className="field">
            <label htmlFor="profile-street">רחוב</label>
            <input data-element-name="שדה_profile_9" className="input" type="text" id="profile-street" name="street" value={profile.street || ''} onChange={handleChange} />
          </div>

          <div className="field">
            <label htmlFor="profile-houseNum">מספר בית</label>
            <input data-element-name="שדה_profile_10" className="input" type="text" id="profile-houseNum" name="houseNum" value={profile.houseNum || ''} onChange={handleChange} />
          </div>

          {/* בורר "פלטת גוונים" הישן הוסר — הוא מעולם לא השפיע על התצוגה.
              העדפות עיצוב אישיות (פלטה/מצב/גופן וכו') נמצאות בעמוד
              "עיצוב ותצוגה" (/display-settings) ונשמרות פר-עובד. */}

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="profile-pwDisplay">סיסמא לשעון נוכחות</label>
            <div style={{ display: 'flex', gap: '8px', maxWidth: '460px' }}>
              <div className="password-field" style={{ flex: 1 }}>
                <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                <input data-element-name="שדה_profile_11" className="input" type="password" id="profile-pwDisplay" value="********" disabled />
              </div>
              <button data-element-name="כפתור_profile_pw" type="button" onClick={() => setShowChangePassword(true)} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>שינוי סיסמא</button>
            </div>

            {showChangePassword && (
              <div className="card card-pad" style={{ marginTop: '12px', maxWidth: '460px' }}>
                <div className="field">
                  <label htmlFor="profile-oldPassword">סיסמא ישנה</label>
                  <div className="password-field">
                    <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                    <input data-element-name="שדה_profile_12" className="input" type={showOldPassword ? 'text' : 'password'} id="profile-oldPassword" value={oldPasswordInput} onChange={e => setOldPasswordInput(e.target.value)} />
                    <button type="button" className="toggle-visibility" title="הצג סיסמה" onClick={() => setShowOldPassword(v => !v)}>
                      <svg className="icon"><use href="#i-eye" /></svg>
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="profile-newPassword">סיסמא חדשה</label>
                  <div className="password-field">
                    <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                    <input data-element-name="שדה_profile_13" className="input" type={showNewPassword ? 'text' : 'password'} id="profile-newPassword" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} />
                    <button type="button" className="toggle-visibility" title="הצג סיסמה" onClick={() => setShowNewPassword(v => !v)}>
                      <svg className="icon"><use href="#i-eye" /></svg>
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button data-element-name="כפתור_profile_pw_cancel" type="button" onClick={() => { setShowChangePassword(false); setOldPasswordInput(''); setNewPasswordInput(''); }} className="btn btn-secondary">ביטול</button>
                  <button data-element-name="כפתור_profile_pw_ok" type="button" onClick={handlePasswordConfirm} className="btn btn-primary">אשר שינוי</button>
                </div>
              </div>
            )}
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="profile-avatarInput">תמונת פרופיל (העלאת קובץ)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              {profile.profileImage && profile.profileImage.startsWith('data:image') ? (
                <img src={profile.profileImage} alt="Profile" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                <div className="avatar lg">{initials}</div>
              )}
              <label className="upload-zone" htmlFor="profile-avatarInput" title="לחיצה או גרירת קובץ להעלאת תמונת פרופיל" style={{ flex: 1, minWidth: '220px', padding: '16px' }}>
                <svg className="icon"><use href="#i-camera" /></svg>
                <strong>גרור/י תמונה לכאן או לחצ/י לבחירה</strong>
                <span className="hint">PNG או JPG · עד 5MB</span>
              </label>
              <input data-element-name="שדה_profile_15" type="file" id="profile-avatarInput" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              {profile.profileImage && (
                <button data-element-name="כפתור_profile_img_rm" type="button" onClick={() => setProfile(prev => ({ ...prev, profileImage: '' }))} className="btn btn-danger-ghost btn-sm" title="הסרת תמונת הפרופיל">
                  <svg className="icon"><use href="#i-trash" /></svg>
                  הסר
                </button>
              )}
            </div>
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <div className="checkbox-row">
              <input data-element-name="שדה_profile_16" type="checkbox" id="receiveEmailAlerts" name="receiveEmailAlerts" checked={!!profile.receiveEmailAlerts} onChange={handleChange} />
              <label htmlFor="receiveEmailAlerts">קבלת התראות למייל</label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button data-element-name="כפתור_profile_save" type="submit" disabled={saving} className="btn btn-primary btn-lg">
            {saving ? 'שומר...' : 'שמירת פרטים'}
          </button>
        </div>
      </form>
    </>
  );
}
