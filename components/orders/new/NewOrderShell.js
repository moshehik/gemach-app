'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

/**
 * המעטפת של מסך "הזמנה חדשה": רקע זכוכית, באנר זהב עם מסלול חמשת השלבים,
 * שורת פעולות עליונה, גוף השלב הפעיל ופוטר ניווט.
 * כל התוכן והלוגיקה מגיעים מהעמוד — כאן רק הפריסה.
 */
export default function NewOrderShell({
  step,
  steps,              // [{ id, label, value, enabled, lockedReason }]
  onStepChange,
  draftOrderId,
  itemsCount,
  repairsTotal,
  totalAmount,
  calculating,
  topBar,             // פעולות בשורה העליונה
  children,           // גוף השלב
  footer              // כפתורי ניווט
}) {
  const currentIndex = steps.findIndex(s => s.id === step);
  const pageRef = useRef(null);

  // מה שמעל המסך (נאב-בר, ובסביבת פיתוח גם באנר הגירסה) משנה גובה לפי רוחב החלון,
  // ולכן המרווח העליון נמדד בפועל במקום להיות מספר קבוע — אחרת הכרטיס גולש מתחת למסך.
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    let last = null;
    const apply = () => {
      const top = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY));
      // ההשמה משנה את גובה העמוד ולכן מעירה שוב את ה-observer; בלי ההשוואה הזו
      // זו לולאה אינסופית של מדידה-והשמה.
      if (top === last) return;
      last = top;
      el.style.setProperty('--noc-nav', `${top}px`);
    };
    apply();
    // הנאב-בר ממשיך לגדול אחרי ההרכבה (טעינת פונטים, שבירת הקישורים לשתי שורות),
    // ולא כל שינוי כזה מגיע כאירוע — לכן נמדד שוב כמה פעמים בשתי השניות הראשונות.
    const ticks = [50, 200, 500, 1000, 2000].map(ms => setTimeout(apply, ms));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply).catch(() => {});
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    if (observer) {
      observer.observe(document.documentElement);
      const nav = document.querySelector('.navbar');
      if (nav) observer.observe(nav);
    }
    window.addEventListener('resize', apply);
    return () => {
      ticks.forEach(clearTimeout);
      window.removeEventListener('resize', apply);
      if (observer) observer.disconnect();
    };
  }, []);

  return (
    <div className="noc noc-page" ref={pageRef}>
      <div className="noc-glow a" />
      <div className="noc-glow b" />
      <div className="noc-glow c" />

      <div className="noc-inner">
        <div className="noc-crumb">
          גמ"ח שמלות &nbsp;›&nbsp; <Link href="/orders">הזמנות</Link> &nbsp;›&nbsp; <strong>הזמנה חדשה</strong>
        </div>

        <div className="noc-shell">
          {/* ===== באנר זכוכית ===== */}
          <aside className="noc-side">
            <div>
              <div className="noc-side-title">הזמנה חדשה</div>
              <div className="noc-side-sub">
                שלב {currentIndex + 1} מתוך {steps.length}
                {steps[currentIndex] ? ` · ${steps[currentIndex].label}` : ''}
              </div>

              <hr className="noc-side-rule" />

              <nav className="noc-steps" aria-label="שלבי ההזמנה">
                {steps.map(s => {
                  const done = s.id < step;
                  const current = s.id === step;
                  const cls = `noc-step ${done ? 'done' : ''} ${current ? 'current' : ''}`.trim();
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={cls}
                      aria-current={current ? 'step' : undefined}
                      disabled={!s.enabled && !current}
                      title={!s.enabled && !current ? s.lockedReason : undefined}
                      onClick={() => onStepChange(s.id)}
                    >
                      <span className="noc-node-col">
                        <span className="noc-node">{done ? <Check size={12} strokeWidth={3} /> : s.id}</span>
                      </span>
                      <span className="noc-step-txt">
                        <span className="noc-step-ttl">{s.label}</span>
                        {s.value ? <span className="noc-step-val">{s.value}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="noc-side-foot">
              <div className="noc-sf-row"><span>פריטים</span><span>{itemsCount}</span></div>
              {repairsTotal > 0 && (
                <div className="noc-sf-row"><span>תיקונים</span><span>₪{repairsTotal.toLocaleString('he-IL')}</span></div>
              )}
              <div className="noc-sf-row sum">
                <span>סה"כ</span>
                <span>{calculating ? '...' : `₪${(totalAmount || 0).toLocaleString('he-IL')}`}</span>
              </div>
              <div className="noc-side-note">
                {draftOrderId
                  ? `נשמר אוטומטית כטיוטה #${draftOrderId} — אפשר לסגור ולהמשיך מרשימת ההזמנות.`
                  : 'ההזמנה תישמר אוטומטית כטיוטה ברגע שיהיו לקוח, תאריך ופריט אחד.'}
              </div>
            </div>
          </aside>

          {/* ===== תוכן ===== */}
          <main className="noc-main">
            <div className="noc-bar">{topBar}</div>
            <section className="noc-pane" key={step}>{children}</section>
            <div className="noc-foot">{footer}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
