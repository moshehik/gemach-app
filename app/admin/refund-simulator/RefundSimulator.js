'use client';

// סימולטור זיכויים אמיתי - /admin/refund-simulator
// בונים הזמנה דמיונית (תאריכים + פריטים), בוחרים מתי מבטלים, ורואים מה מנוע החישוב האמיתי של
// המערכת (lib/pricingEngine.js -> computeOrderObligations, דרך POST /api/admin/refund-simulate)
// היה מחייב / מזכה / משאיר כדמי ביטול. שום דבר לא נשמר ולא נוגע בהזמנות אמיתיות.

import { useEffect, useMemo, useRef, useState } from 'react';
import { TIERS, normalizePolicy, ymdToDay, dayToYmd, tierForDay, buildSegments } from '@/lib/refundSimulator';
import { findPriceRowForSize, isSamePriceBand, normalizeGapRule } from '@/lib/priceRows';
import {
  KEYS, LABELS, clamp, valueOrEmpty, fmtMoney, fmtDM, fmtDMY, hebShort, weekday, isSaturday,
  Icon, RefundNav, Stepper, Switch, NullableStepper, ApplyPanel, useLivePolicy,
} from '../refund-planner/shared';
import './refund-simulator.css';

// כתובת ה-API של הסימולטור (אדמין בלבד).
const API = '/api/admin/refund-simulate';

const MAX_ITEMS = 8;
const MODELS = ['א', 'ב', 'ג'];
const ADDED_OPTIONS = [
  ['order', 'בעת ביצוע ההזמנה'],
  ['cancel', 'ברגע הביטול (עכשיו)'],
  ['before', 'לפני X דקות מהעכשיו'],
  ['custom', 'תאריך מותאם'],
];
const POLICY_KEYS = Object.values(KEYS);

const isRepairCat = (c) => c === 'תיקונים' || c === 'תיקון אורך';
const isAbroadCat = (c) => c === 'חול' || c === 'חו"ל';

