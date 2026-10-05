'use client';

// לשונית "היסטוריה" של כרטיס ההזמנה החדש (W6, PLAN §C): מלמעלה למטה כמו pHistory() בדגימה -
//   1. "יומן הזמנה" (A20 + שלבי ההזמנה A5 - אוחדו לכרטיס אחד, D2 2026-10-05) parts/OcJournalCard.js ← GET /api/orders/[id]/journal (journal + stages)
//   2. כותרת המקטע "מותאם" + "פעולות ושינויים" (R41/A21/A22) parts/OcHistoryFeed.js ← GET /api/orders/[id]/history?all=1
// טעינה: בפעם הראשונה שהלשונית מוצגת (כל הלשוניות מורכבות תמיד - לא טוענים היסטוריה לכל פתיחת כרטיס), ומחדש בכל שינוי של
// oc.historyVersion (עולה אחרי כל כתיבה בשרת - שמירה, פעולה מיידית, תשלום, אישור, ייצוא; W1) - כשהלשונית מוצגת, ואם לא - בפעם
// הבאה שתוצג. סימון "הכנה בוצעה" (AMB-08) → POST /api/orders/[id]/prep-mark → oc.bumpHistory() (הפיד והיומן נטענים מחדש).
import { useCallback, useEffect, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import OcJournalCard from '../parts/OcJournalCard';
import OcHistoryFeed from '../parts/OcHistoryFeed';

export default function OcHistoryTab({ oc, ui, active }) {
  const orderId = oc.order && oc.order.orderId;
  const [journal, setJournal] = useState(null);
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markBusy, setMarkBusy] = useState('');
  const loadedRef = useRef({ version: -1, orderId: null });
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    if (!orderId) return;
    const seq = ++seqRef.current;
    setLoading(true);
    setError(false);
    try {
      const [jr, hr] = await Promise.all([
        fetch(`/api/orders/${orderId}/journal`, { cache: 'no-store' }),
        fetch(`/api/orders/${orderId}/history?all=1`, { cache: 'no-store' }),
      ]);
      if (seq !== seqRef.current) return;
      const j = jr.ok ? await jr.json() : null;
      const h = hr.ok ? await hr.json() : null;
      if (seq !== seqRef.current) return;
      setJournal(j);
      setFeed(h);
      setError(!h);
    } catch {
      if (seq === seqRef.current) setError(true);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!active || !orderId || oc.status !== 'ready') return;
    const last = loadedRef.current;
    if (last.version === oc.historyVersion && last.orderId === orderId) return;
    loadedRef.current = { version: oc.historyVersion, orderId };
    load();
  }, [active, orderId, oc.status, oc.historyVersion, load]);

  const onMark = useCallback(async (stage, wanted) => {
    const o = oc.order || {};
    const c = o.customer || {};
    const n = (oc.items || []).filter((i) => !i.isDeleted).length;
    const event = (journal && (journal.stages || []).find((s) => s.key === 'event')) || null;
    const ok = await ui.confirm({
      title: wanted ? 'בטוח שהשלב "הכנה" בוצע?' : 'לבטל את סימון הביצוע?',
      sub: `הזמנה #${o.orderId} · ${[c.firstName, c.lastName].filter(Boolean).join(' ')}`,
      body: (
        <div className="chg">
          <div className="c"><div className="ico gray oc-cico"><OcIcon name="dress" size="sm" /></div><div className="t">{n === 1 ? 'שמלה אחת' : `${n} שמלות`}</div></div>
          {event && event.day ? <div className="c"><div className="ico gray oc-cico"><OcIcon name="cal" size="sm" /></div><div className="t">{`אירוע: ${[event.day.wdFull, event.day.he].filter(Boolean).join(' ')}`}</div></div> : null}
        </div>
      ),
      okText: wanted ? 'כן, סמן כבוצע' : 'כן, בטל סימון',
      cancelText: 'ביטול',
      icon: wanted ? 'check' : 'undo',
    });
    if (!ok) return;
    setMarkBusy(stage.key);
    try {
      // נקודת קצה צרה של ההזמנה (שער page:orders), לא /api/schedule/marks (page:schedule) - AMB-08 (B); השרת קובע את השלב (הכנה) ואת היום
      const res = await fetch(`/api/orders/${o.orderId}/prep-mark`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: wanted ? 'mark' : 'unmark', dayKey: stage.dayKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { ui.toast('error', data.error || 'הסימון נכשל', 'נסו שוב'); return; }
      ui.toast('info', wanted ? 'סומן כבוצע' : 'הסימון בוטל', `${stage.label} · הזמנה #${o.orderId}${c.firstName || c.lastName ? ` · ${[c.firstName, c.lastName].filter(Boolean).join(' ')}` : ''}`);
      oc.bumpHistory();
    } catch {
      ui.toast('error', 'הסימון נכשל', 'נסו שוב');
    } finally {
      setMarkBusy('');
    }
  }, [oc, ui, journal]);

  return (
    <>
      {journal ? (
        <OcJournalCard nodes={journal.journal} stages={journal.stages} todayKey={journal.today && journal.today.dayKey} canMark={!!journal.canMark} busyKey={markBusy} onMark={onMark} />
      ) : null}
      <div className="sect-h">
        <div className="ico gold"><OcIcon name="sliders" size="lg" /></div>
        <div><b className="big oc-sect-t">מותאם</b><div className="faint sm">הפרטים המלאים של כל השינויים בהזמנה</div></div>
      </div>
      <OcHistoryFeed oc={oc} ui={ui} entries={feed ? feed.entries : null} loading={loading} error={error && !feed} onRetry={load} truncated={!!(feed && feed.exportTruncated)} />
    </>
  );
}
