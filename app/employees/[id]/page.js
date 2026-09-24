'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SendEmailModal from '@/components/SendEmailModal';
import HebrewDatePicker from '@/components/HebrewDatePicker';
import ModernEmployeeHistoryTab from '@/components/employees/ModernEmployeeHistoryTab';
import EmployeePermissionsPanel from '@/app/components/permissions/EmployeePermissionsPanel';
import { V3Page, Card, Btn, IconBtn, Field, Switch, Dialog, Empty, Icon } from '@/app/v3/ui/components';
import { v3Toast, v3NoticeSaved, enqueueNotice } from '@/app/v3/notify';

// טאבים (תצוגה בלבד): כמו <Tabs> של v3 אבל מאפשר לשמר data-agy-id / data-element-name לכל טאב
// (סוכן ה-AI והאוטומציה נשענים עליהם). ניווט חצים לפי כיוון הדף - זהה ל-Tabs.
function AgyTabs({ items, value, onChange, label, className }) {
  const ref = useRef(null);
  const onKey = (e) => {
    const rtl = getComputedStyle(ref.current).direction === 'rtl';
    const dir = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1 }[e.key];
    const home = e.key === 'Home', end = e.key === 'End';
    if (!dir && !home && !end) return;
    e.preventDefault();
    const idx = items.findIndex((t) => t.key === value);
    const n = home ? 0 : end ? items.length - 1 : (idx + dir + items.length) % items.length;
    onChange(items[n].key);
    ref.current.querySelectorAll('[role="tab"]')[n]?.focus();
  };
  return (
    <div ref={ref} role="tablist" aria-label={label} className={`v3-tabs${className ? ` ${className}` : ''}`} onKeyDown={onKey}>
      {items.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={t.key === value} tabIndex={t.key === value ? 0 : -1}
          className="v3-tab" onClick={() => onChange(t.key)} {...t.attrs}>
          <Icon name={t.icon} />{t.label}
        </button>
      ))}
    </div>
  );
}

