'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, FileText, ClipboardList, Mail, Loader2 } from 'lucide-react';

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
          {sending ? <Loader2 size={triggerIconSize} className="opm-spin" /> : <Printer size={triggerIconSize} />}
        </button>
        {open && (
          <div className="opm-menu">
            <button type="button" className="opm-menu-item" onClick={() => openPrint('order')}><FileText size={16} /> הזמנה</button>
            <button type="button" className="opm-menu-item" onClick={() => openPrint('rental')}><ClipboardList size={16} /> השכרה</button>
            <button type="button" className="opm-menu-item" onClick={() => handleSendEmail('order')}><Mail size={16} /> מייל הזמנה</button>
            <button type="button" className="opm-menu-item" onClick={() => handleSendEmail('rental')}><Mail size={16} /> מייל השכרה</button>
          </div>
        )}
      </div>

      {showRegulationsModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={cancelSignatureConfirm}>
          <div className="opm-modal" onClick={e => e.stopPropagation()}>
            <h2 className="opm-modal-title">חתימה על תקנון</h2>
            <p className="opm-modal-text">האם הלקוח חתם על התקנון?</p>
            <div className="opm-modal-actions">
              <button type="button" className="btn btn-primary" onClick={confirmSigned} disabled={confirmingSigned} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {confirmingSigned && <Loader2 size={16} className="opm-spin" />}
                כן, חתם
              </button>
              <button type="button" className="btn btn-outline" onClick={cancelSignatureConfirm}>לא (ביטול)</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showEmailPrompt && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setShowEmailPrompt(false)}>
          <div className="opm-modal" onClick={e => e.stopPropagation()}>
            <h2 className="opm-modal-title">כתובת מייל חסרה</h2>
            <p className="opm-modal-text">ללקוח זה לא מעודכנת כתובת מייל במערכת. אנא הזן כתובת מייל (תישמר אוטומטית בכרטיס הלקוח).</p>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="example@gmail.com"
              dir="ltr"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit(); }}
              className="opm-email-input"
            />
            <div className="opm-modal-actions">
              <button type="button" className="btn btn-primary" onClick={handleEmailSubmit}>שלח</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowEmailPrompt(false)}>ביטול</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes opm-spin { to { transform: rotate(360deg); } }
        .opm-spin { animation: opm-spin 0.8s linear infinite; }

        .opm-menu {
          position: absolute; top: 100%; right: 0; margin-top: 8px;
          background: var(--card-bg, #fff); border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.06);
          z-index: 1050; min-width: 170px; overflow: hidden; padding: 6px;
          border: 1px solid var(--element-border, #e5e7eb);
          animation: opm-slide-in 0.15s ease-out forwards;
        }
        @keyframes opm-slide-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .opm-menu-item {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border: none; background: transparent; cursor: pointer;
          border-radius: 8px; font-weight: 600; font-size: 0.88rem; color: var(--text-main, #334155);
          transition: background-color 0.15s ease;
        }
        .opm-menu-item:hover { background: var(--element-bg, #f8fafc); }

        .opm-modal {
          background: var(--card-bg, #fff); padding: 2rem; border-radius: 16px;
          width: 100%; max-width: 420px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          border: 1px solid var(--element-border, #e2e8f0); text-align: center;
        }
        .opm-modal-title { color: var(--primary-color, #d4af37); margin: 0 0 1rem 0; font-size: 1.35rem; font-weight: bold; }
        .opm-modal-text { font-size: 1rem; margin-bottom: 1.5rem; color: var(--text-main); line-height: 1.5; }
        .opm-modal-actions { display: flex; gap: 1rem; justify-content: center; }
        .opm-email-input {
          width: 100%; padding: 0.7rem 1rem; font-size: 1rem; border-radius: 10px;
          border: 2px solid var(--element-border, #cbd5e1); margin-bottom: 1.25rem;
          text-align: left; outline: none; background: var(--input-bg, #fff); color: var(--text-main);
        }
      `}} />
    </>
  );
}
