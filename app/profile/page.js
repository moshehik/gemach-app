'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { invalidate } from '@/lib/apiCache';
import { V3Page, Card, Btn, IconBtn, Field, Chip, Switch, Tip, Empty } from '@/app/v3/ui/components';
import Icon from '@/app/v3/ui/Icon';
import useAskDialog from '@/app/components/v3misc/useAskDialog';

// כרטיס "הפרופיל שלי" — גרסה מצומצמת של כרטיס העובד, לעובד המחובר בלבד.
// מציג ומעדכן פרטים אישיים בלבד דרך /api/me/profile (בלי שכר, תפקיד, AI
// ונוכחות — אלה נשארים בכרטיס העובד המנהלי תחת /employees).
export default function MyProfilePage() {
  const router = useRouter();
  const { ask, node: askNode } = useAskDialog();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  // show_employee_profile_image (הגדרות > תצוגה) - לפי בקשת ההנהלה (דיווח c764bef4)
  // הוסרה תמונת הפרופיל לגמרי; ברירת מחדל true כשהשורה עוד לא נוצרה ב-DB.
  const [showProfileImage, setShowProfileImage] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        const s = Array.isArray(data) ? data.find(x => x.key === 'show_employee_profile_image') : null;
        if (s) setShowProfileImage(s.value !== 'false');
      })
      .catch(() => {});
  }, []);

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
        await ask({ title: 'נשמר', sub: 'הפרטים עודכנו.', icon: 'check-circle' });
      } else {
        await ask({ title: 'השמירה נכשלה', sub: data.error || 'הפרטים לא נשמרו. נסו שוב.', icon: 'alert-circle' });
      }
    } catch (err) {
      await ask({ title: 'השמירה נכשלה', sub: 'הפרטים לא נשמרו. נסו שוב.', icon: 'alert-circle' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordConfirm = async () => {
    if (!newPasswordInput) {
      await ask({ title: 'חסרה סיסמה חדשה', sub: 'הזינו את הסיסמה החדשה ואז אשרו.', icon: 'lock' });
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
        await ask({ title: 'הסיסמה הוחלפה', icon: 'check-circle' });
      } else {
        await ask({ title: 'הסיסמה לא הוחלפה', sub: data.message || 'נסו שוב.', icon: 'alert-circle' });
      }
    } catch (err) {
      await ask({ title: 'הסיסמה לא הוחלפה', sub: 'אירעה תקלה. נסו שוב.', icon: 'alert-circle' });
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
      <V3Page>
        <div className="v3-empty" role="status">
          <span className="v3-spin" aria-hidden="true" />
          <span>טוען את הפרופיל</span>
        </div>
      </V3Page>
    );
  }

  if (notLoggedIn || !profile) {
    return (
      <V3Page>
        <Empty icon="lock" title="צריך להתחבר" text="כדי לראות ולערוך את הפרופיל, היכנסו למערכת עם המשתמש שלכם." />
      </V3Page>
    );
  }

  const initials = `${(profile.firstName || '').charAt(0)}${(profile.lastName || '').charAt(0)}`;

  return (
    <V3Page>
      <form onSubmit={handleSave} className="v3-stack">
        <div className="v3-pagehead">
          <div className="v3-pagehead__title">
            <IconBtn data-element-name="כפתור_profile_back" icon="back" label="חזרה" variant="quiet" onClick={() => router.back()} />
            <h1 className="v3-h1">הפרופיל שלי</h1>
            <Tip>כאן מעדכנים פרטים אישיים וסיסמה. עיצוב ותצוגה מוגדרים במסך נפרד.</Tip>
            {profile.department?.name && <Chip variant="info" icon="users">{profile.department.name}</Chip>}
          </div>
        </div>

        <Card icon="user" title="פרטים אישיים">
          <div className="v3-stack">
            <Field data-element-name="שדה_profile_1" label="שם פרטי" type="text" id="profile-firstName" name="firstName" value={profile.firstName || ''} onChange={handleChange} autoComplete="new-password" />
            <Field data-element-name="שדה_profile_2" label="שם משפחה" type="text" id="profile-lastName" name="lastName" value={profile.lastName || ''} onChange={handleChange} autoComplete="new-password" />
            <Field data-element-name="שדה_profile_3" label="שם מלא" type="text" id="profile-fullName" name="fullName" value={profile.fullName || ''} onChange={handleChange} autoComplete="new-password" />
            <Field data-element-name="שדה_profile_4" label="תאריך הצטרפות" tip="נקבע על ידי ההנהלה ואי אפשר לשנותו כאן." type="text" id="profile-joinDate" value={profile.joinDate ? new Date(profile.joinDate).toLocaleDateString('he-IL') : '—'} disabled />
          </div>
        </Card>

        <Card icon="phone" title="יצירת קשר">
          <div className="v3-stack">
            <Field data-element-name="שדה_profile_5" label="טלפון ראשי" type="text" id="profile-phone1" name="phone1" value={profile.phone1 || ''} onChange={handleChange} autoComplete="new-password" />
            <Field data-element-name="שדה_profile_6" label="טלפון נוסף" type="text" id="profile-phone2" name="phone2" value={profile.phone2 || ''} onChange={handleChange} autoComplete="new-password" />
            <Field data-element-name="שדה_profile_7" label="מייל" type="email" id="profile-email" name="email" value={profile.email || ''} onChange={handleChange} autoComplete="new-password" />
            <Switch
              data-element-name="שדה_profile_16"
              id="receiveEmailAlerts"
              name="receiveEmailAlerts"
              checked={!!profile.receiveEmailAlerts}
              onChange={(checked) => setProfile(prev => ({ ...prev, receiveEmailAlerts: checked }))}
              label="לקבל התראות במייל"
            />
          </div>
        </Card>

        <Card icon="pin" title="כתובת">
          <div className="v3-stack">
            <Field data-element-name="שדה_profile_8" label="עיר" type="text" id="profile-city" name="city" value={profile.city || ''} onChange={handleChange} autoComplete="new-password" />
            <Field data-element-name="שדה_profile_9" label="רחוב" type="text" id="profile-street" name="street" value={profile.street || ''} onChange={handleChange} autoComplete="new-password" />
            <Field data-element-name="שדה_profile_10" label="מספר בית" type="text" id="profile-houseNum" name="houseNum" value={profile.houseNum || ''} onChange={handleChange} autoComplete="new-password" />
          </div>
        </Card>

        {/* בורר "פלטת גוונים" הישן הוסר — הוא מעולם לא השפיע על התצוגה.
            העדפות עיצוב אישיות (פלטה/מצב/גופן וכו') נמצאות בעמוד
            "עיצוב ותצוגה" (/display-settings) ונשמרות פר-עובד. */}

        <Card icon="lock" title="סיסמה" tip="הסיסמה משמשת גם לרישום כניסה ויציאה בשעון הנוכחות.">
          <div className="v3-stack">
            <div className="v3-field">
              <label className="v3-label" htmlFor="profile-pwDisplay">הסיסמה הנוכחית</label>
              <input data-element-name="שדה_profile_11" className="v3-input" type="password" id="profile-pwDisplay" value="********" disabled />
            </div>
            <div className="v3-cluster">
              <Btn data-element-name="כפתור_profile_pw" variant="secondary" icon="edit" onClick={() => setShowChangePassword(true)}>החלפת סיסמה</Btn>
            </div>

            {showChangePassword && (
              <Card variant="info" icon="lock" title="סיסמה חדשה" level={3}>
                <div className="v3-stack">
                  <div className="v3-field">
                    <label className="v3-label" htmlFor="profile-oldPassword">הסיסמה הישנה</label>
                    <div className="v3-cluster" style={{ flexWrap: 'nowrap' }}>
                      <input data-element-name="שדה_profile_12" className="v3-input" style={{ flex: 1, minWidth: 0 }} type={showOldPassword ? 'text' : 'password'} id="profile-oldPassword" value={oldPasswordInput} onChange={e => setOldPasswordInput(e.target.value)} />
                      <IconBtn icon="eye" label="הצגת הסיסמה" title="הצג סיסמה" aria-pressed={showOldPassword} onClick={() => setShowOldPassword(v => !v)} />
                    </div>
                  </div>
                  <div className="v3-field">
                    <label className="v3-label" htmlFor="profile-newPassword">הסיסמה החדשה</label>
                    <div className="v3-cluster" style={{ flexWrap: 'nowrap' }}>
                      <input data-element-name="שדה_profile_13" className="v3-input" style={{ flex: 1, minWidth: 0 }} type={showNewPassword ? 'text' : 'password'} id="profile-newPassword" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} />
                      <IconBtn icon="eye" label="הצגת הסיסמה" title="הצג סיסמה" aria-pressed={showNewPassword} onClick={() => setShowNewPassword(v => !v)} />
                    </div>
                  </div>
                  <div className="v3-cluster">
                    <Btn data-element-name="כפתור_profile_pw_ok" variant="primary" icon="check" onClick={handlePasswordConfirm}>עדכון הסיסמה</Btn>
                    <Btn data-element-name="כפתור_profile_pw_cancel" variant="quiet" onClick={() => { setShowChangePassword(false); setOldPasswordInput(''); setNewPasswordInput(''); }}>ביטול</Btn>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </Card>

        {showProfileImage && (
          <Card icon="camera" title="תמונה">
            <div className="v3-stack">
              {profile.profileImage && profile.profileImage.startsWith('data:image') ? (
                <img src={profile.profileImage} alt="תמונת הפרופיל" style={{ width: 'var(--v3-tap)', height: 'var(--v3-tap)', objectFit: 'cover', borderRadius: 'var(--v3-r-round)' }} />
              ) : (
                <span className="v3-avatar" aria-hidden="true">{initials}</span>
              )}
              <label className="v3-file v3-focusable" htmlFor="profile-avatarInput" title="בחירת תמונה מהמחשב">
                <Icon name="camera" />
                <span className="v3-stack">
                  <b>בחירת תמונה</b>
                  <span className="v3-faint v3-text-sm">PNG או JPG, עד 5MB</span>
                </span>
              </label>
              <input data-element-name="שדה_profile_15" type="file" id="profile-avatarInput" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              {profile.profileImage && (
                <div className="v3-cluster">
                  <Btn data-element-name="כפתור_profile_img_rm" variant="quiet" size="sm" icon="trash" title="הסרת תמונת הפרופיל" onClick={() => setProfile(prev => ({ ...prev, profileImage: '' }))}>הסרה</Btn>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="v3-cluster">
          <Btn data-element-name="כפתור_profile_save" type="submit" variant="primary" size="lg" icon="check" loading={saving}>
            {saving ? 'שומר' : 'שמירה'}
          </Btn>
        </div>
      </form>
      {askNode}
    </V3Page>
  );
}
