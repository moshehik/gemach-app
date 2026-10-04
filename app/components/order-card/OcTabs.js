'use client';

// OcTabs — שורת הלשוניות של כרטיס ההזמנה + סמני הלשוניות (A6) + הלוחות. כמו renderTabs בעיצוב (כרטיס-הזמנה.html):
// <nav class="tabs" role="tablist"><button class="tab [tdel] [on]" role="tab"><span class="tico">אייקון + מונה/סמן</span>שם</button>…
// הסמן: <span class="tabmk debt|ok|cred [fresh]" data-tip role="img">; "fresh" רק בהופעה הראשונה של הסמן (הנפשת הכניסה).
// לשונית "משלוח" רק כש-enable_deliveries וגם delivery_separate_tab (R49/W2b; אחרת המשלוח בתוך "פרטים"). תוכן הלשוניות מ-tabs/index.js.
import { useEffect, useState } from 'react';
import OcIcon from './OcIcon';
import { tabMarkers } from './orderCardLogic';

export const TAB_DEFS = [
  { id: 'details', label: 'פרטים', icon: 'user' },
  { id: 'items', label: 'פריטים', icon: 'dress' },
  { id: 'delivery', label: 'משלוח', icon: 'truck', cls: 'tdel' },
  { id: 'payments', label: 'תשלומים', icon: 'card' },
  { id: 'history', label: 'היסטוריה', icon: 'clock' },
];

export const visibleTabIds = (settings) => TAB_DEFS
  .filter(t => t.id !== 'delivery' || (settings.enableDeliveries && settings.deliverySeparateTab))
  .map(t => t.id);

export default function OcTabs({ oc, ui, tabs }) {
  const [seen, setSeen] = useState({});
  const visible = visibleTabIds(oc.settings);
  const markers = tabMarkers({ order: oc.order, totals: oc.totals, settings: oc.settings });
  const activeCount = oc.items.filter(i => !i.isDeleted).length;
  const current = visible.includes(oc.tab) ? oc.tab : visible[0];

  // סמן "חדש" רק פעם אחת לכל מפתח; כשהסמן נעלם הוא יקבל fresh שוב בהופעה הבאה (כמו __tabMk בעיצוב)
  const markerKeys = Object.values(markers).map(m => m.key).sort().join('|');
  const freshNow = {};
  Object.values(markers).forEach(m => { freshNow[m.key] = !seen[m.key]; });
  useEffect(() => {
    const next = {};
    markerKeys.split('|').filter(Boolean).forEach(k => { next[k] = 1; });
    setSeen(prev => (Object.keys(prev).sort().join('|') === markerKeys ? prev : next));
  }, [markerKeys]);

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = visible.indexOf(current);
    // RTL: חץ שמאלה = הלשונית הבאה
    let n = i;
    if (e.key === 'ArrowLeft') n = Math.min(visible.length - 1, i + 1);
    if (e.key === 'ArrowRight') n = Math.max(0, i - 1);
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = visible.length - 1;
    oc.setTab(visible[n]);
    setTimeout(() => { const b = document.getElementById(`oc-tab-${visible[n]}`); b && b.focus(); }, 0);
  };

  return (
    <>
      <nav className="tabs" id="tabs" role="tablist" aria-label="לשוניות ההזמנה" onKeyDown={onKey}>
        {TAB_DEFS.filter(t => visible.includes(t.id)).map(t => {
          const m = markers[t.id];
          const on = current === t.id;
          return (
            <button
              key={t.id}
              type="button"
              id={`oc-tab-${t.id}`}
              className={`tab${t.cls ? ` ${t.cls}` : ''}${on ? ' on' : ''}`}
              role="tab"
              aria-selected={on}
              aria-controls={`p-${t.id}`}
              tabIndex={on ? 0 : -1}
              data-tab={t.id}
              onClick={() => oc.setTab(t.id)}
            >
              <span className="tico">
                <OcIcon name={t.icon} />
                {t.id === 'items' ? <span className="cnt">{activeCount}</span> : null}
                {m ? <span className={`tabmk ${m.cls}${freshNow[m.key] ? ' fresh' : ''}`} data-tip={m.tip} role="img" aria-label={m.tip}><OcIcon name={m.icon} size="sm" /></span> : null}
              </span>
              {t.label}
            </button>
          );
        })}
      </nav>
      {TAB_DEFS.filter(t => visible.includes(t.id)).map(t => {
        const Tab = tabs[t.id];
        const on = current === t.id;
        return (
          <section key={t.id} className={`panel${on ? ' on' : ''}`} id={`p-${t.id}`} role="tabpanel" aria-labelledby={`oc-tab-${t.id}`} hidden={!on}>
            {Tab ? <Tab oc={oc} ui={ui} active={on} /> : null}
          </section>
        );
      })}
    </>
  );
}
