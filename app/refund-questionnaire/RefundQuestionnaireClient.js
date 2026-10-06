'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  optionsForQuestion, visibleQuestions, computeProgress, isAnswered, validateSubmission, summarize, pruneHidden, formatIsraelDateTime,
  OTHER, isMulti, emptyAnswer, toggleMultiChoice, isOptionOn, selectionHint,
} from '@/lib/policyQuestionnaire/logic';
import { draftKey, browserStorage, saveDraft, loadDraft, clearDraft } from '@/lib/policyQuestionnaire/draft';

// טופס השאלון להנהלות (עברית, RTL, נייד קודם). כל הלוגיקה (תצוגה מותנית, תקינות, התקדמות) ב-lib/policyQuestionnaire/logic.js.
// אין שמירה בשרת עד לשליחה: הטיוטה נשמרת רק בדפדפן הזה (localStorage, lib/policyQuestionnaire/draft.js) אחרי כל שינוי, ונמחקת בשליחה סופית (POST).
// הדף עובד גם כשהאחסון חסום (אז רק מציגים שאי אפשר לשמור טיוטה). אחרי שליחה: מסך תודה, ו"עדכון התשובות" טוען את השליחה האחרונה מהשרת
// (נקראת מהשרשור) לטופס, כך ששליחה חוזרת מתחילה ממנה. בעיית מייל לא מאבדת תשובות: הודעה עם כפתור "ניסיון חוזר" (POST /api/policy-questionnaire/resend).

