'use client';

// RangeDialog - חלון כהה לבחירת טווח תאריכים עבריים ("טווח מותאם" בחלון הסינון של רשימות ההזמנות / הלקוחות). הלוח הוא אותו לוח חודשי עברי של
// הפלטה שבכרטיס ההזמנה (OcHebrewCalendar, mode='range': לחיצה ראשונה = תחילת הטווח, שנייה = סופו; מוקדם יותר מתהפך). רק תאריכים עבריים.
// onDone({from,to}) באישור; onCancel בביטול / Escape / לחיצה על הרקע.
import { useState } from 'react';
import { Dlg, DlgBadge, Ic } from '../a5-list';
import OcHebrewCalendar from '../order-card/parts/OcHebrewCalendar';
import { dayTitle } from '../order-card/parts/ocDetailsLogic';

export default function RangeDialog({ title, from: f0 = '', to: t0 = '', onDone, onCancel }) {
  const [range, setRange] = useState({ from: f0, to: t0 });
  const ready = !!(range.from && range.to);
  return (
    <Dlg labelledBy="a5-rng-t" onClose={onCancel} focusSel=".btn.primary">
      <DlgBadge icon="cal" />
      <h2 id="a5-rng-t">{title}</h2>
      <div className="sub" aria-live="polite">
        {ready ? <><bdi>{dayTitle(range.from)}</bdi> – <bdi>{dayTitle(range.to)}</bdi></> : 'בחרו תאריך התחלה ואחריו תאריך סיום'}
      </div>
      <OcHebrewCalendar key="rng" mode="range" from={range.from} to={range.to} labelledBy="a5-rng-t" onRange={(a, b) => setRange({ from: a, to: b })} />
      <div className="dbtns" style={{ marginTop: 24 }}>
        <button type="button" className="btn primary lg block" disabled={!ready} onClick={() => onDone(range)}><Ic id="check" />אישור</button>
        <button type="button" className="btn ghost block" onClick={onCancel}><Ic id="back" size="sm" />ביטול</button>
      </div>
    </Dlg>
  );
}
