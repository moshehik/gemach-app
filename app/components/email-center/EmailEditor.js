'use client';

// עורך מייל אחד במרכז המיילים: נושא ושורות בצורת "דברי דואר" (צ'יפים), תצוגה מקדימה חיה, הפעלה/כיבוי ותזמון.
// שומר רק מה שהשתנה (PUT /api/admin/email-center/template/<id>); איפוס = DELETE. הטיוטה לא נשמרת עד לחיצה על "שמירה".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ic } from '../settings-sim/SettingsDialogs';
import MergeEditor, { VarPalette } from './MergeEditor';
import { api } from './emailCenterApi';

function LineEditor({ line, value, vars, disabled, onChange, onReset, onFocusHandle }) {
  const ref = useRef(null);
  const edited = value !== line.default;
  return (
    <div className="ec-line">
      <div className="ec-line-h">
        <b>{line.label}</b>
        {edited ? <span className="chip gold st-chg">נערך</span> : null}
        {line.bindSetting ? <span className="chip">מסונכרן עם הגדרות מערכת</span> : null}
        {edited && !disabled ? (
          <button type="button" className="ibtn" aria-label={`חזרה לברירת מחדל: ${line.label}`} title="חזרה לברירת מחדל" onClick={onReset}><Ic id="undo" plain /></button>
        ) : null}
      </div>
      <MergeEditor
        ref={ref}
        value={value}
        vars={vars}
        multiline={!!line.multiline}
        disabled={disabled}
        ariaLabel={line.label}
        onChange={onChange}
        onFocusEditor={() => onFocusHandle(ref.current)}
      />
      {line.hint ? <small className="ec-hint">{line.hint}</small> : null}
    </div>
  );
}

function NumberInput({ value, onChange, min = 0, max = 30, label }) {
  return (
    <input
      className="inp ec-num"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value === null || value === undefined ? '' : value}
      aria-label={label}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') { onChange(null); return; }
        const n = Math.max(min, Math.min(max, Math.round(Number(raw))));
        onChange(Number.isFinite(n) ? n : null);
      }}
    />
  );
}

const NOT_RELEVANT = 'לא רלוונטי למייל הזה - הוא נשלח בעקבות פעולה ולא לפי תאריך.';

