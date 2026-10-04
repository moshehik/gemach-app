'use client';

// OcBarcodeSequencePanel — "רצף ברקודים" (R49, enable_barcode_sequence_mode; פורט components/orders/BarcodeSequencePanel.js מענף נווה יעקב).
// נטען ב-#sbar של שורת הסריקה במקום שדה הסריקה הרגיל (parts/OcScanBarWithSequence.js מעביר אותו כ-prop SequencePanel של W3).
// שדה אחד שנשאר בפוקוס: הסורק שולח ברקוד + Enter וה-Enter הבא כבר מחכה. סריקות שמגיעות בזמן שהקודמת מעובדת נכנסות לתור (השדה אף פעם לא
// נעול) ורצות לפי הסדר. אחרי כל ברקוד: צפצוף (הצלחה / שגיאה), הבהוב והפוקוס חוזר לשדה. "בטל סריקה אחרונה" מבטל את ההצלחה האחרונה;
// "סיכום" מציג נסרקו / נכשלו עם הברקודים שנכשלו. השדה יושב ב-#sbar (46px, באמצע הכותרת); היומן והלחצנים נפתחים כלוח (.card) מתחתיו אחרי הסריקה הראשונה.
// הפעולה עצמה = אותה סריקה של הכרטיס (hooks/useItemActions.js של W3: verify-item, בחירת פריט, השכרה/החזרה עם כל האישורים), כך שאין
// כאן לוגיקת השכרה כפולה. ההבדל מהסריקה הרגילה: שגיאות לא קופצות כטוסט אלא נרשמות ביומן הפאנל (בנווה: במקום alert חוסם).
// חלון הקשרים (בחירת פריט / "השמלה רשומה בהשכרה אחרת" / אישור מנהל) נשאר חלון - והפוקוס חוזר לשדה כשהוא נסגר.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import useItemActions, { itemName } from '../hooks/useItemActions';
import { OcItemChooserDialog } from './OcBarcodeRow';
import { cleanBarcode, scanResultToSequence, sequenceEntry, SEQUENCE_MUTE_KEY } from './ocNeveLogic';

let audioCtx = null;
function beep(kind) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const tones = kind === 'ok' ? [[880, 0, 0.09]] : [[220, 0, 0.14], [220, 0.19, 0.14]];
    for (const [freq, start, dur] of tones) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.type = kind === 'ok' ? 'sine' : 'square';
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + start);
      osc.stop(audioCtx.currentTime + start + dur);
    }
  } catch { /* אין קול - לא קריטי */ }
}

