'use client';

// מדריך האתר: guide ("ol" / "cl" - lib/aiGuide/areas/ops.targets.js) מוסיף data-guide-id לחץ החזרה (ol.back / cl.back).
// A5ListPage - כותרת וקליפת הדף האחידה של כל מסכי הרשימות החדשים (11.10.2026, דרישת הבעלים: "כותרת אחידה בכל דפי A5"): אותו מיקום חץ החזרה / h1 / <small> / שדה החיפוש
// (חצי רוחב מתחת לכותרת) / הכרטיס, בדיוק כמו /admin/orders-list. זו אותה מבנה (.app > .topbar + A5SearchSlot + .layout.one > .main > .panel > .card.hist) שהיה כתוב ידנית
// בכל דף - עכשיו במקום אחד. בלי CSS משלו: כל העיצוב מ-a5-page.css / הפלטה (המבנה והמחלקות זהים, לכן המידות זהות).
//
// rail (אופציונלי, תוספת תואמת-לאחור 14.10.2026): עמודה כחולה בצד ימין (aside.rail) כמו ציר השלבים של דף הלו"ז - הדף מצייר אותה בעצמו; הפריסה הופכת ל-.layout.has-rail (שתי עמודות).
// props: small ('ניהול'), title (h1), backId, backLabel (aria + טולטיפ), onBack, tools (לדוגמה <PageVariantToggle/> בצד הכותרת), slotId (מזהה משבצת החיפוש - אותו id נשלח ל-A5List searchSlot),
//        cardIcon (שם אייקון), cardTitle (h2 של כותרת הכרטיס), cardAction (כפתור בכותרת הכרטיס, אופציונלי), tabpanel (role=tabpanel כשיש לשוניות), tabs (שורת לשוניות אופציונלית - בתוך .main לפני הכרטיס, כמו ברשימת העובדים; ר' A5Tabs), children (A5List).
import { A5SearchSlot } from './A5Parts';
import { Ic } from './A5Icon';

export default function A5ListPage({ small = 'ניהול', title, backId, backLabel = 'חזרה למרכז הניהול', onBack, tools = null, slotId, cardIcon, cardTitle, cardAction = null, tabs = null, tabpanel = false, rail = null, guide = null, children }) {
  return (
    <div className="app" id="app">
      <div className="topbar">
        <button type="button" className="back" id={backId} data-guide-id={guide ? `${guide}.back` : undefined} aria-label={backLabel} data-tip={backLabel} onClick={onBack}><Ic id="back" /></button>
        <div className="ttl"><h1><small>{small}</small>{title}</h1></div>
        {tools ? <div className="a5-tools">{tools}</div> : null}
      </div>
      <A5SearchSlot id={slotId} />
      <div className={rail ? 'layout has-rail' : 'layout one'}>
        {rail}
        <main className="main">
          {tabs}
          <section className="panel on" id="p-list" role={tabpanel ? 'tabpanel' : undefined}>
            <div className="card hist">
              <div className="card-h"><div className="ico gold"><Ic id={cardIcon} size="lg" /></div><h2>{cardTitle}</h2>{cardAction}</div>
              {children}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

/**
 * A5Tabs - שורת הלשוניות האחידה (nav.tabs של הפלטה) לדפים עם כמה לשוניות (רשימת העובדים: "רשימת עובדים" / "נוכחות"). מועברת ל-A5ListPage כ-`tabs`.
 * items = [{ key, label, icon, on?, onClick? }]; הלשונית הפעילה (on) נשארת בדף, האחרות מנווטות.
 */
export function A5Tabs({ id = 'tabs', label, items }) {
  return (
    <nav className="tabs" id={id} role="tablist" aria-label={label}>
      {items.map((it) => (
        <button key={it.key} type="button" className={`tab${it.on ? ' on' : ''}`} role="tab" aria-selected={!!it.on} data-tab={it.key} onClick={it.on ? undefined : it.onClick}>
          <span className="tico"><Ic id={it.icon} /></span>{it.label}
        </button>
      ))}
    </nav>
  );
}
