'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { verifyPin } from '@/components/orders/modern/mocAuth';
import { cacheNamespace } from '@/app/lib/pageCache';
import { REFUNDS_PAGE_SIZE } from '@/app/lib/prefetchRoutes';
import { V3Page, Btn, Chip, Tabs, Seg, Tip, Dialog, Field, Empty, Row, Rows, Icon } from '@/app/v3/ui/components';
import { useListDialogs, IconAction } from '@/components/lists/listKit';

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
    return <span className="v3-faint v3-text-sm">לא אושר</span>;
  }
  return (
    <div className="v3-stack">
      <Chip variant="done" icon="check">מאושר לתשלום</Chip>
      <Btn
        variant="quiet"
        size="sm"
        icon="refresh"
        onClick={() => onUndo(orderId)}
        disabled={isBusy}
        title="ביטול האישור"
      >
        ביטול האישור
      </Btn>
    </div>
  );
}

// תיבת סימון — צבעים ומידות מ-tokens בלבד
const CHECK_STYLE = { inlineSize: 'var(--v3-sp-5)', blockSize: 'var(--v3-sp-5)', accentColor: 'var(--v3-navy)' };

/** טבלת חובות משותפת לטאב "חובות פתוחים" ולטאב "הזמנות מאושרות ללא תשלום מלא" - שני
 * הטאבים שולפים מ-/api/orders עם filterStatus שונה אבל מוצגים באותו עיצוב/עמודות/פעולות. */