// ---------- תאריכים ושעות (מקומי) ----------
const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseLocal = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dayOfInput = (s) => ymdToDay(String(s || '').slice(0, 10));
const timeOfInput = (s) => String(s || '').slice(11, 16) || '09:00';
const withDay = (s, day) => `${dayToYmd(day)}T${timeOfInput(s)}`;
const localDayOf = (d) => ymdToDay(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
const localDayFloat = (ms) => {
  const d = new Date(ms);
  return localDayOf(d) + (d.getHours() * 60 + d.getMinutes()) / 1440;
};
const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDT = (d) => `${fmtDMY(localDayOf(d))} ${fmtClock(d)}`;
const daysWord = (n) => (Math.abs(n) === 1 ? 'יום' : 'ימים');

// ---------- לוגיקה מקבילה למנוע (רק לתצוגה; החישוב עצמו מגיע מהשרת) ----------
// אזור ההחזר כפי שהמנוע קובע אותו: השוואת רגעים מלאים (לא רק ימים), בדיוק כמו ב-computeOrderObligations.
function engineTier(orderMs, eventMs, nowMs, pol) {
  const fullCut = new Date(orderMs);
  fullCut.setDate(fullCut.getDate() + pol.fullDays);
  const noCut = new Date(eventMs);
  noCut.setDate(noCut.getDate() - pol.noRefundDays);
  if (nowMs >= noCut.getTime()) return 'none';
  if (nowMs <= fullCut.getTime()) return 'full';
  return 'partial';
}

// התאמת שורת מחירון לפריט - אותו כלל בדיוק כמו המנוע (lib/priceRows.js), כולל כלל המידות
// שבין שני טווחים (gap_size_price_rule). לפריט מחוק המנוע לא מסנן לפי תאריך אירוע - eventDate=null.
function matchPrice(priceList, category, size, eventDate, gapRule = 'none') {
  const opts = { eventDate: eventDate || null, gapRule };
  const direct = findPriceRowForSize(priceList, category, size, opts);
  const viaVariant = direct.row ? direct : findPriceRowForSize(priceList, String(category).replace('כלול ב', '').trim(), size, opts);
  return viaVariant.row ? { ...viaVariant.row, viaGap: viaVariant.viaGap } : null;
}

// מראה מקביל (לצורך התיוג/הטקסט בלבד - הכסף האמיתי מגיע תמיד משורות המנוע) של זיווג ההחלפה
// ב-lib/pricingCalc.js: פריט מחוק מזווג עם פריט "יורש" (פעיל, או פריט אחר שנמחק מאוחר יותר -
// שרשרת החלפות) מאותו דגם, בתנאי המרחק-מהאירוע/קטגוריה/חלון-הזיווג. מחזיר Map מפריט-מחוק למזווג.
function computeSwapPairs(items, priceList, eventDate, pol, gapRule) {
  const pairs = new Map();
  if (!pol.sameModelSwap) return pairs;
  const bandOf = (it) => matchPrice(priceList, it.priceCategory, it.size, null, gapRule);
  const sameBand = (a, b) => {
    const ra = bandOf(a); const rb = bandOf(b);
    if (ra && rb) return ra.id !== undefined && ra.id === rb.id;
    if (!ra && !rb) return a.priceCategory === b.priceCategory && Number(a.size) === Number(b.size);
    return false;
  };
  const passesMinDays = (delItem) => {
    if (!(pol.swapMinDays > 0) || !eventDate) return true;
    const eventDay = localDayOf(eventDate);
    const refDay = localDayOf(new Date(delItem.deletedAt));
    return (eventDay - refDay) >= pol.swapMinDays;
  };
  const deleted = items.filter((it) => it.deletedAt).sort((a, b) => new Date(a.deletedAt) - new Date(b.deletedAt));
  const eligible = deleted.filter((d) => passesMinDays(d));
  const activeByModel = new Map();
  for (const it of items) {
    if (it.deletedAt) continue;
    if (!activeByModel.has(it.modelId)) activeByModel.set(it.modelId, []);
    activeByModel.get(it.modelId).push(it);
  }
  const claimed = new Set();
  if (pol.swapPairingWindowMinutes > 0) {
    const windowMs = pol.swapPairingWindowMinutes * 60000;
    const candidates = [];
    eligible.forEach((d, di) => {
      const delTime = new Date(d.deletedAt).getTime();
      const successors = [
        ...(activeByModel.get(d.modelId) || []),
        ...deleted.filter((o) => o !== d && o.modelId === d.modelId),
      ];
      successors.forEach((a, ai) => {
        if (!a.createdAt) return;
        const distance = Math.abs(new Date(a.createdAt).getTime() - delTime);
        if (distance > windowMs) return;
        if (pol.swapSameCategoryOnly && !sameBand(d, a)) return;
        candidates.push({ d, a, distance, di, ai });
      });
    });
    candidates.sort((x, y) => x.distance - y.distance || x.di - y.di || x.ai - y.ai);
    for (const { d, a } of candidates) {
      if (pairs.has(d) || claimed.has(a)) continue;
      pairs.set(d, a); claimed.add(a);
    }
  } else {
    for (const d of eligible) {
      const a = (activeByModel.get(d.modelId) || []).find((cand) => !claimed.has(cand) && (!pol.swapSameCategoryOnly || sameBand(d, cand)));
      if (!a) continue;
      pairs.set(d, a); claimed.add(a);
    }
  }
  return pairs;
}

const kindOf = (r) => {
  const d = r.description || '';
  if (d.startsWith('חיוב מקורי')) return 'orig';
  if (d.startsWith('זיכוי בגין ביטול')) return 'reverse';
  if (d.startsWith('דמי ביטול')) return 'fee';
  if (d.startsWith('זיכוי דמי ביטול')) return 'credit';
  return 'charge';
};

// מפרש את תשובת המנוע: סכומים כוללים + פסק דין לכל פריט. gapRule מגיע מהגדרת המערכת
// gap_size_price_rule (לא חלק מ-pol - זו הגדרת מחירון, לא כלל זמן).
function analyze({ data, payload, pol, priceList, gapRule = 'none' }) {
  const rows = (data.newObligations || []).map((r) => ({ ...r, amount: Number(r.amount) || 0, kind: kindOf(r) }));
  const sumK = (k) => rows.filter((r) => r.kind === k).reduce((s, r) => s + r.amount, 0);
  const nowMs = new Date(payload.now).getTime();
  const orderMs = new Date(payload.order.orderDate).getTime();
  const eventMs = new Date(payload.order.eventDate).getTime();
  const tier = engineTier(orderMs, eventMs, nowMs, pol); // לתקציר העליון ולתגית "יום הגבול" - לפי "עכשיו"
  const nowDay = localDayOf(new Date(nowMs));
  const orderDay = localDayOf(new Date(orderMs));
  const eventDay = localDayOf(new Date(eventMs));
  const dayTier = tierForDay(nowDay, orderDay, eventDay, pol);
  const items = payload.items;
  const eventDate = new Date(payload.order.eventDate);
  const instant = payload.instantUndoMinutes; // ה"אפקטיבי" - מגיע מוכן מהעמוד (fallback לחלון הזיכוי)
  const swapPairs = computeSwapPairs(items, priceList, eventDate, pol, gapRule);
  const pairedActiveIds = new Set([...swapPairs.values()].map((a) => a.id));

  const verdicts = items.map((it) => {
    const mine = rows.filter((r) => String(r.orderItemId) === String(it.id));
    const sm = (k) => mine.filter((r) => r.kind === k).reduce((s, r) => s + r.amount, 0);
    const charge = sm('charge');
    const reverse = -sm('reverse');
    const fee = sm('fee');
    const credit = -sm('credit');
    const price = matchPrice(priceList, it.priceCategory, it.size, eventDate, gapRule);
    const base = { item: it, mine, charge, reverse, fee, credit };
    const letter = String(it.modelId).replace('m-', '');
    if (!it.deletedAt) {
      const swapNote = pairedActiveIds.has(it.id) ? ' (זו ה"יורשת" של שמלה מבוטלת - החלפת מידה חינם).' : '';
      return { ...base, cls: 'v-active', chip: 'פעיל', text: (charge > 0 ? `נשאר בהזמנה. חיוב: ${fmtMoney(charge)}.` : 'נשאר בהזמנה, אבל לא נמצא מחיר במחירון לקטגוריה ולמידה האלה - החיוב 0.') + swapNote };
    }
    // רגע ההתייחסות למדרגה: לפי רגע הביטול בפועל כשההגדרה דלוקה, אחרת לפי "עכשיו" (רגע החישוב) - בדיוק כמו המנוע.
    const refMs = pol.refundTiersAtDeletion ? new Date(it.deletedAt).getTime() : nowMs;
    const itemTier = engineTier(orderMs, eventMs, refMs, pol);
    const refDay = localDayOf(new Date(refMs));
    if (mine.length === 0) {
      const life = it.createdAt ? new Date(it.deletedAt).getTime() - new Date(it.createdAt).getTime() : null;
      const isInstant = life !== null && life >= 0 && instant > 0 && life <= instant * 60000;
      if (isInstant) {
        const mins = Math.round(life / 60000);
        return { ...base, cls: 'v-ok', chip: 'ביטול מיידי', text: `נוסף ובוטל ${mins > 0 ? `בתוך ${mins} דקות` : 'באותו רגע'} (עד ${instant} דקות נחשב ביטול מיידי), ולכן הפריט לא נספר בכלל - בלי חיוב, בלי זיכוי ובלי דמי ביטול.` };
      }
      return { ...base, cls: 'v-neutral', chip: 'ללא מחיר', text: 'לא נמצא מחיר במחירון לקטגוריה ולמידה האלה, ולכן אין חיוב, זיכוי או דמי ביטול.' };
    }
    if (swapPairs.has(it)) {
      const a = swapPairs.get(it);
      const aLetter = String(a.modelId).replace('m-', '');
      return { ...base, cls: 'v-ok', chip: 'החלפת מידה', text: `זוהתה כהחלפה עם שמלה ${a.id} (דגם ${aLetter}) - זיכוי מלא על השמלה ובלי דמי ביטול, בלי קשר למדרגות.${fee > 0 ? ` תיקונים (${fmtMoney(fee)}) נשארים כחיוב.` : ''}` };
    }
    const sinceOrder = refDay - orderDay;
    const untilEvent = eventDay - refDay;
    const refund = Math.max(0, reverse - fee);
    const amounts = [['מוחזר', refund, 'get'], ['דמי ביטול', fee, 'keep']];
    const whenNote = pol.refundTiersAtDeletion && refMs !== nowMs ? ' (המדרגה ננעלה ברגע הביטול, לא ברגע החישוב הנוכחי.)' : '';
    if (credit > 0) {
      const left = Math.max(0, fee - credit);
      return {
        ...base, cls: 'v-info', chip: 'זיכוי על פריט חדש', amounts: [['מוחזר', refund, 'get'], ['נוצל על פריט חדש', credit, 'get'], ['נשאר', left, 'keep']],
        text: `נקבעו דמי ביטול של ${fmtMoney(fee)}, אבל נוסף פריט חדש בתוך חלון הזיכוי - דמי הביטול נוצלו עליו (${fmtMoney(credit)})${left > 0 ? `, ונשארו ${fmtMoney(left)} (תיקונים / חלק שלא נוצל)` : ', ולכן לא נשארו דמי ביטול'}.`,
      };
    }
    const hint = fee > 0 && pol.creditMinutes > 0 && itemTier !== 'full'
      ? 'טיפ: פריט חלופי שנוסף בתוך חלון הזיכוי היה מקזז את דמי הביטול (כפתור "פריט חלופי" בשלב 3).' : null;
    if (itemTier === 'full') {
      return { ...base, cls: 't-full', chip: TIERS.full.label, amounts, hint, text: `בוטל ${sinceOrder} ${daysWord(sinceOrder)} אחרי ההזמנה - בתוך חלון ההחזר המלא (${pol.fullDays} ימים) והאירוע עוד רחוק. מוחזר ${fmtMoney(refund)}${fee > 0 ? `, ונשארו ${fmtMoney(fee)} על תיקונים` : ''}.${whenNote}` };
    }
    if (itemTier === 'none') {
      return { ...base, cls: 't-none', chip: TIERS.none.label, amounts, hint, text: `נשארו ${untilEvent} ${daysWord(untilEvent)} לאירוע - פחות מ-${pol.noRefundDays} ימים, ולכן אין החזר (הקרבה לאירוע גוברת על כל חלון אחר). ${fee > 0 ? `דמי ביטול: ${fmtMoney(fee)}.` : ''}${whenNote}` };
    }
    const dep = price && Number(price.deposit) > 0 ? Number(price.deposit) : 0;
    return { ...base, cls: 't-partial', chip: TIERS.partial.label, amounts, hint, text: `בוטל ${sinceOrder} ימים אחרי ההזמנה ועוד ${untilEvent} ימים לאירוע - אזור אמצעי. ${dep > 0 ? `במחירון מוגדר פיקדון קבוע (${fmtMoney(dep)}) והוא גובר על האחוז` : `מוחזרים ${pol.percent}% מהמחיר`}: מוחזר ${fmtMoney(refund)}, ונשארו ${fmtMoney(fee)} דמי ביטול.${whenNote}` };
  });

  const fees = sumK('fee');
  const credits = -sumK('credit');
  const cancelledOrig = sumK('orig');
  const activeCharge = sumK('charge');
  return {
    rows, tier, dayTier, verdicts,
    originalTotal: activeCharge + cancelledOrig,
    activeCharge, cancelledOrig,
    refundGross: Math.max(0, -sumK('reverse') - fees),
    feeNet: fees - credits,
    absorbed: credits,
    totalNow: rows.reduce((s, r) => s + r.amount, 0),
  };
}

// ---------- ברירות מחדל מהמחירון האמיתי ----------
function pickDefaultRow(priceList, eventDate) {
  const cands = priceList.filter((p) => !isRepairCat(p.category) && !isAbroadCat(p.category) && Number(p.price) > 0
    && !(p.startDate && eventDate < new Date(p.startDate)) && !(p.endDate && eventDate > new Date(p.endDate)));
  if (!cands.length) return null;
  // השמלה הראשונה בקטגוריה שמחירה הכי קרוב ל-250 (כך שהתוצאה משמעותית מיד בטעינה)
  return cands.reduce((best, p) => (Math.abs(p.price - 250) < Math.abs(best.price - 250) ? p : best), cands[0]);
}

let uid = 0;
const newItem = (over = {}) => ({
  key: `it${++uid}`, category: '', size: 38, model: 'א', neck: false, sleeve: false, lengthOn: false, length: '5 ס״מ',
  added: 'order', beforeMin: 5, customAt: '', status: 'active',
  cancelWhen: 'now', cancelDaysBefore: 1, cancelAt: '', // רלוונטי רק כש-status הוא 'cancelled'
  ...over,
});

// ---------- כרטיס פריט ----------
function ItemCard({ item, index, cats, priceList, eventDate, onChange, onDuplicate, onRemove, canDuplicate }) {
  const price = matchPrice(priceList, item.category, item.size, eventDate);
  const set = (patch) => onChange(item.key, patch);
  const id = `rs-i${item.key}`;
  return (
    <div className={`rs-item ${item.status === 'cancelled' ? 'is-cancelled' : ''}`}>
      <div className="rs-item-head">
        <b>שמלה {index + 1}</b>
        <div className="rs-seg" role="group" aria-label={`סטטוס שמלה ${index + 1}`}>
          <button type="button" className={item.status === 'active' ? 'on' : ''} onClick={() => set({ status: 'active' })} aria-pressed={item.status === 'active'}>פעיל</button>
          <button type="button" className={`${item.status === 'cancelled' ? 'on bad' : ''}`} onClick={() => set({ status: 'cancelled' })} aria-pressed={item.status === 'cancelled'}>מבוטל</button>
        </div>
        <span className="rs-item-actions">
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => onDuplicate(item.key)} disabled={!canDuplicate} aria-label="שכפל פריט" title="שכפל"><Icon id="i-copy" /></button>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => onRemove(item.key)} aria-label="הסר פריט" title="הסר"><Icon id="i-trash" /></button>
        </span>
      </div>

      <div className="field">
        <label htmlFor={`${id}-cat`}>קטגוריית מחיר</label>
        <select id={`${id}-cat`} className="select" value={item.category} onChange={(e) => set({ category: e.target.value })}>
          {!cats.includes(item.category) && <option value={item.category}>{item.category || 'בחרו קטגוריה'}</option>}
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className={`rs-price ${price ? '' : 'none'}`}>
          {price
            ? <>מחיר במחירון: <b>{fmtMoney(price.price)}</b>{Number(price.deposit) > 0 ? <> · פיקדון קבוע {fmtMoney(price.deposit)}</> : null}</>
            : 'אין מחיר במחירון למידה הזו (בתאריך האירוע) - החיוב יהיה 0'}
        </div>
      </div>

      <div className="rp-two">
        <div className="field">
          <label htmlFor={`${id}-size`}>מידה</label>
          <input id={`${id}-size`} className="input" type="number" inputMode="numeric" min="0" value={valueOrEmpty(item.size)}
            onChange={(e) => set({ size: e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value))) })} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-model`}>דגם</label>
          <select id={`${id}-model`} className="select" value={item.model} onChange={(e) => set({ model: e.target.value })}>
            {MODELS.map((m) => <option key={m} value={m}>דגם {m}</option>)}
          </select>
        </div>
      </div>

      <div className="rs-checks">
        <label className="rs-check"><input type="checkbox" checked={item.neck} onChange={(e) => set({ neck: e.target.checked })} />תיקון צוואר</label>
        <label className="rs-check"><input type="checkbox" checked={item.sleeve} onChange={(e) => set({ sleeve: e.target.checked })} />תיקון שרוול</label>
        <label className="rs-check"><input type="checkbox" checked={item.lengthOn} onChange={(e) => set({ lengthOn: e.target.checked })} />תיקון אורך</label>
      </div>
      {item.lengthOn && (
        <div className="field">
          <label htmlFor={`${id}-len`}>כמה לקצר</label>
          <input id={`${id}-len`} className="input" type="text" value={item.length} onChange={(e) => set({ length: e.target.value })} placeholder="5 ס״מ" />
        </div>
      )}

      <div className="field">
        <label htmlFor={`${id}-added`}>מתי נוסף להזמנה</label>
        <select id={`${id}-added`} className="select" value={item.added} onChange={(e) => set({ added: e.target.value })}>
          {ADDED_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {item.added === 'before' && (
          <div className="rs-inline">
            <span>לפני</span>
            <input className="input" type="number" inputMode="numeric" min="0" value={valueOrEmpty(item.beforeMin)} aria-label="דקות לפני העכשיו"
              onChange={(e) => set({ beforeMin: e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value))) })} />
            <span>דקות</span>
          </div>
        )}
        {item.added === 'custom' && (
          <input className="input" type="datetime-local" value={item.customAt} onChange={(e) => set({ customAt: e.target.value })} aria-label="מועד הוספה מותאם" />
        )}
      </div>

      {item.status === 'cancelled' && (
        <div className="field">
          <label htmlFor={`${id}-cancelwhen`}>מתי בוטל בפועל</label>
          <select id={`${id}-cancelwhen`} className="select" value={item.cancelWhen} onChange={(e) => set({ cancelWhen: e.target.value })}>
            <option value="now">עכשיו (רגע החישוב/השמירה)</option>
            <option value="daysBefore">לפני X ימים מעכשיו</option>
            <option value="custom">תאריך מותאם</option>
          </select>
          {item.cancelWhen === 'daysBefore' && (
            <div className="rs-inline">
              <span>לפני</span>
              <input className="input" type="number" inputMode="numeric" min="0" value={valueOrEmpty(item.cancelDaysBefore)} aria-label="ימים לפני העכשיו"
                onChange={(e) => set({ cancelDaysBefore: e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value))) })} />
              <span>ימים</span>
            </div>
          )}
          {item.cancelWhen === 'custom' && (
            <input className="input" type="datetime-local" value={item.cancelAt} onChange={(e) => set({ cancelAt: e.target.value })} aria-label="מועד ביטול מותאם" />
          )}
          {item.cancelWhen !== 'now' && (
            <div className="rs-tip" style={{ marginTop: 6 }}>
              שונה מ&quot;עכשיו&quot; - רלוונטי לבדיקת &quot;{LABELS.refundTiersAtDeletion}&quot; בשלב 4: כשההגדרה כבויה, המדרגה נקבעת לפי &quot;עכשיו&quot; ולא לפי המועד הזה.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const Money2 = ({ n, sign }) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const abs = Math.abs(v).toLocaleString('he-IL', { maximumFractionDigits: 2 });
  const s = sign ? (v > 0 ? '+' : v < 0 ? '−' : '') : (v < 0 ? '−' : '');
  return <span dir="ltr" className="rs-amt">{s}₪{abs}</span>;
};

// ---------- הדף ----------
export default function RefundSimulator() {
  const { policy, setPolicy, baseline, setBaseline, names, loadState } = useLivePolicy();
  const [catalog, setCatalog] = useState({ state: 'loading', priceList: [], extra: [], error: '' });
  const [order, setOrder] = useState(null); // { orderAt, eventDate, isAbroad }
  const [nowAt, setNowAt] = useState('');
  const [items, setItems] = useState([]);
  const [note, setNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const [laneW, setLaneW] = useState(700);
  const [result, setResult] = useState(null); // { data, payload, pol, priceList }
  const [pending, setPending] = useState(false);
  const [apiError, setApiError] = useState(null);
  const zoneRef = useRef(null);
  const initRef = useRef(false);

  // ---------- טעינת המחירון החי ----------
  const loadCatalog = async () => {
    setCatalog((c) => ({ ...c, state: 'loading', error: '' }));
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (res.status === 401) throw new Error('auth');
      if (!res.ok) throw new Error('server');
      const body = await res.json();
      const priceList = Array.isArray(body.priceList) ? body.priceList : [];
      const extra = (body.settings || []).filter((s) => !POLICY_KEYS.includes(s.key));
      setCatalog({ state: 'ok', priceList, extra, error: '' });
      if (!initRef.current) {
        initRef.current = true;
        const now = new Date();
        now.setSeconds(0, 0);
        const eventD = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 45);
        const cancel = new Date(now.getTime());
        cancel.setDate(cancel.getDate() + 20);
        const row = pickDefaultRow(priceList, eventD);
        const size = row ? Math.min(Math.max(38, row.fromSize || 0), row.toSize == null ? Infinity : row.toSize) : 38;
        setNowAt(toLocalInput(cancel));
        setItems([newItem({ category: row ? row.category : '', size, status: 'cancelled' })]);
        setOrder({ orderAt: toLocalInput(now), eventDate: `${eventD.getFullYear()}-${pad(eventD.getMonth() + 1)}-${pad(eventD.getDate())}`, isAbroad: false });
      }
    } catch (e) {
      setCatalog((c) => ({ ...c, state: 'error', error: e.message === 'auth' ? 'auth' : 'server' }));
    }
  };
  useEffect(() => { loadCatalog(); }, []);

  const priceList = catalog.priceList;
  const ready = catalog.state === 'ok' && !!order;
  const cats = useMemo(() => [...new Set(priceList.map((p) => p.category).filter((c) => c && !isRepairCat(c) && !isAbroadCat(c)))], [priceList]);
  const abroadRow = useMemo(() => priceList.find((p) => isAbroadCat(p.category) && p.price), [priceList]);

  // ---------- חישובי מצב ----------
  const pol = useMemo(() => normalizePolicy(policy), [policy]);
  const orderD = ready ? parseLocal(order.orderAt) : null;
  const nowD = ready ? parseLocal(nowAt) : null;
  const eventD = ready ? parseLocal(`${order.eventDate}T00:00`) : null;
  const orderDay = orderD ? localDayOf(orderD) : NaN;
  const eventDay = eventD ? localDayOf(eventD) : NaN;
  const nowDay = nowD ? localDayOf(nowD) : NaN;
  const datesOk = Number.isFinite(orderDay) && Number.isFinite(eventDay) && Number.isFinite(nowDay);
  const eventBeforeOrder = datesOk && eventDay < orderDay;
  const tooLong = datesOk && !eventBeforeOrder && eventDay - orderDay > 1500;
  const timelineOk = datesOk && !eventBeforeOrder && !tooLong;
  const TAIL = 3;
  const startDay = orderDay;
  const endDay = timelineOk ? eventDay + TAIL : 0;
  const total = timelineOk ? endDay - startDay + 1 : 1;

  useEffect(() => {
    const el = zoneRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setLaneW(el.getBoundingClientRect().width || 700));
    ro.observe(el);
    return () => ro.disconnect();
  }, [timelineOk]);

  // gap_size_price_rule מגיע כהגדרת מחירון גולמית (לא חלק מ-pol - זו לא הגדרת "זמן").
  const gapRule = useMemo(() => normalizeGapRule(catalog.extra.find((s) => s.key === 'gap_size_price_rule')?.value), [catalog.extra]);

  // ---------- גוף הבקשה למנוע ----------
  const payload = useMemo(() => {
    if (!ready || !datesOk || eventBeforeOrder) return null;
    const nowMs = nowD.getTime();
    const orderMs = orderD.getTime();
    const resolveAdded = (it) => {
      if (it.added === 'cancel') return nowMs;
      if (it.added === 'before') return nowMs - (Number(it.beforeMin) || 0) * 60000;
      if (it.added === 'custom') { const c = parseLocal(it.customAt); return c ? c.getTime() : orderMs; }
      return orderMs;
    };
    // מתי הפריט בוטל בפועל - יכול להיות שונה מ"עכשיו" (רגע החישוב/השמירה), בדיוק כדי לבדוק את
    // "מדרגות ההחזר לפי רגע הביטול" (refund_tiers_at_deletion_time): כשהיא כבויה במערכת, מה
    // שקובע את המדרגה הוא "עכשיו", לא מתי שבאמת ביטלו.
    const resolveCancelled = (it) => {
      if (it.cancelWhen === 'daysBefore') return nowMs - (Number(it.cancelDaysBefore) || 0) * 86400000;
      if (it.cancelWhen === 'custom') { const c = parseLocal(it.cancelAt); return c ? c.getTime() : nowMs; }
      return nowMs;
    };
    return {
      order: { orderDate: orderD.toISOString(), eventDate: eventD.toISOString(), isAbroad: !!order.isAbroad },
      items: items.map((it, i) => ({
        id: i + 1,
        name: `שמלה ${i + 1} - דגם ${it.model}`,
        modelId: `m-${it.model}`,
        priceCategory: it.category,
        size: it.size === '' ? null : Number(it.size),
        neck: it.neck,
        sleeve: it.sleeve,
        length: it.lengthOn ? (String(it.length).trim() || '5 ס״מ') : '',
        createdAt: new Date(resolveAdded(it)).toISOString(),
        deletedAt: it.status === 'cancelled' ? new Date(clamp(resolveCancelled(it), -8640000000000000, nowMs)).toISOString() : null,
      })),
      now: nowD.toISOString(),
      instantUndoMinutes: pol.effectiveInstantUndoMinutes, // לשימוש בתצוגה בלבד (analyze) - לא נשלח כהגדרה כפולה
      settings: [
        { key: KEYS.fullDays, value: String(pol.fullDays) },
        { key: KEYS.noRefundDays, value: String(pol.noRefundDays) },
        { key: KEYS.percent, value: String(pol.percent) },
        { key: KEYS.refundRepairs, value: String(pol.refundRepairs) },
        { key: KEYS.creditMinutes, value: String(pol.creditMinutes) },
        { key: KEYS.instantUndoMinutes, value: pol.instantUndoMinutes === null ? '' : String(pol.instantUndoMinutes) },
        { key: KEYS.sameModelSwap, value: String(pol.sameModelSwap) },
        { key: KEYS.swapMinDays, value: String(pol.swapMinDays) },
        { key: KEYS.swapSameCategoryOnly, value: String(pol.swapSameCategoryOnly) },
        { key: KEYS.swapPairingWindowMinutes, value: String(pol.swapPairingWindowMinutes) },
        { key: KEYS.refundTiersAtDeletion, value: String(pol.refundTiersAtDeletion) },
        ...catalog.extra.map((s) => ({ key: s.key, value: s.value })),
      ],
    };
  }, [ready, datesOk, eventBeforeOrder, order, nowAt, items, pol, catalog.extra]);
  const payloadJson = useMemo(() => (payload ? JSON.stringify(payload) : null), [payload]);

  // ---------- הרצת המנוע האמיתי (דיבאונס, התעלמות מתשובות ישנות) ----------
  useEffect(() => {
    if (!payloadJson || loadState === 'loading') { setPending(false); return undefined; }
    let cancelled = false;
    const ctrl = new AbortController();
    setPending(true);
    const t = setTimeout(async () => {
      try {
        const body = { ...JSON.parse(payloadJson), priceList };
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
        if (cancelled) return;
        if (res.status === 401) { setApiError('auth'); return; }
        if (!res.ok) { setApiError('server'); return; }
        const data = await res.json();
        if (cancelled) return;
        setApiError(null);
        setResult({ data, payload: JSON.parse(payloadJson), pol, priceList, gapRule });
      } catch (e) {
        if (!cancelled && e.name !== 'AbortError') setApiError('network');
      } finally {
        if (!cancelled) setPending(false);
      }
    }, 150);
    return () => { cancelled = true; clearTimeout(t); ctrl.abort(); };
  }, [payloadJson, loadState, gapRule]);

  const analysis = useMemo(() => (result ? analyze(result) : null), [result]);

  // ---------- פעולות ----------
  const setP = (patch) => setPolicy((p) => ({ ...p, ...patch }));
  const setOrderField = (patch) => setOrder((o) => ({ ...o, ...patch }));
  const updateItem = (key, patch) => setItems((l) => l.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const removeItem = (key) => setItems((l) => l.filter((it) => it.key !== key));
  const duplicateItem = (key) => setItems((l) => {
    if (l.length >= MAX_ITEMS) return l;
    const i = l.findIndex((it) => it.key === key);
    const copy = { ...l[i], key: `it${++uid}` };
    return [...l.slice(0, i + 1), copy, ...l.slice(i + 1)];
  });
  const baseItem = () => {
    const first = items[0];
    return first ? { category: first.category, size: first.size, model: first.model } : { category: cats[0] || '', size: 38, model: 'א' };
  };
  const addItem = () => { if (items.length < MAX_ITEMS) setItems((l) => [...l, newItem(baseItem())]); setNote(''); };
  // פריט חלופי שנוסף ברגע הביטול - כדי שיהיה מה להחליף, מוודאים שיש פריט מבוטל
  const addReplacement = () => {
    setItems((l) => {
      let next = l.slice();
      let cancelled = next.find((it) => it.status === 'cancelled');
      if (!cancelled) {
        if (next.length) { next[0] = { ...next[0], status: 'cancelled' }; cancelled = next[0]; }
        else { cancelled = newItem({ ...baseItem(), status: 'cancelled' }); next = [cancelled]; }
      }
      if (next.length >= MAX_ITEMS) return next;
      // כשכלל "החלפת מידה לאותו דגם" דלוק, דגם זהה היה הופך להחלפה - לכן לדוגמה של זיכוי לוקחים דגם אחר
      const model = pol.sameModelSwap ? MODELS[(MODELS.indexOf(cancelled.model) + 1) % MODELS.length] : cancelled.model;
      return [...next, newItem({ category: cancelled.category, size: cancelled.size, model, added: 'cancel', status: 'active' })];
    });
    setNote('נוסף פריט חלופי שנוסף ברגע הביטול. זיכוי דמי ביטול על פריט חלופי קיים רק כשיש דמי ביטול - כלומר באזור האמצעי או האדום (קרוב לאירוע).');
  };
  const addInstant = () => {
    const mins = Math.max(0, Math.min(5, pol.effectiveInstantUndoMinutes - 1));
    setItems((l) => (l.length >= MAX_ITEMS ? l : [...l, newItem({ ...baseItem(), added: 'before', beforeMin: mins, status: 'cancelled' })]));
    setNote(`נוסף פריט שנוסף לפני ${mins} דקות ובוטל עכשיו. עד ${pol.effectiveInstantUndoMinutes} דקות נחשב "ביטול מיידי" - הפריט לא נספר בכלל.`);
  };

  const shiftNow = (days) => setNowAt((s) => withDay(s, dayOfInput(s) + days));
  const nowToday = () => { const d = new Date(); d.setSeconds(0, 0); setNowAt(toLocalInput(d)); };
  const nowBeforeEvent = () => { if (Number.isFinite(eventDay)) setNowAt((s) => withDay(s, eventDay - 1)); };

  // ---------- גרירה על ציר הזמן ----------
  const dayAt = (clientX) => {
    const r = zoneRef.current.getBoundingClientRect();
    const frac = clamp((r.right - clientX) / r.width, 0, 0.999999); // ציר הזמן זורם מימין לשמאל (RTL)
    return startDay + Math.floor(frac * total);
  };
  const moveNowTo = (day) => setNowAt((s) => withDay(s, day));
  const keyNow = (e) => {
    const map = { ArrowLeft: 1, ArrowUp: 1, ArrowRight: -1, ArrowDown: -1 };
    const dir = map[e.key];
    if (!dir) return;
    e.preventDefault();
    moveNowTo(clamp(nowDay + dir * (e.shiftKey ? 7 : 1), startDay, endDay));
  };

  // ---------- גאומטריה של הציר ----------
  const segments = useMemo(() => (timelineOk ? buildSegments(startDay, endDay, orderDay, eventDay, pol) : []), [timelineOk, startDay, endDay, orderDay, eventDay, pol]);
  const pct = (day) => ((day - startDay) / total) * 100;
  const pctMid = (day) => ((day - startDay + 0.5) / total) * 100;
  const pctAt = (dayFloat) => clamp(((dayFloat - startDay) / total) * 100, 0, 100);
  const nowPct = timelineOk && nowD ? pctAt(localDayFloat(nowD.getTime())) : 0;
  const nowOutside = timelineOk && (nowDay < startDay || nowDay > endDay);
  const tickStep = useMemo(() => {
    const maxLabels = Math.max(3, Math.floor(laneW / 64));
    const raw = Math.ceil(total / maxLabels);
    return [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 180].find((s) => s >= raw) || 365;
  }, [laneW, total]);
  const ticks = useMemo(() => {
    if (!timelineOk) return [];
    const out = [];
    for (let d = startDay; d <= endDay; d += tickStep) out.push(d);
    return out;
  }, [timelineOk, startDay, endDay, tickStep]);
  const dense = timelineOk && total <= 120;
  const weekLines = useMemo(() => {
    if (!timelineOk) return [];
    const out = [];
    if (dense) { for (let d = startDay + 1; d <= endDay; d++) out.push({ d, wk: false }); }
    else { for (let d = startDay + 7; d <= endDay; d += 7) out.push({ d, wk: true }); }
    return out;
  }, [timelineOk, dense, startDay, endDay]);
  const bandLabel = (s) => (s.tier === 'full' ? `עד ${fmtDM(s.to)}` : s.tier === 'partial' ? `${fmtDM(s.from)} - ${fmtDM(s.to)}` : `מ-${fmtDM(s.from)}`);

  // סיכום מילולי
  const liveTier = nowD && orderD && eventD ? engineTier(orderD.getTime(), eventD.getTime(), nowD.getTime(), pol) : null;
  const liveDayTier = timelineOk ? tierForDay(nowDay, orderDay, eventDay, pol) : null;
  const sinceOrder = nowDay - orderDay;
  const untilEvent = eventDay - nowDay;

  const itemLife = (it, i) => {
    if (!payload) return null;
    const p = payload.items[i];
    const a = pctAt(localDayFloat(new Date(p.createdAt).getTime()));
    const cancelled = it.status === 'cancelled';
    const b = cancelled ? nowPct : 100;
    return { a, b, cancelled, from: new Date(p.createdAt) };
  };

  const errorText = apiError === 'auth' ? 'אין הרשאה - הסימולטור זמין רק להנהלה ראשית. התחברו מחדש כמנהל/ת ראשי/ת ונסו שוב.'
    : apiError === 'server' ? 'המנוע החזיר שגיאה. נסו לשנות משהו או לרענן את הדף.'
    : apiError === 'network' ? 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.' : null;

  const hasAbroadRow = !!abroadRow;

  return (
    <div className="rp-root rs-root">
      <RefundNav current="simulator" />
      <div className="page-head">
        <div>
          <h1>סימולטור זיכויים אמיתי</h1>
          <p className="page-desc">בונים הזמנה דמיונית עם תאריכים ופריטים, בוחרים מתי מבטלים, ורואים בדיוק מה המערכת האמיתית הייתה מחייבת ומחזירה.</p>
        </div>
      </div>

      {catalog.state === 'error' && (
        <div className="callout callout-danger rs-loaderr">
          <Icon id="i-alert-tri" />
          <span>
            {catalog.error === 'auth' ? 'אין הרשאה - הסימולטור זמין רק להנהלה ראשית. התחברו מחדש כמנהל/ת ראשי/ת.' : 'לא הצלחנו לטעון את המחירון מהשרת.'}
            {' '}<button type="button" className="btn btn-secondary btn-sm" onClick={loadCatalog}><Icon id="i-refresh" />נסו שוב</button>
          </span>
        </div>
      )}

      <div className="rp-shell rs-shell">
        {/* ============ ימין: שדות למילוי ============ */}
        <aside className="rp-side rs-side">
          <div className="card rp-panel">
            {!ready ? (
              <div className="rp-sec"><div className="rs-loading">{catalog.state === 'error' ? 'הטופס יופיע אחרי טעינת המחירון.' : 'טוען את המחירון החי…'}</div></div>
            ) : (
              <>
                {/* 1 - ההזמנה */}
                <div className="rp-sec">
                  <div className="rp-sec-title"><span className="rs-num">1</span>ההזמנה</div>
                  <div className="field">
                    <label htmlFor="rs-order">מתי בוצעה ההזמנה</label>
                    <input id="rs-order" className="input" type="datetime-local" value={order.orderAt} onChange={(e) => setOrderField({ orderAt: e.target.value })} />
                    <div className="rp-heb">{Number.isFinite(orderDay) ? `${weekday(orderDay)} · ${hebShort(orderDay)}` : ''}</div>
                  </div>
                  <div className="field">
                    <label htmlFor="rs-event">תאריך האירוע</label>
                    <input id="rs-event" className="input" type="date" value={order.eventDate} onChange={(e) => setOrderField({ eventDate: e.target.value })} />
                    <div className="rp-heb">{Number.isFinite(eventDay) ? `${weekday(eventDay)} · ${hebShort(eventDay)}` : ''}</div>
                  </div>
                  {eventBeforeOrder && <div className="error-text rs-err">תאריך האירוע חייב להיות אחרי תאריך ההזמנה.</div>}
                  <label className="rs-check">
                    <input type="checkbox" checked={order.isAbroad} onChange={(e) => setOrderField({ isAbroad: e.target.checked })} />
                    הזמנה לחו״ל
                  </label>
                  {order.isAbroad && (
                    <div className="rs-price">{hasAbroadRow ? `תוספת חו״ל של ${abroadRow.price}% על המחיר, לפי המחירון.` : 'אין במחירון שורת "חו״ל", ולכן לא תתווסף תוספת.'}</div>
                  )}
                </div>

                {/* 2 - מתי מבטלים */}
                <div className="rp-sec">
                  <div className="rp-sec-title"><span className="rs-num">2</span>מתי מבטלים</div>
                  <div className="field">
                    <label htmlFor="rs-now">רגע הביטול (״עכשיו״ = הרגע שבו שומרים את ההזמנה)</label>
                    <input id="rs-now" className="input" type="datetime-local" value={nowAt} onChange={(e) => setNowAt(e.target.value)} />
                    <div className="rp-heb">{Number.isFinite(nowDay) ? `${weekday(nowDay)} · ${hebShort(nowDay)}` : ''}</div>
                  </div>
                  <div className="rs-quick" role="group" aria-label="קפיצות מהירות">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftNow(-7)}>−7 ימים</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftNow(-1)}>−1 יום</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftNow(1)}>+1 יום</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftNow(7)}>+7 ימים</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={nowToday}>היום</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={nowBeforeEvent}>יום לפני האירוע</button>
                  </div>
                  <div className="rs-tip">אפשר גם לגרור את הסמן ״עכשיו״ על ציר הזמן.</div>
                </div>

                {/* 3 - הפריטים */}
                <div className="rp-sec">
                  <div className="rp-sec-title"><span className="rs-num">3</span>הפריטים<span className="badge badge-neutral rs-count">{items.length}/{MAX_ITEMS}</span></div>
                  <div className="rs-presets">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addReplacement} disabled={items.length >= MAX_ITEMS}><Icon id="i-refresh" />הוסף פריט חלופי שנוסף ברגע הביטול</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addInstant} disabled={items.length >= MAX_ITEMS}><Icon id="i-clock" />הוסף פריט שנוסף ובוטל תוך דקות</button>
                  </div>
                  {note && <div className="rs-note" role="status">{note}</div>}
                  {items.length === 0 && <div className="rs-empty-items">אין פריטים בהזמנה. הוסיפו פריט כדי לראות תוצאה.</div>}
                  {items.map((it, i) => (
                    <ItemCard key={it.key} item={it} index={i} cats={cats} priceList={priceList} eventDate={eventD}
                      onChange={updateItem} onDuplicate={duplicateItem} onRemove={removeItem} canDuplicate={items.length < MAX_ITEMS} />
                  ))}
                  <button type="button" className="btn btn-secondary btn-sm rs-add" onClick={addItem} disabled={items.length >= MAX_ITEMS}><Icon id="i-plus" />הוסף שמלה</button>
                </div>

                {/* 4 - הכללים */}
                <div className="rp-sec">
                  <div className="rp-sec-title">
                    <span className="rs-num">4</span>הכללים
                    <span className={`rp-src badge ${loadState === 'ok' ? 'badge-success' : loadState === 'failed' ? 'badge-warning' : 'badge-neutral'}`}>
                      {loadState === 'ok' ? 'נטען מהמערכת' : loadState === 'failed' ? 'לא נטען - ברירות מחדל' : 'טוען…'}
                    </span>
                  </div>
                  <div className="rs-tip rs-tip-top">אפשר לשנות כאן כדי לבדוק ״מה היה קורה אילו״. השינוי לא נשמר במערכת אלא אם לוחצים למטה על ״החל בהגדרות המערכת״.</div>

                  <div className="rp-rule t-full">
                    <div className="rp-rule-top"><i />החזר מלא</div>
                    <Stepper value={policy.fullDays} onChange={(v) => setP({ fullDays: v })} unit="ימים מיום ההזמנה" label={LABELS.fullDays} />
                    <div className="rp-rule-sub">ביטול עד {timelineOk ? fmtDM(startDay + pol.fullDays) : '—'} מוחזר במלואו (אם האירוע לא קרוב מדי).</div>
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
                      <span className="rp-unit">% החזר</span>
                    </div>
                    <input className="rp-range" type="range" min="0" max="100" step="5" value={pol.percent} onChange={(e) => setP({ percent: Number(e.target.value) })} aria-label={LABELS.percent} />
                    <div className="rp-rule-sub">שאר הימים מוחזר האחוז הזה. אם בשורת המחירון יש פיקדון קבוע - הוא גובר על האחוז.</div>
                  </div>

                  <div className="rp-rule t-none">
                    <div className="rp-rule-top"><i />ללא החזר</div>
                    <Stepper value={policy.noRefundDays} onChange={(v) => setP({ noRefundDays: v })} unit="ימים לפני האירוע" label={LABELS.noRefundDays} />
                    <div className="rp-rule-sub">מ-{timelineOk ? fmtDM(eventDay - pol.noRefundDays) : '—'} ועד האירוע אין החזר כלל.</div>
                  </div>

                  <Switch checked={pol.refundRepairs} onChange={(v) => setP({ refundRepairs: v })} title={LABELS.refundRepairs}
                    sub={pol.refundRepairs ? 'תיקונים מוחזרים כמו השמלה.' : 'תיקונים תמיד נשארים כדמי ביטול.'} />
                  <Switch checked={pol.refundTiersAtDeletion} onChange={(v) => setP({ refundTiersAtDeletion: v })} title={LABELS.refundTiersAtDeletion}
                    sub={pol.refundTiersAtDeletion ? 'דלוק: המדרגה נקבעת ברגע הביטול בפועל (שדה "מתי בוטל בפועל" בכל פריט).' : 'כבוי: המדרגה נקבעת לפי "עכשיו" (שלב 2), גם אם הפריט בוטל מזמן.'} />

                  <div className="rp-rule t-credit">
                    <div className="rp-rule-top"><i />{LABELS.instantUndoMinutes}</div>
                    <NullableStepper value={policy.instantUndoMinutes} onChange={(v) => setP({ instantUndoMinutes: v })}
                      fallback={pol.creditMinutes} max={10080} unit="דק׳" label={LABELS.instantUndoMinutes} />
                    <div className="rp-rule-sub">פריט שנוסף ובוטל בתוך {pol.effectiveInstantUndoMinutes} דקות - לא נספר כלל.</div>
                  </div>

                  <div className="rp-rule">
                    <div className="rp-rule-top"><i />{LABELS.creditMinutes}</div>
                    <Stepper value={policy.creditMinutes} onChange={(v) => setP({ creditMinutes: v })} max={10080} unit="דקות" label={LABELS.creditMinutes} />
                    <div className="rp-rule-sub">
                      {pol.creditMinutes > 0
                        ? 'פריט חדש שנוסף בתוך החלון הזה מרגע הביטול מקבל את דמי הביטול (חלק השמלה) כזיכוי מלא, עד מחירו.'
                        : 'כבוי (0 דקות): דמי הביטול תמיד נגבים במלואם. נפרד לגמרי מ"ביטול מיידי" למעלה.'}
                    </div>
                  </div>

                  <div className="rp-rule">
                    <div className="rp-rule-top"><i />{LABELS.sameModelSwap}</div>
                    <Switch checked={pol.sameModelSwap} onChange={(v) => setP({ sameModelSwap: v })} title="חינם לגמרי, בלי קשר למדרגות"
                      sub={pol.sameModelSwap ? 'דלוק' : 'כבוי (ברירת מחדל)'} />
                    {pol.sameModelSwap && (
                      <div className="rp-swap-sub-panel">
                        <div className="field" style={{ marginBottom: 10 }}>
                          <label>{LABELS.swapMinDays}</label>
                          <Stepper value={policy.swapMinDays} onChange={(v) => setP({ swapMinDays: v })} max={730} unit="ימים (0 = בלי הגבלה)" label={LABELS.swapMinDays} />
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

                  <button type="button" className="btn btn-ghost btn-sm rs-reset" disabled={!baseline} onClick={() => baseline && setPolicy(baseline)}>
                    <Icon id="i-refresh" />חזור להגדרות המערכת
                  </button>
                </div>
              </>
            )}
          </div>

          {ready && (
            <ApplyPanel policy={policy} pol={pol} baseline={baseline} names={names} loadState={loadState}
              onApplied={(p) => setBaseline(p)} onReset={() => baseline && setPolicy(baseline)} />
          )}
        </aside>

        {/* ============ שמאל: תוצאות ============ */}
        <section className="rp-main rs-main">
          {/* א - סיכום מילולי */}
          {ready && datesOk && (
            <div className={`card rs-recap ${liveTier ? `t-${liveTier}` : ''}`} role="status" aria-live="polite">
              <p>
                ההזמנה בוצעה ב-<b>{fmtDT(orderD)}</b> והאירוע ב-<b>{fmtDMY(eventDay)}</b>. מבטלים ב-<b>{fmtDT(nowD)}</b>
                {!eventBeforeOrder && <>, כלומר {sinceOrder >= 0 ? <><b>{sinceOrder}</b> {daysWord(sinceOrder)} אחרי ההזמנה</> : <>לפני ההזמנה</>} ו-{untilEvent >= 0 ? <><b>{untilEvent}</b> {daysWord(untilEvent)} לפני האירוע</> : <>אחרי האירוע</>} - אזור <span className="rs-tier"><i />{TIERS[liveTier].label}</span></>}.
              </p>
              {timelineOk && liveDayTier !== liveTier && (
                <p className="rs-boundary">שימו לב: זה יום הגבול. ברמת יום הצבע בציר הוא ״{TIERS[liveDayTier].label}״, אבל המנוע משווה גם שעות, ולפי השעה שבחרתם הוא קובע ״{TIERS[liveTier].label}״.</p>
              )}
            </div>
          )}

          {/* ב - ציר זמן */}
          <div className="card rs-tl">
            <div className="rs-tl-head">
              <div>
                <div className="rp-tl-title">ציר הזמן של ההזמנה</div>
                <div className="rp-tl-sub">הזמן זורם מימין לשמאל: ביצוע ההזמנה בקצה הימני, האירוע משמאלו. לחצו או גררו כדי להזיז את ״עכשיו״.</div>
              </div>
              {pending && <span className="rs-pending" aria-live="polite">מחשב…</span>}
            </div>

            {!ready ? (
              <div className="rp-empty">{catalog.state === 'error' ? 'אי אפשר להציג ציר לפני שהמחירון נטען.' : 'טוען…'}</div>
            ) : eventBeforeOrder ? (
              <div className="callout callout-danger"><Icon id="i-alert-tri" /><span>תאריך האירוע חייב להיות אחרי תאריך ההזמנה - תקנו כדי לראות את ציר הזמן.</span></div>
            ) : tooLong ? (
              <div className="rp-empty">הטווח בין ההזמנה לאירוע גדול מדי להצגה בציר (יותר מ-1500 ימים). התוצאה מתחת עדיין מחושבת.</div>
            ) : !timelineOk ? (
              <div className="rp-empty">בחרו תאריך הזמנה, אירוע ורגע ביטול תקינים כדי לראות את ציר הזמן.</div>
            ) : (
              <div className="rs-plot" dir="rtl">
                <div className="rs-zone" ref={zoneRef}>
                  <div className="rp-lane rs-lane">
                    <span className="rs-rowlbl">אזור החזר</span>
                    <div className="rp-clip">
                      {segments.map((s) => {
                        const wPct = ((s.to - s.from + 1) / total) * 100;
                        return (
                          <div key={`t${s.tier}${s.from}`} className={`rp-tint t-${s.tier}`} style={{ insetInlineStart: `${pct(s.from)}%`, width: `${wPct}%` }}>
                            {(wPct / 100) * laneW >= 84 && <span className="rs-seg-lbl"><b>{TIERS[s.tier].label}</b><small>{bandLabel(s)}</small></span>}
                          </div>
                        );
                      })}
                      {dense && Array.from({ length: total }, (_, i) => startDay + i).filter(isSaturday).map((d) => (
                        <div key={`s${d}`} className="rp-sat" style={{ insetInlineStart: `${pct(d)}%`, width: `${100 / total}%` }} />
                      ))}
                      {weekLines.map((g) => <div key={`g${g.d}`} className={`rp-gl${g.wk ? ' wk' : ''}`} style={{ insetInlineStart: `${pct(g.d)}%` }} />)}
                      <div className="rp-tail" style={{ insetInlineStart: `${pct(eventDay + 1)}%`, width: `${(TAIL / total) * 100}%` }} />
                    </div>
                  </div>

                  <div className="rs-life">
                    {items.map((it, i) => {
                      const l = itemLife(it, i);
                      if (!l) return null;
                      const lo = Math.min(l.a, l.b);
                      const hi = Math.max(l.a, l.b);
                      return (
                        <div key={it.key} className={`rs-life-row ${l.cancelled ? 'cancelled' : 'active'}`}>
                          <span className="rs-rowlbl">שמלה {i + 1}</span>
                          <i className="rs-life-bar" style={{ insetInlineStart: `${lo}%`, width: `${hi - lo}%` }} />
                          <i className="rs-dot add" style={{ insetInlineStart: `${l.a}%` }} title={`שמלה ${i + 1} נוספה ב-${fmtDT(l.from)}`} />
                          {l.cancelled && <i className="rs-dot x" style={{ insetInlineStart: `${l.b}%` }} title={`שמלה ${i + 1} בוטלה ב-${fmtDT(nowD)}`} />}
                        </div>
                      );
                    })}
                  </div>

                  {/* סמן ״עכשיו״ - לחיצה וגרירה על כל השטח */}
                  <div className={`rs-overlay${dragging ? ' drag' : ''}`}
                    role="slider" tabIndex={0} aria-label="רגע הביטול (עכשיו) על ציר הזמן" aria-valuemin={startDay} aria-valuemax={endDay} aria-valuenow={clamp(nowDay, startDay, endDay)}
                    aria-valuetext={`${fmtDMY(nowDay)} ${fmtClock(nowD)}`}
                    onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); e.currentTarget.focus?.(); setDragging(true); moveNowTo(dayAt(e.clientX)); }}
                    onPointerMove={(e) => { if (dragging) moveNowTo(dayAt(e.clientX)); }}
                    onPointerUp={(e) => { e.currentTarget.releasePointerCapture?.(e.pointerId); setDragging(false); }}
                    onPointerCancel={() => setDragging(false)}
                    onKeyDown={keyNow}>
                    <div className="rs-now-line" style={{ insetInlineStart: `${nowPct}%` }} />
                    <div className={`rs-now-pill${liveTier ? ` t-${liveTier}` : ''}`} style={{ insetInlineStart: `clamp(72px, ${nowPct}%, calc(100% - 72px))` }}>
                      <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1L1 5l2 4M7 1l2 4-2 4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
                      עכשיו · {fmtDM(nowDay)} {fmtClock(nowD)}
                    </div>
                  </div>
                </div>

                <div className="rp-axis" aria-hidden="true">
                  {ticks.map((d) => (
                    <div key={d} className={`rp-tick${isSaturday(d) ? ' sat' : ''}`} style={{ insetInlineStart: `${pctMid(d)}%` }}>
                      {fmtDM(d)}<small>{hebShort(d)}</small>
                    </div>
                  ))}
                </div>
                <div className="rp-flags">
                  <span className="rp-flag" style={{ insetInlineStart: 0, transform: 'none' }}><Icon id="i-receipt" />ביצוע ההזמנה</span>
                  <span className="rp-flag ev" style={{ insetInlineStart: `${pctMid(eventDay)}%` }}><Icon id="i-star" />האירוע</span>
                </div>
                {nowOutside && <div className="rs-tip">רגע הביטול נמצא מחוץ לטווח הציר ({fmtDMY(nowDay)}) - הסמן מוצמד לקצה.</div>}
              </div>
            )}
            {ready && timelineOk && (
              <div className="rs-legend">
                <span><i className="rs-dot add" />נוסף להזמנה</span>
                <span><i className="rs-dot x" />בוטל</span>
                <span><i className="rs-swatch" />אחרי האירוע</span>
              </div>
            )}
          </div>

          {/* ג - תוצאות */}
          <div className={`rs-results${pending ? ' is-pending' : ''}`}>
            {errorText && <div className="callout callout-danger"><Icon id="i-alert-tri" /><span>{errorText}</span></div>}

            {!analysis ? (
              <div className="card card-pad rs-wait">{ready ? (errorText ? 'אין תוצאה להצגה.' : 'מריץ את המנוע האמיתי…') : ''}</div>
            ) : (
              <>
                <div className="rs-stats">
                  <div className="card rs-stat">
                    <div className="rs-stat-l">חיוב מקורי</div>
                    <div className="rs-stat-v"><Money2 n={analysis.originalTotal} /></div>
                    <div className="rs-stat-s">פעילים <Money2 n={analysis.activeCharge} /> · מבוטלים <Money2 n={analysis.cancelledOrig} /></div>
                  </div>
                  <div className="card rs-stat get">
                    <div className="rs-stat-l">זוכה ללקוחה</div>
                    <div className="rs-stat-v"><Money2 n={analysis.refundGross} /></div>
                    <div className="rs-stat-s">מהפריטים המבוטלים, אחרי דמי ביטול</div>
                  </div>
                  <div className={`card rs-stat ${analysis.feeNet > 0 ? (analysis.tier === 'none' ? 'bad' : 'warn') : ''}`}>
                    <div className="rs-stat-l">דמי ביטול שנשארו</div>
                    <div className="rs-stat-v"><Money2 n={analysis.feeNet} /></div>
                    <div className="rs-stat-s">{analysis.absorbed > 0 ? <>ועוד <Money2 n={analysis.absorbed} /> שקוזזו מפריט חדש</> : 'נשארים בגמ״ח'}</div>
                  </div>
                  <div className="card rs-stat total">
                    <div className="rs-stat-l">סה״כ לתשלום כרגע</div>
                    <div className="rs-stat-v"><Money2 n={analysis.totalNow} /></div>
                    <div className="rs-stat-s">סכום כל שורות החיוב, לפני מה ששולם</div>
                  </div>
                </div>

                <div className="card rs-verdicts-card">
                  <div className="rs-h">מה קורה לכל פריט</div>
                  {analysis.verdicts.length === 0 ? (
                    <div className="rs-wait">אין פריטים בהזמנה.</div>
                  ) : (
                    <ul className="rs-verdicts">
                      {analysis.verdicts.map((v) => (
                        <li key={v.item.id} className={`rs-verdict ${v.cls}`}>
                          <div className="rs-v-head">
                            <b>שמלה {v.item.id}</b>
                            <span className="rs-v-sub">{v.item.priceCategory || 'ללא קטגוריה'} · מידה {v.item.size ?? '—'} · דגם {String(v.item.modelId).replace('m-', '')}</span>
                            <span className="rs-chip">{v.chip}</span>
                          </div>
                          <p>{v.text}</p>
                          {v.amounts && (
                            <div className="rs-v-amts">
                              {v.amounts.map(([l, n, k]) => <span key={l} className={k}>{l} <Money2 n={n} /></span>)}
                            </div>
                          )}
                          {v.hint && <p className="rs-v-hint">{v.hint}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="card rs-raw">
                  <div className="rs-h">שורות החיוב כפי שהמנוע החזיר <small>(ההוכחה האמיתית)</small></div>
                  {analysis.rows.length === 0 ? (
                    <div className="rs-wait">המנוע לא החזיר שורות חיוב.</div>
                  ) : (
                    <div className="rs-table-wrap">
                      <table className="rs-table">
                        <thead><tr><th>תיאור</th><th>סכום</th></tr></thead>
                        <tbody>
                          {analysis.rows.map((r, i) => (
                            <tr key={i} className={`k-${r.kind}${r.kind === 'fee' ? (analysis.tier === 'none' ? ' fee-bad' : ' fee-warn') : ''}${r.amount < 0 ? ' neg' : ''}`}>
                              <td>{r.description}</td>
                              <td><Money2 n={r.amount} sign /></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr><td>סה״כ</td><td><Money2 n={analysis.totalNow} /></td></tr></tfoot>
                      </table>
                    </div>
                  )}
                  <details className="rs-explain">
                    <summary>איך קוראים את זה</summary>
                    <ul>
                      <li><b>חיוב מקורי</b> - מה שעלה הפריט כשנוסף להזמנה. פריט פעיל מופיע רק כשורת חיוב אחת (ועוד שורה לכל תיקון).</li>
                      <li><b>זיכוי בגין ביטול</b> - ביטול מלא של החיוב המקורי (מספר שלילי, בירוק). זה עדיין לא כסף שחוזר ללקוחה.</li>
                      <li><b>דמי ביטול ותיקונים</b> - החלק שנשאר בגמ״ח בכל זאת: מה שלא מוחזר מהשמלה לפי האזור, ועלות תיקונים (אם לא מחזירים תיקונים).</li>
                      <li><b>זיכוי דמי ביטול (מומש על פריט חדש)</b> - כשנוסף פריט חלופי ברגע הביטול, דמי הביטול מקוזזים ממנו.</li>
                      <li><b>סה״כ</b> - מה שהלקוחה חייבת כרגע בהזמנה אחרי כל השורות. מה ששולם כבר לא נכלל.</li>
                    </ul>
                  </details>
                </div>
              </>
            )}
          </div>

          {/* ד - הבהרה */}
          <div className="callout callout-info">
            <Icon id="i-info" />
            <span>
              הסימולטור מריץ את מנוע החישוב האמיתי של המערכת על הזמנה דמיונית. שום דבר לא נשמר ולא משפיע על הזמנות אמיתיות.
              <br />
              ביום הגבול עצמו (היום האחרון של חלון ההחזר המלא, או היום הראשון של ״ללא החזר״) התוצאה האמיתית תלויה גם בשעה שבה בוצעה ההזמנה.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
