'use client';

import { useState, useRef, useEffect } from 'react';
import '../../app/v3/tokens.css';
import '../../app/v3/components.css';
import { Dialog, Btn, Field, Seg, Icon, Tip } from '../../app/v3/ui/components';
import { useV3Dialogs, TipWrap } from './modern/orderCardDialogs';
import './modern/orderCardV3.css';

/**
 * Reusable "print / email order" control: a floating menu with the same 4
 * actions available on the order card (print order, print rental, email
 * order, email rental), gated behind the same "customer signed the
 * regulations" confirmation used there.
 *
 * עיצוב v3: התפריט הצף = v3-menu; החלונית של "חתימה על תקנון" = חלונית אישור; חלונית שליחת המייל
 * (כתובת + קבצים + יעד) = חלונית הזנה, בהירה בלבד. כל הלוגיקה והקריאות לשרת נשארו זהות.
 */
export default function OrderPrintMenu({
  order,
  onOrderUpdate,
  triggerClassName,
  triggerTitle = 'הדפסה ומייל',
  triggerIconSize = 18,
  preConfirm,
  // דיווח לקוח (הגמח הראשי): במסך "החזרה" השאלה "האם הלקוח חתם על התקנון?" לא רלוונטית -
  // החתימה כבר נאספה (או לא) בעת המסירה, לא בעת ההחזרה, והלקוח לרוב כבר לא מול העובד/ת.
  // RentalReturnModal מעביר את זה true כדי לדלג על השער ולפתוח את התפריט ישירות.
  skipRegulationsCheck = false
}) {
  const { v3Alert, dialogs } = useV3Dialogs();
  const [open, setOpen] = useState(false);
  const [showRegulationsModal, setShowRegulationsModal] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailTypePending, setEmailTypePending] = useState(null);
  // קבצים נוספים + יעד בהתאמה (מייל / דרייב / גם וגם) - נשלחים יחד עם ה-PDF
  const [extraFiles, setExtraFiles] = useState([]);
  const [orderSendMode, setOrderSendMode] = useState('email');
  const [sending, setSending] = useState(false);
  const [confirmingSigned, setConfirmingSigned] = useState(false);
  const containerRef = useRef(null);
  const signAbortRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const handleTriggerClick = () => {
    if (skipRegulationsCheck || order.hasSignedRegulations) {
      setOpen(o => !o);
    } else {
      setShowRegulationsModal(true);
    }
  };

  const confirmSigned = async () => {
    setConfirmingSigned(true);
    const controller = new AbortController();
    signAbortRef.current = controller;
    try {
      const res = await fetch(`/api/orders/${order.orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasSignedRegulations: true }),
        signal: controller.signal
      });
      if (res.ok) {
        onOrderUpdate?.({ hasSignedRegulations: true });
        setShowRegulationsModal(false);
        setOpen(true);
      } else {
        await v3Alert('שמירת אישור החתימה נכשלה.');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
        await v3Alert('בעיית תקשורת בשמירת אישור החתימה.');
      }
    } finally {
      setConfirmingSigned(false);
      signAbortRef.current = null;
    }
  };

  const cancelSignatureConfirm = () => {
    if (signAbortRef.current) {
      signAbortRef.current.abort();
      signAbortRef.current = null;
    }
    setConfirmingSigned(false);
    setShowRegulationsModal(false);
  };

  const openPrint = async (type) => {
    setOpen(false);
    if (preConfirm && !(await preConfirm(type))) return;
    window.open(`/print/order?orderId=${order.orderId}&type=${type}`, '_blank');
  };

  const handleSendEmail = async (type, forcedEmail = null) => {
    setOpen(false);
    if (preConfirm && !(await preConfirm(type))) return;

    let targetEmail = forcedEmail || order.customer?.email;
    if (!targetEmail || !targetEmail.includes('@')) {
      setEmailTypePending(type);
      setEmailInput('');
      setShowEmailPrompt(true);
      return;
    }

    // אם יש קבצים נוספים שנבחרו במודאל או שהמשתמש בחר דרייב - שולחים ישירות,
    // אחרת פותחים קודם את מודאל האפשרויות (קבצים + יעד) כדי לחשוף את הפיצ'ר.
    if (!forcedEmail && extraFiles.length === 0 && orderSendMode === 'email' && !handleSendEmail._optionsShown) {
      handleSendEmail._optionsShown = true;
      setEmailTypePending(type);
      setEmailInput(targetEmail);
      setShowEmailPrompt(true);
      return;
    }

    setSending(true);
    try {
      const htmlRes = await fetch(`/api/orders/${order.orderId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, type, returnHtmlOnly: true })
      });
      const htmlData = await htmlRes.json();
      if (!htmlData.success || !htmlData.html) {
        throw new Error(htmlData.error || 'שגיאה ביצירת נתוני המייל');
      }

      // Real server-side PDF (Puppeteer, see app/api/pdf/route.js) instead of the old
      // client-side html-to-image+jsPDF rasterization - the emailed attachment now has
      // real, selectable text and correct pagination instead of a single embedded image.
      const { fetchPdfBase64 } = await import('@/app/lib/pdfClient');
      const pdfBase64 = await fetchPdfBase64({ html: htmlData.html, filename: `הזמנה ${order.orderId}` });

      const fileToBase64 = (f) => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.readAsDataURL(f);
        r.onload = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = reject;
      });
      const extraAttachments = [];
      for (const f of extraFiles) {
        extraAttachments.push({
          fileName: f.name,
          fileContent: await fileToBase64(f),
          mimeType: f.type || 'application/octet-stream',
          sizeBytes: f.size || null,
          dest: orderSendMode
        });
      }

      const res = await fetch(`/api/orders/${order.orderId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, type, pdfBase64, extraAttachments, sendMode: orderSendMode })
      });
      const data = await res.json();
      if (data.success) {
        const links = Array.isArray(data.driveLinks) ? data.driveLinks : [];
        v3Alert(
          links.length > 0 ? `המייל נשלח, ו-${links.length} קבצים הועלו לדרייב עם הרשאת הורדה מלאה.` : 'המייל נשלח.',
          { title: 'נשלח', icon: 'check-circle' }
        );
        setExtraFiles([]);
      } else {
        v3Alert('שגיאה: ' + (data.error || 'השליחה נכשלה'));
      }
    } catch (err) {
      console.error(err);
      v3Alert('יצירת ה-PDF או שליחת המייל נכשלו.');
    } finally {
      setSending(false);
    }
  };

  const handleEmailSubmit = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      await v3Alert('כתובת המייל אינה תקינה.');
      return;
    }
    const validEmail = emailInput.trim();
    setShowEmailPrompt(false);

    if (order.customer?.id) {
      try {
        const res = await fetch(`/api/customers/${order.customer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...order.customer, email: validEmail })
        });
        if (res.ok) {
          onOrderUpdate?.({ customer: { ...order.customer, email: validEmail } });
        }
      } catch (e) {
        console.error('Failed to update customer email:', e);
      }
    }

    handleSendEmail(emailTypePending, validEmail);
  };

  const iconSizeStyle = { width: `${triggerIconSize}px`, height: `${triggerIconSize}px` };

  return (
    <>
      <div ref={containerRef} style={{ position: 'relative' }}>
        <TipWrap content="הדפסה ושליחה במייל">
          <button
            type="button"
            className={triggerClassName}
            aria-label={triggerTitle}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={handleTriggerClick}
            disabled={sending}
          >
            {sending
              ? <Icon name="loader" loop style={iconSizeStyle} />
              : <Icon name="printer" style={iconSizeStyle} />}
          </button>
        </TipWrap>
        <div className={`v3-menu${open ? ' is-open' : ''}`} role="menu" data-v3="" dir="rtl">
          <button type="button" role="menuitem" className="v3-menu__item" onClick={() => openPrint('order')}><Icon name="file" />הדפסת ההזמנה</button>
          <button type="button" role="menuitem" className="v3-menu__item" onClick={() => openPrint('rental')}><Icon name="list" />הדפסת ההשכרה</button>
          <button type="button" role="menuitem" className="v3-menu__item" onClick={() => handleSendEmail('order')}><Icon name="mail" />שליחת ההזמנה במייל</button>
          <button type="button" role="menuitem" className="v3-menu__item" onClick={() => handleSendEmail('rental')}><Icon name="mail" />שליחת ההשכרה במייל</button>
        </div>
      </div>

      {/* שער "חתימה על תקנון" - חלונית אישור */}
      <Dialog
        open={showRegulationsModal}
        variant="confirm"
        mode="light"
        icon="edit"
        badgeKind="write"
        title="חתימה על התקנון"
        sub="הלקוח חתם על התקנון?"
        onClose={cancelSignatureConfirm}
        actions={(
          <>
            <Btn variant="primary" icon="check" loading={confirmingSigned} onClick={confirmSigned}>כן, חתם</Btn>
            <Btn variant="quiet" onClick={cancelSignatureConfirm}>לא, ביטול</Btn>
          </>
        )}
      />

      {/* שליחת מייל: כתובת + קבצים נוספים + יעד - חלונית הזנה (בהיר בלבד) */}
      <Dialog
        open={showEmailPrompt}
        variant="form"
        icon="mail"
        title={emailTypePending === 'rental' ? 'שליחת ההשכרה במייל' : 'שליחת ההזמנה במייל'}
        sub={order.customer?.email ? 'אפשר לעדכן את הכתובת לפני השליחה.' : 'ללקוח אין כתובת מייל בכרטיס. הכתובת שתוזן תישמר בכרטיס הלקוח.'}
        onClose={() => setShowEmailPrompt(false)}
        actions={(
          <>
            <Btn variant="primary" icon="send" onClick={handleEmailSubmit}>שליחה</Btn>
            <Btn variant="quiet" onClick={() => setShowEmailPrompt(false)}>ביטול</Btn>
          </>
        )}
      >
        <Field
          label="כתובת מייל"
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="example@gmail.com"
          dir="ltr"
          data-autofocus=""
          onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit(); }}
        />
        <div className="v3-field">
          <label className="v3-label" htmlFor="opm-extra-files">
            קבצים נוספים
            <Tip>הקבצים יצורפו בנוסף ל-PDF של ההזמנה. טבלת הוראות מסודרת מצורפת למייל אוטומטית.</Tip>
          </label>
          <input
            id="opm-extra-files"
            type="file"
            className="v3-input"
            multiple
            onChange={(e) => setExtraFiles(e.target.files ? Array.from(e.target.files) : [])}
          />
          {extraFiles.length > 0 && (
            <div className="oc-file-note">נבחרו <bdi>{extraFiles.length}</bdi> קבצים: {extraFiles.map(f => f.name).join(', ')}</div>
          )}
        </div>
        <div className="v3-field">
          <span className="v3-label">
            לאן לשלוח את הקבצים
            <Tip>בדרייב הקבצים מועלים ומשותפים עם הנמען בהרשאת הורדה מלאה.</Tip>
          </span>
          <Seg
            label="יעד הקבצים"
            value={orderSendMode}
            onChange={setOrderSendMode}
            options={[
              { value: 'email', label: 'צרופה למייל' },
              { value: 'drive', label: 'דרייב ושיתוף' },
              { value: 'both', label: 'שניהם' }
            ]}
          />
        </div>
      </Dialog>

      {dialogs}
    </>
  );
}