function DebtsTable({
  accentColor, list, loading, hasMore, loadingMore, onLoadMore,
  searchTerm, onSearchTermChange, searchPlaceholder, emptyText,
  approvals, selectedIds, onToggleSelect, onToggleSelectAll, onClearSelection, onOpenApproveModal, onUndoApproval, isBusy
}) {
  const selectableIds = list.filter(o => !approvals[o.orderId]?.isApproved).map(o => o.orderId);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));
  // הרחבת שורה (סכום ההזמנה + ששולם) — מצב תצוגה בלבד
  const [expanded, setExpanded] = useState({});

  return (
    <>
      <div className="v3-filter-bar">
        <div className="v3-search">
          <Icon name="search" />
          <input
            type="text"
            aria-label="חיפוש חוב"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
          <button type="button" className={`v3-search__clear${searchTerm ? ' is-on' : ''}`} aria-label="ניקוי החיפוש" onClick={() => onSearchTermChange('')}>
            <Icon name="x" size="sm" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="v3-empty" aria-busy="true">
          <Icon name="loader" size="xl" loop />
          <b className="v3-h2">טוענים…</b>
        </div>
      ) : (
        <div className="v3-stack">
          <div className="v3-table__wrap">
            <table className="v3-table">
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      style={CHECK_STYLE}
                      checked={allSelected}
                      disabled={selectableIds.length === 0}
                      onChange={() => onToggleSelectAll(selectableIds)}
                      aria-label="בחירת כל ההזמנות"
                      title="בחירת הכל"
                    />
                  </th>
                  <th scope="col">תאריך האירוע</th>
                  <th scope="col">לקוח</th>
                  <th scope="col">הזמנה</th>
                  <th scope="col" style={{ color: accentColor }}>יתרת חוב</th>
                  <th scope="col">אישור מנהל</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <Empty icon="alert-circle" title={emptyText} />
                    </td>
                  </tr>
                ) : (
                  list.map(order => {
                    const debtAmount = (order.totalAmount || 0) - (order.totalPaid || 0);
                    const approval = approvals[order.orderId];
                    const hebrewDate = hebrewDateFor(order);
                    const isOpen = !!expanded[order.orderId];
                    return (
                      <Fragment key={order.orderId}>
                        <tr aria-expanded={isOpen}>
                          <td>
                            {approval?.isApproved ? (
                              <Icon name="check-circle" title="מאושר" />
                            ) : (
                              <input
                                type="checkbox"
                                style={CHECK_STYLE}
                                checked={selectedIds.has(order.orderId)}
                                onChange={() => onToggleSelect(order.orderId)}
                                aria-label={`בחירת הזמנה ${order.orderId}`}
                                title={`בחירת הזמנה #${order.orderId}`}
                              />
                            )}
                          </td>
                          <td>
                            <div>{order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : 'ללא תאריך'}</div>
                            {hebrewDate && <div className="v3-faint v3-text-sm">{hebrewDate}</div>}
                          </td>
                          <td>
                            <div>
                              <Link href={`/customers/${order.customerId}`} className="v3-focusable" style={{ color: 'var(--v3-navy)', fontWeight: 'var(--v3-fw-semi)' }}>
                                {order.customerName || 'לקוח לא ידוע'}
                              </Link>
                            </div>
                            <div className="v3-faint v3-text-sm"><bdi>{order.customerPhone || ''}</bdi></div>
                          </td>
                          <td>
                            <Link href={`/orders/${order.orderId}`} className="v3-chip v3-chip--info">
                              #<bdi>{order.orderId}</bdi>
                              <Icon name="link" size="sm" />
                            </Link>
                          </td>
                          <td style={{ color: accentColor, fontWeight: 'var(--v3-fw-bold)' }}><bdi>₪{debtAmount}</bdi></td>
                          <td>
                            <div className="v3-cluster">
                              <ApprovalCell orderId={order.orderId} approval={approval} onUndo={onUndoApproval} isBusy={isBusy} />
                              <button
                                type="button"
                                className="v3-btn v3-btn--icon v3-btn--sm v3-btn--quiet"
                                aria-expanded={isOpen}
                                aria-label={isOpen ? 'הסתרת פרטי התשלום' : 'הצגת פרטי התשלום'}
                                onClick={() => setExpanded(prev => ({ ...prev, [order.orderId]: !prev[order.orderId] }))}
                              >
                                <Icon name="chevron-down" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={6}>
                              <Rows>
                                <Row label="סכום ההזמנה" icon="card"><bdi>₪{order.totalAmount}</bdi></Row>
                                <Row label="שולם עד כה" icon="check-circle"><bdi>₪{order.totalPaid}</bdi></Row>
                              </Rows>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* סרגל פעולה קבוצתית — מופיע כאשר נבחרו הזמנות לאישור תשלום */}
          {selectedIds.size > 0 && (
            <div className="v3-note v3-note--dashed">
              <div className="v3-cluster">
                <b>{selectedIds.size} {selectedIds.size === 1 ? 'הזמנה נבחרה' : 'הזמנות נבחרו'}</b>
                <Btn size="sm" onClick={onClearSelection}>ביטול הבחירה</Btn>
                <Btn variant="primary" size="sm" icon="shield" disabled={isBusy} onClick={() => onOpenApproveModal(list)}>
                  אישור תשלום ל-<bdi>{selectedIds.size}</bdi>
                </Btn>
              </div>
            </div>
          )}

          <div className="v3-cluster">
            <span className="v3-muted">מוצגות <bdi>{list.length}</bdi> שורות</span>
            {hasMore && (
              <Btn size="sm" iconEnd="chevron-start" loading={loadingMore} onClick={onLoadMore}>
                {loadingMore ? 'טוענים…' : 'טעינת עוד'}
              </Btn>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function RefundsPage() {
  const { confirm: v3Confirm, notify: v3Alert, dialogs } = useListDialogs();
  // הרחבת שורת זיכוי (סיבה, פרטי בנק, אשראי מקורי, אימייל) — מצב תצוגה בלבד
  const [expandedRefunds, setExpandedRefunds] = useState({});
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'executed'
  const [isProcessing, setIsProcessing] = useState(false);
  const [refundsPage, setRefundsPage] = useState(1);
  const [refundsHasMore, setRefundsHasMore] = useState(false);
  const [loadingMoreRefunds, setLoadingMoreRefunds] = useState(false);

  // ייצוא מלא (לא רק מה שנטען בדפדפן) לפי טווח תאריכים+סטטוס, להעברה מסודרת להנה"ח
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [exportStatus, setExportStatus] = useState('all'); // 'all' | 'executed' | 'pending'
  const [isExporting, setIsExporting] = useState(false);

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
    const auth = await verifyPin('אישור תשלום עבור החובות שנבחרו דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'feature:debt_approval');
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
      v3Alert(err.message || 'אישור החובות נכשל.', { title: 'האישור נכשל', icon: 'alert-circle' });
    } finally {
      setIsApproving(false);
    }
  };

  const undoDebtApproval = async (orderId) => {
    if (!(await v3Confirm('אפשר לאשר את החוב שוב בכל רגע.', { title: 'לבטל את אישור החוב?', confirmLabel: 'ביטול האישור', cancelLabel: 'להשאיר מאושר', icon: 'refresh' }))) return;
    const auth = await verifyPin('ביטול אישור חוב דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'feature:debt_approval');
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
      v3Alert(err.message || 'ביטול האישור נכשל.', { title: 'הביטול נכשל', icon: 'alert-circle' });
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
    if (!(await v3Confirm('בכרטיס ההזמנה המקושר ייווצר תשלום הפוך (מינוס) על סכום הזיכוי.', { title: 'לסמן את הזיכוי כבוצע?', confirmLabel: 'סימון כבוצע', icon: 'check-circle' }))) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExecuted: true })
      });

      const updatedRefund = await res.json();
      if (!res.ok) throw new Error(updatedRefund?.error || 'Failed to execute refund');

      setRefunds(prev => prev.map(r => r.id === id ? { ...r, ...updatedRefund } : r));
      v3Alert('הזיכוי סומן כבוצע, וכרטיס ההזמנה התעדכן.', { title: 'הזיכוי בוצע', icon: 'check-circle' });
    } catch (err) {
      v3Alert('סימון הזיכוי נכשל: ' + err.message, { title: 'הפעולה נכשלה', icon: 'alert-circle' });
    } finally {
      setIsProcessing(false);
    }
  };

  const undoExecuteRefund = async (id) => {
    if (!(await v3Confirm('הזיכוי יחזור למצב "ממתין", ותנועת ההחזר תימחק מכרטיס ההזמנה.', { title: 'לבטל את סימון הביצוע?', confirmLabel: 'ביטול הסימון', cancelLabel: 'להשאיר כבוצע', icon: 'refresh' }))) {
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
      v3Alert('סימון הביצוע בוטל, וכרטיס ההזמנה התעדכן.', { title: 'הסימון בוטל', icon: 'refresh' });
    } catch (err) {
      v3Alert('ביטול הסימון נכשל: ' + err.message, { title: 'הפעולה נכשלה', icon: 'alert-circle' });
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelRefund = async (id) => {
    const refund = refunds.find(r => r.id === id);
    const confirmMessage = refund?.isExecuted
      ? 'הזיכוי כבר בוצע, ורשום תשלום הפוך בכרטיס ההזמנה. מחיקת הבקשה תמחק גם את תנועת ההחזר משם. להמשיך?'
      : 'בקשת הזיכוי תימחק לגמרי.';
    if (!(await v3Confirm(confirmMessage, { title: 'למחוק את בקשת הזיכוי?', confirmLabel: 'מחיקת הבקשה', cancelLabel: 'להשאיר', danger: true }))) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to cancel refund');

      setRefunds(prev => prev.filter(r => r.id !== id));
      v3Alert('בקשת הזיכוי נמחקה.', { title: 'הבקשה נמחקה', icon: 'trash' });
    } catch (err) {
      v3Alert('מחיקת הבקשה נכשלה: ' + err.message, { title: 'הפעולה נכשלה', icon: 'alert-circle' });
    } finally {
      setIsProcessing(false);
    }
  };

  const buildRefundsCSV = (rows) => {
    const headers = ['תאריך בקשה', 'לקוח', 'טלפון', 'מייל', 'מספר הזמנה', 'סכום לזיכוי', 'סיבה', 'בנק', 'סניף', 'חשבון', 'שם בעל החשבון', 'פרטי אשראי מקורי', 'סטטוס', 'תאריך ביצוע'];
    return [
      headers.join(','),
      ...rows.map(r => {
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
  };

  const downloadCSV = (csvData) => {
    const blob = new Blob(['﻿' + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `refunds_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ייצוא מלא לפי טווח תאריכים+סטטוס שנבחרו במודל - שולף מהשרת את כל השורות
  // התואמות (export=true, ללא הגבלת limit/page), ולא רק את מה שכבר נטען בדפדפן.
  const runFullExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ export: 'true' });
      if (exportFromDate) params.set('fromDate', exportFromDate);
      if (exportToDate) params.set('toDate', exportToDate);
      if (exportStatus !== 'all') params.set('status', exportStatus);
      const res = await fetch(`/api/refunds?${params.toString()}`);
      const json = await res.json();
      downloadCSV(buildRefundsCSV(json.data || []));
      setShowExportModal(false);
    } catch (err) {
      v3Alert('הייצוא נכשל: ' + err.message, { title: 'הייצוא נכשל', icon: 'alert-circle' });
    } finally {
      setIsExporting(false);
    }
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

  const closeApproveModal = () => setConfirmModal({ open: false, orderIds: [], totalAmount: 0 });

  return (
    <V3Page>
      <div className="v3-stack">
        <div className="v3-pagehead">
          <div className="v3-pagehead__title">
            <h1 className="v3-h1">זיכויים וחובות</h1>
          </div>
          <div className="v3-pagehead__tools">
            {activeTab === 'refunds' && (
              <IconAction icon="download" label="ייצוא זיכויים לקובץ" onClick={() => setShowExportModal(true)} />
            )}
          </div>
        </div>

        <div className="v3-cluster">
          <Tabs
            items={[
              { key: 'refunds', label: 'זיכויים', icon: 'coin' },
              { key: 'debts', label: 'חובות פתוחים', icon: 'alert-circle' },
              { key: 'approved', label: 'יצאו וטרם שולמו', icon: 'shield' },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            label="חלקי העמוד"
          />
          <Tip label="מה כל לשונית מציגה">
            זיכויים: בקשות להחזר כסף ללקוחות. חובות פתוחים: כל הזמנה עם יתרה לתשלום, גם אירועים עתידיים. יצאו וטרם שולמו: רק הזמנות שכבר יצאו בפועל (לפחות פריט אחד נמסר) ועדיין יש בהן חוב.
          </Tip>
        </div>

        {activeTab === 'refunds' && (
          <>
            <div className="v3-filter-bar">
              <div className="v3-search">
                <Icon name="search" />
                <input
                  type="text"
                  aria-label="חיפוש זיכוי"
                  placeholder="שם לקוח, טלפון, הזמנה או סכום…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button type="button" className={`v3-search__clear${searchTerm ? ' is-on' : ''}`} aria-label="ניקוי החיפוש" onClick={() => setSearchTerm('')}>
                  <Icon name="x" size="sm" />
                </button>
              </div>
              <Seg
                label="סינון לפי מצב"
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: 'all', label: 'הכל' },
                  { value: 'pending', label: 'ממתינים', icon: 'clock' },
                  { value: 'executed', label: 'בוצעו', icon: 'check' },
                ]}
              />
            </div>

            {loading ? (
              <div className="v3-empty" aria-busy="true">
                <Icon name="loader" size="xl" loop />
                <b className="v3-h2">טוענים…</b>
              </div>
            ) : (
              <div className="v3-stack">
                <div className="v3-table__wrap">
                  <table className="v3-table">
                    <thead>
                      <tr>
                        <th scope="col">תאריך</th>
                        <th scope="col">לקוח</th>
                        <th scope="col">הזמנה</th>
                        <th scope="col">סכום</th>
                        <th scope="col">מצב</th>
                        <th scope="col"><span className="v3-sr">פעולות</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRefunds.length === 0 ? (
                        <tr>
                          <td colSpan={6}>
                            <Empty icon="search" title="לא נמצאו זיכויים מתאימים" />
                          </td>
                        </tr>
                      ) : (
                        filteredRefunds.map(refund => {
                          const isOpen = !!expandedRefunds[refund.id];
                          return (
                            <Fragment key={refund.id}>
                              <tr aria-expanded={isOpen}>
                                <td>
                                  <div>{new Date(refund.createdAt).toLocaleDateString('he-IL')}</div>
                                  {refund.isExecuted && <div className="v3-faint v3-text-sm">בוצע ב-{new Date(refund.executionDate).toLocaleDateString('he-IL')}</div>}
                                </td>
                                <td>
                                  <div>
                                    <Link href={`/customers/${refund.customerId}`} className="v3-focusable" style={{ color: 'var(--v3-navy)', fontWeight: 'var(--v3-fw-semi)' }}>
                                      {refund.customer ? `${refund.customer.firstName || ''} ${refund.customer.lastName || ''}`.trim() : 'לקוח לא ידוע'}
                                    </Link>
                                  </div>
                                  <div className="v3-faint v3-text-sm"><bdi>{refund.customer?.phone1}</bdi></div>
                                </td>
                                <td>
                                  {refund.orderId ? (
                                    <Link href={`/orders/${refund.orderId}`} className="v3-chip v3-chip--info">
                                      #<bdi>{refund.orderId}</bdi>
                                      <Icon name="link" size="sm" />
                                    </Link>
                                  ) : '-'}
                                </td>
                                <td style={{ color: 'var(--v3-plum)', fontWeight: 'var(--v3-fw-bold)' }}><bdi>₪{refund.amount}</bdi></td>
                                <td>
                                  <Chip variant={refund.isExecuted ? 'done' : 'attn'} icon={refund.isExecuted ? 'check-circle' : 'clock'}>
                                    {refund.isExecuted ? 'בוצע' : 'ממתין לביצוע'}
                                  </Chip>
                                </td>
                                <td>
                                  <div className="v3-cluster">
                                    {!refund.isExecuted && (
                                      <button type="button" className="v3-btn v3-btn--icon v3-btn--sm" onClick={() => executeRefund(refund.id)} disabled={isProcessing} title="סימון כבוצע" aria-label="סימון הזיכוי כבוצע">
                                        <Icon name="check-circle" />
                                      </button>
                                    )}
                                    {refund.isExecuted && (
                                      <button type="button" className="v3-btn v3-btn--icon v3-btn--sm" onClick={() => undoExecuteRefund(refund.id)} disabled={isProcessing} title="ביטול הביצוע" aria-label="ביטול סימון הביצוע">
                                        <Icon name="refresh" />
                                      </button>
                                    )}
                                    <button type="button" className="v3-btn v3-btn--icon v3-btn--sm v3-btn--danger" onClick={() => cancelRefund(refund.id)} disabled={isProcessing} title="מחיקת הבקשה" aria-label="מחיקת בקשת הזיכוי">
                                      <Icon name="x-circle" />
                                    </button>
                                    <button
                                      type="button"
                                      className="v3-btn v3-btn--icon v3-btn--sm v3-btn--quiet"
                                      aria-expanded={isOpen}
                                      aria-label={isOpen ? 'הסתרת פרטים נוספים' : 'הצגת פרטים נוספים'}
                                      onClick={() => setExpandedRefunds(prev => ({ ...prev, [refund.id]: !prev[refund.id] }))}
                                    >
                                      <Icon name="chevron-down" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {isOpen && (
                                <tr>
                                  <td colSpan={6}>
                                    <Rows>
                                      <Row label="סיבת הזיכוי" icon="file">{refund.reason ? refund.reason : <span className="v3-faint">-</span>}</Row>
                                      {refund.email && <Row label="אימייל" icon="mail"><bdi>{refund.email}</bdi></Row>}
                                      <Row label="פרטי הבנק" icon="card">
                                        {refund.bankName || refund.bankAccount ? (
                                          <>
                                            <div>{refund.bankName || 'שם הבנק חסר'} {refund.bankBranch ? <>(סניף <bdi>{refund.bankBranch}</bdi>)</> : ''}</div>
                                            <div><b><bdi>{refund.bankAccount || 'מספר חשבון חסר'}</bdi></b></div>
                                            {refund.bankAccountName && <div className="v3-faint">{refund.bankAccountName}</div>}
                                          </>
                                        ) : (
                                          <span className="v3-faint">לא הוזנו</span>
                                        )}
                                      </Row>
                                      <Row label="אשראי מקורי" icon="card">
                                        {refund.paymentDetails ? refund.paymentDetails : <span className="v3-faint">-</span>}
                                      </Row>
                                    </Rows>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="v3-cluster">
                  <span className="v3-muted">מוצגות <bdi>{filteredRefunds.length}</bdi> שורות</span>
                  {refundsHasMore && (
                    <Btn size="sm" iconEnd="chevron-start" loading={loadingMoreRefunds} onClick={loadMoreRefunds}>
                      {loadingMoreRefunds ? 'טוענים…' : 'זיכויים ישנים יותר'}
                    </Btn>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'debts' && (
          <DebtsTable
            accentColor="var(--v3-plum)"
            list={debts}
            loading={debtsLoading}
            hasMore={debtsHasMore}
            loadingMore={loadingMoreDebts}
            onLoadMore={() => loadDebts(debtsPage + 1, debtsSearchTerm, { append: true })}
            searchTerm={debtsSearchTerm}
            onSearchTermChange={setDebtsSearchTerm}
            searchPlaceholder="שם לקוח, טלפון או מספר הזמנה…"
            emptyText="לא נמצאו חובות מתאימים"
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
          <DebtsTable
            accentColor="var(--v3-rose-700)"
            list={approvedDebts}
            loading={approvedLoading}
            hasMore={approvedHasMore}
            loadingMore={loadingMoreApproved}
            onLoadMore={() => loadApprovedDebts(approvedPage + 1, approvedSearchTerm, { append: true })}
            searchTerm={approvedSearchTerm}
            onSearchTermChange={setApprovedSearchTerm}
            searchPlaceholder="שם לקוח, טלפון או מספר הזמנה…"
            emptyText="אין הזמנות שיצאו ועדיין יש בהן חוב"
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
      </div>

      {/* אישור תשלום לחובות שנבחרו — חלונית אישור (בלי שדות): תומכת בכהה/בהיר */}
      <Dialog
        open={confirmModal.open}
        variant="confirm"
        icon="shield"
        title="לאשר את יתרות החוב?"
        sub={(
          <>
            {confirmModal.orderIds.length} {confirmModal.orderIds.length === 1 ? 'הזמנה' : 'הזמנות'} בסך כולל של{' '}
            <b><bdi>₪{confirmModal.totalAmount.toLocaleString()}</bdi></b> יסומנו כמאושרות לתשלום על ידי מנהל.{' '}
            <Tip label="מה האישור עושה">
              האישור נרשם בהיסטוריית ההזמנה כמו כל אישור מנהל. הוא לא יוצר תשלום בכרטיס ההזמנה, ואפשר לבטל אותו בכל עת.
            </Tip>
          </>
        )}
        closeOnScrim={!isApproving}
        onClose={() => { if (!isApproving) closeApproveModal(); }}
        actions={(
          <>
            <Btn variant="primary" icon="shield" loading={isApproving} data-autofocus onClick={confirmApproveSelected}>{isApproving ? 'מאשרים…' : 'אישור התשלום'}</Btn>
            <Btn variant="quiet" disabled={isApproving} onClick={closeApproveModal}>ביטול</Btn>
          </>
        )}
      />

      {/* ייצוא זיכויים — חלונית עם שדות = בהיר בלבד. שולף מהשרת את כל הטווח (לא רק מה שנטען בדפדפן) */}
      <Dialog
        open={showExportModal}
        variant="form"
        icon="download"
        title="ייצוא זיכויים להנהלת החשבונות"
        closeOnScrim={!isExporting}
        onClose={() => { if (!isExporting) setShowExportModal(false); }}
        actions={(
          <>
            <Btn variant="primary" icon="download" loading={isExporting} onClick={runFullExport}>{isExporting ? 'מייצאים…' : 'ייצוא לקובץ'}</Btn>
            <Btn variant="quiet" disabled={isExporting} onClick={() => setShowExportModal(false)}>ביטול</Btn>
          </>
        )}
      >
        <div className="v3-stack">
          <Tip label="על הייצוא">
            הייצוא מביא את כל הזיכויים המתאימים ישירות מהשרת, לא רק את מה שנטען בעמוד. אפשר להשאיר את התאריכים ריקים כדי לייצא הכול.
          </Tip>
          <Field label="מתאריך" type="date" value={exportFromDate} onChange={(e) => setExportFromDate(e.target.value)} />
          <Field label="עד תאריך" type="date" value={exportToDate} onChange={(e) => setExportToDate(e.target.value)} />
          <Field label="מצב הזיכוי" as="select" value={exportStatus} onChange={(e) => setExportStatus(e.target.value)}>
            <option value="all">הכל</option>
            <option value="executed">רק שבוצעו</option>
            <option value="pending">רק ממתינים</option>
          </Field>
        </div>
      </Dialog>

      {dialogs}
    </V3Page>
  );
}
