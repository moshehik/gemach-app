'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePopup } from './PopupProvider';

export default function MessageHistoryButton({ 'data-element-name': dataElementName }) {
  const [isOpen, setIsOpen] = useState(false);
  const popupContext = usePopup();
  const alertsHistory = popupContext?.alertsHistory || [];

  return (
    <>
      <button
        type="button"
        data-element-name={dataElementName || 'כפתור_היסטוריית_הודעות'}
        className="icon-btn"
        onClick={() => setIsOpen(true)}
        title="היסטוריית הודעות מערכת"
      >
        <svg className="icon"><use href="#i-message" /></svg>
        {alertsHistory.length > 0 && <span className="dot" />}
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 }}>
          <div className="modal" style={{ maxWidth: 500, width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              <strong><svg className="icon"><use href="#i-message" /></svg> היסטוריית הודעות מערכת</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setIsOpen(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {alertsHistory.length === 0 ? (
                <div className="empty-state">
                  <p>אין הודעות מתועדות למסע הנוכחי.</p>
                </div>
              ) : (
                alertsHistory.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`callout callout-${alert.type === 'error' ? 'danger' : alert.type === 'success' ? 'success' : 'info'}`}
                  >
                    <svg className="icon"><use href={alert.type === 'error' ? '#i-alert-tri' : alert.type === 'success' ? '#i-check-circle' : '#i-info'} /></svg>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{alert.time.toLocaleTimeString('he-IL')}</span>
                      <span style={{ fontSize: 13 }}>{alert.message}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon-only btn-sm"
                      onClick={() => navigator.clipboard.writeText(alert.message).catch(() => {})}
                      title="העתק הודעה"
                    >
                      <svg className="icon"><use href="#i-link" /></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
