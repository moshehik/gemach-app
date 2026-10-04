'use client';

// OcDressLocationBanner — באנר "שמלות שעדיין לא בבית" (R49, enable_dress_location_alert; פורט components/orders/DressLocationBanner.js מענף נווה יעקב).
// נרשם ב-SLOTS.TopBanners (מעל הלשוניות). הנתונים מ-GET /api/orders/dress-location-alerts?orderId=… (קריאה בלבד; lib/dressLocationAlerts.js).
// ההגדרה כבויה = הרכיב לא שואל כלום ולא מציג כלום. העיצוב: באנר הפלטה (.nb.nb-warning, כמו באנר הטיוטה) עם רשימת הדגמים בגוף.
// תאריכים עבריים בלבד. מתרענן כשמספר הפריטים / הנלקחים משתנה או כשנכתב משהו בשרת (oc.historyVersion).
import { useEffect, useState } from 'react';
import OcIcon from '../OcIcon';
import { hebDateOf } from '../orderCardLogic';
import { dressAlertHead, dressAlertLine, dressAlertTitle, dressRefreshKey } from './ocNeveLogic';

function AlertList({ alerts }) {
  return (
    <>
      {alerts.map(al => {
        const h = dressAlertHead(al);
        return (
          <div className="nb-r oc-dl-model" key={al.key}>
            <i><OcIcon name="dress" /></i>
            <span><b>{h.name}</b>{h.tail}
              <ul className="oc-dl-away">
                {al.away.map((a, i) => <li key={`${a.barcode}-${i}`}>{dressAlertLine(a, hebDateOf)}</li>)}
              </ul>
            </span>
          </div>
        );
      })}
    </>
  );
}

export default function OcDressLocationBanner({ oc }) {
  const enabled = !!oc.settings.enableDressLocationAlert;
  const orderId = oc.order?.orderId;
  const refreshKey = dressRefreshKey(oc.items, oc.historyVersion);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!enabled || !orderId) { setAlerts([]); return undefined; }
    let cancelled = false;
    fetch(`/api/orders/dress-location-alerts?orderId=${orderId}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled) setAlerts(data?.orders?.[0]?.alerts || []); })
      .catch(() => { if (!cancelled) setAlerts([]); });
    return () => { cancelled = true; };
  }, [enabled, orderId, refreshKey]);

  if (!enabled || alerts.length === 0) return null;
  return (
    <div className="nb-area oc-banner oc-dressloc" data-oc-part="dress-location">
      <div className="nb-w">
        <section className="nb nb-warning open" role="alert" aria-labelledby="oc-dl-t">
          <div className="nb-main">
            <div className="nb-head">
              <span className="nb-ic" aria-hidden="true"><OcIcon name="alert" /></span>
              <div className="nb-msg"><b id="oc-dl-t">{dressAlertTitle(alerts)}</b></div>
            </div>
          </div>
          <div className="nb-bw">
            <div className="nb-body">
              <div className="nb-bi"><AlertList alerts={alerts} /></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
