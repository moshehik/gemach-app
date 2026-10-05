'use client';

// דף "נוכחות עובד" (bodyEmp בעיצוב המאושר): עריכת השורות של עובד אחד לחודש אחד - כמו לשונית "נוכחות וסיכום" בכרטיס העובד
// (app/employees/[id]/page.js), באותם נתיבי API ובאותם כללים:
//   עריכה בתוך השורה: רק כניסה ויציאה (הדקות והתשלום מחושבים בשרת - lib/shiftCalc.js); הוספה עם תאריך מלוח עברי, רק בחודש המוצג;
//   מחיקה רכה ושחזור דרך חלון אישור; "הצג מחוקות"; משמרת לא שלמה מודגשת; סיכום שכר (הנהלה) / סה״כ שעות (עובד).
// הנהלה: כל עובד, עם עמודת "לתשלום". עובד רגיל: רק הוא עצמו (AT-12), בלי שכר - השרת אוכף (lib/attendance/access.js, AT-13).
// AT-12: שורה שנוספה / נערכה ידנית מסומנת "נערך ידנית" (מההיסטוריה), עם לחצן היסטוריה בשורה; "היסטוריית שינויים" בשורת הכלים (AT-16).
import { useRef, useState } from 'react';
import { Ic, HebCalendar, hebFull } from './parts';
import { monthLabel, gregDots, israelTime, buildShiftTimes, dayKeyInMonth, hm, hDayYear, hDayShort, israelDayKey, isIncomplete, aggregate } from '@/lib/attendance/summary';

const NO_FILL = { 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };
const pad = (n) => (n < 10 ? '0' : '') + n;

async function send(url, method, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* */ }
  return { ok: res.ok, status: res.status, data };
}

function editTip(edit) {
  if (!edit) return '';
  const when = (() => { const k = israelDayKey(edit.at); return (k ? hDayShort(k) + ' ' : '') + (israelTime(edit.at) || ''); })();
  return (edit.kind === 'added' ? 'נוסף ידנית' : 'נערך') + (edit.by ? ' ע״י ' + edit.by : '') + ' · ' + when;
}

