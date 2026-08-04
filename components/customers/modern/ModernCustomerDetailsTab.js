'use client';

import React, { useState } from 'react';
import { Copy, Mail, Save, Edit2, Check, FileText } from 'lucide-react';

export default function ModernCustomerDetailsTab({ customer, onChange, onEmailBlur, onSubmit, saving, onCopyEmail, onOpenEmailModal }) {
  const [isEditing, setIsEditing] = useState(false);

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
  const initials = `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}` || '?';
  const address = [customer.street && `${customer.street} ${customer.houseNum || ''}`.trim(), customer.city].filter(Boolean).join(', ');

  return (
    <div className="moc-card-panel">
      {/* תצוגת קריאה - מעוצבת כמו כרטיס הזמנה */}
      <div className="moc-compact-row" style={{ paddingBottom: isEditing ? '16px' : '0', borderBottom: isEditing ? '1px solid var(--moc-border)' : 'none', marginBottom: isEditing ? '16px' : '0' }}>
        <div className="moc-avatar-chip">{initials}</div>
        <div className="moc-cr-main">
          <div className="moc-cr-title">{customerName}</div>
          <div className="moc-cr-sub" title={[customer.phone1, customer.phone2, customer.email, address].filter(Boolean).join(' · ')}>
            {[customer.phone1, customer.phone2, customer.email, address].filter(Boolean).join(' · ') || 'אין פרטי קשר או כתובת'}
          </div>
        </div>
        <div className="moc-cr-actions">
           <button type="button" className="moc-icon-btn-plain" title={isEditing ? 'סגור עריכה' : 'עריכת פרטים אישיים'} onClick={handleToggleEdit}>
             {isEditing ? <Check size={16} /> : <Edit2 size={16} />}
           </button>
        </div>
      </div>

      {!isEditing && customer.notes && (
        <div className="moc-compact-row" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--moc-border)' }}>
          <div className="moc-avatar-chip" style={{ background: 'transparent', color: 'var(--moc-text-muted)' }}><FileText size={17} /></div>
          <div className="moc-cr-main">
             <div className="moc-cr-title" style={{ fontSize: '0.9rem', color: 'var(--moc-text-muted)' }}>הערות הלקוח</div>
             <div className="moc-cr-sub" style={{ whiteSpace: 'pre-wrap' }}>{customer.notes}</div>
          </div>
        </div>
      )}

      {/* מצב עריכה (הטופס המקורי) */}
      {isEditing && (
        <form onSubmit={handleSubmit}>
          <div className="moc-grid-2">
            <div>
              <span className="moc-field-label">שם פרטי *</span>
              <input type="text" name="firstName" value={customer.firstName || ''} onChange={onChange} required />
            </div>
            <div>
              <span className="moc-field-label">שם משפחה *</span>
              <input type="text" name="lastName" value={customer.lastName || ''} onChange={onChange} required />
            </div>
            <div>
              <span className="moc-field-label">טלפון נייד *</span>
              <input type="text" name="phone1" value={customer.phone1 || ''} onChange={onChange} required style={{ direction: 'ltr' }} />
            </div>
            <div>
              <span className="moc-field-label">טלפון נוסף</span>
              <input type="text" name="phone2" value={customer.phone2 || ''} onChange={onChange} style={{ direction: 'ltr' }} />
            </div>
            <div>
              <span className="moc-field-label">דוא"ל</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="email" name="email" value={customer.email || ''} onChange={onChange} onBlur={onEmailBlur} style={{ direction: 'ltr' }} />
                {customer.email && (
                  <>
                    <button type="button" className="moc-icon-btn-plain" title="העתק כתובת מייל" onClick={onCopyEmail}>
                      <Copy size={16} />
                    </button>
                    <button type="button" className="moc-icon-btn-plain" title="שלח מייל" onClick={onOpenEmailModal}>
                      <Mail size={16} />
                    </button>
                  </>
                )}
              </div>
              {(!customer.email || !customer.email.includes('@')) && (
                <button
                  type="button"
                  className="moc-btn moc-btn-outline"
                  style={{ marginTop: '6px', padding: '4px 10px', fontSize: '0.8rem' }}
                  onClick={() => onChange({ target: { name: 'email', value: `${customer.email || ''}@gmail.com` } })}
                >
                  השלם ל- @gmail.com
                </button>
              )}
            </div>
            <div>
              <span className="moc-field-label">עיר</span>
              <input type="text" name="city" value={customer.city || ''} onChange={onChange} />
            </div>
            <div>
              <span className="moc-field-label">רחוב</span>
              <input type="text" name="street" value={customer.street || ''} onChange={onChange} />
            </div>
            <div>
              <span className="moc-field-label">מספר בית</span>
              <input type="number" name="houseNum" value={customer.houseNum || ''} onChange={onChange} />
            </div>
          </div>

          <div style={{ marginTop: '18px' }}>
            <span className="moc-field-label">הערות</span>
            <textarea name="notes" value={customer.notes || ''} onChange={onChange} rows={4} style={{ resize: 'vertical' }} />
          </div>

        </form>
      )}
    </div>
  );
}
