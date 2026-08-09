'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { verifyPin } from '@/components/orders/modern/mocAuth';
import { cacheNamespace } from '@/app/lib/pageCache';
import { REFUNDS_PAGE_SIZE } from '@/app/lib/prefetchRoutes';

// מטמון SWR משותף — ראה app/lib/pageCache.js
const refundsCache = cacheNamespace('refunds');

// שמור על 50 רשומות בטעינה בכל שלושת הטאבים - עקבי בין זיכויים/חובות/מאושרות ללא תשלום מלא.
// הערך מוגדר ב-prefetchRoutes.js כדי שה-prefetch יבנה את אותו URL בדיוק.
const PAGE_SIZE = REFUNDS_PAGE_SIZE;

function hebrewDateFor(order) {
  if (order.eventDateHebrew) return order.eventDateHebrew;
  if (order.eventDate) return getHebrewDateString(order.eventDate);
  return '';
}

/** שולף הזמנות עם יתרת חוב, בעימוד של PAGE_SIZE בכל פעם. filterStatus הוא 'unpaid_all'
 * (כל החובות הפתוחים) או 'unpaid_approved' (רק הזמנות שכבר יצאו בפועל - ר' app/api/orders/route.js). */
async function fetchDebtOrdersPage(filterStatus, page, searchTerm) {
  const params = new URLSearchParams({ filterStatus, page: String(page), limit: String(PAGE_SIZE) });
  const term = (searchTerm || '').trim();
  if (term) {
    // מספר ארוך (7+ ספרות) מזוהה כטלפון וממופה ל-customerPhone (OR על phone1/phone2
    // בשרת); כל השאר עובר כ-search הכללי (שם לקוח / מס' הזמנה / פריט).
    if (/^\d{7,}$/.test(term)) params.set('customerPhone', term);
    else params.set('search', term);
  }
  const res = await fetch(`/api/orders?${params.toString()}`);
  return res.json();
}

/** מציג את הסטטוס האחרון (DEBT_APPROVED/CANCEL_DEBT_APPROVAL) עבור הזמנה אחת בטבלת חובות. */
function ApprovalCell({ orderId, approval, onUndo, isBusy }) {
  if (!approval || !approval.isApproved) {
    return <span className="cell-muted" style={{ fontSize: '12.5px' }}>לא אושר</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
      <span className="badge badge-success">
        <svg className="icon"><use href="#i-check" /></svg>
        מאושר לתשלום
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => onUndo(orderId)}
        disabled={isBusy}
        title="בטל אישור"
        style={{ color: 'var(--warning)', padding: 0, height: 'auto' }}
      >
        <svg className="icon"><use href="#i-refresh" /></svg>
        בטל אישור
      </button>
    </div>
  );
}

/** טבלת חובות משותפת לטאב "חובות פתוחים" ולטאב "הזמנות מאושרות ללא תשלום מלא" - שני
 * הטאבים שולפים מ-/api/orders עם filterStatus שונה אבל מוצגים באותו עיצוב/עמודות/פעולות. */
