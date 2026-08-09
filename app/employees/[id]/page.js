'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SendEmailModal from '@/components/SendEmailModal';
import HebrewDatePicker from '@/components/HebrewDatePicker';
import ModernEmployeeHistoryTab from '@/components/employees/ModernEmployeeHistoryTab';
import modernOrderCss from '@/components/orders/modern/modernOrderStyles';
import { Copy, Mail, History, RotateCcw, Printer, Pencil, Trash2 } from 'lucide-react';

export default function EmployeePage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details'); // details, attendance, history
  const [saving, setSaving] = useState(false);
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

  const fetchEmployee = () => {
    if (id === 'new') {
      setEmployee({
        firstName: '', lastName: '', fullName: '', phone1: '', phone2: '',
        email: '', emailSuffix: '', city: '', street: '', houseNum: '',
        joinDate: '', password: '', roleId: '', hourlyWage: '',
        travelExpenses: false, paymentMethod: '', notes: '',
        themeColor: 'standard', profileImage: '',
        isActive: true, receiveEmailAlerts: false, shifts: []
      });
      setLoading(false);
      return;
    }
    const query = showDeletedShifts ? '?includeDeleted=true' : '';
    fetch(`/api/employees/${id}${query}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) router.push('/employees');
        else setEmployee(data);
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee)
      });
      const data = await res.json();
      if (id === 'new' && data.id) {
        router.push(`/employees/${data.id}`);
      } else {
        alert('הפרטים נשמרו בהצלחה!');
      }
    } catch (e) {
      alert('שגיאה בשמירת נתונים');
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
        alert('יש לבחור תאריך למשמרת');
        return;
      }
      const [dY, dM] = editShiftData.date.split('-').map(Number);
      if ((dM - 1) !== filterMonth || dY !== filterYear) {
        const displayedLabel = new Date(filterYear, filterMonth).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
        alert(`לא ניתן להוסיף משמרת בתאריך שאינו בחודש המוצג (${displayedLabel}). יש לבחור תאריך בתוך החודש המוצג, או לעבור לחודש הרצוי ואז להוסיף את המשמרת.`);
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

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        cancelEditShift();
        fetchEmployee();
      } else {
        alert(data.error || 'שגיאה בשמירת משמרת');
      }
    } catch (e) {
      alert('שגיאה בתקשורת');
    }
  };

  const deleteShift = async (shiftId) => {
    if (!await window.customConfirm('האם אתה בטוח שברצונך למחוק משמרת זו? ההיסטוריה תישמר במערכת אך השורה תוסתר.')) return;
    try {
      const res = await fetch(`/api/employees/${id}/shifts/${shiftId}`, { method: 'DELETE' });
      if (res.ok) fetchEmployee();
      else alert('שגיאה במחיקת משמרת');
    } catch (e) {
      alert('שגיאה בתקשורת');
    }
  };

  const restoreShift = async (shift) => {
    if (!await window.customConfirm('האם לשחזר משמרת זו?')) return;
    try {
      const res = await fetch(`/api/employees/${id}/shifts/${shift.id}`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: false })
      });
      const data = await res.json();
      if (res.ok) fetchEmployee();
      else alert(data.error || 'שגיאה בשחזור המשמרת');
    } catch (e) {
      alert('שגיאה בתקשורת');
    }
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

  if (loading) return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>;
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

  return (
    <main data-agy-id="employee-details-main" className="container animate-fade-in" style={{ paddingTop: '2rem', maxWidth: '1000px' }}>
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

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button data-element-name="כפתור_page_1" data-agy-id="back-button" type="button" onClick={() => router.back()} className="btn btn-outline" style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          →
        </button>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>
          {id === 'new' ? 'עובד חדש' : `כרטיס עובד: ${employee.firstName} ${employee.lastName}`}
        </h1>
      </div>

      {id !== 'new' && (
        <div className="no-print status-filters" style={{ marginBottom: '2rem' }}>
          <button data-element-name="כפתור_page_2"
            data-agy-id="tab-employee-details"
            className={activeTab === 'details' ? 'status-filter active c-blue' : 'status-filter'}
            onClick={() => setActiveTab('details')}
          >
            <span>פרטי עובד</span>
          </button>
          <button data-element-name="כפתור_page_3"
            data-agy-id="tab-employee-attendance"
            className={activeTab === 'attendance' ? 'status-filter active c-blue' : 'status-filter'}
            onClick={() => setActiveTab('attendance')}
          >
            <span>נוכחות וסיכום</span>
          </button>
          <button data-element-name="כפתור_page_4"
            data-agy-id="tab-employee-history"
            className={activeTab === 'history' ? 'status-filter active c-blue' : 'status-filter'}
            onClick={() => setActiveTab('history')}
          >
            <History data-element-name="רכיב_page_5" size={16} />
            <span>היסטוריה</span>
          </button>
        </div>
      )}

      {activeTab === 'details' && (
        <form data-agy-id="employee-form" className="no-print" onSubmit={handleSave} style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם פרטי *</label>
              <input data-element-name="שדה_page_6" type="text" name="firstName" value={employee.firstName || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם משפחה *</label>
              <input data-element-name="שדה_page_7" type="text" name="lastName" value={employee.lastName || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם מלא (מחושב/לתצוגה)</label>
              <input data-element-name="שדה_page_8" type="text" name="fullName" value={employee.fullName || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>תאריך כניסה לארגון</label>
              <input data-element-name="שדה_page_9" type="date" name="joinDate" value={employee.joinDate ? new Date(employee.joinDate).toISOString().split('T')[0] : ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>טלפון נייד *</label>
              <input data-element-name="שדה_page_10" type="text" name="phone1" value={employee.phone1 || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>טלפון נוסף</label>
              <input data-element-name="שדה_page_11" type="text" name="phone2" value={employee.phone2 || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>דוא"ל</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input data-element-name="שדה_page_12" type="email" name="email" value={employee.email || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
                {employee.email && (
                  <div className="icon-toolbar" style={{ marginRight: 0 }}>
                    <button data-element-name="כפתור_page_13" type="button" onClick={() => navigator.clipboard.writeText(employee.email)} title="העתק כתובת מייל" className="icon-btn">
                      <Copy data-element-name="רכיב_page_14" size={18} />
                    </button>
                    <button data-element-name="כפתור_page_15" type="button" onClick={() => setEmailModalOpen(true)} title="שלח מייל" className="icon-btn" style={{ color: 'var(--primary-color)' }}>
                      <Mail data-element-name="רכיב_page_16" size={18} />
                    </button>
                  </div>
                )}
              </div>
              {(!employee.email || !employee.email.includes('@')) && (
                <div style={{ marginTop: '0.5rem' }}>
                  <button data-element-name="כפתור_page_17"
                    type="button"
                    onClick={() => {
                      const currentEmail = employee.email || '';
                      setEmployee(prev => ({ ...prev, email: currentEmail + '@gmail.com' }));
                    }}
                    style={{
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.85rem',
                      background: 'var(--primary-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.opacity = '0.8'}
                    onMouseOut={(e) => e.target.style.opacity = '1'}
                  >
                    השלם ל- @gmail.com
                  </button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>עיר</label>
              <input data-element-name="שדה_page_18" type="text" name="city" value={employee.city || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>רחוב</label>
              <input data-element-name="שדה_page_19" type="text" name="street" value={employee.street || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>בית</label>
              <input data-element-name="שדה_page_20" type="text" name="houseNum" value={employee.houseNum || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>סיסמא לשעון נוכחות</label>
              {id === 'new' ? (
                <input data-element-name="שדה_page_21" type="text" name="password" value={employee.password || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input data-element-name="שדה_page_22" type="password" value="********" disabled style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: 'var(--element-bg)', color: 'var(--text-muted)' }} />
                    <button data-element-name="כפתור_page_24" type="button" onClick={() => setShowChangePassword(true)} className="btn btn-primary" style={{ whiteSpace: 'nowrap', padding: '0.75rem 1rem' }}>שינוי סיסמא</button>
                    <button data-element-name="כפתור_page_23" type="button" onClick={async () => {
                      const authResult = await window.customAuthPrompt("הזן קוד מנהל לאיפוס הסיסמה ושליחתה למייל העובד:", "מנהל");
                      if (!authResult) return;
                      try {
                        const res = await fetch(`/api/employees/${id}/reset-password`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ authPin: authResult.pin, authEmployeeId: authResult.employeeId })
                        });
                        const data = await res.json();
                        if (data.success) {
                          window.alert(data.message || 'סיסמה זמנית נשלחה למייל העובד');
                        } else {
                          window.alert(data.message || 'איפוס הסיסמה נכשל');
                        }
                      } catch (e) {
                        window.alert('שגיאה באיפוס הסיסמה');
                      }
                    }} className="btn btn-outline" style={{ whiteSpace: 'nowrap', padding: '0.75rem 1rem' }}>אפס ושלח למייל</button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: 0 }}>
                    מטעמי אבטחה לא ניתן לצפות בסיסמה קיימת - ניתן לשנות אותה (בידיעת הסיסמה הנוכחית) או לאפס ולשלוח סיסמה זמנית לעובד במייל.
                  </p>

                  {showChangePassword && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--element-bg)', borderRadius: '8px', border: '1px solid var(--element-border)' }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.2rem' }}>סיסמא ישנה</label>
                        <input data-element-name="שדה_page_25" type="password" value={oldPasswordInput} onChange={e => setOldPasswordInput(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)' }} />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.2rem' }}>סיסמא חדשה</label>
                        <input data-element-name="שדה_page_26" type="password" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button data-element-name="כפתור_page_27" type="button" onClick={() => { setShowChangePassword(false); setOldPasswordInput(''); setNewPasswordInput(''); }} className="btn" style={{ background: 'var(--card-bg)', border: '1px solid var(--element-border)' }}>ביטול</button>
                        <button data-element-name="כפתור_page_28" type="button" onClick={async () => {
                          if (!newPasswordInput) {
                              window.alert('יש להזין סיסמא חדשה');
                              return;
                          }
                          try {
                            const res = await fetch(`/api/employees/${id}/password`, {
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
                          } catch (e) {
                            window.alert('שגיאה בשינוי הסיסמה');
                          }
                        }} className="btn btn-primary">אשר שינוי</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>מספר מחלקה (תפקיד)</label>
              <input data-element-name="שדה_page_29" type="number" name="roleId" value={employee.roleId || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>פלטת גוונים מודרנית לפרופיל</label>
              <select data-element-name="בחירה_page_30" name="themeColor" value={employee.themeColor || 'standard'} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }}>
                <option value="standard">סטנדרט</option>
                <option value="dark">מצב לילה</option>
                <option value="vibrant">צבעוני ומודרני</option>
                <option value="pastel">גווני פסטל עדינים</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>תמונת פרופיל / מסמך (העלאת קובץ)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input data-element-name="שדה_page_31" type="file" accept="image/*,.pdf" onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setEmployee(prev => ({ ...prev, profileImage: reader.result }));
                    };
                    reader.readAsDataURL(file);
                  }
                }} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
                {employee.profileImage && (
                  <button data-element-name="כפתור_page_32" type="button" onClick={() => setEmployee(prev => ({ ...prev, profileImage: '' }))} className="btn" style={{ padding: '0.5rem', color: '#d32f2f' }}>הסר</button>
                )}
              </div>
              {employee.profileImage && employee.profileImage.startsWith('data:image') && (
                <div style={{ marginTop: '0.5rem' }}>
                  <img src={employee.profileImage} alt="Profile" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--primary-color)' }} />
                </div>
              )}
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>הערות</label>
              <textarea data-element-name="טקסט_page_33" name="notes" value={employee.notes || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', minHeight: '80px' }} />
            </div>
          </div>
          
          <hr style={{ border: 'none', borderTop: '1px solid var(--element-border)', margin: '2rem 0' }} />
          <h3 style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>נתוני שכר</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
             <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שכר לשעה (₪)</label>
                <input data-element-name="שדה_page_34" type="number" step="0.01" name="hourlyWage" value={employee.hourlyWage || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
             </div>
             <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>אופן תשלום</label>
                <input data-element-name="שדה_page_35" type="text" name="paymentMethod" value={employee.paymentMethod || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
             </div>
             <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
                  <input data-element-name="שדה_page_36" type="checkbox" name="travelExpenses" checked={employee.travelExpenses || false} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
                  זכאות לנסיעות
                </label>
             </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input data-element-name="שדה_page_37" type="checkbox" name="isActive" checked={employee.isActive} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
              עובד פעיל במערכת
            </label>
          </div>

          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input data-element-name="שדה_page_38" type="checkbox" name="receiveEmailAlerts" checked={employee.receiveEmailAlerts || false} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
              קבלת התראות מערכת למייל
            </label>
          </div>

          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input data-element-name="שדה_page_39" type="checkbox" name="showAi" checked={employee.showAi || false} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
              הצג AI לעובד זה
            </label>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button data-element-name="כפתור_page_40" data-agy-id="save-employee-button" type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 2rem', borderRadius: '24px', fontSize: '1.1rem' }}>
              {saving ? 'שומר...' : 'שמור פרטים'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'attendance' && (
        <div className="print-area" style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div className="bsd-header" style={{ display: 'none' }}>בס"ד</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>דוח נוכחות וסיכום - {employee.firstName} {employee.lastName}</h2>
            <div className="no-print" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input data-element-name="שדה_page_41" type="checkbox" checked={showDeletedShifts} onChange={(e) => setShowDeletedShifts(e.target.checked)} />
                הצג מחוקות
              </label>
              <select data-element-name="בחירה_page_42" 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(parseInt(e.target.value, 10))}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--element-border)' }}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>{new Date(2000, i).toLocaleString('he-IL', { month: 'long' })}</option>
                ))}
              </select>
              <select data-element-name="בחירה_page_43" 
                value={filterYear} 
                onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--element-border)' }}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button data-element-name="כפתור_page_44" className="btn btn-outline" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer data-element-name="רכיב_page_44_icon" size={16} /> הדפס / ייצא PDF
              </button>
              <button data-element-name="כפתור_page_45" className="btn btn-primary" onClick={startAddShift} disabled={isAddingShift || editingShiftId !== null}>
                + הוסף משמרת
              </button>
            </div>
          </div>

          <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', marginBottom: '2rem' }}>
            <thead>
              {/* שורה נוספת ב-thead (לא רק כותרות העמודות) - כדי שהחודש/שנה יופיעו מחדש
                  בראש כל עמוד פיזי כשהטבלה נשברת לכמה עמודי הדפסה, בדיוק כמו שורת כותרות
                  העמודות עצמה שחוזרת בזכות table-header-group. */}
              <tr>
                <th colSpan={8} style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 'bold' }}>
                  תקופה: {new Date(filterYear, filterMonth).toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
                </th>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--element-border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.4rem 0.5rem' }}>תאריך לועזי</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>תאריך עברי</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>שעת כניסה</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>שעת יציאה</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>סה"כ דקות</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>לתשלום (₪)</th>
                <th style={{ padding: '0.4rem 0.5rem' }}>הערות</th>
                <th className="no-print" style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {isAddingShift && (
                <tr style={{ borderBottom: '1px solid var(--element-border)', background: 'var(--element-bg)' }}>
                  <td colSpan="2" style={{ padding: '0.5rem' }}>
                    <div style={{ position: 'relative', width: '250px' }}>
                      <HebrewDatePicker data-element-name="רכיב_page_46" 
                        selectedDate={editShiftData.date}
                        onChange={handleHebrewDateChange}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input data-element-name="שדה_page_47" type="time" name="entryTime" value={editShiftData.entryTime || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input data-element-name="שדה_page_48" type="time" name="exitTime" value={editShiftData.exitTime || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input data-element-name="שדה_page_49" type="number" disabled placeholder="מחושב אוטומטית" style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: 'var(--element-bg)' }} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input data-element-name="שדה_page_50" type="number" disabled placeholder="מחושב אוטומטית" style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: 'var(--element-bg)' }} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input data-element-name="שדה_page_51" type="text" name="notes" value={editShiftData.notes || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px' }} />
                  </td>
                  <td className="no-print" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button data-element-name="כפתור_page_52" onClick={saveShift} className="btn" style={{ background: '#2e7d32', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.9rem', borderRadius: '6px' }}>שמור</button>
                    <button data-element-name="כפתור_page_53" onClick={cancelEditShift} className="btn" style={{ background: '#d32f2f', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.9rem', borderRadius: '6px' }}>בטל</button>
                  </td>
                </tr>
              )}

              {filteredShifts.map(shift => (
                <tr key={shift.id} style={{
                  borderBottom: '1px solid var(--element-border)',
                  opacity: shift.isDeleted ? 0.6 : 1,
                  textDecoration: shift.isDeleted ? 'line-through' : 'none',
                  background: (!shift.isDeleted && isIncompleteShift(shift)) ? '#ffeb3b4a' : 'transparent'
                }}>
                  {editingShiftId === shift.id ? (
                    <>
                      <td style={{ padding: '0.5rem' }}>
                         <input data-element-name="שדה_page_54" type="date" value={editShiftData.date || ''} disabled style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: 'var(--element-bg)' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                         <input data-element-name="שדה_page_55" type="text" value={shift.hebrewDate || ''} disabled style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: 'var(--element-bg)' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input data-element-name="שדה_page_56" type="time" name="entryTime" value={editShiftData.entryTime || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input data-element-name="שדה_page_57" type="time" name="exitTime" value={editShiftData.exitTime || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input data-element-name="שדה_page_58" type="number" value={shift.totalMinutes || ''} disabled style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: 'var(--element-bg)' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input data-element-name="שדה_page_59" type="number" value={shift.totalCalculated || ''} disabled style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: 'var(--element-bg)' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input data-element-name="שדה_page_60" type="text" value={shift.notes || ''} disabled style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: 'var(--element-bg)' }} />
                      </td>
                      <td className="no-print" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button data-element-name="כפתור_page_61" onClick={saveShift} className="btn" style={{ background: '#2e7d32', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.9rem', borderRadius: '6px' }}>שמור</button>
                        <button data-element-name="כפתור_page_62" onClick={cancelEditShift} className="btn" style={{ background: '#f57c00', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.9rem', borderRadius: '6px' }}>בטל</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{new Date(shift.date).toLocaleDateString('he-IL')}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{shift.hebrewDate || '-'}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{shift.totalMinutes || '-'}</td>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: 'bold' }}>{shift.totalCalculated ? `₪${shift.totalCalculated}` : '-'}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{shift.notes || '-'}</td>
                      <td className="no-print icon-toolbar" style={{ padding: '0.4rem 0.5rem', justifyContent: 'center', marginRight: 0 }}>
                        {!shift.isDeleted ? (
                          <>
                            <button data-element-name="כפתור_page_63" onClick={() => startEditShift(shift)} className="icon-btn" title="ערוך רק כניסה ויציאה">
                              <Pencil data-element-name="רכיב_page_63_icon" size={16} />
                            </button>
                            <button data-element-name="כפתור_page_64" onClick={() => deleteShift(shift.id)} className="icon-btn" style={{ color: '#d32f2f' }} title="מחק">
                              <Trash2 data-element-name="רכיב_page_64_icon" size={16} />
                            </button>
                          </>
                        ) : (
                          <button data-element-name="כפתור_page_65" onClick={() => restoreShift(shift)} className="icon-btn" style={{ color: '#2e7d32' }} title="שחזר">
                            <RotateCcw data-element-name="רכיב_page_66" size={16} />
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filteredShifts.length === 0 && !isAddingShift && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>אין משמרות לחודש זה.</td>
                </tr>
              )}
            </tbody>
          </table>
          
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ textAlign: 'center', background: '#f0fdf4', padding: '1.5rem 3rem', borderRadius: '12px', border: '1px solid #bbf7d0', minWidth: '300px' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#166534' }}>סיכום שכר</h3>
              <div style={{ fontSize: '1rem', color: '#15803d', marginBottom: '1rem' }}>
                {new Date(filterYear, filterMonth).toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#15803d' }}>
                ₪{calculateMonthlySalary()}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="no-print animate-fade-in moc" style={{ padding: 0 }}>
          {/* אותו עיצוב "כרטיס מודרני" (moc) שבו מעוצב פאנל ההיסטוריה בכרטיס ההזמנה/לקוח */}
          <style>{modernOrderCss}</style>
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
    </main>
  );
}
