'use client';

// EcAttendance - לשונית "נוכחות וסיכום" של כרטיס העובד החדש (העיצוב המאושר: כרטיס "דוח נוכחות וסיכום", טבלת .rtbl, פאנל "הוסף משמרת"
// .addpanel, הלוח העברי .hc, כרטיס סיכום השכר .status.ok). אותה לוגיקה ואותם ה-API כמו הכרטיס הישן (lib/employeeCardA5.js משחזר את
// המטענים; POST /api/employees/<id>/shifts, PUT|DELETE .../shifts/<shiftId>). EC-07: טבלת המשמרות שומרת את שתי עמודות התאריך
// (לועזי + עברי) - "רק בנוכחות ובתאריכים צריך את שניהם". מחיקה / שחזור באישור בחלון כהה (בלי window.confirm). הדפסה = window.print()
// של אזור ההדפסה (כמו בישן, כולל "בס״ד").
import { useState } from 'react';
import { requestJson, describeFailure } from '@/lib/employeeCardSave';
import {
  MONTH_NAMES, YEARS, monthLabel, startEditData, startAddData, shiftMonthError, shiftRequest, buildShiftPayload,
  filterShifts, isIncompleteShift, monthlySalary,
} from '@/lib/employeeCardA5';
import { israelToday, israelDayKey, hDayYear, gregDots } from '@/lib/attendance/summary';
import { Combo, HebCalendar, hebFull } from '../attendance/parts';
import { Ic, NO_FILL, useEc } from './EcUi';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-');

