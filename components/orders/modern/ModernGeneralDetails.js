'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Mail, ExternalLink, Edit2, Check, CheckCircle2, X,
  Calendar, AlertTriangle, CalendarClock
} from 'lucide-react';
import HebrewDatePicker from '../../HebrewDatePicker';
import HebrewDateRangePicker from '../../HebrewDateRangePicker';
import CustomerSelector from '../../CustomerSelector';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { verifyPin } from './mocAuth';
import { fetchSharedJson, TTL } from '../../../lib/apiCache';

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
  const [systemDefaultSpacing, setSystemDefaultSpacing] = useState(3);

  React.useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        const arr = Array.isArray(data) ? data : Object.entries(data || {}).map(([key, value]) => ({ key, value }));
        const setting = arr.find(s => s.key === 'inventory_buffer_days');
        if (setting && !isNaN(parseInt(setting.value, 10))) setSystemDefaultSpacing(parseInt(setting.value, 10));
      })
      .catch(() => {});
  }, []);

  // כל עדכון להזמנה עובר כפונקציה (prev => ...) ולא כאובייקט מלא — updates מתמזג תמיד
  // עם הגרסה העדכנית ביותר של ההזמנה, כדי לא לדרוס שינויים שקרו בזמן המתנה ל-PIN
  // (למשל applyCustomSpacing למטה, שממתין לאישור מנהל לפני הכתיבה בפועל).
  const handleChange = (updates) => {
    onOrderChange(prev => ({ ...prev, ...updates }));
  };

  const changeDates = (updates) => {
    if (updates.eventDate !== undefined && !updates.eventDateHebrew) {
      updates.eventDateHebrew = updates.eventDate ? getHebrewDateString(updates.eventDate) : null;
    }
    handleChange(updates);
  };

  const isAbroad = !!(order.isAbroad || order.isWeekdayEvent);

  const applyCustomSpacing = async (spacing) => {
    const prevSpacing = (order.customSpacing !== null && order.customSpacing !== undefined) ? order.customSpacing : systemDefaultSpacing;
    const newSpacing = (spacing !== null && spacing !== undefined) ? spacing : systemDefaultSpacing;
    // אישור מנהל נדרש בכל צמצום בפועל של הציפוף — לא רק בפעם הראשונה מברירת המחדל.
    // בלי זה, אחרי אישור אחד אפשר היה להמשיך ולהקטין עוד ועוד (למשל מ-1 ל-0) בלי אישור נוסף.
    if (newSpacing < prevSpacing) {
      const ok = await verifyPin('שינוי ציפוף ימים מותאם אישית דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'מנהל');
      if (!ok) return;
    }
    // ערך זהה לברירת המחדל של המערכת שקול ל"ללא ציפוף מותאם" — לא נשמר כערך מפורש,
    // אחרת הבאנר ממשיך להיות מוצג גם כשבפועל אין שום ציפוף מיוחד
    const valueToStore = (spacing !== null && spacing !== undefined && spacing === systemDefaultSpacing) ? null : spacing;
    changeDates({ customSpacing: valueToStore });
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

  // רק סוג האירוע — התאריכים עצמם מוצגים בשדה שמתחת (בלי כפילות)
  const eventSubLabel = isAbroad ? 'אירוע חו"ל' : 'אירוע רגיל';

  // טווח תאריכים (חו"ל): תאריך עברי בלבד — בלי לועזי ובלי שעה
  const fmtFullDate = (d0) => {
    if (!d0) return null;
    const d = new Date(d0);
    if (isNaN(d.getTime())) return null;
    return getHebrewDateString(d);
  };

  const orderDateStr = order.orderDate
    ? `${new Date(order.orderDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.orderDate)})`
    : 'לא ידוע';

  // ציר ימי הרווח (ציפוף) — משמש גם בפאנל העריכה וגם כאינדיקציה במצב קריאה.
  // הטווח נגזר מברירת המחדל של המערכת (inventory_buffer_days) ולא מקובע — כולל תמיד
  // כמה ימים מעבר לברירת המחדל, כדי שיהיה אפשר גם להרחיב את הציפוף ולא רק לצמצם אותו.
  const hasCustomSpacing = order.customSpacing !== null && order.customSpacing !== undefined;
  const selectedSpacing = hasCustomSpacing ? order.customSpacing : null;
  const maxAxisDay = Math.max(systemDefaultSpacing + 2, selectedSpacing !== null ? selectedSpacing : 0, 4);
  const axisDays = Array.from({ length: maxAxisDay + 1 }, (_, i) => i);
  const spacingNoteNode = (
    <div className="moc-spacing-note" style={{ marginBottom: !isEditingEvent ? '16px' : undefined }}>
      <div className="moc-spacing-note-head">
        <span className="moc-spacing-note-label"><AlertTriangle size={15} /> ציפוף ימים מיוחד</span>
        <button
          className={`moc-pill-toggle ${!hasCustomSpacing ? 'on' : ''}`}
          onClick={() => { if (hasCustomSpacing) applyCustomSpacing(null); }}
          title="חזרה לרווח הרגיל של המערכת"
        >
          {!hasCustomSpacing && <Check size={13} />} רגיל (לפי המערכת — {systemDefaultSpacing} ימים)
        </button>
      </div>

      <div className="moc-days-axis">
        {axisDays.map((d, i) => (
          <React.Fragment key={d}>
            {i > 0 && <div className={`moc-day-connector ${selectedSpacing !== null && selectedSpacing >= d ? 'passed' : ''}`} />}
            <button
              className={`moc-day-stop ${selectedSpacing === d ? 'selected' : ''}`}
              title={d === 0 ? 'ללא רווח כלל' : `${d} ימי רווח בין השכרות`}
              onClick={() => { if (selectedSpacing !== d) applyCustomSpacing(d); }}
            >
              {d}
              {d === 0 && <span className="moc-day-caption">ללא רווח</span>}
              {d === systemDefaultSpacing && <span className="moc-day-caption">ברירת מחדל</span>}
            </button>
          </React.Fragment>
        ))}
      </div>

      <p>דורש הרשאת מנהל · צובע את ההזמנה בצהוב ומשפיע על בדיקת המלאי להזמנה זו בלבד</p>
    </div>
  );

  return (
    <>
      <div className="moc-card-panel moc-detail-card" style={{ padding: '6px 20px 16px' }}>
        {/* לקוח — שורה קומפקטית */}
        <div className="moc-compact-row">
          <div className="moc-avatar-chip">{initials}</div>
          <div className="moc-cr-main">
            <div className="moc-cr-title">{customerName}</div>
            <div className="moc-cr-sub" title={customer ? [customer.phone1, customer.phone2, customer.email, address].filter(Boolean).join(' · ') : ''}>
              {customer
                ? ([customer.phone1, customer.phone2, customer.email, address].filter(Boolean).join(' · ') || 'אין פרטי קשר')
                : 'לא נבחר לקוח — לחץ על אייקון העריכה לבחירה'}
            </div>
          </div>
          <div className="moc-cr-actions">
            <button
              className={`moc-sign-status-pill ${order.hasSignedRegulations ? 'yes' : 'no'}`}
              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              onClick={toggleSignature}
              title="סטטוס חתימה על תקנון — לחץ לשינוי"
            >
              {order.hasSignedRegulations ? <><CheckCircle2 size={14} /> חתם על תקנון</> : <><X size={14} /> לא חתם</>}
            </button>
            <button className="moc-icon-btn-plain" title="שליחת מייל מהיר (באישור מנהל)" onClick={handleQuickEmail}>
              <Mail size={16} />
            </button>
            {customer?.id && (
              <Link href={`/customers/${customer.id}`} target="_blank" title="מעבר לכרטיס לקוח"
                className="moc-icon-btn-plain" style={{ textDecoration: 'none' }}>
                <ExternalLink size={16} />
              </Link>
            )}
            <button className="moc-icon-btn-plain" title="החלפת לקוח" onClick={() => setShowCustomerModal(true)}>
              <Edit2 size={16} />
            </button>
          </div>
        </div>

        {/* אירוע — שורה קומפקטית */}
        <div className="moc-compact-row">
          <div className="moc-avatar-chip"><Calendar size={17} /></div>
          <div className="moc-cr-main">
            <div className="moc-cr-title">{eventSubLabel}</div>
            <div className="moc-cr-sub" style={{ whiteSpace: 'normal' }}>
              {isAbroad
                ? (order.fromDate
                  ? <>לקיחה: <strong>{fmtFullDate(order.fromDate)}</strong> · החזרה: <strong>{fmtFullDate(order.toDate || order.returnDate) || '?'}</strong></>
                  : 'טרם נבחרו תאריכים')
                : (order.eventDate
                  ? <strong>{`${new Date(order.eventDate).toLocaleDateString('he-IL')} (${order.eventDateHebrew || getHebrewDateString(order.eventDate)})`}</strong>
                  : 'טרם נבחר תאריך')}
              {!isEditingEvent && order.notes ? <> · הערות: {order.notes}</> : null}
            </div>
          </div>
          <div className="moc-cr-actions">
            <button className="moc-icon-btn-plain" title={isEditingEvent ? 'סיים עריכה' : 'עריכת פרטי אירוע'} onClick={() => setIsEditingEvent(!isEditingEvent)}>
              {isEditingEvent ? <Check size={16} /> : <Edit2 size={16} />}
            </button>
          </div>
        </div>

        {/* פאנל עריכת אירוע — נפתח מאייקון העריכה */}
        {isEditingEvent && (
          <div className="moc-edit-box" style={{ margin: '2px 0 10px' }}>
            <div className="moc-toggle-pair" style={{ alignSelf: 'flex-start' }}>
              <button
                className={`moc-opt ${!isAbroad ? 'active' : ''}`}
                onClick={() => {
                  if (!isAbroad) return;
                  // חזרה לאירוע רגיל — מנקים את טווח התאריכים ואת תאריך ההחזרה שנקבע ממנו
                  changeDates({ isAbroad: false, isWeekdayEvent: false, fromDate: null, toDate: null, returnDate: null });
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
                }}
              >
                אירוע חו"ל
              </button>
            </div>

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
              </div>
            )}

            <div>
              <span className="moc-field-label">הערות להזמנה</span>
              <textarea
                rows={3}
                value={order.notes || ''}
                onChange={(e) => handleChange({ notes: e.target.value })}
                placeholder="הערות כלליות לגבי ההזמנה..."
              />
            </div>

            {spacingNoteNode}
          </div>
        )}

        {/* ציפוף מוגדר — אינדיקציה גם במצב קריאה */}
        {!isEditingEvent && hasCustomSpacing && spacingNoteNode}

        {/* תאריך ביצוע ההזמנה — שורה קומפקטית */}
        <div className="moc-compact-row" style={{ paddingBottom: 0 }}>
          <div className="moc-avatar-chip"><CalendarClock size={16} /></div>
          <div className="moc-cr-main">
            <div className="moc-cr-sub" style={{ whiteSpace: 'normal' }}>
              תאריך ביצוע ההזמנה: <strong style={{ color: 'var(--moc-text-main)' }}>{orderDateStr}</strong>
            </div>
          </div>
          <div className="moc-cr-actions">
            {isEditingOrderDate ? (
              <span style={{ minWidth: '190px', display: 'inline-block' }}>
                <HebrewDatePicker value={order.orderDate} onChange={handleOrderDateChange} />
              </span>
            ) : (
              <button className="moc-icon-btn-plain" title="ערוך תאריך הזמנה (מתכנת בלבד)" onClick={requestOrderDateEdit}>
                <Edit2 size={14} />
              </button>
            )}
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
                  {/* value=null בכוונה — אחרת שדה החיפוש מתמלא בשם הלקוח הנוכחי והרשימה מסוננת רק אליו */}
                  <CustomerSelector
                    value={null}
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
