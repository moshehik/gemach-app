'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { fetchSharedJson, TTL } from '../../../lib/apiCache';
import { Card, Btn, IconBtn, Chip, Field, Row, Rows, Switch, Banner, Icon } from '@/app/v3/ui/components';

const renderCustomerNotes = (notes) => {
  if (!notes) return null;
  const lines = notes.split('\n');

  return lines.map((line, index) => {
    const autoNoteRegex = /\[(\d{1,2}\.\d{1,2}\.\d{4})\] אוטומטי: שמלה (\d+) \(הזמנה (\d+)\) (.*)/;
    const match = line.match(autoNoteRegex);

    if (match) {
      const [, dateStr, barcode, orderId, restText] = match;
      const [day, month, year] = dateStr.split('.').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const hebDate = getHebrewDateString(dateObj);

      const model = barcode.substring(0, 3);
      const size = barcode.substring(3, 5) || '';

      return (
        <div key={index} className="v3-cluster">
          <Chip><bdi>{hebDate}</bdi></Chip>
          <Chip variant="info" icon="sparkles">אוטומטי</Chip>
          <span>דגם <bdi>{model}</bdi> מידה <bdi>{size}</bdi></span>
          <span>{restText}</span>
          <a
            href={`/orders/${orderId}`}
            title={`צפה בהזמנה ${orderId}`}
            aria-label={`צפה בהזמנה ${orderId}`}
          >
            <Icon name="link" />
          </a>
        </div>
      );
    }

    return <div key={index}>{line}</div>;
  });
};

