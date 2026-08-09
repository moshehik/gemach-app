'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, CheckCircle, XCircle, Download, CreditCard, Coins, Mail, RotateCcw, ExternalLink, AlertCircle, Calendar, ArrowUpRight, ShieldCheck } from 'lucide-react';
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
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>לא אושר</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
      <span className="status-dot c-green">מאושר לתשלום</span>
      <button
        onClick={() => onUndo(orderId)}
        disabled={isBusy}
        title="בטל אישור"
        style={{ background: 'none', border: 'none', color: '#d97706', padding: 0, cursor: isBusy ? 'default' : 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', opacity: isBusy ? 0.5 : 1 }}
      >
        <RotateCcw size={12} /> בטל אישור
      </button>
    </div>
  );
}

/** טבלת חובות משותפת לטאב "חובות פתוחים" ולטאב "הזמנות מאושרות ללא תשלום מלא" - שני
 * הטאבים שולפים מ-/api/orders עם filterStatus שונה אבל מוצגים באותו עיצוב/עמודות/פעולות. */
function DebtsTable({
  accentColor, list, loading, hasMore, loadingMore, onLoadMore,
  searchTerm, onSearchTermChange, searchPlaceholder, emptyText,
  approvals, selectedIds, onToggleSelect, onToggleSelectAll, onOpenApproveModal, onUndoApproval, isBusy
}) {
  const selectableIds = list.filter(o => !approvals[o.orderId]?.isApproved).map(o => o.orderId);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

  return (
    <>
      <div style={{ background: 'var(--card-bg)', padding: '1rem 1.5rem', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-box-modern" style={{ maxWidth: '420px' }}>
          <Search size={18} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={() => onOpenApproveModal(list)}
            disabled={isBusy}
            className="icon-btn icon-btn-primary c-approve"
            style={{ whiteSpace: 'nowrap' }}
          >
            <ShieldCheck size={17} /> אשר תשלום שנבחרו ({selectedIds.size})
          </button>
        )}
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '16px', boxShadow: 'var(--shadow-md)', overflow: 'visible' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: `4px solid ${accentColor}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
            טוען נתונים...
          </div>
        ) : list.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
            {emptyText}
          </div>
        ) : (
          <div style={{ overflow: 'visible' }}>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ background: 'var(--sticky-header-bg, #ffffff)', color: accentColor, borderBottom: `2px solid ${accentColor}33` }}>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '40px', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={selectableIds.length === 0}
                      onChange={() => onToggleSelectAll(selectableIds)}
                      style={{ cursor: selectableIds.length === 0 ? 'default' : 'pointer', width: '17px', height: '17px' }}
                      title="בחר הכל"
                    />
                  </th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>תאריך אירוע</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>לקוח</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>הזמנה</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>סה"כ להזמנה</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>שולם</th>
                  <th style={{ padding: '0.6rem 0.75rem', color: accentColor, position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>יתרת חוב</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>סטטוס אישור</th>
                </tr>
              </thead>
              <tbody>
                {list.map(order => {
                  const debtAmount = (order.totalAmount || 0) - (order.totalPaid || 0);
                  const approval = approvals[order.orderId];
                  const hebrewDate = hebrewDateFor(order);
                  return (
                    <tr key={order.orderId} style={{ borderBottom: '1px solid var(--element-border)' }}>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                        {approval?.isApproved ? (
                          <CheckCircle size={18} color="#16a34a" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.orderId)}
                            onChange={() => onToggleSelect(order.orderId)}
                            style={{ cursor: 'pointer', width: '17px', height: '17px' }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>{order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : 'ללא תאריך'}</div>
                        {hebrewDate && <div style={{ fontSize: '0.8rem' }}>{hebrewDate}</div>}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                          <Link href={`/customers/${order.customerId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {order.customerName || 'לקוח לא ידוע'}
                          </Link>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.customerPhone || ''}</div>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <Link href={`/orders/${order.orderId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#0ea5e9', textDecoration: 'none', fontWeight: 'bold', background: '#e0f2fe', padding: '0.4rem 0.8rem', borderRadius: '8px', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#bae6fd'} onMouseOut={(e) => e.currentTarget.style.background = '#e0f2fe'}>
                          #{order.orderId}
                          <ArrowUpRight size={14} />
                        </Link>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        ₪{order.totalAmount}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', color: '#16a34a' }}>
                        ₪{order.totalPaid}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: 'bold', color: accentColor, fontSize: '1.1rem' }}>
                        ₪{debtAmount}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <ApprovalCell orderId={order.orderId} approval={approval} onUndo={onUndoApproval} isBusy={isBusy} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.25rem' }}>
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', border: '1px solid var(--element-border)', background: 'var(--card-bg)', color: accentColor, fontWeight: '600', cursor: loadingMore ? 'default' : 'pointer' }}
            >
              {loadingMore ? 'טוען...' : 'טען עוד'}
            </button>
          </div>
        )}
      </div>
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

  const tabTitle = activeTab === 'refunds' ? 'ניהול זיכויים' : activeTab === 'debts' ? 'ניהול חובות' : 'הזמנות מאושרות ללא תשלום מלא';
  const tabColor = activeTab === 'refunds' ? 'var(--primary-color)' : activeTab === 'debts' ? '#e11d48' : '#d97706';

  return (
    <main data-agy-id="refunds_page_main" className="container animate-fade-in page-shell" style={{ '--page-content-max': '1200px', paddingRight: '120px', maxWidth: 'calc(100% - 120px)' }}>
      <div className="page-scroll">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: tabColor, margin: 0, display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '2rem', fontWeight: 'bold' }}>
          {activeTab === 'refunds' ? <Coins data-element-name="רכיב_page_1" size={32} /> : activeTab === 'debts' ? <AlertCircle size={32} /> : <ShieldCheck size={32} />}
          {tabTitle}
        </h1>
      </div>


      <div className="status-filters" style={{ marginBottom: '2rem', gap: '1.75rem' }}>
        <button
          onClick={() => setActiveTab('refunds')}
          className={activeTab === 'refunds' ? 'status-filter active' : 'status-filter'}
          style={activeTab === 'refunds' ? { color: 'var(--primary-color)', fontSize: '1.05rem' } : { fontSize: '1.05rem' }}
        >
          <Coins size={18} />
          <span>זיכויים</span>
        </button>
        <button
          onClick={() => setActiveTab('debts')}
          className={activeTab === 'debts' ? 'status-filter active' : 'status-filter'}
          style={activeTab === 'debts' ? { color: '#e11d48', fontSize: '1.05rem' } : { fontSize: '1.05rem' }}
        >
          <AlertCircle size={18} />
          <span>חובות פתוחים</span>
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={activeTab === 'approved' ? 'status-filter active' : 'status-filter'}
          style={activeTab === 'approved' ? { color: '#d97706', fontSize: '1.05rem' } : { fontSize: '1.05rem' }}
        >
          <ShieldCheck size={18} />
          <span>הזמנות מאושרות ללא תשלום מלא</span>
        </button>
      </div>

      {activeTab === 'refunds' ? (
        <>
      <div className="toolbar-row" style={{ marginBottom: '2rem' }}>
        <div className="search-box-modern">
          <Search data-element-name="רכיב_page_4" size={18} />
          <input data-element-name="שדה_page_5" data-agy-id="refunds_search_input"
            type="text"
            placeholder="חיפוש לפי שם לקוח, טלפון, הזמנה או סכום..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="status-filters">
          <button data-element-name="כפתור_page_6" data-agy-id="filter_all" onClick={() => setFilterStatus('all')} className={filterStatus === 'all' ? 'status-filter active c-blue' : 'status-filter'}>
            <span>הכל</span>
          </button>
          <button data-element-name="כפתור_page_7" data-agy-id="filter_pending" onClick={() => setFilterStatus('pending')} className={filterStatus === 'pending' ? 'status-filter active c-amber' : 'status-filter'}>
            <span>ממתינים</span>
          </button>
          <button data-element-name="כפתור_page_8" data-agy-id="filter_executed" onClick={() => setFilterStatus('executed')} className={filterStatus === 'executed' ? 'status-filter active c-green' : 'status-filter'}>
            <span>בוצעו</span>
          </button>
        </div>

        <div className="icon-toolbar">
          <button data-element-name="כפתור_page_2" data-agy-id="refunds_export_btn" onClick={exportToCSV} className="icon-btn" title="ייצוא לאקסל">
            <Download data-element-name="רכיב_page_3" size={19} />
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '16px', boxShadow: 'var(--shadow-md)', overflow: 'visible' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
             <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
             טוען נתונים...
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
            לא נמצאו זיכויים תואמים.
          </div>
        ) : (
          <div style={{ overflow: 'visible' }}>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ background: 'var(--sticky-header-bg, #ffffff)', color: 'var(--text-main)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>תאריך</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>לקוח</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>הזמנה</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>סכום</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>פרטי בנק</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>אשראי מקורי</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>סטטוס</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', position: 'sticky', top: 0, zIndex: 35, background: 'var(--sticky-header-bg, #ffffff)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.08)' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredRefunds.map(refund => (
                  <tr key={refund.id} style={{ borderBottom: '1px solid var(--element-border)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>{new Date(refund.createdAt).toLocaleDateString('he-IL')}</div>
                      {refund.isExecuted && <div style={{ fontSize: '0.8rem' }}>בוצע: {new Date(refund.executionDate).toLocaleDateString('he-IL')}</div>}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        <Link data-element-name="רכיב_page_9" href={`/customers/${refund.customerId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          {refund.customer ? `${refund.customer.firstName || ''} ${refund.customer.lastName || ''}`.trim() : 'לקוח לא ידוע'}
                        </Link>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{refund.customer?.phone1}</div>
                      {refund.email && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Mail data-element-name="רכיב_page_10" size={12}/> {refund.email}</div>}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      {refund.orderId ? (
                        <Link data-element-name="רכיב_page_11" href={`/orders/${refund.orderId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#0ea5e9', textDecoration: 'none', fontWeight: 'bold', background: '#e0f2fe', padding: '0.4rem 0.8rem', borderRadius: '8px', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#bae6fd'} onMouseOut={(e) => e.currentTarget.style.background = '#e0f2fe'}>
                          #{refund.orderId}
                          <ArrowUpRight size={14} />
                        </Link>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 'bold', color: '#ef4444', fontSize: '1.1rem' }}>
                      ₪{refund.amount}
                      {refund.reason && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>{refund.reason}</div>}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      {refund.bankName || refund.bankAccount ? (
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          <div>{refund.bankName || 'בנק חסר'} {refund.bankBranch ? `(סניף ${refund.bankBranch})` : ''}</div>
                          <div style={{ fontWeight: '600' }}>{refund.bankAccount || 'חשבון חסר'}</div>
                          {refund.bankAccountName && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{refund.bankAccountName}</div>}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>לא הוזנו</span>
                      )}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      {refund.paymentDetails ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          <CreditCard data-element-name="רכיב_page_12" size={14} /> {refund.paymentDetails}
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      <span className={refund.isExecuted ? 'status-dot c-green' : 'status-dot c-amber'}>
                        {refund.isExecuted ? 'בוצע' : 'ממתין לביצוע'}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {!refund.isExecuted && (
                          <button data-element-name="כפתור_page_15" data-agy-id={`execute_btn_${refund.id}`}
                            onClick={() => executeRefund(refund.id)}
                            disabled={isProcessing}
                            title="סמן כבוצע"
                            style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#bbf7d0'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                          >
                            <CheckCircle data-element-name="רכיב_page_16" size={18} />
                          </button>
                        )}
                        {refund.isExecuted && (
                          <button data-element-name="כפתור_page_undo" data-agy-id={`undo_execute_btn_${refund.id}`}
                            onClick={() => undoExecuteRefund(refund.id)}
                            disabled={isProcessing}
                            title="בטל ביצוע"
                            style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fde68a'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                          >
                            <RotateCcw data-element-name="רכיב_page_undo_icon" size={18} />
                          </button>
                        )}
                        <button data-element-name="כפתור_page_17" data-agy-id={`cancel_btn_${refund.id}`}
                          onClick={() => cancelRefund(refund.id)}
                          disabled={isProcessing}
                          title="בטל בקשה"
                          style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                        >
                          <XCircle data-element-name="רכיב_page_18" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && refundsHasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.25rem' }}>
            <button
              onClick={loadMoreRefunds}
              disabled={loadingMoreRefunds}
              style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', border: '1px solid var(--element-border)', background: 'var(--card-bg)', color: 'var(--primary-color)', fontWeight: '600', cursor: loadingMoreRefunds ? 'default' : 'pointer' }}
            >
              {loadingMoreRefunds ? 'טוען...' : 'טען זיכויים ישנים יותר'}
            </button>
          </div>
        )}
      </div>

        </>
      ) : activeTab === 'debts' ? (
        <DebtsTable
          accentColor="#e11d48"
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
          onOpenApproveModal={openApproveModal}
          onUndoApproval={undoDebtApproval}
          isBusy={isApproving}
        />
      ) : (
        <>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.9rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
            הזמנות שכבר יצאו בפועל (לפחות פריט אחד נמסר ללקוח) ועדיין נותרת בהן יתרת חוב פתוחה - להבדיל מטאב "חובות פתוחים" שמציג גם הזמנות עתידיות שטרם יצאו.
          </div>
          <DebtsTable
            accentColor="#d97706"
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
            onOpenApproveModal={openApproveModal}
            onUndoApproval={undoDebtApproval}
            isBusy={isApproving}
          />
        </>
      )}
      </div>

      {/* סיכום הרשומות — מוצמד תמיד לתחתית המסך */}
      <div className="page-footer-bar">
        <div className="page-footer-summary">
          {activeTab === 'refunds'
            ? `סה"כ שורות מוצגות: ${loading ? '...' : filteredRefunds.length}`
            : activeTab === 'debts'
            ? `סה"כ שורות מוצגות: ${debtsLoading ? '...' : debts.length}`
            : `סה"כ שורות מוצגות: ${approvedLoading ? '...' : approvedDebts.length}`}
        </div>
      </div>

      {/* מודל אישור תשלום לחובות שנבחרו - עיצוב moc אחיד עם שאר האפליקציה */}
      {confirmModal.open && (
        <div className="moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !isApproving) setConfirmModal({ open: false, orderIds: [], totalAmount: 0 }); }}>
          <div className="moc moc-modal-box" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div className="moc-modal-body" style={{ paddingTop: '28px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'var(--moc-primary-light)', color: 'var(--moc-primary-dark)' }}>
                <ShieldCheck size={26} />
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem' }}>אישור יתרת חוב לתשלום</h3>
              <p style={{ color: 'var(--moc-text-muted)', margin: 0, lineHeight: 1.6 }}>
                מסמן {confirmModal.orderIds.length} {confirmModal.orderIds.length === 1 ? 'הזמנה' : 'הזמנות'} בסך כולל של{' '}
                <strong>₪{confirmModal.totalAmount.toLocaleString()}</strong> כמאושרות לתשלום ע״י מנהל.
              </p>
              <p style={{ color: 'var(--moc-text-muted)', fontSize: '0.85rem', marginTop: '10px', lineHeight: 1.6 }}>
                הפעולה מתעדת אישור מנהל ליתרת החוב ותופיע בהיסטוריית ההזמנה (כמו כל אישור מנהל אחר במערכת). היא אינה יוצרת תשלום בפועל בכרטיס ההזמנה, וניתן לבטל אותה בכל עת.
              </p>
            </div>
            <div className="moc-modal-foot" style={{ justifyContent: 'center' }}>
              <button className="moc-btn moc-btn-outline" disabled={isApproving} onClick={() => setConfirmModal({ open: false, orderIds: [], totalAmount: 0 })}>ביטול</button>
              <button className="moc-btn moc-btn-gold" disabled={isApproving} onClick={confirmApproveSelected}>
                {isApproving ? <><span className="moc-spinner" /> מאשר...</> : <><ShieldCheck size={15} /> אשר תשלום</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
