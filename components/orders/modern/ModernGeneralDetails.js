'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mail, ExternalLink, RefreshCw, Edit2, Check, CheckCircle2, X, Phone, MapPin,
  Calendar, AlertTriangle, CalendarClock
} from 'lucide-react';
import HebrewDatePicker from '../../HebrewDatePicker';
import HebrewDateRangePicker from '../../HebrewDateRangePicker';
import CustomerSelector from '../../CustomerSelector';
import { getHebrewDateString } from '../../../lib/hebrewDate';

// אימות עובד/מנהל/מתכנת מול השרת. מחזיר את פרטי המאשר או null אם בוטל/נכשל.
const verifyPin = async (message, level) => {
  const authResult = await window.customAuthPrompt(message, level);
  if (!authResult || !authResult.pin) return null;
  try {
    const res = await fetch('/api/auth/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: level })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'סיסמה שגויה או הרשאה לא מספקת.');
      return null;
    }
    return authResult;
  } catch (err) {
    alert('שגיאה באימות מול השרת.');
    return null;
  }
};

/**
 * טאב "פרטים כלליים" בעיצוב המודרני — כרטיס לקוח + כרטיס אירוע.
 * הלוגיקה פורטה מ-OrderGeneralDetails (עריכת תאריכים, ציפוף באישור מנהל,
 * עריכת תאריך הזמנה למתכנת בלבד) בתוספת: מייל מהיר באישור מנהל והחלפת לקוח מהכרטיס.
 */