export default function ModernCustomerDetailsTab({ customer, onChange, onEmailBlur, onSubmit, saving, onCopyEmail, onOpenEmailModal, cancelSignal, isHeadManagement, onUnblock, settings = {} }) {
  const [isEditing, setIsEditing] = useState(false);
  const [customerLocations, setCustomerLocations] = useState({ cities: [], streets: [] });
  const isFirstCancelSignal = useRef(true);

  useEffect(() => {
    fetchSharedJson('/api/customers/locations', { ttl: TTL.REFERENCE })
      .then(data => setCustomerLocations({ cities: data?.cities || [], streets: data?.streets || [] }))
      .catch(err => console.error(err));
  }, []);

  // "ביטול שינויים" בכותרת העמוד משחזר את נתוני הלקוח, אבל לא ידע לסגור את מצב
  // העריכה המקומי הזה בלעדי אות מפורש - בלי זה השדות מתאפסים אבל הטופס נשאר פתוח
  // ונראה כאילו לחיצת הביטול לא עשתה כלום.
  useEffect(() => {
    if (isFirstCancelSignal.current) {
      isFirstCancelSignal.current = false;
      return;
    }
    setIsEditing(false);
  }, [cancelSignal]);

  // onSubmit (= handleSave מ-app/customers/[id]/page.js) מחזיר עכשיו true/false לפי
  // הצלחת השמירה בפעמון (ולידציה/שגיאת שרת מחזירות false) - כדי ששני הנתיבים כאן
  // (טופס + כפתור ה-V) יידעו לסגור את מצב העריכה רק כשבאמת נשמר, ולא בשקט מתחת
  // להודעת שגיאה שהמשתמש עוד לא הספיק לקרוא.
  const attemptSave = async (e) => {
    if (!onSubmit) {
      setIsEditing(false);
      return;
    }
    const success = await onSubmit(e);
    if (success) setIsEditing(false);
  };

  // כפתור ה-V בכותרת הכרטיס נראה כמו "שמירה" (משוב לקוח: מבלבל מול כפתור "שמירת
  // שינויים" הראשי למעלה) - עכשיו הוא אכן שומר, באותו נתיב ולידציה בדיוק כמו הכפתור
  // הראשי (onSubmit), במקום לסגור בשקט את הטופס בלי לשמור כלום.
  const handleToggleEdit = async (e) => {
    if (e) e.preventDefault();
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    await attemptSave(e);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await attemptSave(e);
  };

  const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'לקוח ללא שם';
  const address = [customer.street && `${customer.street} ${customer.houseNum || ''}`.trim(), customer.city].filter(Boolean).join(', ');
  const hasContact = !!(customer.phone1 || customer.phone2 || customer.email || address);

  return (
    <>
      {customer.isBlocked && (
        <Banner
          kind="alert"
          title="הלקוח חסום להזמנות חדשות"
          text={customer.blockedReason ? String(customer.blockedReason) : undefined}
          action={isHeadManagement ? { label: 'ביטול חסימה', onClick: onUnblock } : undefined}
        />
      )}

      <Card
        icon="id"
        title={isEditing ? 'עריכת פרטים אישיים' : customerName}
        tip="במצב עריכה, סימון ה-V שומר את הפרטים, כמו כפתור השמירה."
        actions={(
          <IconBtn
            icon={isEditing ? 'check' : 'edit'}
            label={isEditing ? 'סגור עריכה' : 'עריכת פרטים אישיים'}
            title={isEditing ? 'סגור עריכה' : 'עריכת פרטים אישיים'}
            variant="quiet"
            onClick={handleToggleEdit}
          />
        )}
      >
        {!isEditing && (
          hasContact ? (
            <Rows>
              {customer.phone1 && <Row label="טלפון" icon="phone"><bdi>{customer.phone1}</bdi></Row>}
              {customer.phone2 && <Row label="טלפון נוסף" icon="phone"><bdi>{customer.phone2}</bdi></Row>}
              {customer.email && <Row label="דוא&quot;ל" icon="mail"><bdi>{customer.email}</bdi></Row>}
              {address && <Row label="כתובת" icon="pin">{address}</Row>}
            </Rows>
          ) : (
            <Row label="פרטי קשר" icon="phone" missing missingText="לא הוזנו פרטי קשר או כתובת" />
          )
        )}

        {isEditing && (
          <form onSubmit={handleSubmit} autoComplete="off" className="v3-stack">
            <Field label="שם פרטי" required type="text" name="firstName" autoComplete="off" value={customer.firstName || ''} onChange={onChange} />
            <Field label="שם משפחה" required type="text" name="lastName" autoComplete="off" value={customer.lastName || ''} onChange={onChange} />
            <Field label="טלפון" required type="text" style={{ direction: 'ltr' }} name="phone1" autoComplete="off" value={customer.phone1 || ''} onChange={onChange} />
            <Field label="טלפון נוסף" type="text" style={{ direction: 'ltr' }} name="phone2" autoComplete="off" value={customer.phone2 || ''} onChange={onChange} />

            {/* require_customer_email/require_full_address חלים רק על יצירת לקוח חדש, לא על עריכת
                לקוח קיים כאן - כמו require_customer_id_number למטה (דיווח תקלה 48ff7055, 2026-09-22). */}
            <Field label="דוא&quot;ל" type="email" style={{ direction: 'ltr' }} name="email" autoComplete="off" value={customer.email || ''} onChange={onChange} onBlur={onEmailBlur} />
            <div className="v3-cluster">
              {customer.email && (
                <>
                  <IconBtn icon="copy" label="העתקת כתובת המייל" title="העתקת כתובת המייל" variant="quiet" size="sm" onClick={onCopyEmail} />
                  <IconBtn icon="mail" label="שליחת מייל" title="שליחת מייל" variant="quiet" size="sm" onClick={onOpenEmailModal} />
                </>
              )}
              {(!customer.email || !customer.email.includes('@')) && (
                <Btn
                  size="sm"
                  onClick={() => onChange({ target: { name: 'email', value: `${customer.email || ''}@gmail.com` } })}
                >
                  השלמה ל-@gmail.com
                </Btn>
              )}
            </div>

            <Field label="עיר" type="text" name="city" list="modern-cust-city-list" autoComplete="new-password" value={customer.city || ''} onChange={onChange} />
            <datalist id="modern-cust-city-list">
              {customerLocations.cities.map(c => <option key={c} value={c} />)}
            </datalist>
            <Field label="רחוב" type="text" name="street" list="modern-cust-street-list" autoComplete="new-password" value={customer.street || ''} onChange={onChange} />
            <datalist id="modern-cust-street-list">
              {customerLocations.streets.map(s => <option key={s} value={s} />)}
            </datalist>
            <Field label="מספר בית" type="number" name="houseNum" autoComplete="off" value={customer.houseNum || ''} onChange={onChange} />
            <Field
              label="תעודת זהות"
              tip="משמשת לאימות כשעורכים או מבטלים הזמנה."
              type="text"
              style={{ direction: 'ltr' }}
              name="zeout"
              autoComplete="off"
              value={customer.zeout || ''}
              onChange={onChange}
              placeholder="ת״ז"
            />
            {settings.hide_marketing_consent_field !== 'true' && (
              <Switch
                id="marketingConsent"
                name="marketingConsent"
                checked={!!customer.marketingConsent}
                onChange={(v) => onChange({ target: { name: 'marketingConsent', value: v } })}
                label="מאשר/ת קבלת דיוורים"
              />
            )}
            <Field label="הערות" as="textarea" name="notes" autoComplete="off" value={customer.notes || ''} onChange={onChange} rows={4} />

            {/* כפתור שמירה בסוף הטופס, בנוסף לכפתור "שמירת שינויים" הראשי למעלה
                ולכפתור ה-V בכותרת הכרטיס - בקשת עובדת (דיווח 823fef1d): לא צריך
                לגלול חזרה למעלה אחרי מילוי כל הפרטים כדי לשמור. */}
            <Btn type="submit" variant="primary" icon="check" block loading={saving}>
              שמירת שינויים
            </Btn>
          </form>
        )}
      </Card>

      {!isEditing && customer.notes && (
        <Card icon="file" title="הערות" variant="quiet">
          <div className="v3-stack">{renderCustomerNotes(customer.notes)}</div>
        </Card>
      )}
    </>
  );
}
