'use client';

// אשף "דגם חדש" החדש (A5) - העיצוב המאושר תצוגות-עיצוב/עובדים-ודגמים/model-new.html (scratch/emp-models-build/model-new.js), במבנה האשף "הזמנה חדשה"
// (פסי התקדמות, שאלת השלב, קוביית שלב אחת, שורת ניווט מעל ומתחת) + רייל "הדגם החדש" כמו כרטיס הזמנה. על התכונה האמיתית של האשף הישן
// (components/dresses/modern/ModernNewDressWizard.js): ר' useModelNewController.js. שורש: .gm-ds.gm-mn.home-bg.dlg-dark (בלי gm-home; חלונות תמיד כהים).
import '@/design-system/components.css';
import '../new-order/css/new-order-font.css';
import './css/model-new.css';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HomeSprite } from '../home/HomeParts';
import PageVariantToggle from '../variant/PageVariantToggle';
import useCardTooltips from '../order-card/hooks/useCardTooltips';
import { Ic, MnSprite, NoPortal, NoPortalRoot } from './MnUi';
import { NoBanner } from '../new-order/NoUi';
import MnDialog from './MnDialogs';
import MnRail from './MnRail';
import { StepIdentity, StepMedia, StepSaved, StepStock, StepSummary } from './MnSteps';
import useModelNewController, { LIST_HREF } from './useModelNewController';
import { recapOf } from './modelNewLogic';