function Schedule({ email, sched, setSched, disabled }) {
  const modes = email.schedule.modes || [];
  const max = email.schedule.maxDays || 30;
  const hasOrder = modes.includes('order_after');
  const hasBefore = modes.includes('days_before_event');
  const hasAfterReturn = modes.includes('days_after_return');
  const dayWord = (n) => (n === 0 ? 'ביום האירוע' : n === 1 ? 'יום אחד לפני' : `${n} ימים לפני`);
  const addDay = (n) => {
    if (n === null || sched.eventBefore.includes(n) || sched.eventBefore.length >= 5) return;
    setSched({ ...sched, eventBefore: [...sched.eventBefore, n].sort((a, b) => b - a), newDay: null });
  };
  return (
    <div className="ec-sched">
      <div className={`ec-sched-row${hasOrder ? '' : ' ec-off'}`}>
        <b>יחסית להזמנה</b>
        {hasOrder ? (
          <div className="ec-days">
            <div className="seg pill" role="radiogroup" aria-label="מתי נשלח ביחס ליצירת ההזמנה" style={{ '--n': 2, '--i': sched.orderAfter ? 1 : 0 }}>
              <span className="pth" aria-hidden="true" />
              <button type="button" role="radio" aria-checked={!sched.orderAfter} className={!sched.orderAfter ? 'on' : undefined} disabled={disabled} onClick={() => setSched({ ...sched, orderAfter: null })}>מיד</button>
              <button type="button" role="radio" aria-checked={!!sched.orderAfter} className={sched.orderAfter ? 'on' : undefined} disabled={disabled} onClick={() => setSched({ ...sched, orderAfter: sched.orderAfter || 1 })}>אחרי X ימים</button>
            </div>
            {sched.orderAfter ? (
              <>
                <NumberInput value={sched.orderAfter} min={1} max={max} label="ימים אחרי יצירת ההזמנה" onChange={(n) => setSched({ ...sched, orderAfter: n })} />
                <span>ימים מיצירת ההזמנה</span>
              </>
            ) : null}
          </div>
        ) : <span>{modes.includes('immediate') ? 'מיד, בזמן הפעולה (אין אפשרות אחרת)' : NOT_RELEVANT}</span>}
      </div>

      <div className={`ec-sched-row${hasBefore ? '' : ' ec-off'}`}>
        <b>יחסית לאירוע - לפני</b>
        {hasBefore ? (
          <div className="ec-days">
            {sched.eventBefore.map((d) => (
              <span className="ec-pill" key={d}>
                {dayWord(d)}
                {sched.eventBefore.length > 1 && !disabled ? (
                  <button type="button" className="ibtn" aria-label={`הסרת ${dayWord(d)}`} onClick={() => setSched({ ...sched, eventBefore: sched.eventBefore.filter((x) => x !== d) })}><Ic id="x" plain /></button>
                ) : null}
              </span>
            ))}
            {!disabled && sched.eventBefore.length < 5 ? (
              <>
                <NumberInput value={sched.newDay} min={0} max={max} label="הוספת תזכורת: ימים לפני האירוע" onChange={(n) => setSched({ ...sched, newDay: n })} />
                <button type="button" className="btn ghost sm" disabled={sched.newDay === null} onClick={() => addDay(sched.newDay)}><Ic id="plus" />הוספת תזכורת</button>
              </>
            ) : null}
            <small className="ec-hint">0 = ביום האירוע עצמו. אפשר עד 5 תזכורות (למשל 7 ו-1).</small>
          </div>
        ) : <span>{NOT_RELEVANT}</span>}
      </div>

      <div className={`ec-sched-row${hasAfterReturn ? '' : ' ec-off'}`}>
        <b>יחסית לאירוע / להחזרה - אחרי</b>
        {hasAfterReturn ? (
          <div className="ec-days">
            <NumberInput value={sched.returnAfter} min={1} max={max} label="ימים אחרי תאריך ההחזרה" onChange={(n) => setSched({ ...sched, returnAfter: n })} />
            <span>ימים אחרי תאריך ההחזרה הצפוי (נשלח פעם אחת להזמנה)</span>
          </div>
        ) : <span>{NOT_RELEVANT}</span>}
      </div>
      <p className="ec-note">{email.schedule.note}</p>
    </div>
  );
}

