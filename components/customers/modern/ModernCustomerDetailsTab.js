'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';

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
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', marginBottom: '6px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>[{hebDate}]</span>
          <strong style={{ color: 'var(--primary)' }}>אוטומטי:</strong>
          <span>דגם {model} מידה {size}</span>
          <span>{restText}</span>
          <a
            href={`/orders/${orderId}`}
            title={`צפה בהזמנה ${orderId}`}
            style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', marginInlineStart: '4px' }}
          >
            <svg className="icon"><use href="#i-link" /></svg>
          </a>
        </div>
      );
    }

    return <div key={index} style={{ marginBottom: '4px', fontSize: '13px' }}>{line}</div>;
  });
};

export default function ModernCustomerDetailsTab({ customer, onChange, onEmailBlur, onSubmit, saving, onCopyEmail, onOpenEmailModal, cancelSignal }) {
  const [isEditing, setIsEditing] = useState(false);
  const isFirstCancelSignal = useRef(true);

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

  const handleToggleEdit = (e) => {
    if (e) e.preventDefault();
    setIsEditing(!isEditing);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (onSubmit) {
      // Assuming onSubmit handles the actual save promise and state
      await onSubmit(e);
    }
    setIsEditing(false); // Close edit mode after saving
  };

  const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'לקוח ללא שם';
  const address = [customer.street && `${customer.street} ${customer.houseNum || ''}`.trim(), customer.city].filter(Boolean).join(', ');

  return (
    <div>
      <div className="card card-pad" style={{ marginBottom: '18px' }}>
        <div className="card-title-row" style={{ marginBottom: isEditing ? '14px' : 0 }}>
          <svg className="icon"><use href="#i-id" /></svg>
          <h3 style={{ margin: 0 }}>{isEditing ? 'עריכת פרטים אישיים' : customerName}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon-only btn-sm"
            style={{ marginInlineStart: 'auto' }}
            title={isEditing ? 'סגור עריכה' : 'עריכת פרטים אישיים'}
            onClick={handleToggleEdit}
          >
            <svg className="icon"><use href={isEditing ? '#i-check' : '#i-edit'} /></svg>
          </button>
        </div>

        {!isEditing && (
          <div className="hint" style={{ color: 'var(--text-3)' }} title={[customer.phone1, customer.phone2, customer.email, address].filter(Boolean).join(' · ')}>
            {[customer.phone1, customer.phone2, customer.email, address].filter(Boolean).join(' · ') || 'אין פרטי קשר או כתובת'}
          </div>
        )}

        {isEditing && (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>שם פרטי *</label>
                <input type="text" className="input" name="firstName" value={customer.firstName || ''} onChange={onChange} required />
              </div>
              <div className="field">
                <label>שם משפחה *</label>
                <input type="text" className="input" name="lastName" value={customer.lastName || ''} onChange={onChange} required />
              </div>
              <div className="field">
                <label>טלפון *</label>
                <div className="input-icon-wrap">
                  <svg className="icon"><use href="#i-phone" /></svg>
                  <input type="text" className="input" style={{ direction: 'ltr' }} name="phone1" value={customer.phone1 || ''} onChange={onChange} required />
                </div>
              </div>
              <div className="field">
                <label>טלפון נוסף</label>
                <div className="input-icon-wrap">
                  <svg className="icon"><use href="#i-phone" /></svg>
                  <input type="text" className="input" style={{ direction: 'ltr' }} name="phone2" value={customer.phone2 || ''} onChange={onChange} />
                </div>
              </div>
              <div className="field">
                <label>דוא&quot;ל</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div className="input-icon-wrap" style={{ flex: 1 }}>
                    <svg className="icon"><use href="#i-mail" /></svg>
                    <input type="email" className="input" style={{ direction: 'ltr' }} name="email" value={customer.email || ''} onChange={onChange} onBlur={onEmailBlur} />
                  </div>
                  {customer.email && (
                    <>
                      <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="העתק כתובת מייל" onClick={onCopyEmail}>
                        <svg className="icon"><use href="#i-link" /></svg>
                      </button>
                      <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="שלח מייל" onClick={onOpenEmailModal}>
                        <svg className="icon"><use href="#i-mail" /></svg>
                      </button>
                    </>
                  )}
                </div>
                {(!customer.email || !customer.email.includes('@')) && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '6px' }}
                    onClick={() => onChange({ target: { name: 'email', value: `${customer.email || ''}@gmail.com` } })}
                  >
                    השלם ל- @gmail.com
                  </button>
                )}
              </div>
              <div className="field">
                <label>עיר</label>
                <input type="text" className="input" name="city" value={customer.city || ''} onChange={onChange} />
              </div>
              <div className="field">
                <label>רחוב</label>
                <input type="text" className="input" name="street" value={customer.street || ''} onChange={onChange} />
              </div>
              <div className="field">
                <label>מספר בית</label>
                <input type="number" className="input" name="houseNum" value={customer.houseNum || ''} onChange={onChange} />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>הערות</label>
              <textarea className="textarea" name="notes" value={customer.notes || ''} onChange={onChange} rows={4} />
            </div>
          </form>
        )}
      </div>

      {!isEditing && customer.notes && (
        <div className="card card-pad">
          <div className="card-title-row" style={{ marginBottom: '12px' }}>
            <svg className="icon"><use href="#i-file" /></svg>
            <h3 style={{ margin: 0 }}>הערות הלקוח</h3>
          </div>
          <div>{renderCustomerNotes(customer.notes)}</div>
        </div>
      )}
    </div>
  );
}