export default function EmployeePage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details'); // details, attendance, history
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

  // רשימת המחלקות האמיתית (טבלת Department) עבור בורר המחלקה - null = עדיין נטען
  const [departments, setDepartments] = useState(null);
  const [deptLoadFailed, setDeptLoadFailed] = useState(false);
  // show_employee_profile_image (הגדרות > תצוגה) - לפי בקשת ההנהלה (דיווח c764bef4)
  // הוסרה תמונת הפרופיל לגמרי; ברירת מחדל true כשהשורה עוד לא נוצרה ב-DB.
  const [showProfileImage, setShowProfileImage] = useState(true);

  // חלונית אישור v3 שמחליפה את window.customConfirm בדף הזה - אותה זרימת await (true/false).
  const [confirmDlg, setConfirmDlg] = useState(null);
  const askConfirm = (opts) => new Promise((resolve) => setConfirmDlg({ ...opts, resolve }));
  const settleConfirm = (val) => {
    const d = confirmDlg;
    setConfirmDlg(null);
    if (d) d.resolve(val);
  };

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
        try {
          v3NoticeSaved({ title: 'העובד נוצר', text: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() });
        } catch (_) { /* ההתראה אינה חובה */ }
        router.push(`/employees/${data.id}`);
      } else {
        setPermissionsRefresh((n) => n + 1); // a changed department changes the department defaults shown below
        try {
          enqueueNotice({ kind: 'success', title: 'הפרטים נשמרו', persistToBell: false });
        } catch (_) { /* ההתראה אינה חובה */ }
      }
    } catch (e) {
      v3Toast('לא הצלחנו לשמור את הפרטים.', 'error');
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
        v3Toast('בחרו תאריך למשמרת.', 'warn');
        return;
      }
      const [dY, dM] = editShiftData.date.split('-').map(Number);
      if ((dM - 1) !== filterMonth || dY !== filterYear) {
        const displayedLabel = new Date(filterYear, filterMonth).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
        v3Toast({ kind: 'warn', durationMs: 9000, title: `התאריך שנבחר אינו בחודש המוצג (${displayedLabel}). בחרו תאריך בתוך החודש, או עברו קודם לחודש הרצוי.` });
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
        v3Toast(data.error || 'לא הצלחנו לשמור את המשמרת.', 'error');
      }
    } catch (e) {
      v3Toast('אין תקשורת עם השרת, נסו שוב.', 'error');
    }
  };

  const deleteShift = async (shiftId) => {
    if (!await askConfirm({ icon: 'trash', title: 'למחוק את המשמרת?', sub: 'השורה תוסתר מהרשימה, וההיסטוריה שלה תישמר במערכת.', okLabel: 'מחיקה' })) return;
    try {
      const res = await fetch(`/api/employees/${id}/shifts/${shiftId}`, { method: 'DELETE' });
      if (res.ok) fetchEmployee();
      else v3Toast('לא הצלחנו למחוק את המשמרת.', 'error');
    } catch (e) {
      v3Toast('אין תקשורת עם השרת, נסו שוב.', 'error');
    }
  };

  const restoreShift = async (shift) => {
    if (!await askConfirm({ icon: 'refresh', title: 'לשחזר את המשמרת?', okLabel: 'שחזור' })) return;
    try {
      const res = await fetch(`/api/employees/${id}/shifts/${shift.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeleted: false })
      });
      const data = await res.json();
      if (res.ok) fetchEmployee();
      else v3Toast(data.error || 'לא הצלחנו לשחזר את המשמרת.', 'error');
    } catch (e) {
      v3Toast('אין תקשורת עם השרת, נסו שוב.', 'error');
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

  if (loading) return (
    <V3Page>
      <div className="v3-empty" role="status">
        <Icon name="loader" size="xl" loop />
        <span>טוענים את הכרטיס...</span>
      </div>
    </V3Page>
  );
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

  // משמרת "לא שלמה" - יש בה תאריך אבל חסרה כניסה או יציאה (לא שתיהן) - מודגשת
  const isIncompleteShift = (shift) => !!shift.entryTime !== !!shift.exitTime;

  const initials = `${(employee.firstName || '').charAt(0)}${(employee.lastName || '').charAt(0)}`;

  // מתג הפעלה/כיבוי -> אותו handleChange כמו תיבת סימון רגילה (אותו אובייקט target)
  const setFlag = (name) => (checked) => handleChange({ target: { name, value: checked, type: 'checkbox', checked } });

  const monthLabel = new Date(filterYear, filterMonth).toLocaleString('he-IL', { month: 'long', year: 'numeric' });

  return (
    <V3Page>
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
            border: none !important;
          }
          .print-area .v3-table__wrap { border: none !important; }
          .print-area .v3-table th { background: #fff !important; }
          .no-print { display: none !important; }
          .bsd-header { display: block !important; text-align: center; font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem; }
          ::-webkit-scrollbar { display: none; }
          .print-area thead { display: table-header-group; }
          .print-area tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}} />

      <div className="v3-stack">
        <header className="v3-pagehead no-print">
          <div className="v3-pagehead__title">
            <IconBtn data-agy-id="back-button" data-element-name="כפתור_page_1" icon="arrow-end" label="חזרה" title="חזרה" onClick={() => router.back()} />
            <h1 className="v3-h1">
              {id === 'new' ? 'עובד חדש' : <><small>כרטיס עובד</small>{employee.firstName} {employee.lastName}</>}
            </h1>
          </div>
        </header>

        {id !== 'new' && (
          <AgyTabs
            className="no-print"
            label="חלקי הכרטיס"
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'details', label: 'פרטים', icon: 'id', attrs: { 'data-agy-id': 'tab-employee-details', 'data-element-name': 'כפתור_page_2' } },
              { key: 'attendance', label: 'שעות ושכר', icon: 'clock', attrs: { 'data-agy-id': 'tab-employee-attendance', 'data-element-name': 'כפתור_page_3' } },
              { key: 'history', label: 'היסטוריה', icon: 'history', attrs: { 'data-agy-id': 'tab-employee-history', 'data-element-name': 'כפתור_page_4' } },
            ]}
          />
        )}

        {activeTab === 'details' && (
          <form data-agy-id="employee-form" className="v3-stack no-print" onSubmit={handleSave}>
            <Card icon="id" title="פרטי העובד">
              <div className="v3-stack">
                <Field data-element-name="שדה_page_6" label="שם פרטי" required type="text" id="employee-detail-firstName" name="firstName" value={employee.firstName || ''} onChange={handleChange} />
                <Field data-element-name="שדה_page_7" label="שם משפחה" required type="text" id="employee-detail-lastName" name="lastName" value={employee.lastName || ''} onChange={handleChange} />
                <Field data-element-name="שדה_page_8" label="שם לתצוגה" tip="השם המלא כפי שיוצג במערכת." type="text" id="employee-detail-fullName" name="fullName" value={employee.fullName || ''} onChange={handleChange} />
                <Field data-element-name="שדה_page_9" label="תאריך הצטרפות" type="date" id="employee-detail-joinDate" name="joinDate" value={employee.joinDate ? new Date(employee.joinDate).toISOString().split('T')[0] : ''} onChange={handleChange} />

                {deptLoadFailed ? (
                  <Field
                    data-element-name="שדה_page_29"
                    label="מחלקה"
                    error="לא הצלחנו לטעון את רשימת המחלקות. אפשר להקליד מספר מחלקה ידנית."
                    type="number" id="employee-detail-roleId" name="roleId" value={employee.roleId ?? ''} onChange={handleChange}
                  />
                ) : departments === null ? (
                  <Field as="select" data-element-name="שדה_page_29" label="מחלקה" id="employee-detail-roleId" name="roleId" value="" disabled>
                    {[<option key="loading" value="">טוענים מחלקות...</option>]}
                  </Field>
                ) : (
                  <Field as="select" data-element-name="שדה_page_29" label="מחלקה" tip="המחלקה קובעת את ברירות המחדל של ההרשאות." id="employee-detail-roleId" name="roleId" value={employee.roleId ?? ''} onChange={handleChange}>
                    <option value="">לא משויך למחלקה</option>
                    {departments.map(dept => (
                      <option key={dept.roleId} value={dept.roleId}>{dept.name} ({dept.roleId})</option>
                    ))}
                    {/* ערך קיים שאינו ברשימה (נתון ישן/שגוי) - מוצג כאופציה כדי שלא יימחק בשקט בשמירה */}
                    {employee.roleId !== null && employee.roleId !== '' && employee.roleId !== undefined &&
                      !departments.some(d => String(d.roleId) === String(employee.roleId)) && (
                      <option value={employee.roleId}>מחלקה שאינה ברשימה ({employee.roleId})</option>
                    )}
                  </Field>
                )}

                <Field as="textarea" data-element-name="טקסט_page_33" label="הערות" id="employee-detail-notes" name="notes" value={employee.notes || ''} onChange={handleChange} />
              </div>
            </Card>

            <Card icon="phone" title="יצירת קשר וכתובת">
              <div className="v3-stack">
                <Field data-element-name="שדה_page_10" label="טלפון נייד" required type="text" id="employee-detail-phone1" name="phone1" value={employee.phone1 || ''} onChange={handleChange} />
                <Field data-element-name="שדה_page_11" label="טלפון נוסף" type="text" id="employee-detail-phone2" name="phone2" value={employee.phone2 || ''} onChange={handleChange} />
                <Field label="דוא״ל" id="employee-detail-email">
                  <input data-element-name="שדה_page_12" type="email" name="email" value={employee.email || ''} onChange={handleChange} />
                </Field>
                  <div className="v3-cluster">
                    {employee.email && (
                      <>
                        <Btn data-element-name="כפתור_page_13" icon="link" onClick={() => navigator.clipboard.writeText(employee.email)}>העתקת הכתובת</Btn>
                        <Btn data-element-name="כפתור_page_15" icon="mail" onClick={() => setEmailModalOpen(true)}>שליחת מייל</Btn>
                      </>
                    )}
                    {(!employee.email || !employee.email.includes('@')) && (
                      <Btn
                        data-element-name="כפתור_page_17"
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          const currentEmail = employee.email || '';
                          setEmployee(prev => ({ ...prev, email: currentEmail + '@gmail.com' }));
                        }}
                      >
                        השלמה ל-<bdi>@gmail.com</bdi>
                      </Btn>
                    )}
                  </div>
                <Field data-element-name="שדה_page_18" label="עיר" type="text" id="employee-detail-city" name="city" value={employee.city || ''} onChange={handleChange} />
                <Field data-element-name="שדה_page_19" label="רחוב" type="text" id="employee-detail-street" name="street" value={employee.street || ''} onChange={handleChange} />
                <Field data-element-name="שדה_page_20" label="מספר בית" type="text" id="employee-detail-houseNum" name="houseNum" value={employee.houseNum || ''} onChange={handleChange} />
              </div>
            </Card>

            <Card icon="lock" title="סיסמה לשעון הנוכחות" tip="מטעמי אבטחה אי אפשר לראות סיסמה קיימת. אפשר לשנות אותה (עם הסיסמה הנוכחית), לאפס ולשלוח סיסמה זמנית למייל, או שמנהל יקבע סיסמה חדשה ישירות.">
              {id === 'new' ? (
                <Field data-element-name="שדה_page_21" label="סיסמה" type="text" name="password" value={employee.password || ''} onChange={handleChange} />
              ) : (
                <div className="v3-stack">
                  <Field label="סיסמה נוכחית" id="employee-detail-pwDisplay">
                    <input data-element-name="שדה_page_22" type="password" value="********" disabled />
                  </Field>
                  <div className="v3-cluster">
                    <Btn data-element-name="כפתור_page_24" variant="primary" icon="edit" onClick={() => setShowChangePassword(true)}>שינוי סיסמה</Btn>
                    <Btn data-element-name="כפתור_page_23" icon="refresh" onClick={async () => {
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
                          v3Toast(data.message || 'נשלחה סיסמה זמנית למייל של העובד.', 'success');
                        } else {
                          v3Toast(data.message || 'לא הצלחנו לאפס את הסיסמה.', 'error');
                        }
                      } catch (e) {
                        v3Toast('איפוס הסיסמה נכשל, נסו שוב.', 'error');
                      }
                    }}>איפוס ושליחה למייל</Btn>
                    <Btn data-element-name="כפתור_page_23b" icon="lock" onClick={async () => {
                      const authResult = await window.customAuthPrompt("הזן קוד מנהל לקביעת סיסמה ישירות לעובד:", "מנהל");
                      if (!authResult) return;
                      setSetPasswordAuth(authResult);
                      setShowSetPassword(true);
                    }}>קביעת סיסמה ידנית</Btn>
                  </div>

                  {showChangePassword && (
                    <Card variant="info" icon="edit" title="שינוי סיסמה" level={3}>
                      <div className="v3-stack">
                        <Field label="סיסמה ישנה" id="employee-detail-oldPassword">
                          <input data-element-name="שדה_page_25" type="password" value={oldPasswordInput} onChange={e => setOldPasswordInput(e.target.value)} />
                        </Field>
                        <Field label="סיסמה חדשה" id="employee-detail-newPassword">
                          <input data-element-name="שדה_page_26" type="password" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} />
                        </Field>
                        <div className="v3-cluster">
                          <Btn data-element-name="כפתור_page_28" variant="primary" onClick={async () => {
                            if (!newPasswordInput) {
                                v3Toast('הזינו סיסמה חדשה.', 'warn');
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
                                v3Toast('הסיסמה עודכנה.', 'success');
                              } else {
                                v3Toast(data.message || 'לא הצלחנו לשנות את הסיסמה.', 'error');
                              }
                            } catch (e) {
                              v3Toast('שינוי הסיסמה נכשל, נסו שוב.', 'error');
                            }
                          }}>אישור השינוי</Btn>
                          <Btn data-element-name="כפתור_page_27" variant="quiet" onClick={() => { setShowChangePassword(false); setOldPasswordInput(''); setNewPasswordInput(''); }}>ביטול</Btn>
                        </div>
                      </div>
                    </Card>
                  )}

                  {showSetPassword && (
                    <Card variant="info" icon="lock" title="סיסמה חדשה לעובד" level={3}>
                      <div className="v3-stack">
                        <Field label="הסיסמה החדשה" hint="לפחות 4 תווים." id="employee-detail-setPassword">
                          <input data-element-name="שדה_page_26b" type="password" value={setPasswordInput} onChange={e => setSetPasswordInput(e.target.value)} />
                        </Field>
                        <div className="v3-cluster">
                          <Btn data-element-name="כפתור_page_28b" variant="primary" onClick={async () => {
                            if (!setPasswordInput || setPasswordInput.length < 4) {
                              v3Toast('הסיסמה צריכה להיות באורך 4 תווים לפחות.', 'warn');
                              return;
                            }
                            try {
                              const res = await fetch(`/api/employees/${id}/set-password`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ authPin: setPasswordAuth?.pin, authEmployeeId: setPasswordAuth?.employeeId, newPassword: setPasswordInput })
                              });
                              const data = await res.json();
                              if (data.success) {
                                setShowSetPassword(false);
                                setSetPasswordInput('');
                                setSetPasswordAuth(null);
                                v3Toast(data.message || 'הסיסמה נקבעה.', 'success');
                              } else {
                                v3Toast(data.message || 'לא הצלחנו לקבוע את הסיסמה.', 'error');
                              }
                            } catch (e) {
                              v3Toast('קביעת הסיסמה נכשלה, נסו שוב.', 'error');
                            }
                          }}>אישור</Btn>
                          <Btn data-element-name="כפתור_page_27b" variant="quiet" onClick={() => { setShowSetPassword(false); setSetPasswordInput(''); setSetPasswordAuth(null); }}>ביטול</Btn>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </Card>

            {/* show_employee_profile_image (הגדרות > תצוגה) - כשהוא כבוי הקטע הזה לא מוצג בכלל. */}
            {showProfileImage && (
              <Card icon="image" title="תמונה או מסמך" tip="אפשר להעלות תמונה או קובץ PDF.">
                <div className="v3-stack">
                  {employee.profileImage && employee.profileImage.startsWith('data:image') ? (
                    <img src={employee.profileImage} alt="תמונת העובד" style={{ width: 'var(--v3-sp-9)', height: 'var(--v3-sp-9)', objectFit: 'cover', borderRadius: 'var(--v3-r-round)' }} />
                  ) : (
                    <span className="v3-avatar" aria-hidden="true" style={{ width: 'var(--v3-sp-9)', height: 'var(--v3-sp-9)', fontSize: 'var(--v3-fs-xl)' }}>{initials}</span>
                  )}
                  <div className="v3-cluster">
                    <label className="v3-btn" htmlFor="employee-detail-profileImage">
                      <Icon name="upload" />
                      <span>בחירת קובץ</span>
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
                      <Btn data-element-name="כפתור_page_32" variant="danger" size="sm" icon="trash" title="הסרת הקובץ" onClick={() => setEmployee(prev => ({ ...prev, profileImage: '' }))}>הסרה</Btn>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <Card icon="coin" title="שכר והגדרות">
              <div className="v3-stack">
                <Field data-element-name="שדה_page_34" label="שכר לשעה (₪)" type="number" step="0.01" id="employee-detail-hourlyWage" name="hourlyWage" value={employee.hourlyWage || ''} onChange={handleChange} />
                <Field data-element-name="שדה_page_35" label="אופן התשלום" type="text" id="employee-detail-paymentMethod" name="paymentMethod" value={employee.paymentMethod || ''} onChange={handleChange} />
                <Switch data-element-name="שדה_page_36" id="employee-detail-travelExpenses" name="travelExpenses" label="זכאי להחזר נסיעות" checked={employee.travelExpenses || false} onChange={setFlag('travelExpenses')} />
                <Switch data-element-name="שדה_page_37" id="employee-detail-isActive" name="isActive" label="עובד פעיל" checked={employee.isActive} onChange={setFlag('isActive')} />
                <Switch data-element-name="שדה_page_38" id="employee-detail-receiveEmailAlerts" name="receiveEmailAlerts" label="קבלת התראות מערכת במייל" checked={employee.receiveEmailAlerts || false} onChange={setFlag('receiveEmailAlerts')} />
              </div>
            </Card>

            {id !== 'new' && (
              <Card icon="shield" title="הרשאות אישיות" tip="ההרשאות נקבעות לפי המחלקה, ואפשר להוסיף כאן חריגות לעובד הזה. שינויים נשמרים מיד ונראים גם במסך ההרשאות.">
                <div className="v3-stack">
                  <p className="v3-muted">לכל המחלקות: <a className="v3-link" href="/admin/permissions">מסך ההרשאות</a></p>
                  <EmployeePermissionsPanel key={permissionsRefresh} employeeId={id} />
                </div>
              </Card>
            )}

            <div className="v3-cluster">
              <Btn data-agy-id="save-employee-button" data-element-name="כפתור_page_40" type="submit" variant="primary" size="lg" icon="check" loading={saving}>
                {saving ? 'שומרים...' : 'שמירה'}
              </Btn>
            </div>
          </form>
        )}

        {activeTab === 'attendance' && (
          <Card className="print-area" icon="clock" title={`שעות עבודה: ${employee.firstName} ${employee.lastName}`}>
            <div className="v3-stack">
              <div className="bsd-header" style={{ display: 'none' }}>בס&quot;ד</div>
              <div className="v3-cluster no-print">
                <Switch data-element-name="שדה_page_41" id="employee-detail-showDeletedShifts" label="הצגת משמרות שנמחקו" checked={showDeletedShifts} onChange={(v) => setShowDeletedShifts(v)} />
              </div>
              <div className="v3-cluster no-print">
                <select data-element-name="בחירה_page_42" className="v3-input" style={{ width: 'auto' }} aria-label="חודש"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(parseInt(e.target.value, 10))}
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i} value={i}>{new Date(2000, i).toLocaleString('he-IL', { month: 'long' })}</option>
                  ))}
                </select>
                <select data-element-name="בחירה_page_43" className="v3-input" style={{ width: 'auto' }} aria-label="שנה"
                  value={filterYear}
                  onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <Btn data-element-name="כפתור_page_44" icon="printer" onClick={() => window.print()}>הדפסה / PDF</Btn>
                <Btn data-element-name="כפתור_page_45" variant="primary" icon="plus" onClick={startAddShift} disabled={isAddingShift || editingShiftId !== null}>הוספת משמרת</Btn>
              </div>

              <div className="v3-table__wrap">
                <table className="v3-table">
                  <thead>
                    {/* שורה נוספת ב-thead (לא רק כותרות העמודות) - כדי שהחודש/שנה יופיעו מחדש
                        בראש כל עמוד פיזי כשהטבלה נשברת לכמה עמודי הדפסה, בדיוק כמו שורת כותרות
                        העמודות עצמה שחוזרת בזכות table-header-group. */}
                    <tr>
                      <th colSpan={8} style={{ textAlign: 'center' }}>
                        תקופה: {monthLabel}
                      </th>
                    </tr>
                    <tr>
                      <th scope="col">תאריך</th>
                      <th scope="col">תאריך עברי</th>
                      <th scope="col">כניסה</th>
                      <th scope="col">יציאה</th>
                      <th scope="col">דקות</th>
                      <th scope="col">לתשלום (₪)</th>
                      <th scope="col">הערות</th>
                      <th className="no-print" scope="col"><span className="v3-sr">פעולות</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {isAddingShift && (
                      <tr style={{ background: 'var(--v3-pending-bg)' }}>
                        <td colSpan="2">
                          <div style={{ position: 'relative', width: '250px' }}>
                            <HebrewDatePicker data-element-name="רכיב_page_46"
                              selectedDate={editShiftData.date}
                              onChange={handleHebrewDateChange}
                            />
                          </div>
                        </td>
                        <td>
                          <input data-element-name="שדה_page_47" className="v3-input" aria-label="שעת כניסה" type="time" name="entryTime" value={editShiftData.entryTime || ''} onChange={handleShiftEditChange} />
                        </td>
                        <td>
                          <input data-element-name="שדה_page_48" className="v3-input" aria-label="שעת יציאה" type="time" name="exitTime" value={editShiftData.exitTime || ''} onChange={handleShiftEditChange} />
                        </td>
                        <td>
                          <input data-element-name="שדה_page_49" className="v3-input" aria-label="דקות" type="number" disabled placeholder="יחושב אוטומטית" />
                        </td>
                        <td>
                          <input data-element-name="שדה_page_50" className="v3-input" aria-label="לתשלום" type="number" disabled placeholder="יחושב אוטומטית" />
                        </td>
                        <td>
                          <input data-element-name="שדה_page_51" className="v3-input" aria-label="הערות" type="text" name="notes" value={editShiftData.notes || ''} onChange={handleShiftEditChange} />
                        </td>
                        <td className="no-print">
                          <div className="v3-cluster">
                            <Btn data-element-name="כפתור_page_52" variant="primary" size="sm" onClick={saveShift}>שמירה</Btn>
                            <Btn data-element-name="כפתור_page_53" variant="quiet" size="sm" onClick={cancelEditShift}>ביטול</Btn>
                          </div>
                        </td>
                      </tr>
                    )}

                    {filteredShifts.map(shift => (
                      <tr key={shift.id} style={{
                        opacity: shift.isDeleted ? 0.6 : 1,
                        textDecoration: shift.isDeleted ? 'line-through' : 'none',
                        background: (!shift.isDeleted && isIncompleteShift(shift)) ? 'var(--v3-charge-bg)' : undefined
                      }}>
                        {editingShiftId === shift.id ? (
                          <>
                            <td>
                               <input data-element-name="שדה_page_54" className="v3-input" aria-label="תאריך" type="date" value={editShiftData.date || ''} disabled />
                            </td>
                            <td>
                               <input data-element-name="שדה_page_55" className="v3-input" aria-label="תאריך עברי" type="text" value={shift.hebrewDate || ''} disabled />
                            </td>
                            <td>
                              <input data-element-name="שדה_page_56" className="v3-input" aria-label="שעת כניסה" type="time" name="entryTime" value={editShiftData.entryTime || ''} onChange={handleShiftEditChange} />
                            </td>
                            <td>
                              <input data-element-name="שדה_page_57" className="v3-input" aria-label="שעת יציאה" type="time" name="exitTime" value={editShiftData.exitTime || ''} onChange={handleShiftEditChange} />
                            </td>
                            <td>
                              <input data-element-name="שדה_page_58" className="v3-input" aria-label="דקות" type="number" value={shift.totalMinutes || ''} disabled />
                            </td>
                            <td>
                              <input data-element-name="שדה_page_59" className="v3-input" aria-label="לתשלום" type="number" value={shift.totalCalculated || ''} disabled />
                            </td>
                            <td>
                              <input data-element-name="שדה_page_60" className="v3-input" aria-label="הערות" type="text" value={shift.notes || ''} disabled />
                            </td>
                            <td className="no-print">
                              <div className="v3-cluster">
                                <Btn data-element-name="כפתור_page_61" variant="primary" size="sm" onClick={saveShift}>שמירה</Btn>
                                <Btn data-element-name="כפתור_page_62" variant="quiet" size="sm" onClick={cancelEditShift}>ביטול</Btn>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td><b><bdi>{new Date(shift.date).toLocaleDateString('he-IL')}</bdi></b></td>
                            <td>{shift.hebrewDate || '-'}</td>
                            <td>{shift.entryTime ? <bdi>{new Date(shift.entryTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</bdi> : '-'}</td>
                            <td>{shift.exitTime ? <bdi>{new Date(shift.exitTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</bdi> : '-'}</td>
                            <td>{shift.totalMinutes ? <bdi>{shift.totalMinutes}</bdi> : '-'}</td>
                            <td>{shift.totalCalculated ? <b>₪<bdi>{shift.totalCalculated}</bdi></b> : '-'}</td>
                            <td className="v3-muted">{shift.notes || '-'}</td>
                            <td className="no-print">
                              <div className="v3-cluster">
                                {!shift.isDeleted ? (
                                  <>
                                    <IconBtn data-element-name="כפתור_page_63" size="sm" variant="quiet" icon="edit" label="עריכת כניסה ויציאה" title="עריכת כניסה ויציאה" onClick={() => startEditShift(shift)} />
                                    <IconBtn data-element-name="כפתור_page_64" size="sm" variant="quiet" icon="trash" label="מחיקת המשמרת" title="מחיקת המשמרת" onClick={() => deleteShift(shift.id)} />
                                  </>
                                ) : (
                                  <IconBtn data-element-name="כפתור_page_65" size="sm" variant="quiet" icon="refresh" label="שחזור המשמרת" title="שחזור המשמרת" onClick={() => restoreShift(shift)} />
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {filteredShifts.length === 0 && !isAddingShift && (
                      <tr>
                        <td colSpan="8">
                          <Empty icon="calendar" text="אין משמרות בחודש הזה." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <Card variant="info" icon="coin" title="סיכום שכר לחודש" level={3}>
                <div className="v3-stack">
                  <span className="v3-faint">{monthLabel}</span>
                  <b className="v3-display">₪<bdi>{calculateMonthlySalary()}</bdi></b>
                </div>
              </Card>
            </div>
          </Card>
        )}

        {activeTab === 'history' && (
          <div className="no-print">
            <ModernEmployeeHistoryTab employeeId={id} />
          </div>
        )}
      </div>

      {id !== 'new' && (
        <SendEmailModal data-element-name="רכיב_page_68"
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          defaultTo={employee.email}
          employeeId={id}
        />
      )}

      <Dialog
        open={!!confirmDlg}
        onClose={() => settleConfirm(false)}
        variant="confirm"
        mode="dark"
        icon={confirmDlg?.icon}
        title={confirmDlg?.title}
        sub={confirmDlg?.sub}
        actions={(
          <>
            <Btn variant="primary" data-autofocus="" onClick={() => settleConfirm(true)}>{confirmDlg?.okLabel || 'אישור'}</Btn>
            <Btn variant="on-dark" onClick={() => settleConfirm(false)}>ביטול</Btn>
          </>
        )}
      />
    </V3Page>
  );
}
