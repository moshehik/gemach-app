'use client';

// OcStepper — הציר העליון של כרטיס ההזמנה ("ציר האירוע"), חזר לפי הערת הבעלים 2026-10-05 ("לא רציתי שום דבר אחר - להחזיר בדיוק בעיצוב מהדגימה").
// markup + מחלקות = renderTimeline() בעיצוב המאושר (תצוגות-עיצוב/כרטיס-הזמנה.html שורות 3432-3461): <div class="stepper" id="stepper"><div class="tlx" style="--n">
//   <div class="tx done|cur|fut [hasnow] [fresh]" style="--fill" data-rich tabindex=0><div class="dot">אייקון / סמן "היום"<span class="ck"/></div><div class="tt"><b/><span/>…</div>
//   [<div class="today" style="--f"><button class="tip pinm"/></div>]</div></div></div>. ה-CSS כולו בפלטה (design-system/components.css: .stepper .tlx .tx .dot .ck .today .pinm .pl-rt).
// הנתונים: GET /api/orders/[id]/journal (אותו מקור כמו שלבי ההזמנה בלשונית ההיסטוריה) - ר' parts/ocStepperLogic.js (הלוגיקה, בלי פרטים בדויים).
// הכרטיס העשיר (data-rich בעיצוב, #rt): ריחוף / מיקוד מקלדת / הקשה במגע; .pl-rt ב-portal (כמו טולטיפ המשמרת ביומן); מעל הצומת, ומתהפך מתחתיו כשאין מקום
// (גם מתחת לתפריט העליון הדביק #snav). סמנטיקה: role=list / listitem, aria-current="step" בצומת הנוכחי, aria-describedby לכרטיס.
// הנתונים (data) נטענים ב-OrderCardA5 (useOrderJournalData) ומשותפים עם שורות הפריטים (OcJournalContext). טעינה: אחרי שהכרטיס מוכן ובכל oc.historyVersion (עולה אחרי כל כתיבה בשרת); כישלון = אין ציר (הכרטיס עובד בלעדיו).
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import OcIcon from './OcIcon';
import OcPortal from './OcPortal';
import { buildStepper } from './parts/ocStepperLogic';

function placeRich(r, w, h) {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const gap = 8;
  const nav = document.querySelector('[data-sticky-nav]');
  const minTop = Math.max(8, nav ? Math.round(nav.getBoundingClientRect().bottom) + 8 : 0);
  const cx = r.left + r.width / 2;
  const x = Math.max(8, Math.min(vw - w - 8, cx - w / 2));
  let y = r.top - gap - h;
  let side = 't';
  if (y < minTop) { y = r.bottom + gap; side = 'b'; }
  y = Math.max(8, Math.min(vh - h - 8, y));
  return { x, y, side, arrowLeft: Math.max(14, Math.min(w - 14, cx - x)) };
}

function RichCard({ id, rows, anchor }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setPos(placeRich(anchor, el.offsetWidth, el.offsetHeight));
  }, [anchor, rows]);
  return (
    <div ref={ref} id={id} className={`pl-rt${pos ? ' on' : ''}`} role="tooltip" data-side={pos ? pos.side : undefined} style={{ left: pos ? pos.x : 0, top: pos ? pos.y : 0 }}>
      {rows.map((r, i) => <div className="rr1" key={i}><OcIcon name={r.icon} size="sm" /><span>{r.text}</span></div>)}
      <i className="ra" style={pos ? { left: pos.arrowLeft, top: '' } : undefined} />
    </div>
  );
}

export function useOrderJournalData(oc) {
  const orderId = oc.order && oc.order.orderId;
  const [data, setData] = useState(null);
  const seq = useRef(0);
  useEffect(() => {
    if (oc.status !== 'ready' || !orderId) return undefined;
    const my = ++seq.current;
    let alive = true;
    fetch(`/api/orders/${orderId}/journal`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && my === seq.current) setData(j); })
      .catch(() => { if (alive && my === seq.current) setData(null); });
    return () => { alive = false; };
  }, [oc.status, orderId, oc.historyVersion]);
  return data;
}

