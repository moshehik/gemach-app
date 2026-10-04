'use client';

// לשונית שעדיין לא נבנתה ע"י הזרם שלה - מסומנת "בבנייה" (ר' tabs/index.js). מציגה כמה נתוני אמת מהבקר כדי שהכרטיס
// ירוץ מקצה לקצה עם הנתונים של ההזמנה (ובשביל בדיקת המעטפת), בלי שום פעולה.
import OcIcon from '../OcIcon';
import { fmtMoney, hebDateOf, itemLabel } from '../orderCardLogic';

const TITLES = { details: ['פרטים', 'user', 'W2a'], items: ['פריטים', 'dress', 'W3'], delivery: ['משלוח', 'truck', 'W2a'], payments: ['תשלומים', 'card', 'W4'], history: ['היסטוריה', 'clock', 'W6'] };

function Summary({ id, oc }) {
  const o = oc.order || {};
  if (id === 'details') {
    const c = o.customer || {};
    return (
      <div className="kv oc-ph-kv">
        <div className="f"><small>לקוח</small><b>{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</b></div>
        <div className="f"><small>תאריך האירוע</small><b>{hebDateOf(o.eventDate) || '—'}</b></div>
      </div>
    );
  }
  if (id === 'items') {
    const act = oc.items.filter(i => !i.isDeleted);
    return <ul className="oc-ph-list">{act.map((it, i) => <li key={it.id || it._localId || i}>{itemLabel(it)}</li>)}</ul>;
  }
  if (id === 'payments') {
    return (
      <div className="kv oc-ph-kv">
        <div className="f"><small>סה״כ</small><b><bdi dir="ltr">{fmtMoney(oc.totals.required)}</bdi></b></div>
        <div className="f"><small>שולם</small><b><bdi dir="ltr">{fmtMoney(oc.totals.paid)}</bdi></b></div>
      </div>
    );
  }
  return null;
}

export default function makeTabPlaceholder(id) {
  function OcTabPlaceholder({ oc }) {
    const [title, icon, stream] = TITLES[id] || [id, 'info', ''];
    return (
      <section className="card oc-ph" data-oc-placeholder={id}>
        <div className="card-h">
          <div className="ico rose"><OcIcon name={icon} size="lg" /></div>
          <h2>{title}</h2>
          <span className="chip gray oc-ph-chip">בבנייה{stream ? ` · ${stream}` : ''}</span>
        </div>
        <Summary id={id} oc={oc} />
      </section>
    );
  }
  OcTabPlaceholder.ocPlaceholder = true;
  return OcTabPlaceholder;
}
