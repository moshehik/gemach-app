'use client';

// OcMoneyToast — A23: טוסט "חיוב ממתין ₪N / זיכוי ממתין ₪N" עם לחצן "לשמירה", אחרי כל עריכה שמשנה את הסכום הממתין (בשני הגמ"חים).
// הלחצן "לשמירה" שולח את אירוע הלחצן הראשי של הרייל (oc:rail-primary) - מסלול שמירה אחד (OcRail). החזרת הסכום לאפס / ביטול השינויים
// מסתירים את הטוסט (רק אם הטוסט שמוצג הוא שלנו - לא דורסים הודעות אחרות, כמו "השינויים בוטלו").
// מפת פורט: notify() בעיצוב (תצוגות-עיצוב/כרטיס-הזמנה.html): charge/credit; בלי "שינויים ממתינים לשמירה" כשהסכום לא השתנה (A23: רק עריכה שמשנה סכום).
// קורא לטוסט הגלובלי של הכרטיס (ui.toast - #toast) - אין כאן טוסט נפרד.

import { useEffect, useRef } from 'react';
import { Money } from '../dialogs/ocDialogParts';
import { moneyToastPlan, moneyToastText, OC_RAIL_PRIMARY_EVENT } from './ocRailLogic';

export default function OcMoneyToast({ oc, ui }) {
  const last = useRef(0);
  const shown = useRef(null); // {kind, text} של הטוסט האחרון שהצגנו
  const uiRef = useRef(ui);
  useEffect(() => { uiRef.current = ui; });
  const { dirty } = oc;
  const net = oc.totals.pendingNet;

  useEffect(() => {
    const plan = moneyToastPlan({ dirty, net, last: last.current });
    last.current = plan.net;
    const u = uiRef.current;
    const hideIfMine = () => {
      const s = shown.current;
      if (!s || typeof document === 'undefined') return;
      shown.current = null;
      const el = document.getElementById('toast');
      const b = el && el.querySelector('b');
      if (el && el.classList.contains('on') && el.dataset.kind === s.kind && b && b.textContent === s.text) u.hideToast();
    };
    if (plan.kind === 'hide') { hideIfMine(); return; }
    if (!plan.kind) return;
    const text = moneyToastText(plan.kind, plan.net);
    shown.current = { kind: plan.kind, text };
    const label = plan.kind === 'credit' ? 'זיכוי ממתין' : 'חיוב ממתין';
    u.toast(plan.kind, <>{label} <Money n={plan.net} /></>, '', {
      text: 'לשמירה', icon: 'check',
      onClick: () => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OC_RAIL_PRIMARY_EVENT)); },
    });
  }, [dirty, net]);

  return null;
}
