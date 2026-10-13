'use client';

// MnFlow - אשף "דגם חדש" כ"טופס רציף בעמוד אחד נגלל": מקטע תחת מקטע, בדיוק כמו "הזמנה חדשה" ברצף (app/components/new-order/LayoutContinuous.js) -
// פס התקדמות דק ונדבק (.pbars.mini) + גושי .no-sec (מספר גדול + שאלת המקטע, ובתוכם קוביית .card.one). אין שלבים, אין "המשך" ואין רייל צדדי.
// המקטעים: 01 זיהוי הדגם · 02 תמונה והערות · 03 מלאי ראשוני · 04 סיכום + יצירה. מקטע מאוחר גלוי-מעומעם (נעול, ובכותרת "...") עד שזיהוי הדגם
// (קוד, שם, קטגוריה) תקין - אותו תנאי שהאשף דרש למעבר מהשלב הראשון. הפס עוקב אחרי המקטע שבתצוגה; לחיצה על פריט בו / "עריכה" בסיכום גוללת למקטע.
import { useEffect, useRef, useState } from 'react';
import { Ic } from './MnUi';
import { StepIdentity, StepMedia, StepStock, StepSummary } from './MnSteps';
import { recapOf } from './modelNewLogic';

const VIEWS = [StepIdentity, StepMedia, StepStock, StepSummary];
export const secId = (n) => `mn-sec-${n}`;

const still = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function scrollToSec(n) {
  const el = typeof document !== 'undefined' ? document.getElementById(secId(n)) : null;
  if (!el) return false;
  el.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
  return true;
}

function MiniProgress({ ctl, activeN }) {
  // הפס נדבק בגלילה: לפני כן מראה בהיר ושקוף, ורק כשהוא נדבק לראש המסך (class stuck) מקבל את הגוון החם - כמו באשף ההזמנה
  const ref = useRef(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return undefined;
    let raf = 0;
    const check = () => {
      raf = 0;
      const top = parseFloat(window.getComputedStyle(el).top) || 0;
      setStuck(window.scrollY > 0 && el.getBoundingClientRect().top <= top + 1);
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) window.cancelAnimationFrame(raf); };
  }, []);
  const { S } = ctl;
  const caption = (n, s) => {
    if (n === 1 && ctl.step1Ok) { const rc = recapOf(1, { d: S.d, items: S.items, useModelNames: ctl.useModelNames }); return `#${rc.code}${rc.name ? ` · ${rc.name}` : ''}`; }
    if (n === 3 && S.items.length) return recapOf(3, { d: S.d, items: S.items });
    return s.l;
  };
  return (
    <div ref={ref} className={`pbars mini${stuck ? ' stuck' : ''}`} id="mnMiniBars" data-guide-id="mn.progress" aria-label="התקדמות יצירת הדגם" style={{ '--n': ctl.steps.length }}>
      {ctl.steps.map((s, i) => {
        const n = i + 1;
        const open = n === 1 || ctl.step1Ok;
        const filled = [ctl.step1Ok, ctl.step1Ok && !!(S.d.img || String(S.d.notes || '').trim()), S.items.length > 0, false][i];
        const state = n === activeN ? 'cur' : filled ? 'done' : 'fut';
        const cap = caption(n, s);
        const go = () => ctl.go(n);
        return (
          <div key={n} className={`pb ${state}${open ? '' : ' lock'}`}>
            <div className="pb-bar" role="progressbar" aria-label={s.l} aria-valuemin={0} aria-valuemax={1} aria-valuenow={state === 'done' ? 1 : 0}><i /></div>
            <div className="pb-d" role="button" tabIndex={0} aria-disabled={!open || undefined} aria-current={state === 'cur' ? 'true' : undefined}
              data-tip={open ? (cap === s.l ? `מעבר אל ${s.l}` : `${s.l}: ${cap}`) : 'יש להשלים תחילה את זיהוי הדגם'}
              onClick={go} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}>
              <Ic n={s.i} c="sm" /><span className="pb-t"><b>{cap}</b></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Need({ ctl }) {
  const show = ctl.missing.length > 0;
  return <div id="mnNeed" className={show ? 'mn-need' : undefined}>{show ? <><Ic n="alert" c="sm" /><span>יש להשלים: {ctl.missing.join(', ')}</span></> : null}</div>;
}

function CreateFooter({ ctl }) {
  const busy = ctl.S.busy;
  const ok = ctl.step1Ok && ctl.head !== false;
  const tip = ok ? undefined : (ctl.head === false ? 'יצירת דגם שמורה להנהלה ראשית' : `יש להשלים: ${ctl.missing.join(', ')}`);
  return (
    <div className="row spread wrap no-sec-nav">
      <span className="mn-foot-l">
        <button type="button" className="btn ghost" data-guide-id="mn.cancel" data-act="exit" disabled={busy} onClick={ctl.exit}><Ic n="x" c="sm" />ביטול</button>
        {ctl.dirty ? <button type="button" className="btn ghost" data-act="discard" disabled={busy} onClick={ctl.discard}><Ic n="undo" c="sm" />בטל הכול</button> : null}
      </span>
      <span className="tipw" data-tip={tip}>
        <button type="button" className="btn primary" data-guide-id="mn.create" data-act="create" disabled={!ctl.canCreate} aria-busy={busy || undefined} onClick={ctl.create}><Ic n="check" />יצירת הדגם</button>
      </span>
    </div>
  );
}

export default function MnFlow({ ctl, onPickFile }) {
  const [activeN, setActiveN] = useState(1);
  // המקטע "בתצוגה" = האחרון שראשו הגיע לקו שמתחת לפס הנדבק
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let raf = 0;
    const calc = () => {
      raf = 0;
      const bar = document.getElementById('mnMiniBars');
      const line = (bar ? bar.getBoundingClientRect().bottom : 0) + 48;
      let cur = 1;
      for (let n = 1; n <= 4; n += 1) {
        const el = document.getElementById(secId(n));
        if (el && el.getBoundingClientRect().top <= line) cur = n;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = 4;
      setActiveN(cur);
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(calc); };
    calc();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScroll) : null;
    if (ro) ro.observe(document.body);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (ro) ro.disconnect(); if (raf) window.cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <MiniProgress ctl={ctl} activeN={activeN} />
      <div className="no-flow" id="mnFlow" inert={ctl.S.busy || undefined}>
        {ctl.steps.map((s, i) => {
          const n = i + 1;
          const View = VIEWS[i];
          const locked = n > 1 && !ctl.step1Ok;
          const id = secId(n);
          return (
            <section key={n} className={`no-sec${locked ? ' locked' : ''}`} id={id} data-sec-key={n} aria-labelledby={`${id}-t`}>
              <header className="no-sec-h">
                <span className="no-sec-n" aria-hidden="true">{String(n).padStart(2, '0')}</span>
                <h2 className="no-sec-t" id={`${id}-t`}>{s.q}{locked ? <span className="no-sec-dots" aria-hidden="true"> ...</span> : null}</h2>
              </header>
              <div className="no-sec-body" inert={locked || undefined}>
                <div className="sec" data-sec={n}>
                  <div className="card one" id={n === 1 ? 'stepCard' : undefined}><div className="one-body"><View ctl={ctl} onPickFile={onPickFile} /></div></div>
                </div>
                {n === 1 ? <Need ctl={ctl} /> : null}
                {n === 4 ? <CreateFooter ctl={ctl} /> : null}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