const API = '/api/policy-questionnaire';
const SAVE_DELAY_MS = 500;
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
  const [submission, setSubmission] = useState(null); // { submittedAt, count, updated, partial } | null - השליחה האחרונה בשרת
  const [saveState, setSaveState] = useState('idle'); // idle | saved | nostore
  const [draftInfo, setDraftInfo] = useState(null); // { savedAt } כשהטופס שוחזר מטיוטה בדפדפן
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
  const keyRef = useRef('');
  const storageRef = useRef(null);
  const lastSent = useRef({ answers: {}, name: '', role: '' });
  const frozen = useRef(false); // אחרי שליחה סופית לא כותבים טיוטה (כדי שלא תחזור אחרי שנמחקה)

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
      const sent = { answers: data.answers || {}, name: data.respondent?.name || '', role: data.respondent?.role || '' };
      lastSent.current = sent;
      keyRef.current = draftKey(data.questionnaireKey, data.me?.id || '');
      storageRef.current = browserStorage();
      setSubmission(data.submission || null);
      const draft = loadDraft(storageRef.current, keyRef.current, data.questionnaire);
      const start = draft ? { answers: draft.answers, name: draft.name || sent.name, role: draft.role || sent.role } : sent;
      setAnswers(start.answers);
      setName(start.name);
      setRole(start.role);
      const opened = {};
      Object.entries(start.answers).forEach(([id, a]) => { if (a && a.comment) opened[id] = true; });
      setOpenComments(opened);
      frozen.current = false;
      if (draft) {
        setDraftInfo({ savedAt: draft.savedAt });
        setEditingSent(!!data.submission);
        setPhase('form');
      } else if (data.submission) {
        setDraftInfo(null);
        setMail(null);
        setPhase('done');
      } else {
        setDraftInfo(null);
        setEditingSent(false);
        setPhase('form');
      }
    } catch (e) {
      setLoadError(e.message || 'לא הצלחנו לטעון את השאלון.');
      setPhase('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---- טיוטה בדפדפן ----
  const persist = useCallback(() => {
    if (frozen.current || !keyRef.current) return;
    const ok = saveDraft(storageRef.current, keyRef.current, latest.current);
    setSaveState(ok ? 'saved' : 'nostore');
  }, []);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; persist(); }, SAVE_DELAY_MS);
  }, [persist]);

  // סגירת הלשונית באמצע השהיה: שומרים מיד מה שנשאר (האחסון סינכרוני)
  useEffect(() => {
    const flush = () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      persist();
    };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); if (timer.current) clearTimeout(timer.current); };
  }, [persist]);

  // q = השאלה (כדי לדעת אם היא בחירה-אחת או מרובת-בחירה); patch = שדות לעדכון (choice / otherText / comment)
  const setAnswer = (q, patch) => {
    setAnswers((prev) => ({ ...prev, [q.id]: { ...emptyAnswer(q), ...(prev[q.id] || {}), ...patch } }));
    scheduleSave();
  };
  // שאלה מרובת-בחירה: סימון / ביטול סימון של אפשרות (אינדקס | 'other' | 'undecided')
  const toggleAnswer = (q, value) => {
    setAnswers((prev) => ({ ...prev, [q.id]: toggleMultiChoice(q, prev[q.id], value) }));
    scheduleSave();
  };
  const changeName = (v) => { setName(v); scheduleSave(); };
  const changeRole = (v) => { setRole(v); scheduleSave(); };

  const discardDraft = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    clearDraft(storageRef.current, keyRef.current);
    const sent = lastSent.current;
    setAnswers(sent.answers);
    setName(sent.name);
    setRole(sent.role);
    setDraftInfo(null);
    setSaveState('idle');
    setShowErrors(false);
    if (submission) { setEditingSent(false); setPhase('done'); }
  };

  // ---- שליחה ----
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
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try {
      const json = await callApi('POST', { answers: pruneHidden(qn, answers), name, role });
      frozen.current = true;
      clearDraft(storageRef.current, keyRef.current);
      const sentAnswers = json.answers || answers;
      lastSent.current = { answers: sentAnswers, name: json.respondent?.name || name, role: json.respondent?.role || role };
      setAnswers(sentAnswers);
      setSubmission({ submittedAt: json.submittedAt, count: ((submission && submission.count) || 0) + 1, updated: !!json.updated, partial: false });
      setMail({ emailSent: !!json.emailSent, emailError: json.emailError || null });
      setDraftInfo(null);
      setConfirmOpen(false);
      setEditingSent(false);
      setShowErrors(false);
      setSaveState('idle');
      setPhase('done');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    } catch (e) {
      setConfirmOpen(false);
      if (e.status === 400) setShowErrors(true);
      setSubmitError(e.message || 'השליחה נכשלה. התשובות עדיין בטיוטה בדפדפן הזה - נסו שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  const retryEmail = async () => {
    setRetrying(true);
    try {
      const json = await callApi('POST', null, `${API}/resend`);
      setMail({ emailSent: !!json.emailSent, emailError: json.emailError || null });
    } catch (e) {
      setMail({ emailSent: false, emailError: e.message });
    } finally {
      setRetrying(false);
    }
  };

  // "עדכון התשובות": הטופס נפתח עם השליחה האחרונה (שנטענה מהשרת) וממנה ממשיכים
  const startEditing = () => {
    frozen.current = false;
    const sent = lastSent.current;
    setAnswers(sent.answers);
    setName(sent.name);
    setRole(sent.role);
    const opened = {};
    Object.entries(sent.answers).forEach(([id, a]) => { if (a && a.comment) opened[id] = true; });
    setOpenComments(opened);
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
    return <DoneView qn={qn} answers={answers} name={name} mail={mail} submission={submission} retrying={retrying} retryEmail={retryEmail} startEditing={startEditing} />;
  }

  return (
    <FormView
      qn={qn} answers={answers} name={name} role={role} saveState={saveState} showErrors={showErrors}
      editingSent={editingSent} submission={submission} draftInfo={draftInfo} discardDraft={discardDraft}
      submitError={submitError} submitting={submitting} confirmOpen={confirmOpen}
      openComments={openComments} setOpenComments={setOpenComments} changeName={changeName} changeRole={changeRole}
      setAnswer={setAnswer} toggleAnswer={toggleAnswer} requestSubmit={requestSubmit} doSubmit={doSubmit} setConfirmOpen={setConfirmOpen}
    />
  );
}