function ProgressBars({ ctl }) {
  const { S } = ctl;
  return (
    <div className="pbars" id="pbars" aria-label="התקדמות יצירת הדגם">
      {ctl.steps.map((s, i) => {
        const n = i + 1;
        const cur = !S.saved && S.step === n;
        const done = !!S.saved || n < S.step;
        const can = !S.saved && !cur && (n === 1 || ctl.step1Ok);
        const t = done ? `חזרה לשלב ${s.l}` : `מעבר לשלב ${s.l}`;
        const rc = done ? recapOf(n, { d: S.d, items: S.items, useModelNames: ctl.useModelNames }) : null;
        const go = can ? {
          'data-go': n, role: 'button', tabIndex: 0, 'data-tip': t, 'aria-label': t,
          onClick: () => ctl.go(n),
          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctl.go(n); } },
        } : {};
        return (
          <div key={n} className={`pb ${done ? 'done' : cur ? 'cur' : 'fut'}`} {...go}>
            <div className="pb-bar" role="progressbar" aria-label={s.l} aria-valuemin={0} aria-valuemax={1} aria-valuenow={done ? 1 : 0}><i /></div>
            {done ? (
              <div className="pb-d"><Ic n={s.i} c="sm" /><span className="pb-t"><b>{n === 1 ? <><bdi>#{rc.code}</bdi>{rc.name ? ` · ${rc.name}` : ''}</> : rc}</b></span></div>
            ) : <span className="pb-d ph" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

function Nav({ ctl }) {
  const { S } = ctl;
  if (S.saved) {
    return (
      <div className="mn-nav">
        <button type="button" className="btn" data-act="to-card" onClick={ctl.goCard}><Ic n="dress" c="sm" />לכרטיס הדגם</button>
        <button type="button" className="btn primary" data-act="again" onClick={ctl.newAgain}><Ic n="plus" />דגם נוסף</button>
      </div>
    );
  }
  const busy = S.busy;
  const last = S.step === 4;
  const ok = ctl.step1Ok && ctl.head !== false;
  const tip = ok ? undefined : (ctl.head === false ? 'יצירת דגם שמורה להנהלה ראשית' : `יש להשלים: ${ctl.missing.join(', ')}`);
  return (
    <div className="mn-nav">
      {S.step > 1 ? <button type="button" className="btn" data-act="prev" disabled={busy} onClick={() => ctl.go(S.step - 1)}><Ic n="arrr" />חזור</button> : null}
      <button type="button" className="btn ghost" data-act="exit" disabled={busy} onClick={ctl.exit}><Ic n="x" c="sm" />ביטול</button>
      <span className="mn-gap" />
      <span className="tipw" data-tip={tip}>
        {last
          ? <button type="button" className="btn primary" data-act="create" disabled={!ok || busy} onClick={ctl.create}><Ic n="check" />יצירת הדגם</button>
          : <button type="button" className="btn primary" data-act="next" disabled={!ok || busy} onClick={() => ctl.go(S.step + 1)}><Ic n="arrl" />המשך</button>}
      </span>
    </div>
  );
}

function Need({ ctl }) {
  const { S } = ctl;
  const show = !S.saved && S.step === 1 && ctl.missing.length > 0;
  return <div id="mnNeed" className={show ? 'mn-need' : undefined}>{show ? <><Ic n="alert" c="sm" /><span>יש להשלים: {ctl.missing.join(', ')}</span></> : null}</div>;
}

export default function ModelNewA5() {
  const router = useRouter();
  const ctl = useModelNewController({ router });
  const { S } = ctl;
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const mainRef = useRef(null);
  const railRef = useRef(null);
  const fileRef = useRef(null);
  const [rootEl, setRootEl] = useState(null);
  const setRoot = useCallback((el) => { rootRef.current = el; setRootEl(el); }, []);
  useCardTooltips(rootRef, ttRef);
  const t = ctl.toast;
  const Step = useMemo(() => (S.saved ? StepSaved : [StepIdentity, StepMedia, StepStock, StepSummary][S.step - 1]), [S.saved, S.step]);
  const pickFile = useCallback(() => { if (fileRef.current) fileRef.current.click(); }, []);
  const hero = S.saved ? 'הדגם נוצר' : ctl.steps[S.step - 1].q;

  // הרייל מתחיל בגובה קוביית השלב (מתחת לפסים ולשאלה), לא בגובה הפסים; רייל גבוה מהחלון נדבק כך שהתחתית שלו נראית - כמו fit() / tall() בעיצוב
  useLayoutEffect(() => {
    const main = mainRef.current;
    const rail = railRef.current;
    if (!main || !rail) return undefined;
    const fit = () => {
      const c = document.getElementById('stepCard');
      if (!c || window.innerWidth < 1024) { rail.style.removeProperty('--rail-top'); return; }
      rail.style.setProperty('--rail-top', `${Math.max(0, Math.round(c.getBoundingClientRect().top - main.getBoundingClientRect().top))}px`);
    };
    const tall = () => {
      if (window.innerWidth < 1024) { rail.style.removeProperty('top'); return; }
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gm-snav-h')) || 0;
      rail.style.top = `${Math.min(navH + 16, window.innerHeight - rail.offsetHeight - 16)}px`;
    };
    const both = () => { fit(); tall(); };
    both();
    const ro = new ResizeObserver(both); ro.observe(main);
    const rro = new ResizeObserver(tall); rro.observe(rail);
    const mo = new MutationObserver(fit); mo.observe(main, { childList: true, subtree: true });
    const rmo = new MutationObserver(tall); rmo.observe(rail, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', both);
    return () => { ro.disconnect(); rro.disconnect(); mo.disconnect(); rmo.disconnect(); window.removeEventListener('resize', both); rail.style.removeProperty('top'); };
  }, [ctl.ready]);

  return (
    <div className="gm-ds gm-mn home-bg dlg-dark" dir="rtl" ref={setRoot}>
      <NoPortalRoot.Provider value={rootEl}>
        <HomeSprite />
        <MnSprite />
        <div className="app mn-app" id="app">
          <div className="topbar">
            <button type="button" className="back" data-act="exit" aria-label="חזרה לרשימת הדגמים" data-tip="חזרה לרשימת הדגמים" onClick={ctl.exit} disabled={S.busy}><Ic n="back" /></button>
            <div className="ttl"><h1><small>דגמים</small>דגם חדש</h1></div>
            <div className="tools"><PageVariantToggle screen="model_new" placement="header" systemTip /></div>
          </div>
          {ctl.head === false ? <NoBanner id="mn-noperm" title="יצירת דגם שמורה להנהלה ראשית" text="אפשר למלא את הטופס, אך השרת יאפשר את היצירה רק להנהלה ראשית / מתכנת" rows={[]} /> : null}
          {!ctl.ready ? (
            <div className="layout"><main className="main"><div className="card mn-loading mn-banner" role="status"><span className="spinner" aria-hidden="true" />טוען...</div></main></div>
          ) : (
            <>
              <ProgressBars ctl={ctl} />
              <div className="layout">
                <main className="main" ref={mainRef}>
                  <div className="hero-t"><h2 className="hero-q" id="mnHero">{hero}</h2></div>
                  <div id="navTop"><Nav ctl={ctl} /></div>
                  <div id="stepWrap"><div className="card one" id="stepCard"><div className="one-body"><Step ctl={ctl} onPickFile={pickFile} /></div></div></div>
                  <Need ctl={ctl} />
                  <div id="navBot"><Nav ctl={ctl} /></div>
                </main>
                <aside className={`rail${S.cartOpen ? ' open' : ''}`} id="rail" aria-label="סיכום הדגם החדש" ref={railRef}>
                  <MnRail ctl={ctl} />
                </aside>
              </div>
            </>
          )}
          <input type="file" id="mnFile" accept="image/*" hidden ref={fileRef} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) ctl.uploadImage(f); }} />
        </div>
        <NoPortal>
          {t ? (
            <div id="toast" className="info on pulse" data-kind={t.kind} role="status" aria-live="polite" key={t.n}>
              <button type="button" className="tclose" data-tip="סגור" aria-label="סגירה" onClick={() => ctl.setToast(null)}><Ic n="x" c="sm" /></button>
              <div className="tb"><Ic n={t.kind === 'ok' ? 'check' : t.kind === 'warn' ? 'alert' : 'info'} c="lg" /></div>
              <div><b>{t.big}</b><small>{t.small || ''}</small></div>
            </div>
          ) : null}
          <MnDialog ctl={ctl} />
        </NoPortal>
        <div className="pl-tt" role="tooltip" ref={ttRef} />
      </NoPortalRoot.Provider>
    </div>
  );
}

export { LIST_HREF };
