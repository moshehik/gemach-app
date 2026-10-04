'use client';

// OcMailSheet — חלון המייל של כרטיס ההזמנה החדש (גיליון תחתון, העיצוב: #dlg.mailwin.fx-sheet): שני מצבים באותו רכיב.
//   mode 'quick' (A8, "מייל מהיר" בכרטיס הלקוח, מאחורי order_quick_mail_enabled): נושא, תוכן, "דפים לצירוף" (כל ששת הסוגים, AMB-11 בהחלטת הבעלים: פרטי הזמנה,
//     תקנון חתום, דף תשלומים, דף משלוח, חשבונית/קבלה, תמונות דגמים), תצוגה מקדימה סכמטית לכל קובץ, ואישור מנהל (feature:customer_email_approval) רק כשהשרת דורש.
//   mode 'doc' (R6, "שליחה במייל" / "מייל השכרה" מתפריט ההדפסה): הזמנה/השכרה כ-PDF ראשי, כתובת ניתנת לעריכה - כמו חלון האפשרויות של הישן.
// בשניהם (R8): "קבצים נוספים" + "יעד הקבצים" (צרופה למייל / דרייב + שיתוף / גם וגם). שליחה: ocDocsActions.sendOrderMail (POST /api/orders/:id/email).
// כשאין מייל ללקוח: "כתובת מייל חסרה" (OcMissingEmail) לפני החלון. סגירה עם תוכן שנערך: "לזרוק את המייל?" (שכבה 2). אין window.alert/confirm.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { ensureCustomerEmail } from './OcMissingEmail';
import { sendOrderMail } from './ocDocsActions';
import {
  MAIL_DEST_OPTIONS, customerNameOf, defaultMailSubject, driveModeNote, isValidEmail, mailFilesFor, mailSentToast, orderEmailOf, quickMailValid,
} from './ocDocsLogic';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const PREVIEW_NOTE = {
  ord: 'דוח ההזמנה המלא, כקובץ PDF', reg: 'דף ההשכרה עם תנאי התקנון, כקובץ PDF', pay: 'התשלומים שהתקבלו והיתרה, כקובץ PDF',
  del: 'תעודת המשלוח של ההזמנה, כקובץ PDF', inv: 'אישור קבלת התשלומים, כקובץ PDF', img: 'תמונות הדגמים שבהזמנה, כקובץ PDF',
};
const DOC_TITLE = { order: 'שליחת מייל הזמנה', rental: 'שליחת מייל השכרה' };

