'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import HebrewDatePicker from '../../HebrewDatePicker';
import HebrewDateRangePicker from '../../HebrewDateRangePicker';
import CustomerSelector from '../../CustomerSelector';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { verifyPin } from './mocAuth';
import { fetchSharedJson, TTL } from '../../../lib/apiCache';
import { isDeliveryAddressRequired, isDeliveryCityRequired } from '../../../lib/deliveryValidation';
import { Card, Btn, IconBtn, Chip, Field, Row, Rows, Seg, Switch, Dialog, Icon, Tip } from '../../../app/v3/ui/components';
import { useV3Dialogs, TipWrap } from './orderCardDialogs';
import './orderCardV3.css';

/**
 * לשונית "פרטים" בעיצוב v3 - כרטיס לקוח + כרטיס אירוע + כרטיס ציפוף ימים
 * מותאם + כרטיס משלוח + תאריך ביצוע ההזמנה. הלוגיקה פורטה מ-OrderGeneralDetails (עריכת תאריכים,
 * ציפוף באישור מנהל, עריכת תאריך הזמנה באישור מאשר מוגדר) בתוספת: מייל מהיר באישור מנהל
 * והחלפת לקוח מהכרטיס. בגרסה הזו רק שכבת התצוגה הוחלפה - כל ה-state, ה-handlers והקריאות נשארו.
 */