export default function ModernGeneralDetails({ order, onOrderChange, onSaveRequest, onQuickEmail }) {
  const [isEditingEvent, setIsEditingEvent] = useState(!order?.eventDate && !order?.fromDate);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerMode, setCustomerMode] = useState('existing');
  const [newCustomer, setNewCustomer] = useState({ firstName: '', lastName: '', phone1: '', email: '', city: '', street: '', houseNum: '' });
  const [isEditingOrderDate, setIsEditingOrderDate] = useState(false);

  const handleChange = (updates) => {
    onOrderChange({ ...order, ...updates });
  };

  const changeDates = (updates) => {
    if (updates.eventDate !== undefined && !updates.eventDateHebrew) {
      updates.eventDateHebrew = updates.eventDate ? getHebrewDateString(updates.eventDate) : null;
    }
    handleChange(updates);
  };

  const isAbroad = !!(order.isAbroad || order.isWeekdayEvent);

  const applyCustomSpacing = async (spacing) => {
    const prevSpacing = (order.customSpacing !== null && order.customSpacing !== undefined) ? order.customSpacing : 3;
    const newSpacing = (spacing !== null && spacing !== undefined) ? spacing : 3;
    // אישור מנהל נדרש רק בפעם הראשונה שמצמצמים מתחת לברירת המחדל (3)
    if (newSpacing < 3 && prevSpacing === 3) {
      const ok = await verifyPin('שינוי ציפוף ימים מותאם אישית דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'מנהל');
      if (!ok) return;
    }
    changeDates({ customSpacing: spacing });
  };

  // עריכת תאריך ההזמנה משפיעה על חלון הזיכוי במנוע התמחור — מוגבלת למתכנת בלבד
  const requestOrderDateEdit = async () => {
    const ok = await verifyPin('עריכת תאריך ההזמנה משפיעה על חישובי זיכוי בביטול ומוגבלת למתכנת. אנא בחר משתמש והזן סיסמה:', 'מתכנת');
    if (!ok) return;
    setIsEditingOrderDate(true);
  };

  const handleOrderDateChange = (date) => {
    setIsEditingOrderDate(false);
    const newOrder = { ...order, orderDate: date };
    onOrderChange(newOrder);
    if (onSaveRequest) onSaveRequest(newOrder);
  };

  const handleQuickEmail = async () => {
    const ok = await verifyPin('שליחת מייל מהיר ללקוח דורשת אישור מנהל. אנא בחר מנהל והזן סיסמה:', 'מנהל');
    if (!ok) return;
    onQuickEmail();
  };

  const toggleSignature = () => {
    const newValue = !order.hasSignedRegulations;
    const newOrder = { ...order, hasSignedRegulations: newValue };
    onOrderChange(newOrder);
    if (onSaveRequest) onSaveRequest(newOrder);
  };

  const selectCustomer = (c) => {
    handleChange({ customerId: c.id, customer: c });
    setShowCustomerModal(false);
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustomer.firstName || !newCustomer.lastName || !newCustomer.phone1 || !newCustomer.email) {
      alert('יש למלא שם פרטי, משפחה, טלפון ודוא"ל');
      return;
    }
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      if (res.ok) {
        const saved = await res.json();
        selectCustomer(saved);
        setNewCustomer({ firstName: '', lastName: '', phone1: '', email: '', city: '', street: '', houseNum: '' });
      } else {
        alert('שגיאה בשמירת לקוח');
      }
    } catch (e) {
      alert('שגיאה בשמירת לקוח');
    }
  };

  const customer = order.customer;
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') : 'לא נבחר לקוח';
  const initials = customer ? `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}` : '?';
  const address = customer ? [customer.street && `${customer.street} ${customer.houseNum || ''}`.trim(), customer.city].filter(Boolean).join(', ') : '';

  const eventSubLabel = isAbroad
    ? (order.fromDate ? `${new Date(order.fromDate).toLocaleDateString('he-IL')} — ${order.toDate || order.returnDate ? new Date(order.toDate || order.returnDate).toLocaleDateString('he-IL') : '?'}` : 'טרם נבחרו תאריכים')
    : (order.eventDate ? `${new Date(order.eventDate).toLocaleDateString('he-IL')} · ${order.eventDateHebrew || getHebrewDateString(order.eventDate)}` : 'טרם נבחר תאריך');

  const orderDateStr = order.orderDate
    ? `${new Date(order.orderDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.orderDate)})`
    : 'לא ידוע';

  const timeOf = (dateStr) => dateStr ? new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';

  const setTime = (field, dateStr, timeVal, alsoReturnDate = false) => {
    const [hours, minutes] = timeVal.split(':');
    if (!hours || !minutes) return;
    const newDate = new Date(dateStr);
    newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    const updates = { [field]: newDate.toISOString() };
    if (alsoReturnDate) updates.returnDate = newDate.toISOString();
    changeDates(updates);
  };

  return (
    <>
      <div className="moc-grid-2">
        {/* ===== כרטיס לקוח ===== */}
        <div className="moc-card-panel moc-detail-card">
          <div className="moc-panel-head">
            <div className="moc-title-row">
              <div className="moc-avatar-chip lg">{initials}</div>
              <div>
                <span className="moc-lbl">{customerName}</span>
                <div className="moc-sub-lbl">פרטי לקוח</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="moc-btn moc-btn-outline moc-btn-icon" title="שליחת מייל מהיר (באישור מנהל)" onClick={handleQuickEmail}>
                <Mail size={16} />
              </button>
              {customer?.id && (
                <Link href={`/customers/${customer.id}`} target="_blank" title="מעבר לכרטיס לקוח"
                  className="moc-btn moc-btn-outline moc-btn-icon" style={{ textDecoration: 'none' }}>
                  <ExternalLink size={16} />
                </Link>
              )}
              <button className="moc-btn moc-btn-outline moc-btn-icon" title="החלף לקוח" onClick={() => setShowCustomerModal(true)}>
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="moc-detail-rows">
            {customer?.phone1 && (
              <div className="moc-detail-row"><span>{customer.phone1}</span><Phone size={15} /></div>
            )}
            {customer?.phone2 && (
              <div className="moc-detail-row"><span>{customer.phone2}</span><Phone size={15} /></div>
            )}
            {customer?.email && (
              <div className="moc-detail-row"><span style={{ direction: 'ltr' }}>{customer.email}</span><Mail size={15} /></div>
            )}
            {address && (
              <div className="moc-detail-row plain"><MapPin size={15} /><span>{address}</span></div>
            )}
            {!customer && (
              <div className="moc-empty-state" style={{ padding: '14px 0' }}>לא נבחר לקוח להזמנה — לחץ על ⟳ לבחירה</div>
            )}
          </div>

          <button className={`moc-sign-status-pill ${order.hasSignedRegulations ? 'yes' : 'no'}`} onClick={toggleSignature}>
            {order.hasSignedRegulations
              ? <><CheckCircle2 size={16} /> חתם על תקנון השכרה</>
              : <><X size={16} /> לא חתם על תקנון</>}
          </button>
        </div>

        {/* ===== כרטיס אירוע ===== */}
        <div className="moc-card-panel moc-detail-card">
          <div className="moc-panel-head">
            <div className="moc-title-row">
              <div className="moc-avatar-chip lg"><Calendar size={19} /></div>
              <div>
                <span className="moc-lbl">פרטי אירוע</span>
                <div className="moc-sub-lbl">{eventSubLabel}</div>
              </div>
            </div>
            <button className="moc-btn moc-btn-outline moc-btn-icon" title={isEditingEvent ? 'סיים עריכה' : 'ערוך פרטים'} onClick={() => setIsEditingEvent(!isEditingEvent)}>
              {isEditingEvent ? <Check size={16} /> : <Edit2 size={16} />}
            </button>
          </div>

          <div style={{ margin: '14px 0' }}>
            <div className="moc-toggle-pair">
              <button
                className={`moc-opt ${!isAbroad ? 'active' : ''}`}
                onClick={() => {
                  if (!isAbroad) return;
                  // חזרה לאירוע רגיל — מנקים את טווח התאריכים ואת תאריך ההחזרה שנקבע ממנו
                  changeDates({ isAbroad: false, isWeekdayEvent: false, fromDate: null, toDate: null, returnDate: null });
                  setIsEditingEvent(true);
                }}
              >
                אירוע רגיל
              </button>
              <button
                className={`moc-opt ${isAbroad ? 'active' : ''}`}
                onClick={() => {
                  if (isAbroad) return;
                  // מעבר לאירוע חו"ל — עוברים לטווח תאריכים במקום תאריך בודד
                  changeDates({ isAbroad: true, isWeekdayEvent: false, eventDate: null, eventDateHebrew: null });
                  setIsEditingEvent(true);
                }}
              >
                אירוע חו"ל
              </button>
            </div>
          </div>

          {isEditingEvent ? (
            <div style={{ marginBottom: '14px' }}>
              {!isAbroad ? (
                <div>
                  <span className="moc-field-label">תאריך אירוע</span>
                  <HebrewDatePicker value={order.eventDate} onChange={(date) => changeDates({ eventDate: date })} />
                </div>
              ) : (
                <div>
                  <span className="moc-field-label">טווח תאריכים (לקיחה והחזרה)</span>
                  <HebrewDateRangePicker
                    startDate={order.fromDate}
                    endDate={order.toDate || order.returnDate}
                    onChange={(start, end) => {
                      // הבורר מחזיר תאריך בלבד; משמרים את שעת היום שנבחרה קודם
                      const applyTime = (newDateStr, prevDateStr) => {
                        if (!newDateStr) return newDateStr;
                        const d = new Date(newDateStr);
                        const prev = prevDateStr ? new Date(prevDateStr) : null;
                        const ref = (prev && !isNaN(prev.getTime())) ? prev : new Date();
                        d.setHours(ref.getHours(), ref.getMinutes(), 0, 0);
                        return d.toISOString();
                      };
                      const newFrom = applyTime(start, order.fromDate);
                      const newTo = applyTime(end, order.toDate || order.returnDate);
                      changeDates({ fromDate: newFrom, toDate: newTo, returnDate: newTo, eventDate: newFrom });
                    }}
                  />
                  <div className="moc-grid-2" style={{ marginTop: '10px' }}>
                    {order.fromDate && (
                      <div>
                        <span className="moc-field-label">שעת לקיחה</span>
                        <input type="time" value={timeOf(order.fromDate)} onChange={(e) => setTime('fromDate', order.fromDate, e.target.value)} />
                      </div>
                    )}
                    {(order.toDate || order.returnDate) && (
                      <div>
                        <span className="moc-field-label">שעת החזרה</span>
                        <input type="time" value={timeOf(order.toDate || order.returnDate)} onChange={(e) => setTime('toDate', order.toDate || order.returnDate, e.target.value, true)} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div style={{ marginBottom: '12px' }}>
            <span className="moc-field-label">הערות להזמנה</span>
            {isEditingEvent ? (
              <textarea
                rows={3}
                value={order.notes || ''}
                onChange={(e) => handleChange({ notes: e.target.value })}
                placeholder="הערות כלליות לגבי ההזמנה..."
              />
            ) : (
              <div className="moc-notes-box">{order.notes || 'אין הערות'}</div>
            )}
          </div>

          <div className="moc-detail-row plain" style={{ fontSize: '0.9rem', color: 'var(--moc-text-muted)', gap: '6px' }}>
            <CalendarClock size={14} />
            <span>תאריך הזמנה: <strong style={{ color: 'var(--moc-text-main)' }}>{orderDateStr}</strong></span>
            {isEditingOrderDate ? (
              <span style={{ minWidth: '180px', display: 'inline-block' }}>
                <HebrewDatePicker value={order.orderDate} onChange={handleOrderDateChange} />
              </span>
            ) : (
              <button className="moc-btn moc-btn-outline moc-btn-icon" style={{ width: '26px', height: '26px' }}
                title="ערוך תאריך הזמנה (מתכנת בלבד)" onClick={requestOrderDateEdit}>
                <Edit2 size={12} />
              </button>
            )}
          </div>

          <div className="moc-spacing-note">
            <div className="moc-spacing-note-head">
              <span className="moc-spacing-note-label"><AlertTriangle size={15} /> ציפוף ימים מיוחד</span>
              <select
                value={order.customSpacing !== null && order.customSpacing !== undefined ? order.customSpacing : ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                  if (val !== order.customSpacing) applyCustomSpacing(val);
                }}
              >
                <option value="">רגיל (לפי המערכת)</option>
                <option value="1">1 יום רווח</option>
                <option value="2">2 ימי רווח</option>
                <option value="3">3 ימי רווח</option>
                <option value="4">4 ימי רווח</option>
                <option value="0">ללא רווח כלל (0)</option>
              </select>
            </div>
            <p>דורש הרשאת מנהל · צובע את ההזמנה בצהוב ומשפיע על בדיקת המלאי להזמנה זו בלבד</p>
          </div>
        </div>
      </div>

      {/* ===== מודל החלפת לקוח ===== */}
      {showCustomerModal && (
        <div className="moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCustomerModal(false); }}>
          <div className="moc moc-modal-box wide">
            <div className="moc-modal-head">
              <h3>החלפת לקוח</h3>
              <button className="moc-close-x" onClick={() => setShowCustomerModal(false)}><X size={15} /></button>
            </div>
            <div className="moc-modal-body">
              <div className="moc-toggle-pair" style={{ marginBottom: '16px' }}>
                <button className={`moc-opt ${customerMode === 'existing' ? 'active' : ''}`} onClick={() => setCustomerMode('existing')}>לקוח קיים</button>
                <button className={`moc-opt ${customerMode === 'new' ? 'active' : ''}`} onClick={() => setCustomerMode('new')}>לקוח חדש</button>
              </div>

              {customerMode === 'existing' ? (
                <div>
                  <span className="moc-field-label">חיפוש לקוח</span>
                  <CustomerSelector
                    value={customer}
                    onChange={selectCustomer}
                    placeholder="חפש לקוח לפי שם, טלפון, עיר..."
                  />
                </div>
              ) : (
                <div>
                  <div className="moc-grid-2" style={{ marginBottom: '12px' }}>
                    <div><span className="moc-field-label">שם פרטי *</span><input type="text" value={newCustomer.firstName} onChange={e => setNewCustomer({ ...newCustomer, firstName: e.target.value })} /></div>
                    <div><span className="moc-field-label">שם משפחה *</span><input type="text" value={newCustomer.lastName} onChange={e => setNewCustomer({ ...newCustomer, lastName: e.target.value })} /></div>
                  </div>
                  <div className="moc-grid-2" style={{ marginBottom: '12px' }}>
                    <div><span className="moc-field-label">טלפון *</span><input type="text" style={{ direction: 'ltr' }} value={newCustomer.phone1} onChange={e => setNewCustomer({ ...newCustomer, phone1: e.target.value })} /></div>
                    <div>
                      <span className="moc-field-label">דוא"ל *</span>
                      <input type="email" style={{ direction: 'ltr' }} value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                      {(!newCustomer.email || !newCustomer.email.includes('@')) && (
                        <button className="moc-btn moc-btn-outline" style={{ marginTop: '6px', padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => setNewCustomer(prev => ({ ...prev, email: (prev.email || '') + '@gmail.com' }))}>
                          השלם ל- @gmail.com
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="moc-grid-2" style={{ marginBottom: '12px' }}>
                    <div><span className="moc-field-label">עיר</span><input type="text" value={newCustomer.city} onChange={e => setNewCustomer({ ...newCustomer, city: e.target.value })} /></div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 2 }}><span className="moc-field-label">רחוב</span><input type="text" value={newCustomer.street} onChange={e => setNewCustomer({ ...newCustomer, street: e.target.value })} /></div>
                      <div style={{ flex: 1 }}><span className="moc-field-label">בית</span><input type="text" value={newCustomer.houseNum} onChange={e => setNewCustomer({ ...newCustomer, houseNum: e.target.value })} /></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="moc-modal-foot">
              <button className="moc-btn moc-btn-outline" onClick={() => setShowCustomerModal(false)}>ביטול</button>
              {customerMode === 'new' && (
                <button className="moc-btn moc-btn-gold" onClick={handleSaveNewCustomer}><Check size={15} /> שמור ובחר</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
