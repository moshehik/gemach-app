// lib/employeeCardA5.js - הלוגיקה הטהורה של כרטיס העובד החדש (app/components/employee-card/*), בלי React / רשת / DB.
// ESM טהור (נבדק ב-scripts/test_employee_card_a5.mjs). כל פונקציה כאן משחזרת את מה שהכרטיס הישן
// (app/employees/[id]/LegacyEmployeeCardPage.js) בונה בתוך הרכיב, כדי שמטענים (payloads) מול ה-API יישארו זהים:
//   employeeSaveRequest  <- handleSave        (POST /api/employees | PUT /api/employees/<id>)
//   buildShiftPayload    <- saveShift         (POST /api/employees/<id>/shifts | PUT .../shifts/<shiftId>)
//   shiftMonthError      <- בדיקות saveShift  (תאריך חסר / מחוץ לחודש המוצג)
//   passwordChangeBody   <- "אשר שינוי"       (POST /api/employees/<id>/password)
//   filterShifts / monthlySalary / isIncompleteShift / startEditData / startAddData <- אותו שם בכרטיס הישן
// החלטות הבעלים שמשנות את המטען (scratch/empcard-build/DECISIONS.md): EC-05 - אין emailSuffix (לא נשלח; ב-PUT undefined = לא נוגעים בערך
// השמור), תמונת פרופיל - תמונה בלבד.

// שדות ריקים לעובד חדש (כמו fetchEmployee ב-id==='new', בלי emailSuffix - EC-05)
export function blankEmployee() {
  return {
    firstName: '', lastName: '', fullName: '', phone1: '', phone2: '',
    email: '', city: '', street: '', houseNum: '',
    joinDate: '', password: '', roleId: '', hourlyWage: '',
    travelExpenses: false, paymentMethod: '', notes: '',
    profileImage: '',
    isActive: true, receiveEmailAlerts: false, shifts: [],
  };
}

// הגוף שנשלח בשמירת פרטים: כל אובייקט העובד כמו שהוא (כמו JSON.stringify(employee) בישן), בלי emailSuffix (EC-05).
export function employeeBody(employee) {
  const { emailSuffix, ...rest } = employee || {};
  return JSON.stringify(rest);
}

export function employeeSaveRequest(id, employee) {
  const isNew = id === 'new';
  return {
    url: isNew ? '/api/employees' : `/api/employees/${id}`,
    method: isNew ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: employeeBody(employee),
  };
}

// ערך תאריך הכניסה לשדה type=date (YYYY-MM-DD) - כמו selectedDate בישן
export function joinDateValue(joinDate) {
  if (!joinDate) return '';
  const d = new Date(joinDate);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

export function initialsOf(employee) {
  return `${((employee && employee.firstName) || '').charAt(0)}${((employee && employee.lastName) || '').charAt(0)}`;
}

// "השלם ל- @gmail.com" מופיע כשהמייל ריק או בלי @ (כמו בישן)
export function needsGmailFill(email) {
  return !email || !String(email).includes('@');
}
export function withGmail(email) {
  return (email || '') + '@gmail.com';
}

// --- משמרות ---------------------------------------------------------------------------------

const timeHm = (iso) => (iso ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');

export function startEditData(shift) {
  return {
    date: shift.date ? shift.date.split('T')[0] : '',
    hebrewDate: shift.hebrewDate || '',
    entryTime: timeHm(shift.entryTime),
    exitTime: timeHm(shift.exitTime),
    totalMinutes: shift.totalMinutes || '',
    totalCalculated: shift.totalCalculated || '',
    notes: shift.notes || '',
    isDeleted: shift.isDeleted || false,
  };
}

// "אחד בחודש המוצג" כמחרוזת ישירה (לא דרך toISOString - הערה זהה בישן: UTC מזיז ל-31 בחודש הקודם)
export function startAddData(filterMonth, filterYear) {
  return {
    date: `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}-01`,
    hebrewDate: '',
    entryTime: '',
    exitTime: '',
    totalMinutes: '',
    totalCalculated: '',
    notes: '',
    isDeleted: false,
  };
}

// null = תקין, אחרת הודעת השגיאה (אותן הודעות כמו saveShift בישן)
export function shiftMonthError({ isAdding, date, filterMonth, filterYear }) {
  if (!isAdding) return null;
  if (!date) return 'יש לבחור תאריך למשמרת';
  const [dY, dM] = date.split('-').map(Number);
  if ((dM - 1) !== filterMonth || dY !== filterYear) {
    const displayedLabel = new Date(filterYear, filterMonth).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    return `לא ניתן להוסיף משמרת בתאריך שאינו בחודש המוצג (${displayedLabel}). יש לבחור תאריך בתוך החודש המוצג, או לעבור לחודש הרצוי ואז להוסיף את המשמרת.`;
  }
  return null;
}

export function shiftRequest(employeeId, isAdding, editingShiftId) {
  return {
    url: isAdding ? `/api/employees/${employeeId}/shifts` : `/api/employees/${employeeId}/shifts/${editingShiftId}`,
    method: isAdding ? 'POST' : 'PUT',
  };
}

// הגוף של שמירת משמרת - אותו חישוב כמו saveShift בישן (דקות ותשלום מחושבים בשרת; יציאה מוקדמת מהכניסה = יום הבא)
export function buildShiftPayload({ editShiftData, isAdding, filterMonth, filterYear }) {
  const payload = { ...editShiftData };
  delete payload.totalMinutes;
  delete payload.totalCalculated;
  if (isAdding) {
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
  return payload;
}

// מיון כרונולוגי מהישן לחדש, בחודש / שנה המוצגים (כמו filteredShifts בישן)
export function filterShifts(shifts, { showDeleted, filterMonth, filterYear }) {
  return ((shifts || []).filter((shift) => {
    const d = new Date(shift.date);
    if (!showDeleted && shift.isDeleted) return false;
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  })).sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) return dateDiff;
    return new Date(a.entryTime || a.date) - new Date(b.entryTime || b.date);
  });
}