export default function ModernGeneralDetails({ order, onOrderChange, onSaveRequest, onToggleSignature, onQuickEmail, showManualPaymentCreditButton = false, onOpenManualPaymentCredit }) {
  const { v3Alert, dialogs } = useV3Dialogs();
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
      await v3Alert('צריך למלא שם פרטי, שם משפחה, טלפון ומייל.');
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
        await v3Alert('שמירת הלקוח נכשלה.');
      }
    } catch (e) {
      await v3Alert('שמירת הלקוח נכשלה.');
    }
  };

  const customer = order.customer;
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') : 'לא נבחר לקוח';
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

  const toggleDelivery = (turningOn) => {
    handleChange({ isDelivery: turningOn });
    if (turningOn) setIsEditingDelivery(true);
  };

  const spacingCardNode = (
    <Card
      icon="alert-tri"
      title="ציפוף ימים מיוחד"
      tip="דורש הרשאת מנהל. צובע את ההזמנה בצהוב ומשפיע על בדיקת המלאי של ההזמנה הזו בלבד."
    >
      <p className="v3-muted">
        ברירת המחדל של המערכת: <bdi>{systemDefaultSpacing}</bdi> ימי רווח בין השכרות.
      </p>
      <div className="v3-cluster" role="group" aria-label="ימי רווח בין השכרות" style={{ marginTop: 'var(--v3-sp-3)' }}>
        <Chip
          variant={!hasCustomSpacing ? 'done' : 'info'}
          icon={!hasCustomSpacing ? 'check' : undefined}
          aria-pressed={!hasCustomSpacing}
          onClick={() => { if (hasCustomSpacing) applyCustomSpacing(null); }}
        >
          רגיל (<bdi>{systemDefaultSpacing}</bdi> ימים)
        </Chip>
        {axisDays.map(d => (
          <Chip
            key={d}
            variant={selectedSpacing === d ? 'done' : 'info'}
            icon={selectedSpacing === d ? 'check' : undefined}
            aria-pressed={selectedSpacing === d}
            aria-label={d === 0 ? 'ללא רווח כלל' : `${d} ימי רווח בין השכרות`}
            onClick={() => { if (selectedSpacing !== d) applyCustomSpacing(d); }}
          >
            <bdi>{d}</bdi>{d === systemDefaultSpacing ? ' (ברירת מחדל)' : ''}
          </Chip>
        ))}
      </div>
    </Card>
  );

  return (
    <>
      {/* כרטיס לקוח */}
      <Card
        variant="cust"
        icon="user"
        title={customerName}
        actions={(
          <div className="oc-tools">
            <Chip
              variant={order.hasSignedRegulations ? 'done' : 'attn'}
              icon={order.hasSignedRegulations ? 'check-circle' : 'x-circle'}
              onClick={toggleSignature}
              aria-label="סטטוס חתימה על תקנון - לחיצה לשינוי"
            >
              {order.hasSignedRegulations ? 'חתם על התקנון' : 'לא חתם'}
            </Chip>
            <TipWrap content="שליחת מייל מהיר ללקוח (באישור מנהל)">
              <IconBtn icon="mail" label="שליחת מייל מהיר" onClick={handleQuickEmail} />
            </TipWrap>
            {customer?.id && (
              <TipWrap content="פתיחת כרטיס הלקוח בלשונית חדשה">
                <Link href={`/customers/${customer.id}`} target="_blank" className="v3-btn v3-btn--icon" aria-label="מעבר לכרטיס הלקוח">
                  <Icon name="link" />
                </Link>
              </TipWrap>
            )}
            <TipWrap content="החלפת הלקוח בהזמנה">
              <IconBtn icon="edit" label="החלפת לקוח" onClick={() => setShowCustomerModal(true)} />
            </TipWrap>
          </div>
        )}
      >
        {customer ? (
          <Rows>
            <Row icon="phone" label="טלפון" missing={!customer.phone1}><bdi dir="ltr">{customer.phone1}</bdi></Row>
            {customer.phone2 && <Row icon="phone" label="טלפון נוסף"><bdi dir="ltr">{customer.phone2}</bdi></Row>}
            <Row icon="mail" label="מייל" missing={!customer.email}><bdi dir="ltr">{customer.email}</bdi></Row>
            <Row icon="pin" label="כתובת" missing={!address}>{address}</Row>
          </Rows>
        ) : (
          <p className="v3-muted">עוד לא נבחר לקוח להזמנה. אפשר לבחור דרך כפתור ההחלפה.</p>
        )}
      </Card>

      {/* כרטיס אירוע */}
      <Card
        icon="calendar"
        title="האירוע"
        actions={!isEditingEvent ? (
          <TipWrap content="עריכת פרטי האירוע">
            <IconBtn icon="edit" label="עריכת פרטי האירוע" onClick={() => setIsEditingEvent(true)} />
          </TipWrap>
        ) : (
          <TipWrap content="סיום העריכה">
            <IconBtn icon="check" label="סיום עריכת האירוע" onClick={() => setIsEditingEvent(false)} />
          </TipWrap>
        )}
      >
        {!isEditingEvent ? (
          <Rows>
            <Row icon="tag" label="סוג האירוע">{eventSubLabel}</Row>
            {isAbroad ? (
              order.fromDate ? (
                <>
                  <Row icon="calendar" label="לקיחה">{fmtFullDate(order.fromDate)}</Row>
                  <Row icon="calendar" label="החזרה">
                    {fmtFullDate(order.toDate || order.returnDate) || '?'}
                    {order.extraDay ? <Chip variant="attn">יום נוסף {order.extraDay === 'before' ? 'לפני' : 'אחרי'}</Chip> : null}
                  </Row>
                </>
              ) : (
                <Row icon="calendar" label="תאריכים" missing missingText="טרם נבחרו" />
              )
            ) : (
              <Row icon="calendar" label="תאריך האירוע" missing={!order.eventDate} missingText="טרם נבחר">
                {order.eventDate ? `${new Date(order.eventDate).toLocaleDateString('he-IL')} (${order.eventDateHebrew || getHebrewDateString(order.eventDate)})` : null}
              </Row>
            )}
            {order.notes ? <Row icon="file" label="הערות להזמנה">{order.notes}</Row> : null}
          </Rows>
        ) : (
          <div className="v3-stack">
            <Seg
              label="סוג האירוע"
              value={isAbroad ? 'abroad' : 'regular'}
              onChange={(v) => {
                if (v === 'regular') {
                  if (!isAbroad) return;
                  // חזרה לאירוע רגיל — מנקים את טווח התאריכים ואת תאריך ההחזרה שנקבע ממנו
                  changeDates({ isAbroad: false, isWeekdayEvent: false, fromDate: null, toDate: null, returnDate: null });
                } else {
                  if (isAbroad) return;
                  // מעבר לאירוע חו"ל — עוברים לטווח תאריכים במקום תאריך בודד
                  changeDates({ isAbroad: true, isWeekdayEvent: false, eventDate: null, eventDateHebrew: null });
                }
              }}
              options={[
                { value: 'regular', label: 'אירוע רגיל', icon: 'calendar' },
                { value: 'abroad', label: 'אירוע חו"ל', icon: 'pin' }
              ]}
            />

            {!isAbroad ? (
              <div className="v3-field">
                <span className="v3-label">תאריך האירוע</span>
                <HebrewDatePicker value={order.eventDate} onChange={(date) => changeDates({ eventDate: date })} />
              </div>
            ) : (
              <div className="v3-field">
                <span className="v3-label">
                  לקיחה והחזרה
                  <Tip>בוחרים טווח תאריכים חופשי: היום הראשון הוא הלקיחה והאחרון הוא ההחזרה.</Tip>
                </span>
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
              <div className="v3-field">
                <span className="v3-label">
                  יום השכרה נוסף
                  <Tip>תוספת של 50% מסך ההזמנה עבור יום אחד לפני הלקיחה או אחרי ההחזרה.</Tip>
                </span>
                <Seg
                  label="יום השכרה נוסף"
                  value={order.extraDay || 'none'}
                  onChange={(v) => setExtraDay(v === 'none' ? null : v)}
                  options={[
                    { value: 'none', label: 'ללא' },
                    { value: 'before', label: 'יום לפני' },
                    { value: 'after', label: 'יום אחרי' }
                  ]}
                />
              </div>
            )}

            <Field
              as="textarea"
              label="הערות להזמנה"
              rows={3}
              value={order.notes || ''}
              onChange={(e) => handleChange({ notes: e.target.value })}
              placeholder="כל דבר שחשוב לדעת על ההזמנה"
            />

            <Field
              as="textarea"
              label="הערות פנימיות"
              tip="לצוות בלבד. לא מופיע בהדפסה ולא במייל ללקוח."
              rows={3}
              value={order.internalNotes || ''}
              onChange={(e) => handleChange({ internalNotes: e.target.value })}
              placeholder="הערות לצוות"
            />
          </div>
        )}
      </Card>

      {/* ציפוף ימים מיוחד — מוצג בזמן עריכת האירוע וגם כאינדיקציה במצב קריאה. מוסתר לגמרי כאשר hide_custom_spacing מופעל */}
      {!hideCustomSpacing && (isEditingEvent || hasCustomSpacing) && spacingCardNode}

      {/* כרטיס משלוח — קיים גם בהזמנה חדשה (app/orders/new/page.js), כאן מאפשר להוסיף/לערוך
          משלוח גם על הזמנה שכבר נוצרה. מוצג רק כש-enable_deliveries מופעל בהגדרות; שמירת
          השדות בפועל קורית ב-handleSave (app/orders/[id]/page.js) שמעביר אותם ל-PUT, וה-API
          (app/api/orders/[id]/route.js) כבר מריץ applyDeliveryCharge מחדש בעדכון. */}
      {deliverySettings.enabled && (
        <Card
          icon="truck"
          title="משלוח"
          actions={(
            // מתג "הזמנת משלוח" — נשאר תמיד גלוי (לא נכנס למצב עריכה/קריאה כמו שאר הכרטיס)
            // והוא הקובע היחיד אם כל שאר האזור פעיל. גם Enter וגם רווח מחליפים אותו.
            <Switch
              checked={!!order.isDelivery}
              label="הזמנה עם משלוח"
              onChange={(on) => toggleDelivery(on)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                toggleDelivery(!order.isDelivery);
              }}
            />
          )}
        >
          {order.isDelivery && (isEditingDelivery ? (
            <div className="v3-stack">
              <Field as="select" label="כיוון המשלוח" value={order.deliveryDirection || 'הלוך-חזור'} onChange={e => handleChange({ deliveryDirection: e.target.value })}>
                <option value="הלוך">הלוך</option>
                <option value="חזור">חזור</option>
                <option value="הלוך-חזור">הלוך-חזור</option>
              </Field>
              <Field
                as="select"
                id="delivery-city-edit"
                label="עיר המשלוח"
                tip="העיר קובעת את מחיר המשלוח."
                required={deliveryCityRequired}
                error={deliveryCityRequired && !String(order.deliveryCity || '').trim() ? 'עיר המגורים של הלקוח לא ברשימת ערי המשלוח, אז צריך לבחור עיר משלוח.' : undefined}
                value={order.deliveryCity || ''}
                onChange={e => handleChange({ deliveryCity: e.target.value })}
              >
                <option value="">בחירת עיר…</option>
                {[...new Set([...(order.deliveryCity ? [order.deliveryCity] : []), ...deliveryCityOptions])].map(c => <option key={c} value={c}>{c}</option>)}
              </Field>
              {(deliverySettings.allowAddressOverride || deliveryAddressRequired) && (
                <Field
                  label="כתובת משלוח שונה"
                  required={deliveryAddressRequired}
                  error={deliveryAddressRequired && !String(order.deliveryAddress || '').trim() ? 'עיר המשלוח שונה מעיר הלקוח, אז צריך להזין כתובת למשלוח.' : undefined}
                  type="text"
                  value={order.deliveryAddress || ''}
                  onChange={e => handleChange({ deliveryAddress: e.target.value })}
                  placeholder="רחוב, מספר ועיר"
                />
              )}
              {deliverySettings.oneDayBeforeOption && (
                <Switch
                  checked={!!order.deliveryOneDayBefore}
                  label="המשלוח יוצא יום לפני האירוע (ולא יומיים לפני)"
                  onChange={(on) => handleChange({ deliveryOneDayBefore: on })}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    handleChange({ deliveryOneDayBefore: !order.deliveryOneDayBefore });
                  }}
                />
              )}
              <div className="oc-tools">
                <Btn variant="primary" icon="check" onClick={() => setIsEditingDelivery(false)}>סיום עריכת המשלוח</Btn>
              </div>
            </div>
          ) : (
            <Rows>
              <Row icon="truck" label="כיוון">{order.deliveryDirection || 'הלוך-חזור'}</Row>
              <Row icon="pin" label="עיר" missing={!order.deliveryCity} missingText="טרם הוזנה">{order.deliveryCity}</Row>
              {order.deliveryAddress ? <Row icon="pin" label="כתובת המשלוח">{order.deliveryAddress}</Row> : null}
              {order.deliveryOneDayBefore ? <Row icon="clock" label="יציאה">יום לפני האירוע</Row> : null}
              <div className="oc-tools">
                <Btn icon="edit" onClick={() => setIsEditingDelivery(true)}>עריכת פרטי המשלוח</Btn>
              </div>
            </Rows>
          ))}
        </Card>
      )}

      {/* כפתור מאוחד "הוספת תשלום/זיכוי ידני" - מחליף את שני הכפתורים הנפרדים שמוסתרים אז
          בטאב תשלומים (ר' ModernPaymentsManager.js, מותנה באותו SystemSetting
          consolidate_manual_payment_credit_ui, כרגע true רק בנווה יעקב). ההוספה עצמה דורשת
          קוד מאשר - נבדק ב-onOpenManualPaymentCredit (app/orders/[id]/page.js) לפני שהחלונית
          האמיתית (תשלום/זיכוי) נפתחת בפועל בלשונית התשלומים. */}
      {showManualPaymentCreditButton && (
        <Card
          icon="coin"
          title="תשלום או זיכוי ידני"
          tip="רישום תשלום נוסף (למשל מזומן) או בקשת זיכוי ללקוח. דורש קוד מאשר."
          actions={<Btn icon="plus" onClick={() => setShowManualPaymentCreditChooser(true)}>הוספה</Btn>}
        />
      )}

      {/* תאריך ביצוע ההזמנה */}
      <Card
        icon="clock"
        title="תאריך ביצוע ההזמנה"
        tip="עריכת התאריך משפיעה על חישובי זיכוי בביטול, ולכן דורשת אישור."
        actions={!isEditingOrderDate ? (
          <TipWrap content="עריכת תאריך הביצוע (דורש אישור)">
            <IconBtn icon="edit" label="עריכת תאריך ביצוע ההזמנה" onClick={requestOrderDateEdit} />
          </TipWrap>
        ) : null}
      >
        {isEditingOrderDate ? (
          <HebrewDatePicker value={order.orderDate} onChange={handleOrderDateChange} />
        ) : (
          <Rows><Row icon="calendar" label="בוצעה בתאריך">{orderDateStr}</Row></Rows>
        )}
      </Card>

      {/* ===== חלונית החלפת לקוח (חלונית הזנה - בהיר בלבד) ===== */}
      <Dialog
        open={showCustomerModal}
        variant="form"
        icon="user"
        title="החלפת לקוח"
        sub="בוחרים לקוח קיים, או יוצרים לקוח חדש."
        onClose={() => setShowCustomerModal(false)}
        actions={(
          <>
            {customerMode === 'new' && (
              <Btn variant="primary" icon="check" onClick={handleSaveNewCustomer}>שמור ובחר</Btn>
            )}
            <Btn variant="quiet" onClick={() => setShowCustomerModal(false)}>ביטול</Btn>
          </>
        )}
      >
        <Seg
          label="סוג הלקוח"
          value={customerMode}
          onChange={setCustomerMode}
          options={[
            { value: 'existing', label: 'לקוח קיים', icon: 'search' },
            { value: 'new', label: 'לקוח חדש', icon: 'plus' }
          ]}
        />

        {customerMode === 'existing' ? (
          <div className="v3-field">
            <span className="v3-label">חיפוש לקוח</span>
            {/* value=null בכוונה — אחרת שדה החיפוש מתמלא בשם הלקוח הנוכחי והרשימה מסוננת רק אליו */}
            <CustomerSelector
              value={null}
              onChange={selectCustomer}
              placeholder="שם, טלפון או עיר"
            />
          </div>
        ) : (
          <div className="v3-stack">
            <div className="oc-two">
              <Field label="שם פרטי" required type="text" autoComplete="off" value={newCustomer.firstName} onChange={e => setNewCustomer({ ...newCustomer, firstName: e.target.value })} />
              <Field label="שם משפחה" required type="text" autoComplete="off" value={newCustomer.lastName} onChange={e => setNewCustomer({ ...newCustomer, lastName: e.target.value })} />
            </div>
            <div className="oc-two">
              <Field label="טלפון" required type="text" dir="ltr" autoComplete="off" value={newCustomer.phone1} onChange={e => setNewCustomer({ ...newCustomer, phone1: e.target.value })} />
              <div className="v3-stack">
                <Field label="מייל" required type="email" dir="ltr" autoComplete="off" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                {(!newCustomer.email || !newCustomer.email.includes('@')) && (
                  <div>
                    <Btn
                      size="sm"
                      onClick={() => setNewCustomer(prev => ({ ...prev, email: (prev.email || '') + '@gmail.com' }))}
                    >
                      הוספת <bdi dir="ltr">@gmail.com</bdi>
                    </Btn>
                  </div>
                )}
              </div>
            </div>
            <div className="oc-two">
              <Field label="עיר" type="text" autoComplete="off" value={newCustomer.city} onChange={e => setNewCustomer({ ...newCustomer, city: e.target.value })} />
              <Field label="רחוב" type="text" autoComplete="off" value={newCustomer.street} onChange={e => setNewCustomer({ ...newCustomer, street: e.target.value })} />
            </div>
            <Field label="מספר בית" type="text" autoComplete="off" value={newCustomer.houseNum} onChange={e => setNewCustomer({ ...newCustomer, houseNum: e.target.value })} />
          </div>
        )}
      </Dialog>

      {/* ===== בורר "תשלום או זיכוי" עבור הכפתור המאוחד למעלה - חלונית בחירה ===== */}
      <Dialog
        open={showManualPaymentCreditChooser}
        variant="confirm"
        mode="light"
        icon="coin"
        title="איזו פעולה לרשום?"
        sub="שתי הפעולות דורשות קוד מאשר."
        onClose={() => setShowManualPaymentCreditChooser(false)}
        actions={<Btn variant="quiet" onClick={() => setShowManualPaymentCreditChooser(false)}>ביטול</Btn>}
      >
        <div className="v3-options">
          <button
            type="button"
            className="v3-option"
            onClick={() => { setShowManualPaymentCreditChooser(false); onOpenManualPaymentCredit?.('payment'); }}
          >
            <Icon name="coin" />
            <span>רישום תשלום נוסף<small>למשל מזומן</small></span>
          </button>
          <button
            type="button"
            className="v3-option"
            onClick={() => { setShowManualPaymentCreditChooser(false); onOpenManualPaymentCredit?.('credit'); }}
          >
            <Icon name="refresh" />
            <span>בקשת זיכוי ללקוח<small>החזר כסף על ההזמנה</small></span>
          </button>
        </div>
      </Dialog>

      {dialogs}
    </>
  );
}