export default function OcStepper({ oc, data }) {
  const rid = useId();
  const model = useMemo(
    () => buildStepper(data, { order: oc.order || {}, items: oc.items || [], courier: (oc.settings && oc.settings.get && oc.settings.get('courier_name', '')) || '' }),
    [data, oc.order, oc.items, oc.settings],
  );
  const [rich, setRich] = useState(null); // { key, anchor, rows }
  const seenRef = useRef(null);
  const [fresh, setFresh] = useState(() => new Set());

  // "fresh" (אנימציית הסימון) רק לצומת שנהיה "בוצע" אחרי הטעינה הראשונה - כמו __doneSet בעיצוב
  useEffect(() => {
    if (!model) return;
    const done = new Set(model.nodes.filter((n) => n.done).map((n) => n.k));
    if (seenRef.current) setFresh(new Set([...done].filter((k) => !seenRef.current.has(k))));
    seenRef.current = done;
  }, [model]);

  const hide = useCallback(() => setRich(null), []);
  const show = useCallback((key, el, rows) => {
    if (!rows || !rows.length) { setRich(null); return; }
    const anchor = (el.querySelector && (el.querySelector('.dot') || el)) || el;
    setRich({ key, anchor: anchor.getBoundingClientRect(), rows });
  }, []);
  useEffect(() => {
    if (!rich) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') hide(); };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); document.removeEventListener('keydown', onKey); };
  }, [rich, hide]);

  // אין נתונים (עדיין נטען / נכשל / אין שלבים): לא מרנדרים כלום - לא פס זכוכית ריק (.stepper נותנת מסגרת וריפוד) ולא הזזת פריסה
  if (!model) return null;
  const touch = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover:none)').matches;
  const descId = `${rid}-rt`;
  const nowRich = (el) => show('now', el, model.nowRows);

  const pinBtn = (
    <button type="button" className="tip pinm" aria-label="היום" aria-describedby={rich && rich.key === 'now' ? descId : undefined}
      onMouseEnter={(e) => nowRich(e.currentTarget)} onMouseLeave={hide} onFocus={(e) => nowRich(e.currentTarget)} onBlur={hide}>
      <OcIcon name="pin" />
    </button>
  );

  return (
    <>
      <div className="stepper" id="stepper">
        <div className="tlx" style={{ '--n': model.nodes.length }} role="list" aria-label="ציר ההזמנה">
          {model.nodes.map((n) => {
            const status = n.done ? 'הושלם' : n.cur ? 'השלב הנוכחי' : 'טרם';
            const dateText = [n.wd, n.endHeShort ? `${n.heShort} – ${n.endHeShort}` : n.heShort].filter(Boolean).join(' · ');
            return (
              <div
                key={n.k}
                role="listitem"
                className={`tx ${n.status}${n.between ? ' hasnow' : ''}${n.done && fresh.has(n.k) ? ' fresh' : ''}${n.deliv ? ' deliv' : ''}`}
                style={{ '--fill': n.fill.toFixed(3) }}
                data-rich={`tl|${n.k}`}
                data-node={n.k}
                tabIndex={0}
                aria-current={n.cur ? 'step' : undefined}
                aria-label={`${n.label}, ${dateText}, ${status}`}
                aria-describedby={rich && rich.key === n.k ? descId : undefined}
                onMouseEnter={(e) => show(n.k, e.currentTarget, n.rows)}
                onMouseLeave={(e) => { if (!(e.relatedTarget && e.currentTarget.contains(e.relatedTarget))) hide(); }}
                onFocus={(e) => { if (e.target === e.currentTarget) show(n.k, e.currentTarget, n.rows); }}
                onBlur={(e) => { if (e.target === e.currentTarget) hide(); }}
                onClick={(e) => { if (touch() && !(e.target.closest && e.target.closest('button'))) { if (rich && rich.key === n.k) hide(); else show(n.k, e.currentTarget, n.rows); } }}
              >
                <div className="dot">
                  {n.cur ? pinBtn : <OcIcon name={n.icon} />}
                  {n.done ? <span className="ck"><OcIcon name="check" /></span> : null}
                </div>
                <div className="tt">
                  <b>{n.label}</b>
                  <span>{dateText}</span>
                  {n.deliv && n.city ? <span>{n.city}</span> : null}
                </div>
                {n.between ? <div className="today" style={{ '--f': n.f.toFixed(2) }}>{pinBtn}</div> : null}
              </div>
            );
          })}
        </div>
      </div>
      {rich ? <OcPortal><RichCard id={descId} rows={rich.rows} anchor={rich.anchor} /></OcPortal> : null}
    </>
  );
}