export default function EmailEditor({ email, catalog, onBack, onReload, askReset, toast, setError }) {
  const editable = email.editable;
  const emailName = catalog ? catalog.name : email.id;
  const vars = email.vars;
  const initialTexts = useMemo(() => Object.fromEntries(email.lines.map((l) => [l.key, l.value])), [email]);
  const initialSched = useMemo(() => ({
    eventBefore: email.schedule.days && Array.isArray(email.schedule.days) ? email.schedule.days : [],
    returnAfter: typeof email.schedule.days === 'number' ? email.schedule.days : null,
    orderAfter: email.schedule.orderAfterDays || null,
    newDay: null,
  }), [email]);
  const [subject, setSubject] = useState(email.subject ? email.subject.value : '');
  const [texts, setTexts] = useState(initialTexts);
  const [sched, setSched] = useState(initialSched);
  const [saving, setSaving] = useState(false);
  const [prev, setPrev] = useState({ html: '', subject: '', error: '', loading: true });
  const activeHandle = useRef(null);
  const subjectRef = useRef(null);
  const reqId = useRef(0);

  const dirtyLines = email.lines.filter((l) => texts[l.key] !== l.value);
  const subjectDirty = !!email.subject && subject !== email.subject.value;
  const schedDirty = JSON.stringify([sched.eventBefore, sched.returnAfter, sched.orderAfter]) !== JSON.stringify([initialSched.eventBefore, initialSched.returnAfter, initialSched.orderAfter]);
  const dirty = dirtyLines.length > 0 || subjectDirty || schedDirty;

  useEffect(() => {
    try { window.__gmDirty = dirty; } catch { /* */ }
    return () => { try { window.__gmDirty = false; } catch { /* */ } };
  }, [dirty]);

  // תצוגה מקדימה חיה (debounce): הטיוטה נשלחת לשרת, שמאמת אותה כמו בשמירה ומחזיר HTML עם נתוני דמה
  useEffect(() => {
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const draftTexts = {};
      for (const l of email.lines) if (texts[l.key] !== l.default) draftTexts[l.key] = texts[l.key];
      const r = await api('/api/admin/email-center/preview', {
        method: 'POST',
        body: {
          id: email.id,
          draft: { texts: draftTexts, ...(email.subject ? { subject } : {}) },
          withDelivery: email.id === 'orderCreatedAuto',
          ...(email.id === 'pickupReminder' && sched.eventBefore.length ? { daysBefore: sched.eventBefore[0] } : {}),
        },
      });
      if (id !== reqId.current) return;
      setPrev(r.ok ? { html: r.data.html, subject: r.data.subject, error: '', loading: false } : { html: '', subject: '', error: r.error, loading: false });
    }, 350);
    return () => clearTimeout(t);
  }, [texts, subject, sched.eventBefore, email]);

  const insertVar = useCallback((key) => {
    const h = activeHandle.current || (subjectRef.current && email.subject ? subjectRef.current : null);
    if (h) h.insertVar(key);
  }, [email]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const patch = {};
    if (subjectDirty) patch.subject = subject;
    if (dirtyLines.length) patch.texts = Object.fromEntries(dirtyLines.map((l) => [l.key, texts[l.key]]));
    if (schedDirty) {
      patch.schedule = {};
      if (email.schedule.modes.includes('days_before_event')) patch.schedule.eventBefore = sched.eventBefore;
      if (email.schedule.modes.includes('days_after_return') && sched.returnAfter) patch.schedule.returnAfter = sched.returnAfter;
      if (email.schedule.modes.includes('order_after')) patch.schedule.orderAfter = sched.orderAfter;
    }
    const r = await api(`/api/admin/email-center/template/${email.id}`, { method: 'PUT', body: patch });
    setSaving(false);
    if (!r.ok) { setError({ title: 'השמירה נכשלה', text: r.error }); return; }
    toast('המייל נשמר', 'השינויים יחולו על המיילים הבאים שיישלחו');
    await onReload();
  };

  const toggleEnabled = async (next) => {
    const r = await api(`/api/admin/email-center/template/${email.id}`, { method: 'PUT', body: { enabled: next } });
    if (!r.ok) { setError({ title: 'השינוי נכשל', text: r.error }); return; }
    toast(next ? 'המייל הופעל' : 'המייל כובה', emailName);
    await onReload();
  };

  const discard = () => { setTexts(initialTexts); setSubject(email.subject ? email.subject.value : ''); setSched(initialSched); };

  return (
    <>
      <div className="row wrap" style={{ marginBottom: 14, gap: 10, alignItems: 'center' }}>
        <button type="button" className="btn ghost sm" onClick={onBack}><Ic id="back" />חזרה לרשימת המיילים</button>
        <h2 className="adm-h" style={{ margin: 0 }}><span className="adm-hi"><Ic id="mail" /></span>{emailName}</h2>
        {email.edited ? <span className="chip gold">נערך</span> : null}
      </div>

      <section className="st-sec st-card">
        <div className="card adm-rows"><div className="list">
          <div className="li st-row st-ctlrow">
            <div className="ic-b"><Ic id="bell" /></div>
            <div className="t">
              <b className="st-lb">מתי נשלח ולמי</b>
              <small>{catalog ? catalog.trigger : ''}</small>
              <small>נמענים: {catalog ? catalog.recipients : ''}</small>
            </div>
          </div>
          <div className="li st-row st-ctlrow">
            <div className="ic-b"><Ic id="check" /></div>
            <div className="t">
              <b className="st-lb">מופעל</b>
              <small>{email.enabledNote}</small>
            </div>
            <div className="st-ctl">
              {email.enabledEditable ? (
                <label className="sw">
                  <input type="checkbox" aria-label={`הפעלת המייל: ${emailName}`} checked={email.enabled} onChange={(e) => toggleEnabled(e.target.checked)} data-element-name={`מתג_email_${email.id}`} />
                  <i />
                </label>
              ) : <span className="chip">{email.enabledMode === 'locked' ? 'תמיד פעיל' : 'נשלח לפי פעולה'}</span>}
            </div>
          </div>
        </div></div>
      </section>

      {!editable ? (
        <div className="ec-warn" style={{ margin: '14px 0' }}>מייל טכני (מתכנת / סוכן אוטומטי) - מוצג לעיון ולתצוגה מקדימה בלבד. הניסוח שלו נקרא על ידי תהליכים אוטומטיים ולכן נעול לעריכה.</div>
      ) : (
        <VarPalette vars={vars} onInsert={insertVar} />
      )}

      <div className="ec-grid">
        <div>
          {email.subject ? (
            <section className="st-sec st-card">
              <h2 className="adm-h"><span className="adm-hi"><Ic id="send" /></span>נושא המייל</h2>
              <div className="card adm-rows"><div className="list" style={{ padding: 12 }}>
                <MergeEditor ref={subjectRef} value={subject} vars={vars} disabled={!editable} ariaLabel="נושא המייל" onChange={setSubject} onFocusEditor={() => { activeHandle.current = subjectRef.current; }} />
                {email.subject.note ? <small className="ec-hint">{email.subject.note}</small> : null}
                {email.subject.realSubject ? <small className="ec-hint">זהו הנושא שנשלח בפועל (הרשומה הישנה בקטלוג הייתה שונה).</small> : null}
                {email.subject.edited && editable ? (
                  <div className="ec-actions"><button type="button" className="btn ghost sm" onClick={() => setSubject(email.subject.default)}><Ic id="undo" />חזרה לנושא ברירת המחדל</button></div>
                ) : null}
              </div></div>
            </section>
          ) : (
            <p className="ec-note">הנושא של המייל הזה מוקלד על ידי השולח בעת השליחה - אין נושא קבוע לעריכה.</p>
          )}

          {email.lines.length ? (
            <section className="st-sec st-card">
              <h2 className="adm-h"><span className="adm-hi"><Ic id="pencil" /></span>שורות המייל</h2>
              <div className="card adm-rows"><div className="list" style={{ padding: '4px 12px' }}>
                {email.lines.map((l) => (
                  <LineEditor
                    key={l.key}
                    line={l}
                    value={texts[l.key]}
                    vars={vars}
                    disabled={!editable}
                    onChange={(v) => setTexts((t) => (t[l.key] === v ? t : { ...t, [l.key]: v }))}
                    onReset={() => setTexts((t) => ({ ...t, [l.key]: l.default }))}
                    onFocusHandle={(h) => { activeHandle.current = h; }}
                  />
                ))}
              </div></div>
            </section>
          ) : null}

          <section className="st-sec st-card">
            <h2 className="adm-h"><span className="adm-hi"><Ic id="clock" /></span>תזמון השליחה</h2>
            <div className="card adm-rows"><div className="list" style={{ padding: 12 }}>
              <Schedule email={email} sched={sched} setSched={setSched} disabled={!editable} />
            </div></div>
          </section>

          {editable ? (
            <div className="ec-sticky-save">
              <button type="button" className="btn primary" disabled={!dirty || saving} onClick={save} data-element-name={`כפתור_email_save_${email.id}`}><Ic id="check" />{saving ? 'שומר…' : 'שמירה'}</button>
              <button type="button" className="btn ghost" disabled={!dirty || saving} onClick={discard}><Ic id="undo" />ביטול השינויים</button>
              <button type="button" className="btn ghost" disabled={saving || (!email.edited && !dirty)} onClick={() => askReset(email)} style={{ marginInlineStart: 'auto' }}><Ic id="refresh" />איפוס המייל לברירת מחדל</button>
              {dirty ? <span className="chip gold">יש שינויים שלא נשמרו</span> : null}
            </div>
          ) : null}
        </div>

        <aside className="ec-prev" aria-label="תצוגה מקדימה">
          <div className="ec-prev-subj"><b>נושא:</b>{prev.subject || '…'}</div>
          {prev.error ? <div className="ec-prev-err" role="alert">{prev.error}</div> : null}
          <iframe className="ec-frame" title="תצוגה מקדימה של המייל" sandbox="" srcDoc={prev.html || '<p style="font-family:sans-serif;padding:16px">טוען תצוגה…</p>'} />
          <small className="ec-hint">נתוני דוגמה בלבד. לא נשלח כלום.</small>
        </aside>
      </div>
    </>
  );
}
