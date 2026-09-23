'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TIERS, normalizePolicy, buildSegments, computeItemRefund, explainDay, isSwapWindowOpen,
} from '@/lib/refundSimulator';
import {
  DAYS_CAP, clamp, valueOrEmpty, fmtMoney, fmtPct, Icon, Stepper, Money, Switch, NullableStepper,
  RefundNav, ApplyPanel, useLivePolicy, LABELS,
} from './shared';

const TAIL = 3;       // ימים אחרי האירוע שמוצגים בציר
const MAX_LEAD = 730;

// ---- גאומטריה של הפס האחד: [אזור דקות] [שבר] [אזור ימים], הכל באחוזים מהפס (מימין לשמאל) ----
const MW = 20;              // רוחב אזור הדקות
const D0 = 22;              // תחילת אזור הימים
const DW = 100 - D0;        // רוחב אזור הימים
const scaleFor = (mins) => (mins <= 45 ? 60 : Math.ceil((mins * 1.5) / 15) * 15); // טווח הדקות המוצג

const dayWord = (n) => (n === 1 ? 'יום' : 'ימים');

// ---------- הפס האחד ----------
// אזור הדקות מונע ע"י "ביטול מיידי" בלבד (instantUndoMinutes האפקטיבי) - זה היחיד שקובע אם
// יש חיוב בכלל. "דקות לזיכוי על פריט חלופי" (creditMinutes) הוא מנגנון נפרד לגמרי (לא קובע
// אם *הפריט הזה* מחויב, אלא אם דמי הביטול שלו מנוצלים כזיכוי על פריט *אחר*) ולכן מוצג רק
// כטקסט על פס המשנה שלו למטה, לא כידית על הפס הראשי.
function UnifiedTimeline({ ctx }) {
  const {
    lead, pol, setP, item, money, denom, depositMode, segments, bands, total, endDay, pin, setPin, defaultDay,
  } = ctx;
  const laneRef = useRef(null);
  const [laneW, setLaneW] = useState(700);
  const [hover, setHover] = useState(null);      // {kind:'day'|'min', v}
  const [drag, setDrag] = useState(null);
  const [dragScale, setDragScale] = useState(null);
  const instant = pol.effectiveInstantUndoMinutes;
  const scale = dragScale ?? scaleFor(instant);

  useEffect(() => {
    const el = laneRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setLaneW(el.getBoundingClientRect().width || 700));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const heightFrac = (tier) => (denom > 0 ? money[tier].refund / denom : ({ full: 1, partial: pol.percent / 100, none: 0 })[tier]);
  const active = hover ?? (pin ?? { kind: 'day', v: defaultDay });
  const isHover = hover !== null;
  const info = useMemo(() => {
    const args = { price: item.price, repairs: item.repairs, deposit: item.deposit, policy: pol };
    if (active.kind === 'min') {
      const within = active.v <= instant;
      const ex0 = explainDay(0, 0, lead, pol);
      return { kind: 'min', within, tier: within ? 'instant' : ex0.tier, ex: ex0, m: computeItemRefund({ tier: ex0.tier, ...args, swap: ex0.swapOpen }) };
    }
    const ex = explainDay(active.v, 0, lead, pol);
    return { kind: 'day', tier: ex.tier, ex, m: computeItemRefund({ tier: ex.tier, ...args, swap: ex.swapOpen }) };
  }, [active.kind, active.v, instant, lead, pol, item]);
  const m = info.m;

  // ---------- גרירה ----------
  const pctFromX = (clientX) => {
    const r = laneRef.current.getBoundingClientRect();
    return clamp(((r.right - clientX) / r.width) * 100, 0, 100); // הזמן זורם מימין לשמאל (RTL)
  };
  const dayFrac = (p) => ((p - D0) / DW) * total;
  const zoneAt = (p) => {
    if (p <= MW) return { kind: 'min', v: clamp(Math.floor((p / MW) * scale), 0, scale) };
    if (p >= D0) return { kind: 'day', v: clamp(Math.floor(dayFrac(p)), 0, endDay) };
    return null;
  };
  const startDrag = (e, type) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.focus?.();
    if (type === 'instant') setDragScale(scaleFor(instant));
    setDrag(type); setHover(null);
  };
  const endDrag = (e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); setDrag(null); setDragScale(null); };
  const moveDrag = (e, type) => {
    if (drag !== type || !laneRef.current) return;
    const p = pctFromX(e.clientX);
    if (type === 'full') {
      setP({ fullDays: clamp(Math.round(dayFrac(p)) - 1, 0, Math.min(DAYS_CAP, total - 1)) });
    } else if (type === 'none') {
      setP({ noRefundDays: clamp(lead - Math.round(dayFrac(p)), 0, Math.min(DAYS_CAP, lead)) });
    } else if (type === 'instant') {
      setP({ instantUndoMinutes: clamp(Math.round((Math.min(p, MW) / MW) * scale), 0, 10080) });
    } else if (type === 'pct') {
      const r = laneRef.current.getBoundingClientRect();
      const h = clamp((r.bottom - e.clientY) / r.height, 0, 1);
      const refundable = money.partial.refundable;
      const raw = denom > 0 && refundable > 0 ? ((h * denom) / refundable) * 100 : h * 100;
      setP({ percent: clamp(e.shiftKey ? Math.round(raw) : Math.round(raw / 5) * 5, 0, 100) });
    }
  };
  const keyDrag = (e, type) => {
    const map = type === 'none'
      ? { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }
      : { ArrowLeft: 1, ArrowUp: 1, ArrowRight: -1, ArrowDown: -1 };
    const dir = map[e.key];
    if (!dir) return;
    e.preventDefault();
    if (type === 'full') setP({ fullDays: clamp(pol.fullDays + dir, 0, Math.min(DAYS_CAP, total - 1)) });
    if (type === 'none') setP({ noRefundDays: clamp(pol.noRefundDays + dir, 0, Math.min(DAYS_CAP, lead)) });
    if (type === 'instant') setP({ instantUndoMinutes: clamp(instant + dir, 0, 10080) });
    if (type === 'pct') setP({ percent: clamp(pol.percent + dir * 5, 0, 100) });
  };
  const onLaneMove = (e) => { if (!drag) setHover(zoneAt(pctFromX(e.clientX))); };
  const onLaneClick = (e) => {
    if (drag) return;
    const z = zoneAt(pctFromX(e.clientX));
    if (!z) return;
    const cur = pin ?? { kind: 'day', v: defaultDay };
    const same = !isHover ? false : (cur.kind === z.kind && cur.v === z.v);
    setPin(same ? null : z);
  };

  // ---------- גאומטריה נגזרת ----------
  const pctDay = (d) => D0 + (d / total) * DW;
  const pctDayMid = (d) => D0 + ((d + 0.5) / total) * DW;
  const dayW = (n) => (n / total) * DW;
  const pctMin = (mm) => (clamp(mm, 0, scale) / scale) * MW;
  const fullEdge = clamp(pctDay(pol.fullDays + 1), D0, 100);
  const noEdge = clamp(pctDay(lead - pol.noRefundDays), D0, 100);
  const partialSeg = segments.find((s) => s.tier === 'partial');
  const tickStep = useMemo(() => {
    const maxLabels = Math.max(3, Math.floor((laneW * (DW / 100)) / 70));
    const raw = Math.ceil(total / maxLabels);
    return [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 180].find((s) => s >= raw) || 365;
  }, [laneW, total]);
  const ticks = useMemo(() => { const o = []; for (let d = 0; d <= endDay; d += tickStep) o.push(d); return o; }, [endDay, tickStep]);
  const minTicks = [0, 1, 2].map((i) => Math.round((scale * i) / 3));
  const dense = total <= 120;
  const gridLines = useMemo(() => {
    const o = [];
    if (dense) for (let d = 1; d <= endDay; d++) o.push({ d, wk: false });
    else for (let d = 7; d <= endDay; d += 7) o.push({ d, wk: true });
    return o;
  }, [dense, endDay]);
  const clampHalf = 'min(300px,100%)';
  const heightAt = (tier) => clamp(heightFrac(tier) * 100, 0, 100);
  const gripBottom = clamp((money.partial.refundable > 0 ? heightFrac('partial') : pol.percent / 100) * 100, 0, 100);
  const activePct = active.kind === 'day' ? pctDayMid(active.v) : pctMin(active.v);
  const activeH = info.tier === 'instant' ? 100 : heightAt(info.tier);
  const swapOn = pol.sameModelSwap;
  const dressFee = m.dressFee;
  // ימים 0..swapCutoffDay (כולל) הם בתוך חלון ההחלפה החינמית - swapMinDays<=0 = בלי הגבלה (כל הציר).
  const swapCutoffDay = pol.swapMinDays <= 0 ? endDay : clamp(lead - pol.swapMinDays, 0, endDay);
  const swapWidthDays = clamp(swapCutoffDay + 1, 0, total);

  const shortReason = info.kind === 'day' ? (info.tier === 'none' ? (info.ex.untilEvent < 0 ? 'האירוע כבר עבר' : `${info.ex.untilEvent} ימים לפני האירוע - פחות מ-${pol.noRefundDays}`)
    : info.tier === 'full' ? `בתוך ${pol.fullDays} ימים מההזמנה`
    : `אחרי ${pol.fullDays} ימים, לפני ${pol.noRefundDays} ימי החסימה`) : '';

  return (
    <div className="rp-lanewrap rp-unified">
      {/* ---------- החלונית הצפה (קומפקטית) ---------- */}
      <div className={`rp-pop t-${info.tier === 'instant' ? 'credit' : info.tier} ${isHover ? 'hover' : 'pinned'}`} role="status" aria-live="polite"
        style={{ left: `clamp(calc(${clampHalf} / 2), ${100 - activePct}%, calc(100% - ${clampHalf} / 2))` }}>
        <div className="rp-pop-head">
          <span className="rp-tier"><i />{info.kind === 'min' ? (info.within ? 'ביטול מיידי' : 'אחרי הדקות') : (info.ex.swapOpen ? 'החלפת מידה' : TIERS[info.tier].label)}</span>
          <span className="rp-pop-date">{info.kind === 'min' ? `${active.v} דק׳ אחרי ההוספה` : `יום ${active.v} מההזמנה`}</span>
          {!isHover && pin !== null && (
            <button type="button" className="rp-pop-x" onClick={() => setPin(null)} aria-label="בטל נעילה" title="בטל נעילה"><svg className="icon"><use href="#i-x" /></svg></button>
          )}
        </div>
        {info.kind === 'min' && info.within ? (
          <>
            <div className="rp-pop-main one"><div><div className="rp-kpi-l">חיוב</div><div className="rp-kpi-v get">₪0</div></div></div>
            <p className="rp-reason">נחשב כאילו הפריט לא נוסף מעולם.</p>
          </>
        ) : (
          <>
            <div className="rp-pop-main">
              <div><div className="rp-kpi-l">חוזר</div><div className="rp-kpi-v get">{fmtMoney(m.refund)}<small>{fmtPct(m.refundPct)}</small></div></div>
              <div><div className="rp-kpi-l">נשאר</div><div className="rp-kpi-v keep">{fmtMoney(m.fee)}</div></div>
            </div>
            <p className="rp-reason">{info.kind === 'day' && info.ex.swapOpen ? 'החלפת מידה חינם - זיכוי מלא, בלי קשר למדרגות.' : shortReason}{m.repairsKept > 0 ? ` · תיקונים ${fmtMoney(m.repairsKept)} לא מוחזרים` : ''}</p>
            {!(info.kind === 'day' && info.ex.swapOpen) && (
              <div className="rp-chips2">
                <span className={dressFee > 0 && pol.creditMinutes > 0 ? 'cred' : ''}>
                  פריט חלופי: {pol.creditMinutes <= 0 ? 'כבוי בהגדרות' : dressFee > 0 ? `זיכוי מלא עד ${fmtMoney(dressFee)}` : 'אין מה לזכות'}
                </span>
                <span className={swapOn ? 'on' : ''}>החלפת מידה: {swapOn ? (info.kind === 'day' ? 'לא בחלון' : 'בתנאים') : 'כבוי'}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ---------- הפס הראשי ---------- */}
      <div className="rp-lane" ref={laneRef} dir="rtl">
        <div className="rp-clip">
          {/* אזור דקות - ביטול מיידי בלבד */}
          <div className="rp-tint t-credit" style={{ insetInlineStart: 0, width: `${pctMin(instant)}%` }} />
          <div className={`rp-tint t-${segments[0]?.tier ?? 'full'} rp-after`} style={{ insetInlineStart: `${pctMin(instant)}%`, width: `${MW - pctMin(instant)}%` }} />
          <div className="rp-bar inst" style={{ insetInlineStart: 0, width: `${pctMin(instant)}%`, height: '100%' }} />
          <div className={`rp-bar t-${segments[0]?.tier ?? 'full'} rp-after${heightAt(segments[0]?.tier ?? 'full') <= 0 ? ' zero' : ''}`}
            style={{ insetInlineStart: `${pctMin(instant)}%`, width: `${MW - pctMin(instant)}%`, height: `${heightAt(segments[0]?.tier ?? 'full')}%` }} />
          <div className="rp-break" style={{ insetInlineStart: `${MW}%`, width: `${D0 - MW}%` }} />
          {/* אזור ימים */}
          {segments.map((s) => (
            <div key={`t${s.tier}${s.from}`} className={`rp-tint t-${s.tier}`} style={{ insetInlineStart: `${pctDay(s.from)}%`, width: `${dayW(s.to - s.from + 1)}%` }} />
          ))}
          {gridLines.map((g) => <div key={`g${g.d}`} className={`rp-gl${g.wk ? ' wk' : ''}`} style={{ insetInlineStart: `${pctDay(g.d)}%` }} />)}
          <div className="rp-hz" style={{ bottom: '50%' }} />
          <div className="rp-hz top" style={{ top: 0 }} />
          {segments.map((s) => {
            const h = heightAt(s.tier);
            return (
              <div key={`b${s.tier}${s.from}`} className={`rp-bar t-${s.tier}${h <= 0 ? ' zero' : ''}`}
                style={{ insetInlineStart: `${pctDay(s.from)}%`, width: `${dayW(s.to - s.from + 1)}%`, height: `${h}%` }} />
            );
          })}
          {swapOn && (
            <div className="rp-swaphatch" style={{ insetInlineStart: `${pctDay(0)}%`, width: `${dayW(swapWidthDays)}%` }} title="חלון החלפת מידה חינם פתוח" />
          )}
          {denom > 0 && !pol.refundRepairs && Number(item.repairs) > 0 && bands.full && (
            <div className="rp-cap" style={{ insetInlineStart: `${pctDay(bands.full.from)}%`, width: `${dayW(bands.full.count)}%`, top: 0, height: `${100 - heightFrac('full') * 100}%` }} title="עלות תיקונים - לא מוחזרת" />
          )}
          <div className="rp-tail" style={{ insetInlineStart: `${pctDay(lead + 1)}%`, width: `${dayW(TAIL)}%` }} />
          <div className="rp-capture" onPointerMove={onLaneMove} onPointerLeave={() => setHover(null)} onClick={onLaneClick} />
        </div>

        {[[100, fmtMoney(denom)], [0, '₪0']].map(([p, label]) => (
          <span key={p} className="rp-yl" style={{ bottom: `${p}%` }}>{label}</span>
        ))}

        <div className={`rp-marker${isHover ? '' : ' pin'}`} style={{ insetInlineStart: `${activePct}%` }} />
        <div className={`rp-mdot${isHover ? '' : ' pin'}`} style={{ insetInlineStart: `${activePct}%`, bottom: `${activeH}%` }} />

        {/* ידית: ביטול מיידי */}
        <div className={`rp-handle t-credit${drag === 'instant' ? ' drag' : ''}`} style={{ insetInlineStart: `${pctMin(instant)}%` }}
          role="slider" tabIndex={0} aria-label="דקות לביטול מיידי" aria-valuemin={0} aria-valuemax={scale} aria-valuenow={instant} aria-valuetext={`${instant} דקות`}
          onPointerDown={(e) => startDrag(e, 'instant')} onPointerMove={(e) => moveDrag(e, 'instant')} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={(e) => keyDrag(e, 'instant')}>
          <span className="rp-grabpill"><svg viewBox="0 0 10 10"><path d="M3 1L1 5l2 4M7 1l2 4-2 4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>{instant} דק׳</span>
        </div>
        {/* ידית: סוף ההחזר המלא */}
        <div className={`rp-handle t-full${drag === 'full' ? ' drag' : ''}`} style={{ insetInlineStart: `${fullEdge}%` }}
          role="slider" tabIndex={0} aria-label="סוף חלון ההחזר המלא (ימים מההזמנה)" aria-valuemin={0} aria-valuemax={Math.min(DAYS_CAP, total - 1)} aria-valuenow={pol.fullDays} aria-valuetext={`${pol.fullDays} ימים מההזמנה`}
          onPointerDown={(e) => startDrag(e, 'full')} onPointerMove={(e) => moveDrag(e, 'full')} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={(e) => keyDrag(e, 'full')}>
          <span className="rp-grabpill"><svg viewBox="0 0 10 10"><path d="M3 1L1 5l2 4M7 1l2 4-2 4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>{pol.fullDays} ימים</span>
        </div>
        {/* ידית: תחילת ללא-החזר */}
        <div className={`rp-handle t-none${drag === 'none' ? ' drag' : ''}`} style={{ insetInlineStart: `${noEdge}%` }}
          role="slider" tabIndex={0} aria-label="תחילת חלון ללא החזר (ימים לפני האירוע)" aria-valuemin={0} aria-valuemax={Math.min(DAYS_CAP, lead)} aria-valuenow={pol.noRefundDays} aria-valuetext={`${pol.noRefundDays} ימים לפני האירוע`}
          onPointerDown={(e) => startDrag(e, 'none')} onPointerMove={(e) => moveDrag(e, 'none')} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={(e) => keyDrag(e, 'none')}>
          <span className="rp-grabpill"><svg viewBox="0 0 10 10"><path d="M3 1L1 5l2 4M7 1l2 4-2 4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>{pol.noRefundDays} ימים לפני</span>
        </div>
        {/* קו מתיחה: אחוז ההחזר באזור האמצעי */}
        {partialSeg && (
          <div className={`rp-stretch t-partial${depositMode ? ' dis' : ''}`}
            style={{ insetInlineStart: `${pctDay(partialSeg.from)}%`, width: `${dayW(partialSeg.to - partialSeg.from + 1)}%`, bottom: `calc(${gripBottom}% - 10px)` }}
            title={depositMode ? 'פיקדון קבוע גובר על האחוז' : 'גררו למעלה/למטה כדי למתוח את אחוז ההחזר'}
            role="slider" tabIndex={depositMode ? -1 : 0} aria-label="אחוז החזר באזור האמצעי" aria-orientation="vertical" aria-disabled={depositMode || undefined} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pol.percent}
            onPointerDown={depositMode ? undefined : (e) => startDrag(e, 'pct')} onPointerMove={(e) => moveDrag(e, 'pct')} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={depositMode ? undefined : (e) => keyDrag(e, 'pct')}>
            <span className="rp-grabpill"><svg viewBox="0 0 10 10"><path d="M1 3l4-2 4 2M1 7l4 2 4-2" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>{depositMode ? fmtMoney(item.deposit) : `${pol.percent}%`}{!depositMode && <em>מתחו</em>}</span>
          </div>
        )}
      </div>

      {/* ---------- פסי המשנה: פריט חלופי והחלפת מידה, על אותו ציר ---------- */}
      <div className="rp-subtracks">
        <div className={`rp-sub cred${pol.creditMinutes <= 0 ? ' off' : ''}`} title="דמי הביטול על השמלה מנוצלים כזיכוי על שמלה שנוספה באותה עריכה">
          <div className="rp-sub-fill">
            {pol.creditMinutes > 0 && segments.map((s) => (money[s.tier].dressFee > 0
              ? <i key={`c${s.tier}${s.from}`} style={{ insetInlineStart: `${pctDay(s.from)}%`, width: `${dayW(s.to - s.from + 1)}%` }} />
              : null))}
          </div>
          <span className="rp-sub-label"><Icon id="i-refresh" />
            {pol.creditMinutes > 0
              ? `פריט חלופי · שמלה שנוספה תוך ${pol.creditMinutes} דק׳ מהביטול מקבלת זיכוי מלא (עד מחירה)`
              : 'פריט חלופי · כבוי (0 דקות) - דמי הביטול לעולם לא הופכים לזיכוי'}
          </span>
        </div>
        <button type="button" className={`rp-sub swap${swapOn ? ' on' : ''}`} onClick={() => setP({ sameModelSwap: !swapOn })} aria-pressed={swapOn}
          title="החלפת מידה לאותו דגם - ללא דמי ביטול (לחצו להדלקה/כיבוי)">
          {swapOn && <div className="rp-sub-fill"><i style={{ insetInlineStart: `${pctDay(0)}%`, width: `${dayW(swapWidthDays)}%` }} /></div>}
          <span className="rp-sub-label"><Icon id={swapOn ? 'i-check-circle' : 'i-scissors'} />{swapOn
            ? `החלפת מידה חינם · פתוחה עד ${pol.swapMinDays} ימים לפני האירוע${pol.swapSameCategoryOnly ? ' · אותה שורת מחיר' : ''}`
            : 'החלפת מידה בדגם זהה · כבוי - לחצו להדלקה'}</span>
        </button>
      </div>

      {/* ---------- ציר ---------- */}
      <div className="rp-axis" aria-hidden="true">
        {minTicks.map((v) => (
          <div key={`m${v}`} className="rp-tick" style={{ insetInlineStart: `${pctMin(v)}%` }}>{v === 0 ? 'הוספה' : `${v} דק׳`}</div>
        ))}
        {ticks.map((d) => (
          <div key={d} className="rp-tick" style={{ insetInlineStart: `${pctDayMid(d)}%` }}>{`יום ${d}`}</div>
        ))}
      </div>
      <div className="rp-flags">
        <span className="rp-flag" style={{ insetInlineStart: 0, transform: 'none' }}><Icon id="i-receipt" />ביצוע ההזמנה</span>
        <span className="rp-flag ev" style={{ insetInlineStart: `${pctDayMid(lead)}%` }}><Icon id="i-star" />האירוע</span>
      </div>
    </div>
  );
}

// ---------- הדף ----------
export default function RefundPlanner() {
  const { policy, setPolicy, baseline, setBaseline, names, loadState } = useLivePolicy();
  const [lead, setLead] = useState(45);
  const [item, setItem] = useState({ price: 250, repairs: 0, deposit: '' });
  const [pin, setPin] = useState(null); // {kind:'day'|'min', v}

  const setP = (patch) => setPolicy((p) => ({ ...p, ...patch }));
  const pol = useMemo(() => normalizePolicy(policy), [policy]);
  const L = clamp(Number(lead) || 0, 0, MAX_LEAD);
  const endDay = L + TAIL;
  const total = endDay + 1;

  const segments = useMemo(() => buildSegments(0, endDay, 0, L, pol), [endDay, L, pol]);
  const money = useMemo(() => {
    const args = { price: item.price, repairs: item.repairs, deposit: item.deposit, policy: pol };
    return { full: computeItemRefund({ tier: 'full', ...args }), partial: computeItemRefund({ tier: 'partial', ...args }), none: computeItemRefund({ tier: 'none', ...args }) };
  }, [item, pol]);
  const denom = money.full.originalCharge;
  const depositMode = Number(item.deposit) > 0;
  const bandFor = (tier) => {
    const segs = segments.filter((s) => s.tier === tier);
    return segs.length ? { from: segs[0].from, to: segs[segs.length - 1].to, count: segs.reduce((n, s) => n + (s.to - s.from + 1), 0) } : null;
  };
  const bands = { full: bandFor('full'), partial: bandFor('partial'), none: bandFor('none') };
  const partialSeg = segments.find((s) => s.tier === 'partial');
  const defaultDay = partialSeg ? Math.floor((partialSeg.from + partialSeg.to) / 2) : 0; // ברירת מחדל: אמצע האזור האמצעי

  const notice = (() => {
    if (segments[0]?.tier === 'none') return { kind: 'danger', text: `כשההזמנה נעשית ${L} ימים לפני האירוע (פחות מ-${pol.noRefundDays} ימי החסימה) - כל ביטול הוא ללא החזר. קרבה לאירוע גוברת.` };
    if (pol.fullDays >= L - pol.noRefundDays && bands.full) return { kind: 'warning', text: 'חלון ההחזר המלא חופף לחלון "ללא החזר" ולכן נחתך - קרבה לאירוע גוברת.' };
    return null;
  })();
  const changedFromLive = baseline && JSON.stringify(baseline) !== JSON.stringify(pol);
  const ctx = { lead: L, pol, setP, item, money, denom, depositMode, segments, bands, total, endDay, pin, setPin, defaultDay };
  const swapEligibleNow = isSwapWindowOpen(defaultDay, L, pol);

  return (
    <div className="rp-root">
      <div className="page-head">
        <div>
          <h1>מתכנן זיכויים</h1>
          <p className="page-desc">
            כל כללי הביטול, ההחלפה והזיכוי בפס אחד. גוררים ורואים מיד מה זה אומר בכסף - לפי המדיניות שעודכנה 22.09.2026.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/admin/settings" className="btn btn-ghost btn-sm"><Icon id="i-settings" />הגדרות מערכת</Link>
        </div>
      </div>
      <RefundNav current="planner" />

      <div className="rp-shell">
        {/* ============ ימין: שדות למילוי ============ */}
        <aside className="rp-side">
          <div className="card rp-panel">
            <div className="rp-sec">
              <div className="rp-sec-title"><span className="rp-num">1</span>ההזמנה והפריט</div>
              <div className="field">
                <label>כמה ימים בין ההזמנה לאירוע?</label>
                <Stepper value={lead} onChange={setLead} min={0} max={MAX_LEAD} unit="ימים" label="ימים בין ההזמנה לאירוע" />
              </div>
              <div className="rp-two">
                <div className="field"><label>מחיר השמלה</label><Money value={item.price} onChange={(v) => setItem((s) => ({ ...s, price: v }))} label="מחיר השמלה" /></div>
                <div className="field"><label>עלות תיקונים</label><Money value={item.repairs} onChange={(v) => setItem((s) => ({ ...s, repairs: v }))} label="עלות תיקונים" /></div>
              </div>
              <div className="field">
                <label>פיקדון קבוע באזור האמצעי <span className="hint">(אופציונלי - גובר על האחוז)</span></label>
                <Money value={item.deposit} onChange={(v) => setItem((s) => ({ ...s, deposit: v }))} label="פיקדון" placeholder="ללא" />
              </div>
            </div>

            <div className="rp-sec">
              <div className="rp-sec-title">
                <span className="rp-num">2</span>שלוש המדרגות
                <span className={`rp-src badge ${loadState === 'ok' ? 'badge-success' : loadState === 'failed' ? 'badge-warning' : 'badge-neutral'}`}>
                  {loadState === 'ok' ? 'נטען מהמערכת' : loadState === 'failed' ? 'לא נטען - ברירות מחדל' : 'טוען…'}
                </span>
              </div>

              <div className="rp-rule t-full">
                <div className="rp-rule-top"><i />{LABELS.fullDays}</div>
                <Stepper value={policy.fullDays} onChange={(v) => setP({ fullDays: v })} unit="ימים מיום ההזמנה" label={LABELS.fullDays} />
                <div className="rp-rule-sub">ביטול עד היום ה-{pol.fullDays} מההזמנה - מוחזר במלואו. (0 = אין מדרגה כזו כלל, כמו בשני הגמ&quot;חים היום.)</div>
              </div>

              <div className="rp-rule t-partial">
                <div className="rp-rule-top"><i />אזור אמצעי</div>
                <div className="rp-pct-line">
                  <div className="rp-step">
                    <button type="button" onClick={() => setP({ percent: clamp(pol.percent - 5, 0, 100) })} aria-label="הפחת">−</button>
                    <input type="number" min="0" max="100" value={valueOrEmpty(policy.percent)} aria-label={LABELS.percent}
                      onChange={(e) => setP({ percent: e.target.value === '' ? '' : clamp(Number(e.target.value), 0, 100) })} />
                    <button type="button" onClick={() => setP({ percent: clamp(pol.percent + 5, 0, 100) })} aria-label="הוסף">+</button>
                  </div>
                  <span className="rp-unit">{LABELS.percent}</span>
                </div>
                <input className="rp-range" type="range" min="0" max="100" step="5" value={pol.percent} onChange={(e) => setP({ percent: Number(e.target.value) })} aria-label={LABELS.percent} />
                <div className="rp-rule-sub">{depositMode ? `פיקדון קבוע של ${fmtMoney(item.deposit)} גובר על האחוז.` : 'בשאר הימים מוחזר האחוז הזה משווי השמלה.'}</div>
              </div>

              <div className="rp-rule t-none">
                <div className="rp-rule-top"><i />{LABELS.noRefundDays}</div>
                <Stepper value={policy.noRefundDays} onChange={(v) => setP({ noRefundDays: v })} unit="ימים לפני האירוע" label={LABELS.noRefundDays} />
                <div className="rp-rule-sub">ב-{pol.noRefundDays} הימים האחרונים לפני האירוע אין החזר כלל - קרבה לאירוע תמיד גוברת.</div>
              </div>

              <Switch checked={pol.refundRepairs} onChange={(v) => setP({ refundRepairs: v })} title={LABELS.refundRepairs}
                sub={pol.refundRepairs ? 'תיקונים מוחזרים כמו השמלה.' : 'תיקונים תמיד נשארים כדמי ביטול.'} />
              <Switch checked={pol.refundTiersAtDeletion} onChange={(v) => setP({ refundTiersAtDeletion: v })} title={LABELS.refundTiersAtDeletion}
                sub={pol.refundTiersAtDeletion
                  ? 'דלוק: המדרגה נקבעת ברגע הביטול ולא משתנה אחר כך.'
                  : 'כבוי: המדרגה נקבעת מחדש בכל חישוב (למשל תשלום מאוחר) - הפס כאן מניח שמחשבים באותו רגע שבוטלו, לתמונה המלאה כשזה כבוי יש לסימולטור האמיתי.'} />
            </div>

            <div className="rp-sec">
              <div className="rp-sec-title"><span className="rp-num">3</span>ביטול מיידי</div>
              <div className="rp-rule t-credit">
                <div className="rp-rule-top"><i />{LABELS.instantUndoMinutes}</div>
                <NullableStepper value={policy.instantUndoMinutes} onChange={(v) => setP({ instantUndoMinutes: v })}
                  fallback={pol.creditMinutes} max={10080} unit="דק׳" label={LABELS.instantUndoMinutes} />
                <div className="rp-rule-sub">פריט שנוסף ובוטל בתוך {pol.effectiveInstantUndoMinutes} דקות - לא נספר כלל: בלי חיוב, בלי זיכוי, בלי דמי ביטול. 0 = כבוי.</div>
              </div>
            </div>

            <div className="rp-sec">
              <div className="rp-sec-title"><span className="rp-num">4</span>זיכוי על פריט חלופי</div>
              <Stepper value={policy.creditMinutes} onChange={(v) => setP({ creditMinutes: v })} max={10080} unit="דקות" label={LABELS.creditMinutes} />
              <div className="rp-rule-sub" style={{ marginTop: 8 }}>
                {pol.creditMinutes > 0
                  ? `שמלה שהוסיפו תוך ${pol.creditMinutes} דקות מהביטול - מקבלת את דמי הביטול (חלק השמלה בלבד) כזיכוי מלא, עד מחירה.`
                  : 'כבוי (0 דקות): דמי הביטול תמיד נגבים במלואם, גם אם באותה עריכה נוסף פריט אחר.'}
                {' '}נפרד לגמרי מ&quot;ביטול מיידי&quot; למעלה.
              </div>
            </div>

            <div className="rp-sec">
              <div className="rp-sec-title"><span className="rp-num">5</span>{LABELS.sameModelSwap}</div>
              <Switch checked={pol.sameModelSwap} onChange={(v) => setP({ sameModelSwap: v })} title="חינם לגמרי, בלי קשר למדרגות"
                sub={pol.sameModelSwap ? 'דלוק' : 'כבוי (ברירת מחדל) - כל החלפה נחשבת ביטול רגיל'} />
              {pol.sameModelSwap && (
                <div className="rp-swap-sub-panel">
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>{LABELS.swapMinDays}</label>
                    <Stepper value={policy.swapMinDays} onChange={(v) => setP({ swapMinDays: v })} max={MAX_LEAD} unit="ימים (0 = בלי הגבלה)" label={LABELS.swapMinDays} />
                  </div>
                  <Switch checked={pol.swapSameCategoryOnly} onChange={(v) => setP({ swapSameCategoryOnly: v })} title={LABELS.swapSameCategoryOnly}
                    sub={pol.swapSameCategoryOnly ? 'רק בין מידות באותה שורת מחיר' : 'אפשר בין כל מידות אותו דגם'} />
                  <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                    <label>{LABELS.swapPairingWindowMinutes}</label>
                    <Stepper value={policy.swapPairingWindowMinutes} onChange={(v) => setP({ swapPairingWindowMinutes: v })} max={10080} unit="דקות (0 = בלי הגבלה)" label={LABELS.swapPairingWindowMinutes} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <ApplyPanel policy={policy} pol={pol} baseline={baseline} names={names} loadState={loadState}
            onApplied={(p) => setBaseline(p)} onReset={() => baseline && setPolicy(baseline)} />
        </aside>

        {/* ============ שמאל: פס אחד ============ */}
        <section className="rp-main">
          {notice && <div className={`callout callout-${notice.kind}`}><Icon id="i-alert-tri" /><span>{notice.text}</span></div>}

          <div className="rp-bands four">
            <button type="button" className="rp-band t-credit" onClick={() => setPin({ kind: 'min', v: 1 })}>
              <div className="rp-band-name"><i />ביטול מיידי</div>
              <div className="rp-band-big">₪0<small>חיוב</small></div>
              <div className="rp-band-sub">עד <b>{pol.effectiveInstantUndoMinutes} דקות</b> מההוספה - כאילו לא נוסף</div>
            </button>
            {['full', 'partial', 'none'].map((t) => {
              const b = bands[t];
              const mm = money[t];
              const big = t === 'partial' && depositMode ? fmtMoney(mm.refund) : fmtPct(mm.refundPct);
              return (
                <button type="button" key={t} className={`rp-band t-${t}${b ? '' : ' off'}`} onClick={() => b && setPin({ kind: 'day', v: b.from })} disabled={!b}>
                  <div className="rp-band-name"><i />{TIERS[t].label}</div>
                  <div className="rp-band-big">{b ? big : '—'}<small>{b ? `· ${b.count} ${dayWord(b.count)}` : ''}</small></div>
                  <div className="rp-band-sub">
                    {!b ? 'לא קיים במקרה הזה.'
                      : t === 'full' ? <>ימים <b>0–{b.to}</b> מההזמנה</>
                      : t === 'partial' ? <>ימים <b>{b.from}–{b.to}</b> · מוחזר {fmtMoney(mm.refund)}</>
                      : <>מיום <b>{b.from}</b> ועד האירוע · נשאר {fmtMoney(mm.fee)}</>}
                  </div>
                </button>
              );
            })}
          </div>
          {pol.sameModelSwap && (
            <div className={`callout ${swapEligibleNow ? 'callout-success' : 'callout-warning'}`}>
              <Icon id={swapEligibleNow ? 'i-check-circle' : 'i-alert-tri'} />
              <span>
                החלפת מידה חינם פתוחה מיום ההזמנה ועד <b>{pol.swapMinDays}</b> ימים לפני האירוע
                {pol.swapSameCategoryOnly ? ', ורק בין מידות באותה שורת מחיר' : ''} - ר&apos; הפס המקווקו למטה.
              </span>
            </div>
          )}

          <div className="card rp-tl">
            <div className="rp-tl-head">
              <div>
                <div className="rp-tl-title">מה קורה אם מבטלים - מהדקה הראשונה ועד האירוע?</div>
                <div className="rp-tl-sub">גובה העמודה = כמה חוזר ללקוחה. גררו את הכפתורים הצבעוניים, ואת הקו המקווקו למעלה/למטה כדי למתוח את האחוז.</div>
              </div>
              <div className="rp-chips">
                <span className="chip">{L} ימים בין ההזמנה לאירוע</span>
                {changedFromLive && <span className="chip" style={{ background: 'var(--warning-tint)', color: 'var(--warning)' }}>שונה מהמערכת</span>}
              </div>
            </div>
            <UnifiedTimeline ctx={ctx} />
          </div>

          <details className="card card-pad rp-howto">
            <summary className="rp-howto-title">איך לקרוא את הפס (הסבר מלא)</summary>
            <ul className="rp-notes">
              <li><b>הצד הימני (דקות):</b> פריט שנוסף ובוטל תוך {pol.effectiveInstantUndoMinutes} דקות (&quot;ביטול מיידי&quot;) לא נספר כלל. פריט ישן מהמערכת הקודמת (Access) לעולם לא נחשב כך.</li>
              <li><b>אחרי זה (ימים):</b> שלוש המדרגות - החזר מלא, אזור אמצעי, ללא החזר. קרבה לאירוע תמיד גוברת.</li>
              <li><b>פס &quot;פריט חלופי&quot;:</b> נפרד לגמרי מ&quot;ביטול מיידי&quot; - יש לו דקות משלו ({LABELS.creditMinutes}). כשיש דמי ביטול על שמלה מבוטלת, ושמלה חדשה נוספת באותה הזמנה תוך הזמן הזה מרגע <b>שמירת</b> הביטול - דמי הביטול (חלק השמלה, לא תיקונים) הופכים לזיכוי מלא עליה, עד מחירה. 0 דקות = כבוי לגמרי.</li>
              <li><b>פס &quot;החלפת מידה&quot;:</b> כשדלוק, ביטול שמלה עם שמלה פעילה אחרת מאותו דגם (ולפי הצורך גם אותה שורת מחיר) בתוך החלון שנקבע לפני האירוע מזוכה במלואו, בלי קשר למדרגות - הלקוח/ה משלמ/ת רק הפרש מחיר. יש גם חלון זמן בין המחיקה להוספה (לא מוצג כאן ברמת יום; ר&apos; טופס).</li>
              <li>מידה שנופלת בין שני טווחי מחיר במחירון, ועריכת מידה ישירה בתוך הפריט אחרי 15 הדקות הראשונות, הן כללים נוספים שלא קשורים לציר הזמן הזה - התיעוד המלא ב<Link href="/admin/refund-policy">מדיניות זיכויים וביטולים</Link>.</li>
            </ul>
          </details>

          <div className="callout callout-info">
            <Icon id="i-info" />
            <span>
              כדי לראות הזמנה מלאה עם תאריכים אמיתיים, כמה פריטים, מחירון אמיתי ומועד חישוב-מחדש נפרד מרגע הביטול - עברו ל
              <Link href="/admin/refund-simulator" style={{ color: 'inherit', fontWeight: 800, textDecoration: 'underline' }}> סימולטור האמיתי</Link>,
              שמריץ את מנוע החישוב של המערכת עצמו. כאן זו הדגמה ברמת יום, פריט אחד: לא כוללת תוספת חו״ל, מחירון עם טווחי גודל, שרשראות החלפה, ובאותו יום גבול התוצאה האמיתית תלויה גם בשעת ההזמנה.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
