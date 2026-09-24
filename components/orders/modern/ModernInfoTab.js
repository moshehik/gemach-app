'use client';

import React, { useState, useEffect } from 'react';
import HebrewDatePicker from '../../HebrewDatePicker';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { ChangesChips } from '../../modern/ChangesChips';
import { verifyPin } from './mocAuth';
import { Card, Btn, IconBtn, Chip, Icon, Row, Rows, Empty, Banner } from '../../../app/v3/ui/components';
import { TipWrap } from './orderCardDialogs';
import './orderCardV3.css';

// מיפוי מקומי בלבד מפעולת יומן ל-Chip של v3 — אותה קיבוץ סמנטי כמו ACTION_TONES (משותף):
// הצלחה = navy מלא, ביטול/מחיקה = אפרסק ("תשומת לב"), עדכון = תכלת, ניטרלי = ברירת מחדל.
const ACTION_CHIP_VARIANT = {
  CREATE: 'done',
  DELETE: 'attn',
  UPDATE: 'info',
  CANCEL_RENTAL: 'attn',
  CANCEL_RETURN: 'attn',
  CANCEL_SCAN: 'attn',
  CANCEL_ITEM: 'attn',
  CANCEL_OBLIGATION: 'attn',
  CANCEL_PAYMENT: 'attn',
  CANCEL_ORDER: 'attn',
  CANCEL_CHANGES: 'attn',
  RESTORE_ITEM: 'done',
  RESTORE_OBLIGATION: 'done',
  RESTORE_PAYMENT: 'done',
  CONFIRM_RENTAL: 'done',
  RETURN_RENTAL: 'done',
  DEBT_APPROVED: 'done',
  CANCEL_DEBT_APPROVAL: 'attn'
};
const chipVariantFor = (action) => ACTION_CHIP_VARIANT[action];

/**
 * לשונית "היסטוריה" בעיצוב v3 — כרטיס "בוצעה על ידי" (עם תאריך עברי ועריכת
 * תאריך ביצוע באישור מאשר מוגדר) + היסטוריית שינויים כללית עם חיפוש.
 * הערה: אזור "פיד ההיסטוריה" (מסומן למטה) מיועד להחלפה ע"י משפחת ה-history (HISTORY-DESIGN.md);
 * שאר הקובץ (כרטיס ה"בוצעה על ידי", עריכת התאריך, כפתור העובדים) שייך לכרטיס ההזמנה.
 */
