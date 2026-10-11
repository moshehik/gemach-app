'use client';

// אשף "דגם חדש" החדש (A5) - טופס רציף "מקטע תחת מקטע" בדיוק כמו "הזמנה חדשה" ברצף (MnFlow.js; new-order/LayoutContinuous.js): פס התקדמות דק ונדבק + מקטעים
// 01-04 בקוביות .card.one, יצירת הדגם בתחתית המקטע האחרון. אין רייל "הדגם החדש" צדדי ואין "המשך" בין שלבים. העיצוב המאושר: תצוגות-עיצוב/עובדים-ודגמים/model-new.html;
// על התכונה האמיתית של האשף הישן (components/dresses/modern/ModernNewDressWizard.js): ר' useModelNewController.js.
// שורש: .gm-ds.gm-no.gm-mn.home-bg.dlg-dark - gm-no = פריסת המקטעים של ההזמנה החדשה (new-order/css/new-order.css), gm-mn = ה-CSS של הדף (בלי gm-home; חלונות תמיד כהים).
import '@/design-system/components.css';
import '../new-order/css/new-order-font.css';
import '../new-order/css/new-order.css';
import './css/model-new.css';
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HomeSprite } from '../home/HomeParts';
import PageVariantToggle from '../variant/PageVariantToggle';
import useCardTooltips from '../order-card/hooks/useCardTooltips';
import { Ic, MnSprite, NoPortal, NoPortalRoot } from './MnUi';
import { NoBanner } from '../new-order/NoUi';
import MnDialog from './MnDialogs';
import MnFlow from './MnFlow';
import { StepSaved } from './MnSteps';
import useModelNewController, { LIST_HREF } from './useModelNewController';

function SavedNav({ ctl }) {
  return (
    <div className="mn-nav">
      <button type="button" className="btn" data-act="to-card" onClick={ctl.goCard}><Ic n="dress" c="sm" />לכרטיס הדגם</button>
      <button type="button" className="btn primary" data-act="again" onClick={ctl.newAgain}><Ic n="plus" />דגם נוסף</button>
    </div>
  );
}

export default function ModelNewA5() {
  const router = useRouter();
  const ctl = useModelNewController({ router });
  const { S } = ctl;
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const fileRef = useRef(null);
  const [rootEl, setRootEl] = useState(null);
  const setRoot = useCallback((el) => { rootRef.current = el; setRootEl(el); }, []);
  useCardTooltips(rootRef, ttRef);
  const t = ctl.toast;
  const pickFile = useCallback(() => { if (fileRef.current) fileRef.current.click(); }, []);

  return (
    <div className="gm-ds gm-no gm-mn home-bg dlg-dark" dir="rtl" ref={setRoot}>
      <NoPortalRoot.Provider value={rootEl}>
        <HomeSprite />
        <MnSprite />
        <div className="app mn-app no-app no-flowapp" id="app">
          <div className="topbar">
            <button type="button" className="back" data-act="exit" aria-label="חזרה לרשימת הדגמים" data-tip="חזרה לרשימת הדגמים" onClick={ctl.exit} disabled={S.busy}><Ic n="back" /></button>
            <div className="ttl"><h1><small>דגמים</small>דגם חדש</h1></div>
            <div className="tools"><PageVariantToggle screen="model_new" placement="header" systemTip /></div>
          </div>
          {ctl.head === false ? <NoBanner id="mn-noperm" title="יצירת דגם שמורה להנהלה ראשית" text="אפשר למלא את הטופס, אך השרת יאפשר את היצירה רק להנהלה ראשית / מתכנת" rows={[]} /> : null}
          {!ctl.ready ? (
            <div className="layout"><main className="main"><div className="card mn-loading mn-banner" role="status"><span className="spinner" aria-hidden="true" />טוען...</div></main></div>
          ) : (
            S.saved ? (
              <div className="layout">
                <main className="main">
                  <div className="hero-t"><h2 className="hero-q" id="mnHero">הדגם נוצר</h2></div>
                  <div id="stepWrap"><div className="card one" id="stepCard"><div className="one-body"><StepSaved ctl={ctl} /></div></div></div>
                  <div id="navBot"><SavedNav ctl={ctl} /></div>
                </main>
              </div>
            ) : <MnFlow ctl={ctl} onPickFile={pickFile} />
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
