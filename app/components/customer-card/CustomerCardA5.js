'use client';

// כרטיס הלקוח החדש (A5) — עיצוב מאושר: תצוגות-עיצוב/כרטיס-לקוח.html + תשובות הבעלים 4.10.2026
// (scratch/customer-card-build/answers-customercard.json; ההחלטות וההנחות: scratch/customer-card-build/NOTES.md).
// רכיבי פלטה בלבד (design-system/), בלי שכבת הסקירה של הדגימה (QPanel, סרגל הדגמה, snav/nbArea/siteFoot).
// שורש: .gm-ds.gm-cc.home-bg.dlg-dark - לעולם לא gm-home (הפלטה מגדירה את עור הכרטיסים כבסיס .gm-ds:not(.gm-home));
// dlg-dark = חלונות תמיד כהים (הבעלים: "בעיצוב הכהה החדש"). החלונות/הטוסט/הטולטיפים ב-portal לשורש (CcPortal).

import '@/design-system/components.css';
import './customer-card.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getHebrewDateString } from '@/lib/hebrewDate';
import usePageTooltip from '@/app/components/profile/usePageTooltip';
import { missingRequiredFields, requiredFieldLabel } from '@/lib/customerRequiredFields';
import CcIcon, { CcSprite } from './CcIcon';
import { CcPortalRoot } from './CcPortal';
import { CcUiProvider, useCcUi } from './CcUi';
import CcTopbar from './CcTopbar';
import CcRail from './CcRail';
import CcRich, { RichLine } from './CcRich';
import useCustomerCard from './useCustomerCard';
import useFreshKeys from './useFreshKeys';
import { orderEventIso, orderRequired, signatureState, sortOrders } from './customerCardLogic';
import CcDetailsTab from './tabs/CcDetailsTab';
import CcOrdersTab from './tabs/CcOrdersTab';
import CcPaymentsTab from './tabs/CcPaymentsTab';
import CcHistoryTab from './tabs/CcHistoryTab';

export const TAB_DEFS = [
  { id: 'details', label: 'פרטים', icon: 'user' },
  { id: 'orders', label: 'הזמנות', icon: 'file' },
  { id: 'payments', label: 'תשלומים', icon: 'card' },
  { id: 'history', label: 'היסטוריה', icon: 'clock' },
];
const TABS = { details: CcDetailsTab, orders: CcOrdersTab, payments: CcPaymentsTab, history: CcHistoryTab };
const money = (n) => `₪${Math.abs(Number(n) || 0).toLocaleString('he-IL')}`;