export default function AttendanceEdit({ employee, period, isMgr, shifts, loading, showDel, onShowDel, onChanged, say, confirm, onHistory, todayKey }) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [addDate, setAddDate] = useState('');
  const [calOpen, setCalOpen] = useState(false);
  const [add, setAdd] = useState({ entry: '', exit: '', notes: '' });
  const [ed, setEd] = useState({ entry: '', exit: '' });
  const busy = useRef(false);
  const dtbRef = useRef(null);
  const lbl = monthLabel(period.y, period.m);
  const cols = isMgr ? 8 : 7;
  const base = `/api/employees/${encodeURIComponent(employee.id)}/shifts`;

  const closeEdit = () => { setAdding(false); setEditId(null); setCalOpen(false); };
  const startAdd = () => { setEditId(null); setCalOpen(false); setAdd({ entry: '', exit: '', notes: '' }); setAddDate(`${period.y}-${pad(period.m + 1)}-01`); setAdding(true); };
  const startEdit = (s) => { setAdding(false); setEd({ entry: israelTime(s.entryTime) || '', exit: israelTime(s.exitTime) || '' }); setEditId(s.id); };

  async function run(fn) {
    if (busy.current) return;
    busy.current = true;
    try { await fn(); } finally { busy.current = false; }
  }

  const saveAdd = () => run(async () => {
    if (!addDate) { say('יש לבחור תאריך למשמרת', '', 'alert'); return; }
    // אותה בדיקה ואותה הודעה כמו בכרטיס העובד: משמרת בתאריך שאינו בחודש המוצג "נעלמת" מהרשימה
    if (!dayKeyInMonth(addDate, period.y, period.m)) {
      say(`לא ניתן להוסיף משמרת בתאריך שאינו בחודש המוצג (${lbl}).`, 'יש לבחור תאריך בתוך החודש המוצג, או לעבור לחודש הרצוי ואז להוסיף את המשמרת.', 'alert');
      return;
    }
    const { entryTime, exitTime } = buildShiftTimes(addDate, add.entry, add.exit);
    const r = await send(base, 'POST', { date: addDate + 'T00:00:00.000Z', hebrewDate: '', entryTime, exitTime, notes: add.notes || '', isDeleted: false, displayedMonth: period.m, displayedYear: period.y });
    if (!r.ok) { say((r.data && r.data.error) || 'שגיאה בשמירת משמרת', '', 'alert'); return; }
    closeEdit();
    say('המשמרת נוספה', hDayYear(addDate), 'check');
    onChanged();
  });

  const saveEdit = (s) => run(async () => {
    const { entryTime, exitTime } = buildShiftTimes(s.dayKey, ed.entry, ed.exit);
    const r = await send(`${base}/${encodeURIComponent(s.id)}`, 'PUT', { entryTime, exitTime });
    if (!r.ok) { say((r.data && r.data.error) || 'שגיאה בשמירת משמרת', '', 'alert'); return; }
    closeEdit();
    say('המשמרת עודכנה', hDayYear(s.dayKey), 'check');
    onChanged();
  });

  const del = (s) => run(async () => {
    const ok = await confirm({ title: 'האם אתה בטוח שברצונך למחוק משמרת זו?', sub: 'ההיסטוריה תישמר במערכת אך השורה תוסתר.', okLabel: 'אישור', icon: 'trash' });
    if (!ok) return;
    const r = await send(`${base}/${encodeURIComponent(s.id)}`, 'DELETE');
    if (!r.ok) { say((r.data && r.data.error) || 'שגיאה במחיקת משמרת', '', 'alert'); return; }
    say('המשמרת נמחקה', hDayYear(s.dayKey), 'trash');
    onChanged();
  });

  const restore = (s) => run(async () => {
    const ok = await confirm({ title: 'האם לשחזר משמרת זו?', sub: '', okLabel: 'אישור', icon: 'refresh' });
    if (!ok) return;
    const r = await send(`${base}/${encodeURIComponent(s.id)}`, 'PUT', { isDeleted: false });
    if (!r.ok) { say((r.data && r.data.error) || 'שגיאה בשחזור המשמרת', '', 'alert'); return; }
    say('המשמרת שוחזרה', hDayYear(s.dayKey), 'refresh');
    onChanged();
  });

  const rows = shifts || [];
  const tot = aggregate(rows);

  const editRow = (s) => (
    <tr key={s.id} className="edit">
      <td data-l="תאריך לועזי"><input className="inp" type="text" value={gregDots(s.dayKey)} disabled aria-label="תאריך לועזי" /></td>
      <td data-l="תאריך עברי"><input className="inp" type="text" value={hebFull(s.dayKey)} disabled aria-label="תאריך עברי" /></td>
      <td data-l="שעת כניסה"><input className="inp" type="time" id="eEn" value={ed.entry} onChange={(e) => setEd((o) => ({ ...o, entry: e.target.value }))} aria-label="שעת כניסה" /></td>
      <td data-l="שעת יציאה"><input className="inp" type="time" id="eEx" value={ed.exit} onChange={(e) => setEd((o) => ({ ...o, exit: e.target.value }))} aria-label="שעת יציאה" /></td>
      <td data-l='סה"כ דקות'><input className="inp" type="number" value={s.minutes || ''} disabled aria-label='סה"כ דקות' /></td>
      {isMgr ? <td data-l="לתשלום (₪)"><input className="inp" type="number" value={s.pay || ''} disabled aria-label="לתשלום" /></td> : null}
      <td data-l="הערות"><input className="inp" type="text" value={s.notes || ''} disabled aria-label="הערות" /></td>
      <td data-l="" className="act"><div className="rowact">
        <button type="button" className="btn primary sm" onClick={() => saveEdit(s)}>שמור</button>
        <button type="button" className="btn sm" onClick={closeEdit}>בטל</button>
      </div></td>
    </tr>
  );

  const viewRow = (s) => {
    const inc = isIncomplete(s) && !s.isDeleted;
    return (
      <tr key={s.id} className={[s.isDeleted ? 'del' : '', inc ? 'inc' : ''].filter(Boolean).join(' ') || undefined}>
        <td data-l="תאריך לועזי" className="num"><span className="at-dt"><b>{gregDots(s.dayKey)}</b>{s.edit ? <>{' '}<span className="chip gold at-man" tabIndex={0} data-tip={editTip(s.edit)}>נערך ידנית</span></> : null}</span></td>
        <td data-l="תאריך עברי" className="heb">{hebFull(s.dayKey)}</td>
        <td data-l="שעת כניסה" className="num">{israelTime(s.entryTime) || '-'}</td>
        <td data-l="שעת יציאה" className="num">{israelTime(s.exitTime) || '-'}</td>
        <td data-l='סה"כ דקות' className="num">{s.minutes || '-'}</td>
        {isMgr ? <td data-l="לתשלום (₪)" className="num pay">{s.pay ? '₪' + s.pay : '-'}</td> : null}
        <td data-l="הערות" className="mut">{s.notes || '-'}</td>
        <td data-l="" className="act"><div className="rowact">
          {!s.isDeleted ? (
            <>
              <button type="button" className="ibtn" aria-label="ערוך רק כניסה ויציאה" data-tip="ערוך רק כניסה ויציאה" onClick={() => startEdit(s)}><Ic id="pencil" size="sm" /></button>
              <button type="button" className="ibtn danger" aria-label="מחק" data-tip="מחק" onClick={() => del(s)}><Ic id="trash" size="sm" /></button>
            </>
          ) : (
            <button type="button" className="ibtn" aria-label="שחזר" data-tip="שחזר" onClick={() => restore(s)}><Ic id="refresh" size="sm" /></button>
          )}
          {s.edit ? <button type="button" className="ibtn" aria-label="היסטוריית שינויים" data-tip="היסטוריית שינויים" onClick={() => onHistory(s)}><Ic id="sn-history" size="sm" /></button> : null}
        </div></td>
      </tr>
    );
  };

  let tbody;
  if (loading) tbody = <tbody>{[1, 2, 3, 4, 5].map((i) => <tr key={i} className="at-skel"><td colSpan={cols}><i /></td></tr>)}</tbody>;
  else {
    tbody = (
      <tbody>
        {rows.map((s) => (editId === s.id ? editRow(s) : viewRow(s)))}
        {!rows.length && !adding ? <tr><td className="emptyrow" colSpan={cols}>אין משמרות לחודש זה.</td></tr> : null}
      </tbody>
    );
  }

  return (
    <section className="card dfields at-card" aria-labelledby="h-att">
      <div className="card-h"><div className="ico rose"><Ic id="clock" size="lg" /></div><h2 id="h-att">דוח נוכחות וסיכום - {employee.name}</h2></div>
      <div className="ec-tool">
        <div className="trow">
          <label className="sw"><input type="checkbox" id="showDel" checked={showDel} onChange={(e) => onShowDel(e.target.checked)} /><i /></label>
          <label htmlFor="showDel" className="pf-pl">הצג מחוקות</label>
        </div>
        <span className="sp" />
        <button type="button" className="btn" onClick={() => onHistory(null)}><Ic id="sn-history" size="sm" />היסטוריית שינויים</button>
        <button type="button" className="btn primary" disabled={adding || editId !== null} onClick={startAdd}><Ic id="plus" size="sm" />הוסף משמרת</button>
      </div>

      {adding ? (
        <section className="addpanel open dfields ec-add" aria-label="הוסף משמרת">
          <h3>הוסף משמרת</h3>
          <div className="grid2">
            <div className="field">
              <span className="lbl">תאריך עברי</span>
              <button type="button" className="ec-dtb" id="ecDtb" ref={dtbRef} aria-expanded={calOpen} aria-haspopup="dialog" onClick={() => setCalOpen((o) => !o)}>
                <Ic id="cal" size="sm" /><span className="v">{addDate ? hebFull(addDate) : ''}</span><Ic id="chev" size="sm" />
              </button>
              <div className="ec-gr">תאריך לועזי: {addDate ? gregDots(addDate) : ''}</div>
            </div>
            <div className="field"><label className="lbl" htmlFor="aEn">שעת כניסה</label><input className="inp" type="time" id="aEn" value={add.entry} onChange={(e) => setAdd((o) => ({ ...o, entry: e.target.value }))} /></div>
            <div className="field"><label className="lbl" htmlFor="aEx">שעת יציאה</label><input className="inp" type="time" id="aEx" value={add.exit} onChange={(e) => setAdd((o) => ({ ...o, exit: e.target.value }))} /></div>
            <div className="field"><label className="lbl" htmlFor="aTm">סה&quot;כ דקות</label><input className="inp" type="number" id="aTm" disabled placeholder="מחושב אוטומטית" /></div>
            {isMgr ? (
              <div className="field"><label className="lbl" htmlFor="aTc">לתשלום (₪)</label><div className="inpw money"><span className="aff" aria-hidden="true">₪</span><input className="inp" type="number" id="aTc" disabled placeholder="מחושב אוטומטית" /></div></div>
            ) : null}
            <div className="field"><label className="lbl" htmlFor="aNt">הערות</label><input className="inp" type="text" id="aNt" autoComplete="off" value={add.notes} onChange={(e) => setAdd((o) => ({ ...o, notes: e.target.value }))} {...NO_FILL} /></div>
            {calOpen ? (
              <div className="ec-hcw">
                <HebCalendar value={addDate} today={todayKey} onPick={(k) => { setAddDate(k); setCalOpen(false); if (dtbRef.current) dtbRef.current.focus(); }} />
              </div>
            ) : null}
          </div>
          <div className="acts">
            <button type="button" className="btn primary" onClick={saveAdd}><Ic id="check" size="sm" />שמור</button>
            <button type="button" className="btn" onClick={closeEdit}>בטל</button>
          </div>
        </section>
      ) : null}

      <div className="tblw ea-wrap">
        <table className={'rtbl ea-tbl' + (isMgr ? '' : ' nopay')}>
          <thead>
            <tr className="per"><th colSpan={cols}>תקופה: {lbl}</th></tr>
            <tr>
              <th>תאריך לועזי</th><th>תאריך עברי</th><th>שעת כניסה</th><th>שעת יציאה</th><th>סה&quot;כ דקות</th>
              {isMgr ? <th>לתשלום (₪)</th> : null}
              <th>הערות</th><th style={{ textAlign: 'center' }}>פעולות</th>
            </tr>
          </thead>
          {tbody}
        </table>
      </div>

      {isMgr ? (
        <div className="status ok ec-sum"><Ic id="wallet" size="lg" /><div><small>סיכום שכר</small><small>{lbl}</small><div className="n">₪{tot.pay.toFixed(2)}</div></div></div>
      ) : (
        <div className="status ok ec-sum"><Ic id="clock" size="lg" /><div><small>סה״כ החודש (שעות)</small><small>{lbl}</small><div className="n">{hm(tot.minutes)}</div></div></div>
      )}
    </section>
  );
}
