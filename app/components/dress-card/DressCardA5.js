'use client';

// כרטיס הדגם החדש (A5) - המעטפת. עיצוב מאושר: תצוגות-עיצוב/עובדים-ודגמים/model-card.html (9.10.2026), במבנה של כרטיס ההזמנה החי
// (app/components/order-card): topbar + שורת סריקה + לשוניות עם סמני התראה + רייל "סיכום" / "שינויים בכרטיס" + חלונות כהים (OcUi).
// השורש: .gm-ds.gm-oc.gm-dc.home-bg.dlg-dark - gm-oc כדי לרשת את הנטרולים של ה-CSS הגלובלי ואת החלונות הכהים של כרטיס ההזמנה
// (order-card/css/oc-base.css + oc-rail.css, מיובאים כאן), gm-dc לגלו של הכרטיס הזה (css/dress-card.css).
import '@/design-system/components.css';
import '../order-card/css/oc-base.css';
import '../order-card/css/oc-rail.css';
import './css/dress-card.css';
import { useLayoutEffect, useRef, useState } from 'react';
import useCardTooltips from '../order-card/hooks/useCardTooltips';
import useIconAnim from '../order-card/hooks/useIconAnim';
import { OcUiProvider, useOcUi } from '../order-card/OcUi';
import { OcPortalRoot } from '../order-card/OcPortal';
import OcIcon, { OcSprite } from '../order-card/OcIcon';
import { useA5Sprite } from '../a5-list/A5Icon';
import useDressCard from './useDressCard';
import DcTopbar from './DcTopbar';
import DcTabs from './DcTabs';
import DcRail from './DcRail';

export default function DressCardA5({ dressId }) {
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const [portalEl, setPortalEl] = useState(null);
  useCardTooltips(rootRef, ttRef);
  useIconAnim(rootRef);
  useA5Sprite(); // ban / hash / store - אייקונים שהעיצוב צייר ואין ב-sprite של הפלטה (אותה הטמעה כמו מסכי הרשימות)
  return (
    <div className="gm-ds gm-oc gm-dc home-bg dlg-dark" dir="rtl" ref={rootRef}>
      <OcSprite />
      <OcPortalRoot.Provider value={portalEl}>
        <OcUiProvider>
          <DressCardBody dressId={dressId} />
        </OcUiProvider>
      </OcPortalRoot.Provider>
      <div className="oc-portal" ref={setPortalEl} />
      <div className="pl-tt" id="oc-pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}

function StateBanner({ dc }) {
  if (!dc.cur || !dc.cur.model.isDeleted) return null;
  return (
    <div className="nb-area oc-banner" data-oc-banner="deleted">
      <div className="nb-w">
        <section className="nb nb-warning" role="status" aria-labelledby="dc-state-t">
          <div className="nb-main">
            <div className="nb-head">
              <span className="nb-ic" aria-hidden="true"><OcIcon name="trash" /></span>
              <div className="nb-msg">
                <b id="dc-state-t">הדגם מחוק</b>
                <span>מחיקה רכה - אפשר לשחזר אותו מלחצן השחזור בשורת הכלים.</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DressCardBody({ dressId }) {
  const ui = useOcUi();
  const dc = useDressCard(dressId, ui);
  const mainRef = useRef(null);
  const railRef = useRef(null);
  // הרייל מתחיל בגובה הכרטיס הראשון של הלוח הפעיל (מתחת ללשוניות), ורייל גבוה מהחלון נדבק כך שהתחתית שלו נראית - אותו חישוב כמו OrderCardA5
  useLayoutEffect(() => {
    const main = mainRef.current;
    const rail = railRef.current;
    if (!main || !rail) return undefined;
    const fit = () => {
      const p = main.querySelector('.panel.on');
      if (!p || window.innerWidth < 1024) { rail.style.removeProperty('--rail-top'); return; }
      const top = p.getBoundingClientRect().top - main.getBoundingClientRect().top;
      rail.style.setProperty('--rail-top', `${Math.max(0, Math.round(top))}px`);
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
    const mo = new MutationObserver(fit); mo.observe(main, { attributes: true, subtree: true, attributeFilter: ['class'] });
    const rmo = new MutationObserver(tall); rmo.observe(rail, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', both);
    return () => { ro.disconnect(); rro.disconnect(); mo.disconnect(); rmo.disconnect(); window.removeEventListener('resize', both); rail.style.removeProperty('top'); };
  }, [dc.status, dc.tab]);

  return (
    <div className="app oc-app dc-app" id="app">
      <DcTopbar dc={dc} ui={ui} />
      {dc.status === 'loading' ? (
        <div className="layout oc-layout-msg"><main className="main"><div className="card oc-loading" role="status"><span className="spinner" aria-hidden="true" />טוען כרטיס דגם...</div></main></div>
      ) : dc.status === 'notfound' || !dc.cur ? (
        <div className="layout oc-layout-msg"><main className="main"><div className="card"><div className="empty" role="status"><OcIcon name="alert" size="lg" /><div className="oc-empty-t">הדגם לא נמצא</div></div></div></main></div>
      ) : (
        <>
          <StateBanner dc={dc} />
          <div className="layout">
            <main className="main" ref={mainRef}>
              <DcTabs dc={dc} ui={ui} />
            </main>
            <aside className="rail" id="rail" aria-label="סיכום הדגם" ref={railRef} data-guide-id="dc.rail">
              <DcRail dc={dc} ui={ui} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
