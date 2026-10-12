'use client';

// QuickTransferDialog - חלונית צפה להקלדה מהירה של רצף ברקודים (docs/branches-plan.md, שלב ב).
// מצבים: שיוך לסניף / העברה למחסן / העברה מהמחסן (לסניף) / העברה לרזרבה / למחסן לפי מספר קרטון (המספר נקלט פעם אחת, ואז רצף ברקודים).
// כל סריקה נשלחת בנפרד (POST /api/dresses/items/relocate) ומקבלת שורת תוצאה; ברקוד לא מוכר / מושכר / מחוק מסומן באדום ולא עוצר את הרצף.
// הפוקוס נשאר בשדה הברקוד (סורק ברקוד = הקלדה + Enter). אפשר גם להדביק כמה ברקודים מופרדים ברווח / שורה / פסיק. "ביטול אחרון" מחזיר את
// המצב הקודם של הפריט האחרון שהשתנה. פתיחה: ui.openDialog(QuickTransferDialog, { branches, defaultBranch, onApplied }) בכרטיס הדגם,
// או <QuickTransferPanel> בעמוד /dashboard/dresses/transfer.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './quick-transfer.css';
import { DlgBtn, DlgButtons, DlgHead } from '../order-card/OcUi';
import OcIcon from '../order-card/OcIcon';
import { DcPill } from '../dress-card/DcParts';
import { MODE_LABEL, describeSnapshot } from '@/lib/dressRelocate';

const MODES = [
  { key: 'branch', label: 'שיוך לסניף', icon: 'pin' },
  { key: 'to_warehouse', label: 'למחסן', icon: 'box' },
  { key: 'from_warehouse', label: 'מהמחסן', icon: 'home' },
  { key: 'to_reserve', label: 'לרזרבה', icon: 'flag' },
  { key: 'to_carton', label: 'קרטון', icon: 'tag' },
];
const NEEDS_BRANCH = new Set(['branch', 'from_warehouse']);
const HINT = {
  branch: 'כל ברקוד שתסרקו ישויך לסניף שנבחר (המיקום - חנות / מחסן / רזרבה - לא משתנה).',
  to_warehouse: 'כל ברקוד שתסרקו יועבר למחסן.',
  from_warehouse: 'כל ברקוד שתסרקו יוצא מהמחסן, חוזר לחנות ומשויך לסניף שנבחר.',
  to_reserve: 'כל ברקוד שתסרקו יועבר לרזרבה.',
  to_carton: 'מקלידים מספר קרטון פעם אחת, ואז סורקים ברצף את כל הברקודים שבו - כולם יועברו למחסן עם מספר הקרטון.',
};

let seq = 0;
const splitCodes = (s) => String(s || '').split(/[\s,;]+/).map((x) => x.replace(/[^0-9A-Za-z]/g, '')).filter(Boolean);

export function useQuickTransfer({ defaultBranch, onApplied }) {
  const [log, setLog] = useState([]);
  const queue = useRef([]);
  const running = useRef(false);
  const applied = useRef(0);
  const cbRef = useRef(onApplied);
  useEffect(() => { cbRef.current = onApplied; });

  const patchEntry = useCallback((id, patch) => setLog((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e))), []);

  const post = async (payload) => {
    try {
      const res = await fetch('/api/dresses/items/relocate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, code: 'http', error: data.error || (res.status === 403 || res.status === 401 ? 'אין הרשאה להעביר פריטים' : 'שגיאה בשרת') };
      return data;
    } catch {
      return { ok: false, code: 'net', error: 'שגיאת תקשורת - הפריט לא עודכן' };
    }
  };

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) {
      const job = queue.current.shift();
      const r = await post(job.payload);
      if (r.ok) {
        if (!r.noop) { applied.current += 1; if (cbRef.current) cbRef.current(); }
        patchEntry(job.id, {
          status: r.noop ? 'noop' : 'ok', model: r.model, size: r.size, warnings: r.warnings || [], after: r.after, before: r.before,
          text: r.noop ? 'ללא שינוי - כבר שם' : describeSnapshot(r.after),
          undo: r.noop ? null : { itemId: r.itemId, before: r.before },
        });
      } else {
        patchEntry(job.id, { status: 'err', text: r.error || 'שגיאה', model: r.model, size: r.size });
      }
    }
    running.current = false;
  }, [patchEntry]);

  const submit = useCallback((codes, { mode, branch, carton }) => {
    const entries = codes.map((barcode) => ({ id: ++seq, barcode, status: 'pending', text: 'מעדכן…', mode, branch: branch || defaultBranch || '', carton: carton || '' }));
    setLog((cur) => [...entries.slice().reverse(), ...cur]);
    for (const e of entries) queue.current.push({ id: e.id, payload: { mode, barcode: e.barcode, branch: branch || undefined, carton: carton || undefined } });
    run();
  }, [run, defaultBranch]);

  const undoLast = useCallback(async () => {
    const last = log.find((e) => e.status === 'ok' && e.undo);
    if (!last) return false;
    patchEntry(last.id, { status: 'pending', text: 'מבטל…' });
    const r = await post({ mode: 'restore', itemId: last.undo.itemId, restore: last.undo.before });
    if (r.ok) { applied.current += 1; if (cbRef.current) cbRef.current(); patchEntry(last.id, { status: 'undone', text: 'בוטל - הפריט חזר ל' + describeSnapshot(last.undo.before), undo: null }); return true; }
    patchEntry(last.id, { status: 'err', text: r.error || 'הביטול נכשל' });
    return false;
  }, [log, patchEntry]);

  return { log, submit, undoLast, applied, clear: () => setLog([]), busy: log.some((e) => e.status === 'pending') };
}

