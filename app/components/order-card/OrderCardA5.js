'use client';

// כרטיס ההזמנה החדש (A5) — המעטפת. עיצוב מאושר: תצוגות-עיצוב/כרטיס-הזמנה.html (4.10.2026), רכיבי פלטה בלבד (design-system/),
// בלי שכבת הסקירה של הדגימה (pv-*, qpanel, סרגל הדגמה, snav/nbArea/siteFoot - A28). PLAN §D.
// שורש: .gm-ds.gm-oc.home-bg.dlg-dark - לעולם לא gm-home (הפלטה מגדירה את כרטיס ההזמנה כעור הבסיס .gm-ds:not(.gm-home));
// dlg-dark = חלונות תמיד כהים (A25). החלונות/הטוסט/הטולטיפ ב-portal לשורש (OcPortal). sprite מוטמע (#gmi-) פעם אחת.
// ה-CSS של כל הזרמים מיובא כאן ביום הראשון (כל זרם ממלא רק את הקובץ שלו).
import '@/design-system/components.css';
import './css/oc-base.css';
import './css/oc-details.css';
import './css/oc-items.css';
import './css/oc-payments.css';
import './css/oc-rail.css';
import './css/oc-history.css';
import './css/oc-docs.css';
import { useLayoutEffect, useRef, useState } from 'react';
import usePageTooltip from '@/app/components/profile/usePageTooltip';
import useOrderCardController from './useOrderCardController';
import { OcUiProvider, useOcUi } from './OcUi';
import { OcPortalRoot } from './OcPortal';
import { OcSprite } from './OcIcon';
import OcIcon from './OcIcon';
import OcTopbar from './OcTopbar';
import OcTabs from './OcTabs';
import OcStepper from './OcStepper';
import { TABS } from './tabs';
import { SLOTS } from './slots';

export default function OrderCardA5({ orderRef }) {
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const [portalEl, setPortalEl] = useState(null);
  // המעטפת A5 מטפלת בטולטיפים רק באזור הכותרת שלה - הכרטיס מטפל בשלו תמיד (כמו הפרופיל)
  usePageTooltip(rootRef, ttRef, false);
  return (
    <div className="gm-ds gm-oc home-bg dlg-dark" dir="rtl" ref={rootRef}>
      <OcSprite />
      <OcPortalRoot.Provider value={portalEl}>
        <OcUiProvider>
          <OrderCardBody orderRef={orderRef} />
        </OcUiProvider>
      </OcPortalRoot.Provider>
      <div className="oc-portal" ref={setPortalEl} />
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}

function StateBanner({ oc }) {
  // AMB-02: בלי צ׳יפ סטטוס בכותרת (R1) - באנר פלטה רק כשההזמנה מחוקה / טיוטה
  if (!oc.flags.isDeletedOrder && !oc.flags.isDraft) return null;
  const deleted = oc.flags.isDeletedOrder;
  return (
    <div className="nb-area oc-banner" data-oc-banner={deleted ? 'deleted' : 'draft'}>
      <div className="nb-w">
        <section className={`nb ${deleted ? 'nb-warning' : 'nb-info'}`} role="status" aria-labelledby="oc-state-t">
          <div className="nb-main">
            <div className="nb-head">
              <span className="nb-ic" aria-hidden="true"><OcIcon name={deleted ? 'trash' : 'file'} /></span>
              <div className="nb-msg">
                <b id="oc-state-t">{deleted ? 'הזמנה זו מחוקה' : 'הזמנה זו היא טיוטה'}</b>
                <span>{deleted ? 'ההזמנה בוטלה או שכל הפריטים בה הוסרו.' : 'ההזמנה נשמרה אוטומטית במסך הזמנה חדשה ולא הושלמה.'}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function OrderCardBody({ orderRef }) {
  const ui = useOcUi();
  const oc = useOrderCardController(orderRef, ui, { dialogs: SLOTS });
  const { Rail, DraftBanner, MoneyToast, TopBanners } = SLOTS;
  const mainRef = useRef(null);
  const railRef = useRef(null);
  // הרייל "סיכום" מתחיל בגובה הלוח הראשון (הסקשן הראשון מתחת לשורת הלשוניות), לא בגובה שורת הלשוניות - כמו fit() בעיצוב המאושר
  // (תצוגות-עיצוב/כרטיס-הזמנה.html: סקריפט "סרגל הסיכום מתחיל בגובה הלוח הראשון" + `.app .rail{margin-top:var(--rail-top,0px)}` מ-1024px;
  // הכלל בפלטה: design-system/components.css). נמדד מחדש בכל החלפת לשונית (MutationObserver על class) ובשינוי גודל; מתחת ל-1024px אין הסטה.
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
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(main);
    const mo = new MutationObserver(fit);
    mo.observe(main, { attributes: true, subtree: true, attributeFilter: ['class'] });
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', fit); };
  }, [oc.status, oc.tab]);
  return (
    <div className="app oc-app" id="app">
      <OcTopbar oc={oc} ui={ui} slots={SLOTS} />
      {/* ציר האירוע (.stepper) חזר בהערת הבעלים 2026-10-05 - בדיוק כמו renderTimeline() בעיצוב; נתוני אמת מה-journal (OcStepper) */}
      <OcStepper oc={oc} />
      {oc.status === 'loading' ? (
        <div className="layout oc-layout-msg"><main className="main"><div className="card oc-loading" role="status"><span className="spinner" aria-hidden="true" />טוען נתוני הזמנה...</div></main></div>
      ) : oc.status === 'notfound' ? (
        <div className="layout oc-layout-msg"><main className="main"><div className="card"><div className="empty" role="status"><OcIcon name="alert" size="lg" /><div className="oc-empty-t">הזמנה לא נמצאה</div></div></div></main></div>
      ) : (
        <>
          <StateBanner oc={oc} />
          <DraftBanner oc={oc} ui={ui} />
          <TopBanners oc={oc} ui={ui} />
          <div className="layout">
            <main className="main" ref={mainRef}>
              <OcTabs oc={oc} ui={ui} tabs={TABS} />
            </main>
            <aside className="rail" id="rail" aria-label="סיכום ההזמנה" ref={railRef}>
              <Rail oc={oc} ui={ui} />
            </aside>
          </div>
          <MoneyToast oc={oc} ui={ui} />
        </>
      )}
    </div>
  );
}
