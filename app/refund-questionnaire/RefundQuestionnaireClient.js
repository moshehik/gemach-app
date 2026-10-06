'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  optionsForQuestion, visibleQuestions, computeProgress, isAnswered, validateSubmission, summarize, pruneHidden,
  OTHER,
} from '@/lib/policyQuestionnaire/logic';

// טופס השאלון להנהלות (עברית, RTL, נייד קודם). כל הלוגיקה (תצוגה מותנית, תקינות, התקדמות) ב-lib/policyQuestionnaire/logic.js.
// שמירה אוטומטית (PUT) אחרי כל שינוי בהשהיה של פחות משנייה; שליחה סופית (POST) אחרי שלב אישור; אחרי שליחה אפשר לעדכן.
// בעיית מייל לא מאבדת תשובות: מוצגת הודעה עם כפתור "ניסיון חוזר" (POST /api/policy-questionnaire/resend).

const API = '/api/policy-questionnaire';
const SAVE_DELAY_MS = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callApi(method, body, url = API) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let json = {};
  try { json = await res.json(); } catch { /* גוף ריק */ }
  if (!res.ok) {
    const err = new Error(json.error || 'אירעה שגיאה. נסו שוב בעוד רגע.');
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

export default function RefundQuestionnaireClient() {
  const [phase, setPhase] = useState('loading'); // loading | error | form | done
  const [loadError, setLoadError] = useState('');
  const [qn, setQn] = useState(null);
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [serverState, setServerState] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saving | saved | error
  const [saveError, setSaveError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [mail, setMail] = useState(null); // { emailSent, emailError }
  const [retrying, setRetrying] = useState(false);
  const [editingSent, setEditingSent] = useState(false);
  const [openComments, setOpenComments] = useState({});

  const latest = useRef({ answers, name, role });
  useEffect(() => { latest.current = { answers, name, role }; });
  const timer = useRef(null);
  const inflight = useRef(false);
  const queued = useRef(false);

  const load = useCallback(async () => {
    setPhase('loading');
    setLoadError('');
    try {
      let data;
      try {
        data = await callApi('GET');
      } catch (e) {
        if (e.status === 503) { await sleep(1500); data = await callApi('GET'); } else throw e; // התעוררות של מסד הנתונים: ניסיון חוזר אחד
      }
      setQn(data.questionnaire);
      setAnswers(data.answers || {});
      setName(data.respondent?.name || '');
      setRole(data.respondent?.role || '');
      setServerState(data.response || null);
      const opened = {};
      Object.entries(data.answers || {}).forEach(([id, a]) => { if (a && a.comment) opened[id] = true; });
      setOpenComments(opened);
      const submitted = data.response && data.response.status === 'submitted';
      if (submitted && !data.response.pendingChanges) {
        setMail({ emailSent: !data.response.needsEmail, emailError: data.response.emailError });
        setPhase('done');
      } else {
        setEditingSent(!!(submitted && data.response.pendingChanges));
        setPhase('form');
      }
    } catch (e) {
      setLoadError(e.message || 'לא הצלחנו לטעון את השאלון.');
      setPhase('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---- שמירה אוטומטית ----
  const save = useCallback(async () => {
    if (inflight.current) { queued.current = true; return; }
    inflight.current = true;
    try {
      // לולאה (ולא קריאה רקורסיבית): שינוי שנוסף בזמן שמירה נשמר מיד אחריה, עד שאין עוד מה לשמור
      do {
        queued.current = false;
        setSaveState('saving');
        const snap = latest.current;
        try {
          const json = await callApi('PUT', { answers: snap.answers, name: snap.name, role: snap.role });
          setServerState(json.response || null);
          setSaveError('');
          setSaveState(queued.current ? 'saving' : 'saved');
        } catch (e) {
          setSaveError(e.message || '');
          setSaveState('error');
          queued.current = false; // עריכה הבאה תפעיל ניסיון חדש
        }
      } while (queued.current);
    } finally {
      inflight.current = false;
    }
  }, []);

  const scheduleSave = useCallback(() => {
    setSaveState('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; save(); }, SAVE_DELAY_MS);
  }, [save]);

  // סגירת הלשונית באמצע השהיה: שולחים מה שנשאר (keepalive)
  useEffect(() => {
    const onHide = () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      const snap = latest.current;
      try {
        fetch(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snap), keepalive: true });
      } catch { /* אין מה לעשות */ }
    };
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); if (timer.current) clearTimeout(timer.current); };
  }, []);

  const setAnswer = (qid, patch) => {
    setAnswers((prev) => ({ ...prev, [qid]: { choice: null, otherText: '', comment: '', ...(prev[qid] || {}), ...patch } }));
    scheduleSave();
  };
  const changeName = (v) => { setName(v); scheduleSave(); };
  const changeRole = (v) => { setRole(v); scheduleSave(); };

  // ---- שליחה ----
  const waitIdle = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    for (let i = 0; i < 100 && inflight.current; i += 1) await sleep(100);
  };

  const requestSubmit = () => {
    setSubmitError('');
    const pruned = pruneHidden(qn, answers);
    const check = validateSubmission(qn, pruned, { name });
    if (!check.ok) {
      setShowErrors(true);
      const first = check.errors[0];
      const el = typeof document !== 'undefined' && document.getElementById(first ? `rq-q-${first.questionId}` : 'rq-respondent');
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setConfirmOpen(true);
  };

  const doSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      await waitIdle();
      const json = await callApi('POST', { answers: pruneHidden(qn, answers), name, role });
      setAnswers(json.answers || answers);
      setServerState(json.response || null);
      setMail({ emailSent: !!json.emailSent, emailError: json.emailError || null });
      setConfirmOpen(false);
      setEditingSent(false);
      setShowErrors(false);
      setSaveState('idle');
      setPhase('done');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    } catch (e) {
      setConfirmOpen(false);
      if (e.status === 400) setShowErrors(true);
      setSubmitError(e.message || 'השליחה נכשלה. התשובות נשמרו כטיוטה - נסו שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  const retryEmail = async () => {
    setRetrying(true);
    try {
      const json = await callApi('POST', null, `${API}/resend`);
      setMail({ emailSent: !!json.emailSent, emailError: json.emailError || null });
      setServerState(json.response || serverState);
    } catch (e) {
      setMail({ emailSent: false, emailError: e.message });
    } finally {
      setRetrying(false);
    }
  };

  const startEditing = () => {
    setEditingSent(true);
    setSaveState('idle');
    setPhase('form');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  // ---- תצוגה ----
  if (phase === 'loading') {
    return (
      <div className="rq-root" dir="rtl">
        <div className="rq-card rq-intro" role="status">טוען את השאלון...</div>
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="rq-root" dir="rtl">
        <div className="callout callout-danger rq-banner" role="alert">{loadError}</div>
        <button type="button" className="btn btn-primary" onClick={load}>ניסיון חוזר</button>
      </div>
    );
  }

  if (phase === 'done') {
    return <DoneView qn={qn} answers={answers} name={name} mail={mail} retrying={retrying} retryEmail={retryEmail} startEditing={startEditing} />;
  }

  return (
    <FormView
      qn={qn} answers={answers} name={name} role={role} saveState={saveState} saveError={saveError} showErrors={showErrors}
      editingSent={editingSent} serverState={serverState} submitError={submitError} submitting={submitting} confirmOpen={confirmOpen}
      openComments={openComments} setOpenComments={setOpenComments} changeName={changeName} changeRole={changeRole}
      setAnswer={setAnswer} requestSubmit={requestSubmit} doSubmit={doSubmit} setConfirmOpen={setConfirmOpen}
    />
  );
}

/** מסך התודה וסיכום התשובות (מיוצא לבדיקות רינדור). */
export function DoneView({ qn, answers, name, mail, retrying, retryEmail, startEditing }) {
  const sections = summarize(qn, answers);
  const prog = computeProgress(qn, answers);
  return (
    <div className="rq-root" dir="rtl">
      <div className="rq-card rq-thanks">
        <div style={{ fontSize: 40 }} aria-hidden="true">✓</div>
        <h1>תודה, התשובות נשלחו</h1>
        <p style={{ margin: '0 0 6px', color: 'var(--text-2)' }}>
          {name ? `${name}, ` : ''}ענית על {prog.answered} מתוך {prog.total} שאלות של {qn.gmachName}.
        </p>
      </div>
      {mail && mail.emailSent && (
        <div className="callout callout-success rq-banner">התשובות נשמרו ונשלחו במייל לבעלים.</div>
      )}
      {mail && !mail.emailSent && (
        <div className="callout callout-warning rq-banner" role="alert" style={{ flexDirection: 'column' }}>
          <div><b>התשובות נשמרו, המייל לא נשלח - ננסה שוב.</b></div>
          <div>התשובות שלכן בטוחות וגלויות לבעלים באתר. אפשר ללחוץ על הכפתור כדי לנסות לשלוח את המייל עכשיו.</div>
          <div><button type="button" className="btn btn-primary btn-sm" onClick={retryEmail} disabled={retrying}>{retrying ? 'שולח...' : 'ניסיון חוזר לשליחת המייל'}</button></div>
        </div>
      )}
      <div className="rq-actions print-hide">
        <button type="button" className="btn btn-secondary" onClick={startEditing}>עדכון התשובות</button>
      </div>
      {sections.map((s) => (s.items.length > 0 && (
        <div className="rq-card" key={s.title}>
          <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>{s.title}</h2>
          {s.items.map((it) => (
            <div className="rq-summary-item" key={it.id}>
              <div className="rq-summary-q">{it.text}</div>
              <div className="rq-summary-a">{it.answerText}</div>
              {it.comment && <div className="rq-summary-c">הערה: {it.comment}</div>}
            </div>
          ))}
        </div>
      )))}
    </div>
  );
}

/** טופס השאלון עצמו (מיוצא לבדיקות רינדור). */
export function FormView({
  qn, answers, name, role, saveState, saveError, showErrors, editingSent, serverState, submitError, submitting, confirmOpen,
  openComments, setOpenComments, changeName, changeRole, setAnswer, requestSubmit, doSubmit, setConfirmOpen,
}) {
  const vis = visibleQuestions(qn, answers);
  const prog = computeProgress(qn, answers);
  const pct = prog.total ? Math.round((prog.answered / prog.total) * 100) : 0;
  const visIndex = new Map(vis.map((q, i) => [q.id, i + 1]));
  const missingIds = showErrors ? new Set(validateSubmission(qn, pruneHidden(qn, answers), { name }).errors.map((e) => e.questionId)) : new Set();
  const nameMissing = showErrors && !name.trim();
  const saveText = {
    idle: '',
    pending: 'ממתין לשמירה...',
    saving: 'שומר...',
    saved: 'נשמר',
    error: 'השמירה נכשלה - ננסה שוב',
  }[saveState];

  return (
    <div className="rq-root" dir="rtl">
      <div className="rq-head">
        <h1>שאלון ביטולים וזיכויים - {qn.gmachName}</h1>
      </div>

      <div className="rq-card rq-intro">{qn.intro_he}</div>

      {editingSent && (
        <div className="callout callout-info rq-banner">
          התשובות כבר נשלחו פעם אחת. אפשר לשנות אותן, ובסוף ללחוץ שוב על "שליחה" כדי שהבעלים יקבלו את הגרסה המעודכנת.
          {serverState && serverState.pendingChanges ? ' יש שינויים שעוד לא נשלחו.' : ''}
        </div>
      )}

      <div className="rq-card" id="rq-respondent">
        <b>מי עונה?</b>
        <div className="rq-fields">
          <div className="field">
            <label htmlFor="rq-name">שם</label>
            <input id="rq-name" className="input" value={name} onChange={(e) => changeName(e.target.value)} maxLength={120} autoComplete="name" aria-invalid={nameMissing || undefined} />
            {nameMissing && <span className="error-text">נא למלא שם</span>}
          </div>
          <div className="field">
            <label htmlFor="rq-role">תפקיד</label>
            <input id="rq-role" className="input" value={role} onChange={(e) => changeRole(e.target.value)} maxLength={120} />
          </div>
        </div>
      </div>

      <div className="rq-progress" role="status" aria-live="polite">
        <div className="rq-progress-row">
          <span>ענית על {prog.answered} מתוך {prog.total}</span>
          <span className={`rq-save ${saveState === 'saved' ? 'ok' : saveState === 'error' ? 'err' : ''}`}>
            {saveText}{saveState === 'error' && saveError ? ` (${saveError})` : ''}
          </span>
        </div>
        <div className="rq-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      </div>

      {qn.sections.map((section) => {
        const qs = section.questions.filter((q) => visIndex.has(q.id));
        if (!qs.length) return null;
        return (
          <section key={section.title_he}>
            <h2 className="rq-section-title">{section.title_he}</h2>
            {section.intro_he && <p className="rq-section-intro">{section.intro_he}</p>}
            {qs.map((q) => {
              const a = answers[q.id] || { choice: null, otherText: '', comment: '' };
              const done = isAnswered(a);
              const opts = optionsForQuestion(q);
              const commentOpen = openComments[q.id] || !!a.comment;
              return (
                <div key={q.id} id={`rq-q-${q.id}`} className={`rq-card${missingIds.has(q.id) ? ' rq-missing' : done ? ' rq-done' : ''}`}>
                  <div className="rq-qhead">
                    <span className="rq-qnum" aria-hidden="true">{visIndex.get(q.id)}</span>
                    <h3 className="rq-q" id={`rq-label-${q.id}`}>{q.text_he}</h3>
                  </div>
                  <div className="rq-example"><b>דוגמה: </b>{q.example_he}</div>
                  <p className="rq-today"><b>היום אצלכן: </b>{q.today_he}</p>
                  <div className="rq-opts" role="radiogroup" aria-labelledby={`rq-label-${q.id}`}>
                    {opts.map((o) => {
                      const on = a.choice === o.value;
                      return (
                        <label key={String(o.value)} className={`rq-opt${on ? ' on' : ''}${o.kind === 'undecided' ? ' soft' : ''}`}>
                          <input type="radio" name={`rq-${q.id}`} checked={on} onChange={() => setAnswer(q.id, { choice: o.value })} />
                          <span>{o.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {a.choice === OTHER && (
                    <div className="rq-other">
                      <input className="input" placeholder="כתבו כאן את התשובה שלכן" value={a.otherText || ''} maxLength={2000} onChange={(e) => setAnswer(q.id, { otherText: e.target.value })} aria-label="פירוט לתשובה אחר" />
                    </div>
                  )}
                  {missingIds.has(q.id) && (
                    <div className="rq-err" role="alert">{a.choice === OTHER ? 'נא לכתוב את התשובה בשדה "אחר".' : 'נא לבחור תשובה.'}</div>
                  )}
                  {commentOpen ? (
                    <div className="rq-comment">
                      <textarea className="textarea" placeholder="הערה (לא חובה)" value={a.comment || ''} maxLength={2000} onChange={(e) => setAnswer(q.id, { comment: e.target.value })} aria-label="הערה לשאלה" />
                    </div>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm rq-comment-toggle" onClick={() => setOpenComments((p) => ({ ...p, [q.id]: true }))}>+ הוספת הערה</button>
                  )}
                  {q.sourceNote_he && <p className="rq-why"><b>למה שואלים: </b>{q.sourceNote_he}</p>}
                </div>
              );
            })}
          </section>
        );
      })}

      {submitError && <div className="callout callout-danger rq-banner" role="alert">{submitError}</div>}
      {showErrors && (missingIds.size > 0 || nameMissing) && (
        <div className="callout callout-warning rq-banner" role="alert">
          {missingIds.size > 0 ? `חסרות תשובות ב-${missingIds.size} שאלות (מסומנות באדום).` : ''}{nameMissing ? ' נא למלא שם.' : ''}
        </div>
      )}

      <div className="rq-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={requestSubmit} disabled={submitting}>שליחה</button>
        <span className="rq-save">{prog.answered < prog.total ? `נשארו ${prog.total - prog.answered} שאלות` : 'הכול נענה - אפשר לשלוח'}</span>
      </div>

      {confirmOpen && (
        <div className="rq-confirm" role="dialog" aria-modal="true" aria-labelledby="rq-confirm-title">
          <div className="rq-confirm-box">
            <h2 id="rq-confirm-title">לשלוח את התשובות?</h2>
            <p>התשובות יישלחו לבעלים במייל. אחרי השליחה עדיין אפשר ללחוץ על "עדכון התשובות" ולשלוח שוב.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={doSubmit} disabled={submitting}>{submitting ? 'שולח...' : 'כן, לשלוח'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>חזרה לשאלון</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
