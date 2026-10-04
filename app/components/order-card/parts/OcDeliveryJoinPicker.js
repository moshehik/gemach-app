'use client';

// OcDeliveryJoinPicker — "הצטרפות למשלוח קיים" (R49, enable_delivery_join, נווה יעקב; פורט components/orders/DeliveryJoinPicker.js מענף
// neve-batch-2026-09-25). נרשם ב-SLOTS.DeliveryJoinPicker: מרונדר אחרי כרטיס "יעד" בלשונית המשלוח (או בתוך "פרטים" כשאין לשונית נפרדת),
// כילד ישיר של הלוח - לכן מחזיר .card משלו (W2a-NOTES §3). props: {oc, ui}.
// התנהגות: בוחרים "משלוח חדש" (כמו תמיד) או "הצטרפות למשלוח קיים" של אותו יום אירוע ואותו כיוון (הלוך להלוך, חזור לחזור; הלוך-חזור רק
// למשלוח שכולל את שניהם), ומסמנים מי מלקוחות הכתובת הוא ה"ראשי" (מודפס למשלוחן ועל השקית). בחירת משלוח דורסת את עיר/כתובת ההזמנה בכתובת
// שלו; החיוב מחושב בשרת במחיר ההצטרפות (delivery_join_price; lib/pricingCalc.js joinPrice).
// השמירה בפועל (טבלת DeliveryJoin, DDL-1) נעשית בשרת ב-PUT של ההזמנה: כאן רק מעדכנים את ה-state - order.deliveryJoinedTo (מספר הזמנה | null)
// ו-order.deliveryPrimaryOrderId (מספר | 'self' | null); undefined = לא נגעו (לא נשלח ב-PUT, לא נחשב שינוי). הבקר ממיר אותם ל-body.deliveryJoin.
// הטבלה חסרה / ההגדרה כבויה: GET /api/deliveries/join מחזיר enabled:false והבורר לא מוצג בכלל.
import { useEffect, useMemo, useState } from 'react';
import OcIcon from '../OcIcon';
import { candidateLabel, effectiveJoin, eventIsoOf, joinCandidatesQuery, joinPatch, rovingNext, savedJoinSyncPatch } from './ocNeveLogic';

const getJson = (url) => fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null));

// roving tabindex + חיצים לקבוצת role="radio" (סקירה, סעיף 9): חץ מזיז פוקוס בין השורות, Enter / רווח בוחרים. שורה אחת בלבד ב-Tab.
const isRtl = () => (typeof document !== 'undefined' ? document.documentElement.dir !== 'ltr' : true);
const rovingKeyDown = (e, index, count) => {
  const to = rovingNext(e.key, index, count, isRtl());
  if (to === null) return false;
  e.preventDefault();
  const rows = e.currentTarget.parentElement ? e.currentTarget.parentElement.querySelectorAll(':scope > [role="radio"]') : [];
  if (rows[to]) rows[to].focus();
  return true;
};