/** מסך התודה וסיכום התשובות (מיוצא לבדיקות רינדור). */
export function DoneView({ qn, answers, name, mail, submission, retrying, retryEmail, startEditing }) {
  const sections = summarize(qn, answers);
  const prog = computeProgress(qn, answers);
  return (
    <div className="rq-root" dir="rtl">
      <div className="rq-card rq-thanks">
        <div style={{ fontSize: 40 }} aria-hidden="true">✓</div>
        <h1>תודה, התשובות נשלחו</h1>
        <p style={{ margin: '0 0 6px', color: 'var(--text-2)' }}>
          {name ? `${name}, ` : ''}ענית על {prog.answered} מתוך {prog.total} שאלות של {qn.gmachName}.
          {submission && submission.submittedAt ? ` נשלח ב-${formatIsraelDateTime(submission.submittedAt)}.` : ''}
        </p>
      </div>
      {submission && submission.partial && (
        <div className="callout callout-info rq-banner">חלק מהתשובות ששלחת בעבר לא נטענו מחדש (ייתכן שניסוח של שאלה השתנה). אפשר לבחור אותן שוב אחרי "עדכון התשובות".</div>
      )}
      {mail && mail.emailSent && (
        <div className="callout callout-success rq-banner">התשובות נשמרו ונשלחו במייל לבעלים.</div>
      )}
      {!mail && (
        <div className="callout callout-info rq-banner">אלה התשובות האחרונות ששלחת. אם משהו השתנה, לחצי על "עדכון התשובות".</div>
      )}
      {mail && !mail.emailSent && (
        <div className="callout callout-warning rq-banner" role="alert" style={{ flexDirection: 'column' }}>
          <div><b>התשובות נשמרו, המייל לא נשלח - ננסה שוב.</b></div>
          <div>התשובות שלכן נשמרו וגלויות לבעלים באתר. אפשר ללחוץ על הכפתור כדי לנסות לשלוח את המייל עכשיו.</div>
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
              <div className="rq-summary-a">{it.answerLines.map((l, i) => <div key={i}>{it.multi ? `• ${l}` : l}</div>)}</div>
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
  qn, answers, name, role, saveState, showErrors, editingSent, submission, draftInfo, discardDraft, submitError, submitting, confirmOpen,
  openComments, setOpenComments, changeName, changeRole, setAnswer, toggleAnswer, requestSubmit, doSubmit, setConfirmOpen,
}) {
  const vis = visibleQuestions(qn, answers);
  const prog = computeProgress(qn, answers);
  const pct = prog.total ? Math.round((prog.answered / prog.total) * 100) : 0;
  const visIndex = new Map(vis.map((q, i) => [q.id, i + 1]));
  const missingIds = showErrors ? new Set(validateSubmission(qn, pruneHidden(qn, answers), { name }).errors.map((e) => e.questionId)) : new Set();
  const nameMissing = showErrors && !name.trim();
  const saveText = {
    idle: '',
    saved: 'נשמר בדפדפן',
    nostore: 'הדפדפן לא מאפשר לשמור טיוטה - כדאי להשלים ולשלוח בבת אחת',
  }[saveState];

  return (
    <div className="rq-root" dir="rtl">
      <div className="rq-head">
        <h1>שאלון ביטולים וזיכויים - {qn.gmachName}</h1>
      </div>

      <div className="rq-card rq-intro">{qn.intro_he}</div>

      {editingSent && (
        <div className="callout callout-info rq-banner">
          התשובות כבר נשלחו פעם אחת{submission && submission.submittedAt ? ` (${formatIsraelDateTime(submission.submittedAt)})` : ''}. אפשר לשנות אותן, ובסוף ללחוץ שוב על "שליחה" כדי שהבעלים יקבלו את הגרסה המעודכנת.
        </div>
      )}
      {draftInfo && (
        <div className="callout callout-warning rq-banner" role="status">
          <div>
            שוחזרה טיוטה שנשמרה בדפדפן הזה{draftInfo.savedAt ? ` (${formatIsraelDateTime(new Date(draftInfo.savedAt))})` : ''}.
            {' '}<button type="button" className="btn btn-ghost btn-sm" onClick={discardDraft}>מחיקת הטיוטה והתחלה מחדש</button>
          </div>
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
          <span className={`rq-save ${saveState === 'saved' ? 'ok' : saveState === 'nostore' ? 'err' : ''}`}>{saveText}</span>
        </div>
        <div className="rq-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <div className="rq-resp-meta">הטיוטה נשמרת רק בדפדפן הזה עד השליחה.</div>
      </div>

      {qn.sections.map((section) => {
        const qs = section.questions.filter((q) => visIndex.has(q.id));
        if (!qs.length) return null;
        return (
          <section key={section.title_he}>
            <h2 className="rq-section-title">{section.title_he}</h2>
            {section.intro_he && <p className="rq-section-intro">{section.intro_he}</p>}
            {qs.map((q) => {
              const multi = isMulti(q);
              const a = answers[q.id] || emptyAnswer(q);
              const done = isAnswered(a);
              const opts = optionsForQuestion(q);
              const commentOpen = openComments[q.id] || !!a.comment;
              return (
                <div key={q.id} id={`rq-q-${q.id}`} className={`rq-card${missingIds.has(q.id) ? ' rq-missing' : done ? ' rq-done' : ''}`}>
                  <div className="rq-qhead">
                    <span className="rq-qnum" aria-hidden="true">{visIndex.get(q.id)}</span>
                    <h3 className="rq-q" id={`rq-label-${q.id}`}>{q.text_he}</h3>
                  </div>
                  {q.example_he && <div className="rq-example"><b>דוגמה: </b>{q.example_he}</div>}
                  {q.today_he && <p className="rq-today"><b>כך זה עובד היום ב{qn.gmachName} (לידיעה בלבד): </b>{q.today_he}</p>}
                  <div className="rq-hint">{selectionHint(q)}</div>
                  <div className="rq-opts" role={multi ? 'group' : 'radiogroup'} aria-labelledby={`rq-label-${q.id}`}>
                    {opts.map((o) => {
                      const on = isOptionOn(a, o.value);
                      return (
                        <label key={String(o.value)} className={`rq-opt${on ? ' on' : ''}${o.kind === 'undecided' ? ' soft' : ''}`}>
                          {multi
                            ? <input type="checkbox" name={`rq-${q.id}`} checked={on} onChange={() => toggleAnswer(q, o.value)} />
                            : <input type="radio" name={`rq-${q.id}`} checked={on} onChange={() => setAnswer(q, { choice: o.value })} />}
                          <span>{o.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {isOptionOn(a, OTHER) && (
                    <div className="rq-other">
                      <input className="input" placeholder="כתבו כאן את התשובה שלכן" value={a.otherText || ''} maxLength={2000} onChange={(e) => setAnswer(q, { otherText: e.target.value })} aria-label="פירוט לתשובה אחר" />
                    </div>
                  )}
                  {missingIds.has(q.id) && (
                    <div className="rq-err" role="alert">{isOptionOn(a, OTHER) ? 'נא לכתוב את התשובה בשדה "אחר".' : (multi ? 'נא לסמן לפחות תשובה אחת.' : 'נא לבחור תשובה.')}</div>
                  )}
                  {commentOpen ? (
                    <div className="rq-comment">
                      <textarea className="textarea" placeholder="הערה (לא חובה)" value={a.comment || ''} maxLength={2000} onChange={(e) => setAnswer(q, { comment: e.target.value })} aria-label="הערה לשאלה" />
                    </div>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm rq-comment-toggle" onClick={() => setOpenComments((p) => ({ ...p, [q.id]: true }))}>+ הוספת הערה</button>
                  )}
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
            <p>התשובות יישלחו לבעלים במייל ויישמרו באתר. אחרי השליחה עדיין אפשר ללחוץ על "עדכון התשובות" ולשלוח שוב.</p>
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
