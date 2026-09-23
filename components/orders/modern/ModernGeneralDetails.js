'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import HebrewDatePicker from '../../HebrewDatePicker';
import HebrewDateRangePicker from '../../HebrewDateRangePicker';
import CustomerSelector from '../../CustomerSelector';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { verifyPin } from './mocAuth';
import { fetchSharedJson, TTL } from '../../../lib/apiCache';
import { isDeliveryAddressRequired, isDeliveryCityRequired } from '../../../lib/deliveryValidation';

/**
 * טאב "פרטים כלליים" בעיצוב "אריג" — כרטיס לקוח + כרטיס אירוע + כרטיס ציפוף ימים
 * מותאם + כרטיס תאריך ביצוע ההזמנה. הלוגיקה פורטה מ-OrderGeneralDetails (עריכת תאריכים,
 * ציפוף באישור מנהל, עריכת תאריך הזמנה באישור מאשר מוגדר) בתוספת: מייל מהיר באישור מנהל
 * והחלפת לקוח מהכרטיס.
 */
export default function ModernGeneralDetails({ order, onOrderChange, onSaveRequest, onToggleSignature, onQuickEmail, showManualPaymentCreditButton = false, onOpenManualPaymentCredit }) {
  const [showManualPaymentCreditChooser, setShowManualPaymentCreditChooser] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState(!order?.eventDate && !order?.fromDate);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerMode, setCustomerMode] = useState('existing');
  const [newCustomer, setNewCustomer] = useState({ firstName: '', lastName: '', phone1: '', email: '', city: '', street: '', houseNum: '' });
  const [isEditingOrderDate, setIsEditingOrderDate] = useState(false);
  const [orderDateApproval, setOrderDateApproval] = useState(null);
  // כרטיס המשלוח, בניגוד לכרטיס פרטי האירוע, לא היה לו בכלל מצב "תצוגה מקוצרת" עם עיפרון
  // לעריכה ו-V לסיום (הדפוס הקיים בשאר הכרטיס) - היה תמיד פתוח כטופס מלא. פותח אוטומטית
  // במצב עריכה רק כשמשלוח כבר מסומן אך עדיין אין עיר משלוח (בדיוק כמו isEditingEvent
  // למעלה, שנפתח כברירת מחדל רק כשאין עדיין תאריך אירוע).
  const [isEditingDelivery, setIsEditingDelivery] = useState(!!order?.isDelivery && !order?.deliveryCity);
  const [systemDefaultSpacing, setSystemDefaultSpacing] = useState(3);
  const [enableRentalExtension, setEnableRentalExtension] = useState(false);

  React.useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        const arr = Array.isArray(data) ? data : Object.entries(data || {}).map(([key, value]) => ({ key, value }));
        const setting = arr.find(s => s.key === 'inventory_buffer_days');
        if (setting && !isNaN(parseInt(setting.value, 10))) setSystemDefaultSpacing(parseInt(setting.value, 10));
        const extSetting = arr.find(s => s.key === 'enable_rental_extension');
        setEnableRentalExtension(!!extSetting && extSetting.value === 'true');
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

  // יום השכרה נוסף (feature request #?, נווה יעקב) — הוספת יום לפני הלקיחה או אחרי
  // ההחזרה, בתוספת 50% מסך ההזמנה (מחושב אוטומטית ב-pricingEngine לפי order.extraDay).
  // מוגבל להזמנות עם טווח תאריכים מפורש (isAbroad/isWeekdayEvent) — להזמנה רגילה אין
  // toDate/fromDate אמיתיים לזוז (התקופה נגזרת מ-eventDate + חוצץ המלאי).
  const shiftDateStr = (dateStr, deltaDays) => {
    if (!dateStr) return dateStr;
    const d = new Date(dateStr);
    d.setDate(d.getDate() + deltaDays);
    return d.toISOString();
  };
  const setExtraDay = (newValue) => {
    const current = order.extraDay || null;
    if (current === newValue) return;
    let { fromDate, toDate, returnDate } = order;
    if (current === 'before') fromDate = shiftDateStr(fromDate, 1);
    if (current === 'after') { toDate = shiftDateStr(toDate, -1); returnDate = shiftDateStr(returnDate, -1); }
    if (newValue === 'before') fromDate = shiftDateStr(fromDate, -1);
    if (newValue === 'after') { toDate = shiftDateStr(toDate, 1); returnDate = shiftDateStr(returnDate, 1); }
    changeDates({ fromDate, toDate, returnDate, extraDay: newValue });
  };

  const applyCustomSpacing = async (spacing) => {
    const prevSpacing = (order.customSpacing !== null && order.customSpacing !== undefined) ? order.customSpacing : systemDefaultSpacing;
    const newSpacing = (spacing !== null && spacing !== undefined) ? spacing : systemDefaultSpacing;
    // אישור מנהל נדרש בכל צמצום בפועל של הציפוף — לא רק בפעם הראשונה מברירת המחדל.
    // בלי זה, אחרי אישור אחד אפשר היה להמשיך ולהקטין עוד ועוד (למשל מ-1 ל-0) בלי אישור נוסף.
    if (newSpacing < prevSpacing) {
      const ok = await verifyPin('שינוי ציפוף ימים מותאם אישית דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'feature:special_spacing_approval');
      if (!ok) return;
    }
    // ערך זהה לברירת המחדל של המערכת שקול ל"ללא ציפוף מותאם" — לא נשמר כערך מפורש,
    // אחרת הבאנר ממשיך להיות מוצג גם כשבפועל אין שום ציפוף מיוחד
    const valueToStore = (spacing !== null && spacing !== undefined && spacing === systemDefaultSpacing) ? null : spacing;
    changeDates({ customSpacing: valueToStore });
  };

  // עריכת תאריך ההזמנה משפיעה על חלון הזיכוי במנוע התמחור — הרשאה רגילה (מי מאשר נקבע
  // ב-/admin/permissions, פריט feature:order_date_edit_approval), לא roleId קשיח של מתכנת.
  // authResult (employeeId+pin) נשמר כדי שיישלח שוב עם השמירה למטה - השרת בודק אותו מחדש
  // (PUT /api/orders/[id]) כדי שקריאת API ישירה לא תעקוף את האישור שכבר עבר כאן.
  const requestOrderDateEdit = async () => {
    const authResult = await verifyPin('עריכת תאריך ההזמנה משפיעה על חישובי זיכוי בביטול. אנא בחר משתמש והזן סיסמה:', 'feature:order_date_edit_approval');
    if (!authResult) return;
    setOrderDateApproval(authResult);
    setIsEditingOrderDate(true);
  };

  const handleOrderDateChange = (date) => {
    setIsEditingOrderDate(false);
    const newOrder = { ...order, orderDate: date };
    onOrderChange(newOrder);
    if (onSaveRequest) onSaveRequest(newOrder, { orderDateApproval });
  };

  const handleQuickEmail = async () => {
    const ok = await verifyPin('שליחת מייל מהיר ללקוח דורשת אישור מנהל. אנא בחר מנהל והזן סיסמה:', 'feature:customer_email_approval');
    if (!ok) return;
    onQuickEmail();
  };

  // PUT קטן משלו דרך onToggleSignature (ר' handleToggleSignature ב-app/orders/[id]/page.js) -
  // לא דרך onSaveRequest/handleSave המלא, כדי לא לגרור בדיקות שלא קשורות (ת״ז, אישור חוב...)
  // על אישור שהלקוח חתם על נייר.
  const toggleSignature = () => {
    if (onToggleSignature) onToggleSignature();
  };

  const selectCustomer = (c) => {
    if (!c) { handleChange({ customerId: '', customer: null }); setShowCustomerModal(false); return; }
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
  const initials = customer ? (`${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}` || '?') : '?';
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
  // כש-hide_custom_spacing מופעל (בקשה 1 - לקוח זה), כל הציפוף מוסתר לגמרי.
  const [hideCustomSpacing, setHideCustomSpacing] = React.useState(false);
  // כרטיס משלוח בעריכת הזמנה קיימת - מותנה כולו ב-enable_deliveries (מתג "הצג משלוחים"
  // בהגדרות הניהול, קטגוריית "משלוחים"), אותו מתג שמסתיר/מציג את לשונית "משלוחים" עצמה
  // (app/layout.js showDeliveries) - כשהמתג כבוי, הכרטיס לא מוצג כלל, לא רק שדותיו הפנימיים.
  const [deliverySettings, setDeliverySettings] = React.useState({ enabled: false, allowAddressOverride: false, oneDayBeforeOption: false, priceByCity: {} });
  // רשימת גיבוי לתפריט "עיר משלוח" כש-delivery_price_by_city עוד ריקה - בלי זה שדה הבחירה
  // היה נשאר חסום ללא אף אפשרות בהזמנות של ארגון שעוד לא הגדיר מחירי משלוח לפי עיר,
  // בדיוק כמו הגיבוי הקיים כבר ב-app/orders/new/page.js (customerLocations.cities).
  const [fallbackCities, setFallbackCities] = React.useState([]);
  React.useEffect(() => {
    fetchSharedJson('/api/customers/locations', { ttl: TTL.REFERENCE })
      .then(data => setFallbackCities(data?.cities || []))
      .catch(() => {});
  }, []);
  React.useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC }).then(arr => {
      const list = Array.isArray(arr) ? arr : [];
      const v = list.find(s => s.key === 'hide_custom_spacing')?.value;
      if (v === 'true') setHideCustomSpacing(true);
      const find = (k) => list.find(s => s.key === k)?.value;
      if (find('enable_deliveries') === 'true') {
        let priceByCity = {};
        try { priceByCity = JSON.parse(find('delivery_price_by_city') || '{}'); } catch { /* JSON לא תקין - בלי הצעות ערים */ }
        setDeliverySettings({
          enabled: true,
          allowAddressOverride: find('delivery_allow_address_override') === 'true',
          oneDayBeforeOption: find('delivery_one_day_before_option') === 'true',
          priceByCity
        });
      }
    }).catch(() => {});
  }, []);
  const deliveryPriceCities = Object.keys(deliverySettings.priceByCity || {});
  const deliveryCityOptions = deliveryPriceCities.length ? deliveryPriceCities : fallbackCities;
  const deliveryAddressRequired = isDeliveryAddressRequired(order, customer?.city);
  const deliveryCityRequired = isDeliveryCityRequired(order, customer?.city, deliveryPriceCities);
  const hasCustomSpacing = !hideCustomSpacing && order.customSpacing !== null && order.customSpacing !== undefined;
  const selectedSpacing = hasCustomSpacing ? order.customSpacing : null;
  const maxAxisDay = Math.max(systemDefaultSpacing + 2, selectedSpacing !== null ? selectedSpacing : 0, 4);
  const axisDays = Array.from({ length: maxAxisDay + 1 }, (_, i) => i);

  const spacingCardNode = (
    <div className="card card-pad" style={{ marginBottom: '16px', borderColor: 'var(--warning)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <svg className="icon" style={{ color: 'var(--warning)' }}><use href="#i-alert-tri" /></svg>
        <strong style={{ fontSize: '13.5px' }}>ציפוף ימים מיוחד</strong>
        <span className="hint" style={{ color: 'var(--text-3)' }}>— רגיל לפי המערכת: {systemDefaultSpacing} ימים</span>
      </div>

      <div className="pill-tabs" style={{ marginBottom: '8px' }}>
        <button
          type="button"
          className={`pill-tab${!hasCustomSpacing ? ' active' : ''}`}
          onClick={() => { if (hasCustomSpacing) applyCustomSpacing(null); }}
          title="חזרה לרווח הרגיל של המערכת"
        >
          {!hasCustomSpacing && <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-check" /></svg>}
          רגיל (לפי המערכת — {systemDefaultSpacing} ימים)
        </button>
        {axisDays.map(d => (
          <button
            key={d}
            type="button"
            className={`pill-tab${selectedSpacing === d ? ' active' : ''}`}
            title={d === 0 ? 'ללא רווח כלל' : `${d} ימי רווח בין השכרות`}
            onClick={() => { if (selectedSpacing !== d) applyCustomSpacing(d); }}
          >
            {d}{d === systemDefaultSpacing ? ' (ברירת מחדל)' : ''}
          </button>
        ))}
      </div>

      <div className="hint" style={{ color: 'var(--text-3)' }}>דורש הרשאת מנהל · צובע את ההזמנה בצהוב ומשפיע על בדיקת המלאי להזמנה זו בלבד</div>
    </div>
  );

  return (
    <>
      {/* כרטיס לקוח */}
      <div className="card card-pad" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div className="avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{customerName}</div>
            <div className="hint" style={{ color: 'var(--text-3)' }} title={customer ? [customer.phone1, customer.phone2, customer.email, address].filter(Boolean).join(' · ') : ''}>
              {customer
                ? ([customer.phone1, customer.phone2, customer.email, address].filter(Boolean).join(' · ') || 'אין פרטי קשר')
                : 'לא נבחר לקוח — לחץ על אייקון העריכה לבחירה'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`badge ${order.hasSignedRegulations ? 'badge-success' : 'badge-warning'}`}
              style={{ border: 'none', cursor: 'pointer' }}
              onClick={toggleSignature}
              title="סטטוס חתימה על תקנון — לחץ לשינוי"
            >
              <svg className="icon"><use href={order.hasSignedRegulations ? '#i-check-circle' : '#i-x-circle'} /></svg>
              {order.hasSignedRegulations ? 'חתם על תקנון' : 'לא חתם'}
            </button>
            <button type="button" className="btn btn-ghost btn-icon-only" title="שליחת מייל מהיר (באישור מנהל)" onClick={handleQuickEmail}>
              <svg className="icon"><use href="#i-mail" /></svg>
            </button>
            {customer?.id && (
              <Link href={`/customers/${customer.id}`} target="_blank" title="מעבר לכרטיס לקוח" className="btn btn-ghost btn-icon-only">
                <svg className="icon"><use href="#i-link" /></svg>
              </Link>
            )}
            <button type="button" className="btn btn-ghost btn-icon-only" title="החלפת לקוח" onClick={() => setShowCustomerModal(true)}>
              <svg className="icon"><use href="#i-edit" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* כרטיס אירוע */}
      <div className="card card-pad" style={{ marginBottom: '16px' }}>
        {!isEditingEvent ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div className="avatar"><svg className="icon"><use href="#i-calendar" /></svg></div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{eventSubLabel}</div>
              <div className="hint" style={{ color: 'var(--text-3)' }}>
                {isAbroad
                  ? (order.fromDate
                    ? <>לקיחה: <strong style={{ color: 'var(--text)' }}>{fmtFullDate(order.fromDate)}</strong> · החזרה: <strong style={{ color: 'var(--text)' }}>{fmtFullDate(order.toDate || order.returnDate) || '?'}</strong>{order.extraDay ? <> · <span className="badge badge-warning">יום נוסף {order.extraDay === 'before' ? 'לפני' : 'אחרי'}</span></> : null}</>
                    : 'טרם נבחרו תאריכים')
                  : (order.eventDate
                    ? <strong style={{ color: 'var(--text)' }}>{`${new Date(order.eventDate).toLocaleDateString('he-IL')} (${order.eventDateHebrew || getHebrewDateString(order.eventDate)})`}</strong>
                    : 'טרם נבחר תאריך')}
                {order.notes ? <> · הערות: {order.notes}</> : null}
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-icon-only" title="עריכת פרטי אירוע" onClick={() => setIsEditingEvent(true)}>
              <svg className="icon"><use href="#i-edit" /></svg>
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div className="pill-tabs">
                <button
                  type="button"
                  className={`pill-tab${!isAbroad ? ' active' : ''}`}
                  onClick={() => {
                    if (!isAbroad) return;
                    // חזרה לאירוע רגיל — מנקים את טווח התאריכים ואת תאריך ההחזרה שנקבע ממנו
                    changeDates({ isAbroad: false, isWeekdayEvent: false, fromDate: null, toDate: null, returnDate: null });
                  }}
                >
                  אירוע רגיל
                </button>
                <button
                  type="button"
                  className={`pill-tab${isAbroad ? ' active' : ''}`}
                  onClick={() => {
                    if (isAbroad) return;
                    // מעבר לאירוע חו"ל — עוברים לטווח תאריכים במקום תאריך בודד
                    changeDates({ isAbroad: true, isWeekdayEvent: false, eventDate: null, eventDateHebrew: null });
                  }}
                >
                  אירוע חו"ל
                </button>
              </div>
              <button type="button" className="btn btn-ghost btn-icon-only" title="סיים עריכה" onClick={() => setIsEditingEvent(false)}>
                <svg className="icon"><use href="#i-check" /></svg>
              </button>
            </div>

            {!isAbroad ? (
              <div className="field">
                <label>תאריך אירוע</label>
                <HebrewDatePicker value={order.eventDate} onChange={(date) => changeDates({ eventDate: date })} />
              </div>
            ) : (
              <div className="field">
                <label>טווח תאריכים (לקיחה והחזרה)</label>
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

            {isAbroad && enableRentalExtension && (
              <div className="field">
                <label>יום השכרה נוסף (תוספת 50% מסך ההזמנה)</label>
                <div className="pill-tabs">
                  <button type="button" className={`pill-tab${!order.extraDay ? ' active' : ''}`} onClick={() => setExtraDay(null)}>
                    ללא
                  </button>
                  <button type="button" className={`pill-tab${order.extraDay === 'before' ? ' active' : ''}`} onClick={() => setExtraDay('before')}>
                    יום נוסף לפני
                  </button>
                  <button type="button" className={`pill-tab${order.extraDay === 'after' ? ' active' : ''}`} onClick={() => setExtraDay('after')}>
                    יום נוסף אחרי
                  </button>
                </div>
              </div>
            )}

            <div className="field">
              <label>הערות להזמנה</label>
              <textarea
                className="textarea"
                rows={3}
                value={order.notes || ''}
                onChange={(e) => handleChange({ notes: e.target.value })}
                placeholder="הערות כלליות לגבי ההזמנה..."
              />
            </div>

            <div className="field" style={{ marginBottom: order.isDelivery ? undefined : 0 }}>
              <label>הערות פנימיות (לא מוצג ללקוח)</label>
              <textarea
                className="textarea"
                rows={3}
                value={order.internalNotes || ''}
                onChange={(e) => handleChange({ internalNotes: e.target.value })}
                placeholder="הערות לצוות בלבד - לא יופיעו בהדפסה או במייל ללקוח..."
              />
            </div>
          </>
        )}
      </div>

      {/* ציפוף ימים מיוחד — סעיף נפרד, מוצג בזמן עריכת האירוע וגם כאינדיקציה במצב קריאה. מוסתר לגמרי כאשר hide_custom_spacing מופעל */}
      {!hideCustomSpacing && (isEditingEvent || hasCustomSpacing) && spacingCardNode}

      {/* כרטיס משלוח — קיים גם בהזמנה חדשה (app/orders/new/page.js), כאן מאפשר להוסיף/לערוך
          משלוח גם על הזמנה שכבר נוצרה. מוצג רק כש-enable_deliveries מופעל בהגדרות; שמירת
          השדות בפועל קורית ב-handleSave (app/orders/[id]/page.js) שמעביר אותם ל-PUT, וה-API
          (app/api/orders/[id]/route.js) כבר מריץ applyDeliveryCharge מחדש בעדכון. */}
      {deliverySettings.enabled && (
        <div className="card card-pad" style={{ marginBottom: '16px' }}>
          {/* מתג "הזמנת משלוח" — נשאר תמיד גלוי (לא נכנס למצב עריכה/קריאה כמו שאר הכרטיס
              למטה) ומודגש יותר משאר השדות, כי הוא הקובע היחיד אם כל שאר האזור פעיל בכלל. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>משלוח</h3>
            <div
              className={`switch${order.isDelivery ? ' on' : ''}`}
              role="switch"
              aria-checked={!!order.isDelivery}
              tabIndex={0}
              title={order.isDelivery ? 'הזמנת משלוח — מופעל. לחץ לכיבוי' : 'הזמנת משלוח — כבוי. לחץ להפעלה'}
              onClick={() => {
                const turningOn = !order.isDelivery;
                handleChange({ isDelivery: turningOn });
                if (turningOn) setIsEditingDelivery(true);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                const turningOn = !order.isDelivery;
                handleChange({ isDelivery: turningOn });
                if (turningOn) setIsEditingDelivery(true);
              }}
            />
          </div>
          {order.isDelivery && (isEditingDelivery ? (
            <>
              <div className="form-grid" style={{ marginTop: '14px' }}>
                <div className="field">
                  <label>כיוון משלוח</label>
                  <select className="select" value={order.deliveryDirection || 'הלוך-חזור'} onChange={e => handleChange({ deliveryDirection: e.target.value })}>
                    <option value="הלוך">הלוך</option>
                    <option value="חזור">חזור</option>
                    <option value="הלוך-חזור">הלוך-חזור</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="delivery-city-edit">עיר משלוח (לחישוב מחיר){deliveryCityRequired && <span style={{ color: 'var(--danger)' }}> *</span>}</label>
                  <select id="delivery-city-edit" className="select" value={order.deliveryCity || ''} onChange={e => handleChange({ deliveryCity: e.target.value })}>
                    <option value="">בחר עיר…</option>
                    {[...new Set([...(order.deliveryCity ? [order.deliveryCity] : []), ...deliveryCityOptions])].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {deliveryCityRequired && !String(order.deliveryCity || '').trim() && (
                    <p className="hint" style={{ color: 'var(--danger)', margin: '4px 0 0' }}>
                      עיר המגורים של הלקוח אינה ברשימת ערי המשלוח - יש לבחור עיר משלוח.
                    </p>
                  )}
                </div>
                {(deliverySettings.allowAddressOverride || deliveryAddressRequired) && (
                  <div className="field">
                    <label>כתובת משלוח שונה{deliveryAddressRequired && <span style={{ color: 'var(--danger)' }}> *</span>}</label>
                    <input type="text" className="input" value={order.deliveryAddress || ''} onChange={e => handleChange({ deliveryAddress: e.target.value })} placeholder="כתובת למשלוח (שונה ממגורים)" />
                    {deliveryAddressRequired && !String(order.deliveryAddress || '').trim() && (
                      <p className="hint" style={{ color: 'var(--danger)', margin: '4px 0 0' }}>
                        עיר המשלוח שונה מעיר הלקוח - יש להזין כתובת למשלוח.
                      </p>
                    )}
                  </div>
                )}
              </div>
              {deliverySettings.oneDayBeforeOption && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
                  marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)'
                }}>
                  <span style={{ fontSize: '13px' }}>משלוח יוצא יום לפני האירוע (במקום יומיים)</span>
                  <div
                    className={`switch${order.deliveryOneDayBefore ? ' on' : ''}`}
                    role="switch"
                    aria-checked={!!order.deliveryOneDayBefore}
                    tabIndex={0}
                    title={order.deliveryOneDayBefore ? 'יוצא יום לפני — מופעל. לחץ לכיבוי' : 'יוצא יום לפני — כבוי. לחץ להפעלה'}
                    onClick={() => handleChange({ deliveryOneDayBefore: !order.deliveryOneDayBefore })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChange({ deliveryOneDayBefore: !order.deliveryOneDayBefore }); } }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-ghost btn-icon-only" title="סיים עריכת פרטי משלוח" onClick={() => setIsEditingDelivery(false)}>
                  <svg className="icon"><use href="#i-check" /></svg>
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginTop: '10px' }}>
              <span className="hint" style={{ color: 'var(--text-2)' }}>
                {[
                  order.deliveryDirection || 'הלוך-חזור',
                  order.deliveryCity,
                  order.deliveryAddress,
                  order.deliveryOneDayBefore ? 'יוצא יום לפני האירוע' : null
                ].filter(Boolean).join(' · ') || 'טרם הוזנו פרטי משלוח'}
              </span>
              <button type="button" className="btn btn-ghost btn-icon-only" title="עריכת פרטי משלוח" onClick={() => setIsEditingDelivery(true)}>
                <svg className="icon"><use href="#i-edit" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* כפתור מאוחד "הוספת תשלום/זיכוי ידני" - מחליף את שני הכפתורים הנפרדים שמוסתרים אז
          בטאב תשלומים (ר' ModernPaymentsManager.js, מותנה באותו SystemSetting
          consolidate_manual_payment_credit_ui, כרגע true רק בנווה יעקב). ההוספה עצמה דורשת
          קוד מאשר - נבדק ב-onOpenManualPaymentCredit (app/orders/[id]/page.js) לפני שהחלונית
          האמיתית (תשלום/זיכוי) נפתחת בפועל בטאב תשלומים. */}
      {showManualPaymentCreditButton && (
        <div className="card card-pad" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>תשלום / זיכוי ידני</div>
            <div className="hint" style={{ color: 'var(--text-3)' }}>רישום תשלום נוסף (למשל מזומן) או בקשת זיכוי ללקוח - דורש קוד מאשר.</div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowManualPaymentCreditChooser(true)}>
            <svg className="icon"><use href="#i-coin" /></svg>הוספת תשלום/זיכוי ידני
          </button>
        </div>
      )}

      {/* תאריך ביצוע ההזמנה */}
      <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <span className="hint" style={{ color: 'var(--text-3)' }}>תאריך ביצוע ההזמנה</span>
          {isEditingOrderDate ? (
            <div style={{ marginTop: '6px', maxWidth: '220px' }}>
              <HebrewDatePicker value={order.orderDate} onChange={handleOrderDateChange} />
            </div>
          ) : (
            <div style={{ fontWeight: 700, marginTop: '2px' }}>{orderDateStr}</div>
          )}
        </div>
        {!isEditingOrderDate && (
          <button type="button" className="btn btn-ghost btn-icon-only" title="ערוך תאריך הזמנה (דורש אישור)" onClick={requestOrderDateEdit}>
            <svg className="icon"><use href="#i-edit" /></svg>
          </button>
        )}
      </div>

      {/* ===== מודל החלפת לקוח ===== */}
      {showCustomerModal && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCustomerModal(false); }}
        >
          <div className="modal" style={{ maxWidth: '560px', width: '100%', margin: 0 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>החלפת לקוח</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setShowCustomerModal(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="pill-tabs" style={{ marginBottom: '16px' }}>
                <button type="button" className={`pill-tab${customerMode === 'existing' ? ' active' : ''}`} onClick={() => setCustomerMode('existing')}>לקוח קיים</button>
                <button type="button" className={`pill-tab${customerMode === 'new' ? ' active' : ''}`} onClick={() => setCustomerMode('new')}>לקוח חדש</button>
              </div>

              {customerMode === 'existing' ? (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>חיפוש לקוח</label>
                  {/* value=null בכוונה — אחרת שדה החיפוש מתמלא בשם הלקוח הנוכחי והרשימה מסוננת רק אליו */}
                  <CustomerSelector
                    value={null}
                    onChange={selectCustomer}
                    placeholder="חפש לקוח לפי שם, טלפון, עיר..."
                  />
                </div>
              ) : (
                <div>
                  <div className="form-grid">
                    <div className="field"><label>שם פרטי *</label><input type="text" className="input" autoComplete="off" value={newCustomer.firstName} onChange={e => setNewCustomer({ ...newCustomer, firstName: e.target.value })} /></div>
                    <div className="field"><label>שם משפחה *</label><input type="text" className="input" autoComplete="off" value={newCustomer.lastName} onChange={e => setNewCustomer({ ...newCustomer, lastName: e.target.value })} /></div>
                  </div>
                  <div className="form-grid">
                    <div className="field"><label>טלפון *</label><input type="text" className="input" style={{ direction: 'ltr' }} autoComplete="off" value={newCustomer.phone1} onChange={e => setNewCustomer({ ...newCustomer, phone1: e.target.value })} /></div>
                    <div className="field">
                      <label>דוא&quot;ל *</label>
                      <input type="email" className="input" style={{ direction: 'ltr' }} autoComplete="off" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                      {(!newCustomer.email || !newCustomer.email.includes('@')) && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: '6px' }}
                          onClick={() => setNewCustomer(prev => ({ ...prev, email: (prev.email || '') + '@gmail.com' }))}
                        >
                          השלם ל- @gmail.com
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field"><label>עיר</label><input type="text" className="input" autoComplete="off" value={newCustomer.city} onChange={e => setNewCustomer({ ...newCustomer, city: e.target.value })} /></div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div className="field" style={{ flex: 2 }}><label>רחוב</label><input type="text" className="input" autoComplete="off" value={newCustomer.street} onChange={e => setNewCustomer({ ...newCustomer, street: e.target.value })} /></div>
                      <div className="field" style={{ flex: 1 }}><label>בית</label><input type="text" className="input" autoComplete="off" value={newCustomer.houseNum} onChange={e => setNewCustomer({ ...newCustomer, houseNum: e.target.value })} /></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerModal(false)}>ביטול</button>
              {customerMode === 'new' && (
                <button type="button" className="btn btn-primary" onClick={handleSaveNewCustomer}>
                  <svg className="icon"><use href="#i-check" /></svg>
                  שמור ובחר
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== בורר "תשלום או זיכוי" עבור הכפתור המאוחד למעלה ===== */}
      {showManualPaymentCreditChooser && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowManualPaymentCreditChooser(false); }}
        >
          <div className="modal" style={{ maxWidth: '420px', width: '100%', margin: 0 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>הוספת תשלום/זיכוי ידני</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setShowManualPaymentCreditChooser(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p className="hint" style={{ color: 'var(--text-2)', margin: 0 }}>בחר את סוג הפעולה. שתיהן דורשות קוד מאשר.</p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => { setShowManualPaymentCreditChooser(false); onOpenManualPaymentCredit?.('payment'); }}
              >
                <svg className="icon"><use href="#i-coin" /></svg>רישום תשלום נוסף (למשל מזומן)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => { setShowManualPaymentCreditChooser(false); onOpenManualPaymentCredit?.('credit'); }}
              >
                <svg className="icon"><use href="#i-refresh" /></svg>בקשת זיכוי ללקוח
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