/** הגוף של החלונית - משמש גם בחלון וגם בעמוד עצמאי */
export function QuickTransferPanel({ branches, defaultBranch, onApplied, autoFocus = true }) {
  const names = useMemo(() => (branches || []).map((b) => (typeof b === 'string' ? b : b.name)), [branches]);
  const [mode, setMode] = useState('branch');
  const [branch, setBranch] = useState(defaultBranch && names.includes(defaultBranch) ? defaultBranch : names[0] || '');
  const [carton, setCarton] = useState('');
  const [cartonDraft, setCartonDraft] = useState('');
  const [value, setValue] = useState('');
  const bcRef = useRef(null);
  const cartonRef = useRef(null);
  const qt = useQuickTransfer({ defaultBranch: branch, onApplied });

  const needCarton = mode === 'to_carton' && !carton;
  const ready = (!NEEDS_BRANCH.has(mode) || !!branch) && !needCarton;

  useEffect(() => {
    if (!autoFocus) return;
    const el = needCarton ? cartonRef.current : bcRef.current;
    if (el) el.focus();
  }, [mode, needCarton, autoFocus]);

  const send = (raw) => {
    const codes = splitCodes(raw);
    if (!codes.length || !ready) return;
    qt.submit(codes, { mode, branch: NEEDS_BRANCH.has(mode) ? branch : undefined, carton: mode === 'to_carton' ? carton : undefined });
    setValue('');
    if (bcRef.current) bcRef.current.focus();
  };

  const okCount = qt.log.filter((e) => e.status === 'ok').length;
  const errCount = qt.log.filter((e) => e.status === 'err').length;
  const canUndo = qt.log.some((e) => e.status === 'ok' && e.undo) && !qt.busy;

  return (
    <div className="qt-root" dir="rtl" data-testid="quick-transfer">
      <div className="field">
        <label className="lbl">פעולה</label>
        <DcPill id="qtMode" data-guide-id="qt.mode" value={mode} options={MODES} onChange={(m) => { setMode(m); }} label="פעולה" />
      </div>
      <div className="qt-hint">{HINT[mode]}</div>

      {NEEDS_BRANCH.has(mode) ? (
        <div className="field">
          <label className="lbl" htmlFor="qtBranch">{mode === 'from_warehouse' ? 'סניף יעד' : 'סניף'}</label>
          <select id="qtBranch" data-guide-id="qt.branch" className="inp" value={branch} onChange={(e) => setBranch(e.target.value)}>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      ) : null}

      {mode === 'to_carton' ? (
        carton ? (
          <div className="qt-carton"><OcIcon name="tag" /><span>קרטון <b>{carton}</b></span>
            <button type="button" className="btn ghost sm" onClick={() => { setCarton(''); setCartonDraft(''); }}>החלפת קרטון</button></div>
        ) : (
          <div className="field">
            <label className="lbl" htmlFor="qtCarton">מספר קרטון</label>
            <input id="qtCarton" ref={cartonRef} className="inp" value={cartonDraft} inputMode="numeric" autoComplete="off" placeholder="הקלידו מספר קרטון ו-Enter"
              onChange={(e) => setCartonDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); const c = cartonDraft.trim(); if (c) { setCarton(c); } } }} />
          </div>
        )
      ) : null}

      <div className="field">
        <label className="lbl" htmlFor="qtBarcode">ברקוד {ready ? '' : '(קודם השלימו את ההגדרות למעלה)'}</label>
        <input
          id="qtBarcode" data-guide-id="qt.barcode" ref={bcRef} className="inp qt-bc" value={value} inputMode="numeric" autoComplete="off" disabled={!ready}
          placeholder="סרקו או הקלידו ברקוד ו-Enter" data-autofocus={autoFocus ? 'true' : undefined}
          onChange={(e) => { const v = e.target.value; if (/[\s,;]/.test(v.trim()) && splitCodes(v).length > 1) send(v); else setValue(v); }}
          onPaste={(e) => { const t = e.clipboardData && e.clipboardData.getData('text'); if (t && splitCodes(t).length > 1) { e.preventDefault(); send(t); } }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); send(value); } }}
        />
      </div>

      <div className="qt-bar">
        <span className="qt-count" role="status" aria-live="polite">
          {qt.log.length ? <>{okCount} עודכנו{errCount ? <> · <b className="qt-err-n">{errCount} שגיאות</b></> : null}</> : 'עוד לא נסרק דבר'}
        </span>
        <span className="qt-bar-btns">
          <button type="button" className="btn sm" onClick={qt.undoLast} disabled={!canUndo} data-guide-id="qt.undo" data-act="qt-undo"><OcIcon name="undo" size="sm" />ביטול אחרון</button>
          <button type="button" className="btn ghost sm" onClick={qt.clear} disabled={!qt.log.length || qt.busy}>ניקוי רשימה</button>
        </span>
      </div>

      <ul className="qt-list" aria-label="תוצאות הסריקות">
        {qt.log.map((e) => (
          <li key={e.id} className={`qt-row qt-${e.status}`} data-status={e.status}>
            <span className="qt-ic">{e.status === 'ok' ? <OcIcon name="check" size="sm" /> : e.status === 'err' ? <OcIcon name="alert" size="sm" /> : e.status === 'pending' ? <span className="spin" /> : e.status === 'undone' ? <OcIcon name="undo" size="sm" /> : <OcIcon name="info" size="sm" />}</span>
            <bdi className="qt-code">{e.barcode}</bdi>
            <span className="qt-txt">
              {e.model ? <span className="qt-model">{e.model}{e.size ? ` · מידה ${e.size}` : ''}</span> : null}
              <span className="qt-res">{e.status === 'ok' || e.status === 'noop' ? `${MODE_LABEL[e.mode] || ''}: ` : ''}{e.text}</span>
              {(e.warnings || []).map((w) => <span key={w} className="qt-warn">{w}</span>)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** חלון לשימוש עם ui.openDialog של כרטיס הדגם / הזמנה */
export default function QuickTransferDialog({ branches, defaultBranch, onApplied, close }) {
  // רענון הרשימה שמאחורי החלון: מרוכז (לא אחרי כל סריקה), וגם בסגירה בכל דרך (Esc / רקע / כפתור) - דרך ניקוי האפקט
  const timer = useRef(null);
  const dirty = useRef(false);
  const cb = useRef(onApplied);
  useEffect(() => { cb.current = onApplied; });
  const flush = useCallback(() => { clearTimeout(timer.current); if (dirty.current) { dirty.current = false; if (cb.current) cb.current(); } }, []);
  useEffect(() => flush, [flush]);
  const mark = useCallback(() => { dirty.current = true; clearTimeout(timer.current); timer.current = setTimeout(flush, 4000); }, [flush]);
  return (
    <>
      <DlgHead id="oc-dlg-t" title="העברה מהירה של ברקודים" sub="סורקים רצף ברקודים ומעבירים את כולם בבת אחת" />
      <QuickTransferPanel branches={branches} defaultBranch={defaultBranch} onApplied={mark} />
      <DlgButtons style={{ marginTop: 16 }}>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>סגירה</DlgBtn>
      </DlgButtons>
    </>
  );
}
