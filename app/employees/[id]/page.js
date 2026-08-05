'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SendEmailModal from '@/components/SendEmailModal';
import HebrewDatePicker from '@/components/HebrewDatePicker';
import { Copy, Mail, History, RotateCcw } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // History state
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchEmployee();
  }, [id, router, showDeletedShifts]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

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

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/employees/${id}/history`);
      const data = await res.json();
      setHistoryLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

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
      date: new Date(filterYear, filterMonth, 1).toISOString().split('T')[0],
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

    const payload = { ...editShiftData };
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

  const filteredShifts = employee.shifts?.filter(shift => {
    const d = new Date(shift.date);
    if (!showDeletedShifts && shift.isDeleted) return false;
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  }) || [];

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
        <div className="no-print" style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #eee', marginBottom: '2rem' }}>
          <button data-element-name="כפתור_page_2" 
            data-agy-id="tab-employee-details"
            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} 
            onClick={() => setActiveTab('details')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'details' ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === 'details' ? 'bold' : 'normal', color: activeTab === 'details' ? 'var(--primary-color)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s' }}
          >
            פרטי עובד
          </button>
          <button data-element-name="כפתור_page_3" 
            data-agy-id="tab-employee-attendance"
            className={`tab-btn ${activeTab === 'attendance' ? 'active' : ''}`} 
            onClick={() => setActiveTab('attendance')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'attendance' ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === 'attendance' ? 'bold' : 'normal', color: activeTab === 'attendance' ? 'var(--primary-color)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s' }}
          >
            נוכחות וסיכום
          </button>
          <button data-element-name="כפתור_page_4" 
            data-agy-id="tab-employee-history"
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} 
            onClick={() => setActiveTab('history')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'history' ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === 'history' ? 'bold' : 'normal', color: activeTab === 'history' ? 'var(--primary-color)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <History data-element-name="רכיב_page_5" size={18} /> היסטוריה
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
                  <>
                    <button data-element-name="כפתור_page_13" type="button" onClick={() => navigator.clipboard.writeText(employee.email)} title="העתק כתובת מייל" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <Copy data-element-name="רכיב_page_14" size={20} />
                    </button>
                    <button data-element-name="כפתור_page_15" type="button" onClick={() => setEmailModalOpen(true)} title="שלח מייל" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)' }}>
                      <Mail data-element-name="רכיב_page_16" size={20} />
                    </button>
                  </>
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
                    <input data-element-name="שדה_page_22" type="password" value={showPassword ? employee.password || '' : '********'} disabled style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', background: '#f8fafc', color: '#64748b' }} />
                    <button data-element-name="כפתור_page_23" type="button" onClick={async () => {
                      if (showPassword) { setShowPassword(false); return; }
                      const authResult = await window.customAuthPrompt("הזן קוד מנהל לצפייה בסיסמא:", "מנהל");
                      if (!authResult) return;
                      try {
                        const res = await fetch('/api/auth/verify-pin', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'מנהל' })
                        });
                        const data = await res.json();
                        if (data.success) {
                          setShowPassword(true);
                        } else {
                          window.alert(data.error || 'קוד מנהל שגוי או הרשאה לא מספקת.');
                        }
                      } catch (e) {
                        window.alert('שגיאה באימות מנהל');
                      }
                    }} className="btn btn-outline" style={{ whiteSpace: 'nowrap', padding: '0.75rem 1rem' }}>{showPassword ? 'הסתר' : 'הצג'}</button>
                    <button data-element-name="כפתור_page_24" type="button" onClick={() => setShowChangePassword(true)} className="btn btn-primary" style={{ whiteSpace: 'nowrap', padding: '0.75rem 1rem' }}>שינוי סיסמא</button>
                  </div>
                  
                  {showChangePassword && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.2rem' }}>סיסמא ישנה</label>
                        <input data-element-name="שדה_page_25" type="password" value={oldPasswordInput} onChange={e => setOldPasswordInput(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.2rem' }}>סיסמא חדשה</label>
                        <input data-element-name="שדה_page_26" type="password" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button data-element-name="כפתור_page_27" type="button" onClick={() => { setShowChangePassword(false); setOldPasswordInput(''); setNewPasswordInput(''); }} className="btn" style={{ background: 'white', border: '1px solid #cbd5e1' }}>ביטול</button>
                        <button data-element-name="כפתור_page_28" type="button" onClick={() => {
                          if (oldPasswordInput !== employee.password) {
                              window.alert('הסיסמא הישנה אינה נכונה');
                              return;
                          }
                          if (!newPasswordInput) {
                              window.alert('יש להזין סיסמא חדשה');
                              return;
                          }
                          setEmployee(prev => ({ ...prev, password: newPasswordInput }));
                          setShowChangePassword(false);
                          setOldPasswordInput('');
                          setNewPasswordInput('');
                          window.alert('הסיסמא שונתה (לחץ על "שמור פרטים" למטה כדי לשמור)');
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
          
          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '2rem 0' }} />
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
                🖨️ הדפס / ייצא PDF
              </button>
              <button data-element-name="כפתור_page_45" className="btn btn-primary" onClick={startAddShift} disabled={isAddingShift || editingShiftId !== null}>
                + הוסף משמרת
              </button>
            </div>
          </div>

          <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', marginBottom: '2rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
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
                <tr style={{ borderBottom: '1px solid #eee', background: '#f9f9f9' }}>
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
                    <input data-element-name="שדה_page_49" type="number" disabled placeholder="מחושב אוטומטית" style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: '#f0f0f0' }} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input data-element-name="שדה_page_50" type="number" disabled placeholder="מחושב אוטומטית" style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: '#f0f0f0' }} />
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
                <tr key={shift.id} style={{ borderBottom: '1px solid #eee', opacity: shift.isDeleted ? 0.6 : 1, textDecoration: shift.isDeleted ? 'line-through' : 'none' }}>
                  {editingShiftId === shift.id ? (
                    <>
                      <td style={{ padding: '0.5rem' }}>
                         <input data-element-name="שדה_page_54" type="date" value={editShiftData.date || ''} disabled style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: '#f0f0f0' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                         <input data-element-name="שדה_page_55" type="text" value={shift.hebrewDate || ''} disabled style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: '#f0f0f0' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input data-element-name="שדה_page_56" type="time" name="entryTime" value={editShiftData.entryTime || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input data-element-name="שדה_page_57" type="time" name="exitTime" value={editShiftData.exitTime || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input data-element-name="שדה_page_58" type="number" value={shift.totalMinutes || ''} disabled style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: '#f0f0f0' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input data-element-name="שדה_page_59" type="number" value={shift.totalCalculated || ''} disabled style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: '#f0f0f0' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input data-element-name="שדה_page_60" type="text" value={shift.notes || ''} disabled style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--element-border)', borderRadius: '4px', background: '#f0f0f0' }} />
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
                      <td className="no-print" style={{ padding: '0.4rem 0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {!shift.isDeleted ? (
                          <>
                            <button data-element-name="כפתור_page_63" onClick={() => startEditShift(shift)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem' }} title="ערוך רק כניסה ויציאה">✏️</button>
                            <button data-element-name="כפתור_page_64" onClick={() => deleteShift(shift.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#d32f2f', padding: '0.2rem' }} title="מחק">🗑️</button>
                          </>
                        ) : (
                          <button data-element-name="כפתור_page_65" onClick={() => restoreShift(shift)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#2e7d32', padding: '0.2rem' }} title="שחזר">
                            <RotateCcw data-element-name="רכיב_page_66" size={18} />
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
        <div className="no-print animate-fade-in" style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ color: 'var(--primary-color)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History data-element-name="רכיב_page_67" size={24} /> היסטוריית שינויים (Audit Log)
          </h2>
          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>טוען היסטוריה...</div>
          ) : historyLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>אין תיעוד היסטוריה לעובד זה.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {historyLogs.map(log => (
                <div key={log.id} style={{ border: '1px solid var(--element-border)', borderRadius: '8px', padding: '1rem', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--text-main)' }}>
                      {log.action === 'CREATE' ? 'הוספה' : log.action === 'UPDATE' ? 'עדכון' : 'מחיקה'} - {log.entityType === 'Shift' ? 'משמרת' : log.entityType}
                    </strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(log.createdAt).toLocaleString('he-IL')}
                    </span>
                  </div>
                  <pre style={{ margin: 0, fontSize: '0.85rem', background: '#eee', padding: '0.5rem', borderRadius: '4px', overflowX: 'auto', direction: 'ltr' }}>
                    {JSON.stringify(JSON.parse(log.changesJson), null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
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
