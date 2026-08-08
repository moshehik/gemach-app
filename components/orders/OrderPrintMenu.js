'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Reusable "print / email order" control: a floating menu with the same 4
 * actions available on the order card (print order, print rental, email
 * order, email rental), gated behind the same "customer signed the
 * regulations" confirmation used there.
 */
export default function OrderPrintMenu({
  order,
  onOrderUpdate,
  triggerClassName,
  triggerTitle = 'הדפסה ומייל',
  triggerIconSize = 18,
  preConfirm
}) {
  const [open, setOpen] = useState(false);
  const [showRegulationsModal, setShowRegulationsModal] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailTypePending, setEmailTypePending] = useState(null);
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
    if (order.hasSignedRegulations) {
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
        alert('שגיאה בשמירת אישור החתימה');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
        alert('שגיאת תקשורת בשמירת אישור החתימה');
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

      const res = await fetch(`/api/orders/${order.orderId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, type, pdfBase64 })
      });
      const data = await res.json();
      alert(data.success ? 'המייל נשלח בהצלחה!' : ('שגיאה: ' + (data.error || 'השליחה נכשלה')));
    } catch (err) {
      console.error(err);
      alert('שגיאה ביצירת ה-PDF או בשליחת המייל');
    } finally {
      setSending(false);
    }
  };

  const handleEmailSubmit = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      alert('כתובת המייל שהוזנה אינה תקינה.');
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

  return (
    <>
      <div ref={containerRef} style={{ position: 'relative' }}>
        <button type="button" className={triggerClassName} title={triggerTitle} onClick={handleTriggerClick} disabled={sending}>
          {sending ? (
            <span className="spinner" style={{ width: `${triggerIconSize}px`, height: `${triggerIconSize}px`, borderWidth: '2px' }} />
          ) : (
            <svg className="icon" style={{ width: `${triggerIconSize}px`, height: `${triggerIconSize}px` }}><use href="#i-printer" /></svg>
          )}
        </button>
        {open && (
          <div className="opm-menu">
            <button type="button" className="opm-menu-item" onClick={() => openPrint('order')}><svg className="icon"><use href="#i-file" /></svg> הזמנה</button>
            <button type="button" className="opm-menu-item" onClick={() => openPrint('rental')}><svg className="icon"><use href="#i-list" /></svg> השכרה</button>
            <button type="button" className="opm-menu-item" onClick={() => handleSendEmail('order')}><svg className="icon"><use href="#i-mail" /></svg> מייל הזמנה</button>
            <button type="button" className="opm-menu-item" onClick={() => handleSendEmail('rental')}><svg className="icon"><use href="#i-mail" /></svg> מייל השכרה</button>
          </div>
        )}
      </div>

      {showRegulationsModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={cancelSignatureConfirm}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon-circle" style={{ background: 'var(--primary-tint)', color: 'var(--primary-solid)' }}>
              <svg className="icon"><use href="#i-edit" /></svg>
            </div>
            <h3>חתימה על תקנון</h3>
            <p>האם הלקוח חתם על התקנון?</p>
            <div className="confirm-actions">
              <button type="button" className="btn btn-primary" onClick={confirmSigned} disabled={confirmingSigned}>
                {confirmingSigned && <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />}
                כן, חתם
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancelSignatureConfirm}>לא (ביטול)</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showEmailPrompt && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowEmailPrompt(false)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon-circle" style={{ background: 'var(--info-tint)', color: 'var(--info)' }}>
              <svg className="icon"><use href="#i-mail" /></svg>
            </div>
            <h3>כתובת מייל חסרה</h3>
            <p>ללקוח זה לא מעודכנת כתובת מייל במערכת. אנא הזן כתובת מייל (תישמר אוטומטית בכרטיס הלקוח).</p>
            <input
              type="email"
              className="input"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="example@gmail.com"
              dir="ltr"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit(); }}
              style={{ marginBottom: '18px', textAlign: 'start' }}
            />
            <div className="confirm-actions">
              <button type="button" className="btn btn-primary" onClick={handleEmailSubmit}>שלח</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowEmailPrompt(false)}>ביטול</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .opm-menu {
          position: absolute; top: 100%; inset-inline-end: 0; margin-top: 8px;
          background: var(--surface); border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 1050; min-width: 170px; overflow: hidden; padding: 6px;
          border: 1px solid var(--border);
          animation: opm-slide-in 0.15s ease-out forwards;
        }
        @keyframes opm-slide-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .opm-menu-item {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border: none; background: transparent; cursor: pointer;
          border-radius: var(--radius-sm); font-weight: 600; font-size: 0.88rem; color: var(--text);
          transition: background-color 0.15s ease;
        }
        .opm-menu-item .icon { width: 16px; height: 16px; color: var(--text-3); }
        .opm-menu-item:hover { background: var(--surface-alt); }
      `}} />
    </>
  );
}
