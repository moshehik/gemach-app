'use client';

import { useState } from 'react';
import {
  summarize, tallyResponses, joinSubmissionTexts, formatIsraelDateTime, computeProgress, THREAD_TITLE,
} from '@/lib/policyQuestionnaire/logic';

// דף התוצאות לבעלים: סיכום ספירות לכל שאלה (לפי השליחה האחרונה של כל משיבה), ואז כל משיבה עם כל התשובות וההערות של השליחה האחרונה שלה,
// ו"גרסאות קודמות" מקופלות (הטקסט המלא של כל שליחה ישנה). התשובות נקראות מתגובות השרשור של השאלון בחלון דיווחי התקלות (ר' lib/policyQuestionnaire/store.js).
// "העתק הכל" מעתיק את הטקסט המלא של השליחה האחרונה של כל משיבה; "הדפסה" משתמשת בכללי ההדפסה המשותפים (הכפתורים והתפריט מוסתרים).
export default function AnswersClient({ questionnaire, respondents, threadFound }) {
  const [copied, setCopied] = useState('');
  const latestSubs = respondents.map((r) => r.latest);
  const tally = tallyResponses(questionnaire, latestSubs);
  const showSource = questionnaire.sections.some((s) => s.questions.some((q) => q.source));
  const sourceById = new Map();
  questionnaire.sections.forEach((s) => s.questions.forEach((q) => { if (q.source) sourceById.set(q.id, q.source); }));
  const updatesCount = respondents.reduce((n, r) => n + Math.max(0, r.count - 1), 0);

  const copyAll = async () => {
    const text = joinSubmissionTexts(respondents.map((r) => r.latest.text));
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
        <p>כאן מופיעות התשובות של ההנהלות בשאלון הביטולים והזיכויים, לפי השליחה האחרונה של כל אחת. כל שליחה נשמרת גם בשרשור "{THREAD_TITLE}" בחלון "דיווח על שגיאות" (אצל המתכנת, ואצל מי שמילאה ראשונה בגמ"ח הזה), ושליחה חוזרת נוספת שם כעדכון חדש.</p>
      </div>

      <div className="rq-stats">
        <div className="rq-stat"><b>{respondents.length}</b>שלחו תשובות</div>
        <div className="rq-stat"><b>{updatesCount}</b>עדכונים אחרי השליחה הראשונה</div>
        <div className="rq-stat"><b>{tally.length}</b>שאלות</div>
      </div>

      <div className="rq-toolbar print-hide">
        <button type="button" className="btn btn-primary" onClick={copyAll} disabled={respondents.length === 0}>העתק הכל</button>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>הדפסה</button>
        {copied === 'ok' && <span className="rq-save ok">הועתק</span>}
        {copied === 'fail' && <span className="rq-save err">ההעתקה נכשלה - אפשר לסמן ידנית ולהעתיק</span>}
      </div>

      {respondents.length === 0 && (
        <div className="rq-card rq-empty">{threadFound ? 'עדיין אף אחת לא שלחה תשובות.' : 'עדיין אף אחת לא שלחה תשובות, והשרשור ייווצר בשליחה הראשונה.'}</div>
      )}

      {respondents.length > 0 && (
        <>
          <h2 className="rq-section-title">סיכום לפי שאלה{` (לפי ${respondents.length} משיבות)`}</h2>
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
          {respondents.map((r) => {
            const sub = r.latest;
            const sections = summarize(questionnaire, sub.answers || {});
            const prog = computeProgress(questionnaire, sub.answers || {});
            const sentAt = formatIsraelDateTime(sub.createdAt);
            const partial = sub.unparsed && sub.unparsed.length > 0;
            return (
              <div className="rq-card rq-resp" key={r.key}>
                <div className="rq-resp-head">
                  <div>
                    <h3 className="rq-resp-name">{r.name || 'ללא שם'}{r.role ? ` - ${r.role}` : ''}</h3>
                    <div className="rq-resp-meta">
                      נשלח ב-{sentAt} · נענו {prog.answered} מתוך {prog.total}
                      {r.count > 1 ? ` · ${r.count} שליחות (האחרונה מוצגת)` : ''}
                    </div>
                  </div>
                  <div>
                    <span className="badge badge-success">נשלח</span>
                    {sub.updated && <span className="badge badge-warning" style={{ marginInlineStart: 6 }}>עדכון</span>}
                  </div>
                </div>
                {partial && (
                  <div className="rq-resp-meta" role="alert">
                    לא כל התשובות זוהו (ייתכן שניסוח של שאלה או אפשרות השתנה מאז). הטקסט המלא של השליחה מוצג למטה:
                    <pre className="rq-raw" dir="rtl">{sub.text}</pre>
                  </div>
                )}
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
                {r.earlier.length > 0 && (
                  <details className="rq-earlier print-hide">
                    <summary>גרסאות קודמות ({r.earlier.length})</summary>
                    {r.earlier.map((e) => (
                      <div key={e.id}>
                        <div className="rq-resp-meta">נשלח ב-{formatIsraelDateTime(e.createdAt)}{e.updated ? ' (עדכון)' : ''}</div>
                        <pre className="rq-raw" dir="rtl">{e.text}</pre>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
