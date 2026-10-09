'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import '@/design-system/components.css';
import './new-order/css/new-order-font.css';
import './new-order/css/new-order.css';
import './ai-widget/ai-dialogs.css';
import { DialogFrame } from './new-order/NoDialogs';
import { Ic } from './new-order/NoUi';
import { MenuSprite } from './menu/menuParts';

// רשימת ההזמנות שלא הוחזרו (OverdueRemindersWatcher) - מוצג רק בגמח נווה יעקב
// (ר' showOverdueRemindersPopup/enable_unreturned_orders_popup ב-app/layout.js).
// שורות ממוינות לפי מספר הזמנה, עם קישור/אייקון נקי לכניסה לאותה הזמנה.
// 9.10.2026: החלון בעיצוב החדש הכהה של פלטת האתר (אותו #dlg של שאר החלוניות, כמו חלוניות עוזר ה-AI) במקום .modal הישן.
export default function OverdueOrdersModal({ isOpen, orders, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sortedOrders = [...orders].sort((a, b) => a.orderId - b.orderId);

  const content = (
    <div className="gm-ds gm-no dlg-dark ai-dlg-root" dir="rtl">
      <MenuSprite />
      <DialogFrame layer={1} cls="ai-wide" onBackdrop={onClose}>
        <h2><Ic n="alert" />הזמנות שלא הוחזרו ({sortedOrders.length})</h2>
        <div className="sub">המשפחות הבאות עדיין לא החזירו את השמלות ומועד ההחזרה שלהן עבר:</div>
        <div className="ai-dlg-table">
          <table className="rtbl">
            <thead>
              <tr>
                <th>הזמנה</th>
                <th>שם לקוח</th>
                <th>ימי איחור</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((order) => (
                <tr key={order.orderId}>
                  <td>{order.orderId}</td>
                  <td>{order.customerName}</td>
                  <td><b>{order.daysLate}</b></td>
                  <td>
                    <a href={`/orders/${order.orderId}`} target="_blank" rel="noopener noreferrer" className="btn sm" aria-label={`כניסה להזמנה ${order.orderId}`}>
                      <Ic n="ext" c="sm" />כניסה להזמנה
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dbtns" style={{ marginTop: 18 }}>
          <button type="button" className="btn ghost block" onClick={onClose}><Ic n="x" c="sm" />סגירה</button>
        </div>
      </DialogFrame>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