function DebtsTable({
  accentColor, list, loading, hasMore, loadingMore, onLoadMore,
  searchTerm, onSearchTermChange, searchPlaceholder, emptyText,
  approvals, selectedIds, onToggleSelect, onToggleSelectAll, onClearSelection, onOpenApproveModal, onUndoApproval, isBusy
}) {
  const selectableIds = list.filter(o => !approvals[o.orderId]?.isApproved).map(o => o.orderId);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

  return (
    <>
      <div className="toolbar">
        <div className="input-icon-wrap" style={{ flex: 1, maxWidth: '420px' }}>
          <svg className="icon"><use href="#i-search" /></svg>
          <input
            className="input"
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="page-loading">
          <span className="spinner lg" />
          טוען נתונים...
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={selectableIds.length === 0}
                    onChange={() => onToggleSelectAll(selectableIds)}
                    title="בחר הכל"
                  />
                </th>
                <th>תאריך אירוע</th>
                <th>לקוח</th>
                <th>הזמנה</th>
                <th>סה&quot;כ להזמנה</th>
                <th>שולם</th>
                <th style={{ color: accentColor }}>יתרת חוב</th>
                <th>סטטוס אישור</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="empty-state">
                      <svg className="icon"><use href="#i-alert-circle" /></svg>
                      <p>{emptyText}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                list.map(order => {
                  const debtAmount = (order.totalAmount || 0) - (order.totalPaid || 0);
                  const approval = approvals[order.orderId];
                  const hebrewDate = hebrewDateFor(order);
                  return (
                    <tr key={order.orderId}>
                      <td style={{ textAlign: 'center' }}>
                        {approval?.isApproved ? (
                          <svg className="icon" style={{ color: 'var(--success)' }}><use href="#i-check-circle" /></svg>
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.orderId)}
                            onChange={() => onToggleSelect(order.orderId)}
                            title={`בחר הזמנה #${order.orderId}`}
                          />
                        )}
                      </td>
                      <td className="cell-muted">
                        <div style={{ fontWeight: 500, color: 'var(--text)' }}>{order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : 'ללא תאריך'}</div>
                        {hebrewDate && <div style={{ fontSize: '11.5px' }}>{hebrewDate}</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--primary-solid)' }}>
                          <Link href={`/customers/${order.customerId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {order.customerName || 'לקוח לא ידוע'}
                          </Link>
                        </div>
                        <div className="hint" style={{ color: 'var(--text-3)' }}>{order.customerPhone || ''}</div>
                      </td>
                      <td>
                        <Link href={`/orders/${order.orderId}`} className="badge badge-info">
                          #{order.orderId}
                          <svg className="icon"><use href="#i-link" /></svg>
                        </Link>
                      </td>
                      <td className="cell-primary">₪{order.totalAmount}</td>
                      <td style={{ color: 'var(--success)' }}>₪{order.totalPaid}</td>
                      <td style={{ fontWeight: 800, color: accentColor, fontSize: '15px' }}>₪{debtAmount}</td>
                      <td>
                        <ApprovalCell orderId={order.orderId} approval={approval} onUndo={onUndoApproval} isBusy={isBusy} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>

          {/* סרגל פעולה קבוצתית — מופיע כאשר נבחרו הזמנות לאישור תשלום */}
          {selectedIds.size > 0 && (
            <div className="bulk-bar">
              <strong>{selectedIds.size} {selectedIds.size === 1 ? 'הזמנה נבחרה' : 'הזמנות נבחרו'}</strong>
              <span className="spacer" style={{ flex: 1 }} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClearSelection}>ביטול בחירה</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={isBusy} onClick={() => onOpenApproveModal(list)}>
                <svg className="icon"><use href="#i-shield" /></svg>
                אשר תשלום שנבחרו ({selectedIds.size})
              </button>
            </div>
          )}

          <div className="table-foot">
            <span>סה&quot;כ שורות מוצגות: {list.length}</span>
            {hasMore && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={loadingMore} onClick={onLoadMore}>
                {loadingMore ? 'טוען...' : 'טען עוד'}
                <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'executed'
  const [isProcessing, setIsProcessing] = useState(false);
  const [refundsPage, setRefundsPage] = useState(1);
  const [refundsHasMore, setRefundsHasMore] = useState(false);
  const [loadingMoreRefunds, setLoadingMoreRefunds] = useState(false);

  const [activeTab, setActiveTab] = useState('refunds'); // 'refunds' | 'debts' | 'approved'

  // טאב "חובות פתוחים" - כל ההזמנות עם יתרת חוב, ללא קשר לסטטוס ההזמנה.
  const [debts, setDebts] = useState([]);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [debtsPage, setDebtsPage] = useState(1);
  const [debtsHasMore, setDebtsHasMore] = useState(false);
  const [loadingMoreDebts, setLoadingMoreDebts] = useState(false);
  const [debtsSearchTerm, setDebtsSearchTerm] = useState('');

  // טאב "הזמנות מאושרות ללא תשלום מלא" - תת-קבוצה של החובות: רק הזמנות שכבר יצאו
  // בפועל (לפחות פריט אחד isTaken), בשונה מהזמנה עתידית ("בקרוב") שרק שמרה שמלות.
  const [approvedDebts, setApprovedDebts] = useState([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedPage, setApprovedPage] = useState(1);
  const [approvedHasMore, setApprovedHasMore] = useState(false);
  const [loadingMoreApproved, setLoadingMoreApproved] = useState(false);
  const [approvedSearchTerm, setApprovedSearchTerm] = useState('');

  // מצב אישור חוב משותף לשני הטאבים (מפתח = orderId) - "אישור יתרת חוב" (DEBT_APPROVED),
  // אותה מוסכמה שכבר קיימת ב-PUT /api/orders/[id] כששומרים הזמנה עם יתרה פתוחה.
  const [approvalsByOrderId, setApprovalsByOrderId] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmModal, setConfirmModal] = useState({ open: false, orderIds: [], totalAmount: 0 });
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => { setSelectedIds(new Set()); }, [activeTab]);

  async function fetchApprovalsForOrders(orderIds) {
    const ids = orderIds.filter(id => id !== null && id !== undefined);
    if (ids.length === 0) return;
    try {
      const res = await fetch(`/api/audit?entityType=Order&entityIds=${ids.join(',')}&actions=DEBT_APPROVED,CANCEL_DEBT_APPROVAL&limit=500`);
      const data = await res.json();
      const logs = Array.isArray(data?.logs) ? data.logs : [];
      // logs מגיעים ממוינים desc לפי createdAt - הרשומה הראשונה שנתקלים בה לכל entityId היא העדכנית ביותר.
      const latestByOrder = {};
      for (const log of logs) {
        if (!(log.entityId in latestByOrder)) latestByOrder[log.entityId] = log;
      }
      setApprovalsByOrderId(prev => {
        const next = { ...prev };
        for (const orderId of ids) {
          const log = latestByOrder[String(orderId)];
          if (log && log.action === 'DEBT_APPROVED') {
            let approvedAmount = null;
            try { approvedAmount = JSON.parse(log.changesJson)?.approvedDebtAmount; } catch (e) {}
            next[orderId] = { isApproved: true, approvedAt: log.createdAt, approvedBy: log.employeeId, approvedAmount };
          } else {
            next[orderId] = { isApproved: false };
          }
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to fetch debt approvals:', err);
    }
  }

  async function loadDebts(page, term, { append = false } = {}) {
    if (append) setLoadingMoreDebts(true); else setDebtsLoading(true);
    try {
      const data = await fetchDebtOrdersPage('unpaid_all', page, term);
      const rows = Array.isArray(data?.data) ? data.data : [];
      setDebts(prev => append ? [...prev, ...rows] : rows);
      setDebtsPage(page);
      setDebtsHasMore(page < (data?.totalPages || 1));
      fetchApprovalsForOrders(rows.map(r => r.orderId));
    } catch (err) {
      console.error('Failed to fetch debts:', err);
    } finally {
      if (append) setLoadingMoreDebts(false); else setDebtsLoading(false);
    }
  }

  async function loadApprovedDebts(page, term, { append = false } = {}) {
    if (append) setLoadingMoreApproved(true); else setApprovedLoading(true);
    try {
      const data = await fetchDebtOrdersPage('unpaid_approved', page, term);
      const rows = Array.isArray(data?.data) ? data.data : [];
      setApprovedDebts(prev => append ? [...prev, ...rows] : rows);
      setApprovedPage(page);
      setApprovedHasMore(page < (data?.totalPages || 1));
      fetchApprovalsForOrders(rows.map(r => r.orderId));
    } catch (err) {
      console.error('Failed to fetch approved-unpaid orders:', err);
    } finally {
      if (append) setLoadingMoreApproved(false); else setApprovedLoading(false);
    }
  }

  // טעינה ראשונית בכניסה לטאב + חיפוש עם דיבאונס קל (מיידי כשהחיפוש ריק).
  useEffect(() => {
    if (activeTab !== 'debts') return;
    const t = setTimeout(() => loadDebts(1, debtsSearchTerm), debtsSearchTerm ? 400 : 0);
    return () => clearTimeout(t);
  }, [activeTab, debtsSearchTerm]);

  useEffect(() => {
    if (activeTab !== 'approved') return;
    const t = setTimeout(() => loadApprovedDebts(1, approvedSearchTerm), approvedSearchTerm ? 400 : 0);
    return () => clearTimeout(t);
  }, [activeTab, approvedSearchTerm]);

  const toggleSelect = (orderId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = (ids) => {
    setSelectedIds(prev => {
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openApproveModal = (list) => {
    const rows = list.filter(o => selectedIds.has(o.orderId));
    const totalAmount = rows.reduce((sum, o) => sum + Math.max(0, (o.totalAmount || 0) - (o.totalPaid || 0)), 0);
    setConfirmModal({ open: true, orderIds: rows.map(r => r.orderId), totalAmount });
  };

  const confirmApproveSelected = async () => {
    const auth = await verifyPin('אישור תשלום עבור החובות שנבחרו דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'מנהל');
    if (!auth) return;
    setIsApproving(true);
    try {
      const ids = confirmModal.orderIds;
      for (const orderId of ids) {
        const res = await fetch(`/api/orders/${orderId}/debt-approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: auth.employeeId })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error((errData && errData.error) || `שגיאה באישור הזמנה #${orderId}`);
        }
      }
      await fetchApprovalsForOrders(ids);
      setSelectedIds(new Set());
      setConfirmModal({ open: false, orderIds: [], totalAmount: 0 });
    } catch (err) {
      alert(err.message || 'שגיאה באישור החובות.');
    } finally {
      setIsApproving(false);
    }
  };

  const undoDebtApproval = async (orderId) => {
    if (!(await window.customConfirm('לבטל את אישור יתרת החוב עבור הזמנה זו? ניתן יהיה לאשר שוב בכל עת.'))) return;
    const auth = await verifyPin('ביטול אישור חוב דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'מנהל');
    if (!auth) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/debt-approval`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: auth.employeeId })
      });
      if (!res.ok) throw new Error('שגיאה בביטול אישור החוב');
      await fetchApprovalsForOrders([orderId]);
    } catch (err) {
      alert(err.message || 'שגיאה בביטול אישור החוב.');
    } finally {
      setIsApproving(false);
    }
  };

  async function fetchRefunds(isPrefetch = false) {
    if (!isPrefetch) setLoading(true);

    // SWR Cache Hit
    if (!isPrefetch && refundsCache.has('refunds')) {
      const cached = refundsCache.get('refunds');
      setRefunds(cached.data);
      setRefundsPage(cached.page);
      setRefundsHasMore(cached.page < cached.totalPages);
      setLoading(false); // UI becomes interactive instantly
    }

    try {
      // Paginated fetch: GET /api/refunds defaulted to the most recent PAGE_SIZE rows with
      // no way to reach anything older. Requesting page 1 explicitly opts into the
      // paginated response shape ({ data, total, totalPages }) so "טען עוד" below can
      // page through the rest instead of older refunds being permanently invisible.
      const res = await fetch(`/api/refunds?page=1&limit=${PAGE_SIZE}`);
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        refundsCache.set('refunds', data); // Update Cache silently
        if (!isPrefetch) {
          setRefunds(data.data);
          setRefundsPage(1);
          setRefundsHasMore(1 < data.totalPages);
        }
      } else {
        if (!isPrefetch) setRefunds([]);
      }
    } catch (err) {
      console.error('Failed to fetch refunds:', err);
    } finally {
      if (!isPrefetch) setLoading(false);
    }
  };

  async function loadMoreRefunds() {
    if (loadingMoreRefunds || !refundsHasMore) return;
    setLoadingMoreRefunds(true);
    try {
      const nextPage = refundsPage + 1;
      const res = await fetch(`/api/refunds?page=${nextPage}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        setRefunds(prev => [...prev, ...data.data]);
        setRefundsPage(nextPage);
        setRefundsHasMore(nextPage < data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load more refunds:', err);
    } finally {
      setLoadingMoreRefunds(false);
    }
  }

  useEffect(() => {
    fetchRefunds();
  }, []);

  const executeRefund = async (id) => {
    if (!(await window.customConfirm('האם אתה בטוח שברצונך לסמן זיכוי זה כ"בוצע"?\nפעולה זו תיצור תשלום הפכי (מינוס) בכרטיס ההזמנה המקושר.'))) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExecuted: true })
      });

      if (!res.ok) throw new Error('Failed to execute refund');

      const updatedRefund = await res.json();
      setRefunds(prev => prev.map(r => r.id === id ? { ...r, ...updatedRefund } : r));
      alert('הזיכוי סומן כבוצע בהצלחה והתעדכן בכרטיס ההזמנה.');
    } catch (err) {
      alert('שגיאה בביצוע הזיכוי: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const undoExecuteRefund = async (id) => {
    if (!(await window.customConfirm('האם אתה בטוח שברצונך לבטל את אישור ביצוע הזיכוי?\nהפעולה תחזיר את הזיכוי לסטטוס ממתין ותמחק את תנועת ההחזר מכרטיס ההזמנה.'))) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExecuted: false })
      });

      if (!res.ok) throw new Error('Failed to undo refund execution');

      const updatedRefund = await res.json();
      setRefunds(prev => prev.map(r => r.id === id ? { ...r, ...updatedRefund } : r));
      alert('ביצוע הזיכוי בוטל והתעדכן בכרטיס ההזמנה.');
    } catch (err) {
      alert('שגיאה בביטול ביצוע הזיכוי: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelRefund = async (id) => {
    const refund = refunds.find(r => r.id === id);
    const confirmMessage = refund?.isExecuted
      ? 'זיכוי זה כבר בוצע ויש תשלום הפכי (זיכוי) רשום בכרטיס ההזמנה. מחיקת הבקשה תמחק גם את תנועת ההחזר הזו מכרטיס ההזמנה. להמשיך?'
      : 'האם אתה בטוח שברצונך לבטל ולמחוק בקשת זיכוי זו לחלוטין?';
    if (!(await window.customConfirm(confirmMessage))) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to cancel refund');

      setRefunds(prev => prev.filter(r => r.id !== id));
      alert('בקשת הזיכוי בוטלה.');
    } catch (err) {
      alert('שגיאה בביטול הזיכוי: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['תאריך בקשה', 'לקוח', 'טלפון', 'מייל', 'מספר הזמנה', 'סכום לזיכוי', 'סיבה', 'בנק', 'סניף', 'חשבון', 'שם בעל החשבון', 'פרטי אשראי מקורי', 'סטטוס', 'תאריך ביצוע'];
    const csvData = [
      headers.join(','),
      ...filteredRefunds.map(r => {
        const customerName = r.customer ? `${r.customer.firstName || ''} ${r.customer.lastName || ''}`.trim() : '';
        const phone = r.customer?.phone1 || '';
        const email = r.email || r.customer?.email || '';
        const dateStr = new Date(r.createdAt).toLocaleDateString('he-IL');
        const execDateStr = r.isExecuted && r.executionDate ? new Date(r.executionDate).toLocaleDateString('he-IL') : '';
        const statusStr = r.isExecuted ? 'בוצע' : 'ממתין';

        return [
          dateStr,
          `"${customerName}"`,
          `"${phone}"`,
          `"${email}"`,
          r.orderId || '',
          r.amount || 0,
          `"${r.reason || ''}"`,
          `"${r.bankName || ''}"`,
          `"${r.bankBranch || ''}"`,
          `"${r.bankAccount || ''}"`,
          `"${r.bankAccountName || ''}"`,
          `"${r.paymentDetails || ''}"`,
          statusStr,
          execDateStr
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['﻿' + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `refunds_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredRefunds = refunds.filter(r => {
    const matchesSearch =
      (r.customer?.firstName || '').includes(searchTerm) ||
      (r.customer?.lastName || '').includes(searchTerm) ||
      (r.customer?.phone1 || '').includes(searchTerm) ||
      (r.orderId?.toString() || '').includes(searchTerm) ||
      (r.amount?.toString() || '').includes(searchTerm);

    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'pending') return matchesSearch && !r.isExecuted;
    if (filterStatus === 'executed') return matchesSearch && r.isExecuted;
    return matchesSearch;
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>זיכויים וחובות</h1>
          <div className="page-desc">ניהול זיכויים ומעקב חובות פתוחים</div>
        </div>
        <div className="page-actions">
          {activeTab === 'refunds' && (
            <button type="button" className="btn btn-secondary btn-icon-only" title="ייצוא זיכויים לאקסל" onClick={exportToCSV}>
              <svg className="icon"><use href="#i-download" /></svg>
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button type="button" className={activeTab === 'refunds' ? 'tab active' : 'tab'} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('refunds')}>
          <svg className="icon"><use href="#i-coin" /></svg>
          זיכויים
        </button>
        <button type="button" className={activeTab === 'debts' ? 'tab active' : 'tab'} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('debts')}>
          <svg className="icon"><use href="#i-alert-circle" /></svg>
          חובות פתוחים
        </button>
        <button type="button" className={activeTab === 'approved' ? 'tab active' : 'tab'} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('approved')}>
          <svg className="icon"><use href="#i-shield" /></svg>
          הזמנות מאושרות ללא תשלום מלא
        </button>
      </div>

      {activeTab === 'refunds' && (
        <>
          <div className="toolbar">
            <div className="input-icon-wrap" style={{ flex: 1, maxWidth: '420px' }}>
              <svg className="icon"><use href="#i-search" /></svg>
              <input
                className="input"
                type="text"
                placeholder="חיפוש לפי שם לקוח, טלפון, הזמנה או סכום..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="pill-tabs">
              <button type="button" onClick={() => setFilterStatus('all')} className={filterStatus === 'all' ? 'pill-tab active' : 'pill-tab'}>הכל</button>
              <button type="button" onClick={() => setFilterStatus('pending')} className={filterStatus === 'pending' ? 'pill-tab active' : 'pill-tab'}>ממתינים</button>
              <button type="button" onClick={() => setFilterStatus('executed')} className={filterStatus === 'executed' ? 'pill-tab active' : 'pill-tab'}>בוצעו</button>
            </div>
            <span className="spacer" />
          </div>

          {loading ? (
            <div className="page-loading">
              <span className="spinner lg" />
              טוען נתונים...
            </div>
          ) : (
            <div className="table-wrap">
              <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>לקוח</th>
                    <th>הזמנה</th>
                    <th>סכום</th>
                    <th>פרטי בנק</th>
                    <th>אשראי מקורי</th>
                    <th>סטטוס</th>
                    <th style={{ textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRefunds.length === 0 ? (
                    <tr>
                      <td colSpan="8">
                        <div className="empty-state">
                          <svg className="icon"><use href="#i-search" /></svg>
                          <p>לא נמצאו זיכויים תואמים.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRefunds.map(refund => (
                      <tr key={refund.id}>
                        <td className="cell-muted">
                          <div style={{ fontWeight: 500, color: 'var(--text)' }}>{new Date(refund.createdAt).toLocaleDateString('he-IL')}</div>
                          {refund.isExecuted && <div style={{ fontSize: '11.5px' }}>בוצע: {new Date(refund.executionDate).toLocaleDateString('he-IL')}</div>}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--primary-solid)' }}>
                            <Link href={`/customers/${refund.customerId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                              {refund.customer ? `${refund.customer.firstName || ''} ${refund.customer.lastName || ''}`.trim() : 'לקוח לא ידוע'}
                            </Link>
                          </div>
                          <div className="hint" style={{ color: 'var(--text-3)' }}>{refund.customer?.phone1}</div>
                          {refund.email && (
                            <div className="hint" style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-mail" /></svg>
                              {refund.email}
                            </div>
                          )}
                        </td>
                        <td>
                          {refund.orderId ? (
                            <Link href={`/orders/${refund.orderId}`} className="badge badge-info">
                              #{refund.orderId}
                              <svg className="icon"><use href="#i-link" /></svg>
                            </Link>
                          ) : '-'}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '15px' }}>₪{refund.amount}</span>
                          {refund.reason && <div className="hint" style={{ color: 'var(--text-3)' }}>{refund.reason}</div>}
                        </td>
                        <td>
                          {refund.bankName || refund.bankAccount ? (
                            <div style={{ fontSize: '12.5px' }}>
                              <div>{refund.bankName || 'בנק חסר'} {refund.bankBranch ? `(סניף ${refund.bankBranch})` : ''}</div>
                              <div style={{ fontWeight: 600 }}>{refund.bankAccount || 'חשבון חסר'}</div>
                              {refund.bankAccountName && <div className="hint" style={{ color: 'var(--text-3)' }}>{refund.bankAccountName}</div>}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-3)' }}>לא הוזנו</span>
                          )}
                        </td>
                        <td>
                          {refund.paymentDetails ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                              <svg className="icon" style={{ width: '14px', height: '14px', color: 'var(--text-3)' }}><use href="#i-card" /></svg>
                              {refund.paymentDetails}
                            </div>
                          ) : <span style={{ color: 'var(--text-3)' }}>-</span>}
                        </td>
                        <td>
                          <span className={refund.isExecuted ? 'badge badge-success' : 'badge badge-warning'}>
                            <svg className="icon"><use href={refund.isExecuted ? '#i-check-circle' : '#i-clock'} /></svg>
                            {refund.isExecuted ? 'בוצע' : 'ממתין לביצוע'}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions" style={{ justifyContent: 'center' }}>
                            {!refund.isExecuted && (
                              <button type="button" className="btn btn-secondary btn-icon-only btn-sm" onClick={() => executeRefund(refund.id)} disabled={isProcessing} title="סמן כבוצע">
                                <svg className="icon"><use href="#i-check-circle" /></svg>
                              </button>
                            )}
                            {refund.isExecuted && (
                              <button type="button" className="btn btn-secondary btn-icon-only btn-sm" onClick={() => undoExecuteRefund(refund.id)} disabled={isProcessing} title="בטל ביצוע">
                                <svg className="icon"><use href="#i-refresh" /></svg>
                              </button>
                            )}
                            <button type="button" className="btn btn-danger-ghost btn-icon-only btn-sm" onClick={() => cancelRefund(refund.id)} disabled={isProcessing} title="בטל בקשה">
                              <svg className="icon"><use href="#i-x-circle" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
              <div className="table-foot">
                <span>סה&quot;כ שורות מוצגות: {filteredRefunds.length}</span>
                {refundsHasMore && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={loadingMoreRefunds} onClick={loadMoreRefunds}>
                    {loadingMoreRefunds ? 'טוען...' : 'טען זיכויים ישנים יותר'}
                    <svg className="icon"><use href="#i-chevron-start" /></svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'debts' && (
        <DebtsTable
          accentColor="var(--danger)"
          list={debts}
          loading={debtsLoading}
          hasMore={debtsHasMore}
          loadingMore={loadingMoreDebts}
          onLoadMore={() => loadDebts(debtsPage + 1, debtsSearchTerm, { append: true })}
          searchTerm={debtsSearchTerm}
          onSearchTermChange={setDebtsSearchTerm}
          searchPlaceholder="חיפוש חוב לפי שם לקוח, טלפון, או הזמנה..."
          emptyText="לא נמצאו חובות תואמים."
          approvals={approvalsByOrderId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onClearSelection={clearSelection}
          onOpenApproveModal={openApproveModal}
          onUndoApproval={undoDebtApproval}
          isBusy={isApproving}
        />
      )}

      {activeTab === 'approved' && (
        <>
          <div className="callout callout-warning" style={{ marginBottom: '18px' }}>
            <svg className="icon"><use href="#i-alert-tri" /></svg>
            <div>הזמנות שכבר יצאו בפועל (לפחות פריט אחד נמסר ללקוח) ועדיין נותרת בהן יתרת חוב פתוחה - להבדיל מטאב &quot;חובות פתוחים&quot; שמציג גם הזמנות עתידיות שטרם יצאו.</div>
          </div>
          <DebtsTable
            accentColor="var(--warning)"
            list={approvedDebts}
            loading={approvedLoading}
            hasMore={approvedHasMore}
            loadingMore={loadingMoreApproved}
            onLoadMore={() => loadApprovedDebts(approvedPage + 1, approvedSearchTerm, { append: true })}
            searchTerm={approvedSearchTerm}
            onSearchTermChange={setApprovedSearchTerm}
            searchPlaceholder="חיפוש לפי שם לקוח, טלפון, או הזמנה..."
            emptyText="לא נמצאו הזמנות מאושרות עם יתרת חוב."
            approvals={approvalsByOrderId}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onClearSelection={clearSelection}
            onOpenApproveModal={openApproveModal}
            onUndoApproval={undoDebtApproval}
            isBusy={isApproving}
          />
        </>
      )}

      {/* מודל אישור תשלום לחובות שנבחרו */}
      {confirmModal.open && (
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget && !isApproving) setConfirmModal({ open: false, orderIds: [], totalAmount: 0 }); }}
        >
          <div className="modal confirm-modal">
            <div className="modal-icon-circle" style={{ background: 'var(--primary-tint)', color: 'var(--primary-solid)' }}>
              <svg className="icon"><use href="#i-shield" /></svg>
            </div>
            <h3>אישור יתרת חוב לתשלום</h3>
            <p>
              מסמן {confirmModal.orderIds.length} {confirmModal.orderIds.length === 1 ? 'הזמנה' : 'הזמנות'} בסך כולל של{' '}
              <strong>₪{confirmModal.totalAmount.toLocaleString()}</strong> כמאושרות לתשלום ע״י מנהל.
            </p>
            <p style={{ fontSize: '11.5px' }}>
              הפעולה מתעדת אישור מנהל ליתרת החוב ותופיע בהיסטוריית ההזמנה (כמו כל אישור מנהל אחר במערכת). היא אינה יוצרת תשלום בפועל בכרטיס ההזמנה, וניתן לבטל אותה בכל עת.
            </p>
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" disabled={isApproving} onClick={() => setConfirmModal({ open: false, orderIds: [], totalAmount: 0 })}>ביטול</button>
              <button type="button" className="btn btn-primary" disabled={isApproving} onClick={confirmApproveSelected}>
                {isApproving ? (
                  <>
                    <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                    מאשר...
                  </>
                ) : (
                  <>
                    <svg className="icon"><use href="#i-shield" /></svg>
                    אשר תשלום
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
