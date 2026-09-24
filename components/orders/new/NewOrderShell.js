'use client';

import React from 'react';
import { V3Page, Banner, Stepper } from '@/app/v3/ui/components';

/**
 * מעטפת "הזמנה חדשה" בשפת v3: כותרת ופעולות עליונות, הודעת אוטוסייב,
 * ציר השלבים (V3Stepper + "שלב X מתוך N"), גוף השלב (key={step} — איפוס מצב מקומי בכל מעבר)
 * ופוטר ניווט קבוע. כל התוכן והלוגיקה מגיעים מהעמוד — כאן רק הפריסה (R8).
 */
export default function NewOrderShell({
  step,
  steps,              // [{ id, label, value, enabled, lockedReason }]
  onStepChange,       // (id) => void  — id 1..N
  topBar,             // פעולות בשורה העליונה
  flash,              // { type: 'ok' | 'err', text } | null
  children,           // גוף השלב
  footer              // כפתורי ניווט
}) {
  const nodes = steps.map((s) => ({
    key: s.id,
    label: s.label,
    value: s.value || undefined,
    locked: !s.enabled,
    lockedReason: s.lockedReason
  }));

  return (
    <V3Page>
      <div className="v3-stack">
        <div className="v3-pagehead">
          <div className="v3-pagehead__title">
            <h1 className="v3-h1">הזמנה חדשה</h1>
          </div>
          <div className="v3-pagehead__tools">{topBar}</div>
        </div>

        {flash && (
          <Banner kind={flash.type === 'err' ? 'alert' : 'success'} text={flash.text} />
        )}

        <Stepper
          steps={nodes}
          current={step - 1}
          onStep={(i) => onStepChange(steps[i].id)}
          label="שלבי ההזמנה"
        />

        <section key={step} style={{ animation: 'v3-rowin var(--v3-dur-med) var(--v3-ease) both' }}>
          {children}
        </section>

        <div
          className="v3-stepnav"
          style={{ position: 'sticky', bottom: 0, zIndex: 5, background: 'var(--v3-surface)', paddingBlock: 'var(--v3-sp-3)' }}
        >
          {footer}
        </div>
      </div>
    </V3Page>
  );
}
