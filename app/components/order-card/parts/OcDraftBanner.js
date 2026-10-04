'use client';

// OcDraftBanner — R11: באנר "נמצאו שינויים שלא נשמרו מביקור קודם בכרטיס" (enable_local_order_drafts, בכרטיס מעל הלשוניות). orderDrafts.js ללא שינוי:
// הבקר (oc.drafts) קורא/כותב את הטיוטה; כאן רק התצוגה והלחצנים "שחזר את השינויים" (oc.drafts.restore) / "מחק אותם" (oc.drafts.discard - חלון אישור).
// ה-X סוגר את הבאנר בלבד (הטיוטה נשארת; מופיע שוב בביקור הבא).
// מפת פורט: showDraft בשכבת הסקירה של העיצוב (באנר 35 בפלטה: nb-warning open); הישן: LegacyOrderPage.js:1748 (pendingDraft).

import { useState } from 'react';
import OcIcon, { OC_ICON_NAMES } from '../OcIcon';
import { draftIconName, draftTimeLabel, draftIsStale } from './ocRailLogic';

const iconOf = (icon) => { const n = draftIconName(icon); return OC_ICON_NAMES.has(n) ? n : 'pencil'; };

export default function OcDraftBanner({ oc }) {
  const d = oc.drafts.pending;
  const [closedAt, setClosedAt] = useState(null);
  if (!d || closedAt === d.savedAt) return null;
  const rows = Array.isArray(d.rows) && d.rows.length ? d.rows.map((r) => ({ icon: iconOf(r.icon), text: r.text })) : (d.summary || []).map((t) => ({ icon: 'pencil', text: t }));
  const when = draftTimeLabel(d.savedAt);
  const stale = draftIsStale(d, oc.order && oc.order.updatedAt);
  return (
    <div className="nb-area oc-banner" data-oc-banner="draft-local">
      <div className="nb-w">
        <section className="nb nb-warning open" role="status" aria-live="polite" aria-labelledby="oc-draft-t">
          <div className="nb-main">
            <div className="nb-head">
              <span className="nb-ic" aria-hidden="true"><OcIcon name="alert" /></span>
              <div className="nb-msg"><b id="oc-draft-t">נמצאו שינויים שלא נשמרו מביקור קודם בכרטיס</b>{when ? <span>({when})</span> : null}</div>
              <button type="button" className="nb-x" aria-label="סגור" data-tip="סגור" onClick={() => setClosedAt(d.savedAt)}><OcIcon name="x" /></button>
            </div>
          </div>
          <div className="nb-bw">
            <div className="nb-body">
              <div className="nb-bi">
                {rows.map((r, i) => <div className="nb-r" key={i}><i><OcIcon name={r.icon} /></i><span>{r.text}</span></div>)}
                {stale ? <div className="nb-r"><i><OcIcon name="alert" /></i><span>שים לב: ההזמנה עודכנה בשרת מאז שהשינויים האלה נערכו. שחזור ושמירה ידרשו אישור דריסה.</span></div> : null}
                <div className="oc-banner-acts">
                  <button type="button" className="nb-go" data-act="draft-restore" onClick={oc.drafts.restore}><OcIcon name="refresh" size="sm" /> שחזר את השינויים</button>
                  <button type="button" className="nb-go" data-act="draft-drop" onClick={oc.drafts.discard}><OcIcon name="trash" size="sm" /> מחק אותם</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