// משמרת "לא שלמה" - כניסה בלי יציאה או להפך
export const isIncompleteShift = (shift) => !!shift.entryTime !== !!shift.exitTime;

// סיכום שכר לחודש - מחרוזת toFixed(2), כמו calculateMonthlySalary בישן (גם 0 כמספר כשאין משמרות)
export function monthlySalary(shifts, filterMonth, filterYear) {
  if (!shifts) return 0;
  let total = 0;
  shifts.forEach((shift) => {
    const shiftDate = new Date(shift.date);
    if (!shift.isDeleted && shiftDate.getMonth() === filterMonth && shiftDate.getFullYear() === filterYear && shift.totalCalculated) {
      total += shift.totalCalculated;
    }
  });
  return total.toFixed(2);
}

export const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i).toLocaleString('he-IL', { month: 'long' }));
export const YEARS = [2024, 2025, 2026, 2027];
export const monthLabel = (y, m) => new Date(y, m).toLocaleString('he-IL', { month: 'long', year: 'numeric' });

// --- סיסמה ----------------------------------------------------------------------------------

// הגוף של POST /api/employees/<id>/password: בכרטיס של עצמי - הסיסמה הישנה; בכרטיס של עובד אחר - סיסמת המנהל עצמו
export function passwordChangeBody({ isOwnCard, oldPassword, managerPassword, newPassword }) {
  return isOwnCard
    ? { oldPassword, newPassword }
    : { managerPassword, newPassword };
}

// null = תקין, אחרת הודעה (אותן בדיקות לקוח כמו בישן)
export function passwordChangeError({ newPassword, sessionEmployeeId }) {
  if (!newPassword) return 'יש להזין סיסמא חדשה';
  if (sessionEmployeeId === null || sessionEmployeeId === undefined) return 'לא ניתן לזהות את המשתמש המחובר - רענן את הדף ונסה שוב';
  return null;
}
export function setPasswordError(password) {
  return !password || password.length < 4 ? 'הסיסמה חייבת להכיל לפחות 4 תווים' : null;
}

// --- מחלקה (EC-05: בלי שדה מספר חלופי) -------------------------------------------------------

// אופציות הבורר: "ללא מחלקה" + כל מחלקה "שם (מספר)" + ערך קיים שאינו ברשימה (כדי שלא יימחק בשקט בשמירה)
export function departmentOptions(departments, roleId) {
  const opts = [['', 'ללא מחלקה']].concat((departments || []).map((d) => [String(d.roleId), `${d.name} (${d.roleId})`]));
  const has = roleId !== null && roleId !== '' && roleId !== undefined;
  if (has && !(departments || []).some((d) => String(d.roleId) === String(roleId))) {
    opts.push([String(roleId), `מחלקה לא מוכרת (${roleId})`]);
  }
  return opts;
}

// --- מייל (EC-10: האישור בחלון נפרד) ---------------------------------------------------------

// הגוף של POST /api/send-email: אותם שדות כמו SendEmailModal הישן. username = מזהה המנהל שנבחר, password = הקוד שלו.
export function buildSendEmailBody({ form, files, sendMode, driveFolderId, employeeId, approval }) {
  const attachments = files.map((f) => ({
    fileName: f.fileName, fileContent: f.fileContent, mimeType: f.mimeType || 'application/octet-stream', sizeBytes: f.sizeBytes || null, dest: sendMode,
  }));
  const first = files[0];
  return {
    to: form.to, cc: form.cc, subject: form.subject, body: form.body,
    username: approval.employeeId, password: approval.pin,
    emailBody: form.body,
    fileName: first ? first.fileName : '',
    fileContent: first ? first.fileContent : '',
    attachments,
    sendMode,
    driveFolderId,
    customerId: undefined,
    employeeId,
  };
}

export const SEND_MODES = [['email', 'צרופה למייל', 'clip'], ['drive', 'העלאה לדרייב + שיתוף', 'ext'], ['both', 'גם וגם', 'plus']];
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(2)} MB` : b > 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);

// --- אישור מנהל (לפי PopupProvider.showAuthPrompt) -------------------------------------------

// מי מופיע ברשימת המאשרים, לפי רמת ההרשאה הנדרשת - אותה הכרעה כמו בחלונית הישנה
export function filterApprovers(employees, requiredLevel) {
  let list = Array.isArray(employees) ? employees : [];
  if (requiredLevel === 'מנהל') list = list.filter((e) => e.roleId === 1 || e.roleId === 2);
  else if (requiredLevel === 'מתכנת') list = list.filter((e) => e.roleId === 2);
  else if (requiredLevel === 'הנהלה ראשית') list = list.filter((e) => e.roleId === 0 || e.roleId === 2);
  else if (requiredLevel === 'מנהל סניף ומעלה') list = list.filter((e) => e.roleId === 0 || e.roleId === 1 || e.roleId === 2);
  else if (requiredLevel === 'מאשר הזמנה ללא תשלום') list = list.filter((e) => e.canApproveWithoutPayment);
  else if (typeof requiredLevel === 'string' && requiredLevel.startsWith('feature:')) list = list.filter((e) => e.approvals && e.approvals[requiredLevel]);
  return list;
}

// הפרמטרים שה-API של איפוס / קביעת סיסמה מקבל מתוצאת חלון האישור ({pin, employeeId})
export function authBody(auth) {
  return { authPin: auth && auth.pin, authEmployeeId: auth && auth.employeeId };
}