export default function ModernInfoTab({ order, createdDate, onShowEmployees, onOrderDateSave }) {
  const [isEditingOrderDate, setIsEditingOrderDate] = useState(false);
  const [orderDateApproval, setOrderDateApproval] = useState(null);

  // היסטוריה כללית
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams();
        query.append('entityType', 'Order');
        if (order?.orderId) query.append('entityId', order.orderId);
        if (filterSearch) query.append('search', filterSearch);

        const res = await fetch(`/api/audit?${query.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();
        if (!cancelled) setLogs(data.logs || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLogs();
    return () => { cancelled = true; };
  }, [order?.orderId, filterSearch]);

  // עריכת תאריך ההזמנה משפיעה על חישובי זיכוי בביטול — הרשאה רגילה (מי מאשר נקבע
  // ב-/admin/permissions, פריט feature:order_date_edit_approval), לא roleId קשיח של מתכנת.
  // authResult נשמר כדי שיישלח שוב עם השמירה - השרת בודק אותו מחדש (PUT /api/orders/[id]).
  const requestOrderDateEdit = async () => {
    const authResult = await verifyPin('עריכת תאריך ביצוע ההזמנה משפיעה על חישובי זיכוי בביטול. אנא בחר משתמש והזן סיסמה:', 'feature:order_date_edit_approval');
    if (!authResult) return;
    setOrderDateApproval(authResult);
    setIsEditingOrderDate(true);
  };

  const handleOrderDateChange = (date) => {
    setIsEditingOrderDate(false);
    onOrderDateSave(date, orderDateApproval);
  };

  const performedByName = order.employee
    ? `${order.employee.firstName || ''} ${order.employee.lastName || ''}`.trim()
    : 'לא ידוע';

  const dateLabel = createdDate
    ? `${new Date(createdDate).toLocaleDateString('he-IL')} (${getHebrewDateString(createdDate)}) · ${new Date(createdDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : 'לא ידוע';

  return (
    <>
      {/* בוצעה על ידי */}
      <Card
        icon="user"
        title="פרטי הביצוע"
        actions={(
          <TipWrap content="מי עבד במשמרת בזמן ההזמנה">
            <IconBtn icon="users" label="עובדים פעילים בזמן ההזמנה" onClick={onShowEmployees} />
          </TipWrap>
        )}
      >
        <Rows>
          <Row icon="user" label="בוצעה על ידי">{performedByName}</Row>
          <Row
            icon="calendar"
            label="תאריך ושעה"
            tip="שינוי תאריך הביצוע משפיע על חישובי זיכוי בביטול, ולכן דורש אישור."
          >
            {isEditingOrderDate ? (
              <div className="oc-inline-edit">
                <HebrewDatePicker value={order.orderDate} onChange={handleOrderDateChange} />
                <TipWrap content="ביטול העריכה">
                  <IconBtn icon="x" label="ביטול עריכת התאריך" onClick={() => setIsEditingOrderDate(false)} />
                </TipWrap>
              </div>
            ) : (
              <div className="oc-inline-edit">
                <span>{dateLabel}</span>
                <TipWrap content="שינוי תאריך הביצוע (דורש אישור)">
                  <IconBtn icon="edit" label="שינוי תאריך ביצוע ההזמנה" onClick={requestOrderDateEdit} />
                </TipWrap>
              </div>
            )}
          </Row>
        </Rows>
      </Card>

      {/* ===== התחלת אזור פיד ההיסטוריה (להחלפה ע"י משפחת history) ===== */}
      <Card
        icon="history"
        title="היסטוריית שינויים"
        actions={<Chip icon="list"><bdi>{logs.length}</bdi> רשומות</Chip>}
      >
        {/* חיפוש פשוט */}
        <form
          onSubmit={(e) => { e.preventDefault(); setFilterSearch(searchInput); }}
          className="oc-inline-edit"
          role="search"
        >
          <div className="v3-search" style={{ flex: 1, minWidth: 0 }}>
            <Icon name="search" />
            <input
              type="text"
              aria-label="חיפוש בהיסטוריה"
              placeholder="חיפוש בהיסטוריה"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <Btn type="submit" variant="primary" icon="search">חיפוש</Btn>
          {filterSearch && (
            <Btn variant="quiet" icon="x" onClick={() => { setFilterSearch(''); setSearchInput(''); }}>ניקוי</Btn>
          )}
        </form>

        <div style={{ marginTop: 'var(--v3-sp-4)' }}>
          {loading ? (
            <div className="v3-empty" role="status" aria-live="polite">
              <Icon name="loader" size="xl" loop />
              <span>טוענים את ההיסטוריה...</span>
            </div>
          ) : error ? (
            <Banner kind="alert" title={`שגיאה בטעינת היסטוריה: ${error}`} />
          ) : logs.length === 0 ? (
            <Empty icon="history" title="אין עדיין היסטוריה" text="כשיתבצעו שינויים בהזמנה הם יופיעו כאן." />
          ) : (
            <div className="v3-list">
              {logs.map((log) => {
                const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
                const d = new Date(log.createdAt);
                return (
                  <div key={log.id} className="v3-li">
                    <div className="v3-li__ic"><Icon name="history" /></div>
                    <div className="v3-li__body">
                      <span className="v3-li__title">
                        {log.employeeId ? (log.employeeName || 'עובד שנמחק') : 'המערכת'} ביצע/ה: {actionLabel}
                      </span>
                      <span className="v3-li__sub">
                        <bdi>{d.toLocaleDateString('he-IL')}</bdi> ({getHebrewDateString(d)}) · <bdi>{d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</bdi>
                      </span>
                      <ChangesChips changesJson={log.changesJson} />
                    </div>
                    <Chip variant={chipVariantFor(log.action)}>{actionLabel}</Chip>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
      {/* ===== סוף אזור פיד ההיסטוריה ===== */}
    </>
  );
}
