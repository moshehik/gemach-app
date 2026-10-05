'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import SendEmailModal from '@/components/SendEmailModal';
import HebrewDatePicker from '@/components/HebrewDatePicker';
import ModernEmployeeHistoryTab from '@/components/employees/ModernEmployeeHistoryTab';
import EmployeePermissionsPanel from '@/app/components/permissions/EmployeePermissionsPanel';
import { usePopup } from '@/app/components/PopupProvider';
import { requestJson, describeFailure } from '@/lib/employeeCardSave';

export default function EmployeePage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  // הודעות מערכת (טוסט) - שגיאה / הצלחה. כל שמירה בכרטיס בודקת res.ok (requestJson) ומציגה את סיבת השרת;
  // הודעת הצלחה מוצגת רק אחרי תשובה תקינה.
  const popup = usePopup();
  const notifyError = (message) => popup?.showAlert?.(message, 'error');
  const notifySuccess = (message) => popup?.showAlert?.(message, 'success');
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details'); // details, attendance, history
  // ?tab=history / ?tab=attendance - קישור ישיר ללשונית (סיכום הנוכחות: "לכרטיס העובד · היסטוריה", החלטת הבעלים AT-16)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'history' || t === 'attendance') setActiveTab(t);
  }, []);
  const [saving, setSaving] = useState(false);
  const [permissionsRefresh, setPermissionsRefresh] = useState(0);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // Attendance specific states
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editShiftData, setEditShiftData] = useState({});
  const [isAddingShift, setIsAddingShift] = useState(false);
  const [showDeletedShifts, setShowDeletedShifts] = useState(false);

  // Password states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [setPasswordInput, setSetPasswordInput] = useState('');
  const [setPasswordAuth, setSetPasswordAuth] = useState(null);
  const [managerPasswordInput, setManagerPasswordInput] = useState('');
  // מי המשתמש המחובר: בכרטיס של עובד אחר, "שינוי סיסמא" דורש את סיסמת המנהל עצמו ולא את הסיסמה הישנה של העובד
  const [sessionEmployeeId, setSessionEmployeeId] = useState(null);
  useEffect(() => {
    fetch('/api/me')
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data?.employee?.id) setSessionEmployeeId(data.employee.id); })
      .catch(() => {});
  }, []);
  const isOwnCard = sessionEmployeeId !== null && sessionEmployeeId === id;

  // רשימת המחלקות האמיתית (טבלת Department) עבור בורר המחלקה - null = עדיין נטען
  const [departments, setDepartments] = useState(null);
  const [deptLoadFailed, setDeptLoadFailed] = useState(false);
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
    let cancelled = false;
    fetch('/api/departments')
      .then(res => {
        if (!res.ok) throw new Error('failed');
        return res.json();
      })
      .then(data => {
        if (!cancelled) setDepartments(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setDeptLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, []);

  const fetchEmployee = () => {
    if (id === 'new') {
      setEmployee({
        firstName: '', lastName: '', fullName: '', phone1: '', phone2: '',
        email: '', emailSuffix: '', city: '', street: '', houseNum: '',
        joinDate: '', password: '', roleId: '', hourlyWage: '',
        travelExpenses: false, paymentMethod: '', notes: '',
        profileImage: '',
        isActive: true, receiveEmailAlerts: false, shifts: []
      });
      setLoading(false);
      return;
    }
    const query = showDeletedShifts ? '?includeDeleted=true' : '';
    fetch(`/api/employees/${id}${query}`)
      .then(async res => ({ ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) }))
      .then(({ ok, status, data }) => {
        if (!ok || data.error) {
          notifyError(describeFailure('טעינת כרטיס העובד נכשלה', { ok: false, status, data, networkError: false }));
          router.push('/employees');
        } else setEmployee(data);
        setLoading(false);
      })
      .catch(() => {
        notifyError('טעינת כרטיס העובד נכשלה: אין תקשורת עם השרת - בדוק את החיבור ונסה שוב');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchEmployee();
  }, [id, router, showDeletedShifts]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEmployee(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const url = id === 'new' ? '/api/employees' : `/api/employees/${id}`;
    const method = id === 'new' ? 'POST' : 'PUT';

    try {
      const result = await requestJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee)
      });
      if (!result.ok) {
        notifyError(describeFailure('שמירת הפרטים נכשלה', result));
        return;
      }
      if (id === 'new') {
        if (result.data.id) router.push(`/employees/${result.data.id}`);
        else notifyError('שמירת הפרטים נכשלה: השרת לא החזיר מזהה לעובד החדש');
      } else {
        setPermissionsRefresh((n) => n + 1); // a changed department changes the department defaults shown below
        notifySuccess('הפרטים נשמרו בהצלחה!');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleShiftEditChange = (e) => {
    const { name, value } = e.target;
    setEditShiftData(prev => ({ ...prev, [name]: value }));
  };

  const handleHebrewDateChange = (dateStr) => {
    setEditShiftData(prev => ({ ...prev, date: dateStr }));
  };

  const startEditShift = (shift) => {
    setEditingShiftId(shift.id);
    setIsAddingShift(false);
    setEditShiftData({
      date: shift.date ? shift.date.split('T')[0] : '',
      hebrewDate: shift.hebrewDate || '',
      entryTime: shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      exitTime: shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      totalMinutes: shift.totalMinutes || '',
      totalCalculated: shift.totalCalculated || '',
      notes: shift.notes || '',
      isDeleted: shift.isDeleted || false
    });
  };

  const startAddShift = () => {
    setIsAddingShift(true);
    setEditingShiftId('new');
    setEditShiftData({
      // בונים את מחרוזת התאריך ישירות (בלי לעבור דרך new Date(y,m,d).toISOString()) - זו
      // בנייה של תאריך מקומי, ו-toISOString ממיר לפי UTC. באזור זמן ישראל (UTC+2/3) ה"אחד
      // בחודש" המקומי הופך ל-31 בחודש הקודם ב-UTC, כך שהשדה נטען כברירת מחדל עם תאריך
      // בחודש הלא נכון - בדיוק המצב שבדיקת "לא בחודש המוצג" הייתה חוסמת בטעות.
      date: `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}-01`,
      hebrewDate: '',
      entryTime: '',
      exitTime: '',
      totalMinutes: '',
      totalCalculated: '',
      notes: '',
      isDeleted: false
    });
  };

  const cancelEditShift = () => {
    setEditingShiftId(null);
    setIsAddingShift(false);
    setEditShiftData({});
  };

  const saveShift = async () => {
    const url = isAddingShift ? `/api/employees/${id}/shifts` : `/api/employees/${id}/shifts/${editingShiftId}`;
    const method = isAddingShift ? 'POST' : 'PUT';

    // הוספת משמרת בתאריך שאינו בחודש המוצג במסך תיצור משמרת "אבודה" - היא תישמר
    // אבל לא תופיע ברשימה המסוננת לפי החודש/שנה הנוכחיים, ותיראה כאילו "לא נוספה".
    // בודקים את זה כאן (לפני הבקשה לשרת) כדי לתת הודעה ברורה ולחסום מיד.
    if (isAddingShift) {
      if (!editShiftData.date) {
        notifyError('יש לבחור תאריך למשמרת');
        return;
      }
      const [dY, dM] = editShiftData.date.split('-').map(Number);
      if ((dM - 1) !== filterMonth || dY !== filterYear) {
        const displayedLabel = new Date(filterYear, filterMonth).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
        notifyError(`לא ניתן להוסיף משמרת בתאריך שאינו בחודש המוצג (${displayedLabel}). יש לבחור תאריך בתוך החודש המוצג, או לעבור לחודש הרצוי ואז להוסיף את המשמרת.`);
        return;
      }
    }

    const payload = { ...editShiftData };
    // הדקות והתשלום מחושבים תמיד בשרת מכניסה/יציאה + שכר השעה - לא לשלוח את מה
    // שהיה בטופס (מנוטרל ותמיד ריק), כדי שלא יידרס חישוב אמיתי בטעות.
    delete payload.totalMinutes;
    delete payload.totalCalculated;
    if (isAddingShift) {
      payload.displayedMonth = filterMonth;
      payload.displayedYear = filterYear;
    }
    const dateBase = editShiftData.date ? editShiftData.date.split('T')[0] : '';
    if (payload.date) {
        payload.date = new Date(payload.date).toISOString();
    }
    if (editShiftData.entryTime && dateBase) {
        payload.entryTime = new Date(`${dateBase}T${editShiftData.entryTime}`).toISOString();
    } else { payload.entryTime = null; }
    if (editShiftData.exitTime && dateBase) {
        const entry = new Date(`${dateBase}T${editShiftData.entryTime}`);
        let exit = new Date(`${dateBase}T${editShiftData.exitTime}`);
        if (exit < entry) {
            exit = new Date(exit.getTime() + 24 * 60 * 60 * 1000);
        }
        payload.exitTime = exit.toISOString();
    } else { payload.exitTime = null; }

    const result = await requestJson(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (result.ok) {
      cancelEditShift();
      fetchEmployee();
    } else {
      notifyError(describeFailure('שמירת המשמרת נכשלה', result));
    }
  };

  const deleteShift = async (shiftId) => {
    if (!await window.customConfirm('האם אתה בטוח שברצונך למחוק משמרת זו? ההיסטוריה תישמר במערכת אך השורה תוסתר.')) return;
    const result = await requestJson(`/api/employees/${id}/shifts/${shiftId}`, { method: 'DELETE' });
    if (result.ok) fetchEmployee();
    else notifyError(describeFailure('מחיקת המשמרת נכשלה', result));
  };

  const restoreShift = async (shift) => {
    if (!await window.customConfirm('האם לשחזר משמרת זו?')) return;
    const result = await requestJson(`/api/employees/${id}/shifts/${shift.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDeleted: false })
    });
    if (result.ok) fetchEmployee();
    else notifyError(describeFailure('שחזור המשמרת נכשל', result));
  };

  const calculateMonthlySalary = () => {
    if (!employee || !employee.shifts) return 0;
    let total = 0;
    employee.shifts.forEach(shift => {
       const shiftDate = new Date(shift.date);
       if (!shift.isDeleted && shiftDate.getMonth() === filterMonth && shiftDate.getFullYear() === filterYear && shift.totalCalculated) {
          total += shift.totalCalculated;
       }
    });
    return total.toFixed(2);
  };

  if (loading) return <div className="page-loading"><span className="spinner lg" />טוען נתונים...</div>;
  if (!employee) return null;

  // מיון כרונולוגי מהישן לחדש - גם על המסך וגם בהדפסה (אותו מערך משמש לשניהם)
  const filteredShifts = (employee.shifts?.filter(shift => {
    const d = new Date(shift.date);
    if (!showDeletedShifts && shift.isDeleted) return false;
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  }) || []).sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) return dateDiff;
    return new Date(a.entryTime || a.date) - new Date(b.entryTime || b.date);
  });

  // משמרת "לא שלמה" - יש בה תאריך אבל חסרה כניסה או יציאה (לא שתיהן) - מודגשת בצהוב
  const isIncompleteShift = (shift) => !!shift.entryTime !== !!shift.exitTime;

  const initials = `${(employee.firstName || '').charAt(0)}${(employee.lastName || '').charAt(0)}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * {
            visibility: visible;
            color: black !important;
            filter: grayscale(100%) !important;
          }
          .print-area {
            position: absolute; left: 0; top: 0; width: 100%; direction: rtl;
            overflow: visible !important;
            background: #fff !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
          .bsd-header { display: block !important; text-align: center; font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem; }
          ::-webkit-scrollbar { display: none; }
          .print-area thead { display: table-header-group; }
          .print-area tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}} />

      <div className="page-head no-print">
        <div>
          <h1>{id === 'new' ? 'עובד חדש' : `כרטיס עובד: ${employee.firstName} ${employee.lastName}`}</h1>
        </div>
        <div className="page-actions">
          <button data-agy-id="back-button" data-element-name="כפתור_page_1" type="button" onClick={() => router.back()} className="btn btn-secondary btn-icon-only" title="חזרה">
            <svg className="icon"><use href="#i-arrow-end" /></svg>
          </button>
        </div>
      </div>

      {id !== 'new' && (
        <div className="tabs no-print">
          <button data-agy-id="tab-employee-details" data-element-name="כפתור_page_2" type="button" className={activeTab === 'details' ? 'tab active' : 'tab'} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('details')}>
            <svg className="icon"><use href="#i-id" /></svg>פרטי עובד
          </button>
          <button data-agy-id="tab-employee-attendance" data-element-name="כפתור_page_3" type="button" className={activeTab === 'attendance' ? 'tab active' : 'tab'} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('attendance')}>
            <svg className="icon"><use href="#i-clock" /></svg>נוכחות וסיכום
          </button>
          <button data-agy-id="tab-employee-history" data-element-name="כפתור_page_4" type="button" className={activeTab === 'history' ? 'tab active' : 'tab'} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('history')}>
            <svg data-element-name="רכיב_page_5" className="icon"><use href="#i-history" /></svg>היסטוריה
          </button>
        </div>
      )}

      {activeTab === 'details' && (
        <form data-agy-id="employee-form" className="card card-pad no-print" onSubmit={handleSave}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="employee-detail-firstName">שם פרטי *</label>
              <input data-element-name="שדה_page_6" className="input" type="text" id="employee-detail-firstName" name="firstName" value={employee.firstName || ''} onChange={handleChange} required />
            </div>
            <div className="field">
              <label htmlFor="employee-detail-lastName">שם משפחה *</label>
              <input data-element-name="שדה_page_7" className="input" type="text" id="employee-detail-lastName" name="lastName" value={employee.lastName || ''} onChange={handleChange} required />
            </div>
            <div className="field">
              <label htmlFor="employee-detail-joinDate">תאריך כניסה לארגון</label>
              <HebrewDatePicker data-element-name="שדה_page_9" selectedDate={employee.joinDate ? new Date(employee.joinDate).toISOString().split('T')[0] : ''} onChange={(dateStr) => setEmployee(prev => ({ ...prev, joinDate: dateStr }))} />
            </div>
            <div className="field">
              <label htmlFor="employee-detail-phone1">טלפון נייד *</label>
              <input data-element-name="שדה_page_10" className="input" type="text" id="employee-detail-phone1" name="phone1" value={employee.phone1 || ''} onChange={handleChange} required />
            </div>
            <div className="field">
              <label htmlFor="employee-detail-phone2">טלפון נוסף</label>
              <input data-element-name="שדה_page_11" className="input" type="text" id="employee-detail-phone2" name="phone2" value={employee.phone2 || ''} onChange={handleChange} />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="employee-detail-email">דוא&quot;ל</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', maxWidth: '620px' }}>
                <input data-element-name="שדה_page_12" className="input" type="email" id="employee-detail-email" name="email" value={employee.email || ''} onChange={handleChange} style={{ flex: 1 }} />
                {employee.email && (
                  <>
                    <button data-element-name="כפתור_page_13" type="button" onClick={() => navigator.clipboard.writeText(employee.email)} title="העתק כתובת מייל" className="btn btn-ghost btn-icon-only">
                      <svg data-element-name="רכיב_page_14" className="icon"><use href="#i-link" /></svg>
                    </button>
                    <button data-element-name="כפתור_page_15" type="button" onClick={() => setEmailModalOpen(true)} title="שלח מייל" className="btn btn-ghost btn-icon-only" style={{ color: 'var(--primary-solid)' }}>
                      <svg data-element-name="רכיב_page_16" className="icon"><use href="#i-mail" /></svg>
                    </button>
                  </>
                )}
              </div>
              {(!employee.email || !employee.email.includes('@')) && (
                <div style={{ marginTop: '8px' }}>
                  <button data-element-name="כפתור_page_17"
                    type="button"
                    onClick={() => {
                      const currentEmail = employee.email || '';
                      setEmployee(prev => ({ ...prev, email: currentEmail + '@gmail.com' }));
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    השלם ל- @gmail.com
                  </button>
                </div>
              )}
            </div>
            <div className="field">
              <label htmlFor="employee-detail-city">עיר</label>
              <input data-element-name="שדה_page_18" className="input" type="text" id="employee-detail-city" name="city" value={employee.city || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label htmlFor="employee-detail-street">רחוב</label>
              <input data-element-name="שדה_page_19" className="input" type="text" id="employee-detail-street" name="street" value={employee.street || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label htmlFor="employee-detail-houseNum">בית</label>
              <input data-element-name="שדה_page_20" className="input" type="text" id="employee-detail-houseNum" name="houseNum" value={employee.houseNum || ''} onChange={handleChange} />
            </div>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="employee-detail-pwDisplay">סיסמא לשעון נוכחות</label>
              {id === 'new' ? (
                <input data-element-name="שדה_page_21" className="input" type="text" name="password" value={employee.password || ''} onChange={handleChange} style={{ maxWidth: '460px' }} />
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '8px', maxWidth: '620px', flexWrap: 'wrap' }}>
                    <div className="password-field" style={{ flex: 1, minWidth: '180px' }}>
                      <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                      <input data-element-name="שדה_page_22" className="input" type="password" id="employee-detail-pwDisplay" value="********" disabled />
                    </div>
                    <button data-element-name="כפתור_page_24" type="button" onClick={() => setShowChangePassword(true)} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>שינוי סיסמא</button>
                    <button data-element-name="כפתור_page_23" type="button" onClick={async () => {
                      const authResult = await window.customAuthPrompt("הזן קוד מנהל לאיפוס הסיסמה ושליחתה למייל העובד:", "מנהל");
                      if (!authResult) return;
                      const result = await requestJson(`/api/employees/${id}/reset-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ authPin: authResult.pin, authEmployeeId: authResult.employeeId })
                      });
                      if (result.ok) notifySuccess(result.data.message || 'סיסמה זמנית נשלחה למייל העובד');
                      else notifyError(describeFailure('איפוס הסיסמה נכשל', result));
                    }} className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                      <svg className="icon"><use href="#i-refresh" /></svg>אפס ושלח למייל
                    </button>
                    <button data-element-name="כפתור_page_23b" type="button" onClick={async () => {
                      const authResult = await window.customAuthPrompt("הזן קוד מנהל לקביעת סיסמה ישירות לעובד:", "מנהל");
                      if (!authResult) return;
                      setSetPasswordAuth(authResult);
                      setShowSetPassword(true);
                    }} className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                      <svg className="icon"><use href="#i-lock" /></svg>קבע סיסמה ידנית
                    </button>
                  </div>
                  <span className="hint">מטעמי אבטחה לא ניתן לצפות בסיסמה קיימת - ניתן לשנות אותה (בידיעת הסיסמה הנוכחית, או בכרטיס של עובד אחר - הנהלה ראשית / מתכנת באימות הסיסמה שלהם), לאפס ולשלוח סיסמה זמנית לעובד במייל, או שמנהל יקבע סיסמה חדשה ישירות (לעובד בלי מייל שמור, או בלי גישה אליו כרגע).</span>

                  {showChangePassword && (
                    <div className="card card-pad" style={{ marginTop: '12px', maxWidth: '460px' }}>
                      {isOwnCard ? (
                        <div className="field">
                          <label htmlFor="employee-detail-oldPassword">סיסמא ישנה</label>
                          <div className="password-field">
                            <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                            <input data-element-name="שדה_page_25" className="input" type="password" id="employee-detail-oldPassword" value={oldPasswordInput} onChange={e => setOldPasswordInput(e.target.value)} />
                          </div>
                        </div>
                      ) : (
                        <div className="field">
                          <label htmlFor="employee-detail-managerPassword">הסיסמא שלך (לאימות המנהל)</label>
                          <div className="password-field">
                            <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                            <input data-element-name="שדה_page_25m" className="input" type="password" id="employee-detail-managerPassword" autoComplete="current-password" value={managerPasswordInput} onChange={e => setManagerPasswordInput(e.target.value)} />
                          </div>
                          <span className="hint">שינוי סיסמה לעובד אחר מותר להנהלה ראשית ולמתכנת, באימות הסיסמה שלך. הסיסמה הנוכחית של העובד אינה נדרשת.</span>
                        </div>
                      )}
                      <div className="field">
                        <label htmlFor="employee-detail-newPassword">סיסמא חדשה</label>
                        <div className="password-field">
                          <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                          <input data-element-name="שדה_page_26" className="input" type="password" id="employee-detail-newPassword" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button data-element-name="כפתור_page_27" type="button" onClick={() => { setShowChangePassword(false); setOldPasswordInput(''); setNewPasswordInput(''); setManagerPasswordInput(''); }} className="btn btn-secondary">ביטול</button>
                        <button data-element-name="כפתור_page_28" type="button" onClick={async () => {
                          if (!newPasswordInput) {
                              notifyError('יש להזין סיסמא חדשה');
                              return;
                          }
                          if (sessionEmployeeId === null) {
                              notifyError('לא ניתן לזהות את המשתמש המחובר - רענן את הדף ונסה שוב');
                              return;
                          }
                          const result = await requestJson(`/api/employees/${id}/password`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            // בכרטיס של עובד אחר (הנהלה ראשית / מתכנת): סיסמת המנהל עצמו לאימות; בכרטיס של עצמי: הסיסמה הישנה
                            body: JSON.stringify(isOwnCard
                              ? { oldPassword: oldPasswordInput, newPassword: newPasswordInput }
                              : { managerPassword: managerPasswordInput, newPassword: newPasswordInput })
                          });
                          if (result.ok) {
                            setShowChangePassword(false);
                            setOldPasswordInput('');
                            setNewPasswordInput('');
                            setManagerPasswordInput('');
                            notifySuccess('הסיסמא שונתה בהצלחה');
                          } else {
                            notifyError(describeFailure('שינוי הסיסמה נכשל', result));
                          }
                        }} className="btn btn-primary">אשר שינוי</button>
                      </div>
                    </div>
                  )}

                  {showSetPassword && (
                    <div className="card card-pad" style={{ marginTop: '12px', maxWidth: '460px' }}>
                      <div className="field">
                        <label htmlFor="employee-detail-setPassword">סיסמה חדשה לעובד</label>
                        <div className="password-field">
                          <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                          <input data-element-name="שדה_page_26b" className="input" type="password" id="employee-detail-setPassword" value={setPasswordInput} onChange={e => setSetPasswordInput(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button data-element-name="כפתור_page_27b" type="button" onClick={() => { setShowSetPassword(false); setSetPasswordInput(''); setSetPasswordAuth(null); }} className="btn btn-secondary">ביטול</button>
                        <button data-element-name="כפתור_page_28b" type="button" onClick={async () => {
                          if (!setPasswordInput || setPasswordInput.length < 4) {
                            notifyError('הסיסמה חייבת להכיל לפחות 4 תווים');
                            return;
                          }
                          const result = await requestJson(`/api/employees/${id}/set-password`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ authPin: setPasswordAuth?.pin, authEmployeeId: setPasswordAuth?.employeeId, newPassword: setPasswordInput })
                          });
                          if (result.ok) {
                            setShowSetPassword(false);
                            setSetPasswordInput('');
                            setSetPasswordAuth(null);
                            notifySuccess(result.data.message || 'הסיסמה נקבעה בהצלחה');
                          } else {
                            notifyError(describeFailure('קביעת הסיסמה נכשלה', result));
                          }
                        }} className="btn btn-primary">אשר קביעה</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="field">
              <label htmlFor="employee-detail-roleId">מחלקה (תפקיד)</label>
              {deptLoadFailed ? (
                <>
                  {/* רשימת המחלקות לא נטענה - חוזרים לקלט מספרי חופשי כדי לא לחסום עריכה */}
                  <input data-element-name="שדה_page_29" className="input" type="number" id="employee-detail-roleId" name="roleId" value={employee.roleId ?? ''} onChange={handleChange} />
                  <span className="hint" style={{ color: 'var(--danger)' }}>רשימת המחלקות לא נטענה מהשרת - ניתן להזין מספר מחלקה ידנית.</span>
                </>
              ) : departments === null ? (
                <select data-element-name="שדה_page_29" className="select" id="employee-detail-roleId" name="roleId" value="" disabled>
                  <option value="">טוען מחלקות...</option>
                </select>
              ) : (
                <select data-element-name="שדה_page_29" className="select" id="employee-detail-roleId" name="roleId" value={employee.roleId ?? ''} onChange={handleChange}>
                  <option value="">ללא מחלקה</option>
                  {departments.map(dept => (
                    <option key={dept.roleId} value={dept.roleId}>{dept.name} ({dept.roleId})</option>
                  ))}
                  {/* ערך קיים שאינו ברשימה (נתון ישן/שגוי) - מוצג כאופציה כדי שלא יימחק בשקט בשמירה */}
                  {employee.roleId !== null && employee.roleId !== '' && employee.roleId !== undefined &&
                    !departments.some(d => String(d.roleId) === String(employee.roleId)) && (
                    <option value={employee.roleId}>מחלקה לא מוכרת ({employee.roleId})</option>
                  )}
                </select>
              )}
            </div>
            {/* בורר "פלטת גוונים" הישן הוסר — עמודת themeColor הוסבה לאחסון
                העדפות עיצוב פר-עובד (JSON, /api/me/design-prefs); כל עובד
                בוחר לעצמו בעמוד "עיצוב ותצוגה". */}

            {/* show_employee_profile_image (הגדרות > תצוגה) - לפי בקשת ההנהלה (דיווח
                c764bef4) תמונת הפרופיל הוסרה לגמרי כי הפכה למשחק; ניתן להחזיר
                מהגדרות מערכת בלי צורך בעריכת קוד. */}
            {showProfileImage && (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="employee-detail-profileImage">תמונת פרופיל / מסמך (העלאת קובץ)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                {employee.profileImage && employee.profileImage.startsWith('data:image') ? (
                  <img src={employee.profileImage} alt="Profile" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <div className="avatar lg">{initials}</div>
                )}
                <label className="upload-zone" htmlFor="employee-detail-profileImage" title="לחיצה או גרירת קובץ" style={{ flex: 1, minWidth: '220px', padding: '16px' }}>
                  <svg className="icon"><use href="#i-upload" /></svg>
                  <strong>גרור/י קובץ לכאן או לחצ/י לבחירה</strong>
                  <span className="hint">תמונה או PDF</span>
                </label>
                <input data-element-name="שדה_page_31" type="file" id="employee-detail-profileImage" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setEmployee(prev => ({ ...prev, profileImage: reader.result }));
                    };
                    reader.readAsDataURL(file);
                  }
                }} />
                {employee.profileImage && (
                  <button data-element-name="כפתור_page_32" type="button" onClick={() => setEmployee(prev => ({ ...prev, profileImage: '' }))} className="btn btn-danger-ghost btn-sm" title="הסרת התמונה">
                    <svg className="icon"><use href="#i-trash" /></svg>הסר
                  </button>
                )}
              </div>
            </div>
            )}

            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="employee-detail-notes">הערות</label>
              <textarea data-element-name="טקסט_page_33" className="textarea" id="employee-detail-notes" name="notes" value={employee.notes || ''} onChange={handleChange} />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />
          <h2 className="section-title" style={{ marginTop: 0 }}>נתוני שכר</h2>

          <div className="form-grid">
             <div className="field">
                <label htmlFor="employee-detail-hourlyWage">שכר לשעה (₪)</label>
                <input data-element-name="שדה_page_34" className="input" type="number" step="0.01" id="employee-detail-hourlyWage" name="hourlyWage" value={employee.hourlyWage || ''} onChange={handleChange} />
             </div>
             <div className="field">
                <label htmlFor="employee-detail-paymentMethod">אופן תשלום</label>
                <input data-element-name="שדה_page_35" className="input" type="text" id="employee-detail-paymentMethod" name="paymentMethod" value={employee.paymentMethod || ''} onChange={handleChange} />
             </div>
             <div className="field" style={{ justifyContent: 'flex-end' }}>
                <div className="checkbox-row">
                  <input data-element-name="שדה_page_36" type="checkbox" id="employee-detail-travelExpenses" name="travelExpenses" checked={employee.travelExpenses || false} onChange={handleChange} />
                  <label htmlFor="employee-detail-travelExpenses" style={{ fontWeight: 600, color: 'var(--text)' }}>זכאות לנסיעות</label>
                </div>
             </div>
          </div>

          <div className="field" style={{ marginTop: '8px' }}>
            <div className="checkbox-row">
              <input data-element-name="שדה_page_37" type="checkbox" id="employee-detail-isActive" name="isActive" checked={employee.isActive} onChange={handleChange} />
              <label htmlFor="employee-detail-isActive" style={{ fontWeight: 600, color: 'var(--text)' }}>עובד פעיל במערכת</label>
            </div>
          </div>

          <div className="field">
            <div className="checkbox-row">
              <input data-element-name="שדה_page_38" type="checkbox" id="employee-detail-receiveEmailAlerts" name="receiveEmailAlerts" checked={employee.receiveEmailAlerts || false} onChange={handleChange} />
              <label htmlFor="employee-detail-receiveEmailAlerts" style={{ fontWeight: 600, color: 'var(--text)' }}>קבלת התראות מערכת למייל</label>
            </div>
          </div>

          {id !== 'new' && (
            <>
              <h2 className="section-title">הרשאות ספציפיות</h2>
              <p className="page-desc" style={{ marginTop: '-6px' }}>
                מה העובד מורשה, לפי מחלקתו, שורות ההרשאה ב<a href="/admin/permissions">מסך ההרשאות</a> וחריגות אישיות שנקבעות כאן. הכול נשמר מיד ומופיע גם במסך ההרשאות.
              </p>
              <EmployeePermissionsPanel key={permissionsRefresh} employeeId={id} />
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button data-agy-id="save-employee-button" data-element-name="כפתור_page_40" type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'שומר...' : 'שמור פרטים'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'attendance' && (
        <div className="print-area card card-pad">
          <div className="bsd-header" style={{ display: 'none' }}>בס&quot;ד</div>
          <div className="toolbar" style={{ marginBottom: '18px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>דוח נוכחות וסיכום - {employee.firstName} {employee.lastName}</h2>
            <span className="spacer no-print"></span>
            <div className="checkbox-row no-print">
              <input data-element-name="שדה_page_41" type="checkbox" id="employee-detail-showDeletedShifts" checked={showDeletedShifts} onChange={(e) => setShowDeletedShifts(e.target.checked)} />
              <label htmlFor="employee-detail-showDeletedShifts">הצג מחוקות</label>
            </div>
            <select data-element-name="בחירה_page_42" className="select no-print" style={{ width: 'auto' }}
              value={filterMonth}
              onChange={(e) => setFilterMonth(parseInt(e.target.value, 10))}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i}>{new Date(2000, i).toLocaleString('he-IL', { month: 'long' })}</option>
              ))}
            </select>
            <select data-element-name="בחירה_page_43" className="select no-print" style={{ width: 'auto' }}
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button data-element-name="כפתור_page_44" className="btn btn-secondary no-print" type="button" onClick={() => window.print()}>
              <svg data-element-name="רכיב_page_44_icon" className="icon"><use href="#i-printer" /></svg>הדפס / ייצא PDF
            </button>
            <button data-element-name="כפתור_page_45" className="btn btn-primary no-print" type="button" onClick={startAddShift} disabled={isAddingShift || editingShiftId !== null}>
              <svg className="icon"><use href="#i-plus" /></svg>הוסף משמרת
            </button>
          </div>

          <div className="table-wrap" style={{ marginBottom: '20px' }}>
            <div className="table-scroll">
            <table className="data">
              <thead>
                {/* שורה נוספת ב-thead (לא רק כותרות העמודות) - כדי שהחודש/שנה יופיעו מחדש
                    בראש כל עמוד פיזי כשהטבלה נשברת לכמה עמודי הדפסה, בדיוק כמו שורת כותרות
                    העמודות עצמה שחוזרת בזכות table-header-group. */}
                <tr>
                  <th colSpan={8} style={{ textAlign: 'center' }}>
                    תקופה: {new Date(filterYear, filterMonth).toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
                  </th>
                </tr>
                <tr>
                  <th>תאריך לועזי</th>
                  <th>תאריך עברי</th>
                  <th>שעת כניסה</th>
                  <th>שעת יציאה</th>
                  <th>סה&quot;כ דקות</th>
                  <th>לתשלום (₪)</th>
                  <th>הערות</th>
                  <th className="no-print" style={{ textAlign: 'center' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {isAddingShift && (
                  <tr style={{ background: 'var(--surface-alt)' }}>
                    <td colSpan="2">
                      <div style={{ position: 'relative', width: '250px' }}>
                        <HebrewDatePicker data-element-name="רכיב_page_46"
                          selectedDate={editShiftData.date}
                          onChange={handleHebrewDateChange}
                        />
                      </div>
                    </td>
                    <td>
                      <input data-element-name="שדה_page_47" className="input" type="time" name="entryTime" value={editShiftData.entryTime || ''} onChange={handleShiftEditChange} />
                    </td>
                    <td>
                      <input data-element-name="שדה_page_48" className="input" type="time" name="exitTime" value={editShiftData.exitTime || ''} onChange={handleShiftEditChange} />
                    </td>
                    <td>
                      <input data-element-name="שדה_page_49" className="input" type="number" disabled placeholder="מחושב אוטומטית" />
                    </td>
                    <td>
                      <input data-element-name="שדה_page_50" className="input" type="number" disabled placeholder="מחושב אוטומטית" />
                    </td>
                    <td>
                      <input data-element-name="שדה_page_51" className="input" type="text" name="notes" value={editShiftData.notes || ''} onChange={handleShiftEditChange} />
                    </td>
                    <td className="no-print row-actions" style={{ justifyContent: 'center' }}>
                      <button data-element-name="כפתור_page_52" type="button" onClick={saveShift} className="btn btn-primary btn-sm">שמור</button>
                      <button data-element-name="כפתור_page_53" type="button" onClick={cancelEditShift} className="btn btn-secondary btn-sm">בטל</button>
                    </td>
                  </tr>
                )}

                {filteredShifts.map(shift => (
                  <tr key={shift.id} style={{
                    opacity: shift.isDeleted ? 0.6 : 1,
                    textDecoration: shift.isDeleted ? 'line-through' : 'none',
                    background: (!shift.isDeleted && isIncompleteShift(shift)) ? 'color-mix(in srgb, var(--warning-tint) 70%, transparent)' : undefined
                  }}>
                    {editingShiftId === shift.id ? (
                      <>
                        <td>
                           <input data-element-name="שדה_page_54" className="input" type="date" value={editShiftData.date || ''} disabled />
                        </td>
                        <td>
                           <input data-element-name="שדה_page_55" className="input" type="text" value={shift.hebrewDate || ''} disabled />
                        </td>
                        <td>
                          <input data-element-name="שדה_page_56" className="input" type="time" name="entryTime" value={editShiftData.entryTime || ''} onChange={handleShiftEditChange} />
                        </td>
                        <td>
                          <input data-element-name="שדה_page_57" className="input" type="time" name="exitTime" value={editShiftData.exitTime || ''} onChange={handleShiftEditChange} />
                        </td>
                        <td>
                          <input data-element-name="שדה_page_58" className="input" type="number" value={shift.totalMinutes || ''} disabled />
                        </td>
                        <td>
                          <input data-element-name="שדה_page_59" className="input" type="number" value={shift.totalCalculated || ''} disabled />
                        </td>
                        <td>
                          <input data-element-name="שדה_page_60" className="input" type="text" value={shift.notes || ''} disabled />
                        </td>
                        <td className="no-print row-actions" style={{ justifyContent: 'center' }}>
                          <button data-element-name="כפתור_page_61" type="button" onClick={saveShift} className="btn btn-primary btn-sm">שמור</button>
                          <button data-element-name="כפתור_page_62" type="button" onClick={cancelEditShift} className="btn btn-secondary btn-sm">בטל</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="cell-primary">{new Date(shift.date).toLocaleDateString('he-IL')}</td>
                        <td>{shift.hebrewDate || '-'}</td>
                        <td>{shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td>{shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td>{shift.totalMinutes || '-'}</td>
                        <td className="cell-primary">{shift.totalCalculated ? `₪${shift.totalCalculated}` : '-'}</td>
                        <td className="cell-muted">{shift.notes || '-'}</td>
                        <td className="no-print row-actions">
                          {!shift.isDeleted ? (
                            <>
                              <button data-element-name="כפתור_page_63" type="button" onClick={() => startEditShift(shift)} className="btn btn-ghost btn-icon-only btn-sm" title="ערוך רק כניסה ויציאה">
                                <svg data-element-name="רכיב_page_63_icon" className="icon"><use href="#i-edit" /></svg>
                              </button>
                              <button data-element-name="כפתור_page_64" type="button" onClick={() => deleteShift(shift.id)} className="btn btn-ghost btn-icon-only btn-sm" style={{ color: 'var(--danger)' }} title="מחק">
                                <svg data-element-name="רכיב_page_64_icon" className="icon"><use href="#i-trash" /></svg>
                              </button>
                            </>
                          ) : (
                            <button data-element-name="כפתור_page_65" type="button" onClick={() => restoreShift(shift)} className="btn btn-ghost btn-icon-only btn-sm" style={{ color: 'var(--success)' }} title="שחזר">
                              <svg data-element-name="רכיב_page_66" className="icon"><use href="#i-refresh" /></svg>
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {filteredShifts.length === 0 && !isAddingShift && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>אין משמרות לחודש זה.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="card card-pad" style={{ maxWidth: '320px', background: 'var(--success-tint)', borderColor: 'color-mix(in srgb, var(--success) 25%, transparent)' }}>
              <div className="card-title-row" style={{ marginBottom: '6px' }}>
                <svg className="icon" style={{ color: 'var(--success)' }}><use href="#i-coin" /></svg>
                <h3 style={{ margin: 0, color: 'var(--success)' }}>סיכום שכר</h3>
              </div>
              <div className="hint" style={{ marginBottom: '8px' }}>
                {new Date(filterYear, filterMonth).toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                ₪{calculateMonthlySalary()}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="no-print" style={{ padding: 0 }}>
          <ModernEmployeeHistoryTab employeeId={id} />
        </div>
      )}

      {id !== 'new' && (
        <SendEmailModal data-element-name="רכיב_page_68"
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          defaultTo={employee.email}
          employeeId={id}
        />
      )}
    </>
  );
}
