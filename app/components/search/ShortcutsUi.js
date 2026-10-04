'use client';

// רכיבי הממשק של הקיצורים בשורת החיפוש (עיצוב מאושר: תצוגות-עיצוב/חיפוש-קיצורים.html; החלטות PFX-01..11):
//   SaveIconButton  - אייקון שמירה ליד ה-X (PFX-09: אייקון i-archive מהפלטה + הודעה "החיפוש נשמר"; אין אייקון "שמירה" ייעודי בפלטה)
//   GuideButton     - כפתור "קיצורים" מימין ל"לחיפוש חכם", בדף הבית בלבד, רק בשדה ריק לפני חיפוש; בטלפון אייקון בלבד (PFX-11 ב)
//   GuideDialog     - החלון הכהה: שורה והסבר לכל סימן + "נסה" (PFX-07)
//   DeleteDialog    - אישור מחיקת חיפוש שמור עם מתג "אל תשאל שוב" (PFX-10: עד רענון)
// החלונות מצוירים ב-portal ל-body בתוך עטיפה .gm-ds[.gm-home].dlg-dark (display:contents), כך שהחלון הכהה של הפלטה (#dlg) חל גם מחוץ לשורש הדף.

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';
import { GUIDE_TEXT, SAVED_TEXT, saveCandidate, isQuerySaved } from '@/lib/quickShortcuts';

