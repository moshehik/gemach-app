'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EmployeePage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [saving, setSaving] = useState(false);

  // Attendance specific states
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editShiftData, setEditShiftData] = useState({});
  const [isAddingShift, setIsAddingShift] = useState(false);

  useEffect(() => {
    fetchEmployee();
  }, [id, router]);

  const fetchEmployee = () => {
    if (id === 'new') {
      setEmployee({ 
        firstName: '', lastName: '', fullName: '', phone1: '', phone2: '', 
        email: '', emailSuffix: '', city: '', street: '', houseNum: '', 
        joinDate: '', password: '', roleId: '', hourlyWage: '', 
        travelExpenses: false, paymentMethod: '', notes: '', 
        isActive: true, shifts: [] 
      });
      setLoading(false);
      return;
    }
    fetch(`/api/employees/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) router.push('/employees');
        else setEmployee(data);
        setLoading(false);
      });
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
    setEditShiftData(prev => {
      const newData = { ...prev, [name]: value };
      
      if (name === 'entryTime' || name === 'exitTime' || name === 'date') {
        const entryStr = name === 'entryTime' ? value : newData.entryTime;
        const exitStr = name === 'exitTime' ? value : newData.exitTime;
        const dateStr = name === 'date' ? value : newData.date;
        
        if (dateStr && entryStr && exitStr) {
          const entry = new Date(`${dateStr.split('T')[0]}T${entryStr}`);
          let exit = new Date(`${dateStr.split('T')[0]}T${exitStr}`);
          // Handle case where exit is after midnight
          if (exit < entry) {
            exit = new Date(exit.getTime() + 24 * 60 * 60 * 1000);
          }
          const diffMs = exit - entry;
          const diffMins = Math.round(diffMs / 60000);
          newData.totalMinutes = diffMins;
          const hourlyWage = parseFloat(employee.hourlyWage) || 0;
          newData.totalCalculated = parseFloat(((diffMins / 60) * hourlyWage).toFixed(2));
        }
      }
      return newData;
    });
  };

  const startEditShift = (shift) => {
    setEditingShiftId(shift.id);
    setEditShiftData({
      date: shift.date ? shift.date.split('T')[0] : '',
      hebrewDate: shift.hebrewDate || '',
      entryTime: shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      exitTime: shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      totalMinutes: shift.totalMinutes || '',
      totalCalculated: shift.totalCalculated || '',
      notes: shift.notes || ''
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
      notes: ''
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

    payload.totalMinutes = payload.totalMinutes ? parseInt(payload.totalMinutes, 10) : null;
    payload.totalCalculated = payload.totalCalculated ? parseFloat(payload.totalCalculated) : null;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        cancelEditShift();
        fetchEmployee();
      } else {
        alert('שגיאה בשמירת משמרת');
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

  const calculateMonthlySalary = () => {
    if (!employee || !employee.shifts) return 0;
    let total = 0;
    employee.shifts.forEach(shift => {
       const shiftDate = new Date(shift.date);
       if (shiftDate.getMonth() === filterMonth && shiftDate.getFullYear() === filterYear && shift.totalCalculated) {
          total += shift.totalCalculated;
       }
    });
    return total.toFixed(2);
  };

  if (loading) return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>;
  if (!employee) return null;

  const filteredShifts = employee.shifts?.filter(shift => {
    const d = new Date(shift.date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  }) || [];

  return (
    <main className="container animate-fade-in" style={{ paddingTop: '2rem', maxWidth: '1000px' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; direction: rtl; }
          .no-print { display: none !important; }
        }
      `}} />

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link href="/employees" className="btn btn-outline" style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          →
        </Link>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>
          {id === 'new' ? 'עובד חדש' : `כרטיס עובד: ${employee.firstName} ${employee.lastName}`}
        </h1>
      </div>

      {id !== 'new' && (
        <div className="no-print" style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #eee', marginBottom: '2rem' }}>
          <button 
            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} 
            onClick={() => setActiveTab('details')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'details' ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === 'details' ? 'bold' : 'normal', color: activeTab === 'details' ? 'var(--primary-color)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s' }}
          >
            פרטי עובד
          </button>
          <button 
            className={`tab-btn ${activeTab === 'attendance' ? 'active' : ''}`} 
            onClick={() => setActiveTab('attendance')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'attendance' ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === 'attendance' ? 'bold' : 'normal', color: activeTab === 'attendance' ? 'var(--primary-color)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s' }}
          >
            נוכחות וסיכום
          </button>
        </div>
      )}

      {activeTab === 'details' && (
        <form className="no-print" onSubmit={handleSave} style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם פרטי *</label>
              <input type="text" name="firstName" value={employee.firstName || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם משפחה *</label>
              <input type="text" name="lastName" value={employee.lastName || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם מלא (מחושב/לתצוגה)</label>
              <input type="text" name="fullName" value={employee.fullName || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>תאריך כניסה לארגון</label>
              <input type="date" name="joinDate" value={employee.joinDate ? new Date(employee.joinDate).toISOString().split('T')[0] : ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>טלפון נייד *</label>
              <input type="text" name="phone1" value={employee.phone1 || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>טלפון נוסף</label>
              <input type="text" name="phone2" value={employee.phone2 || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>דוא"ל</label>
              <input type="email" name="email" value={employee.email || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>סיומת מייל</label>
              <input type="text" name="emailSuffix" value={employee.emailSuffix || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>עיר</label>
              <input type="text" name="city" value={employee.city || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>רחוב</label>
              <input type="text" name="street" value={employee.street || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>בית</label>
              <input type="text" name="houseNum" value={employee.houseNum || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>סיסמא לשעון נוכחות</label>
              <input type="text" name="password" value={employee.password || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>מספר מחלקה (תפקיד)</label>
              <input type="number" name="roleId" value={employee.roleId || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>הערות</label>
              <textarea name="notes" value={employee.notes || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', minHeight: '80px' }} />
            </div>
          </div>
          
          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '2rem 0' }} />
          <h3 style={{ color: 'var(--primary-color)', marginBottom: '1rem' }}>נתוני שכר</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
             <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שכר לשעה (₪)</label>
                <input type="number" step="0.01" name="hourlyWage" value={employee.hourlyWage || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
             </div>
             <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>אופן תשלום</label>
                <input type="text" name="paymentMethod" value={employee.paymentMethod || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
             </div>
             <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
                  <input type="checkbox" name="travelExpenses" checked={employee.travelExpenses || false} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
                  זכאות לנסיעות
                </label>
             </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input type="checkbox" name="isActive" checked={employee.isActive} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
              עובד פעיל במערכת
            </label>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 2rem', borderRadius: '24px', fontSize: '1.1rem' }}>
              {saving ? 'שומר...' : 'שמור פרטים'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'attendance' && (
        <div className="print-area" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>דוח נוכחות וסיכום - {employee.firstName} {employee.lastName}</h2>
            <div className="no-print" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(parseInt(e.target.value, 10))}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc' }}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>{new Date(2000, i).toLocaleString('he-IL', { month: 'long' })}</option>
                ))}
              </select>
              <select 
                value={filterYear} 
                onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc' }}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button className="btn btn-outline" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🖨️ הדפס / ייצא PDF
              </button>
              <button className="btn btn-primary" onClick={startAddShift} disabled={isAddingShift}>
                + הוסף משמרת
              </button>
            </div>
          </div>

          <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', marginBottom: '2rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem' }}>תאריך לועזי</th>
                <th style={{ padding: '1rem' }}>תאריך עברי</th>
                <th style={{ padding: '1rem' }}>שעת כניסה</th>
                <th style={{ padding: '1rem' }}>שעת יציאה</th>
                <th style={{ padding: '1rem' }}>סה"כ דקות</th>
                <th style={{ padding: '1rem' }}>לתשלום (₪)</th>
                <th style={{ padding: '1rem' }}>הערות</th>
                <th className="no-print" style={{ padding: '1rem', textAlign: 'center' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {isAddingShift && (
                <tr style={{ borderBottom: '1px solid #eee', background: '#f9f9f9' }}>
                  <td style={{ padding: '0.5rem' }}>
                    <input type="date" name="date" value={editShiftData.date || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input type="text" name="hebrewDate" value={editShiftData.hebrewDate || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="אופציונלי" />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input type="time" name="entryTime" value={editShiftData.entryTime || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input type="time" name="exitTime" value={editShiftData.exitTime || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input type="number" name="totalMinutes" value={editShiftData.totalMinutes || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input type="number" step="0.01" name="totalCalculated" value={editShiftData.totalCalculated || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input type="text" name="notes" value={editShiftData.notes || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                  </td>
                  <td className="no-print" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button onClick={saveShift} className="btn" style={{ background: '#2e7d32', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.9rem', borderRadius: '6px' }}>שמור</button>
                    <button onClick={cancelEditShift} className="btn" style={{ background: '#d32f2f', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.9rem', borderRadius: '6px' }}>בטל</button>
                  </td>
                </tr>
              )}

              {filteredShifts.map(shift => (
                <tr key={shift.id} style={{ borderBottom: '1px solid #eee' }}>
                  {editingShiftId === shift.id ? (
                    <>
                      <td style={{ padding: '0.5rem' }}>
                        <input type="date" name="date" value={editShiftData.date || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input type="text" name="hebrewDate" value={editShiftData.hebrewDate || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input type="time" name="entryTime" value={editShiftData.entryTime || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input type="time" name="exitTime" value={editShiftData.exitTime || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input type="number" name="totalMinutes" value={editShiftData.totalMinutes || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input type="number" step="0.01" name="totalCalculated" value={editShiftData.totalCalculated || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input type="text" name="notes" value={editShiftData.notes || ''} onChange={handleShiftEditChange} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                      </td>
                      <td className="no-print" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button onClick={saveShift} className="btn" style={{ background: '#2e7d32', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.9rem', borderRadius: '6px' }}>שמור</button>
                        <button onClick={cancelEditShift} className="btn" style={{ background: '#f57c00', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.9rem', borderRadius: '6px' }}>בטל</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '1rem' }}>{new Date(shift.date).toLocaleDateString('he-IL')}</td>
                      <td style={{ padding: '1rem' }}>{shift.hebrewDate || '-'}</td>
                      <td style={{ padding: '1rem' }}>{shift.entryTime ? new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td style={{ padding: '1rem' }}>{shift.exitTime ? new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td style={{ padding: '1rem' }}>{shift.totalMinutes || '-'}</td>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{shift.totalCalculated ? `₪${shift.totalCalculated}` : '-'}</td>
                      <td style={{ padding: '1rem' }}>{shift.notes || '-'}</td>
                      <td className="no-print" style={{ padding: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button onClick={() => startEditShift(shift)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem' }} title="ערוך">✏️</button>
                        <button onClick={() => deleteShift(shift.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#d32f2f', padding: '0.2rem' }} title="מחק">🗑️</button>
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
    </main>
  );
}
