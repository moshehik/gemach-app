'use client';

// DcTabs - שורת הלשוניות של כרטיס הדגם + סמני ההתראה + הלוחות. כמו OcTabs: <nav class="tabs"> > button.tab > span.tico (אייקון + סמן .tabmk) + שם.
// לשוניות לפי העיצוב: פרטים · פריטים · השכרות · היסטוריה. סמנים - התראה בלבד (בלי מונים): "פריטים" כשיש פריט שדורש טיפול, "השכרות" כשיש השכרה
// שממתינה להחזרה. "fresh" (הנפשת כניסה) רק בהופעה הראשונה של הסמן.
import { useEffect, useState } from 'react';
import OcIcon from '../order-card/OcIcon';
import DcDetailsTab from './tabs/DcDetailsTab';
import DcItemsTab from './tabs/DcItemsTab';
import DcRentalsTab from './tabs/DcRentalsTab';
import DcHistoryTab from './tabs/DcHistoryTab';

export const TAB_DEFS = [
  { id: 'details', label: 'פרטים', icon: 'dress' },
  { id: 'items', label: 'פריטים', icon: 'box' },
  { id: 'rentals', label: 'השכרות', icon: 'bag' },
  { id: 'history', label: 'היסטוריה', icon: 'clock' },
];
const PANELS = { details: DcDetailsTab, items: DcItemsTab, rentals: DcRentalsTab, history: DcHistoryTab };

export default function DcTabs({ dc, ui }) {
  const [seen, setSeen] = useState({});
  const markers = dc.markers || {};
  const markerKeys = Object.values(markers).filter(Boolean).map((m) => m.key).sort().join('|');
  const freshNow = {};
  Object.values(markers).filter(Boolean).forEach((m) => { freshNow[m.key] = !seen[m.key]; });
  useEffect(() => {
    const next = {};
    markerKeys.split('|').filter(Boolean).forEach((k) => { next[k] = 1; });
    setSeen((prev) => (Object.keys(prev).sort().join('|') === markerKeys ? prev : next));
  }, [markerKeys]);

  const ids = TAB_DEFS.map((t) => t.id);
  const onKey = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = ids.indexOf(dc.tab);
    let n = i;
    if (e.key === 'ArrowLeft') n = Math.min(ids.length - 1, i + 1); // RTL: חץ שמאלה = הלשונית הבאה
    if (e.key === 'ArrowRight') n = Math.max(0, i - 1);
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = ids.length - 1;
    dc.setTab(ids[n]);
    setTimeout(() => { const b = document.getElementById(`dc-tab-${ids[n]}`); if (b) b.focus(); }, 0);
  };
  return (
    <>
      <nav className="tabs" id="tabs" role="tablist" aria-label="כרטיס דגם" onKeyDown={onKey}>
        {TAB_DEFS.map((t) => {
          const m = markers[t.id];
          const on = dc.tab === t.id;
          return (
            <button key={t.id} type="button" id={`dc-tab-${t.id}`} className={`tab${on ? ' on' : ''}`} role="tab" aria-selected={on} aria-controls={`p-${t.id}`} tabIndex={on ? 0 : -1} data-tab={t.id} onClick={() => dc.setTab(t.id)}>
              <span className="tico">
                <OcIcon name={t.icon} />
                {m ? <span className={`tabmk ${m.cls}${freshNow[m.key] ? ' fresh' : ''}`} data-tip={m.tip} role="img" aria-label={m.tip}><OcIcon name={m.icon} size="sm" /></span> : null}
              </span>
              {t.label}
            </button>
          );
        })}
      </nav>
      {TAB_DEFS.map((t) => {
        const Panel = PANELS[t.id];
        const on = dc.tab === t.id;
        return (
          <section key={t.id} className={`panel${on ? ' on' : ''}`} id={`p-${t.id}`} role="tabpanel" aria-labelledby={`dc-tab-${t.id}`} hidden={!on}>
            <Panel dc={dc} ui={ui} active={on} />
          </section>
        );
      })}
    </>
  );
}