export default function OcDeliveryJoinPicker({ oc }) {
  const order = oc.order || {};
  const orderId = order.orderId || null;
  const enabledSetting = !!oc.settings.enableDeliveryJoin;
  const on = !!order.isDelivery;
  const eventIso = eventIsoOf(order.eventDate || order.fromDate);
  const query = joinCandidatesQuery(order, orderId);

  // מצב שמור בשרת (לא נדחף ל-state של ההזמנה עד שמשנים משהו - כדי לא לסמן "שינויים שלא נשמרו" רק מעצם פתיחת הכרטיס).
  // available: null = טרם נבדק, false = כבוי / הטבלה חסרה (הבורר מוסתר).
  const [available, setAvailable] = useState(null);
  const [info, setInfo] = useState(null);
  const [infoVersion, setInfoVersion] = useState(null);
  const [candidates, setCandidates] = useState(null); // null = טרם נטען
  const [group, setGroup] = useState([]); // חברי הקבוצה של השורש (בלי ההזמנה הזו)
  const [modeState, setModeState] = useState(null); // 'new' | 'join' | null (עד שנקבע מהמצב השמור)
  const [candFocus, setCandFocus] = useState(null); // אינדקס השורה שעליה הפוקוס (roving tabindex), null = הנבחרת / הראשונה
  const [memFocus, setMemFocus] = useState(null);

  // נטען מחדש אחרי כל כתיבה בשרת (שמירה = historyVersion עולה)
  useEffect(() => {
    if (!enabledSetting || !orderId) { setAvailable(false); return undefined; }
    let cancelled = false;
    const version = oc.historyVersion; // גרסת ה-historyVersion שבה נשאל המידע - מידע מיושן (אחרי שמירה) לא מסונכרן ל-order (savedJoinSyncPatch)
    getJson(`/api/deliveries/join?mode=info&orderId=${orderId}`)
      .then(data => {
        if (cancelled) return;
        setAvailable(!!(data && data.enabled));
        setInfo(data?.info || { joinedToOrderId: null, isPrimary: false, group: [] });
        setInfoVersion(version);
      })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, [enabledSetting, orderId, oc.historyVersion]);

  const eff = effectiveJoin({ order, info, group, modeState });

  // ההצטרפות השמורה נטענת גם ל-order וגם ל-snapshot (בלי לסמן שינוי) - כך ביטול שלה (null / false מול מספר) הוא שינוי אמיתי: הכרטיס
  // "מלוכלך", נשמר, ומחיר המשלוח מתעדכן (סקירה, סעיף 1).
  const syncPatch = savedJoinSyncPatch({ order, info, infoVersion, historyVersion: oc.historyVersion });
  useEffect(() => { if (syncPatch) oc.patchOrder(syncPatch); }, [syncPatch?.deliveryJoinedTo]);

  // משלוחים זמינים להצטרפות - רק במצב "הצטרפות" (או כשכבר מצורף), לפי יום האירוע והכיוון
  useEffect(() => {
    if (!available || eff.mode !== 'join' || !eventIso) return undefined;
    let cancelled = false;
    getJson(`/api/deliveries/join?${query}`)
      .then(data => { if (!cancelled) setCandidates(data?.candidates || []); })
      .catch(() => { if (!cancelled) setCandidates([]); });
    return () => { cancelled = true; };
  }, [available, eff.mode, eventIso, query]);

  // חברי הקבוצה של המשלוח שנבחר / של ההזמנה עצמה כשהיא שורש עם מצטרפים - לבחירת "ראשי"
  useEffect(() => {
    if (!available || !eff.rootForGroup) { setGroup([]); return undefined; }
    let cancelled = false;
    getJson(`/api/deliveries/join?mode=group&root=${eff.rootForGroup}`)
      .then(data => { if (!cancelled) setGroup((data?.group || []).filter(g => g.orderId !== Number(orderId))); })
      .catch(() => { if (!cancelled) setGroup([]); });
    return () => { cancelled = true; };
  }, [available, eff.rootForGroup, orderId, oc.historyVersion]);

  const members = useMemo(() => [{ orderId: 'self', customerName: 'הזמנה זו', self: true }, ...group], [group]);

  if (!enabledSetting || !available) return null;

  const apply = (patch) => { if (patch) oc.edit.setOrder(prev => (prev ? { ...prev, ...patch } : prev)); };
  const setMode = (next) => {
    setModeState(next);
    if (next === 'new') apply(joinPatch('mode-new', null, eff));
  };
  const chooseCandidate = (cand) => apply(joinPatch('candidate', cand, eff));
  const choosePrimary = (id) => apply(joinPatch('primary', id, eff));

  const joinedTo = eff.joinedTo;
  const candidateMissing = !!(joinedTo && candidates && !candidates.some(c => c.orderId === joinedTo));
  const rovingTab = (focus, selIdx, n, i) => i === (focus !== null && focus < n ? focus : (selIdx >= 0 ? selIdx : 0)) ? 0 : -1;
  const showMembers = !!joinedTo || group.length > 0;
  const direction = order.deliveryDirection || 'הלוך-חזור';
  const mi = eff.mode === 'join' ? 1 : 0;

  return (
    <div className={`card dfields oc-join${on ? '' : ' off'}`} id="oc-join" inert={on ? undefined : true}>
      <div className="card-h"><div className="ico teal"><OcIcon name="users" size="lg" /></div><h2>הצטרפות למשלוח</h2></div>
      <div className="seg pill" role="radiogroup" aria-label="סוג המשלוח" style={{ '--n': 2, '--i': mi }}>
        <span className="pth" aria-hidden="true" />
        <button type="button" role="radio" aria-checked={eff.mode === 'new'} className={eff.mode === 'new' ? 'on' : ''} data-join="new" onClick={() => setMode('new')}>
          <OcIcon name="truck" size="sm" />משלוח חדש
        </button>
        <button type="button" role="radio" aria-checked={eff.mode === 'join'} className={eff.mode === 'join' ? 'on' : ''} data-join="join" onClick={() => setMode('join')}>
          <OcIcon name="users" size="sm" />הצטרפות למשלוח קיים
        </button>
      </div>

      {eff.mode === 'join' ? (
        <div className="oc-join-pane">
          {!eventIso ? (
            <p className="faint oc-join-hint">יש לבחור קודם תאריך אירוע כדי לראות את המשלוחים של אותו יום.</p>
          ) : candidates === null ? (
            <p className="faint oc-join-hint" role="status">טוען משלוחים…</p>
          ) : (
            <>
              <div className="chg oc-join-list" role="radiogroup" aria-label="משלוחים להצטרפות">
                {candidates.map((c, i) => {
                  const sel = joinedTo === c.orderId;
                  return (
                    <div key={c.orderId} className={`c oc-join-row${sel ? ' oc-sel' : ''}`} role="radio" aria-checked={sel}
                      tabIndex={rovingTab(candFocus, candidates.findIndex(x => x.orderId === joinedTo), candidates.length, i)}
                      onFocus={() => setCandFocus(i)}
                      onClick={() => chooseCandidate(sel ? null : c)}
                      onKeyDown={(e) => { if (rovingKeyDown(e, i, candidates.length)) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseCandidate(sel ? null : c); } }}>
                      <div className="t"><bdi>{candidateLabel(c)}</bdi></div>
                      {sel ? <OcIcon name="check" size="sm" /> : null}
                    </div>
                  );
                })}
              </div>
              {candidates.length === 0 ? <p className="faint oc-join-hint">אין משלוחים קיימים באותו יום אירוע ובאותו כיוון ({direction}) להצטרפות.</p> : null}
              {candidateMissing ? (
                <p className="amsg oc-fmsg oc-join-missing" role="alert">
                  <OcIcon name="alert" size="sm" />המשלוח שנבחר כבר אינו מתאים לתאריך/כיוון הנוכחיים - יש לבחור משלוח אחר, או לבטל את ההצטרפות (השרת לא ישמור הצטרפות שאינה מתאימה).
                  <button type="button" className="btn sm" data-join-clear onClick={() => chooseCandidate(null)}>בטל הצטרפות</button>
                </p>
              ) : null}
              {joinedTo ? <p className="faint oc-join-hint">כתובת ועיר המשלוח נלקחות מהמשלוח שנבחר, והחיוב מחושב לפי מחיר ההצטרפות.</p> : null}
            </>
          )}
        </div>
      ) : null}

      {showMembers ? (
        <div className="oc-join-pane">
          <div className="lbl" id="oc-join-primary-l">מי ה&quot;ראשי&quot; בכתובת זו? (יסומן &quot;ראשי&quot; בהדפסה למשלוחן ועל השקית)</div>
          <div className="chg oc-join-list" role="radiogroup" aria-labelledby="oc-join-primary-l">
            {members.map((m, i) => {
              const sel = String(eff.currentPrimary) === String(m.orderId);
              return (
                <div key={m.orderId} className={`c oc-join-row${sel ? ' oc-sel' : ''}`} role="radio" aria-checked={sel}
                  tabIndex={rovingTab(memFocus, members.findIndex(x => String(x.orderId) === String(eff.currentPrimary)), members.length, i)}
                  onFocus={() => setMemFocus(i)}
                  onClick={() => choosePrimary(m.orderId)}
                  onKeyDown={(e) => { if (rovingKeyDown(e, i, members.length)) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choosePrimary(m.orderId); } }}>
                  <div className="t"><bdi>{m.self ? m.customerName : `#${m.orderId} · ${m.customerName}`}</bdi></div>
                  {sel ? <OcIcon name="check" size="sm" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
