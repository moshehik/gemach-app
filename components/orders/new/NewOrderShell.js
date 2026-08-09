'use client';

import React from 'react';

/**
 * מעטפת "הזמנה חדשה": כותרת עמוד ופעולות עליונות, הודעת טוסט (אוטוסייב טיוטה),
 * מסלול חמשת השלבים (stepper), גוף השלב הפעיל ופוטר ניווט.
 * כל התוכן והלוגיקה מגיעים מהעמוד — כאן רק הפריסה, בשפת העיצוב "אריג"
 * (ראו scratch/design-v2/fragments/order-new.html + ModernNewDressWizard.js לאותה מוסכמת stepper).
 */
export default function NewOrderShell({
  step,
  steps,              // [{ id, label, value, enabled, lockedReason }]
  onStepChange,
  topBar,             // פעולות בשורה העליונה (page-actions)
  flash,              // { type: 'ok' | 'err', text } | null
  children,           // גוף השלב
  footer              // כפתורי ניווט
}) {
  const current = steps.find(s => s.id === step);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>הזמנה חדשה</h1>
          <p className="page-desc">
            שלב {step} מתוך {steps.length}
            {current ? ` · ${current.label}` : ''}
          </p>
        </div>
        <div className="page-actions">{topBar}</div>
      </div>

      {flash && (
        <div className={`toast ${flash.type === 'err' ? 'error' : 'success'}`} style={{ marginBottom: '18px' }}>
          <svg className="icon"><use href={flash.type === 'err' ? '#i-alert-circle' : '#i-check-circle'} /></svg>
          {flash.text}
        </div>
      )}

      <nav className="stepper" aria-label="שלבי ההזמנה" style={{ flexWrap: 'wrap' }}>
        {steps.map((s, idx) => {
          const done = s.id < step;
          const isCurrent = s.id === step;
          const canFocus = s.enabled || isCurrent;
          return (
            <React.Fragment key={s.id}>
              <div
                className={`step${done ? ' done' : isCurrent ? ' current' : ''}`}
                role="button"
                tabIndex={canFocus ? 0 : -1}
                aria-disabled={!canFocus}
                aria-current={isCurrent ? 'step' : undefined}
                title={!canFocus ? s.lockedReason : undefined}
                style={{ cursor: canFocus ? 'pointer' : 'not-allowed', opacity: canFocus ? 1 : 0.6 }}
                onClick={() => onStepChange(s.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStepChange(s.id); } }}
              >
                <span className="step-num">{done ? <svg className="icon"><use href="#i-check" /></svg> : s.id}</span>
                {s.label}
                {s.value ? <span className="hint" style={{ color: 'var(--text-3)', fontWeight: 600 }}>· {s.value}</span> : null}
              </div>
              {idx < steps.length - 1 && <div className="step-line" />}
            </React.Fragment>
          );
        })}
      </nav>

      <section key={step} className="animate-fade-in">{children}</section>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {footer}
      </div>
    </>
  );
}
