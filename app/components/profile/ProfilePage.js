'use client';

// "הפרופיל שלי" (/profile) — עיצוב מאושר: תצוגות-עיצוב/פרופיל-עובד.html (3.10.2026), רכיבי פלטה בלבד (design-system/COMPONENTS.md)
// בתוך .gm-ds.gm-pf, כמו הלו״ז ובדיקת המלאי. החלטות הבעלים: עמודה אחת (בלי עמודה צדדית), סדר הכרטיסים: פרטים אישיים (עם
// תמונת הפרופיל), יצירת קשר, כתובת, אבטחה, העדפות, וכפתור "שמירת פרטים" בתחתית הדף; "קבלת התראות למייל" מתג; בלי שורת עזר
// ליד מתג הכניסה האוטומטית לשעון (AutoClockSwitch.js).
// החוזה מול השרת לא השתנה לעומת הדף הישן: GET /api/me/profile, PUT /api/me/profile (הגוף = אובייקט הפרופיל כמו שהוא),
// POST /api/employees/<id>/password {oldPassword,newPassword}, GET /api/settings (show_employee_profile_image),
// invalidate(['/api/me']) אחרי שמירה. הודעות המערכת (חלון alert של הדפדפן בעבר) מוצגות בטוסט של הפלטה (#toast.info). סיסמאות לא נרשמות ולא מוצגות.

import '@/design-system/components.css';
import './profile.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { invalidate, fetchSharedJson, TTL } from '@/lib/apiCache';
import AutoClockSwitch from '@/app/components/login/AutoClockSwitch';
import { HomeSprite } from '../home/HomeParts';
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';
import { useA5Shell } from '../menu/A5ShellContext';
import usePageTooltip from './usePageTooltip';
import PageVariantToggle from '../variant/PageVariantToggle';