export default function CustomerCardA5({ customerId }) {
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const [portalEl, setPortalEl] = useState(null);
  // המעטפת A5 מטפלת בטולטיפים רק באזור הכותרת שלה - הכרטיס מטפל בשלו תמיד (כמו הפרופיל וכרטיס ההזמנה)
  usePageTooltip(rootRef, ttRef, false);
  return (
    <div className="gm-ds gm-cc home-bg dlg-dark" dir="rtl" ref={rootRef}>
      <CcSprite />
      <CcPortalRoot.Provider value={portalEl}>
        <CcUiProvider>
          <CardBody customerId={customerId} rootRef={rootRef} />
        </CcUiProvider>
      </CcPortalRoot.Provider>
      <div className="cc-portal" ref={setPortalEl} />
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}

// לקוח חסום (J5 ב': בפס ההודעות הגלובלי בראש הדף, לא בתוך לשונית פרטים). "ביטול חסימה" רק להנהלה ראשית - השרת בודק שוב.
function BlockedBanner({ cc }) {
  if (!cc.saved || !cc.saved.isBlocked) return null;
  return (
    <div className="nb-area cc-banner">
      <div className="nb-w">
        <section className="nb nb-warning" role="alert" aria-labelledby="cc-blk-t">
          <div className="nb-main">
            <div className="nb-head">
              <span className="nb-ic" aria-hidden="true"><CcIcon name="alert" /></span>
              <div className="nb-msg"><b id="cc-blk-t">לקוח חסום מהזמנות חדשות</b><span>{cc.saved.blockedReason || 'לא צוינה סיבה'}</span></div>
            </div>
            {cc.isHeadManagement ? <button type="button" className="nb-go" onClick={cc.unblock}>ביטול חסימה</button> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

// לקוחה שנמחקה: פס "נמחק" בראש הדף; הכרטיס לצפייה בלבד (בלי עריכה / מחיקה / תשלום)
function DeletedBanner({ cc }) {
  if (!cc.readOnly) return null;
  return (
    <div className="nb-area cc-banner">
      <div className="nb-w">
        <section className="nb nb-warning" role="status" aria-labelledby="cc-del-t">
          <div className="nb-main">
            <div className="nb-head">
              <span className="nb-ic" aria-hidden="true"><CcIcon name="trash" /></span>
              <div className="nb-msg"><b id="cc-del-t">כרטיס הלקוח נמחק</b><span>הכרטיס הוסר מרשימת הלקוחות ומוצג לצפייה בלבד</span></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Tabs({ cc, ui }) {
  // סמן "fresh" רק בהופעה הראשונה של כל סמן (כמו __tabMk בעיצוב); נעלם ומופיע שוב = fresh שוב
  const [freshMk, clearMk] = useFreshKeys(Object.values(cc.markers).map((m) => m.key), { initialFresh: true });
  const ids = TAB_DEFS.map((t) => t.id);
  const onKey = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = ids.indexOf(cc.tab);
    let n = i;
    if (e.key === 'ArrowLeft') n = Math.min(ids.length - 1, i + 1);
    if (e.key === 'ArrowRight') n = Math.max(0, i - 1);
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = ids.length - 1;
    cc.setTab(ids[n]);
    setTimeout(() => { const b = document.getElementById(`cc-tab-${ids[n]}`); if (b) b.focus(); }, 0);
  };
  return (
    <>
      <nav className="tabs" id="tabs" role="tablist" aria-label="לשוניות כרטיס הלקוח" onKeyDown={onKey}>
        {TAB_DEFS.map((t) => {
          const m = cc.markers[t.id];
          const on = cc.tab === t.id;
          return (
            <button key={t.id} type="button" id={`cc-tab-${t.id}`} className={`tab${on ? ' on' : ''}`} role="tab" aria-selected={on} aria-controls={`p-${t.id}`} tabIndex={on ? 0 : -1} data-tab={t.id} onClick={() => cc.setTab(t.id)}>
              <span className="tico">
                <CcIcon name={t.icon} />
                {t.id === 'orders' ? <span className="cnt">{(cc.cur.orders || []).length}</span> : null}
                {m ? <span className={`tabmk ${m.cls}${freshMk.has(m.key) ? ' fresh' : ''}`} data-tip={m.tip} role="img" aria-label={m.tip} onAnimationEnd={(e) => { if (e.target === e.currentTarget) clearMk(m.key); }}><CcIcon name={m.icon} size="sm" anim={false} /></span> : null}
              </span>
              {t.label}
            </button>
          );
        })}
      </nav>
      {TAB_DEFS.map((t) => {
        const Tab = TABS[t.id];
        const on = cc.tab === t.id;
        return (
          <section key={t.id} className={`panel${on ? ' on' : ''}`} id={`p-${t.id}`} role="tabpanel" aria-labelledby={`cc-tab-${t.id}`} hidden={!on}>
            <Tab cc={cc} ui={ui} active={on} />
          </section>
        );
      })}
    </>
  );
}

// כרטיסי הריחוף העשירים (railrich): חתימה, הזמנות, תשלום, פרטים, ושורת שינוי במסילה
function useRichRender(cc) {
  return function renderRichSpec(spec) {
    if (!cc.cur) return null;
    const k = spec.indexOf('|');
    const t = k < 0 ? spec : spec.slice(0, k);
    const arg = k < 0 ? '' : spec.slice(k + 1);
    if (t === 'sig') {
      const s = signatureState(cc.cur);
      return s.signed
        ? <RichLine icon="note">{`נחתם בהזמנה #${s.orderId}${s.at ? ` · ${getHebrewDateString(s.at)}` : ''}`}</RichLine>
        : <RichLine icon="x">לא נחתם באף הזמנה</RichLine>;
    }
    if (t === 'orders') {
      const list = sortOrders(cc.cur.orders || []).slice(0, 6);
      if (!list.length) return <RichLine icon="file">אין הזמנות</RichLine>;
      const today = new Date();
      return list.map((o) => {
        const ev = orderEventIso(o);
        const icon = o.isDeleted ? 'x' : (ev && new Date(ev) < today ? 'check' : 'clock');
        return <RichLine key={o.id} icon={icon}>{`#${o.orderId} · ${ev ? getHebrewDateString(ev) : '—'} · ${money(orderRequired(o))}`}</RichLine>;
      });
    }
    if (t === 'pay') {
      const pays = (cc.cur.orders || []).flatMap((o) => (o.payments || []).map((p) => ({ ...p, orderId: o.orderId })))
        .sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0)).slice(0, 4);
      const bal = cc.account.balance;
      return (
        <>
          {pays.map((p) => <RichLine key={p.id} icon="card">{`${p.paymentDate ? getHebrewDateString(p.paymentDate) : ''} · ${p.paymentMethod || ''} · ${money(p.amount)}`}</RichLine>)}
          {bal ? <RichLine icon={bal > 0 ? 'alert' : 'undo'}>{bal > 0 ? `חוב ${money(bal)}` : `זיכוי ${money(bal)}`}</RichLine> : <RichLine icon="check">אין יתרה פתוחה</RichLine>}
        </>
      );
    }
    if (t === 'det') {
      const m = missingRequiredFields(cc.cur, cc.requiredKeys);
      return m.length ? m.map((x) => <RichLine key={x} icon="alert">{`חסר: ${requiredFieldLabel(x)}`}</RichLine>) : <RichLine icon="check">כל פרטי החובה מולאו</RichLine>;
    }
    if (t === 'chg') {
      const c = cc.changes.find((x) => x.key === arg);
      return c ? <RichLine icon={c.icon}>{`${c.old} ← ${c.nw}`}</RichLine> : null;
    }
    return null;
  };
}

function CardBody({ customerId, rootRef }) {
  const ui = useCcUi();
  const cc = useCustomerCard(customerId, ui);
  const [cartOpen, setCartOpen] = useState(false);
  const mainRef = useRef(null);
  const railRef = useRef(null);
  const richRender = useRichRender(cc);

  // המסילה מתחילה בגובה הלוח הראשון (מתחת ללשוניות) במסך רחב - כמו fit() בעיצוב
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
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [cc.status, cc.tab]);

  return (
    <div className="app cc-app" id="app">
      {cc.status === 'ready' ? <DeletedBanner cc={cc} /> : null}
      {cc.status === 'ready' ? <BlockedBanner cc={cc} /> : null}
      <CcTopbar cc={cc} />
      {cc.status === 'loading' ? (
        <div className="layout cc-layout-msg"><main className="main"><div className="card cc-loading" role="status"><span className="spinner" aria-hidden="true" />טוען נתוני לקוח...</div></main></div>
      ) : cc.status !== 'ready' ? (
        <div className="layout cc-layout-msg"><main className="main"><div className="card"><div className="empty" role="status"><CcIcon name="alert" size="lg" /><div className="cc-empty-t">{cc.status === 'notfound' ? 'הלקוח לא נמצא' : 'שגיאה בטעינת הלקוח'}</div></div></div></main></div>
      ) : (
        <div className="layout">
          <main className="main" ref={mainRef}>
            <Tabs cc={cc} ui={ui} />
          </main>
          <aside className={`rail${cartOpen ? ' open' : ''}`} id="rail" aria-label="סיכום כרטיס הלקוח" ref={railRef}>
            <CcRail cc={cc} open={cartOpen} setOpen={setCartOpen} />
          </aside>
        </div>
      )}
      <CcRich rootRef={rootRef} render={richRender} />
    </div>
  );
}