export default function EcAttendance({ employee, employeeId, showDeleted, onShowDeleted, onReload }) {
  const ec = useEc();
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editShiftData, setEditShiftData] = useState({});
  const [isAddingShift, setIsAddingShift] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  const closeAdd = () => { setEditingShiftId(null); setIsAddingShift(false); setEditShiftData({}); setCalOpen(false); };
  const startEdit = (shift) => { setEditingShiftId(shift.id); setIsAddingShift(false); setCalOpen(false); setEditShiftData(startEditData(shift)); };
  const startAdd = () => { setIsAddingShift(true); setEditingShiftId('new'); setCalOpen(false); setEditShiftData(startAddData(filterMonth, filterYear)); };
  const onData = (e) => { const { name, value } = e.target; setEditShiftData((p) => ({ ...p, [name]: value })); };

  const saveShift = async () => {
    const err = shiftMonthError({ isAdding: isAddingShift, date: editShiftData.date, filterMonth, filterYear });
    if (err) { ec.say(err, 'error'); return; }
    const { url, method } = shiftRequest(employeeId, isAddingShift, editingShiftId);
    const payload = buildShiftPayload({ editShiftData, isAdding: isAddingShift, filterMonth, filterYear });
    const result = await requestJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (result.ok) { closeAdd(); onReload(); } else ec.say(describeFailure('שמירת המשמרת נכשלה', result), 'error');
  };

  const deleteShift = async (shiftId) => {
    if (!(await ec.confirm({ title: 'האם אתה בטוח שברצונך למחוק משמרת זו?', sub: 'ההיסטוריה תישמר במערכת אך השורה תוסתר.', icon: 'trash' }))) return;
    const result = await requestJson(`/api/employees/${employeeId}/shifts/${shiftId}`, { method: 'DELETE' });
    if (result.ok) onReload(); else ec.say(describeFailure('מחיקת המשמרת נכשלה', result), 'error');
  };

  const restoreShift = async (shift) => {
    if (!(await ec.confirm({ title: 'האם לשחזר משמרת זו?', icon: 'refresh' }))) return;
    const result = await requestJson(`/api/employees/${employeeId}/shifts/${shift.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isDeleted: false }) });
    if (result.ok) onReload(); else ec.say(describeFailure('שחזור המשמרת נכשל', result), 'error');
  };

  const shifts = filterShifts(employee.shifts, { showDeleted, filterMonth, filterYear });
  const lbl = monthLabel(filterYear, filterMonth);
  const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
  const today = israelToday().key;
  const addDate = editShiftData.date || '';
  const busy = isAddingShift || editingShiftId !== null;

  return (
    <>
      <section className="card dfields print-area" aria-labelledby="h-att">
        <div className="card-h"><div className="ico rose"><Ic id="clock" size="lg" /></div><h2 id="h-att">דוח נוכחות וסיכום - {fullName}</h2></div>
        <div className="bsd-header" style={{ display: 'none' }}>בס&quot;ד</div>
        <div className="ec-tool no-print">
          <div className="trow"><label className="sw"><input type="checkbox" id="showDel" checked={showDeleted} onChange={(e) => onShowDeleted(e.target.checked)} /><i /></label><label htmlFor="showDel" className="pf-pl">הצג מחוקות</label></div>
          <span className="sp" />
          <Combo id="month" label="חודש" className="sm" value={filterMonth} options={MONTH_NAMES.map((m, i) => [i, m])} onChange={(v) => { setFilterMonth(Number(v)); closeAdd(); }} />
          <Combo id="year" label="שנה" className="sm" value={filterYear} options={YEARS.map((y) => [y, String(y)])} onChange={(v) => { setFilterYear(Number(v)); closeAdd(); }} />
          <button type="button" className="btn" data-ec="print" onClick={() => window.print()}><Ic id="print" size="sm" />הדפס / ייצא PDF</button>
          <button type="button" className="btn primary" data-ec="add" disabled={busy} onClick={startAdd}><Ic id="plus" size="sm" />הוסף משמרת</button>
        </div>

        {isAddingShift ? (
          <section className="addpanel open dfields ec-add no-print" aria-label="הוסף משמרת">
            <h3>הוסף משמרת</h3>
            <div className="grid2">
              <div className="field">
                <span className="lbl">תאריך עברי</span>
                <button type="button" className="ec-dtb" id="ecDtb" data-ec="hc-toggle" aria-expanded={calOpen} aria-haspopup="dialog" onClick={() => setCalOpen((o) => !o)}>
                  <Ic id="cal" size="sm" /><span className="v">{addDate ? hebFull(addDate) : ''}</span><Ic id="chev" size="sm" />
                </button>
                <div className="ec-gr">תאריך לועזי: {addDate ? gregDots(addDate) : ''}</div>
              </div>
              <div className="field"><label className="lbl" htmlFor="aEn">שעת כניסה</label><input className="inp" type="time" id="aEn" name="entryTime" value={editShiftData.entryTime || ''} onChange={onData} /></div>
              <div className="field"><label className="lbl" htmlFor="aEx">שעת יציאה</label><input className="inp" type="time" id="aEx" name="exitTime" value={editShiftData.exitTime || ''} onChange={onData} /></div>
              <div className="field"><label className="lbl" htmlFor="aTm">סה&quot;כ דקות</label><input className="inp" type="number" id="aTm" disabled placeholder="מחושב אוטומטית" /></div>
              <div className="field"><label className="lbl" htmlFor="aTc">לתשלום (₪)</label><div className="inpw money"><span className="aff" aria-hidden="true">₪</span><input className="inp" type="number" id="aTc" disabled placeholder="מחושב אוטומטית" /></div></div>
              <div className="field"><label className="lbl" htmlFor="aNt">הערות</label><input className="inp" type="text" id="aNt" name="notes" value={editShiftData.notes || ''} onChange={onData} autoComplete="off" {...NO_FILL} /></div>
              {calOpen ? (
                <div className="ec-hcw">
                  <HebCalendar key={addDate} value={addDate} today={today} onPick={(k) => { setEditShiftData((p) => ({ ...p, date: k })); setCalOpen(false); const t = document.getElementById('ecDtb'); if (t) t.focus(); }} />
                </div>
              ) : null}
            </div>
            <div className="acts"><button type="button" className="btn primary" data-ec="add-save" onClick={saveShift}><Ic id="check" size="sm" />שמור</button><button type="button" className="btn" data-ec="add-cancel" onClick={closeAdd}>בטל</button></div>
          </section>
        ) : null}

        <div className="tblw">
          <table className="rtbl">
            <thead>
              {/* שורה נוספת ב-thead: החודש חוזר בראש כל עמוד הדפסה (כמו בישן) */}
              <tr className="per"><th colSpan={8}>תקופה: {lbl}</th></tr>
              <tr><th>תאריך לועזי</th><th>תאריך עברי</th><th>שעת כניסה</th><th>שעת יציאה</th><th>סה&quot;כ דקות</th><th>לתשלום (₪)</th><th>הערות</th><th className="no-print" style={{ textAlign: 'center' }}>פעולות</th></tr>
            </thead>
            <tbody>
              {shifts.map((s) => {
                const del = !!s.isDeleted;
                const inc = isIncompleteShift(s) && !del;
                const dayKey = israelDayKey(s.date);
                const heb = s.hebrewDate || (dayKey ? hDayYear(dayKey) : '-');
                if (editingShiftId === s.id) {
                  return (
                    <tr key={s.id} className="edit">
                      <td data-l="תאריך לועזי"><input className="inp" type="text" value={new Date(s.date).toLocaleDateString('he-IL')} disabled aria-label="תאריך לועזי" readOnly /></td>
                      <td data-l="תאריך עברי"><input className="inp" type="text" value={s.hebrewDate || heb} disabled aria-label="תאריך עברי" readOnly /></td>
                      <td data-l="שעת כניסה"><input className="inp" type="time" id="eEn" name="entryTime" value={editShiftData.entryTime || ''} onChange={onData} aria-label="שעת כניסה" /></td>
                      <td data-l="שעת יציאה"><input className="inp" type="time" id="eEx" name="exitTime" value={editShiftData.exitTime || ''} onChange={onData} aria-label="שעת יציאה" /></td>
                      <td data-l="סה&quot;כ דקות"><input className="inp" type="number" value={s.totalMinutes || ''} disabled aria-label="סה&quot;כ דקות" readOnly /></td>
                      <td data-l="לתשלום (₪)"><input className="inp" type="number" value={s.totalCalculated || ''} disabled aria-label="לתשלום" readOnly /></td>
                      <td data-l="הערות"><input className="inp" type="text" value={s.notes || ''} disabled aria-label="הערות" readOnly /></td>
                      <td data-l="" className="act no-print"><div className="rowact"><button type="button" className="btn primary sm" data-ec="edit-save" onClick={saveShift}>שמור</button><button type="button" className="btn sm" data-ec="edit-cancel" onClick={closeAdd}>בטל</button></div></td>
                    </tr>
                  );
                }
                return (
                  <tr key={s.id} className={`${del ? 'del' : ''}${inc ? ' inc' : ''}`.trim() || undefined}>
                    <td data-l="תאריך לועזי" className="num"><b>{new Date(s.date).toLocaleDateString('he-IL')}</b></td>
                    <td data-l="תאריך עברי" className="heb">{heb}</td>
                    <td data-l="שעת כניסה" className="num">{fmtTime(s.entryTime)}</td>
                    <td data-l="שעת יציאה" className="num">{fmtTime(s.exitTime)}</td>
                    <td data-l="סה&quot;כ דקות" className="num">{s.totalMinutes || '-'}</td>
                    <td data-l="לתשלום (₪)" className="num pay">{s.totalCalculated ? `₪${s.totalCalculated}` : '-'}</td>
                    <td data-l="הערות" className="mut">{s.notes || '-'}</td>
                    <td data-l="" className="act no-print">
                      <div className="rowact">
                        {!del ? (
                          <>
                            <button type="button" className="ibtn" data-ec="sh-edit" onClick={() => startEdit(s)} title="ערוך רק כניסה ויציאה" aria-label="ערוך רק כניסה ויציאה"><Ic id="pencil" size="sm" /></button>
                            <button type="button" className="ibtn danger" data-ec="sh-del" onClick={() => deleteShift(s.id)} title="מחק" aria-label="מחק"><Ic id="trash" size="sm" /></button>
                          </>
                        ) : (
                          <button type="button" className="ibtn" data-ec="sh-restore" onClick={() => restoreShift(s)} title="שחזר" aria-label="שחזר"><Ic id="refresh" size="sm" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!shifts.length && !isAddingShift ? <tr><td className="emptyrow" colSpan={8}>אין משמרות לחודש זה.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="status ok ec-sum">
          <Ic id="wallet" size="lg" />
          <div><small>סיכום שכר</small><small>{lbl}</small><div className="n">₪{monthlySalary(employee.shifts, filterMonth, filterYear)}</div></div>
        </div>
      </section>
    </>
  );
}
