'use client';

import { useState } from 'react';
import {
  summarize, tallyResponses, buildAllPlainText, formatIsraelDateTime, computeProgress,
} from '@/lib/policyQuestionnaire/logic';

// דף התוצאות לבעלים: סיכום ספירות לכל שאלה (לפי התשובות ששלחו), ואז כל משיבה עם כל התשובות וההערות שלה.
// "העתק הכל" מעתיק טקסט פשוט של כולן; "הדפסה" משתמשת בכללי ההדפסה המשותפים (הכפתורים והתפריט מוסתרים).
export default function AnswersClient({ questionnaire, responses }) {
  const [copied, setCopied] = useState('');
  const submitted = responses.filter((r) => r.status === 'submitted');
  const drafts = responses.filter((r) => r.status !== 'submitted');
  const tally = tallyResponses(questionnaire, submitted);
  const showSource = questionnaire.sections.some((s) => s.questions.some((q) => q.source));
  const sourceById = new Map();
  questionnaire.sections.forEach((s) => s.questions.forEach((q) => { if (q.source) sourceById.set(q.id, q.source); }));

  const copyAll = async () => {
    const text = buildAllPlainText(questionnaire, [...submitted, ...drafts]);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied('ok');
      } catch {
        setCopied('fail');
      }
    }
    setTimeout(() => setCopied(''), 3000);
  };

  return (
    <div className="rq-root rq-wide" dir="rtl">
      <div className="rq-head">
        <h1>תשובות השאלון - {questionnaire.gmachName}</h1>
        <p>כאן מופיעות התשובות של ההנהלות בשאלון הביטולים והזיכויים. כל תשובה נשמרת מיד, וגם אם עוד לא נשלחה סופית היא מופיעה כאן כטיוטה.</p>
      </div>

      <div className="rq-stats">
        <div className="rq-stat"><b>{submitted.length}</b>שלחו תשובות</div>
        <div className="rq-stat"><b>{drafts.length}</b>טיוטות (עוד לא נשלחו)</div>
        <div className="rq-stat"><b>{tally.length}</b>שאלות</div>
      </div>

      <div className="rq-toolbar print-hide">
        <button type="button" className="btn btn-primary" onClick={copyAll} disabled={responses.length === 0}>העתק הכל</button>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>הדפסה</button>
        {copied === 'ok' && <span className="rq-save ok">הועתק</span>}
        {copied === 'fail' && <span className="rq-save err">ההעתקה נכשלה - אפשר לסמן ידנית ולהעתיק</span>}
      </div>

      {responses.length === 0 && <div className="rq-card rq-empty">עדיין אף אחת לא התחילה לענות.</div>}

      {responses.length > 0 && (
        <>
          <h2 className="rq-section-title">סיכום לפי שאלה{submitted.length ? ` (לפי ${submitted.length} שלחו)` : ''}</h2>
          {tally.map((t) => {
            const max = Math.max(1, ...t.counts.map((c) => c.count));
            return (
              <div className="rq-card" key={t.id}>
                <p className="rq-tally-q">{t.text}</p>
                {t.counts.map((c) => (
                  <div className="rq-tally-row" key={String(c.value)}>
                    <div>
                      <div className="rq-tally-label">{c.label}</div>
                      <div className="rq-tally-bar"><span style={{ width: `${Math.round((c.count / max) * 100)}%` }} /></div>
                    </div>
                    <div className="rq-tally-count">{c.count}</div>
                  </div>
                ))}
                {t.unanswered > 0 && <div className="rq-resp-meta">לא נענתה: {t.unanswered}</div>}
                {showSource && sourceById.get(t.id) && <div className="rq-resp-meta">מקור: {sourceById.get(t.id)}</div>}
              </div>
            );
          })}

          <h2 className="rq-section-title">התשובות של כל משיבה</h2>
          {[...submitted, ...drafts].map((r) => {
            const sections = summarize(questionnaire, r.answers || {});
            const prog = computeProgress(questionnaire, r.answers || {});
            const sentAt = formatIsraelDateTime(r.submittedAt);
            const savedAt = formatIsraelDateTime(r.updatedAt);
            return (
              <div className="rq-card rq-resp" key={r.id}>
                <div className="rq-resp-head">
                  <div>
                    <h3 className="rq-resp-name">{r.respondentName || 'ללא שם'}{r.respondentRole ? ` - ${r.respondentRole}` : ''}</h3>
                    <div className="rq-resp-meta">
                      {r.status === 'submitted' ? `נשלח ב-${sentAt}` : `טיוטה, נשמרה ב-${savedAt}`} · נענו {prog.answered} מתוך {prog.total}
                      {r.status === 'submitted' && r.pendingChanges ? ' · יש שינויים שעוד לא נשלחו' : ''}
                    </div>
                  </div>
                  <div>
                    {r.status === 'submitted' ? <span className="badge badge-success">נשלח</span> : <span className="badge badge-warning">טיוטה</span>}
                    {r.status === 'submitted' && r.needsEmail && <span className="badge badge-danger" style={{ marginInlineStart: 6 }}>המייל לא נשלח</span>}
                  </div>
                </div>
                {r.emailError && r.needsEmail && <div className="rq-resp-meta">שגיאת מייל: {r.emailError}</div>}
                {sections.map((s) => (s.items.length > 0 && (
                  <table className="rq-table" key={s.title}>
                    <thead><tr><th style={{ width: '48%' }}>{s.title}</th><th>תשובה</th></tr></thead>
                    <tbody>
                      {s.items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.text}</td>
                          <td className={`rq-ans${it.answered ? '' : ' rq-none'}`}>
                            {it.answerText}
                            {it.comment && <div className="rq-comment-line">הערה: {it.comment}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