function DiscardMailDialog({ close }) {
  return (
    <>
      <DlgHead id="oc-disc-t" title="לזרוק את המייל?" sub="השינויים לא יישמרו" />
      <DlgButtons>
        <DlgBtn kind="primary" icon="trash" autoFocus onClick={() => close(true)}>כן, סגור</DlgBtn>
        <DlgBtn kind="ghost" icon="pencil" onClick={() => close(false)}>המשך עריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}
DiscardMailDialog.ocLayer = 2;

// R8: קבצים נוספים + יעד הקבצים (משותף לשני המצבים). המבנה כמו בעיצוב: mfld אחד עם כותרת, שורת לחצן "הוספת קובץ" (btn sm), כותרת יעד ובורר pill.
function MailExtras({ extraFiles, setExtraFiles, dest, setDest, disabled, markDirty, filesLabel }) {
  const idx = Math.max(0, MAIL_DEST_OPTIONS.findIndex((o) => o.v === dest));
  const note = driveModeNote(dest);
  const pickRef = useRef(null);
  return (
    <div className="mfld oc-mx" data-oc-part="r8">
      <span className="lbl"><OcIcon name="clip" size="sm" />{filesLabel}</span>
      <div className="row wrap oc-mx-add">
        <button type="button" className="btn sm" data-act="mail-addfile" disabled={disabled} onClick={() => pickRef.current && pickRef.current.click()}>
          <OcIcon name="plus" size="sm" />הוספת קובץ
        </button>
        <input ref={pickRef} type="file" multiple hidden tabIndex={-1} aria-label="בחירת קבצים לצירוף" onChange={(e) => {
          const picked = e.target.files ? Array.from(e.target.files) : [];
          if (picked.length) { setExtraFiles((prev) => [...prev, ...picked]); markDirty(); }
          e.target.value = '';
        }} />
      </div>
      {extraFiles.length ? (
        <div className="oc-mx-list">
          {extraFiles.map((file, i) => (
            <div className="oc-mx-row" key={`${file.name}-${i}`}>
              <span className="mft"><OcIcon name="file" size="sm" /></span>
              <span className="mfx"><b>{file.name}</b><small>{fmtSize(file.size || 0)}</small></span>
              <button type="button" className="mfe" data-act="mail-rm" aria-label={`הסרת ${file.name}`} data-tip="הסר" disabled={disabled} onClick={() => { setExtraFiles((prev) => prev.filter((_, j) => j !== i)); markDirty(); }}>
                <OcIcon name="x" size="sm" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <span className="lbl oc-mx-dest-l" id="oc-dest-l">יעד הקבצים בהתאמה</span>
      <div className="seg pill" role="radiogroup" aria-labelledby="oc-dest-l" style={{ '--n': MAIL_DEST_OPTIONS.length, '--i': idx }}>
        <span aria-hidden="true" className="pth" />
        {MAIL_DEST_OPTIONS.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={dest === o.v} className={dest === o.v ? 'on' : ''} data-dest={o.v} disabled={disabled} onClick={() => { setDest(o.v); markDirty(); }}>{o.label}</button>
        ))}
      </div>
      {note ? <small className="faint oc-mx-note">{note}</small> : null}
    </div>
  );
}

export function OcMailSheet({ oc, ui, mode, type = 'order', to: toInit, snapshot, close }) {
  const { order, obligations, payments, items } = snapshot;
  const name = customerNameOf(order);
  const orderId = order.orderId;
  const [to, setTo] = useState(toInit || '');
  const [subject, setSubject] = useState(defaultMailSubject(order));
  const [bodyText, setBodyText] = useState('');
  const [picked, setPicked] = useState([]);
  const [prev, setPrev] = useState(null);
  const [extraFiles, setExtraFiles] = useState([]);
  const [dest, setDest] = useState('email');
  const [state, setState] = useState('idle'); // idle | sending | done
  const [err, setErr] = useState('');
  const [dirty, setDirty] = useState(false);
  const bodyRef = useRef(null);
  const quick = mode === 'quick';
  const files = useMemo(() => mailFilesFor({ order, settings: oc.settings, items, payments }), [order, oc.settings, items, payments]);
  const idle = state === 'idle';
  const valid = quick ? quickMailValid({ to, subject, bodyText }) : isValidEmail(to);
  const markDirty = () => setDirty(true);

  useEffect(() => {
    const ta = bodyRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.max(ta.scrollHeight, 150)}px`; }
  }, [bodyText]);

  const tryClose = async () => {
    if (!idle) return;
    if (!dirty) { close(null); return; }
    const drop = await ui.openDialog(DiscardMailDialog, {}, { layer: 2, labelledBy: 'oc-disc-t' });
    if (drop) close(null);
    else if (bodyRef.current) bodyRef.current.focus();
  };

  // Escape: ui.openDialog לא סוגר חלון עם dismissable:false - כאן סוגרים רק אם אין שכבה 2 פתוחה (אישור מנהל / "לזרוק?")
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const l2 = document.getElementById('scrim2');
      if (l2 && l2.classList.contains('on')) return;
      e.preventDefault();
      tryClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const toggleFile = (file) => {
    if (!file.exists || !idle) return;
    setPicked((p) => (p.includes(file.id) ? p.filter((x) => x !== file.id) : [...p, file.id]));
    markDirty();
  };

  const send = async () => {
    if (!valid || !idle) return;
    setErr('');
    setState('sending');
    const r = await sendOrderMail({
      oc, orderId, mode, to: to.trim(), type, subject, bodyText,
      kinds: quick ? files.filter((file) => picked.includes(file.id)).map((file) => file.kind) : [],
      extraFiles, sendMode: dest, docData: { order, obligations, payments, items }, gmachName: oc.settings.get('gmach_name', 'גמ"ח שמלות'),
    });
    if (r.cancelled) { setState('idle'); return; }
    if (!r.ok) { setState('idle'); setErr(r.error || 'השליחה נכשלה'); return; }
    setState('done');
    await sleep(650);
    close({ sent: true, to: to.trim(), fileCount: r.fileCount, driveCount: dest === 'email' ? 0 : r.driveLinks.length });
  };

  const sendLabel = state === 'sending' ? <><span className="mspin" />שולח…</> : state === 'done' ? <><OcIcon name="check" />נשלח</> : <><OcIcon name="send" />שלח מייל</>;
  const titleText = quick ? 'מייל מהיר' : DOC_TITLE[type] || DOC_TITLE.order;

  return (
    <>
      <div className="mh">
        <span className="mico"><OcIcon name="mail" size="lg" /></span>
        <h2 id="oc-mail-t">{titleText}<small className="msub">אל {name} · {to ? <bdi dir="ltr">{to}</bdi> : <span className="missv"><OcIcon name="alert" size="sm" />חסר מייל</span>}</small></h2>
        <button type="button" className="ibtn mx" data-act="mail-x" aria-label="סגירה" data-tip="סגור" onClick={tryClose}><OcIcon name="x" size="sm" /></button>
      </div>
      <div className="fx-2col">
        <div className="fx-stack">
          {quick ? (
            <>
              <div className="mfld"><label className="lbl" htmlFor="m-sub">נושא</label>
                <input className="inp" id="m-sub" value={subject} disabled={!idle} autoComplete="off" data-autofocus="true" onChange={(e) => { setSubject(e.target.value); markDirty(); }} /></div>
              <div className="mfld"><label className="lbl" htmlFor="m-body">תוכן</label>
                <textarea className="inp" id="m-body" ref={bodyRef} rows={9} placeholder="כתבו כאן את ההודעה ללקוחה…" disabled={!idle} value={bodyText} onChange={(e) => { setBodyText(e.target.value); markDirty(); }} /></div>
            </>
          ) : (
            <>
              <div className="mfld"><label className="lbl" htmlFor="m-to"><OcIcon name="mail" size="sm" />כתובת מייל</label>
                <input className="inp" id="m-to" type="email" dir="ltr" value={to} disabled={!idle} autoComplete="off" data-autofocus="true" placeholder="example@gmail.com" onChange={(e) => { setTo(e.target.value); markDirty(); }} /></div>
              <div className="mfld"><span className="lbl"><OcIcon name="clip" size="sm" />מצורף</span>
                <div className="mfiles"><div className="mfile on" aria-checked="true" role="checkbox" aria-disabled="true">
                  <span className="mft"><OcIcon name="file" /></span>
                  <span className="mfx"><b>{type === 'rental' ? 'דוח ההשכרה' : 'דוח ההזמנה'}</b><small>PDF · מצורף תמיד</small></span>
                  <span className="mfk"><OcIcon name="check" size="sm" /></span>
                </div></div></div>
            </>
          )}
        </div>
        <div className="fx-stack">
          {quick ? (
            <div className="mfld"><span className="lbl"><OcIcon name="clip" size="sm" />דפים לצירוף</span>
              <div className="mfiles">
                {files.map((file) => {
                  const on = picked.includes(file.id);
                  return (
                    <Fragment key={file.id}>
                      <div className={`mfile${on ? ' on' : ''}${file.exists ? '' : ' off'}`} role="checkbox" aria-checked={on} aria-disabled={!file.exists} tabIndex={file.exists ? 0 : -1} data-act="mail-file" data-id={file.id}
                        onClick={() => toggleFile(file)} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleFile(file); } }}>
                        <span className="mft"><OcIcon name="file" /></span>
                        <span className="mfx"><b>{file.name}</b><small>{file.exists ? '' : file.miss}</small></span>
                        {file.exists ? <button type="button" className="mfe" data-act="mail-prev" data-id={file.id} data-tip="תצוגה" aria-label="תצוגה מקדימה" onClick={(e) => { e.stopPropagation(); setPrev((p) => (p === file.id ? null : file.id)); }}><OcIcon name="eye" size="sm" /></button> : null}
                        <span className="mfk"><OcIcon name="check" size="sm" /></span>
                      </div>
                      {prev === file.id && file.exists ? <div className="mprev"><span className="mft"><OcIcon name="file" /></span><div><b>{file.name}</b><small>{PREVIEW_NOTE[file.id]}</small><i /><i /><i /></div></div> : null}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          ) : null}
          <MailExtras extraFiles={extraFiles} setExtraFiles={setExtraFiles} dest={dest} setDest={setDest} disabled={!idle} markDirty={markDirty} filesLabel={quick ? 'קבצים נוספים' : `קבצים נוספים (בנוסף ל-PDF ${type === 'rental' ? 'ההשכרה' : 'ההזמנה'})`} />
        </div>
      </div>
      <div className="amsg oc-mail-err" aria-live="polite">{err ? <><OcIcon name="alert" size="sm" />{err}</> : null}</div>
      <div className="dbtns mact fx-actions">
        <button type="button" className="btn primary lg" data-act="mail-send" id="m-send" disabled={!valid || !idle} onClick={send}>{sendLabel}</button>
        <button type="button" className="btn ghost" data-act="mail-cancel" disabled={!idle} onClick={tryClose}><OcIcon name="x" size="sm" />ביטול</button>
      </div>
    </>
  );
}

/**
 * פותח את חלון המייל: קודם "כתובת מייל חסרה" כשצריך, ואז החלון; אחרי שליחה מוצלחת טוסט "נשלח ל-… · N קבצים".
 * @param {{oc:object, ui:object, mode:'quick'|'doc', type?:'order'|'rental'}} p
 */
export async function openMailSheet({ oc, ui, mode, type = 'order' }) {
  const snap = oc.snapshot || {};
  const order = snap.order || oc.order;
  if (!order) return null;
  const to = await ensureCustomerEmail({ oc, ui, current: orderEmailOf(oc.order) });
  if (!to) return null;
  const res = await ui.openDialog(
    OcMailSheet,
    { oc, ui, mode, type, to, snapshot: { order: { ...order, customer: { ...(order.customer || {}), email: to } }, obligations: snap.obligations || oc.obligations || [], payments: snap.payments || oc.payments || [], items: snap.items || oc.items || [] } },
    { className: 'mailwin fx-sheet', labelledBy: 'oc-mail-t', dismissable: false, badge: false },
  );
  if (res && res.sent) {
    const t = mailSentToast(res.to, res.fileCount, res.driveCount);
    ui.toast('info', t.big, t.small);
  }
  return res;
}

/** slot QuickMailButton (W2a, שורת "מייל" בכרטיס הלקוח): לחצן "מייל מהיר" - רק כש-order_quick_mail_enabled (ההגדרה נבדקת כאן, A8) */
export default function OcQuickMailButton({ oc, ui }) {
  if (!oc.settings || !oc.settings.orderQuickMailEnabled) return null;
  return (
    <button type="button" className="btn sm" data-act="mail-open" onClick={() => openMailSheet({ oc, ui, mode: 'quick' })}>
      <OcIcon name="mail" size="sm" />מייל מהיר
    </button>
  );
}