// אייקון מהספרייה של הפלטה (הפניה פנימית ל-sprite המוטמע, כמו Ic בדף הבית) + מחלקות אנימציית הריחוף של הפלטה (ia-<שם> ia-h),
// כמו בעיצוב המאושר ובאייקוני התפריט (menuParts.js). האנימציה רצה רק בריחוף/מיקוד על האייקון או על הכפתור שמכיל אותו.
function Ic({ id, size }) {
  return (
    <svg className={`ic ia-${id} ia-h${size ? ` ${size}` : ''}`} aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${id}`} /></svg>
  );
}

const TOAST_MS = 2600;
const TOAST_ERR_MS = 4500;
const NO_FILL = { 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };

// כותרת הדף (topbar בפלטה): כפתור חזרה + כותרת + שורת משנה. בטעינה / בלי התחברות אין כפתור חזרה ואין שורת משנה רגילה.
function PageHead({ onBack, sub, children }) {
  return (
    <div className="topbar">
      {onBack ? (
        <button data-element-name="כפתור_profile_back" type="button" className="back" data-ico="back" onClick={onBack} aria-label="חזרה" data-tip="חזרה">
          <Ic id="back" />
        </button>
      ) : null}
      <div className="ttl">
        <div>
          <h1>הפרופיל שלי</h1>
          {sub || children ? <div className="faint pf-sub">{sub}{children}</div> : null}
        </div>
      </div>
      {/* "חזרה לתצוגה הישנה" (4.10.2026): מוצג רק להנהלה ראשית / מתכנת; הטולטיפ - usePageTooltip של הדף (data-tip) */}
      <PageVariantToggle screen="profile" placement="header" systemTip />
    </div>
  );
}

function CardHead({ icon, id, children }) {
  return (
    <div className="card-h">
      <div className="ico rose"><Ic id={icon} size="lg" /></div>
      <h2 id={id}>{children}</h2>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, shown, onToggle, dataName }) {
  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="inpw">
        <Ic id="lock" size="sm" />
        <input data-element-name={dataName} className="inp" type={shown ? 'text' : 'password'} id={id} value={value} onChange={onChange} autoComplete="new-password" {...NO_FILL} />
        <button type="button" className="inpx" aria-pressed={shown} aria-label={shown ? 'הסתר סיסמה' : 'הצג סיסמה'} data-tip={shown ? 'הסתר סיסמה' : 'הצג סיסמה'} onClick={onToggle}>
          <Ic id="eye" size="sm" />
        </button>
      </div>
    </div>
  );
}

// כרטיס "הפרופיל שלי" — גרסה מצומצמת של כרטיס העובד, לעובד המחובר בלבד.
// מציג ומעדכן פרטים אישיים בלבד דרך /api/me/profile (בלי שכר, תפקיד, AI
// ונוכחות — אלה נשארים בכרטיס העובד המנהלי תחת /employees).
export default function ProfilePage() {
  const router = useRouter();
  const shell = useA5Shell();
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const fileRef = useRef(null);
  const toastTimer = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { title, kind: 'ok'|'error', n }
  const [drag, setDrag] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  // show_employee_profile_image (הגדרות > תצוגה) - לפי בקשת ההנהלה (דיווח c764bef4)
  // הוסרה תמונת הפרופיל לגמרי; ברירת מחדל true כשהשורה עוד לא נוצרה ב-DB.
  const [showProfileImage, setShowProfileImage] = useState(true);

  const pwBtnRef = useRef(null);
  // הטולטיפ של המעטפת האחידה (A5) מאזין רק לאזור הכותרת ולא לתוכן הדף - הדף מטפל בטולטיפים שלו תמיד
  usePageTooltip(rootRef, ttRef, false);

  const say = useCallback((title, kind = 'ok') => {
    setToast({ title, kind, n: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), kind === 'ok' ? TOAST_MS : TOAST_ERR_MS);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    // /api/settings משותף (מטמון apiCache, 5 דק') - בלי זה כל כניסה לפרופיל משכה שוב את כל ההגדרות (~66KB) בשביל דגל אחד.
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
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
        say('הפרטים נשמרו בהצלחה!');
      } else {
        say(data.error || 'שגיאה בשמירת נתונים', 'error');
      }
    } catch (err) {
      say('שגיאה בשמירת נתונים', 'error');
    } finally {
      setSaving(false);
    }
  };

  const closePasswordBox = () => {
    setShowChangePassword(false);
    setOldPasswordInput('');
    setNewPasswordInput('');
    setShowOldPassword(false);
    setShowNewPassword(false);
  };

  const pwBusyRef = useRef(false);
  const [pwBusy, setPwBusy] = useState(false);
  const handlePasswordConfirm = async () => {
    if (pwBusyRef.current) return; // בלי שליחה כפולה (Enter מוחזק / לחיצה כפולה)
    if (!newPasswordInput) {
      say('יש להזין סיסמא חדשה', 'error');
      return;
    }
    pwBusyRef.current = true;
    setPwBusy(true);
    try {
      const res = await fetch(`/api/employees/${profile.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: oldPasswordInput, newPassword: newPasswordInput })
      });
      const data = await res.json();
      if (data.success) {
        closePasswordBox();
        say('הסיסמא שונתה בהצלחה');
      } else {
        say(data.message || 'שינוי הסיסמה נכשל', 'error');
      }
    } catch (err) {
      say('שגיאה בשינוי הסיסמה', 'error');
    } finally {
      pwBusyRef.current = false;
      setPwBusy(false);
    }
  };

  // Enter בשדות הסיסמא מאשר את השינוי (ולא שולח את כל הטופס), Escape מבטל - כמו בעיצוב המאושר
  const onPasswordKeyDown = (e) => {
    // Enter מאשר רק משדה טקסט (לא מלחצן "ביטול" / עין) ולא כשהמקש מוחזק
    if (e.key === 'Enter') {
      if (e.target.tagName === 'INPUT') { e.preventDefault(); if (!e.repeat) handlePasswordConfirm(); }
    } else if (e.key === 'Escape') { e.stopPropagation(); closePasswordBox(); pwBtnRef.current && pwBtnRef.current.focus(); }
  };

  const readAvatar = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile(prev => ({ ...prev, profileImage: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = (e) => {
    readAvatar(e.target.files[0]);
  };

  const handleAvatarDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && /^image\//.test(f.type)) readAvatar(f);
  };

  const removeAvatar = () => {
    setProfile(prev => ({ ...prev, profileImage: '' }));
    if (fileRef.current) fileRef.current.value = '';
  };

  let body;
  if (loading) {
    body = <PageHead sub="טוען נתונים..." />;
  } else if (notLoggedIn || !profile) {
    body = (
      <>
        <PageHead />
        <div className="card">
          <div className="empty" role="status">
            <Ic id="lock" size="lg" />
            <div className="pf-empty-t">כדי לצפות בפרופיל האישי יש להתחבר למערכת עם המשתמש שלך.</div>
          </div>
        </div>
      </>
    );
  } else {
    const initials = `${(profile.firstName || '').charAt(0)}${(profile.lastName || '').charAt(0)}`;
    const hasPhoto = !!(profile.profileImage && profile.profileImage.startsWith('data:image'));
    body = (
      <>
        <PageHead onBack={() => router.back()} sub="פרטים אישיים, אבטחה והעדפות תצוגה של המשתמש המחובר">
          {profile.department?.name ? <span className="chip gray">{profile.department.name}</span> : null}
        </PageHead>

        <form className="layout pf-layout" onSubmit={handleSave} autoComplete="off">
          <main className="main">
            <div className="panel on">

              <section className="card dfields" aria-labelledby="h-personal">
                <CardHead icon="userck" id="h-personal">פרטים אישיים</CardHead>

                {showProfileImage && (
                  <div className="pf-avwrap">
                    <label className="lbl" htmlFor="profile-avatarInput">תמונת פרופיל (העלאת קובץ)</label>
                    <div className="pf-avrow">
                      {hasPhoto ? (
                        <div className="pf-av photo" aria-hidden="true" style={{ backgroundImage: `url("${profile.profileImage}")` }} />
                      ) : (
                        <div className="pf-av" aria-hidden="true">{initials}</div>
                      )}
                      <label
                        className={`pf-up${drag ? ' drag' : ''}`}
                        htmlFor="profile-avatarInput"
                        title="לחיצה או גרירת קובץ להעלאת תמונת פרופיל"
                        onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
                        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
                        onDrop={handleAvatarDrop}
                      >
                        <Ic id="plus" size="lg" />
                        <strong>גרור/י תמונה לכאן או לחצ/י לבחירה</strong>
                        <span className="sm faint">PNG או JPG · עד 5MB</span>
                      </label>
                      <input data-element-name="שדה_profile_15" ref={fileRef} type="file" id="profile-avatarInput" accept="image/*" onChange={handleAvatarUpload} hidden />
                      {profile.profileImage && (
                        <button data-element-name="כפתור_profile_img_rm" type="button" className="btn danger sm" data-ico="trash" title="הסרת תמונת הפרופיל" onClick={removeAvatar}>
                          <Ic id="trash" size="sm" />הסר
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid2">
                  <div className="field"><label className="lbl" htmlFor="profile-firstName">שם פרטי</label><input data-element-name="שדה_profile_1" className="inp" type="text" id="profile-firstName" name="firstName" value={profile.firstName || ''} onChange={handleChange} autoComplete="new-password" {...NO_FILL} /></div>
                  <div className="field"><label className="lbl" htmlFor="profile-lastName">שם משפחה</label><input data-element-name="שדה_profile_2" className="inp" type="text" id="profile-lastName" name="lastName" value={profile.lastName || ''} onChange={handleChange} autoComplete="new-password" {...NO_FILL} /></div>
                </div>
              </section>

              <section className="card dfields" aria-labelledby="h-contact">
                <CardHead icon="phone" id="h-contact">יצירת קשר</CardHead>
                <div className="grid2">
                  <div className="field"><label className="lbl" htmlFor="profile-phone1">טלפון 1</label><div className="inpw"><Ic id="phone" size="sm" /><input data-element-name="שדה_profile_5" className="inp" type="tel" inputMode="tel" id="profile-phone1" name="phone1" value={profile.phone1 || ''} onChange={handleChange} autoComplete="new-password" {...NO_FILL} /></div></div>
                  <div className="field"><label className="lbl" htmlFor="profile-phone2">טלפון 2</label><div className="inpw"><Ic id="phone" size="sm" /><input data-element-name="שדה_profile_6" className="inp" type="tel" inputMode="tel" id="profile-phone2" name="phone2" value={profile.phone2 || ''} onChange={handleChange} autoComplete="new-password" {...NO_FILL} /></div></div>
                  <div className="field"><label className="lbl" htmlFor="profile-email">מייל</label><div className="inpw"><Ic id="mail" size="sm" /><input data-element-name="שדה_profile_7" className="inp" type="email" inputMode="email" id="profile-email" name="email" value={profile.email || ''} onChange={handleChange} autoComplete="new-password" {...NO_FILL} /></div></div>
                </div>
              </section>

              <section className="card dfields" aria-labelledby="h-address">
                <CardHead icon="pin" id="h-address">כתובת</CardHead>
                <div className="grid2">
                  <div className="field"><label className="lbl" htmlFor="profile-city">עיר</label><input data-element-name="שדה_profile_8" className="inp" type="text" id="profile-city" name="city" value={profile.city || ''} onChange={handleChange} autoComplete="new-password" {...NO_FILL} /></div>
                  <div className="field"><label className="lbl" htmlFor="profile-street">רחוב</label><input data-element-name="שדה_profile_9" className="inp" type="text" id="profile-street" name="street" value={profile.street || ''} onChange={handleChange} autoComplete="new-password" {...NO_FILL} /></div>
                  <div className="field"><label className="lbl" htmlFor="profile-houseNum">מספר בית</label><input data-element-name="שדה_profile_10" className="inp" type="text" id="profile-houseNum" name="houseNum" value={profile.houseNum || ''} onChange={handleChange} autoComplete="new-password" {...NO_FILL} /></div>
                </div>
              </section>

              {/* בורר "פלטת גוונים" הישן הוסר — הוא מעולם לא השפיע על התצוגה.
                  העדפות עיצוב אישיות (פלטה/מצב/גופן וכו') נמצאות בעמוד
                  "עיצוב ותצוגה" (/display-settings) ונשמרות פר-עובד. */}

              <section className="card dfields" aria-labelledby="h-security">
                <CardHead icon="lock" id="h-security">אבטחה</CardHead>
                <div className="field">
                  <label className="lbl" htmlFor="profile-pwDisplay">סיסמא לשעון נוכחות</label>
                  <div className="inpw"><Ic id="lock" size="sm" /><input data-element-name="שדה_profile_11" className="inp" type="password" id="profile-pwDisplay" value="********" disabled readOnly /></div>
                </div>
                <div className="pf-pwact">
                  <button data-element-name="כפתור_profile_pw" ref={pwBtnRef} type="button" className="btn" onClick={() => setShowChangePassword(true)} aria-expanded={showChangePassword} aria-controls="pf-pwbox">שינוי סיסמא</button>
                </div>

                {showChangePassword && (
                  <div className="pf-pwbox" id="pf-pwbox" onKeyDown={onPasswordKeyDown}>
                    <PasswordField id="profile-oldPassword" label="סיסמא ישנה" dataName="שדה_profile_12" value={oldPasswordInput} onChange={e => setOldPasswordInput(e.target.value)} shown={showOldPassword} onToggle={() => setShowOldPassword(v => !v)} />
                    <PasswordField id="profile-newPassword" label="סיסמא חדשה" dataName="שדה_profile_13" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} shown={showNewPassword} onToggle={() => setShowNewPassword(v => !v)} />
                    <div className="pf-pwbtns">
                      <button data-element-name="כפתור_profile_pw_cancel" type="button" className="btn ghost" onClick={closePasswordBox}>ביטול</button>
                      <button data-element-name="כפתור_profile_pw_ok" type="button" className="btn primary" disabled={pwBusy} onClick={handlePasswordConfirm}>אשר שינוי</button>
                    </div>
                  </div>
                )}
              </section>

              <section className="card dfields" aria-labelledby="h-prefs">
                <CardHead icon="sliders" id="h-prefs">העדפות</CardHead>
                <div className="pf-prefs">
                  <div className="trow">
                    <label className="sw"><input data-element-name="שדה_profile_16" type="checkbox" id="receiveEmailAlerts" name="receiveEmailAlerts" checked={!!profile.receiveEmailAlerts} onChange={handleChange} /><i /></label>
                    <label htmlFor="receiveEmailAlerts" className="pf-pl">קבלת התראות למייל</label>
                  </div>
                  {/* דף הכניסה החדש (Q05): אותה הגדרה כמו המתג במסך הכניסה ובתפריט המשתמש */}
                  <AutoClockSwitch />
                </div>
              </section>

              <div className="pf-save">
                <button data-element-name="כפתור_profile_save" type="submit" disabled={saving} className="btn primary lg block">
                  {saving ? 'שומר...' : 'שמירת פרטים'}
                </button>
              </div>

            </div>
          </main>
        </form>
      </>
    );
  }

  return (
    <div className="gm-ds gm-pf home-bg" ref={rootRef} dir="rtl">
      <HomeSprite />
      <div className="app pf-app">
        {body}
      </div>
      {toast && (
        <div id="toast" className="info on pulse" data-kind="info" role="status" aria-live="polite" key={toast.n}>
          <button type="button" className="tclose" data-ico="x" aria-label="סגירה" data-tip="סגור" onClick={() => setToast(null)}><Ic id="x" size="sm" /></button>
          <div className="tb"><Ic id={toast.kind === 'error' ? 'alert' : 'check'} size="lg" /></div>
          <div><b>{toast.title}</b></div>
        </div>
      )}
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}