export function QIcon({ id }) {
  return <svg className="ic" aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${id}`} /></svg>;
}

/** אייקון שמירה ליד ה-X. לא מוצג: אין טקסט שאפשר לשמור (ריק / קידומת), או שהתכונה לא זמינה במסד הזה. onMouseDown לא גונב מיקוד מהשדה. */
export function SaveIconButton({ text, saved, ibtn = false }) {
  const q = saveCandidate(text);
  if (!q || !saved || saved.state === 'unavailable') return null;
  const isSaved = saved.state === 'ok' && isQuerySaved(saved.list, q);
  const st = saved.flash ? 'done' : isSaved ? 'saved' : 'new';
  const tip = st === 'done' ? SAVED_TEXT.savedToast : isSaved ? SAVED_TEXT.savedIconTip : SAVED_TEXT.saveIconTip;
  return (
    <>
      <button
        type="button"
        className={`${ibtn ? 'ibtn ' : ''}pfx-save`}
        data-st={st}
        aria-label={tip}
        data-tip={tip}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => saved.quickSave(q)}
      ><QIcon id={st === 'done' ? 'check' : 'archive'} /></button>
      {saved.flash && <span className="pfx-sr" role="status" aria-live="polite">{SAVED_TEXT.savedToast}</span>}
    </>
  );
}

/** כפתור "קיצורים" (גלולת cmode-b): מימין ל"לחיפוש חכם" - ההורה מציב אותו ראשון בשורה (בכיוון RTL = צד ימין). */
export function GuideButton({ onClick }) {
  return (
    <button type="button" className="cmode-b pfx-help" aria-haspopup="dialog" aria-label={GUIDE_TEXT.buttonTip} data-tip={GUIDE_TEXT.buttonTip} onClick={onClick}>
      <QIcon id="info" /><span className="pfx-help-t">{GUIDE_TEXT.button}</span>
    </button>
  );
}

function Win({ skin, cls, labelId, onClose, initialRef, children }) {
  const boxRef = useRef(null);
  const [host, setHost] = useState(null);
  useEffect(() => { setHost(document.body); }, []);
  // onClose לרוב פונקציה חדשה בכל ציור של ההורה (ואז אפקט המיקוד היה מתאפס וגונב מיקוד): שומרים אותה ב-ref, האפקט לא תלוי בה
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!host) return undefined;
    const back = document.activeElement;
    const t = setTimeout(() => { if (initialRef && initialRef.current) initialRef.current.focus(); }, 30);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !boxRef.current) return;
      const f = [...boxRef.current.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href]')];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (!boxRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      if (back && back !== document.body && document.contains(back) && back.focus) back.focus();
    };
  }, [host, initialRef]);
  if (!host) return null;
  return createPortal(
    <div className={`gm-ds${skin === 'home' ? ' gm-home' : ''} dlg-dark pfx-dlg-root`} dir="rtl">
      <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget) closeRef.current(); }}>
        <div ref={boxRef} className={`dlg pfxwin ${cls}`} id="dlg" role="dialog" aria-modal="true" aria-labelledby={labelId}>{children}</div>
      </div>
    </div>,
    host,
  );
}

/** תוכן מדריך הקיצורים (נפרד מה-portal כדי שאפשר לצייר אותו גם בבדיקות / תצוגה סטטית). */
export function GuideBody({ rows, onTry, onClose, firstRef }) {
  return (
    <>
      <h2 id="pfx-ht">{GUIDE_TEXT.title}</h2>
      <div className="sub">{GUIDE_TEXT.sub}</div>
      <div className="chg" role="list">
        {rows.map((h, i) => (
          <div className="c" role="listitem" key={h.ch}>
            <span className="ico pfx-key" aria-hidden="true">{h.ch}</span>
            <div className="t"><b>{h.title}</b><div className="faint">{h.sub}</div></div>
            <button ref={i === 0 ? firstRef : undefined} type="button" className="btn sm" aria-label={`${GUIDE_TEXT.tryLabel}: ${h.title}`} onClick={() => onTry(h.ch)}>{GUIDE_TEXT.tryLabel}</button>
          </div>
        ))}
      </div>
      <div className="dbtns"><button type="button" className="btn primary lg block" onClick={onClose}>{GUIDE_TEXT.close}</button></div>
    </>
  );
}

/** מדריך הקיצורים. rows = guideRows(); onTry(ch) מכניס את הסימן לשדה החיפוש וסוגר. */
export function GuideDialog({ rows, onTry, onClose, skin = 'home' }) {
  const firstRef = useRef(null);
  return (
    <Win skin={skin} cls="pfxhelp" labelId="pfx-ht" onClose={onClose} initialRef={firstRef}>
      <GuideBody rows={rows} onTry={onTry} onClose={onClose} firstRef={firstRef} />
    </Win>
  );
}

/** תוכן אישור המחיקה (נפרד מה-portal, כמו GuideBody). */
export function DeleteBody({ confirm, noAsk, setNoAsk, onConfirm, onCancel, yesRef, descId }) {
  return (
    <>
      <h2 id="pfx-dt">{'למחוק את החיפוש השמור “'}<bdi>{confirm.name}</bdi>{'”?'}</h2>
      <label className="trow pfx-tg" data-tip={SAVED_TEXT.noAskTip}>
        <span className="sw">
          <input type="checkbox" role="switch" aria-checked={noAsk} aria-describedby={descId} checked={noAsk} onChange={(e) => setNoAsk(e.target.checked)} />
          <i />
        </span>
        <b>{SAVED_TEXT.noAsk}</b>
        <span className="pfx-sr" id={descId}>{SAVED_TEXT.noAskTip}</span>
      </label>
      <div className="dbtns">
        <button ref={yesRef} type="button" className="btn primary lg" onClick={() => onConfirm(noAsk)}><QIcon id="trash" />{SAVED_TEXT.delete}</button>
        <button type="button" className="btn ghost lg" onClick={onCancel}>{SAVED_TEXT.cancel}</button>
      </div>
    </>
  );
}

/** אישור מחיקה של חיפוש שמור. confirm = { id, name }; onConfirm(noAsk) / onCancel. */
export function DeleteDialog({ confirm, onConfirm, onCancel, skin = 'home' }) {
  const yesRef = useRef(null);
  const [noAsk, setNoAsk] = useState(false);
  const uid = useId();
  if (!confirm) return null;
  return (
    <Win skin={skin} cls="pfxdel" labelId="pfx-dt" onClose={onCancel} initialRef={yesRef}>
      <DeleteBody confirm={confirm} noAsk={noAsk} setNoAsk={setNoAsk} onConfirm={onConfirm} onCancel={onCancel} yesRef={yesRef} descId={`${uid}-nd`} />
    </Win>
  );
}
