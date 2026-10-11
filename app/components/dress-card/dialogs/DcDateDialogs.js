'use client';

// חלונות התאריך של כרטיס הדגם: "תאריך כניסה למאגר" ו"סימון הדגם כלא פעיל / עריכת סיבה ותאריך" (dateDlg / inactDlg ב-model-card.js).
// העיצוב: ערך התאריך העברי הגדול + שורת לחצני צעד (30/7/1 אחורה/קדימה + היום). בנוסף (סטייה מתועדת, ר' model-card-fidelity.md): לחצן "בחירה מלוח"
// שפותח לוח חודשי עברי של הפלטה (OcHebrewCalendar, אותו רכיב כמו בכרטיס ההזמנה) - בדף הישן אפשר היה לבחור כל תאריך (HebrewDatePicker), ולחצני הצעד לבדם
// מגיעים רק 30 יום בכל לחיצה (והעיצוב עוצר ב"היום"); כאן אין תקרה של "היום" כי תאריך יציאה עתידי היה מותר בדף הישן.
import { useState } from 'react';
import { DlgBtn, DlgButtons, DlgHead } from '../../order-card/OcUi';
import OcIcon from '../../order-card/OcIcon';
import OcHebrewCalendar from '../../order-card/parts/OcHebrewCalendar';
import { getIsraelTodayKey } from '@/lib/hebrewDate';
import { addDays, hFull } from '@/lib/dressCardLogic';

const STEPS = [[-30, '30 יום אחורה'], [-7, 'שבוע אחורה'], [-1, 'יום אחורה'], [1, 'יום קדימה'], [7, 'שבוע קדימה'], [30, '30 יום קדימה']];

export function DateChooser({ value, onChange }) {
  const today = getIsraelTodayKey();
  const [cal, setCal] = useState(false);
  return (
    <>
      <div className="dc-dlg-val"><OcIcon name="cal" /><span id="dcDV">{hFull(value)}</span></div>
      <div className="dc-dlg-dates">
        {STEPS.map(([n, t]) => <button key={n} type="button" className="btn sm" onClick={() => onChange(addDays(value, n))}>{t}</button>)}
        <button type="button" className="btn sm" onClick={() => onChange(today)}><OcIcon name="cal" size="sm" />היום</button>
        <button type="button" className="btn sm" aria-expanded={cal} aria-controls="dcCal" onClick={() => setCal((v) => !v)}><OcIcon name="list" size="sm" />{cal ? 'הסתר לוח' : 'בחירה מלוח'}</button>
      </div>
      {cal ? <div className="dc-dlg-cal" id="dcCal"><OcHebrewCalendar key={value} mode="single" value={value} onPick={onChange} labelledBy="oc-dlg-t" /></div> : null}
    </>
  );
}

/** close(dateKey | null) */
export function DcEntryDateDialog({ value, close }) {
  const [date, setDate] = useState(value || getIsraelTodayKey());
  return (
    <>
      <DlgHead id="oc-dlg-t" title="תאריך כניסה למאגר" />
      <DateChooser value={date} onChange={setDate} />
      <DlgButtons style={{ marginTop: 20 }}>
        <DlgBtn kind="primary" icon="check" autoFocus onClick={() => close(date)}>אישור</DlgBtn>
        <DlgBtn kind="ghost" icon="back" onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}

/** close({reason, date} | null) */
export function DcInactiveDialog({ active, reason: r0, exit, entry, close }) {
  const [reason, setReason] = useState(r0 || '');
  const [date, setDate] = useState(exit || getIsraelTodayKey());
  const [err, setErr] = useState('');
  const ok = () => {
    if (entry && date < entry) { setErr('התאריך קודם לכניסה למאגר'); return; }
    close({ reason: reason.trim(), date });
  };
  return (
    <>
      <DlgHead id="oc-dlg-t" title={active ? 'סימון הדגם כלא פעיל' : 'עריכת סיבה ותאריך'} />
      <label className="lbl" htmlFor="dcWhy">סיבה</label>
      <textarea className="inp" id="dcWhy" rows={3} placeholder="סיבה" value={reason} data-autofocus="true" onChange={(e) => { setReason(e.target.value); setErr(''); }} />
      <label className="lbl" style={{ marginTop: 16 }}>תאריך יציאה מהמאגר</label>
      <DateChooser value={date} onChange={(d) => { setDate(d); setErr(''); }} />
      <div className="dc-err" style={{ justifyContent: 'center', minHeight: 24 }} role="alert">{err ? <><OcIcon name="alert" size="sm" />{err}</> : null}</div>
      <DlgButtons style={{ marginTop: 12 }}>
        <DlgBtn kind="primary" icon="check" onClick={ok}>שמור סימון</DlgBtn>
        <DlgBtn kind="ghost" icon="back" onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}