export default function OcBarcodeSequencePanel({ oc, ui }) {
  // שגיאות הפעולה (ui.toast('error', ...)) נתפסות כאן ומוצגות ביומן; שאר הטוסטים עוברים כרגיל. הפרוקסי יציב (useMemo) כי useItemActions תלוי ב-ui.
  const errRef = useRef(null);
  const sequenceUi = useMemo(() => ({
    ...ui,
    toast: (kind, big, small, action) => { if (kind === 'error') errRef.current = big; else ui.toast(kind, big, small, action); },
  }), [ui]);
  const chooseItem = useCallback(({ candidates, barcode }) => ui.openDialog(OcItemChooserDialog, { candidates, barcode }), [ui]);
  const actions = useItemActions(oc, sequenceUi, { chooseItem });
  const actionsRef = useRef(actions);
  useEffect(() => { actionsRef.current = actions; });
  const setTab = oc.setTab;

  const [value, setValue] = useState('');
  const [entries, setEntries] = useState([]); // החדש ראשון
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(0);
  const [flash, setFlash] = useState(null); // 'ok' | 'error' | null
  const [muted, setMuted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const inputRef = useRef(null);
  const queueRef = useRef([]);
  const runningRef = useRef(false);
  const mutedRef = useRef(false);
  const seqRef = useRef(0);
  const flashTimer = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; clearTimeout(flashTimer.current); }, []);
  useEffect(() => {
    try { if (localStorage.getItem(SEQUENCE_MUTE_KEY) === '1') { setMuted(true); mutedRef.current = true; } } catch { /* ללא אחסון מקומי */ }
    if (inputRef.current) inputRef.current.focus({ preventScroll: true });
  }, []);

  const focusInput = useCallback(() => {
    if (!mountedRef.current) return;
    const el = inputRef.current;
    if (el && document.activeElement !== el) el.focus({ preventScroll: true });
  }, []);

  const record = useCallback((code, result) => {
    const entry = sequenceEntry(code, result, ++seqRef.current);
    setEntries(prev => [entry, ...prev].slice(0, 300));
    if (entry.status !== 'info' && !mutedRef.current) beep(entry.status === 'ok' ? 'ok' : 'error');
    setFlash(entry.status === 'ok' ? 'ok' : (entry.status === 'error' ? 'error' : null));
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => { if (mountedRef.current) setFlash(null); }, 700);
  }, []);

  // סריקה אחת = actions.scan של W3 (מעבר ללשונית פריטים כמו בשורת הסריקה הרגילה)
  const scanOne = useCallback(async (code) => {
    errRef.current = null;
    setTab('items');
    const a = actionsRef.current;
    const r = await a.scan(code);
    return scanResultToSequence(r, {
      errorMessage: errRef.current,
      itemLabel: itemName,
      cancelRent: (item) => a.cancelRent(item, { confirmed: true }),
      cancelReturn: (item) => a.cancelReturn(item, { confirmed: true }),
    });
  }, [setTab]);

  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    if (mountedRef.current) setBusy(true);
    try {
      while (queueRef.current.length > 0 && mountedRef.current) {
        const code = queueRef.current.shift();
        if (mountedRef.current) setQueued(queueRef.current.length);
        let result;
        try {
          result = await scanOne(code);
        } catch (err) {
          console.error(err);
          result = { status: 'error', message: 'שגיאת רשת - הסריקה לא נשמרה' };
        }
        if (!mountedRef.current) break;
        record(code, result);
        // מאפשר ל-React לפרוס את השינוי של הסריקה הקודמת לפני שהברקוד הבא מעובד
        await new Promise(r => setTimeout(r, 0));
        focusInput();
      }
    } finally {
      runningRef.current = false;
      if (mountedRef.current) { setBusy(false); setQueued(0); focusInput(); }
    }
  }, [scanOne, record, focusInput]);

  const submit = () => {
    const code = cleanBarcode(value);
    if (!code) return;
    setValue('');
    queueRef.current.push(code);
    setQueued(queueRef.current.length);
    runQueue();
  };

  const lastUndoable = entries.find(en => en.status === 'ok' && en.undo && !en.undone);
  const undoLast = async () => {
    if (!lastUndoable || busy) return;
    const target = lastUndoable;
    setBusy(true);
    try {
      const r = await target.undo();
      if (r && r.ok === false) throw new Error('undo failed');
      setEntries(prev => prev.map(en => (en.id === target.id ? { ...en, undone: true, message: `${en.message} (בוטל)` } : en)));
    } catch {
      setEntries(prev => [{ id: ++seqRef.current, code: target.code, status: 'error', message: 'ביטול הסריקה נכשל', undo: null, undone: false }, ...prev]);
    } finally {
      setBusy(false);
      focusInput();
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    try { localStorage.setItem(SEQUENCE_MUTE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    focusInput();
  };

  const okCount = entries.filter(en => en.status === 'ok' && !en.undone).length;
  const failed = entries.filter(en => en.status === 'error');
  const feed = entries.slice(0, 3);

  return (
    <div className={`oc-seq${flash ? ` oc-seq-${flash}` : ''}`} data-oc-part="barcode-sequence">
      <div className="inpw">
        <OcIcon name="scan" />
        <input
          ref={inputRef}
          className="inp"
          id="scanIn"
          name="barcode-nofill"
          inputMode="numeric"
          placeholder="רצף ברקודים — השכרה / החזרה"
          aria-label="סריקת ברקוד ברצף"
          aria-busy={busy}
          value={value}
          onChange={(e) => setValue(cleanBarcode(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); submit(); } }}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
        />
      </div>
      {entries.length > 0 || busy || queued > 0 ? (
      <div className="card oc-seq-pop">
      <div className="oc-seq-bar">
        <span className="chip green">נסרקו: {okCount}</span>
        <span className={`chip ${failed.length ? 'amber' : 'gray'}`}>נכשלו: {failed.length}</span>
        {busy || queued > 0 ? <span className="spinner" role="status" aria-label="מעבד..." /> : null}
        {queued > 0 ? <span className="faint">בתור: {queued}</span> : null}
        <span className="oc-seq-sp" />
        <button type="button" className="btn sm" data-tip="מבטל את הסריקה המוצלחת האחרונה" disabled={!lastUndoable || busy} onClick={undoLast}><OcIcon name="undo" size="sm" />בטל סריקה אחרונה</button>
        <button type="button" className={`btn sm tgl${showSummary ? ' on' : ''}`} aria-pressed={showSummary} onClick={() => { setShowSummary(s => !s); focusInput(); }}>סיכום</button>
        <button type="button" className={`btn sm tgl${muted ? '' : ' on'}`} aria-pressed={!muted} data-tip="מתג הפעלה/כיבוי לצפצוף" onClick={toggleMute}><OcIcon name="bell" size="sm" />{muted ? 'צפצוף: כבוי' : 'צפצוף: פעיל'}</button>
      </div>
      {feed.length > 0 ? (
        <ul className="oc-seq-feed" aria-live="polite">
          {feed.map(en => (
            <li key={en.id} className={`oc-seq-${en.status}${en.undone ? ' oc-seq-undone' : ''}`}>
              <b><bdi dir="ltr">{en.code}</bdi></b> — {en.message}
            </li>
          ))}
        </ul>
      ) : null}
      {showSummary ? (
        <div className="oc-seq-sum">
          <div>נסרקו בהצלחה: <b>{okCount}</b> · נכשלו: <b>{failed.length}</b></div>
          {failed.length > 0 ? <ul>{failed.map(en => <li key={en.id}><bdi dir="ltr">{en.code}</bdi> — {en.message}</li>)}</ul> : null}
          {entries.length > 0 ? <button type="button" className="btn sm" onClick={() => { setEntries([]); focusInput(); }}>נקה רשימה</button> : null}
        </div>
      ) : null}
      </div>
      ) : null}
    </div>
  );
}
